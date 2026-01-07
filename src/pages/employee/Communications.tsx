import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { EmployeeLayout } from '@/components/layout/EmployeeLayout';
import { MessageList } from '@/components/communications/MessageList';
import { EmployeeMessageReader } from '@/components/communications/EmployeeMessageReader';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Inbox, Loader2, AlertTriangle } from 'lucide-react';

type MessagePriority = 'baja' | 'normal' | 'alta' | 'urgente';
type ThreadType = 'notificacion' | 'circular' | 'documento' | 'encuesta' | 'respuesta_requerida';

interface Message {
  id: string;
  thread_id: string;
  recipient_id: string;
  company_id: string;
  subject: string;
  priority: MessagePriority;
  thread_type: ThreadType;
  sender_type: 'company' | 'employee';
  requires_read_confirmation: boolean;
  requires_response: boolean;
  requires_signature: boolean;
  qtsp_level: 'none' | 'timestamp' | 'signature';
  created_at: string;
  read_at?: string | null;
  first_read_at?: string | null;
  responded_at?: string | null;
  signed_at?: string | null;
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

  // Fetch messages for employee
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
          signed_at,
          created_at,
          thread:message_threads(
            id,
            subject,
            priority,
            thread_type,
            requires_read_confirmation,
            requires_response,
            requires_signature,
            certification_level,
            sent_at
          )
        `)
        .eq('employee_id', employee!.id)
        .not('thread.sent_at', 'is', null)
        .order('created_at', { ascending: false });

      if (error) throw error;

      return (data || [])
        .filter(r => r.thread) // Only show sent messages
        .map(r => ({
          id: r.thread_id,
          thread_id: r.thread_id,
          recipient_id: r.id,
          company_id: r.company_id,
          subject: r.thread?.subject || 'Sin asunto',
          priority: (r.thread?.priority || 'normal') as MessagePriority,
          thread_type: (r.thread?.thread_type || 'notificacion') as ThreadType,
          sender_type: 'company' as const,
          requires_read_confirmation: r.thread?.requires_read_confirmation || false,
          requires_response: r.thread?.requires_response || false,
          requires_signature: r.thread?.requires_signature || false,
          qtsp_level: (r.thread?.certification_level || 'none') as 'none' | 'timestamp' | 'signature',
          created_at: r.thread?.sent_at || r.created_at,
          read_at: r.first_read_at,
          first_read_at: r.first_read_at,
          responded_at: r.responded_at,
          signed_at: r.signed_at,
        })) as Message[];
    },
  });

  // Fetch content for selected thread
  const { data: threadContent, isLoading: isLoadingContent } = useQuery({
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

  // Mark as read when selecting unread message
  const markAsRead = useMutation({
    mutationFn: async (recipientId: string) => {
      const now = new Date().toISOString();
      await supabase
        .from('message_recipients')
        .update({ 
          first_read_at: now,
          last_read_at: now,
          read_count: 1,
          delivery_status: 'read'
        })
        .eq('id', recipientId)
        .is('first_read_at', null);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['employee-messages'] });
    },
  });

  useEffect(() => {
    if (selectedMessage && !selectedMessage.read_at && selectedMessage.recipient_id) {
      markAsRead.mutate(selectedMessage.recipient_id);
    }
  }, [selectedMessage?.id]);

  const handleSelectMessage = (message: Message) => {
    setSelectedMessage(message);
  };

  const unreadCount = messages.filter(m => !m.read_at).length;
  const pendingActionCount = messages.filter(m => 
    (m.requires_read_confirmation && !m.first_read_at) ||
    (m.requires_response && !m.responded_at) ||
    (m.requires_signature && !m.signed_at)
  ).length;

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
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div>
            <h1 className="text-2xl font-bold">Comunicaciones</h1>
            <p className="text-muted-foreground">
              Mensajes oficiales de la empresa
            </p>
          </div>
          <div className="flex gap-2">
            {pendingActionCount > 0 && (
              <Badge variant="default" className="gap-1">
                <AlertTriangle className="h-3 w-3" />
                {pendingActionCount} pendientes
              </Badge>
            )}
            {unreadCount > 0 && (
              <Badge variant="destructive">
                {unreadCount} sin leer
              </Badge>
            )}
          </div>
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

          {/* Message Reader */}
          <div className="lg:col-span-2">
            <EmployeeMessageReader
              message={selectedMessage}
              content={threadContent}
              employeeId={employee?.id || ''}
              companyId={employee?.company_id || ''}
              isLoadingContent={isLoadingContent}
            />
          </div>
        </div>
      </div>
    </EmployeeLayout>
  );
}