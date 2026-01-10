import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { AppLayout } from '@/components/layout/AppLayout';
import { useCompany } from '@/hooks/useCompany';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
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
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { Plus, Monitor, Trash2, Copy, RefreshCw } from 'lucide-react';
import { format, addMinutes } from 'date-fns';
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

export default function Terminals() {
  const [isOpen, setIsOpen] = useState(false);
  const [pairingCode, setPairingCode] = useState<string | null>(null);
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { companyId } = useCompany();

  const { data: terminals, isLoading } = useQuery({
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

  return (
    <AppLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Terminales</h1>
            <p className="text-muted-foreground">Gestiona los kioscos de fichaje</p>
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
                  Registra un nuevo kiosco de fichaje
                </DialogDescription>
              </DialogHeader>
              {pairingCode ? (
                <div className="space-y-4">
                  <div className="rounded-lg bg-muted p-6 text-center">
                    <p className="text-sm text-muted-foreground mb-2">Código de emparejamiento</p>
                    <p className="text-4xl font-mono font-bold tracking-widest">{pairingCode}</p>
                    <p className="text-sm text-muted-foreground mt-2">Válido por 30 minutos</p>
                  </div>
                  <Button
                    variant="outline"
                    className="w-full"
                    onClick={() => copyCode(pairingCode)}
                  >
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

        {/* Table */}
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nombre</TableHead>
                <TableHead>Ubicación</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead>Última actividad</TableHead>
                <TableHead>Código</TableHead>
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
                            aria-label="Copiar código de emparejamiento"
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
                          aria-label="Eliminar terminal"
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
      </div>
    </AppLayout>
  );
}
