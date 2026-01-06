import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  Reply, 
  CheckCircle2, 
  Clock, 
  Building2, 
  User,
  AlertTriangle,
  AlertCircle
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface Message {
  id: string;
  subject: string;
  body: string;
  priority: 'low' | 'normal' | 'high' | 'urgent';
  sender_type: 'company' | 'employee';
  requires_acknowledgment: boolean;
  created_at: string;
  read_at?: string | null;
  acknowledged_at?: string | null;
  sender_employee?: {
    first_name: string;
    last_name: string;
  };
}

interface MessageThreadProps {
  message: Message;
  replies?: Message[];
  viewType: 'admin' | 'employee';
  onReply: () => void;
  onAcknowledge?: () => void;
  isAcknowledging?: boolean;
}

const priorityConfig = {
  low: { label: 'Baja', className: 'bg-muted text-muted-foreground' },
  normal: { label: 'Normal', className: 'bg-muted text-muted-foreground' },
  high: { label: 'Alta', className: 'bg-yellow-500/10 text-yellow-600 border-yellow-500/20' },
  urgent: { label: 'Urgente', className: 'bg-destructive/10 text-destructive border-destructive/20' },
};

function MessageBubble({ 
  message, 
  isCurrentUser 
}: { 
  message: Message; 
  isCurrentUser: boolean;
}) {
  const getSenderName = () => {
    if (message.sender_type === 'company') {
      return 'Empresa';
    }
    if (message.sender_employee) {
      return `${message.sender_employee.first_name} ${message.sender_employee.last_name}`;
    }
    return 'Empleado';
  };

  return (
    <div className={cn(
      'flex gap-3',
      isCurrentUser && 'flex-row-reverse'
    )}>
      <div className={cn(
        'flex h-10 w-10 shrink-0 items-center justify-center rounded-full',
        message.sender_type === 'company' 
          ? 'bg-primary/10 text-primary' 
          : 'bg-secondary text-secondary-foreground'
      )}>
        {message.sender_type === 'company' ? (
          <Building2 className="h-5 w-5" />
        ) : (
          <User className="h-5 w-5" />
        )}
      </div>
      <div className={cn(
        'flex-1 max-w-[80%]',
        isCurrentUser && 'text-right'
      )}>
        <div className={cn(
          'inline-block rounded-lg p-4',
          isCurrentUser 
            ? 'bg-primary text-primary-foreground' 
            : 'bg-muted'
        )}>
          <p className="text-sm whitespace-pre-wrap text-left">{message.body}</p>
        </div>
        <div className={cn(
          'flex items-center gap-2 mt-1 text-xs text-muted-foreground',
          isCurrentUser && 'justify-end'
        )}>
          <span>{getSenderName()}</span>
          <span>•</span>
          <span>{format(new Date(message.created_at), "d MMM, HH:mm", { locale: es })}</span>
        </div>
      </div>
    </div>
  );
}

export function MessageThread({
  message,
  replies = [],
  viewType,
  onReply,
  onAcknowledge,
  isAcknowledging = false,
}: MessageThreadProps) {
  const priority = priorityConfig[message.priority];
  const needsAcknowledgment = 
    viewType === 'employee' && 
    message.requires_acknowledgment && 
    !message.acknowledged_at &&
    message.sender_type === 'company';

  const getSenderName = () => {
    if (message.sender_type === 'company') {
      return 'Empresa';
    }
    if (message.sender_employee) {
      return `${message.sender_employee.first_name} ${message.sender_employee.last_name}`;
    }
    return 'Empleado';
  };

  // Determine if message was sent by current user perspective
  const isOwnMessage = 
    (viewType === 'admin' && message.sender_type === 'company') ||
    (viewType === 'employee' && message.sender_type === 'employee');

  return (
    <Card className="h-full flex flex-col">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <CardTitle className="text-lg">{message.subject}</CardTitle>
              {message.priority === 'high' && (
                <AlertTriangle className="h-4 w-4 text-yellow-500" />
              )}
              {message.priority === 'urgent' && (
                <AlertCircle className="h-4 w-4 text-destructive" />
              )}
            </div>
            <p className="text-sm text-muted-foreground mt-1">
              De: {getSenderName()} • {format(new Date(message.created_at), "d 'de' MMMM yyyy, HH:mm", { locale: es })}
            </p>
          </div>
          <div className="flex items-center gap-2">
            {message.priority !== 'normal' && (
              <Badge variant="outline" className={priority.className}>
                {priority.label}
              </Badge>
            )}
          </div>
        </div>

        {message.requires_acknowledgment && (
          <div className={cn(
            'flex items-center gap-2 text-sm p-2 rounded-md mt-2',
            message.acknowledged_at 
              ? 'bg-green-500/10 text-green-600'
              : 'bg-yellow-500/10 text-yellow-700'
          )}>
            {message.acknowledged_at ? (
              <>
                <CheckCircle2 className="h-4 w-4" />
                <span>
                  Confirmado el {format(new Date(message.acknowledged_at), "d MMM yyyy, HH:mm", { locale: es })}
                </span>
              </>
            ) : (
              <>
                <Clock className="h-4 w-4" />
                <span>Este mensaje requiere confirmación de lectura</span>
              </>
            )}
          </div>
        )}
      </CardHeader>

      <Separator />

      <ScrollArea className="flex-1 p-4">
        <div className="space-y-6">
          {/* Original message */}
          <MessageBubble message={message} isCurrentUser={isOwnMessage} />

          {/* Replies */}
          {replies.map((reply) => {
            const isReplyOwn = 
              (viewType === 'admin' && reply.sender_type === 'company') ||
              (viewType === 'employee' && reply.sender_type === 'employee');
            return (
              <MessageBubble 
                key={reply.id} 
                message={reply} 
                isCurrentUser={isReplyOwn} 
              />
            );
          })}
        </div>
      </ScrollArea>

      <Separator />

      <div className="p-4 flex justify-between items-center gap-2">
        {needsAcknowledgment && onAcknowledge && (
          <Button 
            onClick={onAcknowledge} 
            disabled={isAcknowledging}
            className="bg-green-600 hover:bg-green-700"
          >
            <CheckCircle2 className="h-4 w-4 mr-2" />
            {isAcknowledging ? 'Confirmando...' : 'Confirmar lectura'}
          </Button>
        )}
        <div className="flex-1" />
        <Button variant="outline" onClick={onReply}>
          <Reply className="h-4 w-4 mr-2" />
          Responder
        </Button>
      </div>
    </Card>
  );
}
