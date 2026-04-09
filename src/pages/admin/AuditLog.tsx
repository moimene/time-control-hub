import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { AppLayout } from '@/components/layout/AppLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { CalendarIcon, Search, Shield, FileText, Users, Download, CheckCircle, XCircle, Edit, AlertTriangle, Mail } from 'lucide-react';
import { format, subDays } from 'date-fns';
import { es } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { useCompany } from '@/hooks/useCompany';

const actionLabels: Record<string, { label: string; icon: React.ReactNode; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
  create: { label: 'Crear', icon: <FileText className="h-3 w-3" />, variant: 'default' },
  update: { label: 'Actualizar', icon: <Edit className="h-3 w-3" />, variant: 'secondary' },
  delete: { label: 'Eliminar', icon: <XCircle className="h-3 w-3" />, variant: 'destructive' },
  approve: { label: 'Aprobar', icon: <CheckCircle className="h-3 w-3" />, variant: 'default' },
  reject: { label: 'Rechazar', icon: <XCircle className="h-3 w-3" />, variant: 'destructive' },
  export: { label: 'Exportar', icon: <Download className="h-3 w-3" />, variant: 'outline' },
  inconsistency_alert_sent: { label: 'Alerta Inconsistencia', icon: <AlertTriangle className="h-3 w-3" />, variant: 'destructive' },
  weekly_inconsistency_summary: { label: 'Resumen Semanal', icon: <Mail className="h-3 w-3" />, variant: 'secondary' },
};

const entityTypeLabels: Record<string, string> = {
  time_events: 'Fichajes',
  correction_request: 'Corrección',
  employee: 'Empleado',
  terminal: 'Terminal',
  notification: 'Notificación',
};

