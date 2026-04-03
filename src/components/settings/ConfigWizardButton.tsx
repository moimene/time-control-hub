import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import { TemplateWizard } from '@/components/templates/wizard/TemplateWizard';
import { useTemplates } from '@/hooks/useTemplates';
import { useCompany } from '@/hooks/useCompany';
import { Wand2 } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { createWizardPublishError, ensureWizardDraft, getDraftPublishStatus } from '@/lib/wizardPublish';
import type { PublishDraftTarget, TemplatePayload } from '@/types/templates';

interface ConfigWizardButtonProps {
  className?: string;
}

export function ConfigWizardButton({ className }: ConfigWizardButtonProps) {
  const [isOpen, setIsOpen] = useState(false);
  const { companyId } = useCompany();
  const { refetch } = useTemplates();

  const handleWizardComplete = async (payload: TemplatePayload, publishDraft: PublishDraftTarget | null) => {
    let activeDraft = publishDraft;

    try {
      const draftStatus = await getDraftPublishStatus(publishDraft);
      if (draftStatus?.publishedAt || draftStatus?.ruleSetStatus === 'published') {
        setIsOpen(false);
        refetch();
        toast.success('Plantilla publicada. Asígnala a tus empleados desde Empleados -> icono Maletín');
        return;
      }

      activeDraft = await ensureWizardDraft({
        companyId,
        payload,
        publishDraft,
      });

      const { data: publishData, error: publishError } = await supabase.functions.invoke('templates-publish', {
        body: {
          rule_version_id: activeDraft.versionId,
          effective_from: payload.meta?.effective_from,
        },
      });

      const publishErrorMsg = publishError?.message || (publishData as { error?: string } | null)?.error;
      if (publishErrorMsg) {
        toast.error(`Error al publicar la plantilla: ${publishErrorMsg}`);
        throw createWizardPublishError(publishErrorMsg, activeDraft);
      }

      setIsOpen(false);
      refetch();
      toast.success('Plantilla publicada. Asígnala a tus empleados desde Empleados -> icono Maletín');
    } catch (error) {
      const publishError = error as Error & { publishDraft?: PublishDraftTarget | null };
      if (activeDraft && !publishError.publishDraft) {
        publishError.publishDraft = activeDraft;
      }
      throw publishError;
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
