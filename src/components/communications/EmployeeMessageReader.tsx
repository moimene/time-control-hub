import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Separator } from '@/components/ui/separator';
import { toast } from 'sonner';
import { 
  CheckCircle2, 
  Clock, 
  MessageSquare, 
  Shield, 
  FileText, 
  Send,
  Loader2,
  AlertTriangle,
  Reply
} from 'lucide-react';
import { cn } from '@/lib/utils';

type MessagePriority = 'baja' | 'normal' | 'alta' | 'urgente';
type ThreadType = 'notificacion' | 'circular' | 'documento' | 'encuesta' | 'respuesta_requerida';

interface ThreadContent {
  id: string;
  body_text: string | null;
  body_markdown: string | null;
  body_html: string | null;
  attachments: unknown;
}

interface Message {
  id: string;
  thread_id: string;
  recipient_id: string;
  company_id: string;
  subject: string;
  priority: MessagePriority;
  thread_type: ThreadType;
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

interface EmployeeMessageReaderProps {
  message: Message | null;
  content: ThreadContent | null;
  employeeId: string;
  companyId: string;
  isLoadingContent?: boolean;
}

const priorityConfig: Record<MessagePriority, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
  baja: { label: 'Baja', variant: 'secondary' },
  normal: { label: 'Normal', variant: 'outline' },
  alta: { label: 'Alta', variant: 'default' },
  urgente: { label: 'Urgente', variant: 'destructive' },
};

const threadTypeLabels: Record<ThreadType, string> = {
  notificacion: 'Notificación',
  circular: 'Circular',
  documento: 'Documento',
  encuesta: 'Encuesta',
  respuesta_requerida: 'Respuesta requerida',
};

