import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useCompany } from '@/hooks/useCompany';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useToast } from '@/hooks/use-toast';
import { 
  CheckCircle2, 
  XCircle, 
  Loader2, 
  Calendar,
  Search,
  Filter,
  AlertTriangle,
  FileText,
  ExternalLink
} from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';
import { SLACountdown } from '@/components/absences/SLACountdown';
import { CoverageCheckBadge } from '@/components/absences/CoverageCheckBadge';

const statusLabels: Record<string, string> = {
  pending: 'Pendiente',
  approved: 'Aprobada',
  rejected: 'Rechazada',
  cancelled: 'Cancelada',
};

const statusColors: Record<string, string> = {
  pending: 'bg-yellow-500/10 text-yellow-600 border-yellow-500/20',
  approved: 'bg-green-500/10 text-green-600 border-green-500/20',
  rejected: 'bg-red-500/10 text-red-600 border-red-500/20',
  cancelled: 'bg-muted text-muted-foreground',
};

interface AbsenceRequest {
  id: string;
  employee_id: string;
  absence_type_id: string;
  start_date: string;
  end_date: string;
  total_days: number;
  reason: string | null;
  status: string;
  created_at: string;
  requested_at: string;
  justification_files: any;
  justification_required: boolean;
  start_half_day: boolean | null;
  end_half_day: boolean | null;
  travel_km: number | null;
  extra_days_applied: number;
  center_id: string | null;
  employees: {
    first_name: string;
    last_name: string;
    department: string | null;
  } | null;
  absence_types: {
    name: string;
    color: string;
    absence_category: string;
    sla_hours: number | null;
    requires_justification: boolean;
  } | null;
}

