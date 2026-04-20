import { useState, useId } from 'react';
import { useMutation } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { Copy, KeyRound, RefreshCw, User, Mail, AlertTriangle, CheckCircle2 } from 'lucide-react';
import type { Employee } from '@/types/database';

interface EmployeeCredentialsDialogProps {
  employee: Employee | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

function generateSuggestedPassword(employee: Employee): string {
  const firstName = employee.first_name.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  const lastName = employee.last_name.split(' ')[0].toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  const year = new Date().getFullYear();
  return `${firstName}.${lastName}${year}!`;
}

export function EmployeeCredentialsDialog({ employee, open, onOpenChange }: EmployeeCredentialsDialogProps) {
  const [password, setPassword] = useState('');
  const [showCredentials, setShowCredentials] = useState(false);
  const [createdCredentials, setCreatedCredentials] = useState<{ email: string; password: string } | null>(null);

  const emailId = useId();
  const passwordId = useId();

  const createUserMutation = useMutation({
    mutationFn: async ({ email, password }: { email: string; password: string }) => {
      const { data, error } = await supabase.functions.invoke('employee-credentials', {
        body: {
          action: 'create',
          employee_id: employee?.id,
          email,
          password,
        },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      return data;
    },
    onSuccess: (_, variables) => {
      setCreatedCredentials({ email: variables.email, password: variables.password });
      setShowCredentials(true);
      toast.success('Usuario creado correctamente');
    },
    onError: (error: Error) => {
      toast.error('Error al crear usuario: ' + error.message);
    },
  });

  const resetPasswordMutation = useMutation({
    mutationFn: async ({ userId, newPassword }: { userId: string; newPassword: string }) => {
      const { data, error } = await supabase.functions.invoke('employee-credentials', {
        body: {
          action: 'reset_password',
          user_id: userId,
          new_password: newPassword,
        },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      return data;
    },
    onSuccess: () => {
      toast.success('Contraseña reseteada correctamente');
      setShowCredentials(true);
    },
    onError: (error: Error) => {
      toast.error('Error al resetear contraseña: ' + error.message);
    },
  });

  const handleCreateUser = () => {
    if (!employee?.email) {
      toast.error('El empleado debe tener un email configurado');
      return;
    }
    const pwd = password || generateSuggestedPassword(employee);
    createUserMutation.mutate({ email: employee.email, password: pwd });
  };

  const handleResetPassword = () => {
    if (!employee?.user_id) {
      toast.error('El empleado no tiene usuario vinculado');
      return;
    }
    const newPwd = password || generateSuggestedPassword(employee);
    setCreatedCredentials({ email: employee.email || '', password: newPwd });
    resetPasswordMutation.mutate({ userId: employee.user_id, newPassword: newPwd });
  };

  const copyCredentials = () => {
    if (createdCredentials) {
      const text = `Email: ${createdCredentials.email}\nContraseña: ${createdCredentials.password}`;
      navigator.clipboard.writeText(text);
      toast.success('Credenciales copiadas al portapapeles');
    }
  };

  const hasUser = !!employee?.user_id;
  const suggestedPassword = employee ? generateSuggestedPassword(employee) : '';

  const handleClose = () => {
    setPassword('');
    setShowCredentials(false);
    setCreatedCredentials(null);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <User className="h-5 w-5" />
            Credenciales de Acceso
          </DialogTitle>
          <DialogDescription>
            {employee?.first_name} {employee?.last_name}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Estado actual */}
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">Estado:</span>
            {hasUser ? (
              <Badge className="bg-green-500/10 text-green-700 border-green-200">
                <CheckCircle2 className="h-3 w-3 mr-1" />
                Usuario vinculado
              </Badge>
            ) : (
              <Badge variant="secondary">
                <AlertTriangle className="h-3 w-3 mr-1" />
                Sin usuario
              </Badge>
            )}
          </div>

          {/* Email */}
          <div className="space-y-2">
            <Label htmlFor={emailId} className="flex items-center gap-2">
              <Mail className="h-4 w-4" />
              Email del empleado
            </Label>
            <Input id={emailId} value={employee?.email || ''} disabled />
            {!employee?.email && (
              <p className="text-sm text-destructive">
                El empleado debe tener email configurado para crear usuario
              </p>
            )}
          </div>

          {/* Password */}
          <div className="space-y-2">
            <Label htmlFor={passwordId} className="flex items-center gap-2">
              <KeyRound className="h-4 w-4" />
              Contraseña
            </Label>
            <Input
              id={passwordId}
              type="text"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder={suggestedPassword}
            />
            <p className="text-xs text-muted-foreground">
              Sugerida: {suggestedPassword}
            </p>
          </div>

          {/* Credenciales generadas */}
          {showCredentials && createdCredentials && (
            <Alert>
              <CheckCircle2 className="h-4 w-4" />
              <AlertDescription className="space-y-2">
                <div className="font-medium">Credenciales generadas:</div>
                <div className="bg-muted p-3 rounded text-sm font-mono">
                  <div>Email: {createdCredentials.email}</div>
                  <div>Contraseña: {createdCredentials.password}</div>
                </div>
                <Button variant="outline" size="sm" onClick={copyCredentials}>
                  <Copy className="h-3 w-3 mr-1" />
                  Copiar credenciales
                </Button>
              </AlertDescription>
            </Alert>
          )}

          <Alert>
            <AlertDescription className="text-sm">
              El empleado podrá cambiar su contraseña desde su portal. 
              En caso de olvido, puede usar la recuperación de contraseña estándar.
            </AlertDescription>
          </Alert>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose}>
            Cerrar
          </Button>
          {hasUser ? (
            <Button
              onClick={handleResetPassword}
              disabled={resetPasswordMutation.isPending}
            >
              <RefreshCw className="h-4 w-4 mr-2" />
              {resetPasswordMutation.isPending ? 'Reseteando...' : 'Resetear contraseña'}
            </Button>
          ) : (
            <Button
              onClick={handleCreateUser}
              disabled={!employee?.email || createUserMutation.isPending}
            >
              <User className="h-4 w-4 mr-2" />
              {createUserMutation.isPending ? 'Creando...' : 'Crear usuario'}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
