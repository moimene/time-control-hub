import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { EmployeeLayout } from '@/components/layout/EmployeeLayout';
import { MessageList } from '@/components/communications/MessageList';
import { MessageComposer, type MessageFormData } from '@/components/communications/MessageComposer';
import { MessageThread } from '@/components/communications/MessageThread';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { Plus, Inbox, Send, MessageSquare } from 'lucide-react';

type MessagePriority = 'low' | 'normal' | 'high' | 'urgent';

interface Message {
  id: string;
  company_id: string;
  thread_id: string | null;
  sender_type: 'company' | 'employee';
  sender_employee_id: string | null;
  recipient_type: string;
  recipient_employee_id: string | null;
  subject: string;
  body: string;
  priority: MessagePriority;
  requires_acknowledgment: boolean;
  created_at: string;
  read_at?: string | null;
  acknowledged_at?: string | null;
  sender_employee?: {
    first_name: string;
    last_name: string;
  };
}

export default function EmployeeCommunications() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [showComposer, setShowComposer] = useState(false);
  const [selectedMessage, setSelectedMessage] = useState<Message | null>(null);
  const [replyTo, setReplyTo] = useState<{ id: string; subject: string; sender_name: string } | null>(null);

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

  // Fetch messages with recipient status
  const { data: messages = [], isLoading } = useQuery({
    queryKey: ['employee-messages', employee?.id],
    enabled: !!employee?.id,
    queryFn: async () => {
      // Get messages where employee is recipient or sender
      const { data, error } = await supabase
        .from('company_messages')
        .select(`
          *,
          sender_employee:employees!company_messages_sender_employee_id_fkey(first_name, last_name),
          message_recipients!inner(read_at, acknowledged_at)
        `)
        .eq('message_recipients.employee_id', employee!.id)
        .is('thread_id', null)
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Merge recipient status into message
      return (data || []).map(m => ({
        ...m,
        priority: m.priority as MessagePriority,
        read_at: m.message_recipients?.[0]?.read_at,
        acknowledged_at: m.message_recipients?.[0]?.acknowledged_at,
      })) as Message[];
    },
  });

  // Fetch sent messages
  const { data: sentMessages = [] } = useQuery({
    queryKey: ['employee-sent-messages', employee?.id],
    enabled: !!employee?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('company_messages')
        .select(`
          *,
          sender_employee:employees!company_messages_sender_employee_id_fkey(first_name, last_name)
        `)
        .eq('sender_employee_id', employee!.id)
        .is('thread_id', null)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return (data || []).map(m => ({
        ...m,
        priority: m.priority as MessagePriority,
      })) as Message[];
    },
  });

  // Fetch replies for selected message
  const { data: replies = [] } = useQuery({
    queryKey: ['message-replies', selectedMessage?.id],
    enabled: !!selectedMessage?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('company_messages')
        .select(`
          *,
          sender_employee:employees!company_messages_sender_employee_id_fkey(first_name, last_name)
        `)
        .eq('thread_id', selectedMessage!.id)
        .order('created_at', { ascending: true });

      if (error) throw error;
      return (data || []).map(m => ({
        ...m,
        priority: m.priority as MessagePriority,
      })) as Message[];
    },
  });

  // Mark message as read
  const markAsRead = useMutation({
    mutationFn: async (messageId: string) => {
      const { error } = await supabase
        .from('message_recipients')
        .update({ read_at: new Date().toISOString() })
        .eq('message_id', messageId)
        .eq('employee_id', employee!.id)
        .is('read_at', null);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['employee-messages'] });
    },
  });

  // Acknowledge message
  const acknowledgeMessage = useMutation({
    mutationFn: async (messageId: string) => {
      const { error } = await supabase
        .from('message_recipients')
        .update({ acknowledged_at: new Date().toISOString() })
        .eq('message_id', messageId)
        .eq('employee_id', employee!.id);

      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Lectura confirmada');
      queryClient.invalidateQueries({ queryKey: ['employee-messages'] });
      if (selectedMessage) {
        setSelectedMessage({
          ...selectedMessage,
          acknowledged_at: new Date().toISOString(),
        });
      }
    },
    onError: () => {
      toast.error('Error al confirmar lectura');
    },
  });

  // Send message
  const sendMessage = useMutation({
    mutationFn: async (data: MessageFormData & { thread_id?: string }) => {
      const { error } = await supabase.from('company_messages').insert({
        company_id: employee!.company_id,
        sender_type: 'employee' as const,
        sender_employee_id: employee!.id,
        recipient_type: 'company',
        subject: data.subject,
        body: data.body,
        priority: data.priority,
        requires_acknowledgment: false,
        thread_id: data.thread_id || null,
      });

      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Mensaje enviado correctamente');
      setShowComposer(false);
      setReplyTo(null);
      queryClient.invalidateQueries({ queryKey: ['employee-sent-messages'] });
      queryClient.invalidateQueries({ queryKey: ['message-replies'] });
    },
    onError: (error) => {
      toast.error('Error al enviar el mensaje');
      console.error(error);
    },
  });

  // Mark as read when selecting message
  useEffect(() => {
    if (selectedMessage && !selectedMessage.read_at && selectedMessage.sender_type === 'company') {
      markAsRead.mutate(selectedMessage.id);
    }
  }, [selectedMessage?.id]);

  const handleSelectMessage = (message: Message) => {
    setSelectedMessage(message);
    setShowComposer(false);
    setReplyTo(null);
  };

  const handleReply = () => {
    if (selectedMessage) {
      setReplyTo({
        id: selectedMessage.id,
        subject: selectedMessage.subject,
        sender_name: 'Empresa',
      });
      setShowComposer(true);
    }
  };

  const handleSendMessage = async (data: MessageFormData) => {
    await sendMessage.mutateAsync({
      ...data,
      thread_id: replyTo ? (selectedMessage?.thread_id || selectedMessage?.id) : undefined,
    });
  };

  const unreadCount = messages.filter(m => !m.read_at).length;

  return (
    <EmployeeLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Comunicaciones</h1>
            <p className="text-muted-foreground">
              Mensajes con la empresa
            </p>
          </div>
          <Button onClick={() => { setShowComposer(true); setSelectedMessage(null); setReplyTo(null); }}>
            <Plus className="h-4 w-4 mr-2" />
            Nuevo mensaje
          </Button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Messages List */}
          <div className="lg:col-span-1">
            <Card className="h-[calc(100vh-220px)]">
              <Tabs defaultValue="inbox" className="h-full flex flex-col">
                <CardHeader className="pb-2">
                  <TabsList className="grid w-full grid-cols-2">
                    <TabsTrigger value="inbox" className="gap-2">
                      <Inbox className="h-4 w-4" />
                      Recibidos
                      {unreadCount > 0 && (
                        <Badge variant="destructive" className="ml-1">
                          {unreadCount}
                        </Badge>
                      )}
                    </TabsTrigger>
                    <TabsTrigger value="sent" className="gap-2">
                      <Send className="h-4 w-4" />
                      Enviados
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
                  <TabsContent value="sent" className="mt-0 h-full">
                    <MessageList
                      messages={sentMessages}
                      selectedId={selectedMessage?.id}
                      onSelect={handleSelectMessage}
                      viewType="employee"
                    />
                  </TabsContent>
                </CardContent>
              </Tabs>
            </Card>
          </div>

          {/* Message Detail / Composer */}
          <div className="lg:col-span-2">
            {showComposer ? (
              <MessageComposer
                mode="employee"
                replyTo={replyTo || undefined}
                onSubmit={handleSendMessage}
                onCancel={() => { setShowComposer(false); setReplyTo(null); }}
                isSubmitting={sendMessage.isPending}
              />
            ) : selectedMessage ? (
              <MessageThread
                message={selectedMessage}
                replies={replies}
                viewType="employee"
                onReply={handleReply}
                onAcknowledge={() => acknowledgeMessage.mutate(selectedMessage.id)}
                isAcknowledging={acknowledgeMessage.isPending}
              />
            ) : (
              <Card className="h-[calc(100vh-220px)] flex items-center justify-center">
                <div className="text-center text-muted-foreground">
                  <MessageSquare className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>Selecciona un mensaje para ver los detalles</p>
                  <p className="text-sm mt-2">o envía un nuevo mensaje a la empresa</p>
                </div>
              </Card>
            )}
          </div>
        </div>
      </div>
    </EmployeeLayout>
  );
}
