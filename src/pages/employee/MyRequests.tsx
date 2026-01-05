import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { EmployeeLayout } from '@/components/layout/EmployeeLayout';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { FileText } from 'lucide-react';
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

export default function MyRequests() {
  const { employee } = useAuth();

  const { data: requests, isLoading } = useQuery({
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

  return (
    <EmployeeLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Mis Solicitudes</h1>
          <p className="text-muted-foreground">
            Historial de tus solicitudes de corrección
          </p>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
          </div>
        ) : requests && requests.length > 0 ? (
          <div className="space-y-4">
            {requests.map((request: any) => (
              <Card key={request.id}>
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
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
                    <Badge variant="outline" className={statusColors[request.status as CorrectionStatus]}>
                      {statusLabels[request.status as CorrectionStatus]}
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
            ))}
          </div>
        ) : (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12">
              <FileText className="h-12 w-12 text-muted-foreground mb-4" />
              <p className="text-muted-foreground">
                No tienes solicitudes de corrección
              </p>
            </CardContent>
          </Card>
        )}
      </div>
    </EmployeeLayout>
  );
}
