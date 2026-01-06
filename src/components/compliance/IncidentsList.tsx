import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useCompany } from '@/hooks/useCompany';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { AlertTriangle, CheckCircle2, Clock, Eye, Filter, MessageSquare, Play, Search, XCircle } from 'lucide-react';
import { Link } from 'react-router-dom';

const STATUS_LABELS: Record<string, string> = {
  open: 'Abierta',
  acknowledged: 'Reconocida',
  in_progress: 'En Progreso',
  resolved: 'Resuelta',
  closed: 'Cerrada'
};

const SEVERITY_LABELS: Record<string, string> = {
  info: 'Info',
  warn: 'Advertencia',
  critical: 'Crítico'
};

const RULE_LABELS: Record<string, string> = {
  MAX_DAILY_HOURS: 'Jornada máxima diaria',
  MIN_DAILY_REST: 'Descanso diario mínimo',
  MIN_WEEKLY_REST: 'Descanso semanal mínimo',
  BREAK_REQUIRED: 'Pausa intrajornada',
  OVERTIME_YTD_75: 'Horas extra 75%',
  OVERTIME_YTD_90: 'Horas extra 90%',
  OVERTIME_YTD_CAP: 'Límite horas extra'
};

interface ViolationWithEmployee {
  id: string;
  rule_code: string;
  severity: 'info' | 'warn' | 'critical';
  status: 'open' | 'acknowledged' | 'resolved' | 'dismissed';
  violation_date: string;
  created_at: string;
  resolved_at: string | null;
  resolution_notes: string | null;
  evidence_json: Record<string, unknown>;
  employees?: {
    id: string;
    first_name: string;
    last_name: string;
    employee_code: string;
  };
}

