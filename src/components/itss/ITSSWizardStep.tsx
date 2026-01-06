import { ReactNode } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ChevronLeft, ChevronRight, Check, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ITSSWizardStepProps {
  step: number;
  totalSteps: number;
  title: string;
  description: string;
  children: ReactNode;
  onNext?: () => void;
  onBack?: () => void;
  nextLabel?: string;
  backLabel?: string;
  isLoading?: boolean;
  canProceed?: boolean;
  isComplete?: boolean;
}

export function ITSSWizardStep({
  step,
  totalSteps,
  title,
  description,
  children,
  onNext,
  onBack,
  nextLabel = 'Siguiente',
  backLabel = 'Anterior',
  isLoading = false,
  canProceed = true,
  isComplete = false
}: ITSSWizardStepProps) {
  return (
    <Card className="w-full">
      <CardHeader>
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            {Array.from({ length: totalSteps }).map((_, i) => (
              <div
                key={i}
                className={cn(
                  'w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium transition-colors',
                  i + 1 < step
                    ? 'bg-primary text-primary-foreground'
                    : i + 1 === step
                    ? 'bg-primary text-primary-foreground ring-2 ring-primary ring-offset-2'
                    : 'bg-muted text-muted-foreground'
                )}
              >
                {i + 1 < step ? <Check className="h-4 w-4" /> : i + 1}
              </div>
            ))}
          </div>
          <span className="text-sm text-muted-foreground">
            Paso {step} de {totalSteps}
          </span>
        </div>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {children}
        
        <div className="flex justify-between pt-4 border-t">
          <Button
            variant="outline"
            onClick={onBack}
            disabled={step === 1 || isLoading}
          >
            <ChevronLeft className="h-4 w-4 mr-2" />
            {backLabel}
          </Button>
          
          {step < totalSteps ? (
            <Button
              onClick={onNext}
              disabled={!canProceed || isLoading}
            >
              {isLoading ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : null}
              {nextLabel}
              <ChevronRight className="h-4 w-4 ml-2" />
            </Button>
          ) : (
            <Button
              onClick={onNext}
              disabled={!canProceed || isLoading}
              className={cn(isComplete && 'bg-green-600 hover:bg-green-700')}
            >
              {isLoading ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : isComplete ? (
                <Check className="h-4 w-4 mr-2" />
              ) : null}
              {nextLabel}
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
