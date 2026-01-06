import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { Mail, MailOpen, CheckCircle2, AlertTriangle, AlertCircle } from 'lucide-react';

interface Message {
  id: string;
  subject: string;
  body: string;
  priority: 'low' | 'normal' | 'high' | 'urgent';
  sender_type: 'company' | 'employee';
  sender_employee_id?: string;
  recipient_type: string;
  requires_acknowledgment: boolean;
  created_at: string;
  read_at?: string | null;
  acknowledged_at?: string | null;
  sender_employee?: {
    first_name: string;
    last_name: string;
  };
  recipient_employee?: {
    first_name: string;
    last_name: string;
  };
}

interface MessageListProps {
  messages: Message[];
  selectedId?: string;
  onSelect: (message: Message) => void;
  viewType: 'admin' | 'employee';
}

const priorityConfig = {
  low: { label: 'Baja', variant: 'secondary' as const, icon: null },
  normal: { label: 'Normal', variant: 'outline' as const, icon: null },
  high: { label: 'Alta', variant: 'default' as const, icon: AlertTriangle },
  urgent: { label: 'Urgente', variant: 'destructive' as const, icon: AlertCircle },
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
        const isRead = !!message.read_at;
        const isAcknowledged = !!message.acknowledged_at;
        const priority = priorityConfig[message.priority];
        const PriorityIcon = priority.icon;

        const getSenderName = () => {
          if (message.sender_type === 'company') {
            return 'Empresa';
          }
          if (message.sender_employee) {
            return `${message.sender_employee.first_name} ${message.sender_employee.last_name}`;
          }
          return 'Empleado';
        };

        const getRecipientName = () => {
          if (message.recipient_type === 'all_employees') return 'Todos los empleados';
          if (message.recipient_type === 'company') return 'Empresa';
          if (message.recipient_type === 'department') return `Departamento`;
          if (message.recipient_employee) {
            return `${message.recipient_employee.first_name} ${message.recipient_employee.last_name}`;
          }
          return 'Destinatario';
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
                    <Mail className="h-5 w-5 text-muted-foreground shrink-0 mt-0.5" />
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
                          message.priority === 'urgent' && 'text-destructive',
                          message.priority === 'high' && 'text-warning'
                        )} />
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground truncate">
                      {viewType === 'admin' 
                        ? message.sender_type === 'employee' 
                          ? `De: ${getSenderName()}`
                          : `Para: ${getRecipientName()}`
                        : `De: ${getSenderName()}`
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
                  {message.requires_acknowledgment && (
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