export function EmployeeMessageReader({ 
  message, 
  content, 
  employeeId, 
  companyId,
  isLoadingContent 
}: EmployeeMessageReaderProps) {
  const queryClient = useQueryClient();
  const [responseText, setResponseText] = useState('');
  const [showResponseForm, setShowResponseForm] = useState(false);

  // Confirm read with QTSP
  const confirmRead = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.functions.invoke('message-read', {
        body: {
          recipientId: message!.recipient_id,
          employeeId,
          companyId,
        }
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Lectura confirmada con sello de tiempo cualificado');
      queryClient.invalidateQueries({ queryKey: ['employee-messages'] });
    },
    onError: (error) => {
      console.error('Error confirming read:', error);
      toast.error('Error al confirmar lectura');
    },
  });

  // Submit response
  const submitResponse = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.functions.invoke('message-respond', {
        body: {
          recipientId: message!.recipient_id,
          threadId: message!.thread_id,
          employeeId,
          companyId,
          responseText: responseText.trim(),
          sign: message!.requires_signature,
        }
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success(
        message!.requires_signature 
          ? 'Respuesta enviada y firmada' 
          : 'Respuesta enviada'
      );
      setResponseText('');
      setShowResponseForm(false);
      queryClient.invalidateQueries({ queryKey: ['employee-messages'] });
    },
    onError: (error) => {
      console.error('Error submitting response:', error);
      toast.error('Error al enviar respuesta');
    },
  });

  if (!message) {
    return (
      <Card className="h-[calc(100vh-220px)] flex items-center justify-center">
        <div className="text-center text-muted-foreground">
          <MessageSquare className="h-12 w-12 mx-auto mb-4 opacity-50" />
          <p>Selecciona un mensaje para ver los detalles</p>
          <p className="text-sm mt-2">Las comunicaciones oficiales aparecerán aquí</p>
        </div>
      </Card>
    );
  }

  const priority = priorityConfig[message.priority] || priorityConfig.normal;
  const isRead = !!message.first_read_at;
  const needsAction = (message.requires_read_confirmation && !isRead) || 
                      (message.requires_response && !message.responded_at) ||
                      (message.requires_signature && !message.signed_at);

  return (
    <Card className="h-[calc(100vh-220px)] flex flex-col">
      {/* Header */}
      <CardHeader className="pb-3 space-y-3">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap mb-1">
              <Badge variant="outline" className="text-xs">
                {threadTypeLabels[message.thread_type]}
              </Badge>
              {message.qtsp_level !== 'none' && (
                <Badge variant="secondary" className="text-xs gap-1">
                  <Shield className="h-3 w-3" />
                  {message.qtsp_level === 'signature' ? 'Firma QTSP' : 'Sello QTSP'}
                </Badge>
              )}
            </div>
            <h2 className="text-xl font-semibold">{message.subject}</h2>
            <p className="text-sm text-muted-foreground mt-1">
              Recibido el {format(new Date(message.created_at), "d 'de' MMMM yyyy, HH:mm", { locale: es })}
            </p>
          </div>
          <Badge variant={priority.variant}>
            {priority.label}
          </Badge>
        </div>

        {/* Status indicators */}
        {needsAction && (
          <div className="flex items-center gap-2 text-sm p-2 rounded-md bg-yellow-500/10 text-yellow-700 dark:text-yellow-400">
            <AlertTriangle className="h-4 w-4 shrink-0" />
            <span>
              {message.requires_signature && !message.signed_at
                ? 'Este mensaje requiere tu firma'
                : message.requires_response && !message.responded_at
                ? 'Este mensaje requiere tu respuesta'
                : 'Este mensaje requiere confirmación de lectura'}
            </span>
          </div>
        )}

        {isRead && (
          <div className="flex items-center gap-2 text-sm p-2 rounded-md bg-green-500/10 text-green-600 dark:text-green-400">
            <CheckCircle2 className="h-4 w-4 shrink-0" />
            <span>
              Leído el {format(new Date(message.first_read_at!), "d MMM yyyy, HH:mm", { locale: es })}
              {message.qtsp_level !== 'none' && ' • Certificado QTSP'}
            </span>
          </div>
        )}

        {message.responded_at && (
          <div className="flex items-center gap-2 text-sm p-2 rounded-md bg-blue-500/10 text-blue-600 dark:text-blue-400">
            <Reply className="h-4 w-4 shrink-0" />
            <span>
              Respondido el {format(new Date(message.responded_at), "d MMM yyyy, HH:mm", { locale: es })}
            </span>
          </div>
        )}
      </CardHeader>

      <Separator />

      {/* Content */}
      <CardContent className="flex-1 overflow-auto py-4">
        {isLoadingContent ? (
          <div className="flex items-center justify-center h-full">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : content ? (
          <div className="prose prose-sm max-w-none dark:prose-invert">
            {content.body_html ? (
              <div dangerouslySetInnerHTML={{ __html: content.body_html }} />
            ) : (
              <p className="whitespace-pre-wrap">
                {content.body_text || content.body_markdown || 'Sin contenido'}
              </p>
            )}
          </div>
        ) : (
          <p className="text-muted-foreground">No se pudo cargar el contenido</p>
        )}

        {/* Response form */}
        {showResponseForm && (
          <div className="mt-6 space-y-3">
            <Separator />
            <label className="text-sm font-medium">Tu respuesta:</label>
            <Textarea
              value={responseText}
              onChange={(e) => setResponseText(e.target.value)}
              placeholder="Escribe tu respuesta aquí..."
              rows={4}
              className="resize-none"
            />
            <div className="flex gap-2 justify-end">
              <Button
                variant="outline"
                onClick={() => {
                  setShowResponseForm(false);
                  setResponseText('');
                }}
              >
                Cancelar
              </Button>
              <Button
                onClick={() => submitResponse.mutate()}
                disabled={!responseText.trim() || submitResponse.isPending}
              >
                {submitResponse.isPending ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Send className="h-4 w-4 mr-2" />
                )}
                {message.requires_signature ? 'Firmar y enviar' : 'Enviar respuesta'}
              </Button>
            </div>
            {message.requires_signature && (
              <p className="text-xs text-muted-foreground text-center">
                🔒 Tu respuesta será firmada digitalmente con certificado cualificado
              </p>
            )}
          </div>
        )}
      </CardContent>

      {/* Actions */}
      {!showResponseForm && (
        <div className="p-4 border-t space-y-3">
          {/* Confirm read button */}
          {message.requires_read_confirmation && !isRead && (
            <Button 
              onClick={() => confirmRead.mutate()}
              disabled={confirmRead.isPending}
              className="w-full bg-green-600 hover:bg-green-700"
            >
              {confirmRead.isPending ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <CheckCircle2 className="h-4 w-4 mr-2" />
              )}
              Confirmar lectura
            </Button>
          )}

          {/* Response/signature button */}
          {(message.requires_response || message.requires_signature) && !message.responded_at && (
            <Button 
              onClick={() => setShowResponseForm(true)}
              variant={message.requires_signature ? 'default' : 'outline'}
              className={cn('w-full', message.requires_signature && 'bg-primary')}
            >
              {message.requires_signature ? (
                <>
                  <FileText className="h-4 w-4 mr-2" />
                  Firmar documento
                </>
              ) : (
                <>
                  <Reply className="h-4 w-4 mr-2" />
                  Responder
                </>
              )}
            </Button>
          )}

          {message.qtsp_level !== 'none' && (
            <p className="text-xs text-muted-foreground text-center">
              🔒 Este mensaje está protegido con certificación QTSP
            </p>
          )}
        </div>
      )}
    </Card>
  );
}
