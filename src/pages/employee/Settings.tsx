import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { EmployeeLayout } from '@/components/layout/EmployeeLayout';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { Key, QrCode } from 'lucide-react';

export default function EmployeeSettings() {
  const { employee } = useAuth();
  const { toast } = useToast();
  const [currentPin, setCurrentPin] = useState('');
  const [newPin, setNewPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');

  const changePinMutation = useMutation({
    mutationFn: async () => {
      // This would call an edge function to securely update the PIN
      // For now, we'll show a placeholder
      throw new Error('Cambio de PIN no implementado aún');
    },
    onSuccess: () => {
      toast({ title: 'PIN actualizado correctamente' });
      setCurrentPin('');
      setNewPin('');
      setConfirmPin('');
    },
    onError: (error) => {
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
    if (newPin.length < 4 || newPin.length > 8) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'El PIN debe tener entre 4 y 8 dígitos',
      });
      return;
    }
    changePinMutation.mutate();
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
                Actualiza tu PIN de fichaje (4-8 dígitos)
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleChangePin} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="currentPin">PIN actual</Label>
                  <Input
                    id="currentPin"
                    type="password"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    maxLength={8}
                    value={currentPin}
                    onChange={(e) => setCurrentPin(e.target.value.replace(/\D/g, ''))}
                    placeholder="••••"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="newPin">Nuevo PIN</Label>
                  <Input
                    id="newPin"
                    type="password"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    maxLength={8}
                    value={newPin}
                    onChange={(e) => setNewPin(e.target.value.replace(/\D/g, ''))}
                    placeholder="••••"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="confirmPin">Confirmar nuevo PIN</Label>
                  <Input
                    id="confirmPin"
                    type="password"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    maxLength={8}
                    value={confirmPin}
                    onChange={(e) => setConfirmPin(e.target.value.replace(/\D/g, ''))}
                    placeholder="••••"
                  />
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
            <CardContent className="flex flex-col items-center justify-center py-8">
              <div className="h-48 w-48 rounded-lg border-2 border-dashed border-muted-foreground/25 flex items-center justify-center">
                <QrCode className="h-16 w-16 text-muted-foreground/50" />
              </div>
              <p className="text-sm text-muted-foreground mt-4 text-center">
                Solicita tu código QR a un administrador
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    </EmployeeLayout>
  );
}
