import { MessageCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface HelpAgentButtonProps {
  onClick: () => void;
  isOpen: boolean;
}

export function HelpAgentButton({ onClick, isOpen }: HelpAgentButtonProps) {
  return (
    <Button
      onClick={onClick}
      size="lg"
      className={cn(
        "fixed bottom-6 right-6 z-50 h-14 w-14 rounded-full shadow-lg transition-all duration-300 hover:scale-105",
        isOpen && "scale-0 opacity-0"
      )}
    >
      <MessageCircle className="h-6 w-6" />
      <span className="sr-only">Abrir asistente de ayuda</span>
    </Button>
  );
}
