import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { AppLayout } from '@/components/layout/AppLayout';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { Smartphone, Trash2, Wifi, WifiOff, RefreshCw } from 'lucide-react';
import { format, formatDistanceToNow } from 'date-fns';
import { es } from 'date-fns/locale';

interface KioskSession {
  id: string;
  company_id: string;
  terminal_id: string | null;
  device_name: string | null;
  device_token_hash: string;
  is_active: boolean;
  last_seen_at: string | null;
  expires_at: string | null;
  created_at: string;
  terminals?: {
    name: string;
    location: string | null;
  } | null;
}

export default function KioskDevices() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data: sessions, isLoading, refetch } = useQuery({
    queryKey: ['kiosk-sessions'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('kiosk_sessions')
        .select(`
          *,
          terminals (name, location)
        `)
        .order('last_seen_at', { ascending: false });
      if (error) throw error;
      return data as KioskSession[];
    },
    refetchInterval: 30000, // Refresh every 30 seconds
  });

  const revokeMutation = useMutation({
    mutationFn: async (sessionId: string) => {
      const { error } = await supabase
        .from('kiosk_sessions')
        .update({ is_active: false })
        .eq('id', sessionId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['kiosk-sessions'] });
      toast({ title: 'Acceso revocado', description: 'El dispositivo ya no podrá acceder al kiosco' });
    },
    onError: (error) => {
      toast({ variant: 'destructive', title: 'Error', description: error.message });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (sessionId: string) => {
      const { error } = await supabase
        .from('kiosk_sessions')
        .delete()
        .eq('id', sessionId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['kiosk-sessions'] });
      toast({ title: 'Sesión eliminada' });
    },
    onError: (error) => {
      toast({ variant: 'destructive', title: 'Error', description: error.message });
    },
  });

  const isRecentlyActive = (lastSeenAt: string | null): boolean => {
    if (!lastSeenAt) return false;
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
    return new Date(lastSeenAt) > fiveMinutesAgo;
  };

  const activeSessions = sessions?.filter(s => s.is_active) || [];
  const inactiveSessions = sessions?.filter(s => !s.is_active) || [];

  return (
    <AppLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Dispositivos Kiosco</h1>
            <p className="text-muted-foreground">
              Gestiona los dispositivos que tienen acceso al kiosco de fichaje
            </p>
          </div>
          <Button variant="outline" onClick={() => refetch()}>
            <RefreshCw className="mr-2 h-4 w-4" />
            Actualizar
          </Button>
        </div>

        {/* Active Sessions */}
        <div className="space-y-4">
          <h2 className="text-xl font-semibold flex items-center gap-2">
            <Wifi className="h-5 w-5 text-green-500" />
            Dispositivos Activos ({activeSessions.length})
          </h2>
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Dispositivo</TableHead>
                  <TableHead>Terminal</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead>Última actividad</TableHead>
                  <TableHead>Activado</TableHead>
                  <TableHead className="text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-8">
                      Cargando...
                    </TableCell>
                  </TableRow>
                ) : activeSessions.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                      No hay dispositivos activos
                    </TableCell>
                  </TableRow>
                ) : (
                  activeSessions.map((session) => (
                    <TableRow key={session.id}>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Smartphone className="h-4 w-4 text-muted-foreground" />
                          <span className="font-medium">
                            {session.device_name || 'Dispositivo sin nombre'}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell>
                        {session.terminals ? (
                          <div>
                            <div className="font-medium">{session.terminals.name}</div>
                            {session.terminals.location && (
                              <div className="text-sm text-muted-foreground">
                                {session.terminals.location}
                              </div>
                            )}
                          </div>
                        ) : (
                          <span className="text-muted-foreground">Sin asignar</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {isRecentlyActive(session.last_seen_at) ? (
                          <Badge className="bg-green-500/10 text-green-700 border-green-200">
                            <Wifi className="h-3 w-3 mr-1" />
                            En línea
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="text-muted-foreground">
                            <WifiOff className="h-3 w-3 mr-1" />
                            Inactivo
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        {session.last_seen_at ? (
                          <div>
                            <div>
                              {formatDistanceToNow(new Date(session.last_seen_at), {
                                addSuffix: true,
                                locale: es,
                              })}
                            </div>
                            <div className="text-xs text-muted-foreground">
                              {format(new Date(session.last_seen_at), 'dd/MM/yyyy HH:mm')}
                            </div>
                          </div>
                        ) : (
                          '-'
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="text-sm">
                          {format(new Date(session.created_at), 'dd/MM/yyyy HH:mm')}
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button variant="destructive" size="sm">
                              Revocar acceso
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>¿Revocar acceso?</AlertDialogTitle>
                              <AlertDialogDescription>
                                El dispositivo "{session.device_name || 'sin nombre'}" ya no podrá
                                acceder al kiosco. Necesitará volver a autenticarse con credenciales
                                de administrador.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancelar</AlertDialogCancel>
                              <AlertDialogAction
                                onClick={() => revokeMutation.mutate(session.id)}
                                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                              >
                                Revocar acceso
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </div>

        {/* Inactive/Revoked Sessions */}
        {inactiveSessions.length > 0 && (
          <div className="space-y-4">
            <h2 className="text-xl font-semibold flex items-center gap-2 text-muted-foreground">
              <WifiOff className="h-5 w-5" />
              Sesiones Revocadas ({inactiveSessions.length})
            </h2>
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Dispositivo</TableHead>
                    <TableHead>Terminal</TableHead>
                    <TableHead>Última actividad</TableHead>
                    <TableHead>Activado</TableHead>
                    <TableHead className="text-right">Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {inactiveSessions.map((session) => (
                    <TableRow key={session.id} className="opacity-60">
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Smartphone className="h-4 w-4 text-muted-foreground" />
                          <span>{session.device_name || 'Dispositivo sin nombre'}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        {session.terminals?.name || '-'}
                      </TableCell>
                      <TableCell>
                        {session.last_seen_at
                          ? format(new Date(session.last_seen_at), 'dd/MM/yyyy HH:mm')
                          : '-'}
                      </TableCell>
                      <TableCell>
                        {format(new Date(session.created_at), 'dd/MM/yyyy HH:mm')}
                      </TableCell>
                      <TableCell className="text-right">
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button variant="ghost" size="icon" aria-label="Eliminar sesión">
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>¿Eliminar sesión?</AlertDialogTitle>
                              <AlertDialogDescription>
                                Esta acción eliminará el registro de la sesión de forma permanente.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancelar</AlertDialogCancel>
                              <AlertDialogAction
                                onClick={() => deleteMutation.mutate(session.id)}
                              >
                                Eliminar
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </div>
        )}
      </div>
    </AppLayout>
  );
}
