import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import { toast } from 'sonner';
import { 
  X, 
  CheckCircle2, 
  Loader2, 
  Shield, 
  Send, 
  FileText,
  AlertTriangle
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { sanitizeHtml } from '@/lib/security';

interface KioskMessageViewerProps {
  threadId: string;
  employeeId: string;
  companyId: string;
  onClose: () => void;
}

const priorityLabels: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
  baja: { label: 'Baja', variant: 'secondary' },
  normal: { label: 'Normal', variant: 'outline' },
  alta: { label: 'Alta', variant: 'default' },
  urgente: { label: 'Urgente', variant: 'destructive' },
};

export function KioskMessageViewer({ 
  threadId, 
  employeeId, 
  companyId, 
  onClose 
}: KioskMessageViewerProps) {
  const queryClient = useQueryClient();
  const [responseText, setResponseText] = useState('');
  const [showResponseForm, setShowResponseForm] = useState(false);

  // Fetch thread info
  const { data: thread, isLoading: loadingThread } = useQuery({
    queryKey: ['kiosk-thread', threadId],
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

  // Fetch recipient record
  const { data: recipient } = useQuery({
    queryKey: ['kiosk-recipient', threadId, employeeId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('message_recipients')
        .select('*')
        .eq('thread_id', threadId)
        .eq('employee_id', employeeId)
        .single();
      if (error && error.code !== 'PGRST116') throw error;
      return data;
    },
  });

  // Fetch content
  const { data: content, isLoading: loadingContent } = useQuery({
    queryKey: ['kiosk-thread-content', threadId],
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

  // Confirm read
  const confirmRead = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.functions.invoke('message-read', {
        body: {
          recipientId: recipient?.id,
          employeeId,
          companyId,
        }
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Lectura confirmada');
      queryClient.invalidateQueries({ queryKey: ['kiosk-recipient'] });
      queryClient.invalidateQueries({ queryKey: ['kiosk-notifications'] });
    },
    onError: () => {
      toast.error('Error al confirmar lectura');
    },
  });

  // Submit response
  const submitResponse = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.functions.invoke('message-respond', {
        body: {
          recipientId: recipient?.id,
          threadId,
          employeeId,
          companyId,
          responseText: responseText.trim(),
          sign: thread?.requires_signature,
        }
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success(thread?.requires_signature ? 'Respuesta firmada' : 'Respuesta enviada');
      setResponseText('');
      setShowResponseForm(false);
      queryClient.invalidateQueries({ queryKey: ['kiosk-recipient'] });
      queryClient.invalidateQueries({ queryKey: ['kiosk-notifications'] });
    },
    onError: () => {
      toast.error('Error al enviar respuesta');
    },
  });

  if (loadingThread || loadingContent) {
    return (
      <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!thread) {
    return (
      <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center">
        <Card className="w-full max-w-md">
          <CardContent className="pt-6 text-center">
            <p className="text-muted-foreground">Mensaje no encontrado</p>
            <Button className="mt-4" onClick={onClose}>Cerrar</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const priority = priorityLabels[thread.priority] || priorityLabels.normal;
  const isRead = !!recipient?.first_read_at;
  const isResponded = !!recipient?.responded_at;
  const needsAction = (thread.requires_read_confirmation && !isRead) || 
                      (thread.requires_response && !isResponded) ||
                      (thread.requires_signature && !recipient?.signed_at);

  return (
    <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <Card className="w-full max-w-2xl max-h-[90vh] flex flex-col">
        <CardHeader className="pb-3 border-b">
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-2">
                <Badge variant={priority.variant}>{priority.label}</Badge>
                {thread.certification_level !== 'none' && (
                  <Badge variant="secondary" className="gap-1">
                    <Shield className="h-3 w-3" />
                    QTSP
                  </Badge>
                )}
              </div>
              <CardTitle className="text-lg">{thread.subject}</CardTitle>
              <CardDescription>
                {format(new Date(thread.sent_at || thread.created_at), "d 'de' MMMM yyyy, HH:mm", { locale: es })}
              </CardDescription>
            </div>
            <Button variant="ghost" size="icon" onClick={onClose}>
              <X className="h-5 w-5" />
            </Button>
          </div>

          {needsAction && (
            <div className="flex items-center gap-2 text-sm p-2 rounded-md bg-yellow-500/10 text-yellow-700 mt-3">
              <AlertTriangle className="h-4 w-4 shrink-0" />
              <span>
                {thread.requires_signature && !recipient?.signed_at
                  ? 'Este mensaje requiere tu firma'
                  : thread.requires_response && !isResponded
                  ? 'Este mensaje requiere tu respuesta'
                  : 'Este mensaje requiere confirmación de lectura'}
              </span>
            </div>
          )}

          {isRead && (
            <div className="flex items-center gap-2 text-sm p-2 rounded-md bg-green-500/10 text-green-600 mt-2">
              <CheckCircle2 className="h-4 w-4 shrink-0" />
              <span>Leído • Certificado QTSP</span>
            </div>
          )}
        </CardHeader>

        <ScrollArea className="flex-1 p-4">
          <div className="prose prose-sm max-w-none dark:prose-invert">
            {content?.body_html ? (
              <div dangerouslySetInnerHTML={{ __html: sanitizeHtml(content.body_html) }} />
            ) : (
              <p className="whitespace-pre-wrap">
                {content?.body_text || content?.body_markdown || 'Sin contenido'}
              </p>
            )}
          </div>

          {showResponseForm && (
            <div className="mt-6 space-y-3 border-t pt-4">
              <label className="text-sm font-medium">Tu respuesta:</label>
              <Textarea
                value={responseText}
                onChange={(e) => setResponseText(e.target.value)}
                placeholder="Escribe tu respuesta aquí..."
                rows={4}
                className="resize-none text-base"
              />
            </div>
          )}
        </ScrollArea>

        <div className="p-4 border-t space-y-3">
          {showResponseForm ? (
            <div className="flex gap-2">
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => {
                  setShowResponseForm(false);
                  setResponseText('');
                }}
              >
                Cancelar
              </Button>
              <Button
                className="flex-1"
                onClick={() => submitResponse.mutate()}
                disabled={!responseText.trim() || submitResponse.isPending}
              >
                {submitResponse.isPending ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Send className="h-4 w-4 mr-2" />
                )}
                {thread.requires_signature ? 'Firmar y enviar' : 'Enviar'}
              </Button>
            </div>
          ) : (
            <>
              {thread.requires_read_confirmation && !isRead && (
                <Button 
                  className="w-full bg-green-600 hover:bg-green-700 h-12 text-lg"
                  onClick={() => confirmRead.mutate()}
                  disabled={confirmRead.isPending}
                >
                  {confirmRead.isPending ? (
                    <Loader2 className="h-5 w-5 mr-2 animate-spin" />
                  ) : (
                    <CheckCircle2 className="h-5 w-5 mr-2" />
                  )}
                  Confirmar lectura
                </Button>
              )}

              {(thread.requires_response || thread.requires_signature) && !isResponded && (
                <Button 
                  className={cn(
                    'w-full h-12 text-lg',
                    thread.requires_signature && 'bg-primary'
                  )}
                  variant={thread.requires_signature ? 'default' : 'outline'}
                  onClick={() => setShowResponseForm(true)}
                >
                  {thread.requires_signature ? (
                    <>
                      <FileText className="h-5 w-5 mr-2" />
                      Firmar documento
                    </>
                  ) : (
                    <>
                      <Send className="h-5 w-5 mr-2" />
                      Responder
                    </>
                  )}
                </Button>
              )}

              {!needsAction && (
                <Button 
                  variant="outline" 
                  className="w-full h-12 text-lg"
                  onClick={onClose}
                >
                  Cerrar
                </Button>
              )}
            </>
          )}

          {thread.certification_level !== 'none' && (
            <p className="text-xs text-muted-foreground text-center">
              🔒 Mensaje protegido con certificación QTSP
            </p>
          )}
        </div>
      </Card>
    </div>
  );
}
