import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { EmployeeLayout } from '@/components/layout/EmployeeLayout';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { 
  Bell, BellOff, CheckCircle2, XCircle, Calendar, FileSignature, 
  FileText, AlertCircle, Loader2, CheckCheck, Trash2 
} from 'lucide-react';
import { formatDistanceToNow, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';
import { useNavigate } from 'react-router-dom';

const notificationIcons: Record<string, React.ElementType> = {
  absence_approved: CheckCircle2,
  absence_rejected: XCircle,
  closure_reminder: FileSignature,
  closure_signed: FileSignature,
  document_required: FileText,
  default: Bell,
};

const notificationColors: Record<string, string> = {
  absence_approved: 'text-green-500',
  absence_rejected: 'text-red-500',
  closure_reminder: 'text-yellow-500',
  closure_signed: 'text-green-500',
  document_required: 'text-blue-500',
  default: 'text-muted-foreground',
};

export default function EmployeeNotifications() {
  const { employee } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  // Fetch notifications
  const { data: notifications, isLoading } = useQuery({
    queryKey: ['employee-notifications', employee?.id],
    queryFn: async () => {
      if (!employee?.id) return [];
      const { data, error } = await supabase
        .from('employee_notifications')
        .select('*')
        .eq('employee_id', employee.id)
        .order('created_at', { ascending: false })
        .limit(50);
      if (error) throw error;
      return data || [];
    },
    enabled: !!employee?.id,
  });

  // Mark as read mutation
  const markReadMutation = useMutation({
    mutationFn: async (notificationId: string) => {
      const { error } = await supabase
        .from('employee_notifications')
        .update({ is_read: true, read_at: new Date().toISOString() })
        .eq('id', notificationId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['employee-notifications'] });
    },
  });

  // Mark all as read mutation
  const markAllReadMutation = useMutation({
    mutationFn: async () => {
      if (!employee?.id) return;
      const { error } = await supabase
        .from('employee_notifications')
        .update({ is_read: true, read_at: new Date().toISOString() })
        .eq('employee_id', employee.id)
        .eq('is_read', false);
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: 'Todas las notificaciones marcadas como leídas' });
      queryClient.invalidateQueries({ queryKey: ['employee-notifications'] });
    },
    onError: (error: Error) => {
      toast({ variant: 'destructive', title: 'Error', description: error.message });
    },
  });

  const handleNotificationClick = (notification: any) => {
    // Mark as read
    if (!notification.is_read) {
      markReadMutation.mutate(notification.id);
    }

    // Navigate to action URL if available
    if (notification.action_url) {
      navigate(notification.action_url);
    } else if (notification.related_entity_type) {
      // Navigate based on entity type
      switch (notification.related_entity_type) {
        case 'absence_request':
          navigate('/employee/absences');
          break;
        case 'monthly_closure':
          navigate('/employee/closure');
          break;
        default:
          break;
      }
    }
  };

  const unreadCount = notifications?.filter(n => !n.is_read).length || 0;

  return (
    <EmployeeLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Notificaciones</h1>
            <p className="text-muted-foreground">
              {unreadCount > 0 
                ? `Tienes ${unreadCount} notificación(es) sin leer`
                : 'Todas las notificaciones leídas'}
            </p>
          </div>
          {unreadCount > 0 && (
            <Button 
              variant="outline" 
              onClick={() => markAllReadMutation.mutate()}
              disabled={markAllReadMutation.isPending}
            >
              <CheckCheck className="h-4 w-4 mr-2" />
              Marcar todas como leídas
            </Button>
          )}
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Bell className="h-5 w-5" />
              Centro de Notificaciones
            </CardTitle>
            <CardDescription>
              Actualizaciones sobre tus solicitudes y recordatorios
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : notifications?.length === 0 ? (
              <div className="text-center py-12">
                <BellOff className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <p className="text-muted-foreground">No tienes notificaciones</p>
              </div>
            ) : (
              <div className="space-y-2">
                {notifications?.map((notification) => {
                  const IconComponent = notificationIcons[notification.notification_type] || notificationIcons.default;
                  const iconColor = notificationColors[notification.notification_type] || notificationColors.default;
                  
                  return (
                    <div
                      key={notification.id}
                      onClick={() => handleNotificationClick(notification)}
                      className={`
                        flex items-start gap-4 p-4 rounded-lg border cursor-pointer transition-colors
                        ${notification.is_read 
                          ? 'bg-background hover:bg-muted/50' 
                          : 'bg-primary/5 border-primary/20 hover:bg-primary/10'}
                      `}
                    >
                      <div className={`mt-0.5 ${iconColor}`}>
                        <IconComponent className="h-5 w-5" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2">
                          <p className={`font-medium ${notification.is_read ? '' : 'text-primary'}`}>
                            {notification.title}
                          </p>
                          {!notification.is_read && (
                            <Badge variant="outline" className="bg-primary/10 text-primary border-primary/20 shrink-0">
                              Nueva
                            </Badge>
                          )}
                        </div>
                        <p className="text-sm text-muted-foreground mt-1">
                          {notification.message}
                        </p>
                        <p className="text-xs text-muted-foreground mt-2">
                          {formatDistanceToNow(parseISO(notification.created_at), { 
                            addSuffix: true, 
                            locale: es 
                          })}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </EmployeeLayout>
  );
}
