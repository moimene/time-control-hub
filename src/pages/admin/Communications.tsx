import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useCompany } from '@/hooks/useCompany';
import { useAuth } from '@/hooks/useAuth';
import { AppLayout } from '@/components/layout/AppLayout';
import { MessageList } from '@/components/communications/MessageList';
import { AdvancedMessageComposer, type AdvancedMessageFormData } from '@/components/communications/AdvancedMessageComposer';
import { MessageTrackingPanel } from '@/components/communications/MessageTrackingPanel';
import { MessageStatsDashboard } from '@/components/communications/MessageStatsDashboard';
import { MessageTemplatesManager } from '@/components/communications/MessageTemplatesManager';
import { ScheduledMessagesPanel } from '@/components/communications/ScheduledMessagesPanel';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { Plus, Send, FileText, Clock, Users, Loader2, Shield, BarChart3, Settings2 } from 'lucide-react';
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
}

export default function Communications() {
  const { company } = useCompany();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [showComposer, setShowComposer] = useState(false);
  const [selectedMessage, setSelectedMessage] = useState<Message | null>(null);
  const [activeTab, setActiveTab] = useState('sent');
  const [showStats, setShowStats] = useState(false);
  const [mainView, setMainView] = useState<'messages' | 'templates' | 'scheduled'>('messages');

  // Fetch all message threads
  const { data: threads = [], isLoading } = useQuery({
    queryKey: ['admin-message-threads', company?.id],
    enabled: !!company?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('message_threads')
        .select('*')
        .eq('company_id', company!.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      
      return (data || []).map(t => ({
        id: t.id,
        company_id: t.company_id,
        subject: t.subject,
        body: '',
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

  // Filter threads by status
  const sentThreads = threads.filter(t => t.status === 'sent');
  const draftThreads = threads.filter(t => t.status === 'draft');
  const scheduledThreads = threads.filter(t => t.status === 'scheduled');

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

  // Fetch templates
  const { data: templates = [] } = useQuery({
    queryKey: ['message-templates', company?.id],
    enabled: !!company?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('message_templates')
        .select('id, name, subject_template, body_template')
        .eq('company_id', company!.id)
        .eq('is_active', true);

      if (error) throw error;
      return data || [];
    },
  });

  // Get unique departments
  const departments = [...new Set(employees.map(e => e.department).filter(Boolean))] as string[];

  // Send message mutation
  const sendMessage = useMutation({
    mutationFn: async (data: AdvancedMessageFormData) => {
      // Create thread
      const audienceFilter = data.audience_type === 'department' 
        ? { department: data.audience_department }
        : data.audience_type === 'individual' && data.audience_employee_ids?.length
        ? { employee_ids: data.audience_employee_ids }
        : null;

      const { data: thread, error: threadError } = await supabase
        .from('message_threads')
        .insert({
          company_id: company!.id,
          subject: data.subject,
          thread_type: data.thread_type,
          priority: data.priority,
          requires_read_confirmation: data.requires_read_confirmation,
          requires_response: data.requires_response,
          requires_signature: data.requires_signature,
          response_deadline: data.response_deadline?.toISOString(),
          status: data.send_now ? 'sent' : 'scheduled',
          sent_at: data.send_now ? new Date().toISOString() : null,
          scheduled_at: !data.send_now ? data.scheduled_at?.toISOString() : null,
          created_by: user!.id,
          sender_role: 'admin',
          audience_type: data.audience_type,
          audience_filter: audienceFilter,
          certification_level: data.certification_level,
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

      // If sending now, invoke the edge function
      if (data.send_now) {
        const { error: sendError } = await supabase.functions.invoke('message-send', {
          body: { thread_id: thread.id, send_now: true }
        });

        if (sendError) {
          console.error('Error invoking message-send:', sendError);
          // Don't throw - the message was created, just the edge function failed
          toast.warning('Mensaje creado pero hubo un problema con la certificación');
        }
      }

      return thread;
    },
    onSuccess: (_, variables) => {
      toast.success(variables.send_now ? 'Mensaje enviado correctamente' : 'Mensaje programado correctamente');
      setShowComposer(false);
      queryClient.invalidateQueries({ queryKey: ['admin-message-threads'] });
    },
    onError: (error) => {
      toast.error('Error al enviar el mensaje');
      console.error(error);
    },
  });

  // Save draft mutation
  const saveDraft = useMutation({
    mutationFn: async (data: AdvancedMessageFormData) => {
      const audienceFilter = data.audience_type === 'department' 
        ? { department: data.audience_department }
        : data.audience_type === 'individual' && data.audience_employee_ids?.length
        ? { employee_ids: data.audience_employee_ids }
        : null;

      const { data: thread, error: threadError } = await supabase
        .from('message_threads')
        .insert({
          company_id: company!.id,
          subject: data.subject || 'Sin asunto',
          thread_type: data.thread_type,
          priority: data.priority,
          requires_read_confirmation: data.requires_read_confirmation,
          requires_response: data.requires_response,
          requires_signature: data.requires_signature,
          status: 'draft',
          created_by: user!.id,
          sender_role: 'admin',
          audience_type: data.audience_type,
          audience_filter: audienceFilter,
          certification_level: data.certification_level,
        })
        .select('id')
        .single();

      if (threadError) throw threadError;

      if (data.body) {
        await supabase.from('message_contents').insert({
          thread_id: thread.id,
          body_text: data.body,
          body_markdown: data.body,
        });
      }

      return thread;
    },
    onSuccess: () => {
      toast.success('Borrador guardado');
      setShowComposer(false);
      queryClient.invalidateQueries({ queryKey: ['admin-message-threads'] });
    },
    onError: (error) => {
      toast.error('Error al guardar el borrador');
      console.error(error);
    },
  });

  // Send reminder
  const sendReminder = async () => {
    if (!selectedMessage) return;
    
    const { error } = await supabase.functions.invoke('message-reminder', {
      body: { thread_id: selectedMessage.id }
    });

    if (error) {
      toast.error('Error al enviar recordatorios');
    } else {
      toast.success('Recordatorios enviados');
      queryClient.invalidateQueries({ queryKey: ['thread-recipients-tracking'] });
    }
  };

  const handleSelectMessage = (message: Message) => {
    setSelectedMessage(message);
    setShowComposer(false);
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
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold">Comunicaciones Certificadas</h1>
              <Badge variant="outline" className="gap-1">
                <Shield className="h-3 w-3" />
                QTSP
              </Badge>
            </div>
            <p className="text-muted-foreground">
              Gestiona las comunicaciones oficiales con trazabilidad completa
            </p>
          </div>
          <div className="flex gap-2">
            <Button 
              variant={mainView === 'templates' ? 'secondary' : 'outline'} 
              onClick={() => setMainView(mainView === 'templates' ? 'messages' : 'templates')}
            >
              <Settings2 className="h-4 w-4 mr-2" />
              Plantillas
            </Button>
            <Button 
              variant={mainView === 'scheduled' ? 'secondary' : 'outline'} 
              onClick={() => setMainView(mainView === 'scheduled' ? 'messages' : 'scheduled')}
            >
              <Clock className="h-4 w-4 mr-2" />
              Programados
            </Button>
            <Button variant="outline" onClick={() => setShowStats(!showStats)}>
              <BarChart3 className="h-4 w-4 mr-2" />
              {showStats ? 'Ocultar' : 'Estadísticas'}
            </Button>
            <Button onClick={() => { setShowComposer(true); setSelectedMessage(null); setShowStats(false); setMainView('messages'); }}>
              <Plus className="h-4 w-4 mr-2" />
              Nueva comunicación
            </Button>
          </div>
        </div>

        {showStats && <MessageStatsDashboard />}

        {mainView === 'templates' ? (
          <MessageTemplatesManager />
        ) : mainView === 'scheduled' ? (
          <ScheduledMessagesPanel />
        ) : (

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Messages List */}
          <div className="lg:col-span-1">
            <Card className="h-[calc(100vh-220px)]">
              <Tabs value={activeTab} onValueChange={setActiveTab} className="h-full flex flex-col">
                <CardHeader className="pb-2">
                  <TabsList className="grid w-full grid-cols-3">
                    <TabsTrigger value="sent" className="gap-1 text-xs">
                      <Send className="h-3 w-3" />
                      Enviados
                      {sentThreads.length > 0 && (
                        <Badge variant="secondary" className="ml-1 h-5 px-1.5">
                          {sentThreads.length}
                        </Badge>
                      )}
                    </TabsTrigger>
                    <TabsTrigger value="drafts" className="gap-1 text-xs">
                      <FileText className="h-3 w-3" />
                      Borradores
                      {draftThreads.length > 0 && (
                        <Badge variant="secondary" className="ml-1 h-5 px-1.5">
                          {draftThreads.length}
                        </Badge>
                      )}
                    </TabsTrigger>
                    <TabsTrigger value="scheduled" className="gap-1 text-xs">
                      <Clock className="h-3 w-3" />
                      Programados
                      {scheduledThreads.length > 0 && (
                        <Badge variant="secondary" className="ml-1 h-5 px-1.5">
                          {scheduledThreads.length}
                        </Badge>
                      )}
                    </TabsTrigger>
                  </TabsList>
                </CardHeader>
                <CardContent className="flex-1 overflow-auto">
                  <TabsContent value="sent" className="mt-0 h-full">
                    <MessageList
                      messages={sentThreads}
                      selectedId={selectedMessage?.id}
                      onSelect={handleSelectMessage}
                      viewType="admin"
                    />
                  </TabsContent>
                  <TabsContent value="drafts" className="mt-0 h-full">
                    <MessageList
                      messages={draftThreads}
                      selectedId={selectedMessage?.id}
                      onSelect={handleSelectMessage}
                      viewType="admin"
                    />
                  </TabsContent>
                  <TabsContent value="scheduled" className="mt-0 h-full">
                    <MessageList
                      messages={scheduledThreads}
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
              <AdvancedMessageComposer
                employees={employees}
                departments={departments}
                templates={templates}
                onSubmit={async (data) => { await sendMessage.mutateAsync(data); }}
                onSaveDraft={async (data) => { await saveDraft.mutateAsync(data); }}
                onCancel={() => setShowComposer(false)}
                isSubmitting={sendMessage.isPending}
              />
            ) : selectedMessage ? (
              <MessageTrackingPanel
                threadId={selectedMessage.id}
                onSendReminder={sendReminder}
                onExportEvidence={() => toast.info('Exportación de evidencias próximamente')}
              />
            ) : (
              <Card className="h-[calc(100vh-220px)] flex items-center justify-center">
                <div className="text-center text-muted-foreground">
                  <Users className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>Selecciona un mensaje para ver el seguimiento</p>
                  <p className="text-sm mt-2">o crea una nueva comunicación certificada</p>
                </div>
              </Card>
            )}
          </div>
        </div>
        )}
      </div>
    </AppLayout>
  );
}
