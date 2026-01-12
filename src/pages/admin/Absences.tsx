import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { AppLayout } from '@/components/layout/AppLayout';
import { useCompany } from '@/hooks/useCompany';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { 
  Calendar, 
  ClipboardList, 
  Settings2, 
  Clock,
  Users,
  FileText
} from 'lucide-react';
import { AbsenceApprovalPanel } from '@/components/admin/AbsenceApprovalPanel';
import { AbsenceTypesCatalog } from '@/components/admin/AbsenceTypesCatalog';
import { TeamCalendarView } from '@/components/admin/TeamCalendarView';

export default function AdminAbsences() {
  const { company } = useCompany();

  // Stats query
  const { data: stats } = useQuery({
    queryKey: ['absence-stats', company?.id],
    queryFn: async () => {
      if (!company?.id) return null;
      
      const [pendingRes, typesRes, thisMonthRes] = await Promise.all([
        supabase
          .from('absence_requests')
          .select('id', { count: 'exact', head: true })
          .eq('company_id', company.id)
          .eq('status', 'pending'),
        supabase
          .from('absence_types')
          .select('id', { count: 'exact', head: true })
          .eq('company_id', company.id)
          .eq('is_active', true),
        supabase
          .from('absence_requests')
          .select('id', { count: 'exact', head: true })
          .eq('company_id', company.id)
          .eq('status', 'approved')
          .gte('start_date', new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0])
          .lte('end_date', new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0).toISOString().split('T')[0])
      ]);

      return {
        pending: pendingRes.count || 0,
        activeTypes: typesRes.count || 0,
        thisMonth: thisMonthRes.count || 0
      };
    },
    enabled: !!company?.id,
  });


  return (
    <AppLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Gestión de Ausencias</h1>
          <p className="text-muted-foreground">
            Gestiona solicitudes, catálogo de tipos y calendario del equipo
          </p>
        </div>

        {/* Stats Cards */}
        <div className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Pendientes</CardTitle>
              <Clock className="h-4 w-4 text-yellow-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats?.pending || 0}</div>
              <p className="text-xs text-muted-foreground">Solicitudes por aprobar</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Este Mes</CardTitle>
              <Calendar className="h-4 w-4 text-blue-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats?.thisMonth || 0}</div>
              <p className="text-xs text-muted-foreground">Ausencias aprobadas</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Tipos Activos</CardTitle>
              <FileText className="h-4 w-4 text-green-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats?.activeTypes || 0}</div>
              <p className="text-xs text-muted-foreground">En el catálogo</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Cobertura</CardTitle>
              <Users className="h-4 w-4 text-purple-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">100%</div>
              <p className="text-xs text-muted-foreground">Equipo disponible</p>
            </CardContent>
          </Card>
        </div>

        {/* Main Tabs */}
        <Tabs defaultValue="pending" className="space-y-4">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="pending" className="flex items-center gap-2">
              <ClipboardList className="h-4 w-4" />
              Solicitudes
              {(stats?.pending || 0) > 0 && (
                <Badge variant="secondary" className="ml-1">
                  {stats?.pending}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="catalog" className="flex items-center gap-2">
              <Settings2 className="h-4 w-4" />
              Catálogo
            </TabsTrigger>
            <TabsTrigger value="calendar" className="flex items-center gap-2">
              <Users className="h-4 w-4" />
              Calendario Equipo
            </TabsTrigger>
          </TabsList>

          <TabsContent value="pending">
            <AbsenceApprovalPanel />
          </TabsContent>

          <TabsContent value="catalog">
            <AbsenceTypesCatalog />
          </TabsContent>

          <TabsContent value="calendar">
            <TeamCalendarView />
          </TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  );
}
