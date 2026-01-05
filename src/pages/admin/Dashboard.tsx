import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Users, Monitor, Clock, AlertCircle } from 'lucide-react';
import { format, startOfDay, endOfDay } from 'date-fns';
import { es } from 'date-fns/locale';
import { useCompany } from '@/hooks/useCompany';

export default function Dashboard() {
  const today = new Date();
  const { company } = useCompany();

  const { data: employeeCount } = useQuery({
    queryKey: ['employees-count', company?.id],
    enabled: !!company?.id,
    queryFn: async () => {
      const { count } = await supabase
        .from('employees')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'active')
        .eq('company_id', company!.id);
      return count || 0;
    },
  });

  const { data: terminalCount } = useQuery({
    queryKey: ['terminals-count', company?.id],
    enabled: !!company?.id,
    queryFn: async () => {
      const { count } = await supabase
        .from('terminals')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'active')
        .eq('company_id', company!.id);
      return count || 0;
    },
  });

  const { data: todayEvents } = useQuery({
    queryKey: ['today-events', company?.id],
    enabled: !!company?.id,
    queryFn: async () => {
      const { data } = await supabase
        .from('time_events')
        .select('*, employees(first_name, last_name)')
        .eq('company_id', company!.id)
        .gte('timestamp', startOfDay(today).toISOString())
        .lte('timestamp', endOfDay(today).toISOString())
        .order('timestamp', { ascending: false })
        .limit(10);
      return data || [];
    },
  });

  const { data: pendingCorrections } = useQuery({
    queryKey: ['pending-corrections-count', company?.id],
    enabled: !!company?.id,
    queryFn: async () => {
      const { count } = await supabase
        .from('correction_requests')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'pending')
        .eq('company_id', company!.id);
      return count || 0;
    },
  });

  return (
    <AppLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
          <p className="text-muted-foreground">
            {format(today, "EEEE, d 'de' MMMM 'de' yyyy", { locale: es })}
          </p>
        </div>

        {/* Stats cards */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Empleados Activos</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{employeeCount ?? 0}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Terminales Activos</CardTitle>
              <Monitor className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{terminalCount ?? 0}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Fichajes Hoy</CardTitle>
              <Clock className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{todayEvents?.length ?? 0}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Correcciones Pendientes</CardTitle>
              <AlertCircle className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{pendingCorrections ?? 0}</div>
            </CardContent>
          </Card>
        </div>

        {/* Recent events */}
        <Card>
          <CardHeader>
            <CardTitle>Últimos Fichajes</CardTitle>
            <CardDescription>Registros de hoy</CardDescription>
          </CardHeader>
          <CardContent>
            {todayEvents && todayEvents.length > 0 ? (
              <div className="space-y-3">
                {todayEvents.map((event: any) => (
                  <div
                    key={event.id}
                    className="flex items-center justify-between rounded-lg border p-3"
                  >
                    <div className="flex items-center gap-3">
                      <div className={`h-2 w-2 rounded-full ${
                        event.event_type === 'entry' ? 'bg-green-500' : 'bg-red-500'
                      }`} />
                      <div>
                        <p className="font-medium">
                          {event.employees?.first_name} {event.employees?.last_name}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          {event.event_type === 'entry' ? 'Entrada' : 'Salida'}
                        </p>
                      </div>
                    </div>
                    <span className="text-sm text-muted-foreground">
                      {format(new Date(event.timestamp), 'HH:mm')}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-center text-muted-foreground py-8">
                No hay fichajes registrados hoy
              </p>
            )}
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
