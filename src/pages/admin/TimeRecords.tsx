import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { AppLayout } from '@/components/layout/AppLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { CalendarIcon, Download, Search, AlertTriangle } from 'lucide-react';
import { format, startOfDay, endOfDay, subDays } from 'date-fns';
import { es } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { useCompany } from '@/hooks/useCompany';
import { useTimeEventInconsistencies } from '@/hooks/useTimeEventInconsistencies';
import { InconsistencyAlert } from '@/components/admin/InconsistencyAlert';
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

const overrideReasonLabels: Record<string, string> = {
  forgot_mark: 'Olvidé fichar',
  system_error: 'Error del sistema',
  authorized_exception: 'Excepción autorizada',
  other: 'Otro motivo',
};

export default function TimeRecords() {
  const [dateRange, setDateRange] = useState<{ from: Date; to: Date }>({
    from: subDays(new Date(), 7),
    to: new Date(),
  });
  const [search, setSearch] = useState('');
  const [eventType, setEventType] = useState<string>('all');
  const { company } = useCompany();

  const { data: records, isLoading } = useQuery({
    queryKey: ['time-records', dateRange, eventType, company?.id],
    enabled: !!company?.id,
    queryFn: async () => {
      let query = supabase
        .from('time_events')
        .select('*, employees(first_name, last_name, employee_code)')
        .eq('company_id', company!.id)
        .gte('timestamp', startOfDay(dateRange.from).toISOString())
        .lte('timestamp', endOfDay(dateRange.to).toISOString())
        .order('timestamp', { ascending: false });

      if (eventType !== 'all') {
        query = query.eq('event_type', eventType as 'entry' | 'exit');
      }

      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
  });

  const { inconsistencies, hasInconsistencies } = useTimeEventInconsistencies(records);

  const filteredRecords = useMemo(() => {
    // Optimization: Memoize filtering to prevent recalculation on every render.
    // Hoist toLowerCase() outside the loop to avoid O(n) redundant operations.
    if (!records) return [];
    if (!search) return records;

    const searchLower = search.toLowerCase();
    return records.filter((record: any) => {
      const firstName = record.employees?.first_name?.toLowerCase() || '';
      const lastName = record.employees?.last_name?.toLowerCase() || '';
      const code = record.employees?.employee_code?.toLowerCase() || '';

      return (
        firstName.includes(searchLower) ||
        lastName.includes(searchLower) ||
        code.includes(searchLower)
      );
    });
  }, [records, search]);

  const exportCSV = () => {
    if (!filteredRecords) return;

    const headers = ['Código', 'Nombre', 'Tipo', 'Fecha', 'Hora', 'Origen'];
    const rows = filteredRecords.map((record: any) => [
      record.employees?.employee_code,
      `${record.employees?.first_name} ${record.employees?.last_name}`,
      eventTypeLabels[record.event_type as EventType],
      format(new Date(record.timestamp), 'dd/MM/yyyy'),
      format(new Date(record.timestamp), 'HH:mm:ss'),
      eventSourceLabels[record.event_source as EventSource],
    ]);

    const csv = [headers, ...rows].map((row) => row.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `fichajes_${format(dateRange.from, 'yyyyMMdd')}_${format(dateRange.to, 'yyyyMMdd')}.csv`;
    a.click();
  };

  return (
    <AppLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Registros de Jornada</h1>
            <p className="text-muted-foreground">Historial de fichajes de empleados</p>
          </div>
          <Button variant="outline" onClick={exportCSV}>
            <Download className="mr-2 h-4 w-4" />
            Exportar CSV
          </Button>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-4">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Buscar empleado..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>

          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" className={cn("justify-start text-left font-normal")}>
                <CalendarIcon className="mr-2 h-4 w-4" />
                {format(dateRange.from, 'dd/MM/yyyy', { locale: es })} -{' '}
                {format(dateRange.to, 'dd/MM/yyyy', { locale: es })}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar
                mode="range"
                selected={{ from: dateRange.from, to: dateRange.to }}
                onSelect={(range) => {
                  if (range?.from && range?.to) {
                    setDateRange({ from: range.from, to: range.to });
                  }
                }}
                locale={es}
              />
            </PopoverContent>
          </Popover>

          <Select value={eventType} onValueChange={setEventType}>
            <SelectTrigger className="w-40">
              <SelectValue placeholder="Tipo" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              <SelectItem value="entry">Entradas</SelectItem>
              <SelectItem value="exit">Salidas</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Inconsistency Alert */}
        {hasInconsistencies && (
          <InconsistencyAlert inconsistencies={inconsistencies} />
        )}

        {/* Table */}
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Empleado</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead>Fecha</TableHead>
                <TableHead>Hora</TableHead>
                <TableHead>Origen</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-8">
                    Cargando...
                  </TableCell>
                </TableRow>
              ) : filteredRecords?.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                    No hay registros en el período seleccionado
                  </TableCell>
                </TableRow>
              ) : (
                filteredRecords?.map((record: any) => {
                  const overrideReason = record.raw_payload?.override_reason;
                  return (
                    <TableRow key={record.id}>
                      <TableCell>
                        <div>
                          <p className="font-medium">
                            {record.employees?.first_name} {record.employees?.last_name}
                          </p>
                          <p className="text-sm text-muted-foreground font-mono">
                            {record.employees?.employee_code}
                          </p>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <div
                            className={cn(
                              'h-2 w-2 rounded-full',
                              record.event_type === 'entry' ? 'bg-green-500' : 'bg-red-500'
                            )}
                          />
                          {eventTypeLabels[record.event_type as EventType]}
                          {overrideReason && (
                            <TooltipProvider>
                              <Tooltip>
                                <TooltipTrigger>
                                  <Badge variant="outline" className="ml-1 gap-1 text-amber-600 border-amber-300 bg-amber-50">
                                    <AlertTriangle className="h-3 w-3" />
                                    Override
                                  </Badge>
                                </TooltipTrigger>
                                <TooltipContent>
                                  <p className="font-medium">Fichaje con override</p>
                                  <p className="text-sm text-muted-foreground">
                                    {overrideReasonLabels[overrideReason] || overrideReason}
                                  </p>
                                </TooltipContent>
                              </Tooltip>
                            </TooltipProvider>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        {format(new Date(record.timestamp), 'dd/MM/yyyy')}
                      </TableCell>
                      <TableCell className="font-mono">
                        {format(new Date(record.timestamp), 'HH:mm:ss')}
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary">
                          {eventSourceLabels[record.event_source as EventSource]}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </div>
      </div>
    </AppLayout>
  );
}
