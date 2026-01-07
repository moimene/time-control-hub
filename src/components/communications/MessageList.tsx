import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { Mail, MailOpen, CheckCircle2, AlertTriangle, AlertCircle, Users } from 'lucide-react';

type MessagePriority = 'baja' | 'normal' | 'alta' | 'urgente';

interface Message {
  id: string;
  subject: string;
  body?: string;
  priority: MessagePriority;
  sender_type: 'company' | 'employee';
  requires_read_confirmation?: boolean;
  created_at: string;
  read_at?: string | null;
  acknowledged_at?: string | null;
  recipient_count?: number;
  audience_type?: string;
  sender_employee?: {
    first_name: string;
    last_name: string;
  } | null;
  recipient_employee?: {
    first_name: string;
    last_name: string;
  } | null;
}

interface MessageListProps {
  messages: Message[];
  selectedId?: string;
  onSelect: (message: Message) => void;
  viewType: 'admin' | 'employee';
}

const priorityConfig: Record<MessagePriority, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline'; icon: typeof AlertTriangle | null }> = {
  baja: { label: 'Baja', variant: 'secondary', icon: null },
  normal: { label: 'Normal', variant: 'outline', icon: null },
  alta: { label: 'Alta', variant: 'default', icon: AlertTriangle },
  urgente: { label: 'Urgente', variant: 'destructive', icon: AlertCircle },
};

export function MessageList({ messages, selectedId, onSelect, viewType }: MessageListProps) {
  if (messages.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
        <Mail className="h-12 w-12 mb-4 opacity-50" />
        <p>No hay mensajes</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {messages.map((message) => {
        const isRead = !!message.read_at || !!message.acknowledged_at;
        const isAcknowledged = !!message.acknowledged_at;
        const priority = priorityConfig[message.priority] || priorityConfig.normal;
        const PriorityIcon = priority.icon;

        const getRecipientInfo = () => {
          if (message.audience_type === 'all') return 'Todos los empleados';
          if (message.audience_type === 'department') return 'Departamento';
          if (message.recipient_count) return `${message.recipient_count} destinatarios`;
          return 'Empleado';
        };

        return (
          <Card
            key={message.id}
            className={cn(
              'cursor-pointer transition-colors hover:bg-accent/50',
              selectedId === message.id && 'border-primary bg-accent/30',
              !isRead && viewType === 'employee' && 'border-l-4 border-l-primary'
            )}
            onClick={() => onSelect(message)}
          >
            <CardContent className="p-4">
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-start gap-3 flex-1 min-w-0">
                  {viewType === 'employee' ? (
                    isRead ? (
                      <MailOpen className="h-5 w-5 text-muted-foreground shrink-0 mt-0.5" />
                    ) : (
                      <Mail className="h-5 w-5 text-primary shrink-0 mt-0.5" />
                    )
                  ) : (
                    <Users className="h-5 w-5 text-muted-foreground shrink-0 mt-0.5" />
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className={cn(
                        'font-medium truncate',
                        !isRead && viewType === 'employee' && 'text-foreground',
                        isRead && 'text-muted-foreground'
                      )}>
                        {message.subject}
                      </p>
                      {PriorityIcon && (
                        <PriorityIcon className={cn(
                          'h-4 w-4 shrink-0',
                          message.priority === 'urgente' && 'text-destructive',
                          message.priority === 'alta' && 'text-yellow-500'
                        )} />
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground truncate">
                      {viewType === 'admin' 
                        ? `Para: ${getRecipientInfo()}`
                        : 'De: Empresa'
                      }
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {format(new Date(message.created_at), "d MMM yyyy, HH:mm", { locale: es })}
                    </p>
                  </div>
                </div>
                <div className="flex flex-col items-end gap-1 shrink-0">
                  {message.priority !== 'normal' && (
                    <Badge variant={priority.variant} className="text-xs">
                      {priority.label}
                    </Badge>
                  )}
                  {message.requires_read_confirmation && viewType === 'employee' && (
                    <Badge 
                      variant={isAcknowledged ? 'default' : 'outline'} 
                      className={cn(
                        'text-xs',
                        isAcknowledged && 'bg-green-500/10 text-green-600 border-green-500/20'
                      )}
                    >
                      {isAcknowledged ? (
                        <><CheckCircle2 className="h-3 w-3 mr-1" /> Confirmado</>
                      ) : (
                        'Requiere confirmación'
                      )}
                    </Badge>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
