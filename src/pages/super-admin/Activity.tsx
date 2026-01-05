import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { SuperAdminLayout } from "@/components/layout/SuperAdminLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Activity, Building2, Clock, Users, Shield, Loader2 } from "lucide-react";
import { format } from "date-fns";
import { es } from "date-fns/locale";

export default function SuperAdminActivity() {
  const [companyFilter, setCompanyFilter] = useState<string>("all");

  const { data: companies } = useQuery({
    queryKey: ['super-admin-companies-activity'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('company')
        .select('id, name')
        .order('name');
      if (error) throw error;
      return data;
    },
  });

  const { data: auditLogs, isLoading } = useQuery({
    queryKey: ['super-admin-audit-logs', companyFilter],
    queryFn: async () => {
      let query = supabase
        .from('audit_log')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(100);
      
      if (companyFilter !== 'all') {
        query = query.eq('company_id', companyFilter);
      }
      
      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
  });

  const { data: qtspLogs } = useQuery({
    queryKey: ['super-admin-qtsp-logs', companyFilter],
    queryFn: async () => {
      let query = supabase
        .from('qtsp_audit_log')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(50);
      
      if (companyFilter !== 'all') {
        query = query.eq('company_id', companyFilter);
      }
      
      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
  });

  const getCompanyName = (companyId: string | null) => {
    if (!companyId) return '-';
    return companies?.find(c => c.id === companyId)?.name || 'Desconocida';
  };

  const getActionBadge = (action: string) => {
    const actionLower = action.toLowerCase();
    if (actionLower.includes('create') || actionLower.includes('insert')) {
      return <Badge variant="default">Crear</Badge>;
    }
    if (actionLower.includes('update') || actionLower.includes('edit')) {
      return <Badge variant="secondary">Actualizar</Badge>;
    }
    if (actionLower.includes('delete') || actionLower.includes('remove')) {
      return <Badge variant="destructive">Eliminar</Badge>;
    }
    if (actionLower.includes('approve')) {
      return <Badge className="bg-green-600">Aprobar</Badge>;
    }
    if (actionLower.includes('reject')) {
      return <Badge variant="destructive">Rechazar</Badge>;
    }
    return <Badge variant="outline">{action}</Badge>;
  };

  const getEntityIcon = (entityType: string) => {
    switch (entityType.toLowerCase()) {
      case 'employee':
        return <Users className="h-4 w-4" />;
      case 'company':
        return <Building2 className="h-4 w-4" />;
      case 'time_event':
        return <Clock className="h-4 w-4" />;
      case 'correction_request':
        return <Activity className="h-4 w-4" />;
      default:
        return <Activity className="h-4 w-4" />;
    }
  };

  return (
    <SuperAdminLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Activity className="w-6 h-6" />
              Actividad Global
            </h1>
            <p className="text-muted-foreground">
              Registro de actividad de todas las empresas
            </p>
          </div>
          <Select value={companyFilter} onValueChange={setCompanyFilter}>
            <SelectTrigger className="w-[200px]">
              <SelectValue placeholder="Filtrar por empresa" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas las empresas</SelectItem>
              {companies?.map((company) => (
                <SelectItem key={company.id} value={company.id}>
                  {company.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* QTSP Activity */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Shield className="h-5 w-5" />
              Actividad QTSP
            </CardTitle>
            <CardDescription>
              Últimas operaciones con el servicio de timestamp cualificado
            </CardDescription>
          </CardHeader>
          <CardContent>
            {!qtspLogs || qtspLogs.length === 0 ? (
              <p className="text-center text-muted-foreground py-4">No hay registros QTSP</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Fecha</TableHead>
                    <TableHead>Empresa</TableHead>
                    <TableHead>Acción</TableHead>
                    <TableHead>Estado</TableHead>
                    <TableHead>Duración</TableHead>
                    <TableHead>Error</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {qtspLogs.slice(0, 10).map((log: any) => (
                    <TableRow key={log.id}>
                      <TableCell>
                        {format(new Date(log.created_at), 'dd/MM/yyyy HH:mm', { locale: es })}
                      </TableCell>
                      <TableCell>{getCompanyName(log.company_id)}</TableCell>
                      <TableCell>{log.action}</TableCell>
                      <TableCell>
                        <Badge variant={log.status === 'success' ? 'default' : log.status === 'failed' ? 'destructive' : 'secondary'}>
                          {log.status}
                        </Badge>
                      </TableCell>
                      <TableCell>{log.duration_ms ? `${log.duration_ms}ms` : '-'}</TableCell>
                      <TableCell className="text-xs text-destructive max-w-[200px] truncate">
                        {log.error_message || '-'}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        {/* General Audit Log */}
        <Card>
          <CardHeader>
            <CardTitle>Auditoría General</CardTitle>
            <CardDescription>
              Últimas acciones en el sistema
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex justify-center py-8">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </div>
            ) : !auditLogs || auditLogs.length === 0 ? (
              <p className="text-center text-muted-foreground py-4">No hay registros de auditoría</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Fecha</TableHead>
                    <TableHead>Empresa</TableHead>
                    <TableHead>Entidad</TableHead>
                    <TableHead>Acción</TableHead>
                    <TableHead>Actor</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {auditLogs.map((log: any) => (
                    <TableRow key={log.id}>
                      <TableCell>
                        {format(new Date(log.created_at), 'dd/MM/yyyy HH:mm', { locale: es })}
                      </TableCell>
                      <TableCell>{getCompanyName(log.company_id)}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          {getEntityIcon(log.entity_type)}
                          {log.entity_type}
                        </div>
                      </TableCell>
                      <TableCell>{getActionBadge(log.action)}</TableCell>
                      <TableCell>
                        <Badge variant="outline">{log.actor_type}</Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </SuperAdminLayout>
  );
}
