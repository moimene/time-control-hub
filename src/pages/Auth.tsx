import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useKioskSession } from '@/hooks/useKioskSession';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { PasswordInput } from '@/components/ui/password-input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import { Clock, Building2, Users, Monitor, Mail, ArrowLeft } from 'lucide-react';
import { z } from 'zod';
import { Alert, AlertDescription } from '@/components/ui/alert';

const authSchema = z.object({
  email: z.string().email('Email inválido'),
  password: z.string().min(6, 'La contraseña debe tener al menos 6 caracteres'),
});

export default function Auth() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [kioskDeviceName, setKioskDeviceName] = useState('');
  const [kioskLoading, setKioskLoading] = useState(false);
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [forgotEmail, setForgotEmail] = useState('');
  const [forgotLoading, setForgotLoading] = useState(false);
  const { signIn, signUp, user, loading: authLoading } = useAuth();
  const { login: kioskLogin } = useKioskSession();
  const navigate = useNavigate();
  const { toast } = useToast();

  // Show loading while checking authentication
  if (authLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  // Redirect if already logged in (only after loading is complete)
  if (user) {
    navigate('/');
    return null;
  }

  const handleSubmit = async (action: 'login' | 'register') => {
    try {
      const validation = authSchema.safeParse({ email, password });
      if (!validation.success) {
        toast({
          variant: 'destructive',
          title: 'Error de validación',
          description: validation.error.errors[0].message,
        });
        return;
      }

      setLoading(true);

      if (action === 'login') {
        const { error } = await signIn(email, password);
        if (error) {
          let message = 'Error al iniciar sesión';
          if (error.message.includes('Invalid login credentials')) {
            message = 'Credenciales inválidas';
          }
          toast({
            variant: 'destructive',
            title: 'Error',
            description: message,
          });
          return;
        }
        toast({
          title: 'Bienvenido',
          description: 'Has iniciado sesión correctamente',
        });
        navigate('/');
      } else {
        const { error } = await signUp(email, password);
        if (error) {
          let message = 'Error al registrarse';
          if (error.message.includes('already registered')) {
            message = 'Este email ya está registrado';
          }
          toast({
            variant: 'destructive',
            title: 'Error',
            description: message,
          });
          return;
        }
        toast({
          title: 'Registro exitoso',
          description: 'Tu cuenta ha sido creada. Ya puedes iniciar sesión.',
        });
      }
    } finally {
      setLoading(false);
    }
  };

  const handleKioskActivation = async () => {
    if (!email || !password) {
      toast({
        variant: 'destructive',
        title: 'Campos requeridos',
        description: 'Email y contraseña son obligatorios',
      });
      return;
    }

    setKioskLoading(true);
    try {
      const success = await kioskLogin(email, password, kioskDeviceName || undefined);
      if (success) {
        toast({
          title: 'Terminal activado',
          description: 'Redirigiendo al kiosco...',
        });
        navigate('/kiosk');
      } else {
        toast({
          variant: 'destructive',
          title: 'Error de activación',
          description: 'Credenciales inválidas o sin permisos de administrador',
        });
      }
    } finally {
      setKioskLoading(false);
    }
  };

  const handleForgotPassword = async () => {
    if (!forgotEmail) {
      toast({
        variant: 'destructive',
        title: 'Email requerido',
        description: 'Introduce tu email para recuperar la contraseña',
      });
      return;
    }

    setForgotLoading(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(forgotEmail, {
        redirectTo: `${window.location.origin}/reset-password`,
      });

      if (error) throw error;

      toast({
        title: 'Email enviado',
        description: 'Revisa tu bandeja de entrada para restablecer tu contraseña',
      });
      setShowForgotPassword(false);
      setForgotEmail('');
    } catch (err: any) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: err.message || 'No se pudo enviar el email de recuperación',
      });
    } finally {
      setForgotLoading(false);
    }
  };

  // Forgot password view
  if (showForgotPassword) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-primary">
              <Mail className="h-6 w-6 text-primary-foreground" />
            </div>
            <CardTitle className="text-2xl">Recuperar Contraseña</CardTitle>
            <CardDescription>
              Introduce tu email y te enviaremos un enlace para restablecer tu contraseña
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="forgot-email">Email</Label>
              <Input
                id="forgot-email"
                type="email"
                placeholder="tu@email.com"
                value={forgotEmail}
                onChange={(e) => setForgotEmail(e.target.value)}
                disabled={forgotLoading}
                onKeyDown={(e) => e.key === 'Enter' && handleForgotPassword()}
              />
            </div>
            <Button
              className="w-full"
              onClick={handleForgotPassword}
              disabled={forgotLoading}
            >
              {forgotLoading ? 'Enviando...' : 'Enviar enlace de recuperación'}
            </Button>
            <Button
              variant="ghost"
              className="w-full"
              onClick={() => setShowForgotPassword(false)}
            >
              <ArrowLeft className="mr-2 h-4 w-4" />
              Volver al inicio de sesión
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-primary">
            <Clock className="h-6 w-6 text-primary-foreground" />
          </div>
          <CardTitle className="text-2xl">Control Horario</CardTitle>
          <CardDescription>
            Sistema de gestión de fichajes
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="login" className="w-full">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="login">Iniciar sesión</TabsTrigger>
              <TabsTrigger value="register">Registrar empresa</TabsTrigger>
              <TabsTrigger value="terminal" className="flex items-center gap-1">
                <Monitor className="h-3 w-3" />
                Terminal
              </TabsTrigger>
            </TabsList>
            
            <TabsContent value="login" className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="login-email">Email</Label>
                <Input
                  id="login-email"
                  type="email"
                  placeholder="tu@email.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  disabled={loading}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="login-password">Contraseña</Label>
                <PasswordInput
                  id="login-password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  disabled={loading}
                  onKeyDown={(e) => e.key === 'Enter' && handleSubmit('login')}
                />
              </div>
              <Button
                className="w-full"
                onClick={() => handleSubmit('login')}
                disabled={loading}
              >
                {loading ? 'Cargando...' : 'Iniciar sesión'}
              </Button>
              <Button
                variant="link"
                className="w-full text-sm"
                onClick={() => setShowForgotPassword(true)}
              >
                ¿Olvidaste tu contraseña?
              </Button>
            </TabsContent>

            <TabsContent value="register" className="space-y-4">
              <Alert className="border-primary/30 bg-primary/5">
                <Building2 className="h-4 w-4" />
                <AlertDescription className="text-sm">
                  <strong>Registro para empresas y autónomos.</strong>
                  <br />
                  <span className="text-muted-foreground">
                    Como administrador, registras tu empresa y después das acceso a empleados y asesores.
                  </span>
                </AlertDescription>
              </Alert>
              <div className="space-y-2">
                <Label htmlFor="register-email">Email del administrador</Label>
                <Input
                  id="register-email"
                  type="email"
                  placeholder="admin@miempresa.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  disabled={loading}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="register-password">Contraseña</Label>
                <PasswordInput
                  id="register-password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  disabled={loading}
                  onKeyDown={(e) => e.key === 'Enter' && handleSubmit('register')}
                />
              </div>
              <Button
                className="w-full"
                onClick={() => handleSubmit('register')}
                disabled={loading}
              >
                {loading ? 'Creando cuenta...' : 'Registrar empresa'}
              </Button>
              <div className="flex items-center gap-2 text-xs text-muted-foreground justify-center">
                <Users className="h-3 w-3" />
                <span>Los empleados recibirán invitación después</span>
              </div>
            </TabsContent>

            <TabsContent value="terminal" className="space-y-4">
              <Alert className="border-primary/30 bg-primary/5">
                <Monitor className="h-4 w-4" />
                <AlertDescription className="text-sm">
                  <strong>Activar dispositivo de fichaje.</strong>
                  <br />
                  <span className="text-muted-foreground">
                    Usa credenciales de administrador para activar este terminal.
                  </span>
                </AlertDescription>
              </Alert>
              <div className="space-y-2">
                <Label htmlFor="terminal-email">Email del administrador</Label>
                <Input
                  id="terminal-email"
                  type="email"
                  placeholder="admin@miempresa.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  disabled={kioskLoading}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="terminal-password">Contraseña</Label>
                <PasswordInput
                  id="terminal-password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  disabled={kioskLoading}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="device-name">Nombre del dispositivo (opcional)</Label>
                <Input
                  id="device-name"
                  type="text"
                  placeholder="Ej: Kiosco Entrada Principal"
                  value={kioskDeviceName}
                  onChange={(e) => setKioskDeviceName(e.target.value)}
                  disabled={kioskLoading}
                />
              </div>
              <Button
                className="w-full"
                onClick={handleKioskActivation}
                disabled={kioskLoading}
              >
                {kioskLoading ? 'Activando...' : 'Activar Terminal'}
              </Button>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}
