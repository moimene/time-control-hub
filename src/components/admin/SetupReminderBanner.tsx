import { useNavigate } from 'react-router-dom';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { AlertTriangle, CheckCircle2, XCircle, Settings } from 'lucide-react';
import { useCompanySetup, type SetupCheck } from '@/hooks/useCompanySetup';

function CheckItem({ item, onClick }: { item: SetupCheck; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={!item.completed ? onClick : undefined}
      className={`flex items-start gap-2 rounded-md px-3 py-2 text-sm text-left w-full transition-colors ${
        item.completed
          ? 'bg-green-100 dark:bg-green-950/30 text-green-700 dark:text-green-300'
          : item.category === 'critical'
            ? 'bg-red-100 dark:bg-red-950/30 text-red-700 dark:text-red-300 hover:bg-red-200 cursor-pointer'
            : 'bg-amber-100 dark:bg-amber-950/30 text-amber-700 dark:text-amber-300 hover:bg-amber-200 cursor-pointer'
      }`}
    >
      {item.completed
        ? <CheckCircle2 className="h-4 w-4 flex-shrink-0 mt-0.5 text-green-600" />
        : <XCircle className="h-4 w-4 flex-shrink-0 mt-0.5 text-red-600" />}
      <div className="flex flex-col min-w-0">
        <span className="truncate font-medium">{item.label}</span>
        <span className="text-xs opacity-75 whitespace-normal">{item.hint}</span>
        {item.auto_provided && item.completed && (
          <span className="text-xs opacity-60 mt-0.5">Auto-configurado</span>
        )}
      </div>
    </button>
  );
}

export function SetupReminderBanner() {
  const navigate = useNavigate();
  const { status, isLoading, isReady, criticalPending, recommendedPending, progressPercent } =
    useCompanySetup();

  if (isLoading || !status || isReady) return null;

  const firstCritical = criticalPending[0];

  return (
    <Alert
      variant="default"
      className="border-red-500/50 bg-red-50 dark:bg-red-950/20"
    >
      <AlertTriangle className="h-5 w-5 text-red-600" />
      <AlertTitle className="text-red-800 dark:text-red-200 font-semibold flex items-center gap-2">
        Configuración incompleta
        {criticalPending.length > 0 && (
          <Badge variant="destructive" className="text-xs">
            {criticalPending.length} obligatorio{criticalPending.length > 1 ? 's' : ''} pendiente{criticalPending.length > 1 ? 's' : ''}
          </Badge>
        )}
      </AlertTitle>

      <AlertDescription className="mt-3 space-y-4">
        <div className="space-y-1">
          <div className="flex items-center justify-between text-sm">
            <span className="text-red-700 dark:text-red-300">
              Progreso de configuración
            </span>
            <span className="font-medium text-red-800 dark:text-red-200">{progressPercent}%</span>
          </div>
          <Progress value={progressPercent} className="h-2" />
        </div>

        {criticalPending.length > 0 && (
          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-wide text-red-600">
              Obligatorios para operar
            </p>
            <div className="grid gap-2 sm:grid-cols-2">
              {status.checks
                .filter(c => c.category === 'critical')
                .map(item => (
                  <CheckItem
                    key={item.key}
                    item={item}
                    onClick={() => navigate(item.path)}
                  />
                ))}
            </div>
          </div>
        )}

        {recommendedPending.length > 0 && (
          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-wide text-amber-600">
              Recomendados
            </p>
            <div className="grid gap-2 sm:grid-cols-2">
              {status.checks
                .filter(c => c.category === 'recommended')
                .map(item => (
                  <CheckItem
                    key={item.key}
                    item={item}
                    onClick={() => navigate(item.path)}
                  />
                ))}
            </div>
          </div>
        )}

        <div className="flex flex-wrap gap-2 pt-2">
          {firstCritical && (
            <Button
              size="sm"
              variant="destructive"
              onClick={() => navigate(firstCritical.path)}
              className="gap-2"
            >
              <Settings className="h-4 w-4" />
              Resolver: {firstCritical.label}
            </Button>
          )}
          <Button
            variant="outline"
            size="sm"
            onClick={() => navigate('/admin/settings')}
          >
            Ver toda la configuración
          </Button>
        </div>
      </AlertDescription>
    </Alert>
  );
}
