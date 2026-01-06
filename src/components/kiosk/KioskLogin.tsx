import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Building2, Loader2, Lock, Mail, Monitor } from 'lucide-react';

interface KioskLoginProps {
  onLogin: (email: string, password: string, deviceName?: string) => Promise<boolean>;
  isLoading?: boolean;
  error?: string | null;
}

export function KioskLogin({ onLogin, isLoading, error }: KioskLoginProps) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [deviceName, setDeviceName] = useState('');
  const [localError, setLocalError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLocalError(null);

    if (!email.trim() || !password.trim()) {
      setLocalError('Email y contraseña son requeridos');
      return;
    }

    setSubmitting(true);
    const success = await onLogin(email.trim(), password, deviceName.trim() || undefined);
    setSubmitting(false);

    if (!success && !error) {
      setLocalError('Error al iniciar sesión');
    }
  };

  const displayError = error || localError;
  const loading = isLoading || submitting;

  return (
    <div className="min-h-screen bg-gradient-to-br from-background to-muted flex flex-col items-center justify-center p-4">
      <div className="text-center mb-8">
        <div className="flex items-center justify-center gap-3 mb-4">
          <Monitor className="h-10 w-10 text-primary" />
          <h1 className="text-3xl font-bold">Activar Kiosco</h1>
        </div>
        <p className="text-muted-foreground">
          Introduce las credenciales de administrador para activar este dispositivo
        </p>
      </div>

      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Building2 className="h-5 w-5" />
            Credenciales de Empresa
          </CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email del administrador</Label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="email"
                  type="email"
                  placeholder="admin@empresa.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="pl-10"
                  disabled={loading}
                  autoComplete="email"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">Contraseña</Label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="password"
                  type="password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="pl-10"
                  disabled={loading}
                  autoComplete="current-password"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="deviceName">Nombre del dispositivo (opcional)</Label>
              <Input
                id="deviceName"
                type="text"
                placeholder="Ej: Kiosco Entrada Principal"
                value={deviceName}
                onChange={(e) => setDeviceName(e.target.value)}
                disabled={loading}
              />
              <p className="text-xs text-muted-foreground">
                Un nombre descriptivo para identificar este kiosco
              </p>
            </div>

            {displayError && (
              <div className="p-3 rounded-md bg-destructive/10 text-destructive text-sm">
                {displayError}
              </div>
            )}

            <Button type="submit" className="w-full" size="lg" disabled={loading}>
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Verificando...
                </>
              ) : (
                'Activar Kiosco'
              )}
            </Button>
          </form>
        </CardContent>
      </Card>

      <div className="mt-8 text-center text-xs text-muted-foreground max-w-md">
        <p>
          Una vez activado, este dispositivo quedará vinculado a la empresa 
          y podrá usarse para fichajes sin necesidad de volver a iniciar sesión.
        </p>
      </div>
    </div>
  );
}
