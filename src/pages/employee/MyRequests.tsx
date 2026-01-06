import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { EmployeeLayout } from '@/components/layout/EmployeeLayout';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { format, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';
import { FileText, Calendar, FileEdit, Loader2, CheckCircle2, XCircle, Clock } from 'lucide-react';
import type { CorrectionStatus, EventType } from '@/types/database';

const correctionStatusLabels: Record<CorrectionStatus, string> = {
  pending: 'Pendiente',
  approved: 'Aprobada',
  rejected: 'Rechazada',
};

const correctionStatusColors: Record<CorrectionStatus, string> = {
  pending: 'bg-yellow-500/10 text-yellow-700 border-yellow-200',
  approved: 'bg-green-500/10 text-green-700 border-green-200',
  rejected: 'bg-red-500/10 text-red-700 border-red-200',
};

const absenceStatusLabels: Record<string, string> = {
  pending: 'Pendiente',
  approved: 'Aprobada',
  rejected: 'Rechazada',
  cancelled: 'Cancelada',
};

const absenceStatusColors: Record<string, string> = {
  pending: 'bg-yellow-500/10 text-yellow-700 border-yellow-200',
  approved: 'bg-green-500/10 text-green-700 border-green-200',
  rejected: 'bg-red-500/10 text-red-700 border-red-200',
  cancelled: 'bg-muted text-muted-foreground border-muted',
};

const eventTypeLabels: Record<EventType, string> = {
  entry: 'Entrada',
  exit: 'Salida',
};

export default function MyRequests() {
  const { employee } = useAuth();

  // Fetch correction requests
  const { data: correctionRequests, isLoading: correctionsLoading } = useQuery({
    queryKey: ['my-correction-requests', employee?.id],
    enabled: !!employee?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('correction_requests')
        .select('*')
        .eq('employee_id', employee!.id)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  // Fetch absence requests
  const { data: absenceRequests, isLoading: absencesLoading } = useQuery({
    queryKey: ['my-absence-requests', employee?.id],
    enabled: !!employee?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('absence_requests')
        .select(`
          *,
          absence_types(name, color, category)
        `)
        .eq('employee_id', employee!.id)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const isLoading = correctionsLoading || absencesLoading;
  const totalCorrections = correctionRequests?.length || 0;
  const totalAbsences = absenceRequests?.length || 0;
  const pendingCorrections = correctionRequests?.filter(r => r.status === 'pending').length || 0;
  const pendingAbsences = absenceRequests?.filter(r => r.status === 'pending').length || 0;

  return (
    <EmployeeLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Mis Solicitudes</h1>
          <p className="text-muted-foreground">
            Historial de todas tus solicitudes
          </p>
        </div>

        {/* Summary Cards */}
        <div className="grid gap-4 md:grid-cols-2">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <FileEdit className="h-4 w-4" />
                Correcciones
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-baseline gap-2">
                <span className="text-2xl font-bold">{totalCorrections}</span>
                <span className="text-muted-foreground">total</span>
                {pendingCorrections > 0 && (
                  <Badge variant="outline" className="ml-auto bg-yellow-500/10 text-yellow-700 border-yellow-200">
                    {pendingCorrections} pendiente(s)
                  </Badge>
                )}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <Calendar className="h-4 w-4" />
                Ausencias
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-baseline gap-2">
                <span className="text-2xl font-bold">{totalAbsences}</span>
                <span className="text-muted-foreground">total</span>
                {pendingAbsences > 0 && (
                  <Badge variant="outline" className="ml-auto bg-yellow-500/10 text-yellow-700 border-yellow-200">
                    {pendingAbsences} pendiente(s)
                  </Badge>
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <Tabs defaultValue="all" className="space-y-4">
            <TabsList>
              <TabsTrigger value="all">
                Todas
                <Badge variant="secondary" className="ml-2">
                  {totalCorrections + totalAbsences}
                </Badge>
              </TabsTrigger>
              <TabsTrigger value="corrections">
                Correcciones
                {totalCorrections > 0 && (
                  <Badge variant="secondary" className="ml-2">{totalCorrections}</Badge>
                )}
              </TabsTrigger>
              <TabsTrigger value="absences">
                Ausencias
                {totalAbsences > 0 && (
                  <Badge variant="secondary" className="ml-2">{totalAbsences}</Badge>
                )}
              </TabsTrigger>
            </TabsList>

            {/* All Requests Tab */}
            <TabsContent value="all">
              <Card>
                <CardHeader>
                  <CardTitle>Todas las Solicitudes</CardTitle>
                  <CardDescription>Ordenadas por fecha de creación</CardDescription>
                </CardHeader>
                <CardContent>
                  {totalCorrections + totalAbsences === 0 ? (
                    <EmptyState />
                  ) : (
                    <div className="space-y-3">
                      {/* Combine and sort by created_at */}
                      {[
                        ...(correctionRequests?.map(r => ({ ...r, type: 'correction' as const })) || []),
                        ...(absenceRequests?.map(r => ({ ...r, type: 'absence' as const })) || [])
                      ]
                        .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
                        .map((request) => (
                          request.type === 'correction' 
                            ? <CorrectionRequestCard key={`c-${request.id}`} request={request} />
                            : <AbsenceRequestCard key={`a-${request.id}`} request={request} />
                        ))
                      }
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            {/* Corrections Tab */}
            <TabsContent value="corrections">
              <Card>
                <CardHeader>
                  <CardTitle>Solicitudes de Corrección</CardTitle>
                  <CardDescription>Modificaciones de fichajes</CardDescription>
                </CardHeader>
                <CardContent>
                  {totalCorrections === 0 ? (
                    <EmptyState message="No tienes solicitudes de corrección" />
                  ) : (
                    <div className="space-y-3">
                      {correctionRequests?.map((request) => (
                        <CorrectionRequestCard key={request.id} request={request} />
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            {/* Absences Tab */}
            <TabsContent value="absences">
              <Card>
                <CardHeader>
                  <CardTitle>Solicitudes de Ausencia</CardTitle>
                  <CardDescription>Vacaciones, permisos y bajas</CardDescription>
                </CardHeader>
                <CardContent>
                  {totalAbsences === 0 ? (
                    <EmptyState message="No tienes solicitudes de ausencia" />
                  ) : (
                    <div className="space-y-3">
                      {absenceRequests?.map((request) => (
                        <AbsenceRequestCard key={request.id} request={request} />
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        )}
      </div>
    </EmployeeLayout>
  );
}

function EmptyState({ message = "No tienes solicitudes" }: { message?: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-12">
      <FileText className="h-12 w-12 text-muted-foreground mb-4" />
      <p className="text-muted-foreground">{message}</p>
    </div>
  );
}

function CorrectionRequestCard({ request }: { request: any }) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <FileEdit className="h-4 w-4 text-muted-foreground" />
            <CardTitle className="text-lg">
              {request.requested_event_type
                ? eventTypeLabels[request.requested_event_type as EventType]
                : 'Corrección'}
              {request.requested_timestamp && (
                <span className="font-normal text-muted-foreground ml-2">
                  - {format(new Date(request.requested_timestamp), 'dd/MM/yyyy HH:mm')}
                </span>
              )}
            </CardTitle>
          </div>
          <Badge variant="outline" className={correctionStatusColors[request.status as CorrectionStatus]}>
            {request.status === 'approved' && <CheckCircle2 className="h-3 w-3 mr-1" />}
            {request.status === 'rejected' && <XCircle className="h-3 w-3 mr-1" />}
            {request.status === 'pending' && <Clock className="h-3 w-3 mr-1" />}
            {correctionStatusLabels[request.status as CorrectionStatus]}
          </Badge>
        </div>
        <CardDescription>
          Solicitada el {format(new Date(request.created_at), "d 'de' MMMM 'a las' HH:mm", { locale: es })}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          <div>
            <p className="text-sm text-muted-foreground">Motivo</p>
            <p>{request.reason}</p>
          </div>
          {request.review_notes && (
            <div className="rounded-lg bg-muted p-3 mt-3">
              <p className="text-sm text-muted-foreground">
                Notas de revisión
                {request.reviewed_at && (
                  <span className="ml-1">
                    ({format(new Date(request.reviewed_at), 'dd/MM/yyyy')})
                  </span>
                )}
              </p>
              <p className="text-sm">{request.review_notes}</p>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function AbsenceRequestCard({ request }: { request: any }) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div 
              className="w-3 h-3 rounded-full" 
              style={{ backgroundColor: request.absence_types?.color || '#6b7280' }}
            />
            <CardTitle className="text-lg">
              {request.absence_types?.name || 'Ausencia'}
            </CardTitle>
          </div>
          <Badge variant="outline" className={absenceStatusColors[request.status]}>
            {request.status === 'approved' && <CheckCircle2 className="h-3 w-3 mr-1" />}
            {request.status === 'rejected' && <XCircle className="h-3 w-3 mr-1" />}
            {request.status === 'pending' && <Clock className="h-3 w-3 mr-1" />}
            {absenceStatusLabels[request.status]}
          </Badge>
        </div>
        <CardDescription>
          Solicitada el {format(new Date(request.created_at), "d 'de' MMMM 'a las' HH:mm", { locale: es })}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          <div className="flex items-center gap-4 text-sm">
            <div>
              <span className="text-muted-foreground">Desde:</span>{' '}
              <span className="font-medium">{format(parseISO(request.start_date), 'dd/MM/yyyy')}</span>
            </div>
            <div>
              <span className="text-muted-foreground">Hasta:</span>{' '}
              <span className="font-medium">{format(parseISO(request.end_date), 'dd/MM/yyyy')}</span>
            </div>
            <div>
              <span className="text-muted-foreground">Total:</span>{' '}
              <span className="font-medium">{request.total_days} día(s)</span>
            </div>
          </div>
          {request.reason && (
            <div>
              <p className="text-sm text-muted-foreground">Motivo</p>
              <p className="text-sm">{request.reason}</p>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
