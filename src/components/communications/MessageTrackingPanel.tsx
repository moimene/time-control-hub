import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { 
  Users, CheckCircle2, Clock, AlertTriangle, Eye, 
  MessageSquare, FileSignature, Shield, Download,
  ChevronRight, Send
} from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { EvidenceExportDialog } from './EvidenceExportDialog';

interface MessageTrackingPanelProps {
  threadId: string;
  onSendReminder?: () => void;
  onExportEvidence?: () => void;
}

interface RecipientStatus {
  id: string;
  employee_id: string;
  employee: { first_name: string; last_name: string; department: string | null } | null;
  delivery_status: string;
  delivered_at: string | null;
  first_read_at: string | null;
  responded_at: string | null;
  signed_at: string | null;
  reminder_count: number;
}

const statusConfig: Record<string, { label: string; color: string; icon: any }> = {
  pending: { label: 'Pendiente', color: 'bg-muted text-muted-foreground', icon: Clock },
  delivered: { label: 'Entregado', color: 'bg-blue-100 text-blue-700', icon: Send },
  notified_kiosk: { label: 'Notificado', color: 'bg-blue-100 text-blue-700', icon: Send },
  read: { label: 'Leído', color: 'bg-green-100 text-green-700', icon: Eye },
  responded: { label: 'Respondido', color: 'bg-purple-100 text-purple-700', icon: MessageSquare },
  signed: { label: 'Firmado', color: 'bg-emerald-100 text-emerald-700', icon: FileSignature },
  expired: { label: 'Expirado', color: 'bg-destructive/10 text-destructive', icon: AlertTriangle },
};

