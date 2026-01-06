import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useCompany } from '@/hooks/useCompany';
import { AppLayout } from '@/components/layout/AppLayout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { AlertTriangle, Clock, X, CheckCircle } from 'lucide-react';
import { format, parseISO, differenceInHours } from 'date-fns';
import { es } from 'date-fns/locale';
import { toast } from 'sonner';

interface OrphanEntry {
  id: string;
  employee_id: string;
  timestamp: string;
  local_timestamp: string;
  employee_name: string;
  employee_code: string;
  department: string | null;
  hours_ago: number;
}

export default function OrphanClockIns() {
  const { company } = useCompany();
  const queryClient = useQueryClient();
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [showCloseDialog, setShowCloseDialog] = useState(false);
  const [closeReason, setCloseReason] = useState('Cierre administrativo por fichaje huérfano');

  // Fetch orphan entries (entries without a subsequent exit)
  const { data: orphanEntries = [], isLoading } = useQuery({
    queryKey: ['orphan-entries', company?.id],
    queryFn: async () => {
      if (!company?.id) return [];

      // Get all entries that don't have a matching exit after them
      const { data: entries, error } = await supabase
        .from('time_events')
        .select(`
          id,
          employee_id,
          timestamp,
          local_timestamp,
          event_type,
          employees!inner(
            first_name,
            last_name,
            employee_code,
            department
          )
        `)
        .eq('company_id', company.id)
        .eq('event_type', 'entry')
        .order('timestamp', { ascending: false });

      if (error) throw error;

      // For each entry, check if there's a subsequent exit
      const orphans: OrphanEntry[] = [];
      const now = new Date();

      for (const entry of entries || []) {
        // Check if there's an exit after this entry for the same employee
        const { data: exitAfter } = await supabase
          .from('time_events')
          .select('id')
          .eq('employee_id', entry.employee_id)
          .eq('event_type', 'exit')
          .gt('timestamp', entry.timestamp)
          .limit(1);

        if (!exitAfter || exitAfter.length === 0) {
          const entryDate = parseISO(entry.timestamp);
          const hoursAgo = differenceInHours(now, entryDate);
          
          // Only show entries older than 12 hours as orphans
          if (hoursAgo >= 12) {
            const emp = entry.employees as any;
            orphans.push({
              id: entry.id,
              employee_id: entry.employee_id,
              timestamp: entry.timestamp,
              local_timestamp: entry.local_timestamp,
              employee_name: `${emp.first_name} ${emp.last_name}`,
              employee_code: emp.employee_code,
              department: emp.department,
              hours_ago: hoursAgo,
            });
          }
        }
      }

      return orphans;
    },
    enabled: !!company?.id,
    refetchInterval: 60000, // Refresh every minute
  });

  // Mutation to close orphan entries
  const closeMutation = useMutation({
    mutationFn: async (entryIds: string[]) => {
      const entriesToClose = orphanEntries.filter(e => entryIds.includes(e.id));
      
      for (const entry of entriesToClose) {
        // Create an exit event 8 hours after the entry (standard work day)
        const entryTime = parseISO(entry.timestamp);
        const exitTime = new Date(entryTime.getTime() + 8 * 60 * 60 * 1000);
        
        // Get the previous hash
        const { data: lastEvent } = await supabase
          .from('time_events')
          .select('event_hash')
          .eq('employee_id', entry.employee_id)
          .order('timestamp', { ascending: false })
          .limit(1);

        const previousHash = lastEvent?.[0]?.event_hash || null;

        // Create correction request
        const { data: correction, error: correctionError } = await supabase
          .from('correction_requests')
          .insert({
            employee_id: entry.employee_id,
            company_id: company?.id,
            original_event_id: entry.id,
            requested_event_type: 'exit',
            requested_timestamp: exitTime.toISOString(),
            reason: closeReason,
            status: 'approved',
            reviewed_at: new Date().toISOString(),
            review_notes: 'Cierre automático por fichaje huérfano',
          })
          .select()
          .single();

        if (correctionError) throw correctionError;

        // Create the corrected event
        const { error: eventError } = await supabase
          .from('corrected_events')
          .insert({
            correction_request_id: correction.id,
            employee_id: entry.employee_id,
            company_id: company?.id,
            event_type: 'exit',
            timestamp: exitTime.toISOString(),
            local_timestamp: exitTime.toISOString(),
            timezone: 'Europe/Madrid',
          });

        if (eventError) throw eventError;
      }

      return entryIds.length;
    },
    onSuccess: (count) => {
      toast.success(`${count} fichaje(s) huérfano(s) cerrado(s) correctamente`);
      setSelectedIds(new Set());
      setShowCloseDialog(false);
      setCloseReason('Cierre administrativo por fichaje huérfano');
      queryClient.invalidateQueries({ queryKey: ['orphan-entries'] });
    },
    onError: (error) => {
      console.error('Error closing orphan entries:', error);
      toast.error('Error al cerrar los fichajes huérfanos');
    },
  });

  const toggleSelection = (id: string) => {
    const newSet = new Set(selectedIds);
    if (newSet.has(id)) {
      newSet.delete(id);
    } else {
      newSet.add(id);
    }
    setSelectedIds(newSet);
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === orphanEntries.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(orphanEntries.map(e => e.id)));
    }
  };

  const handleBulkClose = () => {
    if (selectedIds.size === 0) {
      toast.error('Selecciona al menos un fichaje para cerrar');
      return;
    }
    setShowCloseDialog(true);
  };

  const confirmClose = () => {
    closeMutation.mutate(Array.from(selectedIds));
  };

  return (
    <AppLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Fichajes Huérfanos</h1>
            <p className="text-muted-foreground">
              Entradas sin salida correspondiente (más de 12 horas)
            </p>
          </div>
          {selectedIds.size > 0 && (
            <Button onClick={handleBulkClose} variant="destructive">
              <X className="mr-2 h-4 w-4" />
              Cerrar {selectedIds.size} fichaje(s)
            </Button>
          )}
        </div>

        {orphanEntries.length === 0 && !isLoading ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12">
              <CheckCircle className="h-12 w-12 text-green-500 mb-4" />
              <h3 className="text-lg font-semibold">Sin fichajes huérfanos</h3>
              <p className="text-muted-foreground text-center mt-2">
                No hay entradas pendientes de cierre. Todos los empleados han fichado correctamente.
              </p>
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-amber-500" />
                {orphanEntries.length} fichaje(s) pendiente(s) de cierre
              </CardTitle>
              <CardDescription>
                Estas entradas no tienen una salida registrada. Selecciona las que deseas cerrar.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-12">
                      <Checkbox
                        checked={selectedIds.size === orphanEntries.length && orphanEntries.length > 0}
                        onCheckedChange={toggleSelectAll}
                      />
                    </TableHead>
                    <TableHead>Empleado</TableHead>
                    <TableHead>Código</TableHead>
                    <TableHead>Departamento</TableHead>
                    <TableHead>Fecha/Hora Entrada</TableHead>
                    <TableHead>Tiempo Abierto</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isLoading ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center py-8">
                        <div className="flex items-center justify-center gap-2">
                          <Clock className="h-5 w-5 animate-spin" />
                          Cargando...
                        </div>
                      </TableCell>
                    </TableRow>
                  ) : (
                    orphanEntries.map((entry) => (
                      <TableRow key={entry.id}>
                        <TableCell>
                          <Checkbox
                            checked={selectedIds.has(entry.id)}
                            onCheckedChange={() => toggleSelection(entry.id)}
                          />
                        </TableCell>
                        <TableCell className="font-medium">{entry.employee_name}</TableCell>
                        <TableCell>
                          <Badge variant="outline">{entry.employee_code}</Badge>
                        </TableCell>
                        <TableCell>{entry.department || '-'}</TableCell>
                        <TableCell>
                          {format(parseISO(entry.local_timestamp), "EEEE d 'de' MMMM, HH:mm", { locale: es })}
                        </TableCell>
                        <TableCell>
                          <Badge variant={entry.hours_ago > 24 ? 'destructive' : 'secondary'}>
                            {entry.hours_ago}h abierto
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        )}

        {/* Close confirmation dialog */}
        <Dialog open={showCloseDialog} onOpenChange={setShowCloseDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Cerrar fichajes huérfanos</DialogTitle>
              <DialogDescription>
                Se creará una corrección aprobada con una salida 8 horas después de cada entrada.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="reason">Motivo del cierre</Label>
                <Textarea
                  id="reason"
                  value={closeReason}
                  onChange={(e) => setCloseReason(e.target.value)}
                  placeholder="Escribe el motivo del cierre..."
                  rows={3}
                />
              </div>
              <div className="rounded-lg bg-muted p-3 text-sm">
                <p className="font-medium">Se cerrarán {selectedIds.size} fichaje(s):</p>
                <ul className="mt-2 space-y-1 text-muted-foreground">
                  {Array.from(selectedIds).slice(0, 5).map(id => {
                    const entry = orphanEntries.find(e => e.id === id);
                    return entry ? (
                      <li key={id}>• {entry.employee_name} - {format(parseISO(entry.local_timestamp), 'dd/MM/yyyy HH:mm')}</li>
                    ) : null;
                  })}
                  {selectedIds.size > 5 && (
                    <li>... y {selectedIds.size - 5} más</li>
                  )}
                </ul>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowCloseDialog(false)}>
                Cancelar
              </Button>
              <Button 
                onClick={confirmClose} 
                disabled={closeMutation.isPending}
              >
                {closeMutation.isPending ? 'Cerrando...' : 'Confirmar cierre'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </AppLayout>
  );
}
