import { Check, AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useWizard } from './WizardContext';

const STEP_LABELS = [
  { step: 1, label: 'Convenio', icon: '📋' },
  { step: 2, label: 'Calendario', icon: '📅' },
  { step: 3, label: 'Jornada', icon: '⏰' },
  { step: 4, label: 'Pausas', icon: '☕' },
  { step: 5, label: 'H. Extra', icon: '⚡' },
  { step: 6, label: 'Parcial', icon: '📊' },
  { step: 7, label: 'Nocturn.', icon: '🌙' },
  { step: 8, label: 'Vacaciones', icon: '🏖️' },
  { step: 9, label: 'Turnos', icon: '🔄' },
  { step: 10, label: 'Notific.', icon: '🔔' },
  { step: 11, label: 'Simular', icon: '🧪' },
  { step: 12, label: 'Publicar', icon: '✅' },
];

export function WizardProgress() {
  const { state, goToStep, validateCurrentStep } = useWizard();
  const { currentStep, validationErrors } = state;

  return (
    <div className="w-full py-4">
      {/* Desktop view */}
      <div className="hidden lg:flex items-start justify-between">
        {STEP_LABELS.map(({ step, label, icon }, index) => {
          const isCompleted = step < currentStep;
          const isCurrent = step === currentStep;
          const hasError = isCurrent && validationErrors.length > 0;

          return (
            <div key={step} className="flex items-start flex-1">
              <div className="flex flex-col items-center w-10 shrink-0">
                <button
                  onClick={() => {
                    if (step < currentStep || (step === currentStep && validateCurrentStep())) {
                      goToStep(step);
                    }
                  }}
                  className={cn(
                    'w-10 h-10 rounded-full flex items-center justify-center text-sm font-medium transition-all',
                    isCompleted && 'bg-primary text-primary-foreground',
                    isCurrent && !hasError && 'bg-primary text-primary-foreground ring-4 ring-primary/20',
                    isCurrent && hasError && 'bg-destructive text-destructive-foreground ring-4 ring-destructive/20',
                    !isCompleted && !isCurrent && 'bg-muted text-muted-foreground hover:bg-muted/80'
                  )}
                  disabled={step > currentStep}
                >
                  {isCompleted ? (
                    <Check className="h-5 w-5" />
                  ) : hasError ? (
                    <AlertTriangle className="h-5 w-5" />
                  ) : (
                    <span>{icon}</span>
                  )}
                </button>
                <span
                  className={cn(
                    'mt-2 text-xs text-center whitespace-nowrap',
                    isCurrent ? 'text-foreground font-medium' : 'text-muted-foreground'
                  )}
                >
                  {label}
                </span>
              </div>
              {index < STEP_LABELS.length - 1 && (
                <div
                  className={cn(
                    'h-0.5 flex-1 mt-5',
                    isCompleted ? 'bg-primary' : 'bg-muted'
                  )}
                />
              )}
            </div>
          );
        })}
      </div>

      {/* Mobile view - compact */}
      <div className="lg:hidden">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-medium">
            Paso {currentStep} de 12: {STEP_LABELS[currentStep - 1]?.label}
          </span>
          <span className="text-sm text-muted-foreground">
            {Math.round((currentStep / 12) * 100)}%
          </span>
        </div>
        <div className="w-full bg-muted rounded-full h-2">
          <div
            className={cn(
              'h-2 rounded-full transition-all',
              validationErrors.length > 0 ? 'bg-destructive' : 'bg-primary'
            )}
            style={{ width: `${(currentStep / 12) * 100}%` }}
          />
        </div>
        <div className="flex justify-center gap-1 mt-3">
          {STEP_LABELS.map(({ step }) => (
            <div
              key={step}
              className={cn(
                'w-2 h-2 rounded-full',
                step < currentStep && 'bg-primary',
                step === currentStep && 'bg-primary ring-2 ring-primary/30',
                step > currentStep && 'bg-muted'
              )}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
