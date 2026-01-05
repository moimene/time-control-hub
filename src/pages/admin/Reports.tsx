import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { AppLayout } from '@/components/layout/AppLayout';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { CalendarIcon, Download, FileText, Clock, Users, TrendingUp } from 'lucide-react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, startOfDay, endOfDay } from 'date-fns';
import { es } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import type { Employee, EventType, EventSource } from '@/types/database';

const eventTypeLabels: Record<EventType, string> = {
  entry: 'Entrada',
  exit: 'Salida',
};

const eventSourceLabels: Record<EventSource, string> = {
  qr: 'QR',
  pin: 'PIN',
  manual: 'Manual',
};

export default function Reports() {
  const [month, setMonth] = useState<Date>(new Date());
  const [selectedEmployee, setSelectedEmployee] = useState<string>('all');

  const { data: employees } = useQuery({
    queryKey: ['employees-list'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('employees')
        .select('id, first_name, last_name, employee_code')
        .eq('status', 'active')
        .order('last_name');
      if (error) throw error;
      return data;
    },
  });

  const { data: records, isLoading } = useQuery({
    queryKey: ['report-records', month, selectedEmployee],
    queryFn: async () => {
      let query = supabase
        .from('time_events')
        .select('*, employees(first_name, last_name, employee_code)')
        .gte('timestamp', startOfMonth(month).toISOString())
        .lte('timestamp', endOfMonth(month).toISOString())
        .order('timestamp', { ascending: true });

      if (selectedEmployee !== 'all') {
        query = query.eq('employee_id', selectedEmployee);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
  });

  // Group records by employee and date
  const groupedRecords = records?.reduce((acc: any, record: any) => {
    const employeeId = record.employee_id;
    const date = format(new Date(record.timestamp), 'yyyy-MM-dd');

    if (!acc[employeeId]) {
      acc[employeeId] = {
        employee: record.employees,
        dates: {},
      };
    }

    if (!acc[employeeId].dates[date]) {
      acc[employeeId].dates[date] = [];
    }

    acc[employeeId].dates[date].push(record);
    return acc;
  }, {});

  const exportCSV = () => {
    if (!records) return;

    const headers = ['Código', 'Nombre', 'Fecha', 'Tipo', 'Hora', 'Origen'];
    const rows = records.map((record: any) => [
      record.employees?.employee_code,
      `${record.employees?.first_name} ${record.employees?.last_name}`,
      format(new Date(record.timestamp), 'dd/MM/yyyy'),
      eventTypeLabels[record.event_type as EventType],
      format(new Date(record.timestamp), 'HH:mm:ss'),
      eventSourceLabels[record.event_source as EventSource],
    ]);

    const csv = [headers, ...rows].map((row) => row.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `informe_${format(month, 'yyyy-MM')}.csv`;
    a.click();
  };

  const calculateHours = (dayRecords: any[]): number => {
    let totalMinutes = 0;
    const entries = dayRecords.filter((r) => r.event_type === 'entry').sort((a, b) => 
      new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
    );
    const exits = dayRecords.filter((r) => r.event_type === 'exit').sort((a, b) => 
      new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
    );

    for (let i = 0; i < Math.min(entries.length, exits.length); i++) {
      const entry = new Date(entries[i].timestamp);
      const exit = new Date(exits[i].timestamp);
      totalMinutes += (exit.getTime() - entry.getTime()) / 1000 / 60;
    }

    return totalMinutes;
  };

  const formatMinutes = (totalMinutes: number): string => {
    const hours = Math.floor(totalMinutes / 60);
    const minutes = Math.round(totalMinutes % 60);
    return `${hours}h ${minutes}m`;
  };

  // Calculate summary per employee
  const employeeSummary = groupedRecords ? Object.entries(groupedRecords).map(([employeeId, data]: [string, any]) => {
    let totalMinutes = 0;
    let totalDays = 0;
    
    Object.values(data.dates).forEach((dayRecords: any) => {
      const minutes = calculateHours(dayRecords);
      if (minutes > 0) {
        totalMinutes += minutes;
        totalDays++;
      }
    });

    return {
      employeeId,
      employee: data.employee,
      totalMinutes,
      totalDays,
      avgMinutesPerDay: totalDays > 0 ? totalMinutes / totalDays : 0,
    };
  }).sort((a, b) => b.totalMinutes - a.totalMinutes) : [];

  return (
    <AppLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Informes</h1>
            <p className="text-muted-foreground">Genera informes de fichajes por período</p>
          </div>
          <Button onClick={exportCSV}>
            <Download className="mr-2 h-4 w-4" />
            Exportar CSV
          </Button>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-4">
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" className={cn("justify-start text-left font-normal")}>
                <CalendarIcon className="mr-2 h-4 w-4" />
                {format(month, 'MMMM yyyy', { locale: es })}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar
                mode="single"
                selected={month}
                onSelect={(date) => date && setMonth(date)}
                locale={es}
              />
            </PopoverContent>
          </Popover>

          <Select value={selectedEmployee} onValueChange={setSelectedEmployee}>
            <SelectTrigger className="w-64">
              <SelectValue placeholder="Empleado" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos los empleados</SelectItem>
              {employees?.map((emp: any) => (
                <SelectItem key={emp.id} value={emp.id}>
                  {emp.first_name} {emp.last_name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Summary Cards */}
        {!isLoading && employeeSummary.length > 0 && (
          <>
            <div className="grid gap-4 md:grid-cols-3">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Total Horas Mes</CardTitle>
                  <Clock className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    {formatMinutes(employeeSummary.reduce((acc, e) => acc + e.totalMinutes, 0))}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {format(month, 'MMMM yyyy', { locale: es })}
                  </p>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Empleados Activos</CardTitle>
                  <Users className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{employeeSummary.length}</div>
                  <p className="text-xs text-muted-foreground">
                    con fichajes este mes
                  </p>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Media Diaria</CardTitle>
                  <TrendingUp className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    {formatMinutes(
                      employeeSummary.reduce((acc, e) => acc + e.avgMinutesPerDay, 0) / 
                      (employeeSummary.length || 1)
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    por empleado/día
                  </p>
                </CardContent>
              </Card>
            </div>

            {/* Summary Table */}
            <Card>
              <CardHeader>
                <CardTitle>Resumen por Empleado</CardTitle>
                <CardDescription>Horas trabajadas en {format(month, 'MMMM yyyy', { locale: es })}</CardDescription>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Código</TableHead>
                      <TableHead>Empleado</TableHead>
                      <TableHead className="text-right">Días</TableHead>
                      <TableHead className="text-right">Total Horas</TableHead>
                      <TableHead className="text-right">Media/Día</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {employeeSummary.map((summary) => (
                      <TableRow key={summary.employeeId}>
                        <TableCell className="font-mono">{summary.employee?.employee_code}</TableCell>
                        <TableCell>
                          {summary.employee?.first_name} {summary.employee?.last_name}
                        </TableCell>
                        <TableCell className="text-right">{summary.totalDays}</TableCell>
                        <TableCell className="text-right font-mono font-medium">
                          {formatMinutes(summary.totalMinutes)}
                        </TableCell>
                        <TableCell className="text-right font-mono text-muted-foreground">
                          {formatMinutes(summary.avgMinutesPerDay)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </>
        )}

        {/* Detailed Report */}
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
          </div>
        ) : groupedRecords && Object.keys(groupedRecords).length > 0 ? (
          <div className="space-y-6">
            <h2 className="text-xl font-semibold">Detalle por Día</h2>
            {Object.entries(groupedRecords).map(([employeeId, data]: [string, any]) => (
              <Card key={employeeId}>
                <CardHeader>
                  <CardTitle>
                    {data.employee?.first_name} {data.employee?.last_name}
                  </CardTitle>
                  <CardDescription className="font-mono">
                    {data.employee?.employee_code}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {Object.entries(data.dates)
                      .sort(([a], [b]) => a.localeCompare(b))
                      .map(([date, dayRecords]: [string, any]) => (
                        <div
                          key={date}
                          className="flex items-center justify-between rounded-lg border p-3"
                        >
                          <div>
                            <p className="font-medium">
                              {format(new Date(date), 'EEEE, d MMMM', { locale: es })}
                            </p>
                            <div className="flex gap-4 text-sm text-muted-foreground mt-1">
                              {dayRecords.map((record: any, idx: number) => (
                                <span key={idx}>
                                  {record.event_type === 'entry' ? '🟢' : '🔴'}{' '}
                                  {format(new Date(record.timestamp), 'HH:mm')}
                                </span>
                              ))}
                            </div>
                          </div>
                          <div className="text-right">
                            <p className="font-mono font-medium">
                              {formatMinutes(calculateHours(dayRecords))}
                            </p>
                          </div>
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
              <FileText className="h-12 w-12 text-muted-foreground mb-4" />
              <p className="text-muted-foreground">
                No hay registros para el período seleccionado
              </p>
            </CardContent>
          </Card>
        )}
      </div>
    </AppLayout>
  );
}
