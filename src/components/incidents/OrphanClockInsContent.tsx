import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useCompany } from '@/hooks/useCompany';
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

export function OrphanClockInsContent() {
  const { company } = useCompany();
  const queryClient = useQueryClient();
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [showCloseDialog, setShowCloseDialog] = useState(false);
  const [closeReason, setCloseReason] = useState('Cierre administrativo por fichaje huérfano');

  const { data: orphanEntries = [], isLoading } = useQuery({
    queryKey: ['orphan-entries', company?.id],
    queryFn: async () => {
      if (!company?.id) return [];
      const { data: entries, error } = await supabase
        .from('time_events')
        .select(`id, employee_id, timestamp, local_timestamp, event_type, employees!inner(first_name, last_name, employee_code, department)`)
        .eq('company_id', company.id)
        .eq('event_type', 'entry')
        .order('timestamp', { ascending: false });
      if (error) throw error;

      const orphans: OrphanEntry[] = [];
      const now = new Date();

      for (const entry of entries || []) {
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
  });

  const closeMutation = useMutation({
    mutationFn: async (entryIds: string[]) => {
      const entriesToClose = orphanEntries.filter(e => entryIds.includes(e.id));
      for (const entry of entriesToClose) {
        const entryTime = parseISO(entry.timestamp);
        const exitTime = new Date(entryTime.getTime() + 8 * 60 * 60 * 1000);
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
      toast.success(`${count} fichaje(s) huérfano(s) cerrado(s)`);
      setSelectedIds(new Set());
      setShowCloseDialog(false);
      queryClient.invalidateQueries({ queryKey: ['orphan-entries'] });
    },
    onError: () => toast.error('Error al cerrar los fichajes'),
  });

  const toggleSelection = (id: string) => {
    const newSet = new Set(selectedIds);
    newSet.has(id) ? newSet.delete(id) : newSet.add(id);
    setSelectedIds(newSet);
  };

  const toggleSelectAll = () => {
    setSelectedIds(selectedIds.size === orphanEntries.length ? new Set() : new Set(orphanEntries.map(e => e.id)));
  };

  if (orphanEntries.length === 0 && !isLoading) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-12">
          <CheckCircle className="h-12 w-12 text-green-500 mb-4" />
          <h3 className="text-lg font-semibold">Sin fichajes huérfanos</h3>
          <p className="text-muted-foreground">Todos los empleados han fichado correctamente.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {selectedIds.size > 0 && (
        <div className="flex justify-end">
          <Button onClick={() => setShowCloseDialog(true)} variant="destructive">
            <X className="mr-2 h-4 w-4" />
            Cerrar {selectedIds.size} fichaje(s)
          </Button>
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-amber-500" />
            {orphanEntries.length} fichaje(s) pendiente(s)
          </CardTitle>
          <CardDescription>Entradas sin salida correspondiente (más de 12 horas)</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-12">
                  <Checkbox checked={selectedIds.size === orphanEntries.length && orphanEntries.length > 0} onCheckedChange={toggleSelectAll} />
                </TableHead>
                <TableHead>Empleado</TableHead>
                <TableHead>Código</TableHead>
                <TableHead>Fecha/Hora Entrada</TableHead>
                <TableHead>Tiempo Abierto</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={5} className="text-center py-8"><Clock className="h-5 w-5 animate-spin inline mr-2" />Cargando...</TableCell></TableRow>
              ) : (
                orphanEntries.map((entry) => (
                  <TableRow key={entry.id}>
                    <TableCell><Checkbox checked={selectedIds.has(entry.id)} onCheckedChange={() => toggleSelection(entry.id)} /></TableCell>
                    <TableCell className="font-medium">{entry.employee_name}</TableCell>
                    <TableCell><Badge variant="outline">{entry.employee_code}</Badge></TableCell>
                    <TableCell>{format(parseISO(entry.local_timestamp), "d MMM, HH:mm", { locale: es })}</TableCell>
                    <TableCell><Badge variant={entry.hours_ago > 24 ? 'destructive' : 'secondary'}>{entry.hours_ago}h</Badge></TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={showCloseDialog} onOpenChange={setShowCloseDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Cerrar fichajes huérfanos</DialogTitle>
            <DialogDescription>Se creará una salida 8 horas después de cada entrada.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Motivo</Label>
              <Textarea value={closeReason} onChange={(e) => setCloseReason(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCloseDialog(false)}>Cancelar</Button>
            <Button onClick={() => closeMutation.mutate(Array.from(selectedIds))} disabled={closeMutation.isPending}>
              {closeMutation.isPending ? 'Cerrando...' : 'Confirmar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
