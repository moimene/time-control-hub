import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useCompany } from '@/hooks/useCompany';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { TrafficLight } from './TrafficLight';
import { ComplianceKPICard } from './ComplianceKPICard';
import { ViolationsSummary } from './ViolationsSummary';
import { RecentViolations } from './RecentViolations';
import { Link } from 'react-router-dom';
import { AlertTriangle, CheckCircle2, Clock, RefreshCw, Shield, TrendingUp, FileArchive, Calendar } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { format, subDays, startOfYear } from 'date-fns';
import { es } from 'date-fns/locale';

export function ComplianceDashboard() {
  const { company } = useCompany();
  const [isEvaluating, setIsEvaluating] = useState(false);

  // Fetch violations summary
  const { data: violations, isLoading: violationsLoading, refetch } = useQuery({
    queryKey: ['compliance-violations', company?.id],
    queryFn: async () => {
      if (!company?.id) return { open: [], resolved: [] };
      
      const { data, error } = await supabase
        .from('compliance_violations')
        .select('*, employees(first_name, last_name, employee_code)')
        .eq('company_id', company.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      
      const open = data?.filter(v => v.status === 'open') || [];
      const resolved = data?.filter(v => v.status === 'resolved') || [];
      
      return { open, resolved, all: data || [] };
    },
    enabled: !!company?.id
  });

  // Fetch incidents summary
  const { data: incidents, isLoading: incidentsLoading } = useQuery({
    queryKey: ['compliance-incidents', company?.id],
    queryFn: async () => {
      if (!company?.id) return { open: 0, inProgress: 0, resolved: 0 };
      
      const { data, error } = await supabase
        .from('compliance_incidents')
        .select('status')
        .eq('company_id', company.id);

      if (error) throw error;
      
      return {
        open: data?.filter(i => i.status === 'open').length || 0,
        inProgress: data?.filter(i => i.status === 'in_progress' || i.status === 'acknowledged').length || 0,
        resolved: data?.filter(i => i.status === 'resolved' || i.status === 'closed').length || 0
      };
    },
    enabled: !!company?.id
  });

  // Calculate KPIs
  const openViolations = violations?.open || [];
  const criticalCount = openViolations.filter(v => v.severity === 'critical').length;
  const warnCount = openViolations.filter(v => v.severity === 'warn').length;

  // Calculate overtime YTD percentage (approximation based on violations)
  const overtimeViolations = openViolations.filter(v => 
    v.rule_code.startsWith('OVERTIME_YTD')
  );
  const maxOvertimePercent = overtimeViolations.reduce((max, v) => {
    const evidence = v.evidence_json as Record<string, unknown>;
    const percent = (evidence?.percentage as number) || 0;
    return Math.max(max, percent);
  }, 0);

  // Determine traffic light status
  const getOverallStatus = (): 'green' | 'yellow' | 'red' => {
    if (criticalCount > 0) return 'red';
    if (warnCount > 2 || maxOvertimePercent > 75) return 'yellow';
    return 'green';
  };

  const runEvaluation = async () => {
    if (!company?.id) return;
    
    setIsEvaluating(true);
    try {
      const today = format(new Date(), 'yyyy-MM-dd');
      
      const { data, error } = await supabase.functions.invoke('compliance-evaluator', {
        body: { company_id: company.id, date: today }
      });

      if (error) throw error;
      
      toast.success(`Evaluación completada: ${data.violations_found} incidencias encontradas`);
      refetch();
    } catch (error) {
      console.error('Error running evaluation:', error);
      toast.error('Error al ejecutar la evaluación');
    } finally {
      setIsEvaluating(false);
    }
  };

  const isLoading = violationsLoading || incidentsLoading;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Cumplimiento Normativo</h1>
          <p className="text-muted-foreground">
            Monitor de cumplimiento de la normativa laboral
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button 
            variant="outline" 
            onClick={runEvaluation}
            disabled={isEvaluating}
          >
            <RefreshCw className={`mr-2 h-4 w-4 ${isEvaluating ? 'animate-spin' : ''}`} />
            {isEvaluating ? 'Evaluando...' : 'Evaluar Ahora'}
          </Button>
          <Button asChild variant="outline">
            <Link to="/admin/calendar-laboral">
              <Calendar className="mr-2 h-4 w-4" />
              Calendario Laboral
            </Link>
          </Button>
          <Button asChild>
            <Link to="/admin/itss-package">
              <FileArchive className="mr-2 h-4 w-4" />
              Generar Paquete ITSS
            </Link>
          </Button>
          <Button asChild variant="secondary">
            <Link to="/admin/compliance/incidents">
              <AlertTriangle className="mr-2 h-4 w-4" />
              Ver Incidencias
            </Link>
          </Button>
        </div>
      </div>

      {/* Traffic Light and Main Status */}
      <div className="grid gap-6 md:grid-cols-3">
        <Card className="md:col-span-1">
          <CardHeader className="pb-2">
            <CardTitle className="text-lg">Estado General</CardTitle>
            <CardDescription>Cumplimiento normativo actual</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col items-center justify-center py-6">
            {isLoading ? (
              <Skeleton className="h-32 w-32 rounded-full" />
            ) : (
              <TrafficLight status={getOverallStatus()} size="lg" />
            )}
            <p className="mt-4 text-center text-sm text-muted-foreground">
              {getOverallStatus() === 'green' && 'Sin alertas críticas'}
              {getOverallStatus() === 'yellow' && 'Atención requerida'}
              {getOverallStatus() === 'red' && 'Acción inmediata necesaria'}
            </p>
          </CardContent>
        </Card>

        <div className="grid gap-4 md:col-span-2 md:grid-cols-2">
          <ComplianceKPICard
            title="Incidencias Críticas"
            value={criticalCount}
            description="Requieren acción inmediata"
            icon={<AlertTriangle className="h-4 w-4" />}
            status={criticalCount > 0 ? 'red' : 'green'}
            loading={isLoading}
          />
          <ComplianceKPICard
            title="Advertencias"
            value={warnCount}
            description="Monitoreo requerido"
            icon={<Clock className="h-4 w-4" />}
            status={warnCount > 2 ? 'yellow' : 'green'}
            loading={isLoading}
          />
          <ComplianceKPICard
            title="Horas Extra YTD"
            value={`${maxOvertimePercent}%`}
            description="del límite legal (80h)"
            icon={<TrendingUp className="h-4 w-4" />}
            status={maxOvertimePercent > 90 ? 'red' : maxOvertimePercent > 75 ? 'yellow' : 'green'}
            loading={isLoading}
          />
          <ComplianceKPICard
            title="Incidencias Abiertas"
            value={incidents?.open || 0}
            description={`${incidents?.inProgress || 0} en progreso`}
            icon={<Shield className="h-4 w-4" />}
            status={(incidents?.open || 0) > 3 ? 'red' : (incidents?.open || 0) > 0 ? 'yellow' : 'green'}
            loading={isLoading}
          />
        </div>
      </div>

      {/* Violations Summary by Rule */}
      <ViolationsSummary violations={violations?.open || []} loading={isLoading} />

      {/* Recent Violations */}
      <RecentViolations violations={violations?.open?.slice(0, 10) || []} loading={isLoading} />
    </div>
  );
}
