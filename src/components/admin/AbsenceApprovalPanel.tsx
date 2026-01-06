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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useToast } from '@/hooks/use-toast';
import { 
  CheckCircle2, 
  XCircle, 
  Loader2, 
  Calendar,
  User,
  Clock,
  FileText,
  Search,
  Filter,
  AlertTriangle
} from 'lucide-react';
import { format, parseISO, differenceInDays } from 'date-fns';
import { es } from 'date-fns/locale';

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
  employees: {
    first_name: string;
    last_name: string;
    department: string | null;
  } | null;
  absence_types: {
    name: string;
    color: string;
    absence_category: string;
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
          absence_types(name, color, absence_category)
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

  // Review mutation
  const reviewMutation = useMutation({
    mutationFn: async ({ requestId, action, notes }: { requestId: string; action: 'approve' | 'reject'; notes: string }) => {
      const newStatus = action === 'approve' ? 'approved' : 'rejected';
      
      // Update request status
      const { error: updateError } = await supabase
        .from('absence_requests')
        .update({ 
          status: newStatus,
          updated_at: new Date().toISOString()
        })
        .eq('id', requestId);
      
      if (updateError) throw updateError;

      // Create approval record
      const { error: approvalError } = await supabase
        .from('absence_approvals')
        .insert({
          request_id: requestId,
          approver_id: user?.id,
          action: newStatus,
          notes: notes || null
        });

      if (approvalError) throw approvalError;

      // If approved and it's vacation, update balance
      if (action === 'approve' && selectedRequest) {
        const currentYear = new Date().getFullYear();
        const { data: balance } = await supabase
          .from('vacation_balances')
          .select('*')
          .eq('employee_id', selectedRequest.employee_id)
          .eq('year', currentYear)
          .maybeSingle();

        if (balance) {
          await supabase
            .from('vacation_balances')
            .update({
              used_days: balance.used_days + selectedRequest.total_days,
              pending_days: Math.max(0, balance.pending_days - selectedRequest.total_days),
              updated_at: new Date().toISOString()
            })
            .eq('id', balance.id);
        }
      }
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
    },
    onError: (error: Error) => {
      toast({ variant: 'destructive', title: 'Error', description: error.message });
    }
  });

  const handleReview = (request: AbsenceRequest, action: 'approve' | 'reject') => {
    setSelectedRequest(request);
    setReviewAction(action);
    setReviewNotes('');
    setIsReviewDialogOpen(true);
  };

  const confirmReview = () => {
    if (!selectedRequest) return;
    reviewMutation.mutate({
      requestId: selectedRequest.id,
      action: reviewAction,
      notes: reviewNotes
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

  return (
    <Card>
      <CardHeader>
        <CardTitle>Solicitudes de Ausencia</CardTitle>
        <CardDescription>
          Revisa y gestiona las solicitudes de los empleados
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
                  <TableHead>Estado</TableHead>
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
                          className="w-3 h-3 rounded-full"
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
                        {request.start_date !== request.end_date && (
                          <> - {format(parseISO(request.end_date), 'dd MMM', { locale: es })}</>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">{request.total_days} día(s)</Badge>
                    </TableCell>
                    <TableCell>
                      <Badge className={statusColors[request.status]}>
                        {statusLabels[request.status]}
                      </Badge>
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
          <DialogContent>
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
                    <span className="ml-2">({selectedRequest.total_days} días)</span>
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

            <div className="space-y-2">
              <label className="text-sm font-medium">Notas (opcional)</label>
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
                disabled={reviewMutation.isPending}
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
