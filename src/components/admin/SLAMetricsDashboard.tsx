import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { format, subDays, differenceInMinutes } from 'date-fns';
import { es } from 'date-fns/locale';
import { CheckCircle, XCircle, Clock, TrendingUp, AlertTriangle, Activity } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, AreaChart, Area } from 'recharts';

interface SLAMetrics {
  availability: number;
  mttr: number; // Mean Time To Resolution in minutes
  successRate: number;
  p50ResponseTime: number;
  p95ResponseTime: number;
  p99ResponseTime: number;
  totalOperations: number;
  successfulOperations: number;
  failedOperations: number;
  slaCompliance: number;
}

const TIME_RANGES = [
  { value: '7', label: 'Últimos 7 días' },
  { value: '30', label: 'Últimos 30 días' },
  { value: '90', label: 'Últimos 90 días' },
];

// SLA Targets
const SLA_TARGETS = {
  availability: 99.5,
  mttr: 60, // 60 minutes max
  successRate: 95,
  p95ResponseTime: 5000, // 5 seconds
};

export function SLAMetricsDashboard() {
  const [timeRange, setTimeRange] = useState('30');

  const { data: logs, isLoading } = useQuery({
    queryKey: ['qtsp-sla-metrics', timeRange],
    queryFn: async () => {
      const since = subDays(new Date(), parseInt(timeRange)).toISOString();
      const { data, error } = await supabase
        .from('qtsp_audit_log')
        .select('*')
        .gte('created_at', since)
        .order('created_at', { ascending: true });
      
      if (error) throw error;
      return data || [];
    },
  });

  const metrics = useMemo((): SLAMetrics => {
    if (!logs || logs.length === 0) {
      return {
        availability: 100,
        mttr: 0,
        successRate: 100,
        p50ResponseTime: 0,
        p95ResponseTime: 0,
        p99ResponseTime: 0,
        totalOperations: 0,
        successfulOperations: 0,
        failedOperations: 0,
        slaCompliance: 100,
      };
    }

    const successLogs = logs.filter(l => l.status === 'success');
    const failedLogs = logs.filter(l => l.status === 'error');
    const totalOps = logs.length;
    const successOps = successLogs.length;
    const failedOps = failedLogs.length;

    // Success rate
    const successRate = totalOps > 0 ? (successOps / totalOps) * 100 : 100;

    // Response times (duration_ms)
    const durations = logs
      .filter(l => l.duration_ms !== null)
      .map(l => l.duration_ms as number)
      .sort((a, b) => a - b);

    const p50 = durations.length > 0 ? durations[Math.floor(durations.length * 0.5)] : 0;
    const p95 = durations.length > 0 ? durations[Math.floor(durations.length * 0.95)] : 0;
    const p99 = durations.length > 0 ? durations[Math.floor(durations.length * 0.99)] : 0;

    // MTTR - Calculate average time between failure and next success for same company
    let totalResolutionTime = 0;
    let resolutionCount = 0;

    for (let i = 0; i < logs.length; i++) {
      if (logs[i].status === 'error') {
        // Find next success for same company/action
        for (let j = i + 1; j < logs.length; j++) {
          if (logs[j].company_id === logs[i].company_id && 
              logs[j].action === logs[i].action && 
              logs[j].status === 'success') {
            const resolutionTime = differenceInMinutes(
              new Date(logs[j].created_at),
              new Date(logs[i].created_at)
            );
            totalResolutionTime += resolutionTime;
            resolutionCount++;
            break;
          }
        }
      }
    }

    const mttr = resolutionCount > 0 ? totalResolutionTime / resolutionCount : 0;

    // Availability - Calculate based on successful health checks
    const healthChecks = logs.filter(l => l.action.includes('health') || l.action.includes('state'));
    const successfulHealthChecks = healthChecks.filter(l => l.status === 'success').length;
    const availability = healthChecks.length > 0 
      ? (successfulHealthChecks / healthChecks.length) * 100 
      : 100;

    // SLA Compliance - Check if all SLA targets are met
    const slaChecks = [
      availability >= SLA_TARGETS.availability,
      mttr <= SLA_TARGETS.mttr || mttr === 0,
      successRate >= SLA_TARGETS.successRate,
      p95 <= SLA_TARGETS.p95ResponseTime || p95 === 0,
    ];
    const slaCompliance = (slaChecks.filter(Boolean).length / slaChecks.length) * 100;

    return {
      availability,
      mttr,
      successRate,
      p50ResponseTime: p50,
      p95ResponseTime: p95,
      p99ResponseTime: p99,
      totalOperations: totalOps,
      successfulOperations: successOps,
      failedOperations: failedOps,
      slaCompliance,
    };
  }, [logs]);

  // Daily availability trend
  const availabilityTrend = useMemo(() => {
    if (!logs || logs.length === 0) return [];

    const dailyData: Record<string, { success: number; total: number }> = {};
    
    logs.forEach(log => {
      const date = format(new Date(log.created_at), 'yyyy-MM-dd');
      if (!dailyData[date]) {
        dailyData[date] = { success: 0, total: 0 };
      }
      dailyData[date].total++;
      if (log.status === 'success') {
        dailyData[date].success++;
      }
    });

    return Object.entries(dailyData).map(([date, data]) => ({
      date: format(new Date(date), 'dd MMM', { locale: es }),
      availability: data.total > 0 ? (data.success / data.total) * 100 : 100,
      target: SLA_TARGETS.availability,
    }));
  }, [logs]);

  const getStatusColor = (value: number, target: number, inverse = false) => {
    const comparison = inverse ? value <= target : value >= target;
    if (comparison) return 'text-green-600';
    if (inverse ? value <= target * 1.5 : value >= target * 0.9) return 'text-yellow-600';
    return 'text-red-600';
  };

  const getStatusBadge = (value: number, target: number, inverse = false) => {
    const comparison = inverse ? value <= target : value >= target;
    if (comparison) return <Badge className="bg-green-100 text-green-800">✓ Cumple SLA</Badge>;
    return <Badge variant="destructive">✗ No cumple</Badge>;
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="animate-pulse space-y-4">
            <div className="h-4 bg-muted rounded w-1/4"></div>
            <div className="h-32 bg-muted rounded"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Métricas SLA QTSP</h2>
          <p className="text-muted-foreground">Indicadores de rendimiento y disponibilidad del servicio</p>
        </div>
        <Select value={timeRange} onValueChange={setTimeRange}>
          <SelectTrigger className="w-[180px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {TIME_RANGES.map(range => (
              <SelectItem key={range.value} value={range.value}>{range.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* SLA Compliance Overview */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-lg flex items-center gap-2">
            <Activity className="h-5 w-5" />
            Cumplimiento SLA General
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-4">
            <div className="flex-1">
              <Progress value={metrics.slaCompliance} className="h-3" />
            </div>
            <span className={`text-2xl font-bold ${getStatusColor(metrics.slaCompliance, 100)}`}>
              {metrics.slaCompliance.toFixed(0)}%
            </span>
          </div>
          <p className="text-sm text-muted-foreground mt-2">
            {metrics.slaCompliance === 100 
              ? 'Todos los objetivos SLA se están cumpliendo' 
              : 'Algunos objetivos SLA requieren atención'}
          </p>
        </CardContent>
      </Card>

      {/* Key Metrics Grid */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {/* Availability */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Disponibilidad</CardTitle>
            <CheckCircle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${getStatusColor(metrics.availability, SLA_TARGETS.availability)}`}>
              {metrics.availability.toFixed(2)}%
            </div>
            <div className="flex items-center justify-between mt-2">
              <span className="text-xs text-muted-foreground">Objetivo: {SLA_TARGETS.availability}%</span>
              {getStatusBadge(metrics.availability, SLA_TARGETS.availability)}
            </div>
          </CardContent>
        </Card>

        {/* MTTR */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">MTTR</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${getStatusColor(metrics.mttr, SLA_TARGETS.mttr, true)}`}>
              {metrics.mttr > 0 ? `${metrics.mttr.toFixed(0)} min` : 'N/A'}
            </div>
            <div className="flex items-center justify-between mt-2">
              <span className="text-xs text-muted-foreground">Objetivo: ≤{SLA_TARGETS.mttr} min</span>
              {metrics.mttr > 0 && getStatusBadge(metrics.mttr, SLA_TARGETS.mttr, true)}
            </div>
          </CardContent>
        </Card>

        {/* Success Rate */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Tasa de Éxito</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${getStatusColor(metrics.successRate, SLA_TARGETS.successRate)}`}>
              {metrics.successRate.toFixed(1)}%
            </div>
            <div className="flex items-center justify-between mt-2">
              <span className="text-xs text-muted-foreground">Objetivo: {SLA_TARGETS.successRate}%</span>
              {getStatusBadge(metrics.successRate, SLA_TARGETS.successRate)}
            </div>
          </CardContent>
        </Card>

        {/* P95 Response Time */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">P95 Latencia</CardTitle>
            <AlertTriangle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${getStatusColor(metrics.p95ResponseTime, SLA_TARGETS.p95ResponseTime, true)}`}>
              {metrics.p95ResponseTime > 0 ? `${metrics.p95ResponseTime.toFixed(0)} ms` : 'N/A'}
            </div>
            <div className="flex items-center justify-between mt-2">
              <span className="text-xs text-muted-foreground">Objetivo: ≤{SLA_TARGETS.p95ResponseTime} ms</span>
              {metrics.p95ResponseTime > 0 && getStatusBadge(metrics.p95ResponseTime, SLA_TARGETS.p95ResponseTime, true)}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Response Time Percentiles */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Percentiles de Tiempo de Respuesta</CardTitle>
          <CardDescription>Distribución de latencias en las operaciones QTSP</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-3 gap-4">
            <div className="text-center p-4 bg-muted/50 rounded-lg">
              <div className="text-3xl font-bold text-primary">{metrics.p50ResponseTime.toFixed(0)} ms</div>
              <div className="text-sm text-muted-foreground">P50 (Mediana)</div>
            </div>
            <div className="text-center p-4 bg-muted/50 rounded-lg">
              <div className={`text-3xl font-bold ${getStatusColor(metrics.p95ResponseTime, SLA_TARGETS.p95ResponseTime, true)}`}>
                {metrics.p95ResponseTime.toFixed(0)} ms
              </div>
              <div className="text-sm text-muted-foreground">P95</div>
            </div>
            <div className="text-center p-4 bg-muted/50 rounded-lg">
              <div className="text-3xl font-bold">{metrics.p99ResponseTime.toFixed(0)} ms</div>
              <div className="text-sm text-muted-foreground">P99</div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Availability Trend Chart */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Tendencia de Disponibilidad</CardTitle>
          <CardDescription>Evolución diaria vs objetivo SLA ({SLA_TARGETS.availability}%)</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={availabilityTrend}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis 
                  dataKey="date" 
                  tick={{ fontSize: 12 }}
                  className="text-muted-foreground"
                />
                <YAxis 
                  domain={[90, 100]} 
                  tick={{ fontSize: 12 }}
                  className="text-muted-foreground"
                />
                <Tooltip 
                  formatter={(value: number) => [`${value.toFixed(2)}%`, 'Disponibilidad']}
                  contentStyle={{ 
                    backgroundColor: 'hsl(var(--background))', 
                    border: '1px solid hsl(var(--border))',
                    borderRadius: '8px'
                  }}
                />
                <Area 
                  type="monotone" 
                  dataKey="availability" 
                  stroke="hsl(var(--primary))" 
                  fill="hsl(var(--primary) / 0.2)" 
                  strokeWidth={2}
                />
                <Line 
                  type="monotone" 
                  dataKey="target" 
                  stroke="hsl(var(--destructive))" 
                  strokeDasharray="5 5"
                  dot={false}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      {/* Operations Summary */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Resumen de Operaciones</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-3 gap-4">
            <div className="flex items-center gap-3 p-4 bg-muted/50 rounded-lg">
              <div className="p-2 bg-primary/10 rounded-full">
                <Activity className="h-5 w-5 text-primary" />
              </div>
              <div>
                <div className="text-2xl font-bold">{metrics.totalOperations.toLocaleString()}</div>
                <div className="text-sm text-muted-foreground">Total operaciones</div>
              </div>
            </div>
            <div className="flex items-center gap-3 p-4 bg-green-50 dark:bg-green-950/20 rounded-lg">
              <div className="p-2 bg-green-100 dark:bg-green-900/50 rounded-full">
                <CheckCircle className="h-5 w-5 text-green-600" />
              </div>
              <div>
                <div className="text-2xl font-bold text-green-600">{metrics.successfulOperations.toLocaleString()}</div>
                <div className="text-sm text-muted-foreground">Exitosas</div>
              </div>
            </div>
            <div className="flex items-center gap-3 p-4 bg-red-50 dark:bg-red-950/20 rounded-lg">
              <div className="p-2 bg-red-100 dark:bg-red-900/50 rounded-full">
                <XCircle className="h-5 w-5 text-red-600" />
              </div>
              <div>
                <div className="text-2xl font-bold text-red-600">{metrics.failedOperations.toLocaleString()}</div>
                <div className="text-sm text-muted-foreground">Fallidas</div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
