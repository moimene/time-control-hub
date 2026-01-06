import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Users, Monitor, Clock, AlertCircle } from 'lucide-react';
import { format, startOfDay, endOfDay, subDays, startOfMonth, endOfMonth, subMonths, startOfYear, endOfYear } from 'date-fns';
import { es } from 'date-fns/locale';
import { useCompany } from '@/hooks/useCompany';
import { HoursChart } from '@/components/admin/HoursChart';
import { DailyActivityChart } from '@/components/admin/DailyActivityChart';

type PeriodType = 'current_month' | 'previous_month' | 'year_total';

const periodLabels: Record<PeriodType, string> = {
  current_month: 'Mes en curso',
  previous_month: 'Mes anterior',
  year_total: 'Total año',
};

export default function Dashboard() {
  const today = new Date();
  const { company } = useCompany();
  const [selectedPeriod, setSelectedPeriod] = useState<PeriodType>('current_month');

  // Calculate date range based on selected period
  const getDateRange = () => {
    switch (selectedPeriod) {
      case 'current_month':
        return { start: startOfMonth(today), end: endOfMonth(today) };
      case 'previous_month':
        const prevMonth = subMonths(today, 1);
        return { start: startOfMonth(prevMonth), end: endOfMonth(prevMonth) };
      case 'year_total':
        return { start: startOfYear(today), end: endOfYear(today) };
      default:
        return { start: startOfMonth(today), end: endOfMonth(today) };
    }
  };

  const dateRange = getDateRange();

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

  const { data: periodEvents } = useQuery({
    queryKey: ['period-events', company?.id, selectedPeriod],
    enabled: !!company?.id,
    queryFn: async () => {
      const { count } = await supabase
        .from('time_events')
        .select('*', { count: 'exact', head: true })
        .eq('company_id', company!.id)
        .gte('timestamp', dateRange.start.toISOString())
        .lte('timestamp', dateRange.end.toISOString());
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
    queryKey: ['pending-corrections-count', company?.id, selectedPeriod],
    enabled: !!company?.id,
    queryFn: async () => {
      const { count } = await supabase
        .from('correction_requests')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'pending')
        .eq('company_id', company!.id)
        .gte('created_at', dateRange.start.toISOString())
        .lte('created_at', dateRange.end.toISOString());
      return count || 0;
    },
  });

  // Get events for charts based on selected period
  const { data: chartEvents, isLoading: chartEventsLoading } = useQuery({
    queryKey: ['chart-events', company?.id, selectedPeriod],
    enabled: !!company?.id,
    queryFn: async () => {
      const { data } = await supabase
        .from('time_events')
        .select('id, employee_id, event_type, timestamp, employees(first_name, last_name, department)')
        .eq('company_id', company!.id)
        .gte('timestamp', dateRange.start.toISOString())
        .lte('timestamp', dateRange.end.toISOString())
        .order('timestamp', { ascending: true });
      return data || [];
    },
  });

  const getPeriodLabel = () => {
    switch (selectedPeriod) {
      case 'current_month':
        return format(today, "MMMM yyyy", { locale: es });
      case 'previous_month':
        return format(subMonths(today, 1), "MMMM yyyy", { locale: es });
      case 'year_total':
        return format(today, "yyyy", { locale: es });
      default:
        return '';
    }
  };

  return (
    <AppLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
            <p className="text-muted-foreground">
              {format(today, "EEEE, d 'de' MMMM 'de' yyyy", { locale: es })}
            </p>
          </div>
          <Select value={selectedPeriod} onValueChange={(value: PeriodType) => setSelectedPeriod(value)}>
            <SelectTrigger className="w-48">
              <SelectValue placeholder="Seleccionar periodo" />
            </SelectTrigger>
            <SelectContent>
              {Object.entries(periodLabels).map(([value, label]) => (
                <SelectItem key={value} value={value}>
                  {label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Period indicator */}
        <div className="text-sm text-muted-foreground">
          Mostrando datos de: <span className="font-medium text-foreground">{getPeriodLabel()}</span>
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
              <CardTitle className="text-sm font-medium">Fichajes ({periodLabels[selectedPeriod]})</CardTitle>
              <Clock className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{periodEvents ?? 0}</div>
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

        {/* Charts */}
        <div className="grid gap-6 lg:grid-cols-2">
          <HoursChart events={chartEvents || []} isLoading={chartEventsLoading} />
          <DailyActivityChart events={chartEvents || []} isLoading={chartEventsLoading} />
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