import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { 
  Mail, CheckCircle, Clock, AlertTriangle, 
  TrendingUp, Users, MessageSquare, Shield 
} from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCompany } from "@/hooks/useCompany";

interface StatCardProps {
  title: string;
  value: number | string;
  icon: React.ReactNode;
  description?: string;
  trend?: number;
  color?: string;
}

function StatCard({ title, value, icon, description, trend, color = "primary" }: StatCardProps) {
  return (
    <Card>
      <CardContent className="pt-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-muted-foreground">{title}</p>
            <p className="text-2xl font-bold">{value}</p>
            {description && (
              <p className="text-xs text-muted-foreground mt-1">{description}</p>
            )}
            {trend !== undefined && (
              <div className={`flex items-center gap-1 mt-1 ${trend >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                <TrendingUp className={`h-3 w-3 ${trend < 0 ? 'rotate-180' : ''}`} />
                <span className="text-xs">{Math.abs(trend)}% vs mes anterior</span>
              </div>
            )}
          </div>
          <div className={`p-3 rounded-full bg-${color}/10`}>
            {icon}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export function MessageStatsDashboard() {
  const { company } = useCompany();

  const { data: stats, isLoading } = useQuery({
    queryKey: ['message-stats', company?.id],
    queryFn: async () => {
      if (!company?.id) return null;

      const now = new Date();
      const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      const sixtyDaysAgo = new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000);

      // Get threads from last 30 days
      const { data: recentThreads } = await supabase
        .from('message_threads')
        .select('id, status, certification_level, requires_response, requires_read_confirmation, sent_at')
        .eq('company_id', company.id)
        .eq('status', 'sent')
        .gte('sent_at', thirtyDaysAgo.toISOString());

      // Get threads from previous 30 days for comparison
      const { data: previousThreads } = await supabase
        .from('message_threads')
        .select('id')
        .eq('company_id', company.id)
        .eq('status', 'sent')
        .gte('sent_at', sixtyDaysAgo.toISOString())
        .lt('sent_at', thirtyDaysAgo.toISOString());

      const threadIds = recentThreads?.map(t => t.id) || [];

      // Get recipient stats
      const { data: recipients } = await supabase
        .from('message_recipients')
        .select('delivery_status, reminder_count')
        .in('thread_id', threadIds.length > 0 ? threadIds : ['00000000-0000-0000-0000-000000000000']);

      // Calculate stats
      const totalSent = recentThreads?.length || 0;
      const previousSent = previousThreads?.length || 0;
      const sendTrend = previousSent > 0 ? Math.round(((totalSent - previousSent) / previousSent) * 100) : 0;

      const totalRecipients = recipients?.length || 0;
      const readCount = recipients?.filter(r => r.delivery_status === 'read' || r.delivery_status === 'responded' || r.delivery_status === 'signed').length || 0;
      const respondedCount = recipients?.filter(r => r.delivery_status === 'responded' || r.delivery_status === 'signed').length || 0;
      const signedCount = recipients?.filter(r => r.delivery_status === 'signed').length || 0;
      const pendingCount = recipients?.filter(r => 
        r.delivery_status === 'pending' || 
        r.delivery_status === 'delivered' ||
        r.delivery_status === 'notified_kiosk'
      ).length || 0;
      const expiredCount = recipients?.filter(r => r.delivery_status === 'expired').length || 0;
      const remindedCount = recipients?.filter(r => (r.reminder_count || 0) > 0).length || 0;

      const readRate = totalRecipients > 0 ? Math.round((readCount / totalRecipients) * 100) : 0;
      const responseRate = totalRecipients > 0 ? Math.round((respondedCount / totalRecipients) * 100) : 0;

      const certifiedCount = recentThreads?.filter(t => 
        t.certification_level === 'timestamped' || t.certification_level === 'qualified'
      ).length || 0;

      return {
        totalSent,
        sendTrend,
        totalRecipients,
        readCount,
        readRate,
        respondedCount,
        responseRate,
        signedCount,
        pendingCount,
        expiredCount,
        remindedCount,
        certifiedCount
      };
    },
    enabled: !!company?.id
  });

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {[...Array(4)].map((_, i) => (
          <Card key={i} className="animate-pulse">
            <CardContent className="pt-6 h-24 bg-muted/50" />
          </Card>
        ))}
      </div>
    );
  }

  if (!stats) return null;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Comunicaciones enviadas"
          value={stats.totalSent}
          icon={<Mail className="h-5 w-5 text-primary" />}
          description="Últimos 30 días"
          trend={stats.sendTrend}
        />
        <StatCard
          title="Tasa de lectura"
          value={`${stats.readRate}%`}
          icon={<CheckCircle className="h-5 w-5 text-green-600" />}
          description={`${stats.readCount} de ${stats.totalRecipients} destinatarios`}
        />
        <StatCard
          title="Pendientes"
          value={stats.pendingCount}
          icon={<Clock className="h-5 w-5 text-amber-600" />}
          description={`${stats.remindedCount} con recordatorio`}
        />
        <StatCard
          title="Certificadas QTSP"
          value={stats.certifiedCount}
          icon={<Shield className="h-5 w-5 text-blue-600" />}
          description="Con sello cualificado"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Users className="h-5 w-5" />
              Desglose de destinatarios
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>Leídos</span>
                <span className="font-medium">{stats.readCount}</span>
              </div>
              <Progress value={(stats.readCount / Math.max(stats.totalRecipients, 1)) * 100} className="h-2" />
            </div>
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>Respondidos</span>
                <span className="font-medium">{stats.respondedCount}</span>
              </div>
              <Progress value={(stats.respondedCount / Math.max(stats.totalRecipients, 1)) * 100} className="h-2 bg-muted [&>div]:bg-blue-500" />
            </div>
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>Firmados</span>
                <span className="font-medium">{stats.signedCount}</span>
              </div>
              <Progress value={(stats.signedCount / Math.max(stats.totalRecipients, 1)) * 100} className="h-2 bg-muted [&>div]:bg-purple-500" />
            </div>
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-destructive">Expirados</span>
                <span className="font-medium text-destructive">{stats.expiredCount}</span>
              </div>
              <Progress value={(stats.expiredCount / Math.max(stats.totalRecipients, 1)) * 100} className="h-2 bg-muted [&>div]:bg-destructive" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <MessageSquare className="h-5 w-5" />
              Resumen de actividad
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-green-100 rounded-full">
                    <CheckCircle className="h-4 w-4 text-green-600" />
                  </div>
                  <div>
                    <p className="font-medium">Tasa de respuesta</p>
                    <p className="text-sm text-muted-foreground">De mensajes que requieren respuesta</p>
                  </div>
                </div>
                <Badge variant="outline" className="text-lg">
                  {stats.responseRate}%
                </Badge>
              </div>

              <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-amber-100 rounded-full">
                    <Clock className="h-4 w-4 text-amber-600" />
                  </div>
                  <div>
                    <p className="font-medium">Recordatorios enviados</p>
                    <p className="text-sm text-muted-foreground">Destinatarios que recibieron recordatorio</p>
                  </div>
                </div>
                <Badge variant="outline" className="text-lg">
                  {stats.remindedCount}
                </Badge>
              </div>

              {stats.expiredCount > 0 && (
                <div className="flex items-center justify-between p-3 bg-destructive/10 rounded-lg">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-destructive/20 rounded-full">
                      <AlertTriangle className="h-4 w-4 text-destructive" />
                    </div>
                    <div>
                      <p className="font-medium text-destructive">Comunicaciones expiradas</p>
                      <p className="text-sm text-muted-foreground">Sin respuesta antes del plazo</p>
                    </div>
                  </div>
                  <Badge variant="destructive" className="text-lg">
                    {stats.expiredCount}
                  </Badge>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
