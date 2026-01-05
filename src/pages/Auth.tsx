import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import { Clock } from 'lucide-react';
import { z } from 'zod';

const authSchema = z.object({
  email: z.string().email('Email inválido'),
  password: z.string().min(6, 'La contraseña debe tener al menos 6 caracteres'),
});

export default function Auth() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const { signIn, signUp, user, loading: authLoading } = useAuth();
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
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="login">Iniciar sesión</TabsTrigger>
              <TabsTrigger value="register">Registrarse</TabsTrigger>
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
                <Input
                  id="login-password"
                  type="password"
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
            </TabsContent>

            <TabsContent value="register" className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="register-email">Email</Label>
                <Input
                  id="register-email"
                  type="email"
                  placeholder="tu@email.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  disabled={loading}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="register-password">Contraseña</Label>
                <Input
                  id="register-password"
                  type="password"
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
                {loading ? 'Cargando...' : 'Registrarse'}
              </Button>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}
