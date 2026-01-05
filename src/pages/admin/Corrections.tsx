import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { AppLayout } from '@/components/layout/AppLayout';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
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
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';
import { useCompany } from '@/hooks/useCompany';
import { Check, X, Eye } from 'lucide-react';
import { format } from 'date-fns';
import type { CorrectionStatus, EventType } from '@/types/database';

const statusLabels: Record<CorrectionStatus, string> = {
  pending: 'Pendiente',
  approved: 'Aprobada',
  rejected: 'Rechazada',
};

const statusColors: Record<CorrectionStatus, string> = {
  pending: 'bg-yellow-500/10 text-yellow-700 border-yellow-200',
  approved: 'bg-green-500/10 text-green-700 border-green-200',
  rejected: 'bg-red-500/10 text-red-700 border-red-200',
};

const eventTypeLabels: Record<EventType, string> = {
  entry: 'Entrada',
  exit: 'Salida',
};

export default function Corrections() {
  const [statusFilter, setStatusFilter] = useState<string>('pending');
  const [selectedRequest, setSelectedRequest] = useState<any | null>(null);
  const [reviewNotes, setReviewNotes] = useState('');
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { user } = useAuth();
  const { company } = useCompany();

  const { data: requests, isLoading } = useQuery({
    queryKey: ['correction-requests', statusFilter, company?.id],
    enabled: !!company?.id,
    queryFn: async () => {
      let query = supabase
        .from('correction_requests')
        .select('*, employees(first_name, last_name, employee_code)')
        .eq('company_id', company!.id)
        .order('created_at', { ascending: false });

      if (statusFilter !== 'all') {
        query = query.eq('status', statusFilter as CorrectionStatus);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
  });

  const reviewMutation = useMutation({
    mutationFn: async ({ id, status, notes }: { id: string; status: 'approved' | 'rejected'; notes: string }) => {
      const { error } = await supabase
        .from('correction_requests')
        .update({
          status,
          reviewed_by: user?.id,
          reviewed_at: new Date().toISOString(),
          review_notes: notes || null,
        })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['correction-requests'] });
      queryClient.invalidateQueries({ queryKey: ['pending-corrections-count'] });
      setSelectedRequest(null);
      setReviewNotes('');
      toast({
        title: variables.status === 'approved' ? 'Solicitud aprobada' : 'Solicitud rechazada',
      });
    },
    onError: (error) => {
      toast({ variant: 'destructive', title: 'Error', description: error.message });
    },
  });

  const handleReview = (status: 'approved' | 'rejected') => {
    if (!selectedRequest) return;
    reviewMutation.mutate({
      id: selectedRequest.id,
      status,
      notes: reviewNotes,
    });
  };

  return (
    <AppLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Correcciones</h1>
            <p className="text-muted-foreground">Gestiona las solicitudes de corrección de fichajes</p>
          </div>
        </div>

        {/* Filters */}
        <div className="flex items-center gap-4">
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-40">
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

        {/* Table */}
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Empleado</TableHead>
                <TableHead>Tipo solicitado</TableHead>
                <TableHead>Fecha/Hora solicitada</TableHead>
                <TableHead>Motivo</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead>Fecha solicitud</TableHead>
                <TableHead className="text-right">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8">
                    Cargando...
                  </TableCell>
                </TableRow>
              ) : requests?.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                    No hay solicitudes de corrección
                  </TableCell>
                </TableRow>
              ) : (
                requests?.map((request: any) => (
                  <TableRow key={request.id}>
                    <TableCell>
                      <div>
                        <p className="font-medium">
                          {request.employees?.first_name} {request.employees?.last_name}
                        </p>
                        <p className="text-sm text-muted-foreground font-mono">
                          {request.employees?.employee_code}
                        </p>
                      </div>
                    </TableCell>
                    <TableCell>
                      {request.requested_event_type
                        ? eventTypeLabels[request.requested_event_type as EventType]
                        : '-'}
                    </TableCell>
                    <TableCell>
                      {request.requested_timestamp
                        ? format(new Date(request.requested_timestamp), 'dd/MM/yyyy HH:mm')
                        : '-'}
                    </TableCell>
                    <TableCell className="max-w-xs truncate">{request.reason}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className={statusColors[request.status as CorrectionStatus]}>
                        {statusLabels[request.status as CorrectionStatus]}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {format(new Date(request.created_at), 'dd/MM/yyyy HH:mm')}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => setSelectedRequest(request)}
                      >
                        <Eye className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>

        {/* Review Dialog */}
        <Dialog open={!!selectedRequest} onOpenChange={() => setSelectedRequest(null)}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Revisar solicitud</DialogTitle>
              <DialogDescription>
                Revisa y aprueba o rechaza esta solicitud de corrección
              </DialogDescription>
            </DialogHeader>
            {selectedRequest && (
              <div className="space-y-4">
                <div className="rounded-lg bg-muted p-4 space-y-2">
                  <p>
                    <span className="text-muted-foreground">Empleado:</span>{' '}
                    {selectedRequest.employees?.first_name} {selectedRequest.employees?.last_name}
                  </p>
                  <p>
                    <span className="text-muted-foreground">Tipo solicitado:</span>{' '}
                    {selectedRequest.requested_event_type
                      ? eventTypeLabels[selectedRequest.requested_event_type as EventType]
                      : '-'}
                  </p>
                  <p>
                    <span className="text-muted-foreground">Fecha/Hora solicitada:</span>{' '}
                    {selectedRequest.requested_timestamp
                      ? format(new Date(selectedRequest.requested_timestamp), 'dd/MM/yyyy HH:mm')
                      : '-'}
                  </p>
                  <p>
                    <span className="text-muted-foreground">Motivo:</span>{' '}
                    {selectedRequest.reason}
                  </p>
                </div>

                {selectedRequest.status === 'pending' ? (
                  <>
                    <Textarea
                      placeholder="Notas de revisión (opcional)"
                      value={reviewNotes}
                      onChange={(e) => setReviewNotes(e.target.value)}
                    />
                    <div className="flex gap-2">
                      <Button
                        className="flex-1"
                        variant="outline"
                        onClick={() => handleReview('rejected')}
                      >
                        <X className="mr-2 h-4 w-4" />
                        Rechazar
                      </Button>
                      <Button className="flex-1" onClick={() => handleReview('approved')}>
                        <Check className="mr-2 h-4 w-4" />
                        Aprobar
                      </Button>
                    </div>
                  </>
                ) : (
                  <div className="rounded-lg border p-4">
                    <p className="text-sm text-muted-foreground">
                      Revisada el {format(new Date(selectedRequest.reviewed_at), 'dd/MM/yyyy HH:mm')}
                    </p>
                    {selectedRequest.review_notes && (
                      <p className="mt-2">
                        <span className="text-muted-foreground">Notas:</span>{' '}
                        {selectedRequest.review_notes}
                      </p>
                    )}
                  </div>
                )}
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </AppLayout>
  );
}