export function AbsenceApprovalPanel() {
  const { company } = useCompany();
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [statusFilter, setStatusFilter] = useState<string>('pending');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedRequest, setSelectedRequest] = useState<AbsenceRequest | null>(null);
  const [reviewNotes, setReviewNotes] = useState('');
  const [isReviewDialogOpen, setIsReviewDialogOpen] = useState(false);
  const [reviewAction, setReviewAction] = useState<'approve' | 'reject'>('approve');
  const [overrideReason, setOverrideReason] = useState('');
  const [forceOverride, setForceOverride] = useState(false);
  const [coverageResult, setCoverageResult] = useState<any>(null);

  // Fetch requests
  const { data: requests, isLoading } = useQuery({
    queryKey: ['absence-requests-admin', company?.id, statusFilter],
    queryFn: async () => {
      if (!company?.id) return [];
      
      let query = supabase
        .from('absence_requests')
        .select(`
          *,
          employees(first_name, last_name, department),
          absence_types(name, color, absence_category, sla_hours, requires_justification)
        `)
        .eq('company_id', company.id)
        .order('created_at', { ascending: false });

      if (statusFilter !== 'all') {
        query = query.eq('status', statusFilter);
      }

      const { data, error } = await query;
      if (error) throw error;
      return (data || []) as AbsenceRequest[];
    },
    enabled: !!company?.id,
  });

  // Review mutation using edge function
  const reviewMutation = useMutation({
    mutationFn: async ({ 
      requestId, 
      action, 
      notes, 
      override, 
      overrideReason 
    }: { 
      requestId: string; 
      action: 'approve' | 'reject'; 
      notes: string;
      override?: boolean;
      overrideReason?: string;
    }) => {
      const { data, error } = await supabase.functions.invoke('absence-approve', {
        body: {
          request_id: requestId,
          action: action === 'approve' ? 'approved' : 'rejected',
          notes: notes || null,
          override_coverage: override,
          override_reason: overrideReason
        }
      });

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      toast({ 
        title: reviewAction === 'approve' ? 'Solicitud aprobada' : 'Solicitud rechazada' 
      });
      queryClient.invalidateQueries({ queryKey: ['absence-requests-admin'] });
      queryClient.invalidateQueries({ queryKey: ['absence-stats'] });
      setIsReviewDialogOpen(false);
      setSelectedRequest(null);
      setReviewNotes('');
      setOverrideReason('');
      setForceOverride(false);
      setCoverageResult(null);
    },
    onError: (error: Error) => {
      toast({ variant: 'destructive', title: 'Error', description: error.message });
    }
  });

  const handleReview = (request: AbsenceRequest, action: 'approve' | 'reject') => {
    setSelectedRequest(request);
    setReviewAction(action);
    setReviewNotes('');
    setOverrideReason('');
    setForceOverride(false);
    setCoverageResult(null);
    setIsReviewDialogOpen(true);
  };

  const confirmReview = () => {
    if (!selectedRequest) return;
    
    // Check if override is needed
    const needsOverride = reviewAction === 'approve' && coverageResult && !coverageResult.can_approve;
    if (needsOverride && !forceOverride) {
      toast({ 
        variant: 'destructive', 
        title: 'Conflicto de cobertura', 
        description: 'Activa el override y proporciona un motivo para aprobar' 
      });
      return;
    }

    // Check justification
    const hasJustification = selectedRequest.justification_files && 
      Array.isArray(selectedRequest.justification_files) && 
      selectedRequest.justification_files.length > 0;
    
    if (reviewAction === 'approve' && selectedRequest.absence_types?.requires_justification && !hasJustification) {
      toast({ 
        variant: 'destructive', 
        title: 'Justificante requerido', 
        description: 'No se puede aprobar sin el justificante adjunto' 
      });
      return;
    }

    reviewMutation.mutate({
      requestId: selectedRequest.id,
      action: reviewAction,
      notes: reviewNotes,
      override: forceOverride,
      overrideReason: overrideReason
    });
  };

  const filteredRequests = requests?.filter(r => {
    if (!searchTerm) return true;
    const fullName = `${r.employees?.first_name} ${r.employees?.last_name}`.toLowerCase();
    return fullName.includes(searchTerm.toLowerCase()) ||
           r.absence_types?.name.toLowerCase().includes(searchTerm.toLowerCase());
  });

  const getCategoryLabel = (category: string) => {
    const labels: Record<string, string> = {
      permiso_retribuido: 'Permiso Retribuido',
      permiso_no_retribuido: 'No Retribuido',
      vacaciones: 'Vacaciones',
      suspension: 'Suspensión',
      ajuste_jornada: 'Ajuste Jornada',
      representacion: 'Representación',
      fuerza_mayor: 'Fuerza Mayor',
      otros: 'Otros'
    };
    return labels[category] || category;
  };

  const hasJustification = (request: AbsenceRequest) => {
    return request.justification_files && 
      Array.isArray(request.justification_files) && 
      request.justification_files.length > 0;
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Solicitudes de Ausencia</CardTitle>
        <CardDescription>
          Revisa y gestiona las solicitudes de los empleados con control de SLA y cobertura
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por empleado o tipo..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9"
            />
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[180px]">
              <Filter className="h-4 w-4 mr-2" />
              <SelectValue placeholder="Estado" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              <SelectItem value="pending">Pendientes</SelectItem>
              <SelectItem value="approved">Aprobadas</SelectItem>
              <SelectItem value="rejected">Rechazadas</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Requests Table */}
        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : filteredRequests?.length === 0 ? (
          <div className="text-center py-8">
            <Calendar className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <p className="text-muted-foreground">No hay solicitudes {statusFilter !== 'all' ? statusLabels[statusFilter]?.toLowerCase() + 's' : ''}</p>
          </div>
        ) : (
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Empleado</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Fechas</TableHead>
                  <TableHead>Días</TableHead>
                  <TableHead>SLA</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead>Docs</TableHead>
                  <TableHead>Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredRequests?.map((request) => (
                  <TableRow key={request.id}>
                    <TableCell>
                      <div>
                        <div className="font-medium">
                          {request.employees?.first_name} {request.employees?.last_name}
                        </div>
                        {request.employees?.department && (
                          <div className="text-sm text-muted-foreground">
                            {request.employees.department}
                          </div>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <div 
                          className="w-3 h-3 rounded-full shrink-0"
                          style={{ backgroundColor: request.absence_types?.color || '#6b7280' }}
                        />
                        <div>
                          <div className="font-medium">{request.absence_types?.name}</div>
                          <div className="text-xs text-muted-foreground">
                            {getCategoryLabel(request.absence_types?.absence_category || '')}
                          </div>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="text-sm">
                        {format(parseISO(request.start_date), 'dd MMM', { locale: es })}
                        {request.start_half_day && <span className="text-xs ml-1">(PM)</span>}
                        {request.start_date !== request.end_date && (
                          <>
                            {' - '}
                            {format(parseISO(request.end_date), 'dd MMM', { locale: es })}
                            {request.end_half_day && <span className="text-xs ml-1">(AM)</span>}
                          </>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">
                        {request.total_days + request.extra_days_applied} día(s)
                        {request.extra_days_applied > 0 && (
                          <span className="text-green-600 ml-1">(+{request.extra_days_applied})</span>
                        )}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <SLACountdown
                        requestedAt={request.requested_at || request.created_at}
                        slaHours={request.absence_types?.sla_hours || null}
                        status={request.status}
                      />
                    </TableCell>
                    <TableCell>
                      <Badge className={statusColors[request.status]}>
                        {statusLabels[request.status]}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {hasJustification(request) ? (
                        <Badge className="bg-green-500/10 text-green-600 border-green-500/20 gap-1">
                          <FileText className="h-3 w-3" />
                          {(request.justification_files as any[]).length}
                        </Badge>
                      ) : request.absence_types?.requires_justification ? (
                        <Badge variant="destructive" className="gap-1">
                          <AlertTriangle className="h-3 w-3" />
                          Falta
                        </Badge>
                      ) : (
                        <span className="text-muted-foreground text-sm">-</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {request.status === 'pending' && (
                        <div className="flex items-center gap-2">
                          <Button
                            size="sm"
                            variant="ghost"
                            className="text-green-600 hover:text-green-700 hover:bg-green-50"
                            onClick={() => handleReview(request, 'approve')}
                          >
                            <CheckCircle2 className="h-4 w-4" />
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="text-red-600 hover:text-red-700 hover:bg-red-50"
                            onClick={() => handleReview(request, 'reject')}
                          >
                            <XCircle className="h-4 w-4" />
                          </Button>
                        </div>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}

        {/* Review Dialog */}
        <Dialog open={isReviewDialogOpen} onOpenChange={setIsReviewDialogOpen}>
          <DialogContent className="sm:max-w-[500px]">
            <DialogHeader>
              <DialogTitle>
                {reviewAction === 'approve' ? 'Aprobar Solicitud' : 'Rechazar Solicitud'}
              </DialogTitle>
              <DialogDescription>
                {selectedRequest && (
                  <>
                    {selectedRequest.employees?.first_name} {selectedRequest.employees?.last_name} - {selectedRequest.absence_types?.name}
                    <br />
                    {format(parseISO(selectedRequest.start_date), 'dd MMM yyyy', { locale: es })}
                    {selectedRequest.start_date !== selectedRequest.end_date && (
                      <> - {format(parseISO(selectedRequest.end_date), 'dd MMM yyyy', { locale: es })}</>
                    )}
                    <span className="ml-2">({selectedRequest.total_days + selectedRequest.extra_days_applied} días)</span>
                  </>
                )}
              </DialogDescription>
            </DialogHeader>
            
            {selectedRequest?.reason && (
              <div className="rounded-lg bg-muted p-3">
                <p className="text-sm font-medium mb-1">Motivo del empleado:</p>
                <p className="text-sm text-muted-foreground">{selectedRequest.reason}</p>
              </div>
            )}

            {/* Coverage check for approval */}
            {reviewAction === 'approve' && selectedRequest && company && (
              <div className="space-y-2">
                <Label>Verificación de cobertura</Label>
                <CoverageCheckBadge
                  companyId={company.id}
                  employeeId={selectedRequest.employee_id}
                  startDate={selectedRequest.start_date}
                  endDate={selectedRequest.end_date}
                  centerId={selectedRequest.center_id}
                  department={selectedRequest.employees?.department}
                  onResult={setCoverageResult}
                  autoCheck={true}
                />
              </div>
            )}

            {/* Override option when coverage fails */}
            {reviewAction === 'approve' && coverageResult && !coverageResult.can_approve && (
              <div className="space-y-3 p-3 border border-yellow-500/30 rounded-lg bg-yellow-500/5">
                <div className="flex items-start gap-2">
                  <AlertTriangle className="h-5 w-5 text-yellow-600 shrink-0 mt-0.5" />
                  <div>
                    <p className="font-medium text-yellow-700">Conflicto de cobertura detectado</p>
                    <p className="text-sm text-muted-foreground">
                      Puedes forzar la aprobación proporcionando un motivo justificado
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Checkbox
                    id="forceOverride"
                    checked={forceOverride}
                    onCheckedChange={(checked) => setForceOverride(checked as boolean)}
                  />
                  <Label htmlFor="forceOverride" className="text-sm">
                    Aprobar con override de cobertura
                  </Label>
                </div>
                {forceOverride && (
                  <Textarea
                    value={overrideReason}
                    onChange={(e) => setOverrideReason(e.target.value)}
                    placeholder="Motivo del override (obligatorio)..."
                    rows={2}
                  />
                )}
              </div>
            )}

            {/* Justification warning */}
            {reviewAction === 'approve' && selectedRequest?.absence_types?.requires_justification && !hasJustification(selectedRequest) && (
              <div className="flex items-start gap-2 p-3 border border-destructive/30 rounded-lg bg-destructive/5">
                <AlertTriangle className="h-5 w-5 text-destructive shrink-0 mt-0.5" />
                <div>
                  <p className="font-medium text-destructive">Justificante requerido</p>
                  <p className="text-sm text-muted-foreground">
                    Este tipo de ausencia requiere justificante. No se puede aprobar sin él.
                  </p>
                </div>
              </div>
            )}

            {/* Attached files preview */}
            {hasJustification(selectedRequest!) && (
              <div className="space-y-2">
                <Label>Justificantes adjuntos</Label>
                <div className="flex flex-wrap gap-2">
                  {(selectedRequest!.justification_files as any[]).map((file: any, idx: number) => (
                    <Badge key={idx} variant="outline" className="gap-1">
                      <FileText className="h-3 w-3" />
                      {file.name || `Archivo ${idx + 1}`}
                      <ExternalLink className="h-3 w-3 ml-1" />
                    </Badge>
                  ))}
                </div>
              </div>
            )}

            <div className="space-y-2">
              <Label>Notas {reviewAction === 'reject' ? '(motivo del rechazo)' : '(opcional)'}</Label>
              <Textarea
                value={reviewNotes}
                onChange={(e) => setReviewNotes(e.target.value)}
                placeholder={reviewAction === 'approve' 
                  ? 'Añade notas sobre la aprobación...' 
                  : 'Indica el motivo del rechazo...'}
                rows={3}
              />
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setIsReviewDialogOpen(false)}>
                Cancelar
              </Button>
              <Button
                variant={reviewAction === 'approve' ? 'default' : 'destructive'}
                onClick={confirmReview}
                disabled={
                  reviewMutation.isPending ||
                  (reviewAction === 'approve' && selectedRequest?.absence_types?.requires_justification && !hasJustification(selectedRequest)) ||
                  (reviewAction === 'approve' && coverageResult && !coverageResult.can_approve && (!forceOverride || !overrideReason.trim()))
                }
              >
                {reviewMutation.isPending ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : reviewAction === 'approve' ? (
                  <CheckCircle2 className="h-4 w-4 mr-2" />
                ) : (
                  <XCircle className="h-4 w-4 mr-2" />
                )}
                {reviewAction === 'approve' ? 'Aprobar' : 'Rechazar'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
}
