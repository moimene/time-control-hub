import { useState, useEffect, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { Card, CardContent } from '@/components/ui/card';
import { Clock, QrCode, KeyRound } from 'lucide-react';
import { KioskPinPad } from '@/components/kiosk/KioskPinPad';
import { KioskQrScanner } from '@/components/kiosk/KioskQrScanner';
import { KioskSuccess } from '@/components/kiosk/KioskSuccess';
import { OfflineIndicator } from '@/components/kiosk/OfflineIndicator';
import { useToast } from '@/hooks/use-toast';
import { useOfflineQueue } from '@/hooks/useOfflineQueue';
import { useConnectionStatus } from '@/hooks/useConnectionStatus';
import { supabase } from '@/integrations/supabase/client';

type KioskMode = 'home' | 'pin' | 'qr' | 'success';

interface ClockResult {
  employee: {
    first_name: string;
    last_name: string;
    employee_code: string;
  };
  event: {
    id: string;
    type: 'entry' | 'exit';
    timestamp: string;
  };
  isOffline?: boolean;
}

export default function KioskHome() {
  const [searchParams] = useSearchParams();
  const terminalId = searchParams.get('terminal');
  
  const [currentTime, setCurrentTime] = useState(new Date());
  const [mode, setMode] = useState<KioskMode>('home');
  const [clockResult, setClockResult] = useState<ClockResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isValidating, setIsValidating] = useState(false);
  const [employeeName, setEmployeeName] = useState<string>('');
  const [nextEventType, setNextEventType] = useState<'entry' | 'exit'>('entry');
  const [overrideInfo, setOverrideInfo] = useState<{ eventType: 'entry' | 'exit'; reason: string } | null>(null);
  const [employeeCodePrefix, setEmployeeCodePrefix] = useState<string>('EMP');
  const [companyName, setCompanyName] = useState<string>('');
  const { toast } = useToast();
  
  const { isOnline } = useConnectionStatus();
  const { queueSize, isSyncing, lastSync, addToQueue, syncQueue } = useOfflineQueue();

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Fetch company prefix from terminal
  useEffect(() => {
    const fetchCompanyPrefix = async () => {
      if (!terminalId) return;
      
      try {
        const { data: terminalData, error: terminalError } = await supabase
          .from('terminals')
          .select('company_id')
          .eq('id', terminalId)
          .single();
        
        if (terminalError || !terminalData) return;
        
        const { data: companyData, error: companyError } = await supabase
          .from('company')
          .select('name, employee_code_prefix')
          .eq('id', terminalData.company_id)
          .single();
        
        if (!companyError && companyData) {
          setEmployeeCodePrefix(companyData.employee_code_prefix || 'EMP');
          setCompanyName(companyData.name || '');
        }
      } catch (err) {
        console.error('Error fetching company prefix:', err);
      }
    };
    
    fetchCompanyPrefix();
  }, [terminalId]);

  // Auto-sync when coming back online
  useEffect(() => {
    if (isOnline && queueSize > 0) {
      syncQueue().then(({ synced, failed }) => {
        if (synced > 0) {
          toast({
            title: 'Sincronización completada',
            description: `${synced} fichaje${synced !== 1 ? 's' : ''} sincronizado${synced !== 1 ? 's' : ''}`,
          });
        }
        if (failed > 0) {
          toast({
            variant: 'destructive',
            title: 'Error de sincronización',
            description: `${failed} fichaje${failed !== 1 ? 's' : ''} no se pudo${failed !== 1 ? 'ieron' : ''} sincronizar`,
          });
        }
      });
    }
  }, [isOnline, queueSize, syncQueue, toast]);

  // Validate employee code - works offline with cached validation
  const handleValidateCode = useCallback(async (employeeCode: string): Promise<{ valid: boolean; name?: string }> => {
    if (!isOnline) {
      // In offline mode, we accept the code without validation
      // The server will validate when syncing
      return { valid: true, name: 'Empleado' };
    }

    setIsValidating(true);
    try {
      const { data, error } = await supabase.functions.invoke('kiosk-clock', {
        body: {
          action: 'validate',
          employee_code: employeeCode,
        },
      });

      if (error || !data?.success) {
        toast({
          variant: 'destructive',
          title: 'Empleado no encontrado',
          description: data?.error || 'Verifica tu número de empleado',
        });
        return { valid: false };
      }

      setNextEventType(data.next_event_type);
      setEmployeeName(data.employee.first_name);
      return { valid: true, name: data.employee.first_name };
    } catch (err) {
      // If connection fails, allow offline mode
      if (!isOnline) {
        return { valid: true, name: 'Empleado' };
      }
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Error de conexión',
      });
      return { valid: false };
    } finally {
      setIsValidating(false);
    }
  }, [isOnline, toast]);

  const handlePinSubmit = useCallback(async (
    employeeCode: string, 
    pin: string, 
    overrideData?: { eventType: 'entry' | 'exit'; reason: string }
  ) => {
    setIsLoading(true);
    
    // If offline, store in queue
    if (!isOnline) {
      try {
        const eventType = overrideData?.eventType || nextEventType;
        const offlineEvent = await addToQueue(
          employeeCode,
          eventType,
          'pin',
          pin,
          overrideData?.reason
        );

        setClockResult({
          employee: {
            first_name: employeeName || 'Empleado',
            last_name: '',
            employee_code: employeeCode,
          },
          event: {
            id: offlineEvent.id,
            type: eventType,
            timestamp: offlineEvent.local_timestamp,
          },
          isOffline: true,
        });
        setOverrideInfo(overrideData || null);
        setMode('success');
        
        toast({
          title: 'Fichaje guardado localmente',
          description: 'Se sincronizará automáticamente cuando vuelva la conexión',
        });
      } catch (err) {
        toast({
          variant: 'destructive',
          title: 'Error',
          description: 'No se pudo guardar el fichaje offline',
        });
      } finally {
        setIsLoading(false);
      }
      return;
    }

    // Online mode - send directly
    try {
      const body: Record<string, unknown> = {
        action: 'pin',
        employee_code: employeeCode,
        pin: pin,
      };

      if (overrideData) {
        body.event_type = overrideData.eventType;
        body.override_reason = overrideData.reason;
      }

      const { data, error } = await supabase.functions.invoke('kiosk-clock', {
        body,
      });

      if (error || !data.success) {
        toast({
          variant: 'destructive',
          title: data?.conflict ? 'Fichaje duplicado' : 'Error',
          description: data?.error || 'Error al fichar',
        });
        return;
      }

      setClockResult({ ...data, isOffline: false });
      setOverrideInfo(overrideData || null);
      setMode('success');
    } catch (err) {
      // If request fails, try offline mode
      const eventType = overrideData?.eventType || nextEventType;
      try {
        const offlineEvent = await addToQueue(
          employeeCode,
          eventType,
          'pin',
          pin,
          overrideData?.reason
        );

        setClockResult({
          employee: {
            first_name: employeeName || 'Empleado',
            last_name: '',
            employee_code: employeeCode,
          },
          event: {
            id: offlineEvent.id,
            type: eventType,
            timestamp: offlineEvent.local_timestamp,
          },
          isOffline: true,
        });
        setOverrideInfo(overrideData || null);
        setMode('success');
        
        toast({
          title: 'Conexión perdida',
          description: 'Fichaje guardado localmente, se sincronizará automáticamente',
        });
      } catch (offlineErr) {
        toast({
          variant: 'destructive',
          title: 'Error',
          description: 'Error de conexión y no se pudo guardar offline',
        });
      }
    } finally {
      setIsLoading(false);
    }
  }, [isOnline, nextEventType, employeeName, addToQueue, toast]);

  const handleQrScan = useCallback(async (qrToken: string) => {
    setIsLoading(true);
    
    // Parse QR token to get employee code
    const [empCode] = qrToken.split(':');
    
    // If offline, store in queue
    if (!isOnline) {
      try {
        const eventType = nextEventType;
        const offlineEvent = await addToQueue(
          empCode,
          eventType,
          'qr',
          qrToken
        );

        setClockResult({
          employee: {
            first_name: 'Empleado',
            last_name: '',
            employee_code: empCode,
          },
          event: {
            id: offlineEvent.id,
            type: eventType,
            timestamp: offlineEvent.local_timestamp,
          },
          isOffline: true,
        });
        setOverrideInfo(null);
        setMode('success');
        
        toast({
          title: 'Fichaje guardado localmente',
          description: 'Se sincronizará automáticamente cuando vuelva la conexión',
        });
      } catch (err) {
        toast({
          variant: 'destructive',
          title: 'Error',
          description: 'No se pudo guardar el fichaje offline',
        });
        setMode('home');
      } finally {
        setIsLoading(false);
      }
      return;
    }

    // Online mode
    try {
      const { data, error } = await supabase.functions.invoke('kiosk-clock', {
        body: {
          action: 'qr',
          qr_token: qrToken,
        },
      });

      if (error || !data.success) {
        toast({
          variant: 'destructive',
          title: data?.conflict ? 'Fichaje duplicado' : 'Error',
          description: data?.error || 'Error al fichar',
        });
        setMode('home');
        return;
      }

      setClockResult({ ...data, isOffline: false });
      setOverrideInfo(null);
      setMode('success');
    } catch (err) {
      // If request fails, try offline mode
      try {
        const eventType = nextEventType;
        const offlineEvent = await addToQueue(
          empCode,
          eventType,
          'qr',
          qrToken
        );

        setClockResult({
          employee: {
            first_name: 'Empleado',
            last_name: '',
            employee_code: empCode,
          },
          event: {
            id: offlineEvent.id,
            type: eventType,
            timestamp: offlineEvent.local_timestamp,
          },
          isOffline: true,
        });
        setOverrideInfo(null);
        setMode('success');
        
        toast({
          title: 'Conexión perdida',
          description: 'Fichaje guardado localmente, se sincronizará automáticamente',
        });
      } catch (offlineErr) {
        toast({
          variant: 'destructive',
          title: 'Error',
          description: 'Error de conexión',
        });
        setMode('home');
      }
    } finally {
      setIsLoading(false);
    }
  }, [isOnline, nextEventType, addToQueue, toast]);

  const handleSuccessClose = useCallback(() => {
    setClockResult(null);
    setOverrideInfo(null);
    setEmployeeName('');
    setNextEventType('entry');
    setMode('home');
  }, []);

  const handlePinCancel = useCallback(() => {
    setEmployeeName('');
    setNextEventType('entry');
    setMode('home');
  }, []);

  if (mode === 'pin') {
    return (
      <>
        <OfflineIndicator 
          isOnline={isOnline} 
          queueSize={queueSize} 
          isSyncing={isSyncing}
          lastSync={lastSync}
        />
        <KioskPinPad
          onSubmit={handlePinSubmit}
          onCancel={handlePinCancel}
          onValidateCode={handleValidateCode}
          isLoading={isLoading}
          isValidating={isValidating}
          employeeName={employeeName}
          nextEventType={nextEventType}
          employeeCodePrefix={employeeCodePrefix}
        />
      </>
    );
  }

  if (mode === 'qr') {
    return (
      <>
        <OfflineIndicator 
          isOnline={isOnline} 
          queueSize={queueSize} 
          isSyncing={isSyncing}
          lastSync={lastSync}
        />
        <KioskQrScanner
          onScan={handleQrScan}
          onCancel={() => setMode('home')}
          isLoading={isLoading}
        />
      </>
    );
  }

  if (mode === 'success' && clockResult) {
    return (
      <>
        <OfflineIndicator 
          isOnline={isOnline} 
          queueSize={queueSize} 
          isSyncing={isSyncing}
          lastSync={lastSync}
        />
        <KioskSuccess
          result={clockResult}
          onClose={handleSuccessClose}
          overrideInfo={overrideInfo || undefined}
          isOffline={clockResult.isOffline}
        />
      </>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background to-muted flex flex-col items-center justify-center p-4">
      <OfflineIndicator 
        isOnline={isOnline} 
        queueSize={queueSize} 
        isSyncing={isSyncing}
        lastSync={lastSync}
      />
      
      {/* Clock Display */}
      <div className="text-center mb-12">
        {companyName && (
          <div className="text-lg font-medium text-primary mb-2">{companyName}</div>
        )}
        <div className="flex items-center justify-center gap-3 mb-4">
          <Clock className="h-10 w-10 text-primary" />
          <h1 className="text-4xl font-bold">Control Horario</h1>
        </div>
        <div className="text-7xl font-mono font-bold text-primary tabular-nums">
          {format(currentTime, 'HH:mm:ss')}
        </div>
        <div className="text-2xl text-muted-foreground mt-2">
          {format(currentTime, "EEEE, d 'de' MMMM 'de' yyyy", { locale: es })}
        </div>
      </div>

      {/* Action Buttons */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 w-full max-w-2xl">
        <Card 
          className="cursor-pointer transition-all hover:scale-105 hover:shadow-lg"
          onClick={() => setMode('qr')}
        >
          <CardContent className="flex flex-col items-center justify-center p-8">
            <div className="h-20 w-20 rounded-full bg-primary/10 flex items-center justify-center mb-4">
              <QrCode className="h-10 w-10 text-primary" />
            </div>
            <h2 className="text-2xl font-semibold mb-2">Escanear QR</h2>
            <p className="text-muted-foreground text-center">
              Usa tu código QR personal para fichar
            </p>
          </CardContent>
        </Card>

        <Card 
          className="cursor-pointer transition-all hover:scale-105 hover:shadow-lg"
          onClick={() => setMode('pin')}
        >
          <CardContent className="flex flex-col items-center justify-center p-8">
            <div className="h-20 w-20 rounded-full bg-primary/10 flex items-center justify-center mb-4">
              <KeyRound className="h-10 w-10 text-primary" />
            </div>
            <h2 className="text-2xl font-semibold mb-2">Código + PIN</h2>
            <p className="text-muted-foreground text-center">
              Introduce tu código de empleado y PIN
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Footer */}
      <div className="mt-12 text-sm text-muted-foreground">
        {!isOnline ? 'Modo sin conexión activo - Los fichajes se guardarán localmente' : 'Toca una opción para fichar'}
      </div>
    </div>
  );
}
