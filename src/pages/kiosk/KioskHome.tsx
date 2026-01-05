import { useState, useEffect } from 'react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { Card, CardContent } from '@/components/ui/card';
import { Clock, QrCode, KeyRound } from 'lucide-react';
import { KioskPinPad } from '@/components/kiosk/KioskPinPad';
import { KioskQrScanner } from '@/components/kiosk/KioskQrScanner';
import { KioskSuccess } from '@/components/kiosk/KioskSuccess';
import { useToast } from '@/hooks/use-toast';
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
}

export default function KioskHome() {
  const [currentTime, setCurrentTime] = useState(new Date());
  const [mode, setMode] = useState<KioskMode>('home');
  const [clockResult, setClockResult] = useState<ClockResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isValidating, setIsValidating] = useState(false);
  const [employeeName, setEmployeeName] = useState<string>('');
  const { toast } = useToast();

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Validate employee code and get name
  const handleValidateCode = async (employeeCode: string): Promise<{ valid: boolean; name?: string }> => {
    setIsValidating(true);
    try {
      const { data, error } = await supabase
        .from('employees')
        .select('first_name, last_name')
        .eq('employee_code', employeeCode)
        .maybeSingle();

      if (error || !data) {
        toast({
          variant: 'destructive',
          title: 'Empleado no encontrado',
          description: 'Verifica tu número de empleado',
        });
        return { valid: false };
      }

      const fullName = data.first_name;
      setEmployeeName(fullName);
      return { valid: true, name: fullName };
    } catch (err) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Error de conexión',
      });
      return { valid: false };
    } finally {
      setIsValidating(false);
    }
  };

  const handlePinSubmit = async (employeeCode: string, pin: string) => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('kiosk-clock', {
        body: {
          action: 'pin',
          employee_code: employeeCode,
          pin: pin,
        },
      });

      if (error || !data.success) {
        toast({
          variant: 'destructive',
          title: 'Error',
          description: data?.error || 'Error al fichar',
        });
        return;
      }

      setClockResult(data);
      setMode('success');
    } catch (err) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Error de conexión',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleQrScan = async (qrToken: string) => {
    setIsLoading(true);
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
          title: 'Error',
          description: data?.error || 'Error al fichar',
        });
        setMode('home');
        return;
      }

      setClockResult(data);
      setMode('success');
    } catch (err) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Error de conexión',
      });
      setMode('home');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSuccessClose = () => {
    setClockResult(null);
    setEmployeeName('');
    setMode('home');
  };

  const handlePinCancel = () => {
    setEmployeeName('');
    setMode('home');
  };

  if (mode === 'pin') {
    return (
      <KioskPinPad
        onSubmit={handlePinSubmit}
        onCancel={handlePinCancel}
        onValidateCode={handleValidateCode}
        isLoading={isLoading}
        isValidating={isValidating}
        employeeName={employeeName}
      />
    );
  }

  if (mode === 'qr') {
    return (
      <KioskQrScanner
        onScan={handleQrScan}
        onCancel={() => setMode('home')}
        isLoading={isLoading}
      />
    );
  }

  if (mode === 'success' && clockResult) {
    return (
      <KioskSuccess
        result={clockResult}
        onClose={handleSuccessClose}
      />
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background to-muted flex flex-col items-center justify-center p-4">
      {/* Clock Display */}
      <div className="text-center mb-12">
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
        Toca una opción para fichar
      </div>
    </div>
  );
}
