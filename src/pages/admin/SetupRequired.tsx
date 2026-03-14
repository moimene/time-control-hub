import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { CheckCircle2, XCircle, ArrowRight } from 'lucide-react';
import { useCompanySetup } from '@/hooks/useCompanySetup';

export default function SetupRequired() {
  const navigate = useNavigate();
  const { status, isLoading, criticalPending, progressPercent } = useCompanySetup();

  useEffect(() => {
    if (!isLoading && criticalPending.length === 0 && status) {
      navigate('/admin/dashboard', { replace: true });
    }
  }, [isLoading, criticalPending.length, status, navigate]);

  if (isLoading || !status) {
    return (
      <AppLayout>
        <div className="max-w-2xl mx-auto py-12 px-4 space-y-6 animate-pulse">
          <div className="text-center space-y-2">
            <div className="h-8 bg-gray-200 dark:bg-gray-700 rounded w-3/4 mx-auto" />
            <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-1/2 mx-auto" />
          </div>
          <div className="h-64 bg-gray-100 dark:bg-gray-800 rounded-lg" />
        </div>
      </AppLayout>
    );
  }

  const firstPending = criticalPending[0];

  return (
    <AppLayout>
      <div className="max-w-2xl mx-auto py-12 px-4 space-y-6">
        <div className="text-center space-y-2">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
            Configura tu empresa antes de continuar
          </h1>
          <p className="text-gray-500 dark:text-gray-400">
            Estos pasos son obligatorios para garantizar el cumplimiento legal de la Ley de Registro de Jornada.
          </p>
        </div>

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Progreso de configuración</CardTitle>
              <span className="text-2xl font-bold text-primary">{progressPercent}%</span>
            </div>
            <Progress value={progressPercent} className="h-3 mt-2" />
          </CardHeader>
          <CardContent className="space-y-3">
            {status.checks
              .filter(c => c.category === 'critical')
              .map(item => (
                <div
                  key={item.key}
                  className={`flex items-start gap-3 rounded-lg border p-4 ${
                    item.completed
                      ? 'border-green-200 bg-green-50 dark:bg-green-950/20'
                      : 'border-red-200 bg-red-50 dark:bg-red-950/20'
                  }`}
                >
                  {item.completed
                    ? <CheckCircle2 className="h-5 w-5 text-green-600 flex-shrink-0 mt-0.5" />
                    : <XCircle className="h-5 w-5 text-red-500 flex-shrink-0 mt-0.5" />}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{item.label}</span>
                      {!item.completed && (
                        <Badge variant="destructive" className="text-xs">Pendiente</Badge>
                      )}
                    </div>
                    <p className="text-sm text-gray-500 mt-0.5">{item.hint}</p>
                  </div>
                  {!item.completed && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => navigate(item.path)}
                      className="flex-shrink-0 gap-1"
                    >
                      Configurar
                      <ArrowRight className="h-3 w-3" />
                    </Button>
                  )}
                </div>
              ))}
          </CardContent>
        </Card>

        {firstPending && (
          <div className="text-center">
            <Button
              size="lg"
              onClick={() => navigate(firstPending.path)}
              className="gap-2"
            >
              Empezar con: {firstPending.label}
              <ArrowRight className="h-4 w-4" />
            </Button>
          </div>
        )}
      </div>
    </AppLayout>
  );
}
