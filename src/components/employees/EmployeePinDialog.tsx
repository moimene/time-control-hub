import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Eye, EyeOff } from 'lucide-react';
import type { Employee } from '@/types/database';

interface EmployeePinDialogProps {
  employee: Employee | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function EmployeePinDialog({ employee, open, onOpenChange }: EmployeePinDialogProps) {
  const [pin, setPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [showPin, setShowPin] = useState(false);
  const [error, setError] = useState('');
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const updatePinMutation = useMutation({
    mutationFn: async ({ employeeId, newPin }: { employeeId: string; newPin: string }) => {
      // Generate salt
      const saltArray = new Uint8Array(16);
      crypto.getRandomValues(saltArray);
      const salt = Array.from(saltArray).map(b => b.toString(16).padStart(2, '0')).join('');

      // Hash PIN with salt
      const encoder = new TextEncoder();
      const pinWithSalt = encoder.encode(newPin + salt);
      const hashBuffer = await crypto.subtle.digest('SHA-256', pinWithSalt);
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      const pinHash = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');

      const { error } = await supabase
        .from('employees')
        .update({
          pin_hash: pinHash,
          pin_salt: salt,
          pin_failed_attempts: 0,
          pin_locked_until: null,
        })
        .eq('id', employeeId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['employees'] });
      toast({ title: 'PIN actualizado correctamente' });
      handleClose();
    },
    onError: (error) => {
      toast({ variant: 'destructive', title: 'Error', description: error.message });
    },
  });

  const handleClose = () => {
    setPin('');
    setConfirmPin('');
    setError('');
    setShowPin(false);
    onOpenChange(false);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    // Validate PIN format
    if (!/^\d{4}$/.test(pin)) {
      setError('El PIN debe tener exactamente 4 dígitos numéricos');
      return;
    }

    if (pin !== confirmPin) {
      setError('Los PINs no coinciden');
      return;
    }

    if (employee) {
      updatePinMutation.mutate({ employeeId: employee.id, newPin: pin });
    }
  };

  const handlePinChange = (value: string, setter: (v: string) => void) => {
    // Only allow digits and max 4 characters
    const cleaned = value.replace(/\D/g, '').slice(0, 4);
    setter(cleaned);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Cambiar PIN</DialogTitle>
          <DialogDescription>
            {employee?.first_name} {employee?.last_name} ({employee?.employee_code})
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="pin">Nuevo PIN (4 dígitos)</Label>
            <div className="relative">
              <Input
                id="pin"
                type={showPin ? 'text' : 'password'}
                value={pin}
                onChange={(e) => handlePinChange(e.target.value, setPin)}
                placeholder="••••"
                maxLength={4}
                pattern="\d{4}"
                inputMode="numeric"
                className="pr-10 text-center text-2xl tracking-widest font-mono"
              />
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="absolute right-0 top-0 h-full"
                onClick={() => setShowPin(!showPin)}
              >
                {showPin ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </Button>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="confirmPin">Confirmar PIN</Label>
            <Input
              id="confirmPin"
              type={showPin ? 'text' : 'password'}
              value={confirmPin}
              onChange={(e) => handlePinChange(e.target.value, setConfirmPin)}
              placeholder="••••"
              maxLength={4}
              pattern="\d{4}"
              inputMode="numeric"
              className="text-center text-2xl tracking-widest font-mono"
            />
          </div>

          {error && (
            <p className="text-sm text-destructive">{error}</p>
          )}

          <Button 
            type="submit" 
            className="w-full" 
            disabled={updatePinMutation.isPending || pin.length !== 4 || confirmPin.length !== 4}
          >
            {updatePinMutation.isPending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Guardando...
              </>
            ) : (
              'Guardar PIN'
            )}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
