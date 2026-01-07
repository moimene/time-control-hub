import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { EmployeeLayout } from '@/components/layout/EmployeeLayout';
import { MessageList } from '@/components/communications/MessageList';
import { MessageComposer, type MessageFormData } from '@/components/communications/MessageComposer';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { Inbox, MessageSquare, Loader2, CheckCircle2, Clock } from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

type MessagePriority = 'baja' | 'normal' | 'alta' | 'urgente';

interface Message {
  id: string;
  thread_id: string;
  recipient_id: string;
  company_id: string;
  subject: string;
  body: string;
  priority: MessagePriority;
  thread_type: string;
  sender_type: 'company' | 'employee';
  requires_read_confirmation: boolean;
  created_at: string;
  read_at?: string | null;
  acknowledged_at?: string | null;
  first_read_at?: string | null;
  responded_at?: string | null;
}

export default function EmployeeCommunications() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [selectedMessage, setSelectedMessage] = useState<Message | null>(null);

  // Fetch employee info
  const { data: employee } = useQuery({
    queryKey: ['current-employee', user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('employees')
        .select('id, company_id')
        .eq('user_id', user!.id)
        .single();

      if (error) throw error;
      return data;
    },
  });

  // Fetch messages for employee (via message_recipients)
  const { data: messages = [], isLoading } = useQuery({
    queryKey: ['employee-messages', employee?.id],
    enabled: !!employee?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('message_recipients')
        .select(`
          id,
          thread_id,
          company_id,
          delivery_status,
          first_read_at,
          responded_at,
          created_at,
          thread:message_threads(
            id,
            subject,
            priority,
            thread_type,
            requires_read_confirmation,
            sent_at,
            created_by
          )
        `)
        .eq('employee_id', employee!.id)
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Transform to expected format
      return (data || []).map(r => ({
        id: r.thread_id,
        thread_id: r.thread_id,
        recipient_id: r.id,
        company_id: r.company_id,
        subject: r.thread?.subject || 'Sin asunto',
        body: '', // Will be fetched separately
        priority: (r.thread?.priority || 'normal') as MessagePriority,
        thread_type: r.thread?.thread_type || 'notificacion',
        sender_type: 'company' as const,
        requires_read_confirmation: r.thread?.requires_read_confirmation || false,
        created_at: r.thread?.sent_at || r.created_at,
        read_at: r.first_read_at,
        first_read_at: r.first_read_at,
        acknowledged_at: r.first_read_at, // Use first_read_at as acknowledged
        responded_at: r.responded_at,
      })) as Message[];
    },
  });

  // Fetch content for selected thread
  const { data: threadContent } = useQuery({
    queryKey: ['thread-content', selectedMessage?.thread_id],
    enabled: !!selectedMessage?.thread_id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('message_contents')
        .select('*')
        .eq('thread_id', selectedMessage!.thread_id)
        .eq('is_current', true)
        .single();

      if (error && error.code !== 'PGRST116') throw error;
      return data;
    },
  });

  // Mark message as read
  const markAsRead = useMutation({
    mutationFn: async (recipientId: string) => {
      const now = new Date().toISOString();
      const { error } = await supabase
        .from('message_recipients')
        .update({ 
          first_read_at: now,
          last_read_at: now,
          read_count: 1,
          delivery_status: 'read'
        })
        .eq('id', recipientId)
        .is('first_read_at', null);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['employee-messages'] });
    },
  });

  // Confirm read (acknowledge)
  const confirmRead = useMutation({
    mutationFn: async (recipientId: string) => {
      const now = new Date().toISOString();
      const { error } = await supabase
        .from('message_recipients')
        .update({ 
          first_read_at: now,
          last_read_at: now,
          read_count: 1,
          delivery_status: 'read'
        })
        .eq('id', recipientId);

      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Lectura confirmada');
      queryClient.invalidateQueries({ queryKey: ['employee-messages'] });
      if (selectedMessage) {
        setSelectedMessage({
          ...selectedMessage,
          read_at: new Date().toISOString(),
          first_read_at: new Date().toISOString(),
          acknowledged_at: new Date().toISOString(),
        });
      }
    },
    onError: () => {
      toast.error('Error al confirmar lectura');
    },
  });

  // Mark as read when selecting message
  useEffect(() => {
    if (selectedMessage && !selectedMessage.read_at && selectedMessage.recipient_id) {
      markAsRead.mutate(selectedMessage.recipient_id);
    }
  }, [selectedMessage?.id]);

  const handleSelectMessage = (message: Message) => {
    setSelectedMessage(message);
  };

  const unreadCount = messages.filter(m => !m.read_at).length;

  const getPriorityBadge = (priority: MessagePriority) => {
    const config: Record<MessagePriority, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
      baja: { label: 'Baja', variant: 'secondary' },
      normal: { label: 'Normal', variant: 'outline' },
      alta: { label: 'Alta', variant: 'default' },
      urgente: { label: 'Urgente', variant: 'destructive' },
    };
    return config[priority] || config.normal;
  };

  if (isLoading) {
    return (
      <EmployeeLayout>
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </EmployeeLayout>
    );
  }

  return (
    <EmployeeLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Comunicaciones</h1>
            <p className="text-muted-foreground">
              Mensajes oficiales de la empresa
            </p>
          </div>
          {unreadCount > 0 && (
            <Badge variant="destructive">
              {unreadCount} sin leer
            </Badge>
          )}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Messages List */}
          <div className="lg:col-span-1">
            <Card className="h-[calc(100vh-220px)]">
              <Tabs defaultValue="inbox" className="h-full flex flex-col">
                <CardHeader className="pb-2">
                  <TabsList className="grid w-full grid-cols-1">
                    <TabsTrigger value="inbox" className="gap-2">
                      <Inbox className="h-4 w-4" />
                      Buzón
                      {unreadCount > 0 && (
                        <Badge variant="destructive" className="ml-1">
                          {unreadCount}
                        </Badge>
                      )}
                    </TabsTrigger>
                  </TabsList>
                </CardHeader>
                <CardContent className="flex-1 overflow-auto">
                  <TabsContent value="inbox" className="mt-0 h-full">
                    <MessageList
                      messages={messages}
                      selectedId={selectedMessage?.id}
                      onSelect={handleSelectMessage}
                      viewType="employee"
                    />
                  </TabsContent>
                </CardContent>
              </Tabs>
            </Card>
          </div>

          {/* Message Detail */}
          <div className="lg:col-span-2">
            {selectedMessage ? (
              <Card className="h-[calc(100vh-220px)] flex flex-col">
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <h2 className="text-xl font-semibold">{selectedMessage.subject}</h2>
                      <p className="text-sm text-muted-foreground mt-1">
                        Recibido el {format(new Date(selectedMessage.created_at), "d 'de' MMMM yyyy, HH:mm", { locale: es })}
                      </p>
                    </div>
                    <Badge variant={getPriorityBadge(selectedMessage.priority).variant}>
                      {getPriorityBadge(selectedMessage.priority).label}
                    </Badge>
                  </div>

                  {selectedMessage.requires_read_confirmation && (
                    <div className={`flex items-center gap-2 text-sm p-2 rounded-md mt-3 ${
                      selectedMessage.acknowledged_at 
                        ? 'bg-green-500/10 text-green-600'
                        : 'bg-yellow-500/10 text-yellow-700'
                    }`}>
                      {selectedMessage.acknowledged_at ? (
                        <>
                          <CheckCircle2 className="h-4 w-4" />
                          <span>
                            Confirmado el {format(new Date(selectedMessage.acknowledged_at), "d MMM yyyy, HH:mm", { locale: es })}
                          </span>
                        </>
                      ) : (
                        <>
                          <Clock className="h-4 w-4" />
                          <span>Este mensaje requiere confirmación de lectura</span>
                        </>
                      )}
                    </div>
                  )}
                </CardHeader>

                <CardContent className="flex-1 overflow-auto">
                  <div className="prose prose-sm max-w-none">
                    <p className="whitespace-pre-wrap">
                      {threadContent?.body_text || threadContent?.body_markdown || 'Cargando contenido...'}
                    </p>
                  </div>
                </CardContent>

                {selectedMessage.requires_read_confirmation && !selectedMessage.acknowledged_at && (
                  <div className="p-4 border-t">
                    <Button 
                      onClick={() => confirmRead.mutate(selectedMessage.recipient_id)}
                      disabled={confirmRead.isPending}
                      className="w-full bg-green-600 hover:bg-green-700"
                    >
                      <CheckCircle2 className="h-4 w-4 mr-2" />
                      {confirmRead.isPending ? 'Confirmando...' : 'Confirmar lectura'}
                    </Button>
                    <p className="text-xs text-muted-foreground text-center mt-2">
                      🔒 Tu confirmación quedará registrada con sello de tiempo cualificado
                    </p>
                  </div>
                )}
              </Card>
            ) : (
              <Card className="h-[calc(100vh-220px)] flex items-center justify-center">
                <div className="text-center text-muted-foreground">
                  <MessageSquare className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>Selecciona un mensaje para ver los detalles</p>
                  <p className="text-sm mt-2">Las comunicaciones oficiales aparecerán aquí</p>
                </div>
              </Card>
            )}
          </div>
        </div>
      </div>
    </EmployeeLayout>
  );
}
