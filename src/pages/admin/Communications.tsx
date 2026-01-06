import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useCompany } from '@/hooks/useCompany';
import { useAuth } from '@/hooks/useAuth';
import { AppLayout } from '@/components/layout/AppLayout';
import { MessageList } from '@/components/communications/MessageList';
import { MessageComposer, type MessageFormData } from '@/components/communications/MessageComposer';
import { MessageThread } from '@/components/communications/MessageThread';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { Plus, Inbox, Send, Users } from 'lucide-react';

type MessagePriority = 'low' | 'normal' | 'high' | 'urgent';

interface Message {
  id: string;
  company_id: string;
  thread_id: string | null;
  sender_type: 'company' | 'employee';
  sender_user_id: string | null;
  sender_employee_id: string | null;
  recipient_type: string;
  recipient_employee_id: string | null;
  recipient_department: string | null;
  subject: string;
  body: string;
  priority: MessagePriority;
  requires_acknowledgment: boolean;
  created_at: string;
  sender_employee?: {
    first_name: string;
    last_name: string;
  };
  recipient_employee?: {
    first_name: string;
    last_name: string;
  };
}

export default function Communications() {
  const { company } = useCompany();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [showComposer, setShowComposer] = useState(false);
  const [selectedMessage, setSelectedMessage] = useState<Message | null>(null);
  const [replyTo, setReplyTo] = useState<{ id: string; subject: string; sender_name: string } | null>(null);

  // Fetch all messages
  const { data: messages = [], isLoading } = useQuery({
    queryKey: ['admin-messages', company?.id],
    enabled: !!company?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('company_messages')
        .select(`
          *,
          sender_employee:employees!company_messages_sender_employee_id_fkey(first_name, last_name),
          recipient_employee:employees!company_messages_recipient_employee_id_fkey(first_name, last_name)
        `)
        .eq('company_id', company!.id)
        .is('thread_id', null)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return (data || []).map(m => ({
        ...m,
        priority: m.priority as MessagePriority
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
        priority: m.priority as MessagePriority
      })) as Message[];
    },
  });

  // Fetch employees for recipient selection
  const { data: employees = [] } = useQuery({
    queryKey: ['employees-for-messages', company?.id],
    enabled: !!company?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('employees')
        .select('id, first_name, last_name, department')
        .eq('company_id', company!.id)
        .eq('status', 'active')
        .order('first_name');

      if (error) throw error;
      return data || [];
    },
  });

  // Get unique departments
  const departments = [...new Set(employees.map(e => e.department).filter(Boolean))] as string[];

  // Compute SHA-256 hash from content
  const computeHash = async (content: string): Promise<string> => {
    const encoder = new TextEncoder();
    const data = encoder.encode(content);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  };

  // Send message mutation with QTSP certification
  const sendMessage = useMutation({
    mutationFn: async (data: MessageFormData & { thread_id?: string }) => {
      // Compute hash of message content
      const contentToHash = JSON.stringify({
        subject: data.subject,
        body: data.body,
        recipient_type: data.recipient_type,
        timestamp: new Date().toISOString(),
      });
      const contentHash = await computeHash(contentToHash);

      // Insert message with hash
      const { data: insertedMessage, error } = await supabase
        .from('company_messages')
        .insert({
          company_id: company!.id,
          sender_type: 'company' as const,
          sender_user_id: user!.id,
          recipient_type: data.recipient_type,
          recipient_employee_id: data.recipient_employee_id || null,
          recipient_department: data.recipient_department || null,
          subject: data.subject,
          body: data.body,
          priority: data.priority,
          requires_acknowledgment: data.requires_acknowledgment,
          thread_id: data.thread_id || null,
          content_hash: contentHash,
        })
        .select('id')
        .single();

      if (error) throw error;

      // Call QTSP to timestamp the message (async, non-blocking)
      supabase.functions.invoke('qtsp-notarize', {
        body: {
          action: 'timestamp_message',
          company_id: company!.id,
          message_id: insertedMessage.id,
          content_hash: contentHash,
        },
      }).then(({ error: qtspError }) => {
        if (qtspError) {
          console.error('QTSP timestamp failed (non-blocking):', qtspError);
        } else {
          console.log('Message timestamped via QTSP');
        }
      });

      return insertedMessage;
    },
    onSuccess: () => {
      toast.success('Mensaje enviado correctamente');
      setShowComposer(false);
      setReplyTo(null);
      queryClient.invalidateQueries({ queryKey: ['admin-messages'] });
      queryClient.invalidateQueries({ queryKey: ['message-replies'] });
    },
    onError: (error) => {
      toast.error('Error al enviar el mensaje');
      console.error(error);
    },
  });

  // Filter messages
  const inboxMessages = messages.filter(m => m.sender_type === 'employee');
  const sentMessages = messages.filter(m => m.sender_type === 'company');

  const handleSelectMessage = (message: Message) => {
    setSelectedMessage(message);
    setShowComposer(false);
    setReplyTo(null);
  };

  const handleReply = () => {
    if (selectedMessage) {
      const senderName = selectedMessage.sender_type === 'employee' && selectedMessage.sender_employee
        ? `${selectedMessage.sender_employee.first_name} ${selectedMessage.sender_employee.last_name}`
        : 'Empleado';
      setReplyTo({
        id: selectedMessage.id,
        subject: selectedMessage.subject,
        sender_name: senderName,
      });
      setShowComposer(true);
    }
  };

  const handleSendMessage = async (data: MessageFormData) => {
    // If replying, set recipient to the original sender
    if (replyTo && selectedMessage?.sender_employee_id) {
      await sendMessage.mutateAsync({
        ...data,
        recipient_type: 'employee',
        recipient_employee_id: selectedMessage.sender_employee_id,
        thread_id: selectedMessage.thread_id || selectedMessage.id,
      });
    } else {
      await sendMessage.mutateAsync(data);
    }
  };

  return (
    <AppLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Comunicaciones</h1>
            <p className="text-muted-foreground">
              Gestiona las comunicaciones con los empleados
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
                      {inboxMessages.length > 0 && (
                        <Badge variant="secondary" className="ml-1">
                          {inboxMessages.length}
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
                      messages={inboxMessages}
                      selectedId={selectedMessage?.id}
                      onSelect={handleSelectMessage}
                      viewType="admin"
                    />
                  </TabsContent>
                  <TabsContent value="sent" className="mt-0 h-full">
                    <MessageList
                      messages={sentMessages}
                      selectedId={selectedMessage?.id}
                      onSelect={handleSelectMessage}
                      viewType="admin"
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
                mode="admin"
                employees={employees}
                departments={departments}
                replyTo={replyTo || undefined}
                onSubmit={handleSendMessage}
                onCancel={() => { setShowComposer(false); setReplyTo(null); }}
                isSubmitting={sendMessage.isPending}
              />
            ) : selectedMessage ? (
              <MessageThread
                message={selectedMessage}
                replies={replies}
                viewType="admin"
                onReply={handleReply}
              />
            ) : (
              <Card className="h-[calc(100vh-220px)] flex items-center justify-center">
                <div className="text-center text-muted-foreground">
                  <Users className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>Selecciona un mensaje para ver los detalles</p>
                  <p className="text-sm mt-2">o crea un nuevo mensaje para comunicarte con los empleados</p>
                </div>
              </Card>
            )}
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
