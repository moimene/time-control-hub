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
import { Plus, Inbox, Send, Users, Loader2 } from 'lucide-react';

type MessagePriority = 'baja' | 'normal' | 'alta' | 'urgente';

interface Message {
  id: string;
  company_id: string;
  subject: string;
  body: string;
  priority: MessagePriority;
  thread_type: string;
  sender_type: 'company' | 'employee';
  requires_read_confirmation: boolean;
  created_at: string;
  status: string;
  audience_type: string;
  recipient_count: number;
  read_at?: string | null;
  acknowledged_at?: string | null;
  sender_employee?: {
    first_name: string;
    last_name: string;
  } | null;
}

// Map old priority to new
const mapPriority = (p: string): MessagePriority => {
  const map: Record<string, MessagePriority> = {
    low: 'baja',
    normal: 'normal', 
    high: 'alta',
    urgent: 'urgente',
    baja: 'baja',
    alta: 'alta',
    urgente: 'urgente'
  };
  return map[p] || 'normal';
};

export default function Communications() {
  const { company } = useCompany();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [showComposer, setShowComposer] = useState(false);
  const [selectedMessage, setSelectedMessage] = useState<Message | null>(null);
  const [replyTo, setReplyTo] = useState<{ id: string; subject: string; sender_name: string } | null>(null);

  // Fetch all message threads
  const { data: threads = [], isLoading } = useQuery({
    queryKey: ['admin-message-threads', company?.id],
    enabled: !!company?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('message_threads')
        .select('*')
        .eq('company_id', company!.id)
        .in('status', ['sent', 'closed'])
        .order('created_at', { ascending: false });

      if (error) throw error;
      
      return (data || []).map(t => ({
        id: t.id,
        company_id: t.company_id,
        subject: t.subject,
        body: '', // Will be fetched from content
        priority: t.priority as MessagePriority,
        thread_type: t.thread_type,
        sender_type: 'company' as const,
        requires_read_confirmation: t.requires_read_confirmation,
        created_at: t.sent_at || t.created_at,
        status: t.status,
        audience_type: t.audience_type,
        recipient_count: t.recipient_count || 0,
      })) as Message[];
    },
  });

  // Fetch content for selected thread
  const { data: threadContent } = useQuery({
    queryKey: ['thread-content', selectedMessage?.id],
    enabled: !!selectedMessage?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('message_contents')
        .select('*')
        .eq('thread_id', selectedMessage!.id)
        .eq('is_current', true)
        .single();

      if (error && error.code !== 'PGRST116') throw error;
      return data;
    },
  });

  // Fetch recipients for selected thread
  const { data: recipients = [] } = useQuery({
    queryKey: ['thread-recipients', selectedMessage?.id],
    enabled: !!selectedMessage?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('message_recipients')
        .select(`
          *,
          employee:employees(first_name, last_name)
        `)
        .eq('thread_id', selectedMessage!.id)
        .order('created_at', { ascending: true });

      if (error) throw error;
      return data || [];
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
    mutationFn: async (data: MessageFormData) => {
      // Compute hash of message content
      const contentToHash = JSON.stringify({
        subject: data.subject,
        body: data.body,
        timestamp: new Date().toISOString(),
      });
      const contentHash = await computeHash(contentToHash);

      // Create thread
      const audienceType = data.recipient_type === 'all_employees' ? 'all' : 
                          data.recipient_type === 'department' ? 'department' :
                          'individual';
      
      const audienceFilter = data.recipient_type === 'department' 
        ? { department: data.recipient_department }
        : data.recipient_type === 'employee' && data.recipient_employee_id
        ? { employee_ids: [data.recipient_employee_id] }
        : null;

      const { data: thread, error: threadError } = await supabase
        .from('message_threads')
        .insert({
          company_id: company!.id,
          subject: data.subject,
          thread_type: 'notificacion',
          priority: mapPriority(data.priority),
          requires_read_confirmation: data.requires_acknowledgment,
          status: 'sent',
          sent_at: new Date().toISOString(),
          created_by: user!.id,
          sender_role: 'admin',
          audience_type: audienceType,
          audience_filter: audienceFilter,
          certification_level: 'complete',
          content_hash: contentHash,
        })
        .select('id')
        .single();

      if (threadError) throw threadError;

      // Create content
      const { error: contentError } = await supabase
        .from('message_contents')
        .insert({
          thread_id: thread.id,
          body_text: data.body,
          body_markdown: data.body,
        });

      if (contentError) throw contentError;

      // Call QTSP to timestamp the message (async, non-blocking)
      supabase.functions.invoke('qtsp-notarize', {
        body: {
          action: 'timestamp_message',
          company_id: company!.id,
          thread_id: thread.id,
          content_hash: contentHash,
        },
      }).then(({ error: qtspError }) => {
        if (qtspError) {
          console.error('QTSP timestamp failed (non-blocking):', qtspError);
        } else {
          console.log('Message timestamped via QTSP');
        }
      });

      return thread;
    },
    onSuccess: () => {
      toast.success('Mensaje enviado correctamente');
      setShowComposer(false);
      setReplyTo(null);
      queryClient.invalidateQueries({ queryKey: ['admin-message-threads'] });
    },
    onError: (error) => {
      toast.error('Error al enviar el mensaje');
      console.error(error);
    },
  });

  // Stats
  const totalRecipients = threads.reduce((sum, t) => sum + (t.recipient_count || 0), 0);
  const readCount = recipients.filter(r => r.first_read_at).length;

  const handleSelectMessage = (message: Message) => {
    setSelectedMessage(message);
    setShowComposer(false);
    setReplyTo(null);
  };

  const handleReply = () => {
    // Reply functionality - would create a new thread
    toast.info('Función de respuesta disponible próximamente');
  };

  const handleSendMessage = async (data: MessageFormData) => {
    await sendMessage.mutateAsync(data);
  };

  // Combine thread with content for display
  const getMessageWithContent = (): Message | null => {
    if (!selectedMessage) return null;
    return {
      ...selectedMessage,
      body: threadContent?.body_text || threadContent?.body_markdown || '',
    };
  };

  if (isLoading) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Comunicaciones Certificadas</h1>
            <p className="text-muted-foreground">
              Gestiona las comunicaciones oficiales con los empleados
            </p>
          </div>
          <Button onClick={() => { setShowComposer(true); setSelectedMessage(null); setReplyTo(null); }}>
            <Plus className="h-4 w-4 mr-2" />
            Nueva comunicación
          </Button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Messages List */}
          <div className="lg:col-span-1">
            <Card className="h-[calc(100vh-220px)]">
              <Tabs defaultValue="sent" className="h-full flex flex-col">
                <CardHeader className="pb-2">
                  <TabsList className="grid w-full grid-cols-1">
                    <TabsTrigger value="sent" className="gap-2">
                      <Send className="h-4 w-4" />
                      Enviados
                      {threads.length > 0 && (
                        <Badge variant="secondary" className="ml-1">
                          {threads.length}
                        </Badge>
                      )}
                    </TabsTrigger>
                  </TabsList>
                </CardHeader>
                <CardContent className="flex-1 overflow-auto">
                  <TabsContent value="sent" className="mt-0 h-full">
                    <MessageList
                      messages={threads}
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
              <Card className="h-[calc(100vh-220px)]">
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div>
                      <h2 className="text-xl font-semibold">{selectedMessage.subject}</h2>
                      <p className="text-sm text-muted-foreground">
                        Enviado el {new Date(selectedMessage.created_at).toLocaleDateString('es-ES')} a {selectedMessage.recipient_count} destinatarios
                      </p>
                    </div>
                    <Badge variant={selectedMessage.priority === 'urgente' ? 'destructive' : 'secondary'}>
                      {selectedMessage.priority}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="prose prose-sm max-w-none">
                    <p className="whitespace-pre-wrap">{threadContent?.body_text || threadContent?.body_markdown || 'Cargando contenido...'}</p>
                  </div>
                  
                  {recipients.length > 0 && (
                    <div className="border-t pt-4">
                      <h3 className="font-medium mb-3">Estado de entrega ({recipients.length})</h3>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-48 overflow-auto">
                        {recipients.map((r) => (
                          <div key={r.id} className="flex items-center justify-between p-2 rounded bg-muted/50">
                            <span className="text-sm">
                              {r.employee?.first_name} {r.employee?.last_name}
                            </span>
                            <Badge variant={r.first_read_at ? 'default' : 'outline'} className="text-xs">
                              {r.first_read_at ? 'Leído' : 'Pendiente'}
                            </Badge>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            ) : (
              <Card className="h-[calc(100vh-220px)] flex items-center justify-center">
                <div className="text-center text-muted-foreground">
                  <Users className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>Selecciona un mensaje para ver los detalles</p>
                  <p className="text-sm mt-2">o crea una nueva comunicación para los empleados</p>
                </div>
              </Card>
            )}
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
