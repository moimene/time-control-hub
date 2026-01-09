import { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { WizardProvider, useWizard } from './WizardContext';
import { WizardProgress } from './WizardProgress';
import { StepConvenio } from './steps/StepConvenio';
import { StepCalendar } from './steps/StepCalendar';
import { StepWorkingHours } from './steps/StepWorkingHours';
import { StepBreaks } from './steps/StepBreaks';
import { StepOvertime } from './steps/StepOvertime';
import { StepPartTime } from './steps/StepPartTime';
import { StepNightWork } from './steps/StepNightWork';
import { StepVacations } from './steps/StepVacations';
import { StepShifts } from './steps/StepShifts';
import { StepNotifications } from './steps/StepNotifications';
import { StepSimulation } from './steps/StepSimulation';
import { StepPublish } from './steps/StepPublish';
import { ChevronLeft, ChevronRight, AlertTriangle, X, Save, Check } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { es } from 'date-fns/locale';
import { toast } from 'sonner';

interface TemplateWizardProps {
  onComplete: (payload: any) => void;
  onCancel: () => void;
  initialCNAE?: string;
  initialSector?: string;
}

const STEP_NAMES = [
  'Convenio',
  'Calendario',
  'Jornada',
  'Pausas',
  'Horas Extra',
  'Tiempo Parcial',
  'Trabajo Nocturno',
  'Vacaciones',
  'Turnos',
  'Notificaciones',
  'Simulación',
  'Publicación',
];

function WizardContent({ onComplete, onCancel }: TemplateWizardProps) {
  const { state, nextStep, prevStep, validateCurrentStep, resetWizard, hasDraft, clearDraft, lastSavedAt, saveCurrentStep, isStepSaved } = useWizard();
  const { currentStep, validationErrors, payload } = state;
  const [showDraftDialog, setShowDraftDialog] = useState(hasDraft && currentStep > 1);

  const handleNext = () => {
    if (validateCurrentStep()) {
      nextStep();
    }
  };

  const handleSaveStep = () => {
    if (validateCurrentStep()) {
      saveCurrentStep();
      toast.success(`Paso "${STEP_NAMES[currentStep - 1]}" guardado correctamente`);
    }
  };

  const handleDiscardDraft = () => {
    resetWizard();
    setShowDraftDialog(false);
  };

  const handleContinueDraft = () => {
    setShowDraftDialog(false);
  };

  const handleComplete = () => {
    clearDraft();
    onComplete(payload);
  };

  const handleCancel = () => {
    // Keep draft for later
    onCancel();
  };

  const currentStepSaved = isStepSaved(currentStep);

  const renderStep = () => {
    switch (currentStep) {
      case 1: return <StepConvenio />;
      case 2: return <StepCalendar />;
      case 3: return <StepWorkingHours />;
      case 4: return <StepBreaks />;
      case 5: return <StepOvertime />;
      case 6: return <StepPartTime />;
      case 7: return <StepNightWork />;
      case 8: return <StepVacations />;
      case 9: return <StepShifts />;
      case 10: return <StepNotifications />;
      case 11: return <StepSimulation />;
      case 12: return <StepPublish onComplete={handleComplete} />;
      default: return null;
    }
  };

  return (
    <div className="space-y-6">
      {/* Draft Recovery Dialog */}
      {showDraftDialog && (
        <Alert className="bg-blue-50 border-blue-200 dark:bg-blue-950 dark:border-blue-800">
          <AlertTriangle className="h-4 w-4 text-blue-600" />
          <AlertDescription className="flex items-center justify-between">
            <span className="text-blue-800 dark:text-blue-200">
              <strong>Borrador encontrado:</strong> Tienes una configuración incompleta en el paso {currentStep}.
            </span>
            <div className="flex gap-2 ml-4">
              <Button size="sm" variant="outline" onClick={handleDiscardDraft}>
                Descartar
              </Button>
              <Button size="sm" onClick={handleContinueDraft}>
                Continuar
              </Button>
            </div>
          </AlertDescription>
        </Alert>
      )}

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Asistente de Configuración</h2>
          <p className="text-muted-foreground">
            Configure su plantilla de cumplimiento paso a paso
          </p>
        </div>
        <div className="flex items-center gap-3">
          {lastSavedAt && (
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Save className="h-3 w-3" />
              <span>Guardado {formatDistanceToNow(lastSavedAt, { addSuffix: true, locale: es })}</span>
            </div>
          )}
          <Button variant="ghost" size="icon" onClick={handleCancel}>
            <X className="h-5 w-5" />
          </Button>
        </div>
      </div>

      {/* Progress */}
      <WizardProgress />

      {/* Validation Errors */}
      {validationErrors.length > 0 && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            <ul className="list-disc list-inside space-y-1">
              {validationErrors.map((error, i) => (
                <li key={i}>{error}</li>
              ))}
            </ul>
          </AlertDescription>
        </Alert>
      )}

      {/* Step Content */}
      <Card>
        <CardContent className="pt-6">
          {renderStep()}
        </CardContent>
      </Card>

      {/* Navigation */}
      <div className="flex justify-between items-center">
        <Button
          variant="outline"
          onClick={prevStep}
          disabled={currentStep === 1}
        >
          <ChevronLeft className="h-4 w-4 mr-2" />
          Anterior
        </Button>

        <div className="flex items-center gap-2">
          {/* Save current step button */}
          {currentStep < 12 && (
            <Button
              variant={currentStepSaved ? "secondary" : "outline"}
              onClick={handleSaveStep}
            >
              {currentStepSaved ? (
                <>
                  <Check className="h-4 w-4 mr-2" />
                  Paso guardado
                </>
              ) : (
                <>
                  <Save className="h-4 w-4 mr-2" />
                  Guardar paso
                </>
              )}
            </Button>
          )}

          {currentStep < 12 && (
            <Button onClick={handleNext}>
              Siguiente
              <ChevronRight className="h-4 w-4 ml-2" />
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

export function TemplateWizard(props: TemplateWizardProps) {
  return (
    <WizardProvider>
      <WizardContent {...props} />
    </WizardProvider>
  );
}
