import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

export function useHelpAgent() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isCreatingTicket, setIsCreatingTicket] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const { user, isAdmin, isSuperAdmin, isEmployee } = useAuth();

  const getUserRole = useCallback(() => {
    if (isSuperAdmin) return 'super_admin';
    if (isAdmin) return 'admin';
    if (isEmployee) return 'empleado';
    return 'usuario';
  }, [isAdmin, isSuperAdmin, isEmployee]);

  const sendMessage = useCallback(async (content: string) => {
    if (!content.trim() || isLoading || !user) return;

    const userMessage: ChatMessage = {
      id: crypto.randomUUID(),
      role: 'user',
      content: content.trim(),
      timestamp: new Date(),
    };

    setMessages(prev => [...prev, userMessage]);
    setIsLoading(true);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        throw new Error('No authenticated session');
      }

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/assistant-chat`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({
            message: content.trim(),
            userRole: getUserRole(),
          }),
        }
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to send message');
      }

      if (!response.body) {
        throw new Error('No response body');
      }

      // Create assistant message placeholder
      const assistantMessageId = crypto.randomUUID();
      let assistantContent = '';

      setMessages(prev => [
        ...prev,
        {
          id: assistantMessageId,
          role: 'assistant',
          content: '',
          timestamp: new Date(),
        },
      ]);

      // Read the stream
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        
        // Process complete SSE events
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (!line.trim() || line.startsWith(':')) continue;
          
          if (line.startsWith('data: ')) {
            const data = line.slice(6).trim();
            if (data === '[DONE]') continue;

            try {
              const parsed = JSON.parse(data);
              
              // Handle different event types from OpenAI Assistant API
              if (parsed.object === 'thread.message.delta') {
                const delta = parsed.delta?.content?.[0];
                if (delta?.type === 'text' && delta?.text?.value) {
                  assistantContent += delta.text.value;
                  setMessages(prev =>
                    prev.map(msg =>
                      msg.id === assistantMessageId
                        ? { ...msg, content: assistantContent }
                        : msg
                    )
                  );
                }
              }
            } catch {
              // Ignore parse errors for incomplete JSON
            }
          } else if (line.startsWith('event: ')) {
            // Handle event types if needed
          }
        }
      }

      // Process any remaining buffer
      if (buffer.trim()) {
        const lines = buffer.split('\n');
        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6).trim();
            if (data !== '[DONE]') {
              try {
                const parsed = JSON.parse(data);
                if (parsed.object === 'thread.message.delta') {
                  const delta = parsed.delta?.content?.[0];
                  if (delta?.type === 'text' && delta?.text?.value) {
                    assistantContent += delta.text.value;
                  }
                }
              } catch {
                // Ignore
              }
            }
          }
        }
      }

      // Final update
      setMessages(prev =>
        prev.map(msg =>
          msg.id === assistantMessageId
            ? { ...msg, content: assistantContent || 'No pude procesar tu solicitud. Por favor, intenta de nuevo.' }
            : msg
        )
      );

    } catch (error) {
      console.error('Error sending message:', error);
      setMessages(prev => [
        ...prev,
        {
          id: crypto.randomUUID(),
          role: 'assistant',
          content: 'Lo siento, hubo un error al procesar tu mensaje. Por favor, intenta de nuevo.',
          timestamp: new Date(),
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  }, [isLoading, user, getUserRole]);

  const clearMessages = useCallback(() => {
    setMessages([]);
  }, []);

  const toggleOpen = useCallback(() => {
    setIsOpen(prev => !prev);
  }, []);

  const createTicket = useCallback(async () => {
    if (messages.length === 0 || !user) return;

    setIsCreatingTicket(true);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        throw new Error('No authenticated session');
      }

      // Extract last user message as subject and build description
      const lastUserMessage = [...messages].reverse().find(m => m.role === 'user');
      const subject = lastUserMessage?.content.slice(0, 100) || 'Consulta de soporte';
      
      const description = messages
        .map(m => `${m.role === 'user' ? 'Usuario' : 'Asistente'}: ${m.content}`)
        .join('\n\n');

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/create-support-ticket`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({
            subject,
            description,
            priority: 'medium',
            category: 'help_agent',
            conversationContext: messages,
          }),
        }
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to create ticket');
      }

      const result = await response.json();
      toast.success('Ticket de soporte creado correctamente', {
        description: 'Un asesor revisará tu consulta pronto.',
      });

      // Add confirmation message to chat
      setMessages(prev => [
        ...prev,
        {
          id: crypto.randomUUID(),
          role: 'assistant',
          content: '✅ **Ticket de soporte creado**\n\nHe creado un ticket con tu consulta. Un asesor o administrador lo revisará y te contactará pronto.',
          timestamp: new Date(),
        },
      ]);

    } catch (error) {
      console.error('Error creating ticket:', error);
      toast.error('Error al crear el ticket', {
        description: 'Por favor, intenta de nuevo.',
      });
    } finally {
      setIsCreatingTicket(false);
    }
  }, [messages, user]);

  return {
    messages,
    isLoading,
    isCreatingTicket,
    isOpen,
    sendMessage,
    clearMessages,
    toggleOpen,
    setIsOpen,
    createTicket,
  };
}
