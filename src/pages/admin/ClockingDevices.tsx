import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { AppLayout } from '@/components/layout/AppLayout';
import { useCompany } from '@/hooks/useCompany';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
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
import { Plus, Monitor, Trash2, Copy, RefreshCw, Smartphone, Wifi, WifiOff } from 'lucide-react';
import { format, addMinutes, formatDistanceToNow } from 'date-fns';
import { es } from 'date-fns/locale';
import type { Terminal, TerminalStatus } from '@/types/database';

const statusLabels: Record<TerminalStatus, string> = {
  pending: 'Pendiente',
  active: 'Activo',
  inactive: 'Inactivo',
};

const statusColors: Record<TerminalStatus, string> = {
  pending: 'bg-yellow-500/10 text-yellow-700 border-yellow-200',
  active: 'bg-green-500/10 text-green-700 border-green-200',
  inactive: 'bg-gray-500/10 text-gray-700 border-gray-200',
};

function generatePairingCode(): string {
  return Math.random().toString(36).substring(2, 8).toUpperCase();
}

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

export default function ClockingDevices() {
  const [isOpen, setIsOpen] = useState(false);
  const [pairingCode, setPairingCode] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState('terminals');
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { companyId } = useCompany();

  // Terminals query
  const { data: terminals, isLoading: terminalsLoading } = useQuery({
    queryKey: ['terminals'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('terminals')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data as Terminal[];
    },
  });

  // Sessions query
  const { data: sessions, isLoading: sessionsLoading, refetch: refetchSessions } = useQuery({
    queryKey: ['kiosk-sessions'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('kiosk_sessions')
        .select(`*, terminals (name, location)`)
        .order('last_seen_at', { ascending: false });
      if (error) throw error;
      return data as KioskSession[];
    },
    refetchInterval: 30000,
  });

  const createMutation = useMutation({
    mutationFn: async (data: { name: string; location: string }) => {
      if (!companyId) throw new Error('No hay empresa configurada');
      const code = generatePairingCode();
      const { error, data: terminal } = await supabase
        .from('terminals')
        .insert({
          ...data,
          company_id: companyId,
          pairing_code: code,
          pairing_expires_at: addMinutes(new Date(), 30).toISOString(),
          status: 'pending' as TerminalStatus,
        })
        .select()
        .single();
      if (error) throw error;
      return { terminal, code };
    },
    onSuccess: ({ code }) => {
      queryClient.invalidateQueries({ queryKey: ['terminals'] });
      setPairingCode(code);
      toast({ title: 'Terminal creado correctamente' });
    },
    onError: (error) => {
      toast({ variant: 'destructive', title: 'Error', description: error.message });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('terminals').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['terminals'] });
      toast({ title: 'Terminal eliminado' });
    },
    onError: (error) => {
      toast({ variant: 'destructive', title: 'Error', description: error.message });
    },
  });

  const regenerateCodeMutation = useMutation({
    mutationFn: async (id: string) => {
      const code = generatePairingCode();
      const { error } = await supabase
        .from('terminals')
        .update({
          pairing_code: code,
          pairing_expires_at: addMinutes(new Date(), 30).toISOString(),
        })
        .eq('id', id);
      if (error) throw error;
      return code;
    },
    onSuccess: (code) => {
      queryClient.invalidateQueries({ queryKey: ['terminals'] });
      navigator.clipboard.writeText(code);
      toast({ title: 'Nuevo código generado y copiado' });
    },
    onError: (error) => {
      toast({ variant: 'destructive', title: 'Error', description: error.message });
    },
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
      toast({ title: 'Acceso revocado' });
    },
    onError: (error) => {
      toast({ variant: 'destructive', title: 'Error', description: error.message });
    },
  });

  const deleteSessionMutation = useMutation({
    mutationFn: async (sessionId: string) => {
      const { error } = await supabase.from('kiosk_sessions').delete().eq('id', sessionId);
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

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    createMutation.mutate({
      name: formData.get('name') as string,
      location: formData.get('location') as string,
    });
  };

  const copyCode = (code: string) => {
    navigator.clipboard.writeText(code);
    toast({ title: 'Código copiado al portapapeles' });
  };

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
            <h1 className="text-3xl font-bold tracking-tight">Dispositivos de Fichaje</h1>
            <p className="text-muted-foreground">Gestiona terminales y dispositivos kiosco</p>
          </div>
          <Dialog open={isOpen} onOpenChange={(open) => {
            setIsOpen(open);
            if (!open) setPairingCode(null);
          }}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="mr-2 h-4 w-4" />
                Nuevo Terminal
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle>Nuevo Terminal</DialogTitle>
                <DialogDescription>
                  Registra un nuevo dispositivo de fichaje. Se generará un código de activación válido por 30 minutos.
                </DialogDescription>
              </DialogHeader>
              {pairingCode ? (
                <div className="space-y-4">
                  <div className="rounded-lg bg-muted p-6 text-center">
                    <p className="text-sm text-muted-foreground mb-2">Código de activación</p>
                    <p className="text-4xl font-mono font-bold tracking-widest">{pairingCode}</p>
                    <p className="text-sm text-muted-foreground mt-2">Válido por 30 minutos</p>
                  </div>
                  <Button variant="outline" className="w-full" onClick={() => copyCode(pairingCode)}>
                    <Copy className="mr-2 h-4 w-4" />
                    Copiar código
                  </Button>
                  <Button className="w-full" onClick={() => setIsOpen(false)}>
                    Cerrar
                  </Button>
                </div>
              ) : (
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="name">Nombre *</Label>
                    <Input id="name" name="name" placeholder="Terminal Recepción" required />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="location">Ubicación</Label>
                    <Input id="location" name="location" placeholder="Planta baja, entrada principal" />
                  </div>
                  <Button type="submit" className="w-full">
                    Crear y obtener código
                  </Button>
                </form>
              )}
            </DialogContent>
          </Dialog>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList>
            <TabsTrigger value="terminals" className="flex items-center gap-2">
              <Monitor className="h-4 w-4" />
              Terminales
            </TabsTrigger>
            <TabsTrigger value="sessions" className="flex items-center gap-2">
              <Smartphone className="h-4 w-4" />
              Sesiones Activas ({activeSessions.length})
            </TabsTrigger>
          </TabsList>

          <TabsContent value="terminals" className="mt-6">
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nombre</TableHead>
                    <TableHead>Ubicación</TableHead>
                    <TableHead>Estado</TableHead>
                    <TableHead>Última actividad</TableHead>
                    <TableHead>Código activación</TableHead>
                    <TableHead className="text-right">Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {terminalsLoading ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center py-8">Cargando...</TableCell>
                    </TableRow>
                  ) : terminals?.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                        No hay terminales registrados
                      </TableCell>
                    </TableRow>
                  ) : (
                    terminals?.map((terminal) => (
                      <TableRow key={terminal.id}>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Monitor className="h-4 w-4 text-muted-foreground" />
                            {terminal.name}
                          </div>
                        </TableCell>
                        <TableCell>{terminal.location || '-'}</TableCell>
                        <TableCell>
                          <Badge variant="outline" className={statusColors[terminal.status]}>
                            {statusLabels[terminal.status]}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {terminal.last_seen_at
                            ? format(new Date(terminal.last_seen_at), 'dd/MM/yyyy HH:mm')
                            : '-'}
                        </TableCell>
                        <TableCell>
                          {terminal.pairing_code && terminal.status === 'pending' ? (
                            <div className="flex items-center gap-2">
                              <span className="font-mono">{terminal.pairing_code}</span>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-6 w-6"
                                aria-label="Copiar código"
                                onClick={() => copyCode(terminal.pairing_code!)}
                              >
                                <Copy className="h-3 w-3" />
                              </Button>
                            </div>
                          ) : (
                            '-'
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-2">
                            {terminal.status === 'pending' && (
                              <Button
                                variant="ghost"
                                size="icon"
                                title="Regenerar código"
                                aria-label="Regenerar código"
                                onClick={() => regenerateCodeMutation.mutate(terminal.id)}
                              >
                                <RefreshCw className="h-4 w-4" />
                              </Button>
                            )}
                            <Button
                              variant="ghost"
                              size="icon"
                              aria-label={`Eliminar terminal ${terminal.name}`}
                              onClick={() => {
                                if (confirm('¿Eliminar este terminal?')) {
                                  deleteMutation.mutate(terminal.id);
                                }
                              }}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </TabsContent>

          <TabsContent value="sessions" className="mt-6 space-y-6">
            <div className="flex justify-end">
              <Button variant="outline" onClick={() => refetchSessions()}>
                <RefreshCw className="mr-2 h-4 w-4" />
                Actualizar
              </Button>
            </div>

            {/* Active Sessions */}
            <div className="space-y-4">
              <h2 className="text-lg font-semibold flex items-center gap-2">
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
                    {sessionsLoading ? (
                      <TableRow>
                        <TableCell colSpan={6} className="text-center py-8">Cargando...</TableCell>
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
                                    El dispositivo ya no podrá acceder al kiosco.
                                  </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                  <AlertDialogAction
                                    onClick={() => revokeMutation.mutate(session.id)}
                                    className="bg-destructive text-destructive-foreground"
                                  >
                                    Revocar
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

            {/* Inactive Sessions */}
            {inactiveSessions.length > 0 && (
              <div className="space-y-4">
                <h2 className="text-lg font-semibold flex items-center gap-2 text-muted-foreground">
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
                        <TableHead className="text-right">Acciones</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {inactiveSessions.map((session) => (
                        <TableRow key={session.id} className="opacity-60">
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <Smartphone className="h-4 w-4 text-muted-foreground" />
                              <span>{session.device_name || 'Sin nombre'}</span>
                            </div>
                          </TableCell>
                          <TableCell>{session.terminals?.name || '-'}</TableCell>
                          <TableCell>
                            {session.last_seen_at
                              ? format(new Date(session.last_seen_at), 'dd/MM/yyyy HH:mm')
                              : '-'}
                          </TableCell>
                          <TableCell className="text-right">
                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  aria-label={`Eliminar sesión ${session.device_name || 'sin nombre'}`}
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </AlertDialogTrigger>
                              <AlertDialogContent>
                                <AlertDialogHeader>
                                  <AlertDialogTitle>¿Eliminar sesión?</AlertDialogTitle>
                                  <AlertDialogDescription>
                                    Esta acción eliminará el registro de forma permanente.
                                  </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                  <AlertDialogAction onClick={() => deleteSessionMutation.mutate(session.id)}>
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
          </TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  );
}
