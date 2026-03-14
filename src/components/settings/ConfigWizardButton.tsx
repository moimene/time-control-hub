import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import { TemplateWizard } from '@/components/templates/wizard/TemplateWizard';
import { useTemplates } from '@/hooks/useTemplates';
import { Wand2 } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';

interface ConfigWizardButtonProps {
  className?: string;
}

export function ConfigWizardButton({ className }: ConfigWizardButtonProps) {
  const [isOpen, setIsOpen] = useState(false);
  const { createRuleSet, refetch } = useTemplates();

  const handleWizardComplete = async (payload: any) => {
    // Step 1: create rule_set + rule_version as draft
    let result: { ruleSet: any; version: any };
    try {
      result = await createRuleSet.mutateAsync({
        name: payload.meta?.template_name || 'Nueva plantilla',
        description: `Creada con asistente - ${payload.meta?.convenio || 'Sin convenio'}`,
        sector: payload.meta?.sector,
        convenio: payload.meta?.convenio,
        payload,
      });
    } catch {
      toast.error('Error al crear la plantilla');
      throw new Error('createRuleSet failed');
    }

    // Step 2: publish the version
    const { data: publishData, error: publishError } = await supabase.functions.invoke('templates-publish', {
      body: {
        rule_version_id: result.version.id,
        effective_from: payload.meta?.effective_from,
      },
    });

    const publishErrorMsg = publishError?.message || (publishData as any)?.error;
    if (publishErrorMsg) {
      toast.error(`Error al publicar la plantilla: ${publishErrorMsg}`);
      throw new Error(publishErrorMsg);
    }

    setIsOpen(false);
    refetch();
    toast.success('Plantilla publicada. Asígnala a tus empleados desde Empleados → icono Maletín');
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