export function IncidentsList() {
  const { company } = useCompany();
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [severityFilter, setSeverityFilter] = useState<string>('all');
  const [selectedViolation, setSelectedViolation] = useState<ViolationWithEmployee | null>(null);
  const [actionDialogOpen, setActionDialogOpen] = useState(false);
  const [actionType, setActionType] = useState<'acknowledge' | 'resolve' | 'dismiss'>('acknowledge');
  const [resolutionNotes, setResolutionNotes] = useState('');

  // Fetch violations (acting as incidents for now)
  const { data: violations, isLoading } = useQuery({
    queryKey: ['compliance-violations-list', company?.id],
    queryFn: async () => {
      if (!company?.id) return [];
      
      const { data, error } = await supabase
        .from('compliance_violations')
        .select('*, employees(id, first_name, last_name, employee_code)')
        .eq('company_id', company.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data as ViolationWithEmployee[];
    },
    enabled: !!company?.id
  });

  // Update violation status
  const updateMutation = useMutation({
    mutationFn: async ({ id, status, notes }: { id: string; status: string; notes?: string }) => {
      const updateData: Record<string, unknown> = { status };
      
      if (status === 'resolved' || status === 'dismissed') {
        updateData.resolved_at = new Date().toISOString();
        updateData.resolution_notes = notes || null;
      }

      const { error } = await supabase
        .from('compliance_violations')
        .update(updateData)
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['compliance-violations-list'] });
      queryClient.invalidateQueries({ queryKey: ['compliance-violations'] });
      toast.success('Estado actualizado correctamente');
      setActionDialogOpen(false);
      setSelectedViolation(null);
      setResolutionNotes('');
    },
    onError: (error) => {
      console.error('Error updating violation:', error);
      toast.error('Error al actualizar el estado');
    }
  });

  // Filter violations
  const filteredViolations = violations?.filter(v => {
    const matchesSearch = searchTerm === '' || 
      v.employees?.first_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      v.employees?.last_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      v.employees?.employee_code?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      v.rule_code.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesStatus = statusFilter === 'all' || v.status === statusFilter;
    const matchesSeverity = severityFilter === 'all' || v.severity === severityFilter;

    return matchesSearch && matchesStatus && matchesSeverity;
  }) || [];

  const handleAction = (violation: ViolationWithEmployee, action: 'acknowledge' | 'resolve' | 'dismiss') => {
    setSelectedViolation(violation);
    setActionType(action);
    setActionDialogOpen(true);
  };

  const confirmAction = () => {
    if (!selectedViolation) return;

    const statusMap = {
      acknowledge: 'acknowledged',
      resolve: 'resolved',
      dismiss: 'dismissed'
    };

    updateMutation.mutate({
      id: selectedViolation.id,
      status: statusMap[actionType],
      notes: resolutionNotes
    });
  };

  const getStatusBadge = (status: string) => {
    const variants: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
      open: 'destructive',
      acknowledged: 'secondary',
      in_progress: 'default',
      resolved: 'outline',
      dismissed: 'outline'
    };

    const icons: Record<string, React.ReactNode> = {
      open: <AlertTriangle className="mr-1 h-3 w-3" />,
      acknowledged: <Eye className="mr-1 h-3 w-3" />,
      in_progress: <Play className="mr-1 h-3 w-3" />,
      resolved: <CheckCircle2 className="mr-1 h-3 w-3" />,
      dismissed: <XCircle className="mr-1 h-3 w-3" />
    };

    return (
      <Badge variant={variants[status] || 'secondary'}>
        {icons[status]}
        {STATUS_LABELS[status] || status}
      </Badge>
    );
  };

  const getSeverityBadge = (severity: string) => {
    if (severity === 'critical') {
      return <Badge variant="destructive">Crítico</Badge>;
    }
    if (severity === 'warn') {
      return <Badge variant="secondary">Advertencia</Badge>;
    }
    return <Badge variant="outline">Info</Badge>;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Gestión de Incidencias</h1>
          <p className="text-muted-foreground">
            Administra y resuelve las violaciones de cumplimiento
          </p>
        </div>
        <Button variant="outline" asChild>
          <Link to="/admin/compliance">
            Volver al Dashboard
          </Link>
        </Button>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Filter className="h-5 w-5" />
            Filtros
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Buscar por empleado o regla..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9"
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger>
                <SelectValue placeholder="Estado" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos los estados</SelectItem>
                <SelectItem value="open">Abierta</SelectItem>
                <SelectItem value="acknowledged">Reconocida</SelectItem>
                <SelectItem value="resolved">Resuelta</SelectItem>
                <SelectItem value="dismissed">Descartada</SelectItem>
              </SelectContent>
            </Select>
            <Select value={severityFilter} onValueChange={setSeverityFilter}>
              <SelectTrigger>
                <SelectValue placeholder="Severidad" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas las severidades</SelectItem>
                <SelectItem value="critical">Crítico</SelectItem>
                <SelectItem value="warn">Advertencia</SelectItem>
                <SelectItem value="info">Info</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Incidents Table */}
      <Card>
        <CardHeader>
          <CardTitle>Incidencias</CardTitle>
          <CardDescription>
            {filteredViolations.length} incidencias encontradas
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-3">
              {[1, 2, 3, 4, 5].map(i => (
                <Skeleton key={i} className="h-16 w-full" />
              ))}
            </div>
          ) : filteredViolations.length === 0 ? (
            <p className="text-center text-muted-foreground py-12">
              No se encontraron incidencias con los filtros aplicados
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Empleado</TableHead>
                  <TableHead>Regla</TableHead>
                  <TableHead>Severidad</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead>Fecha</TableHead>
                  <TableHead>Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredViolations.map((violation) => (
                  <TableRow key={violation.id}>
                    <TableCell>
                      <div>
                        <p className="font-medium">
                          {violation.employees?.first_name} {violation.employees?.last_name}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {violation.employees?.employee_code}
                        </p>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div>
                        <p className="font-medium">
                          {RULE_LABELS[violation.rule_code] || violation.rule_code}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {violation.rule_code}
                        </p>
                      </div>
                    </TableCell>
                    <TableCell>{getSeverityBadge(violation.severity)}</TableCell>
                    <TableCell>{getStatusBadge(violation.status)}</TableCell>
                    <TableCell>
                      {format(new Date(violation.violation_date), 'dd MMM yyyy', { locale: es })}
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        {violation.status === 'open' && (
                          <>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleAction(violation, 'acknowledge')}
                            >
                              <Eye className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleAction(violation, 'resolve')}
                            >
                              <CheckCircle2 className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleAction(violation, 'dismiss')}
                            >
                              <XCircle className="h-4 w-4" />
                            </Button>
                          </>
                        )}
                        {violation.status === 'acknowledged' && (
                          <>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleAction(violation, 'resolve')}
                            >
                              <CheckCircle2 className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleAction(violation, 'dismiss')}
                            >
                              <XCircle className="h-4 w-4" />
                            </Button>
                          </>
                        )}
                        {(violation.status === 'resolved' || violation.status === 'dismissed') && violation.resolution_notes && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              setSelectedViolation(violation);
                              setActionDialogOpen(true);
                              setActionType('resolve');
                            }}
                          >
                            <MessageSquare className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Action Dialog */}
      <Dialog open={actionDialogOpen} onOpenChange={setActionDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {actionType === 'acknowledge' && 'Reconocer Incidencia'}
              {actionType === 'resolve' && 'Resolver Incidencia'}
              {actionType === 'dismiss' && 'Descartar Incidencia'}
            </DialogTitle>
            <DialogDescription>
              {selectedViolation && (
                <div className="mt-2 space-y-2">
                  <p>
                    <strong>Empleado:</strong> {selectedViolation.employees?.first_name} {selectedViolation.employees?.last_name}
                  </p>
                  <p>
                    <strong>Regla:</strong> {RULE_LABELS[selectedViolation.rule_code] || selectedViolation.rule_code}
                  </p>
                  <p>
                    <strong>Fecha:</strong> {format(new Date(selectedViolation.violation_date), 'dd MMMM yyyy', { locale: es })}
                  </p>
                  {selectedViolation.evidence_json && (
                    <div className="mt-2 p-3 bg-muted rounded-md text-sm">
                      <strong>Evidencia:</strong>
                      <pre className="mt-1 whitespace-pre-wrap">
                        {JSON.stringify(selectedViolation.evidence_json, null, 2)}
                      </pre>
                    </div>
                  )}
                </div>
              )}
            </DialogDescription>
          </DialogHeader>

          {(actionType === 'resolve' || actionType === 'dismiss') && selectedViolation?.status !== 'resolved' && selectedViolation?.status !== 'dismissed' && (
            <div className="py-4">
              <label className="text-sm font-medium">Notas de resolución</label>
              <Textarea
                placeholder="Describe las acciones tomadas..."
                value={resolutionNotes}
                onChange={(e) => setResolutionNotes(e.target.value)}
                className="mt-2"
              />
            </div>
          )}

          {(selectedViolation?.status === 'resolved' || selectedViolation?.status === 'dismissed') && selectedViolation?.resolution_notes && (
            <div className="py-4">
              <label className="text-sm font-medium">Notas de resolución</label>
              <p className="mt-2 p-3 bg-muted rounded-md text-sm">
                {selectedViolation.resolution_notes}
              </p>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setActionDialogOpen(false)}>
              Cancelar
            </Button>
            {selectedViolation?.status !== 'resolved' && selectedViolation?.status !== 'dismissed' && (
              <Button onClick={confirmAction} disabled={updateMutation.isPending}>
                {updateMutation.isPending ? 'Guardando...' : 'Confirmar'}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
