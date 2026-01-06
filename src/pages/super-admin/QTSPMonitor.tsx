import { useState, useEffect, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { SuperAdminLayout } from "@/components/layout/SuperAdminLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { 
  Shield, 
  Building2, 
  Activity, 
  Wifi, 
  WifiOff, 
  RefreshCw, 
  Loader2, 
  CheckCircle, 
  AlertCircle,
  AlertTriangle,
  Bell
} from "lucide-react";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { toast } from "sonner";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine } from "recharts";

interface LatencyDataPoint {
  time: string;
  latency: number;
  status: 'healthy' | 'degraded' | 'unhealthy';
}

interface HealthCheckResult {
  status: 'healthy' | 'degraded' | 'unhealthy';
  auth: boolean;
  api: boolean;
  latency_ms: number;
  message: string;
}

interface CompanyQTSPStatus {
  company_id: string;
  company_name: string;
  case_file_id: string | null;
  evidence_groups_count: number;
  total_evidences: number;
  completed_evidences: number;
  failed_evidences: number;
  pending_evidences: number;
  last_evidence_date: string | null;
}

export default function QTSPMonitor() {
  const [lastHealthStatus, setLastHealthStatus] = useState<'healthy' | 'degraded' | 'unhealthy' | null>(null);
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);
  const [latencyHistory, setLatencyHistory] = useState<LatencyDataPoint[]>([]);
  const [consecutiveFailures, setConsecutiveFailures] = useState(0);
  const [lastAlertSent, setLastAlertSent] = useState<string | null>(null);

  // Update latency history when health check completes
  const updateLatencyHistory = useCallback((data: HealthCheckResult) => {
    setLatencyHistory(prev => {
      const newPoint: LatencyDataPoint = {
        time: format(new Date(), 'HH:mm:ss'),
        latency: data.latency_ms,
        status: data.status,
      };
      const updated = [...prev, newPoint];
      // Keep last 30 data points (15 minutes of data at 30s intervals)
      return updated.slice(-30);
    });
  }, []);

  // Global health check - auto-refresh every 30 seconds
  const { data: healthStatus, isLoading: loadingHealth, refetch: refetchHealth } = useQuery({
    queryKey: ['super-admin-qtsp-health'],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke('qtsp-notarize', {
        body: { action: 'health_check' },
      });
      if (error) throw error;
      return data as HealthCheckResult;
    },
    refetchInterval: 30000, // Every 30 seconds
    staleTime: 15000,
  });

  // Send email alert when consecutive failures reach threshold or on recovery
  const sendHealthAlert = useCallback(async (
    status: 'healthy' | 'degraded' | 'unhealthy',
    message: string,
    latency_ms: number,
    failures: number,
    alertType: 'failure' | 'recovery' = 'failure',
    downtimeMinutes?: number
  ) => {
    try {
      const { data, error } = await supabase.functions.invoke('qtsp-health-alert', {
        body: {
          status,
          message,
          latency_ms,
          timestamp: new Date().toISOString(),
          consecutive_failures: failures,
          alert_type: alertType,
          downtime_minutes: downtimeMinutes,
        },
      });
      
      if (error) {
        console.error('Error sending health alert:', error);
        return;
      }
      
      if (data?.sent) {
        setLastAlertSent(new Date().toISOString());
        const alertLabel = alertType === 'recovery' ? '✅ Recuperación' : '📧 Alerta';
        toast.info(`${alertLabel} enviada por email`, {
          description: `Notificados ${data.recipients} super admins`,
          duration: 5000,
        });
      }
    } catch (err) {
      console.error('Failed to send health alert:', err);
    }
  }, []);

  // Auto-notification when health status changes to degraded/unhealthy
  useEffect(() => {
    if (!healthStatus) return;

    // Track consecutive failures
    if (healthStatus.status !== 'healthy') {
      setConsecutiveFailures(prev => {
        const newCount = prev + 1;
        // Send email alert at threshold (10 failures = ~5 minutes)
        if (newCount === 10) {
          sendHealthAlert(
            healthStatus.status,
            healthStatus.message,
            healthStatus.latency_ms,
            newCount,
            'failure'
          );
        }
        return newCount;
      });
    } else {
      // Send recovery alert if we had significant failures before
      if (consecutiveFailures >= 10) {
        const downtimeMinutes = Math.round(consecutiveFailures * 0.5);
        sendHealthAlert(
          'healthy',
          'La conexión con Digital Trust se ha restablecido',
          healthStatus.latency_ms,
          0,
          'recovery',
          downtimeMinutes
        );
      }
      // Reset counter when healthy
      setConsecutiveFailures(0);
    }

    if (!notificationsEnabled) return;

    if (lastHealthStatus !== null && lastHealthStatus !== healthStatus.status) {
      if (healthStatus.status === 'unhealthy') {
        toast.error('⚠️ API QTSP No Disponible', {
          description: healthStatus.message,
          duration: 10000,
        });
        // Try to send browser notification if permitted
        if ('Notification' in window && Notification.permission === 'granted') {
          new Notification('🚨 API QTSP Caída', {
            body: healthStatus.message,
            icon: '/favicon.ico',
          });
        }
      } else if (healthStatus.status === 'degraded') {
        toast.warning('⚠️ API QTSP Degradada', {
          description: healthStatus.message,
          duration: 8000,
        });
      } else if (healthStatus.status === 'healthy' && lastHealthStatus !== 'healthy') {
        toast.success('✅ API QTSP Recuperada', {
          description: 'La conexión con Digital Trust se ha restablecido',
          duration: 5000,
        });
      }
    }

    setLastHealthStatus(healthStatus.status);
  }, [healthStatus, lastHealthStatus, notificationsEnabled, sendHealthAlert]);

  // Update latency history when health check completes
  useEffect(() => {
    if (healthStatus) {
      updateLatencyHistory(healthStatus);
    }
  }, [healthStatus, updateLatencyHistory]);

  // Request notification permission on mount
  useEffect(() => {
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission();
    }
  }, []);

  // Get all companies with QTSP status
  const { data: companiesStatus, isLoading: loadingCompanies, refetch: refetchCompanies } = useQuery({
    queryKey: ['super-admin-qtsp-companies'],
    queryFn: async () => {
      // Get all companies
      const { data: companies, error: companiesError } = await supabase
        .from('company')
        .select('id, name')
        .order('name');
      if (companiesError) throw companiesError;

      // Get case files
      const { data: caseFiles, error: cfError } = await supabase
        .from('dt_case_files')
        .select('id, company_id');
      if (cfError) throw cfError;

      // Get evidence groups
      const { data: groups, error: groupsError } = await supabase
        .from('dt_evidence_groups')
        .select('id, case_file_id');
      if (groupsError) throw groupsError;

      // Get evidences
      const { data: evidences, error: evError } = await supabase
        .from('dt_evidences')
        .select('id, status, evidence_group_id, created_at');
      if (evError) throw evError;

      // Build status for each company
      const statuses: CompanyQTSPStatus[] = companies.map(company => {
        const caseFile = caseFiles.find(cf => cf.company_id === company.id);
        const companyGroups = groups.filter(g => 
          caseFiles.find(cf => cf.id === g.case_file_id && cf.company_id === company.id)
        );
        const groupIds = companyGroups.map(g => g.id);
        const companyEvidences = evidences.filter(e => groupIds.includes(e.evidence_group_id));

        const lastEvidence = companyEvidences.sort((a, b) => 
          new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        )[0];

        return {
          company_id: company.id,
          company_name: company.name,
          case_file_id: caseFile?.id || null,
          evidence_groups_count: companyGroups.length,
          total_evidences: companyEvidences.length,
          completed_evidences: companyEvidences.filter(e => e.status === 'completed').length,
          failed_evidences: companyEvidences.filter(e => e.status === 'failed').length,
          pending_evidences: companyEvidences.filter(e => e.status === 'processing' || e.status === 'pending').length,
          last_evidence_date: lastEvidence?.created_at || null,
        };
      });

      return statuses;
    },
    refetchInterval: 60000, // Every minute
  });

  // Get recent QTSP audit logs across all companies
  const { data: recentLogs } = useQuery({
    queryKey: ['super-admin-qtsp-audit'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('qtsp_audit_log')
        .select(`
          *,
          company:company_id (name)
        `)
        .order('created_at', { ascending: false })
        .limit(50);
      if (error) throw error;
      return data;
    },
    refetchInterval: 30000,
  });

  const totalStats = companiesStatus?.reduce((acc, c) => ({
    totalEvidences: acc.totalEvidences + c.total_evidences,
    completed: acc.completed + c.completed_evidences,
    failed: acc.failed + c.failed_evidences,
    pending: acc.pending + c.pending_evidences,
    companiesWithQTSP: acc.companiesWithQTSP + (c.case_file_id ? 1 : 0),
  }), { totalEvidences: 0, completed: 0, failed: 0, pending: 0, companiesWithQTSP: 0 });

  const getHealthStatusIcon = () => {
    if (loadingHealth) return <Loader2 className="w-6 h-6 animate-spin" />;
    if (healthStatus?.status === 'healthy') return <Wifi className="w-6 h-6 text-green-500" />;
    if (healthStatus?.status === 'degraded') return <Wifi className="w-6 h-6 text-yellow-500" />;
    return <WifiOff className="w-6 h-6 text-destructive" />;
  };

  return (
    <SuperAdminLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Shield className="w-6 h-6" />
              Monitor QTSP Global
            </h1>
            <p className="text-muted-foreground">
              Estado de la integración Digital Trust para todas las empresas
            </p>
          </div>
          <div className="flex gap-2">
            <Button
              variant={notificationsEnabled ? "default" : "outline"}
              size="sm"
              onClick={() => setNotificationsEnabled(!notificationsEnabled)}
            >
              <Bell className={`w-4 h-4 mr-2 ${notificationsEnabled ? '' : 'opacity-50'}`} />
              {notificationsEnabled ? 'Notificaciones ON' : 'Notificaciones OFF'}
            </Button>
            <Button variant="outline" size="sm" onClick={() => {
              refetchHealth();
              refetchCompanies();
            }}>
              <RefreshCw className="w-4 h-4 mr-2" />
              Actualizar
            </Button>
          </div>
        </div>

        {/* Global Health Status */}
        <Card className={
          healthStatus?.status === 'healthy' ? 'border-green-500/50 bg-green-500/5' :
          healthStatus?.status === 'degraded' ? 'border-yellow-500/50 bg-yellow-500/5' :
          healthStatus?.status === 'unhealthy' ? 'border-destructive/50 bg-destructive/5' :
          ''
        }>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <Activity className="w-5 h-5" />
                Estado de la API Digital Trust
              </CardTitle>
              <Button variant="ghost" size="sm" onClick={() => refetchHealth()} disabled={loadingHealth}>
                {loadingHealth ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-6">
              <div className="flex items-center gap-3">
                {getHealthStatusIcon()}
                <div>
                  <p className="font-semibold text-lg">
                    {healthStatus?.status === 'healthy' ? 'Operativo' :
                     healthStatus?.status === 'degraded' ? 'Degradado' :
                     healthStatus?.status === 'unhealthy' ? 'No disponible' :
                     'Verificando...'}
                  </p>
                  <p className="text-sm text-muted-foreground">{healthStatus?.message || 'Conectando...'}</p>
                </div>
              </div>
              <div className="flex gap-4 ml-auto">
                <div className="text-center">
                  <Badge variant={healthStatus?.auth ? 'default' : 'destructive'}>
                    Auth: {healthStatus?.auth ? 'OK' : 'Error'}
                  </Badge>
                </div>
                <div className="text-center">
                  <Badge variant={healthStatus?.api ? 'default' : 'destructive'}>
                    API: {healthStatus?.api ? 'OK' : 'Error'}
                  </Badge>
                </div>
                <div className="text-center">
                  <span className="text-sm text-muted-foreground">
                    Latencia: <strong>{healthStatus?.latency_ms || '-'}ms</strong>
                  </span>
                </div>
                {consecutiveFailures > 0 && (
                  <div className="text-center">
                    <Badge variant="destructive">
                      {consecutiveFailures} fallos consecutivos
                    </Badge>
                  </div>
                )}
                {lastAlertSent && (
                  <div className="text-center">
                    <span className="text-xs text-muted-foreground">
                      Última alerta: {format(new Date(lastAlertSent), 'HH:mm', { locale: es })}
                    </span>
                  </div>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Latency History Chart */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Activity className="w-5 h-5" />
              Historial de Latencia
            </CardTitle>
            <CardDescription>
              Últimos 15 minutos de latencia de la API (muestreo cada 30s)
            </CardDescription>
          </CardHeader>
          <CardContent>
            {latencyHistory.length > 0 ? (
              <ResponsiveContainer width="100%" height={200}>
                <LineChart data={latencyHistory}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis 
                    dataKey="time" 
                    tick={{ fontSize: 11 }}
                    className="text-muted-foreground"
                  />
                  <YAxis 
                    tick={{ fontSize: 11 }}
                    domain={[0, 'auto']}
                    label={{ value: 'ms', angle: -90, position: 'insideLeft', fontSize: 11 }}
                    className="text-muted-foreground"
                  />
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: 'hsl(var(--card))', 
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '8px'
                    }}
                    labelStyle={{ color: 'hsl(var(--foreground))' }}
                    formatter={(value: number) => [`${value}ms`, 'Latencia']}
                  />
                  <ReferenceLine y={500} stroke="hsl(var(--destructive))" strokeDasharray="5 5" label="Límite" />
                  <ReferenceLine y={200} stroke="hsl(38 92% 50%)" strokeDasharray="5 5" />
                  <Line 
                    type="monotone" 
                    dataKey="latency" 
                    stroke="hsl(var(--primary))" 
                    strokeWidth={2}
                    dot={(props: any) => {
                      const { cx, cy, payload } = props;
                      const color = payload.status === 'healthy' ? 'hsl(142 76% 36%)' : 
                                    payload.status === 'degraded' ? 'hsl(38 92% 50%)' : 
                                    'hsl(var(--destructive))';
                      return <circle key={`dot-${payload.time}`} cx={cx} cy={cy} r={4} fill={color} />;
                    }}
                    activeDot={{ r: 6 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-[200px] text-muted-foreground">
                <Loader2 className="w-6 h-6 animate-spin mr-2" />
                Recopilando datos de latencia...
              </div>
            )}
            <div className="flex gap-4 mt-4 text-xs text-muted-foreground justify-center">
              <div className="flex items-center gap-1">
                <div className="w-3 h-3 rounded-full bg-green-500" />
                <span>Saludable (&lt;200ms)</span>
              </div>
              <div className="flex items-center gap-1">
                <div className="w-3 h-3 rounded-full bg-yellow-500" />
                <span>Degradado (200-500ms)</span>
              </div>
              <div className="flex items-center gap-1">
                <div className="w-3 h-3 rounded-full" style={{ backgroundColor: 'hsl(var(--destructive))' }} />
                <span>Crítico (&gt;500ms)</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Global Stats */}
        <div className="grid gap-4 md:grid-cols-5">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Empresas con QTSP</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {totalStats?.companiesWithQTSP || 0}/{companiesStatus?.length || 0}
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Total Evidencias</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{totalStats?.totalEvidences || 0}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-1">
                <CheckCircle className="w-4 h-4 text-green-500" />
                Completadas
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">{totalStats?.completed || 0}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-1">
                <Loader2 className="w-4 h-4 text-yellow-500" />
                Pendientes
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-yellow-600">{totalStats?.pending || 0}</div>
            </CardContent>
          </Card>
          <Card className={totalStats?.failed ? 'border-destructive/50' : ''}>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-1">
                <AlertCircle className="w-4 h-4 text-destructive" />
                Fallidas
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-destructive">{totalStats?.failed || 0}</div>
            </CardContent>
          </Card>
        </div>

        {/* Companies QTSP Status Table */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Building2 className="w-5 h-5" />
              Estado por Empresa
            </CardTitle>
            <CardDescription>Estado de las evidencias QTSP por cada empresa</CardDescription>
          </CardHeader>
          <CardContent>
            {loadingCompanies ? (
              <div className="flex justify-center py-8">
                <Loader2 className="w-8 h-8 animate-spin" />
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Empresa</TableHead>
                    <TableHead>Case File</TableHead>
                    <TableHead>Grupos</TableHead>
                    <TableHead>Completadas</TableHead>
                    <TableHead>Pendientes</TableHead>
                    <TableHead>Fallidas</TableHead>
                    <TableHead>Última Evidencia</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {companiesStatus?.map((company) => (
                    <TableRow key={company.company_id}>
                      <TableCell className="font-medium">{company.company_name}</TableCell>
                      <TableCell>
                        {company.case_file_id ? (
                          <Badge variant="default" className="bg-green-600">Configurado</Badge>
                        ) : (
                          <Badge variant="outline">Sin configurar</Badge>
                        )}
                      </TableCell>
                      <TableCell>{company.evidence_groups_count}</TableCell>
                      <TableCell>
                        <span className="text-green-600 font-medium">{company.completed_evidences}</span>
                      </TableCell>
                      <TableCell>
                        {company.pending_evidences > 0 ? (
                          <span className="text-yellow-600 font-medium">{company.pending_evidences}</span>
                        ) : '-'}
                      </TableCell>
                      <TableCell>
                        {company.failed_evidences > 0 ? (
                          <Badge variant="destructive">{company.failed_evidences}</Badge>
                        ) : '-'}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {company.last_evidence_date 
                          ? format(new Date(company.last_evidence_date), 'dd/MM/yyyy HH:mm', { locale: es })
                          : '-'}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        {/* Recent QTSP Operations */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Activity className="w-5 h-5" />
              Operaciones Recientes
            </CardTitle>
            <CardDescription>Últimas 50 operaciones QTSP en la plataforma</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="max-h-[400px] overflow-y-auto">
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
                  {recentLogs?.map((log: any) => (
                    <TableRow key={log.id}>
                      <TableCell className="text-sm">
                        {format(new Date(log.created_at), 'dd/MM HH:mm:ss', { locale: es })}
                      </TableCell>
                      <TableCell className="text-sm">{log.company?.name || '-'}</TableCell>
                      <TableCell>
                        <Badge variant="outline">{log.action}</Badge>
                      </TableCell>
                      <TableCell>
                        {log.status === 'success' ? (
                          <Badge variant="default" className="bg-green-600">OK</Badge>
                        ) : log.status === 'partial' ? (
                          <Badge variant="secondary">Parcial</Badge>
                        ) : (
                          <Badge variant="destructive">Error</Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {log.duration_ms ? `${log.duration_ms}ms` : '-'}
                      </TableCell>
                      <TableCell className="text-sm text-destructive max-w-[200px] truncate">
                        {log.error_message || '-'}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>

        {/* Alerts Section */}
        {totalStats && totalStats.failed > 0 && (
          <Card className="border-destructive">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-destructive">
                <AlertTriangle className="w-5 h-5" />
                Alertas Activas
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <p className="text-sm">
                  Hay <strong>{totalStats.failed}</strong> evidencias QTSP que han fallado y requieren atención inmediata.
                </p>
                <p className="text-xs text-muted-foreground">
                  Las empresas afectadas deberían usar la opción "Reintentar fallidos" en su panel de Evidencias QTSP.
                </p>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </SuperAdminLayout>
  );
}
