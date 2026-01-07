import { useHelpAgent } from '@/hooks/useHelpAgent';
import { HelpAgentButton } from './HelpAgentButton';
import { HelpAgentChat } from './HelpAgentChat';
import { useAuth } from '@/hooks/useAuth';

export function HelpAgent() {
  const { user } = useAuth();
  const {
    messages,
    isLoading,
    isOpen,
    sendMessage,
    clearMessages,
    toggleOpen,
    setIsOpen,
  } = useHelpAgent();

  // Don't render if user is not authenticated
  if (!user) return null;

  return (
    <>
      <HelpAgentButton onClick={toggleOpen} isOpen={isOpen} />
      <HelpAgentChat
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
        messages={messages}
        isLoading={isLoading}
        onSendMessage={sendMessage}
        onClearMessages={clearMessages}
      />
    </>
  );
}