export default function AuditLog() {
  const [search, setSearch] = useState('');
  const [actionFilter, setActionFilter] = useState<string>('all');
  const [entityFilter, setEntityFilter] = useState<string>('all');
  const [dateRange, setDateRange] = useState<{ from: Date; to: Date }>({
    from: subDays(new Date(), 30),
    to: new Date(),
  });
  const { company } = useCompany();

  const { data: logs, isLoading } = useQuery({
    queryKey: ['audit-logs', dateRange, actionFilter, entityFilter, company?.id],
    enabled: !!company?.id,
    queryFn: async () => {
      let query = supabase
        .from('audit_log')
        .select('*')
        .eq('company_id', company!.id)
        .gte('created_at', dateRange.from.toISOString())
        .lte('created_at', dateRange.to.toISOString())
        .order('created_at', { ascending: false })
        .limit(500);

      if (actionFilter !== 'all') {
        query = query.eq('action', actionFilter);
      }
      if (entityFilter !== 'all') {
        query = query.eq('entity_type', entityFilter);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
  });

  const filteredLogs = useMemo(() => {
    if (!logs) return undefined;
    if (!search) return logs;

    // Optimization: Hoist toLowerCase() outside the loop
    const searchLower = search.toLowerCase();

    return logs.filter((log) => {
      return (
        log.action?.toLowerCase().includes(searchLower) ||
        log.entity_type?.toLowerCase().includes(searchLower) ||
        JSON.stringify(log.new_values)?.toLowerCase().includes(searchLower)
      );
    });
  }, [logs, search]);

  // Stats
  const stats = {
    total: filteredLogs?.length || 0,
    exports: filteredLogs?.filter(l => l.action === 'export').length || 0,
    corrections: filteredLogs?.filter(l => l.entity_type === 'correction_request').length || 0,
    employees: filteredLogs?.filter(l => l.entity_type === 'employee').length || 0,
  };

  return (
    <AppLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
            <Shield className="h-8 w-8" />
            Registro de Auditoría
          </h1>
          <p className="text-muted-foreground">
            Historial de operaciones y exportaciones del sistema
          </p>
        </div>

        {/* Stats Cards */}
        <div className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Registros</CardTitle>
              <FileText className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.total}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Exportaciones</CardTitle>
              <Download className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.exports}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Correcciones</CardTitle>
              <Edit className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.corrections}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Cambios Empleados</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.employees}</div>
            </CardContent>
          </Card>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-4">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Buscar en registros..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>

          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" className={cn("justify-start text-left font-normal")}>
                <CalendarIcon className="mr-2 h-4 w-4" />
                {format(dateRange.from, 'dd/MM/yy')} - {format(dateRange.to, 'dd/MM/yy')}
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
                numberOfMonths={2}
              />
            </PopoverContent>
          </Popover>

          <Select value={actionFilter} onValueChange={setActionFilter}>
            <SelectTrigger className="w-40">
              <SelectValue placeholder="Acción" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas las acciones</SelectItem>
              <SelectItem value="create">Crear</SelectItem>
              <SelectItem value="update">Actualizar</SelectItem>
              <SelectItem value="delete">Eliminar</SelectItem>
              <SelectItem value="approve">Aprobar</SelectItem>
              <SelectItem value="reject">Rechazar</SelectItem>
              <SelectItem value="export">Exportar</SelectItem>
              <SelectItem value="inconsistency_alert_sent">Alerta Inconsistencia</SelectItem>
              <SelectItem value="weekly_inconsistency_summary">Resumen Semanal</SelectItem>
            </SelectContent>
          </Select>

          <Select value={entityFilter} onValueChange={setEntityFilter}>
            <SelectTrigger className="w-40">
              <SelectValue placeholder="Entidad" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas las entidades</SelectItem>
              <SelectItem value="time_events">Fichajes</SelectItem>
              <SelectItem value="correction_request">Correcciones</SelectItem>
              <SelectItem value="employee">Empleados</SelectItem>
              <SelectItem value="terminal">Terminales</SelectItem>
              <SelectItem value="notification">Notificaciones</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Table */}
        <Card>
          <CardHeader>
            <CardTitle>Registros</CardTitle>
            <CardDescription>
              Mostrando {filteredLogs?.length || 0} registros
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex items-center justify-center py-12">
                <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
              </div>
            ) : filteredLogs && filteredLogs.length > 0 ? (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Fecha/Hora</TableHead>
                      <TableHead>Acción</TableHead>
                      <TableHead>Entidad</TableHead>
                      <TableHead>Actor</TableHead>
                      <TableHead>Detalles</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredLogs.map((log) => {
                      const actionInfo = actionLabels[log.action] || { 
                        label: log.action, 
                        icon: <FileText className="h-3 w-3" />, 
                        variant: 'outline' as const 
                      };
                      
                      return (
                        <TableRow key={log.id}>
                          <TableCell className="whitespace-nowrap">
                            <div>
                              <p className="font-medium">
                                {format(new Date(log.created_at), 'dd/MM/yyyy')}
                              </p>
                              <p className="text-sm text-muted-foreground">
                                {format(new Date(log.created_at), 'HH:mm:ss')}
                              </p>
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge variant={actionInfo.variant} className="flex items-center gap-1 w-fit">
                              {actionInfo.icon}
                              {actionInfo.label}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            {entityTypeLabels[log.entity_type] || log.entity_type}
                          </TableCell>
                          <TableCell>
                            <span className="capitalize">{log.actor_type}</span>
                          </TableCell>
                          <TableCell className="max-w-xs">
                            {log.action === 'export' && log.new_values && (
                              <div className="text-sm text-muted-foreground">
                                <p>Formato: {(log.new_values as any).format?.toUpperCase()}</p>
                                <p>Registros: {(log.new_values as any).record_count}</p>
                              </div>
                            )}
                            {log.action === 'approve' && (
                              <span className="text-sm text-green-600">Corrección aprobada</span>
                            )}
                            {log.action === 'reject' && (
                              <span className="text-sm text-red-600">Corrección rechazada</span>
                            )}
                            {log.action === 'create' && log.entity_type === 'employee' && log.new_values && (
                              <span className="text-sm text-muted-foreground">
                                {(log.new_values as any).first_name} {(log.new_values as any).last_name}
                              </span>
                            )}
                            {log.action === 'update' && log.entity_type === 'employee' && (
                              <span className="text-sm text-muted-foreground">Datos actualizados</span>
                            )}
                            {log.action === 'inconsistency_alert_sent' && log.new_values && (
                              <div className="text-sm text-muted-foreground">
                                <p>Enviado a: {(log.new_values as any).email_sent_to}</p>
                                <p>Inconsistencias: {(log.new_values as any).inconsistency_count}</p>
                              </div>
                            )}
                            {log.action === 'weekly_inconsistency_summary' && log.new_values && (
                              <div className="text-sm text-muted-foreground">
                                <p>Departamento: {(log.new_values as any).department}</p>
                                <p>Empleados afectados: {(log.new_values as any).employees_with_issues}</p>
                              </div>
                            )}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-12">
                <Shield className="h-12 w-12 text-muted-foreground mb-4" />
                <p className="text-muted-foreground">
                  No hay registros de auditoría para los filtros seleccionados
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
