import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useCompany } from '@/hooks/useCompany';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { format, formatDistanceToNow } from 'date-fns';
import { es } from 'date-fns/locale';
import { Clock, Send, Users, Calendar, Trash2, Edit2, Loader2 } from 'lucide-react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

interface ScheduledMessage {
  id: string;
  subject: string;
  priority: string;
  scheduled_at: string;
  audience_type: string;
  recipient_count: number;
  thread_type: string;
}

export function ScheduledMessagesPanel() {
  const { company } = useCompany();
  const queryClient = useQueryClient();

  const { data: scheduledMessages = [], isLoading } = useQuery({
    queryKey: ['scheduled-messages', company?.id],
    queryFn: async () => {
      if (!company?.id) return [];
      const { data, error } = await supabase
        .from('message_threads')
        .select('id, subject, priority, scheduled_at, audience_type, recipient_count, thread_type')
        .eq('company_id', company.id)
        .eq('status', 'scheduled')
        .order('scheduled_at', { ascending: true });
      if (error) throw error;
      return data as ScheduledMessage[];
    },
    enabled: !!company?.id
  });

  const cancelMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('message_threads')
        .update({ status: 'draft' })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Envío cancelado, mensaje movido a borradores');
      queryClient.invalidateQueries({ queryKey: ['scheduled-messages'] });
      queryClient.invalidateQueries({ queryKey: ['admin-message-threads'] });
    },
    onError: () => {
      toast.error('Error al cancelar el envío');
    }
  });

  const sendNowMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('message_threads')
        .update({ 
          status: 'sent',
          sent_at: new Date().toISOString()
        })
        .eq('id', id);
      if (error) throw error;

      await supabase.functions.invoke('message-send', {
        body: { thread_id: id, send_now: true }
      });
    },
    onSuccess: () => {
      toast.success('Mensaje enviado');
      queryClient.invalidateQueries({ queryKey: ['scheduled-messages'] });
      queryClient.invalidateQueries({ queryKey: ['admin-message-threads'] });
    },
    onError: () => {
      toast.error('Error al enviar el mensaje');
    }
  });

  const priorityColors: Record<string, string> = {
    baja: 'bg-muted text-muted-foreground',
    normal: 'bg-blue-100 text-blue-700',
    alta: 'bg-yellow-100 text-yellow-800',
    urgente: 'bg-destructive/10 text-destructive',
  };

  const audienceLabels: Record<string, string> = {
    all: 'Todos',
    department: 'Departamento',
    individual: 'Individual',
    custom: 'Personalizado',
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  if (scheduledMessages.length === 0) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-12">
          <Calendar className="h-12 w-12 text-muted-foreground mb-4" />
          <p className="text-muted-foreground">No hay mensajes programados</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Clock className="h-5 w-5" />
          Mensajes Programados
        </CardTitle>
      </CardHeader>
      <CardContent>
        <ScrollArea className="h-[400px]">
          <div className="space-y-3">
            {scheduledMessages.map((message) => {
              const scheduledDate = new Date(message.scheduled_at);
              const isPast = scheduledDate < new Date();

              return (
                <div
                  key={message.id}
                  className="p-4 border rounded-lg hover:bg-muted/50 transition-colors"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <p className="font-medium truncate">{message.subject}</p>
                        <Badge className={priorityColors[message.priority]}>
                          {message.priority}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-4 text-sm text-muted-foreground">
                        <div className="flex items-center gap-1">
                          <Users className="h-3.5 w-3.5" />
                          {audienceLabels[message.audience_type]} 
                          {message.recipient_count > 0 && ` (${message.recipient_count})`}
                        </div>
                        <div className="flex items-center gap-1">
                          <Calendar className="h-3.5 w-3.5" />
                          {format(scheduledDate, "d MMM yyyy, HH:mm", { locale: es })}
                        </div>
                      </div>
                      <p className={`text-xs mt-1 ${isPast ? 'text-destructive' : 'text-muted-foreground'}`}>
                        {isPast ? 'Pendiente de envío' : `Envío ${formatDistanceToNow(scheduledDate, { addSuffix: true, locale: es })}`}
                      </p>
                    </div>

                    <div className="flex gap-1">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => sendNowMutation.mutate(message.id)}
                        disabled={sendNowMutation.isPending}
                      >
                        <Send className="h-3.5 w-3.5 mr-1" />
                        Enviar ahora
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="text-destructive hover:text-destructive"
                        onClick={() => cancelMutation.mutate(message.id)}
                        disabled={cancelMutation.isPending}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}
