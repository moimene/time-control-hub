import { useRef, useEffect, useState } from 'react';
import { X, Send, Trash2, Bot, User, Loader2, Ticket } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import { MarkdownMessage } from './MarkdownMessage';
import type { ChatMessage } from '@/hooks/useHelpAgent';

interface HelpAgentChatProps {
  isOpen: boolean;
  onClose: () => void;
  messages: ChatMessage[];
  isLoading: boolean;
  onSendMessage: (message: string) => void;
  onClearMessages: () => void;
  onCreateTicket: () => void;
  isCreatingTicket: boolean;
}

export function HelpAgentChat({
  isOpen,
  onClose,
  messages,
  isLoading,
  onSendMessage,
  onClearMessages,
  onCreateTicket,
  isCreatingTicket,
}: HelpAgentChatProps) {
  const [input, setInput] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isOpen]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (input.trim() && !isLoading) {
      onSendMessage(input);
      setInput('');
    }
  };

  return (
    <div
      className={cn(
        "fixed bottom-6 right-6 z-50 flex h-[500px] w-[380px] flex-col rounded-xl border bg-card shadow-2xl transition-all duration-300",
        isOpen ? "scale-100 opacity-100" : "pointer-events-none scale-95 opacity-0"
      )}
    >
      {/* Header */}
      <div className="flex items-center justify-between border-b px-4 py-3">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary">
            <Bot className="h-4 w-4 text-primary-foreground" />
          </div>
          <div>
            <h3 className="font-semibold text-sm">Asistente de Ayuda</h3>
            <p className="text-xs text-muted-foreground">Control Horario</p>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <Button
            variant="outline"
            size="sm"
            onClick={onCreateTicket}
            className="h-7 gap-1.5 border-orange-300 bg-orange-50 text-orange-700 hover:bg-orange-100 hover:text-orange-800 dark:border-orange-700 dark:bg-orange-950 dark:text-orange-300 dark:hover:bg-orange-900"
            title="Crear ticket de soporte"
            disabled={isCreatingTicket || messages.length === 0}
          >
            {isCreatingTicket ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Ticket className="h-3.5 w-3.5" />
            )}
            <span className="text-xs font-medium">Soporte</span>
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={onClearMessages}
            className="h-8 w-8"
            title="Limpiar conversación"
          >
            <Trash2 className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={onClose}
            className="h-8 w-8"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Messages */}
      <ScrollArea className="flex-1 p-4" ref={scrollRef}>
        {messages.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center text-center text-muted-foreground">
            <Bot className="mb-3 h-12 w-12 opacity-50" />
            <p className="text-sm font-medium">¡Hola! Soy tu asistente.</p>
            <p className="mt-1 text-xs">
              Pregúntame sobre fichajes, ausencias, informes o cualquier duda sobre la plataforma.
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            {messages.map((message) => (
              <div
                key={message.id}
                className={cn(
                  "flex gap-2",
                  message.role === 'user' ? "flex-row-reverse" : "flex-row"
                )}
              >
                <div
                  className={cn(
                    "flex h-7 w-7 shrink-0 items-center justify-center rounded-full",
                    message.role === 'user'
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted"
                  )}
                >
                  {message.role === 'user' ? (
                    <User className="h-4 w-4" />
                  ) : (
                    <Bot className="h-4 w-4" />
                  )}
                </div>
                <div
                  className={cn(
                    "max-w-[80%] rounded-lg px-3 py-2 text-sm",
                    message.role === 'user'
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted"
                  )}
                >
                  {message.role === 'user' ? (
                    <p className="whitespace-pre-wrap">{message.content}</p>
                  ) : (
                    <MarkdownMessage content={message.content} />
                  )}
                </div>
              </div>
            ))}
            {isLoading && messages[messages.length - 1]?.role === 'user' && (
              <div className="flex gap-2">
                <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-muted">
                  <Bot className="h-4 w-4" />
                </div>
                <div className="flex items-center gap-2 rounded-lg bg-muted px-3 py-2">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span className="text-sm text-muted-foreground">Escribiendo...</span>
                </div>
              </div>
            )}
          </div>
        )}
      </ScrollArea>

      {/* Input */}
      <form onSubmit={handleSubmit} className="border-t p-3">
        <div className="flex gap-2">
          <Input
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Escribe tu pregunta..."
            disabled={isLoading}
            className="flex-1"
          />
          <Button type="submit" size="icon" disabled={!input.trim() || isLoading}>
            <Send className="h-4 w-4" />
          </Button>
        </div>
      </form>
    </div>
  );
}
