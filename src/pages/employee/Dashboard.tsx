import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { EmployeeLayout } from '@/components/layout/EmployeeLayout';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { format, startOfMonth, endOfMonth } from 'date-fns';
import { es } from 'date-fns/locale';
import { Clock } from 'lucide-react';
import type { EventType, EventSource } from '@/types/database';

const eventTypeLabels: Record<EventType, string> = {
  entry: 'Entrada',
  exit: 'Salida',
};

const eventSourceLabels: Record<EventSource, string> = {
  qr: 'QR',
  pin: 'PIN',
  manual: 'Manual',
};

export default function EmployeeDashboard() {
  const { employee } = useAuth();
  const today = new Date();

  const { data: recentEvents, isLoading } = useQuery({
    queryKey: ['my-events', employee?.id],
    enabled: !!employee?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('time_events')
        .select('*')
        .eq('employee_id', employee!.id)
        .gte('timestamp', startOfMonth(today).toISOString())
        .lte('timestamp', endOfMonth(today).toISOString())
        .order('timestamp', { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  // Group events by date
  const groupedEvents = recentEvents?.reduce((acc: any, event: any) => {
    const date = format(new Date(event.timestamp), 'yyyy-MM-dd');
    if (!acc[date]) {
      acc[date] = [];
    }
    acc[date].push(event);
    return acc;
  }, {});

  return (
    <EmployeeLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Mis Fichajes</h1>
          <p className="text-muted-foreground">
            {format(today, 'MMMM yyyy', { locale: es })}
          </p>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
          </div>
        ) : groupedEvents && Object.keys(groupedEvents).length > 0 ? (
          <div className="space-y-4">
            {Object.entries(groupedEvents)
              .sort(([a], [b]) => b.localeCompare(a))
              .map(([date, events]: [string, any]) => (
                <Card key={date}>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-lg">
                      {format(new Date(date), 'EEEE, d MMMM', { locale: es })}
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      {events
                        .sort((a: any, b: any) => 
                          new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
                        )
                        .map((event: any) => (
                          <div
                            key={event.id}
                            className="flex items-center justify-between rounded-lg border p-3"
                          >
                            <div className="flex items-center gap-3">
                              <div
                                className={`h-2 w-2 rounded-full ${
                                  event.event_type === 'entry' ? 'bg-green-500' : 'bg-red-500'
                                }`}
                              />
                              <div>
                                <p className="font-medium">
                                  {eventTypeLabels[event.event_type as EventType]}
                                </p>
                                <p className="text-sm text-muted-foreground">
                                  {eventSourceLabels[event.event_source as EventSource]}
                                </p>
                              </div>
                            </div>
                            <span className="font-mono text-lg">
                              {format(new Date(event.timestamp), 'HH:mm')}
                            </span>
                          </div>
                        ))}
                    </div>
                  </CardContent>
                </Card>
              ))}
          </div>
        ) : (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12">
              <Clock className="h-12 w-12 text-muted-foreground mb-4" />
              <p className="text-muted-foreground">
                No tienes fichajes registrados este mes
              </p>
            </CardContent>
          </Card>
        )}
      </div>
    </EmployeeLayout>
  );
}
