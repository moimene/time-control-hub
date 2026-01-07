import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Bell, MessageSquare, AlertTriangle, FileText, X, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

interface KioskNotification {
  id: string;
  notification_type: 'message' | 'document' | 'alert';
  reference_id: string;
  title: string;
  preview: string | null;
  priority: 'baja' | 'normal' | 'alta' | 'urgente';
  status: 'pending' | 'shown' | 'actioned';
  expires_at: string | null;
  created_at: string;
}

interface KioskNotificationBadgeProps {
  employeeId: string;
  companyId: string;
  onViewMessage?: (threadId: string) => void;
}

const priorityColors: Record<string, string> = {
  baja: 'bg-muted text-muted-foreground',
  normal: 'bg-primary/10 text-primary',
  alta: 'bg-yellow-500/10 text-yellow-600',
  urgente: 'bg-destructive/10 text-destructive',
};

const typeIcons: Record<string, typeof MessageSquare> = {
  message: MessageSquare,
  document: FileText,
  alert: AlertTriangle,
};

export function KioskNotificationBadge({ 
  employeeId, 
  companyId,
  onViewMessage 
}: KioskNotificationBadgeProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [hasNewNotifications, setHasNewNotifications] = useState(false);

  // Fetch pending notifications
  const { data: notifications = [], refetch } = useQuery({
    queryKey: ['kiosk-notifications', employeeId],
    enabled: !!employeeId,
    refetchInterval: 30000, // Refresh every 30 seconds
    queryFn: async () => {
      const { data, error } = await supabase
        .from('kiosk_notifications')
        .select('*')
        .eq('employee_id', employeeId)
        .eq('company_id', companyId)
        .in('status', ['pending', 'shown'])
        .order('priority', { ascending: false })
        .order('created_at', { ascending: false })
        .limit(10);

      if (error) throw error;
      return (data || []) as KioskNotification[];
    },
  });

  // Subscribe to realtime updates
  useEffect(() => {
    if (!employeeId) return;

    const channel = supabase
      .channel(`kiosk-notifications-${employeeId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'kiosk_notifications',
          filter: `employee_id=eq.${employeeId}`,
        },
        () => {
          setHasNewNotifications(true);
          refetch();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [employeeId, refetch]);

  // Mark notifications as shown when panel opens
  useEffect(() => {
    if (isOpen && notifications.length > 0) {
      const pendingIds = notifications
        .filter(n => n.status === 'pending')
        .map(n => n.id);
      
      if (pendingIds.length > 0) {
        supabase
          .from('kiosk_notifications')
          .update({ status: 'shown', shown_at: new Date().toISOString() })
          .in('id', pendingIds)
          .then(() => {
            setHasNewNotifications(false);
            refetch();
          });
      }
    }
  }, [isOpen, notifications, refetch]);

  const handleNotificationClick = async (notification: KioskNotification) => {
    // Mark as actioned
    await supabase
      .from('kiosk_notifications')
      .update({ status: 'actioned', actioned_at: new Date().toISOString() })
      .eq('id', notification.id);

    refetch();

    // Handle based on type
    if (notification.notification_type === 'message' && onViewMessage) {
      onViewMessage(notification.reference_id);
      setIsOpen(false);
    }
  };

  const pendingCount = notifications.filter(n => n.status === 'pending').length;
  const showBadge = notifications.length > 0;

  if (!showBadge) return null;

  return (
    <div className="fixed top-4 right-4 z-50">
      {/* Bell button */}
      <Button
        variant="outline"
        size="icon"
        className={cn(
          'relative h-12 w-12 rounded-full shadow-lg',
          hasNewNotifications && 'animate-pulse'
        )}
        onClick={() => setIsOpen(!isOpen)}
      >
        <Bell className="h-6 w-6" />
        {pendingCount > 0 && (
          <Badge 
            variant="destructive" 
            className="absolute -top-1 -right-1 h-5 w-5 p-0 flex items-center justify-center text-xs"
          >
            {pendingCount}
          </Badge>
        )}
      </Button>

      {/* Notification panel */}
      {isOpen && (
        <Card className="absolute right-0 top-16 w-80 shadow-xl">
          <CardHeader className="pb-2 flex flex-row items-center justify-between">
            <CardTitle className="text-base">Notificaciones</CardTitle>
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6"
              onClick={() => setIsOpen(false)}
            >
              <X className="h-4 w-4" />
            </Button>
          </CardHeader>
          <CardContent className="p-0">
            <ScrollArea className="h-80">
              {notifications.length === 0 ? (
                <div className="p-4 text-center text-muted-foreground text-sm">
                  No hay notificaciones pendientes
                </div>
              ) : (
                <div className="divide-y">
                  {notifications.map((notification) => {
                    const Icon = typeIcons[notification.notification_type] || Bell;
                    return (
                      <button
                        key={notification.id}
                        className={cn(
                          'w-full p-3 text-left hover:bg-accent/50 transition-colors flex items-start gap-3',
                          notification.status === 'pending' && 'bg-primary/5'
                        )}
                        onClick={() => handleNotificationClick(notification)}
                      >
                        <div className={cn(
                          'p-2 rounded-full shrink-0',
                          priorityColors[notification.priority]
                        )}>
                          <Icon className="h-4 w-4" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className={cn(
                            'text-sm font-medium truncate',
                            notification.status === 'pending' && 'font-semibold'
                          )}>
                            {notification.title}
                          </p>
                          {notification.preview && (
                            <p className="text-xs text-muted-foreground truncate">
                              {notification.preview}
                            </p>
                          )}
                          <p className="text-xs text-muted-foreground mt-1">
                            {format(new Date(notification.created_at), "d MMM, HH:mm", { locale: es })}
                          </p>
                        </div>
                        <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0 self-center" />
                      </button>
                    );
                  })}
                </div>
              )}
            </ScrollArea>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
