import { useState } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { TemplateLibrary } from '@/components/templates/TemplateLibrary';
import { TemplateEditor } from '@/components/templates/TemplateEditor';
import { TemplateSimulator } from '@/components/templates/TemplateSimulator';
import { TemplateWizard } from '@/components/templates/wizard/TemplateWizard';
import { RuleSetWithVersions } from '@/types/templates';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Wand2 } from 'lucide-react';
import { useTemplates } from '@/hooks/useTemplates';
import { toast } from 'sonner';

export default function Templates() {
  const [selectedRuleSet, setSelectedRuleSet] = useState<RuleSetWithVersions | null>(null);
  const [activeTab, setActiveTab] = useState<'library' | 'editor' | 'simulator'>('library');
  const [showWizard, setShowWizard] = useState(false);
  const { createRuleSet, refetch } = useTemplates();

  const handleSelectRuleSet = (ruleSet: RuleSetWithVersions) => {
    setSelectedRuleSet(ruleSet);
    setActiveTab('editor');
  };

  const handleBack = () => {
    setSelectedRuleSet(null);
    setActiveTab('library');
  };

  const handleSimulate = () => {
    setActiveTab('simulator');
  };

  const handleWizardComplete = async (payload: any) => {
    try {
      await createRuleSet.mutateAsync({
        name: payload.meta?.template_name || 'Nueva plantilla',
        description: `Creada con asistente - ${payload.meta?.convenio || 'Sin convenio'}`,
        sector: payload.meta?.sector,
        convenio: payload.meta?.convenio,
        payload,
      });
      setShowWizard(false);
      refetch();
      toast.success('Plantilla creada correctamente con el asistente');
    } catch (error) {
      toast.error('Error al crear la plantilla');
    }
  };

  if (showWizard) {
    return (
      <AppLayout>
        <TemplateWizard
          onComplete={handleWizardComplete}
          onCancel={() => setShowWizard(false)}
        />
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            {selectedRuleSet && (
              <Button variant="ghost" size="icon" onClick={handleBack}>
                <ArrowLeft className="h-5 w-5" />
              </Button>
            )}
            <div>
              <h1 className="text-3xl font-bold">
                {selectedRuleSet ? selectedRuleSet.name : 'Plantillas de Cumplimiento'}
              </h1>
              <p className="text-muted-foreground">
                {selectedRuleSet 
                  ? 'Edita, valida y publica la plantilla'
                  : 'Gestiona las reglas de cumplimiento por sector y convenio'
                }
              </p>
            </div>
          </div>
          {!selectedRuleSet && (
            <Button onClick={() => setShowWizard(true)}>
              <Wand2 className="h-4 w-4 mr-2" />
              Asistente de configuración
            </Button>
          )}
        </div>

        {selectedRuleSet ? (
          <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'editor' | 'simulator')}>
            <TabsList>
              <TabsTrigger value="editor">Editor</TabsTrigger>
              <TabsTrigger value="simulator">Simulador</TabsTrigger>
            </TabsList>
            
            <TabsContent value="editor" className="mt-6">
              <TemplateEditor 
                ruleSet={selectedRuleSet} 
                onSimulate={handleSimulate}
              />
            </TabsContent>
            
            <TabsContent value="simulator" className="mt-6">
              <TemplateSimulator ruleSet={selectedRuleSet} />
            </TabsContent>
          </Tabs>
        ) : (
          <TemplateLibrary onSelect={handleSelectRuleSet} />
        )}
      </div>
    </AppLayout>
  );
}
