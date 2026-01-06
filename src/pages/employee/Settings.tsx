import { useState, useEffect } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { EmployeeLayout } from '@/components/layout/EmployeeLayout';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { Key, QrCode, Download, RefreshCw, Eye, EyeOff } from 'lucide-react';

export default function EmployeeSettings() {
  const { employee } = useAuth();
  const { toast } = useToast();
  const [currentPin, setCurrentPin] = useState('');
  const [newPin, setNewPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [showPins, setShowPins] = useState(false);
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);

  // Fetch employee QR data
  const { data: qrData, isLoading: qrLoading, refetch: refetchQr } = useQuery({
    queryKey: ['employee-qr-self', employee?.id],
    queryFn: async () => {
      if (!employee?.id) return null;
      const { data, error } = await supabase
        .from('employee_qr')
        .select('*')
        .eq('employee_id', employee.id)
        .eq('is_active', true)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!employee?.id,
  });

  // Generate QR code image
  useEffect(() => {
    if (qrData && employee) {
      const payload = JSON.stringify({
        e: employee.id,
        v: qrData.version,
        h: qrData.token_hash.substring(0, 8)
      });
      
      const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(payload)}`;
      
      // Create canvas with employee info
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = 250;
        canvas.height = 300;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.fillStyle = '#ffffff';
          ctx.fillRect(0, 0, canvas.width, canvas.height);
          ctx.drawImage(img, 25, 20, 200, 200);
          
          ctx.fillStyle = '#000000';
          ctx.font = 'bold 14px Arial';
          ctx.textAlign = 'center';
          ctx.fillText(`${employee.first_name} ${employee.last_name}`, canvas.width / 2, 240);
          
          ctx.font = '12px Arial';
          ctx.fillText(`Código: ${employee.employee_code}`, canvas.width / 2, 260);
          ctx.fillText(`Versión: ${qrData.version}`, canvas.width / 2, 280);
          
          setQrDataUrl(canvas.toDataURL('image/png'));
        }
      };
      img.src = qrUrl;
    }
  }, [qrData, employee]);

  const changePinMutation = useMutation({
    mutationFn: async () => {
      const { data: sessionData } = await supabase.auth.getSession();
      if (!sessionData.session) throw new Error('No autenticado');

      const { data, error } = await supabase.functions.invoke('employee-change-pin', {
        body: { currentPin, newPin },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      return data;
    },
    onSuccess: () => {
      toast({ title: 'PIN actualizado correctamente' });
      setCurrentPin('');
      setNewPin('');
      setConfirmPin('');
    },
    onError: (error: Error) => {
      toast({ variant: 'destructive', title: 'Error', description: error.message });
    },
  });

  const handleChangePin = (e: React.FormEvent) => {
    e.preventDefault();
    if (newPin !== confirmPin) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Los PINs no coinciden',
      });
      return;
    }
    if (!/^\d{4}$/.test(newPin)) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'El PIN debe tener exactamente 4 dígitos',
      });
      return;
    }
    changePinMutation.mutate();
  };

  const handleDownloadQr = () => {
    if (qrDataUrl && employee) {
      const link = document.createElement('a');
      link.download = `QR_${employee.employee_code}.png`;
      link.href = qrDataUrl;
      link.click();
    }
  };

  return (
    <EmployeeLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Configuración</h1>
          <p className="text-muted-foreground">
            Gestiona tu PIN y código QR
          </p>
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          {/* Change PIN */}
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <Key className="h-5 w-5" />
                <CardTitle>Cambiar PIN</CardTitle>
              </div>
              <CardDescription>
                Actualiza tu PIN de fichaje (4 dígitos)
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleChangePin} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="currentPin">PIN actual</Label>
                  <div className="relative">
                    <Input
                      id="currentPin"
                      type={showPins ? 'text' : 'password'}
                      inputMode="numeric"
                      pattern="[0-9]*"
                      maxLength={4}
                      value={currentPin}
                      onChange={(e) => setCurrentPin(e.target.value.replace(/\D/g, ''))}
                      placeholder="••••"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="newPin">Nuevo PIN</Label>
                  <Input
                    id="newPin"
                    type={showPins ? 'text' : 'password'}
                    inputMode="numeric"
                    pattern="[0-9]*"
                    maxLength={4}
                    value={newPin}
                    onChange={(e) => setNewPin(e.target.value.replace(/\D/g, ''))}
                    placeholder="••••"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="confirmPin">Confirmar nuevo PIN</Label>
                  <Input
                    id="confirmPin"
                    type={showPins ? 'text' : 'password'}
                    inputMode="numeric"
                    pattern="[0-9]*"
                    maxLength={4}
                    value={confirmPin}
                    onChange={(e) => setConfirmPin(e.target.value.replace(/\D/g, ''))}
                    placeholder="••••"
                  />
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => setShowPins(!showPins)}
                  >
                    {showPins ? <EyeOff className="h-4 w-4 mr-1" /> : <Eye className="h-4 w-4 mr-1" />}
                    {showPins ? 'Ocultar' : 'Mostrar'}
                  </Button>
                </div>
                <Button type="submit" className="w-full" disabled={changePinMutation.isPending}>
                  {changePinMutation.isPending ? 'Actualizando...' : 'Actualizar PIN'}
                </Button>
              </form>
            </CardContent>
          </Card>

          {/* QR Code */}
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <QrCode className="h-5 w-5" />
                <CardTitle>Mi Código QR</CardTitle>
              </div>
              <CardDescription>
                Tu código QR personal para fichar
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col items-center justify-center py-4">
              {qrLoading ? (
                <div className="h-48 w-48 rounded-lg border-2 border-dashed border-muted-foreground/25 flex items-center justify-center">
                  <RefreshCw className="h-8 w-8 text-muted-foreground/50 animate-spin" />
                </div>
              ) : qrDataUrl ? (
                <>
                  <img 
                    src={qrDataUrl} 
                    alt="Código QR" 
                    className="rounded-lg border"
                  />
                  <div className="flex gap-2 mt-4">
                    <Button variant="outline" size="sm" onClick={handleDownloadQr}>
                      <Download className="h-4 w-4 mr-1" />
                      Descargar
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => refetchQr()}>
                      <RefreshCw className="h-4 w-4 mr-1" />
                      Actualizar
                    </Button>
                  </div>
                </>
              ) : (
                <>
                  <div className="h-48 w-48 rounded-lg border-2 border-dashed border-muted-foreground/25 flex items-center justify-center">
                    <QrCode className="h-16 w-16 text-muted-foreground/50" />
                  </div>
                  <p className="text-sm text-muted-foreground mt-4 text-center">
                    No tienes un código QR activo. Solicita uno a un administrador.
                  </p>
                </>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </EmployeeLayout>
  );
}
