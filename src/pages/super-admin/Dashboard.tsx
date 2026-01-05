import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { SuperAdminLayout } from "@/components/layout/SuperAdminLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Building2, Users, Clock, Shield, AlertTriangle, CheckCircle, Activity } from "lucide-react";
import { format, subDays, startOfDay } from "date-fns";
import { es } from "date-fns/locale";

export default function SuperAdminDashboard() {
  // Get all companies
  const { data: companies } = useQuery({
    queryKey: ['super-admin-companies'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('company')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  // Get all employees count per company
  const { data: employeeCounts } = useQuery({
    queryKey: ['super-admin-employee-counts'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('employees')
        .select('company_id, status');
      if (error) throw error;
      
      const counts: Record<string, { total: number; active: number }> = {};
      data.forEach((emp) => {
        if (!emp.company_id) return;
        if (!counts[emp.company_id]) {
          counts[emp.company_id] = { total: 0, active: 0 };
        }
        counts[emp.company_id].total++;
        if (emp.status === 'active') counts[emp.company_id].active++;
      });
      return counts;
    },
  });

  // Get time events from last 7 days
  const { data: recentEvents } = useQuery({
    queryKey: ['super-admin-recent-events'],
    queryFn: async () => {
      const sevenDaysAgo = startOfDay(subDays(new Date(), 7)).toISOString();
      const { data, error } = await supabase
        .from('time_events')
        .select('company_id, timestamp')
        .gte('timestamp', sevenDaysAgo);
      if (error) throw error;
      
      const counts: Record<string, number> = {};
      data.forEach((event) => {
        if (!event.company_id) return;
        counts[event.company_id] = (counts[event.company_id] || 0) + 1;
      });
      return { total: data.length, byCompany: counts };
    },
  });

  // Get QTSP evidence stats
  const { data: evidenceStats } = useQuery({
    queryKey: ['super-admin-evidence-stats'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('dt_evidences')
        .select('status');
      if (error) throw error;
      
      const stats = { total: 0, completed: 0, failed: 0, pending: 0 };
      data.forEach((ev) => {
        stats.total++;
        if (ev.status === 'completed') stats.completed++;
        else if (ev.status === 'failed') stats.failed++;
        else stats.pending++;
      });
      return stats;
    },
  });

  // Get user counts
  const { data: userStats } = useQuery({
    queryKey: ['super-admin-user-stats'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('user_roles')
        .select('role');
      if (error) throw error;
      
      const counts: Record<string, number> = { super_admin: 0, admin: 0, responsible: 0, employee: 0 };
      data.forEach((ur) => {
        counts[ur.role] = (counts[ur.role] || 0) + 1;
      });
      return counts;
    },
  });

  const totalEmployees = employeeCounts 
    ? Object.values(employeeCounts).reduce((sum, c) => sum + c.total, 0) 
    : 0;
  
  const activeEmployees = employeeCounts 
    ? Object.values(employeeCounts).reduce((sum, c) => sum + c.active, 0) 
    : 0;

  return (
    <SuperAdminLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Shield className="w-6 h-6 text-destructive" />
            Panel Super Admin
          </h1>
          <p className="text-muted-foreground">
            Vista global de toda la plataforma
          </p>
        </div>

        {/* Main Stats */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Empresas</CardTitle>
              <Building2 className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{companies?.length || 0}</div>
              <p className="text-xs text-muted-foreground">
                Empresas registradas
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Empleados</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{totalEmployees}</div>
              <p className="text-xs text-muted-foreground">
                {activeEmployees} activos
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Fichajes (7 días)</CardTitle>
              <Clock className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{recentEvents?.total || 0}</div>
              <p className="text-xs text-muted-foreground">
                Eventos registrados
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Evidencias QTSP</CardTitle>
              <Shield className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{evidenceStats?.total || 0}</div>
              <p className="text-xs text-muted-foreground">
                {evidenceStats?.completed || 0} completadas, {evidenceStats?.failed || 0} fallidas
              </p>
            </CardContent>
          </Card>
        </div>

        {/* User Roles Overview */}
        <Card>
          <CardHeader>
            <CardTitle>Distribución de Roles</CardTitle>
            <CardDescription>Usuarios por tipo de rol en la plataforma</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-4">
              <div className="flex items-center gap-3 p-4 rounded-lg bg-destructive/10">
                <Shield className="h-8 w-8 text-destructive" />
                <div>
                  <p className="text-2xl font-bold">{userStats?.super_admin || 0}</p>
                  <p className="text-sm text-muted-foreground">Super Admins</p>
                </div>
              </div>
              <div className="flex items-center gap-3 p-4 rounded-lg bg-primary/10">
                <Users className="h-8 w-8 text-primary" />
                <div>
                  <p className="text-2xl font-bold">{userStats?.admin || 0}</p>
                  <p className="text-sm text-muted-foreground">Admins</p>
                </div>
              </div>
              <div className="flex items-center gap-3 p-4 rounded-lg bg-blue-500/10">
                <Activity className="h-8 w-8 text-blue-500" />
                <div>
                  <p className="text-2xl font-bold">{userStats?.responsible || 0}</p>
                  <p className="text-sm text-muted-foreground">Responsables</p>
                </div>
              </div>
              <div className="flex items-center gap-3 p-4 rounded-lg bg-green-500/10">
                <Users className="h-8 w-8 text-green-500" />
                <div>
                  <p className="text-2xl font-bold">{userStats?.employee || 0}</p>
                  <p className="text-sm text-muted-foreground">Empleados</p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Companies Overview */}
        <Card>
          <CardHeader>
            <CardTitle>Empresas Recientes</CardTitle>
            <CardDescription>Últimas empresas registradas en la plataforma</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {companies?.slice(0, 5).map((company) => (
                <div key={company.id} className="flex items-center justify-between p-4 border rounded-lg">
                  <div className="flex items-center gap-3">
                    <Building2 className="h-8 w-8 text-muted-foreground" />
                    <div>
                      <p className="font-medium">{company.name}</p>
                      <p className="text-sm text-muted-foreground">
                        {company.cif || 'Sin CIF'} • {company.city || 'Sin ciudad'}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <Badge variant="outline">
                      {employeeCounts?.[company.id]?.active || 0} empleados activos
                    </Badge>
                    <p className="text-xs text-muted-foreground mt-1">
                      {recentEvents?.byCompany[company.id] || 0} fichajes (7d)
                    </p>
                  </div>
                </div>
              ))}
              {(!companies || companies.length === 0) && (
                <p className="text-center text-muted-foreground py-8">
                  No hay empresas registradas
                </p>
              )}
            </div>
          </CardContent>
        </Card>

        {/* QTSP Health */}
        {evidenceStats && evidenceStats.failed > 0 && (
          <Card className="border-destructive">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-destructive">
                <AlertTriangle className="h-5 w-5" />
                Alertas QTSP
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm">
                Hay <strong>{evidenceStats.failed}</strong> evidencias QTSP que han fallado y requieren atención.
              </p>
            </CardContent>
          </Card>
        )}
      </div>
    </SuperAdminLayout>
  );
}
