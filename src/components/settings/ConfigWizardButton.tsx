import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import { TemplateWizard } from '@/components/templates/wizard/TemplateWizard';
import { useTemplates } from '@/hooks/useTemplates';
import { Wand2 } from 'lucide-react';
import { toast } from 'sonner';

interface ConfigWizardButtonProps {
  className?: string;
}

export function ConfigWizardButton({ className }: ConfigWizardButtonProps) {
  const [isOpen, setIsOpen] = useState(false);
  const { createRuleSet, refetch } = useTemplates();

  const handleWizardComplete = async (payload: any) => {
    try {
      await createRuleSet.mutateAsync({
        name: payload.meta?.template_name || 'Nueva plantilla',
        description: `Creada con asistente - ${payload.meta?.convenio || 'Sin convenio'}`,
        sector: payload.meta?.sector,
        convenio: payload.meta?.convenio,
        payload,
      });
      setIsOpen(false);
      refetch();
      toast.success('Plantilla creada correctamente con el asistente');
    } catch (error) {
      toast.error('Error al crear la plantilla');
    }
  };

  return (
    <Sheet open={isOpen} onOpenChange={setIsOpen}>
      <SheetTrigger asChild>
        <Button className={className} size="lg">
          <Wand2 className="h-5 w-5 mr-2" />
          Asistente de configuración
        </Button>
      </SheetTrigger>
      <SheetContent side="right" className="w-full sm:max-w-3xl overflow-y-auto p-0">
        <div className="p-6">
          <TemplateWizard
            onComplete={handleWizardComplete}
            onCancel={() => setIsOpen(false)}
          />
        </div>
      </SheetContent>
    </Sheet>
  );
}
