import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  Legend,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell
} from 'recharts';
import { TrendingUp, TrendingDown, Loader2, Calendar } from 'lucide-react';
import { format, subDays, subWeeks, startOfWeek, endOfWeek, startOfMonth, subMonths, eachDayOfInterval, eachWeekOfInterval } from 'date-fns';
import { es } from 'date-fns/locale';

interface TrendData {
  period: string;
  total: number;
  success: number;
  error: number;
  warning: number;
  successRate: number;
}

const COLORS = {
  success: 'hsl(142 76% 36%)',
  error: 'hsl(var(--destructive))',
  warning: 'hsl(38 92% 50%)',
};

export function QTSPTrendsChart() {
  const [timeRange, setTimeRange] = useState<'weekly' | 'monthly'>('weekly');
  
  // Fetch audit logs for trend analysis
  const { data: auditLogs, isLoading } = useQuery({
    queryKey: ['qtsp-trends-data'],
    queryFn: async () => {
      const thirtyDaysAgo = subDays(new Date(), 90).toISOString();
      
      const { data, error } = await supabase
        .from('qtsp_audit_log')
        .select('id, created_at, action, status')
        .gte('created_at', thirtyDaysAgo)
        .not('action', 'like', 'state_%')
        .order('created_at', { ascending: true });
      
      if (error) throw error;
      return data;
    },
    refetchInterval: 60000, // Refresh every minute
  });
  
  // Process data for weekly view
  const weeklyData = useMemo(() => {
    if (!auditLogs) return [];
    
    const weeks = eachWeekOfInterval(
      { start: subWeeks(new Date(), 12), end: new Date() },
      { weekStartsOn: 1 }
    );
    
    return weeks.map(weekStart => {
      const weekEnd = endOfWeek(weekStart, { weekStartsOn: 1 });
      const weekLogs = auditLogs.filter(log => {
        const logDate = new Date(log.created_at);
        return logDate >= weekStart && logDate <= weekEnd;
      });
      
      const success = weekLogs.filter(l => l.status === 'success').length;
      const error = weekLogs.filter(l => l.status === 'error').length;
      const warning = weekLogs.filter(l => l.status === 'warning').length;
      const total = weekLogs.length;
      
      return {
        period: format(weekStart, 'dd MMM', { locale: es }),
        total,
        success,
        error,
        warning,
        successRate: total > 0 ? Math.round((success / total) * 100) : 100,
      };
    });
  }, [auditLogs]);
  
  // Process data for daily view (last 30 days)
  const dailyData = useMemo(() => {
    if (!auditLogs) return [];
    
    const days = eachDayOfInterval({
      start: subDays(new Date(), 30),
      end: new Date()
    });
    
    return days.map(day => {
      const dayStr = format(day, 'yyyy-MM-dd');
      const dayLogs = auditLogs.filter(log => 
        log.created_at.startsWith(dayStr)
      );
      
      const success = dayLogs.filter(l => l.status === 'success').length;
      const error = dayLogs.filter(l => l.status === 'error').length;
      const warning = dayLogs.filter(l => l.status === 'warning').length;
      const total = dayLogs.length;
      
      return {
        period: format(day, 'dd/MM', { locale: es }),
        total,
        success,
        error,
        warning,
        successRate: total > 0 ? Math.round((success / total) * 100) : 100,
      };
    });
  }, [auditLogs]);
  
  // Monthly data (last 6 months)
  const monthlyData = useMemo(() => {
    if (!auditLogs) return [];
    
    const months = Array.from({ length: 6 }, (_, i) => {
      const date = subMonths(new Date(), 5 - i);
      return startOfMonth(date);
    });
    
    return months.map(monthStart => {
      const monthStr = format(monthStart, 'yyyy-MM');
      const monthLogs = auditLogs.filter(log => 
        log.created_at.startsWith(monthStr)
      );
      
      const success = monthLogs.filter(l => l.status === 'success').length;
      const error = monthLogs.filter(l => l.status === 'error').length;
      const warning = monthLogs.filter(l => l.status === 'warning').length;
      const total = monthLogs.length;
      
      return {
        period: format(monthStart, 'MMM yyyy', { locale: es }),
        total,
        success,
        error,
        warning,
        successRate: total > 0 ? Math.round((success / total) * 100) : 100,
      };
    });
  }, [auditLogs]);
  
  // Calculate overall stats
  const overallStats = useMemo(() => {
    const data = timeRange === 'weekly' ? weeklyData : monthlyData;
    if (data.length < 2) return null;
    
    const current = data[data.length - 1];
    const previous = data[data.length - 2];
    
    const errorTrend = current.error - previous.error;
    const successRateTrend = current.successRate - previous.successRate;
    
    return {
      totalErrors: data.reduce((sum, d) => sum + d.error, 0),
      totalSuccess: data.reduce((sum, d) => sum + d.success, 0),
      avgSuccessRate: Math.round(data.reduce((sum, d) => sum + d.successRate, 0) / data.length),
      errorTrend,
      successRateTrend,
    };
  }, [weeklyData, monthlyData, timeRange]);
  
  // Pie chart data for error distribution by action type
  const errorsByAction = useMemo(() => {
    if (!auditLogs) return [];
    
    const errorLogs = auditLogs.filter(l => l.status === 'error');
    const actionCounts: Record<string, number> = {};
    
    errorLogs.forEach(log => {
      const action = log.action.replace('health_check_auto', 'Health Check')
        .replace('timestamp', 'Timestamp')
        .replace('notarize', 'Notarización');
      actionCounts[action] = (actionCounts[action] || 0) + 1;
    });
    
    return Object.entries(actionCounts)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 5);
  }, [auditLogs]);
  
  const PIE_COLORS = ['#ef4444', '#f97316', '#eab308', '#22c55e', '#3b82f6'];
  
  if (isLoading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }
  
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Calendar className="w-5 h-5" />
              Tendencias Históricas de Errores QTSP
            </CardTitle>
            <CardDescription>
              Evolución de operaciones y errores a lo largo del tiempo
            </CardDescription>
          </div>
          {overallStats && (
            <div className="flex gap-4 text-sm">
              <div className="text-center">
                <div className="text-muted-foreground">Tasa éxito promedio</div>
                <div className="flex items-center gap-1 justify-center">
                  <span className="text-xl font-bold">{overallStats.avgSuccessRate}%</span>
                  {overallStats.successRateTrend !== 0 && (
                    overallStats.successRateTrend > 0 
                      ? <TrendingUp className="w-4 h-4 text-green-500" />
                      : <TrendingDown className="w-4 h-4 text-destructive" />
                  )}
                </div>
              </div>
              <div className="text-center">
                <div className="text-muted-foreground">Total errores</div>
                <div className="flex items-center gap-1 justify-center">
                  <span className="text-xl font-bold text-destructive">{overallStats.totalErrors}</span>
                  {overallStats.errorTrend !== 0 && (
                    overallStats.errorTrend > 0 
                      ? <TrendingUp className="w-4 h-4 text-destructive" />
                      : <TrendingDown className="w-4 h-4 text-green-500" />
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </CardHeader>
      <CardContent>
        <Tabs value={timeRange} onValueChange={(v) => setTimeRange(v as 'weekly' | 'monthly')}>
          <TabsList className="mb-4">
            <TabsTrigger value="weekly">Semanal</TabsTrigger>
            <TabsTrigger value="monthly">Mensual</TabsTrigger>
          </TabsList>
          
          <TabsContent value="weekly" className="space-y-6">
            {/* Bar chart for weekly errors */}
            <div>
              <h4 className="text-sm font-medium mb-2">Operaciones por semana (últimas 12 semanas)</h4>
              <ResponsiveContainer width="100%" height={250}>
                <BarChart data={weeklyData}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis dataKey="period" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: 'hsl(var(--card))', 
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '8px'
                    }}
                  />
                  <Legend />
                  <Bar dataKey="success" name="Exitosas" fill={COLORS.success} stackId="a" />
                  <Bar dataKey="warning" name="Advertencias" fill={COLORS.warning} stackId="a" />
                  <Bar dataKey="error" name="Errores" fill={COLORS.error} stackId="a" />
                </BarChart>
              </ResponsiveContainer>
            </div>
            
            {/* Daily success rate line chart */}
            <div>
              <h4 className="text-sm font-medium mb-2">Tasa de éxito diaria (últimos 30 días)</h4>
              <ResponsiveContainer width="100%" height={200}>
                <LineChart data={dailyData}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis dataKey="period" tick={{ fontSize: 10 }} interval={2} />
                  <YAxis domain={[0, 100]} tick={{ fontSize: 11 }} unit="%" />
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: 'hsl(var(--card))', 
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '8px'
                    }}
                    formatter={(value: number) => [`${value}%`, 'Tasa de éxito']}
                  />
                  <Line 
                    type="monotone" 
                    dataKey="successRate" 
                    stroke="hsl(var(--primary))" 
                    strokeWidth={2}
                    dot={false}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </TabsContent>
          
          <TabsContent value="monthly" className="space-y-6">
            {/* Monthly bar chart */}
            <div>
              <h4 className="text-sm font-medium mb-2">Operaciones por mes (últimos 6 meses)</h4>
              <ResponsiveContainer width="100%" height={250}>
                <BarChart data={monthlyData}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis dataKey="period" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: 'hsl(var(--card))', 
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '8px'
                    }}
                  />
                  <Legend />
                  <Bar dataKey="success" name="Exitosas" fill={COLORS.success} />
                  <Bar dataKey="error" name="Errores" fill={COLORS.error} />
                </BarChart>
              </ResponsiveContainer>
            </div>
            
            {/* Pie chart for error distribution */}
            {errorsByAction.length > 0 && (
              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <h4 className="text-sm font-medium mb-2">Distribución de errores por tipo de operación</h4>
                  <ResponsiveContainer width="100%" height={200}>
                    <PieChart>
                      <Pie
                        data={errorsByAction}
                        cx="50%"
                        cy="50%"
                        innerRadius={40}
                        outerRadius={80}
                        paddingAngle={5}
                        dataKey="value"
                        label={({ name, percent }) => `${name} (${(percent * 100).toFixed(0)}%)`}
                        labelLine={false}
                      >
                        {errorsByAction.map((_, index) => (
                          <Cell key={`cell-${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div className="flex flex-col justify-center">
                  <h4 className="text-sm font-medium mb-2">Resumen</h4>
                  <ul className="space-y-2 text-sm">
                    {errorsByAction.map((item, index) => (
                      <li key={item.name} className="flex items-center gap-2">
                        <div 
                          className="w-3 h-3 rounded-full" 
                          style={{ backgroundColor: PIE_COLORS[index % PIE_COLORS.length] }} 
                        />
                        <span>{item.name}:</span>
                        <span className="font-medium">{item.value} errores</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            )}
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}
