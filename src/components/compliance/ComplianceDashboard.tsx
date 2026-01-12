import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useCompany } from '@/hooks/useCompany';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { TrafficLight } from './TrafficLight';
import { ComplianceKPICard } from './ComplianceKPICard';
import { ViolationsSummary } from './ViolationsSummary';
import { RecentViolations } from './RecentViolations';
import { ModuleStatusCard } from './ModuleStatusCard';
import { ProtocolReportPanel } from './ProtocolReportPanel';
import { Link } from 'react-router-dom';
import { 
  AlertTriangle, 
  Clock, 
  RefreshCw, 
  Shield, 
  TrendingUp, 
  FileArchive, 
  Calendar,
  Play,
  Database,
  Zap
} from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { format } from 'date-fns';

const MODULE_DEFINITIONS = [
  { number: '1-5', key: '1-5_labor_limits', title: 'Labor Limits', description: 'Daily/weekly hours, rest periods, breaks' },
  { number: '6', key: '6_night_work', title: 'Night Work', description: 'Nocturnal shift compliance' },
  { number: '7', key: '7_part_time', title: 'Part Time', description: 'Part-time contract rules' },
  { number: '8', key: '8_vacations', title: 'Vacations', description: 'Annual leave balances' },
  { number: '9', key: '9_absences', title: 'Absences', description: 'Absence requests & types' },
  { number: '10', key: '10_coverage', title: 'Coverage', description: 'Coverage rules' },
  { number: '11', key: '11_templates', title: 'Templates', description: 'Rule assignments' },
  { number: '12', key: '12_integrity_qtsp', title: 'Integrity/QTSP', description: 'Merkle roots & notarization' },
  { number: '13', key: '13_data_protection', title: 'Data Protection', description: 'Audit logging' },
  { number: '14', key: '14_certified_comms', title: 'Certified Comms', description: 'Compliance notifications' },
  { number: '15', key: '15_reporting', title: 'ITSS Reporting', description: 'ITSS packages' }
];

type ModuleStatus = 'passed' | 'pending' | 'failed' | 'loading' | 'unknown';

function getModuleStatus(results: Record<string, any> | null, moduleKey: string): ModuleStatus {
  if (!results) return 'unknown';
  
  const moduleData = results.modules?.[moduleKey] || results[moduleKey];
  if (!moduleData) return 'unknown';
  
  // Check for explicit status field
  if (moduleData.status) {
    const status = String(moduleData.status).toLowerCase();
    if (['passed', 'success', 'ok'].includes(status)) return 'passed';
    if (['pending', 'waiting', 'no_data'].includes(status)) return 'pending';
    if (['failed', 'error'].includes(status)) return 'failed';
  }
  
  // Check for count-based status
  if (typeof moduleData.count === 'number') {
    return moduleData.count > 0 ? 'passed' : 'pending';
  }
  
  // Check for violations/errors
  if (moduleData.violations?.length > 0 || moduleData.errors?.length > 0) {
    return 'failed';
  }
  
  // Check for data presence
  if (moduleData.data?.length > 0 || moduleData.records?.length > 0) {
    return 'passed';
  }
  
  // Default to passed if we have any data
  if (Object.keys(moduleData).length > 0) {
    return 'passed';
  }
  
  return 'pending';
}

function getModuleDetails(results: Record<string, any> | null, moduleKey: string): Record<string, any> | undefined {
  if (!results) return undefined;
  return results.modules?.[moduleKey] || results[moduleKey];
}

export function ComplianceDashboard() {
  const { company } = useCompany();
  const [isEvaluating, setIsEvaluating] = useState(false);
  const [isRunningProtocol, setIsRunningProtocol] = useState(false);
  const [isSeedingData, setIsSeedingData] = useState(false);
  const [protocolResults, setProtocolResults] = useState<Record<string, any> | null>(null);

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

  const seedTestData = async () => {
    if (!company?.id) {
      toast.error('No company context available');
      return;
    }
    
    setIsSeedingData(true);
    try {
      const { data, error } = await supabase.functions.invoke('seed-compliance-data', {
        body: { company_id: company.id }
      });

      if (error) throw error;
      
      toast.success('Test data seeded successfully');
      console.log('Seed results:', data);
      refetch();
    } catch (error) {
      console.error('Error seeding data:', error);
      toast.error('Error seeding test data');
    } finally {
      setIsSeedingData(false);
    }
  };

  const runProtocol = async () => {
    if (!company?.id) {
      toast.error('No company context available');
      return;
    }
    
    setIsRunningProtocol(true);
    setProtocolResults(null);
    
    try {
      const today = format(new Date(), 'yyyy-MM-dd');
      
      const { data, error } = await supabase.functions.invoke('run-compliance-tests', {
        body: { company_id: company.id, test_date: today }
      });

      if (error) throw error;
      
      setProtocolResults({
        ...data,
        executed_at: new Date().toISOString()
      });
      
      toast.success('Protocol verification completed');
    } catch (error) {
      console.error('Error running protocol:', error);
      toast.error('Error running compliance protocol');
    } finally {
      setIsRunningProtocol(false);
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
            onClick={seedTestData}
            disabled={isSeedingData}
            className="border-amber-500/30 hover:bg-amber-500/10"
          >
            <Database className={`mr-2 h-4 w-4 ${isSeedingData ? 'animate-pulse' : ''}`} />
            {isSeedingData ? 'Seeding...' : 'Seed Test Data'}
          </Button>
          <Button 
            onClick={runProtocol}
            disabled={isRunningProtocol}
            className="bg-primary/90 hover:bg-primary"
          >
            <Play className={`mr-2 h-4 w-4 ${isRunningProtocol ? 'animate-pulse' : ''}`} />
            {isRunningProtocol ? 'Running...' : 'Run Protocol'}
          </Button>
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
              Calendario
            </Link>
          </Button>
          <Button asChild>
            <Link to="/admin/itss-package">
              <FileArchive className="mr-2 h-4 w-4" />
              ITSS Package
            </Link>
          </Button>
          <Button asChild variant="secondary">
            <Link to="/admin/compliance/incidents">
              <AlertTriangle className="mr-2 h-4 w-4" />
              Incidencias
            </Link>
          </Button>
        </div>
      </div>

      {/* Module Status Grid */}
      <Card className="backdrop-blur-md bg-card/50 border-border/50">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Zap className="h-5 w-5 text-primary" />
            15-Module Compliance Status
          </CardTitle>
          <CardDescription>
            {protocolResults 
              ? `Last run: ${format(new Date(protocolResults.executed_at), 'PPp')}`
              : 'Click "Run Protocol" to verify all modules'
            }
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
            {MODULE_DEFINITIONS.map(module => (
              <ModuleStatusCard
                key={module.key}
                moduleNumber={module.number}
                title={module.title}
                description={module.description}
                status={isRunningProtocol ? 'loading' : getModuleStatus(protocolResults, module.key)}
                details={getModuleDetails(protocolResults, module.key)}
              />
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Protocol Report Panel */}
      <ProtocolReportPanel report={protocolResults} loading={isRunningProtocol} />

      {/* Traffic Light and Main Status */}
      <div className="grid gap-6 md:grid-cols-3">
        <Card className="md:col-span-1 backdrop-blur-md bg-card/50 border-border/50">
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