export function MessageTrackingPanel({ 
  threadId, 
  onSendReminder,
  onExportEvidence 
}: MessageTrackingPanelProps) {
  const [showExportDialog, setShowExportDialog] = useState(false);
  // Fetch thread details
  const { data: thread, isLoading: threadLoading } = useQuery({
    queryKey: ['thread-detail', threadId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('message_threads')
        .select('*')
        .eq('id', threadId)
        .single();
      
      if (error) throw error;
      return data;
    },
  });

  // Fetch thread content
  const { data: content } = useQuery({
    queryKey: ['thread-content-tracking', threadId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('message_contents')
        .select('*')
        .eq('thread_id', threadId)
        .eq('is_current', true)
        .single();
      
      if (error && error.code !== 'PGRST116') throw error;
      return data;
    },
  });

  // Fetch recipients with status
  const { data: recipients = [], isLoading: recipientsLoading } = useQuery({
    queryKey: ['thread-recipients-tracking', threadId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('message_recipients')
        .select(`
          *,
          employee:employees(first_name, last_name, department)
        `)
        .eq('thread_id', threadId)
        .order('delivery_status', { ascending: true });
      
      if (error) throw error;
      return data as RecipientStatus[];
    },
  });

  // Fetch evidence count
  const { data: evidenceCount = 0 } = useQuery({
    queryKey: ['thread-evidence-count', threadId],
    queryFn: async () => {
      const { count, error } = await supabase
        .from('message_evidence')
        .select('*', { count: 'exact', head: true })
        .eq('thread_id', threadId);
      
      if (error) throw error;
      return count || 0;
    },
  });

  if (threadLoading || recipientsLoading) {
    return (
      <Card className="h-full">
        <CardContent className="flex items-center justify-center h-64">
          <div className="animate-pulse text-muted-foreground">Cargando...</div>
        </CardContent>
      </Card>
    );
  }

  if (!thread) {
    return (
      <Card className="h-full">
        <CardContent className="flex items-center justify-center h-64">
          <div className="text-muted-foreground">Mensaje no encontrado</div>
        </CardContent>
      </Card>
    );
  }

  // Calculate stats
  const totalRecipients = recipients.length;
  const deliveredCount = recipients.filter(r => r.delivered_at).length;
  const readCount = recipients.filter(r => r.first_read_at).length;
  const respondedCount = recipients.filter(r => r.responded_at).length;
  const signedCount = recipients.filter(r => r.signed_at).length;
  const expiredCount = recipients.filter(r => r.delivery_status === 'expired').length;
  const pendingCount = recipients.filter(r => 
    !r.first_read_at && r.delivery_status !== 'expired'
  ).length;

  const readPercentage = totalRecipients > 0 ? (readCount / totalRecipients) * 100 : 0;

  const priorityColors: Record<string, string> = {
    baja: 'bg-muted',
    normal: 'bg-muted',
    alta: 'bg-yellow-100 text-yellow-800',
    urgente: 'bg-destructive/10 text-destructive',
  };

  return (
    <Card className="h-[calc(100vh-220px)] flex flex-col">
      <CardHeader className="pb-3 border-b">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap mb-1">
              <CardTitle className="text-lg">{thread.subject}</CardTitle>
              <Badge className={priorityColors[thread.priority] || 'bg-muted'}>
                {thread.priority}
              </Badge>
              {thread.certification_level !== 'none' && (
                <Badge variant="outline" className="gap-1">
                  <Shield className="h-3 w-3" />
                  {thread.certification_level}
                </Badge>
              )}
            </div>
            <p className="text-sm text-muted-foreground">
              Enviado el {format(new Date(thread.sent_at || thread.created_at), "d 'de' MMMM yyyy, HH:mm", { locale: es })}
            </p>
          </div>
          <div className="flex gap-2">
            {evidenceCount > 0 && (
              <Button variant="outline" size="sm" onClick={() => setShowExportDialog(true)}>
                <Download className="h-4 w-4 mr-1" />
                Exportar
              </Button>
            )}
          </div>
        </div>
      </CardHeader>

      <EvidenceExportDialog
        open={showExportDialog}
        onOpenChange={setShowExportDialog}
        threadId={threadId}
        threadSubject={thread.subject}
        certificationLevel={thread.certification_level || 'basic'}
        evidenceCount={evidenceCount}
      />

      <ScrollArea className="flex-1">
        <CardContent className="p-4 space-y-6">
          {/* Progress overview */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Estado de entrega</span>
              <span className="text-sm text-muted-foreground">
                {readCount}/{totalRecipients} leídos ({Math.round(readPercentage)}%)
              </span>
            </div>
            <Progress value={readPercentage} className="h-2" />
          </div>

          {/* Stats cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="p-3 rounded-lg bg-blue-50 border border-blue-100">
              <div className="flex items-center gap-2">
                <Send className="h-4 w-4 text-blue-600" />
                <span className="text-2xl font-bold text-blue-700">{deliveredCount}</span>
              </div>
              <span className="text-xs text-blue-600">Entregados</span>
            </div>
            <div className="p-3 rounded-lg bg-green-50 border border-green-100">
              <div className="flex items-center gap-2">
                <Eye className="h-4 w-4 text-green-600" />
                <span className="text-2xl font-bold text-green-700">{readCount}</span>
              </div>
              <span className="text-xs text-green-600">Leídos</span>
            </div>
            {thread.requires_response && (
              <div className="p-3 rounded-lg bg-purple-50 border border-purple-100">
                <div className="flex items-center gap-2">
                  <MessageSquare className="h-4 w-4 text-purple-600" />
                  <span className="text-2xl font-bold text-purple-700">{respondedCount}</span>
                </div>
                <span className="text-xs text-purple-600">Respondidos</span>
              </div>
            )}
            {thread.requires_signature && (
              <div className="p-3 rounded-lg bg-emerald-50 border border-emerald-100">
                <div className="flex items-center gap-2">
                  <FileSignature className="h-4 w-4 text-emerald-600" />
                  <span className="text-2xl font-bold text-emerald-700">{signedCount}</span>
                </div>
                <span className="text-xs text-emerald-600">Firmados</span>
              </div>
            )}
            {pendingCount > 0 && (
              <div className="p-3 rounded-lg bg-yellow-50 border border-yellow-100">
                <div className="flex items-center gap-2">
                  <Clock className="h-4 w-4 text-yellow-600" />
                  <span className="text-2xl font-bold text-yellow-700">{pendingCount}</span>
                </div>
                <span className="text-xs text-yellow-600">Pendientes</span>
              </div>
            )}
            {expiredCount > 0 && (
              <div className="p-3 rounded-lg bg-red-50 border border-red-100">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 text-red-600" />
                  <span className="text-2xl font-bold text-red-700">{expiredCount}</span>
                </div>
                <span className="text-xs text-red-600">Expirados</span>
              </div>
            )}
          </div>

          {/* Content preview */}
          {content && (
            <div className="space-y-2">
              <h4 className="text-sm font-medium">Contenido</h4>
              <div className="p-3 rounded-lg bg-muted/50 text-sm whitespace-pre-wrap max-h-32 overflow-auto">
                {content.body_text || content.body_markdown}
              </div>
            </div>
          )}

          <Separator />

          {/* Recipients list */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-medium">Detalle por destinatario</h4>
              {pendingCount > 0 && onSendReminder && (
                <Button variant="outline" size="sm" onClick={onSendReminder}>
                  <Clock className="h-4 w-4 mr-1" />
                  Enviar recordatorio ({pendingCount})
                </Button>
              )}
            </div>

            <div className="space-y-2">
              {recipients.map((recipient) => {
                const status = statusConfig[recipient.delivery_status] || statusConfig.pending;
                const StatusIcon = status.icon;

                return (
                  <div
                    key={recipient.id}
                    className="flex items-center justify-between p-3 rounded-lg border hover:bg-muted/50 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <div className={cn('p-1.5 rounded-full', status.color)}>
                        <StatusIcon className="h-3.5 w-3.5" />
                      </div>
                      <div>
                        <p className="text-sm font-medium">
                          {recipient.employee?.first_name} {recipient.employee?.last_name}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {recipient.employee?.department || 'Sin departamento'}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-3 text-right">
                      <div className="text-xs text-muted-foreground">
                        {recipient.first_read_at && (
                          <div className="flex items-center gap-1">
                            <Eye className="h-3 w-3" />
                            {format(new Date(recipient.first_read_at), 'dd/MM HH:mm')}
                          </div>
                        )}
                        {recipient.responded_at && (
                          <div className="flex items-center gap-1">
                            <MessageSquare className="h-3 w-3" />
                            {format(new Date(recipient.responded_at), 'dd/MM HH:mm')}
                          </div>
                        )}
                        {recipient.signed_at && (
                          <div className="flex items-center gap-1">
                            <FileSignature className="h-3 w-3" />
                            {format(new Date(recipient.signed_at), 'dd/MM HH:mm')}
                          </div>
                        )}
                        {recipient.reminder_count > 0 && (
                          <div className="text-yellow-600">
                            {recipient.reminder_count} recordatorio(s)
                          </div>
                        )}
                      </div>
                      <Badge className={cn('text-xs', status.color)}>
                        {status.label}
                      </Badge>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Evidence info */}
          {evidenceCount > 0 && (
            <>
              <Separator />
              <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                <div className="flex items-center gap-2">
                  <Shield className="h-4 w-4 text-primary" />
                  <span className="text-sm">
                    <strong>{evidenceCount}</strong> evidencias certificadas QTSP
                  </span>
                </div>
                <ChevronRight className="h-4 w-4 text-muted-foreground" />
              </div>
            </>
          )}
        </CardContent>
      </ScrollArea>
    </Card>
  );
}
