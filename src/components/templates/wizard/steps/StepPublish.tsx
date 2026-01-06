import { useState } from 'react';
import { useWizard } from '../WizardContext';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Checkbox } from '@/components/ui/checkbox';
import { Separator } from '@/components/ui/separator';
import { Rocket, Calendar, CheckCircle2, AlertTriangle, Info, FileCheck, Clock } from 'lucide-react';
import { format, addMonths } from 'date-fns';
import { es } from 'date-fns/locale';
import { SECTOR_LABELS } from '@/types/templates';

interface StepPublishProps {
  onComplete: () => void;
}

export function StepPublish({ onComplete }: StepPublishProps) {
  const { state, updateNestedPayload } = useWizard();
  const { payload, selectedSeedSector, isSimulationComplete, simulationResult } = state;

  const [effectiveFrom, setEffectiveFrom] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [effectiveTo, setEffectiveTo] = useState(format(addMonths(new Date(), 12), 'yyyy-MM-dd'));
  const [confirmations, setConfirmations] = useState({
    reviewed: false,
    legal: false,
    simulation: false,
  });
  const [isPublishing, setIsPublishing] = useState(false);

  const criticalCount = simulationResult?.summary?.by_severity?.critical || 0;
  const allConfirmed = Object.values(confirmations).every(Boolean);
  const canPublish = allConfirmed && criticalCount === 0;

  const handlePublish = async () => {
    if (!canPublish) return;

    setIsPublishing(true);
    
    // Update payload with effective dates
    updateNestedPayload('meta', {
      effective_from: effectiveFrom,
      effective_to: effectiveTo,
      version: 'v1.0',
    });

    // Simulate publishing delay
    await new Promise(resolve => setTimeout(resolve, 1500));
    
    setIsPublishing(false);
    onComplete();
  };

  // Summary of configuration
  const configSummary = [
    { label: 'Sector', value: SECTOR_LABELS[selectedSeedSector || ''] || 'No especificado' },
    { label: 'Convenio', value: payload.meta?.convenio || 'Por definir' },
    { label: 'Jornada anual', value: `${payload.working_time?.hours_per_year || 1780} horas` },
    { label: 'Máx. diario', value: `${payload.limits?.max_daily_hours || 9} horas` },
    { label: 'Descanso diario', value: `${payload.limits?.min_daily_rest || 12} horas` },
    { label: 'Descanso semanal', value: `${payload.limits?.min_weekly_rest || 36} horas` },
    { label: 'Horas extra', value: `Máx. ${payload.overtime?.overtime_yearly_cap || 80} h/año` },
    { label: 'Vacaciones', value: `${payload.vacations?.vacation_days_year || 30} días` },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold mb-2">Paso 12: Publicación y Vigencia</h3>
        <p className="text-muted-foreground text-sm">
          Revise la configuración final, establezca fechas de vigencia y publique la plantilla.
        </p>
      </div>

      {/* Configuration Summary */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <FileCheck className="h-4 w-4" />
            Resumen de configuración
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid sm:grid-cols-2 md:grid-cols-4 gap-3">
            {configSummary.map((item) => (
              <div key={item.label} className="p-3 bg-muted/50 rounded-lg">
                <div className="text-xs text-muted-foreground">{item.label}</div>
                <div className="font-medium text-sm">{item.value}</div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Simulation Status */}
      {isSimulationComplete ? (
        criticalCount > 0 ? (
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              <strong>No se puede publicar:</strong> Hay {criticalCount} incidencias críticas en la simulación. 
              Vuelva al paso anterior y ajuste los parámetros.
            </AlertDescription>
          </Alert>
        ) : (
          <Alert className="bg-green-50 border-green-200 dark:bg-green-950 dark:border-green-800">
            <CheckCircle2 className="h-4 w-4 text-green-600" />
            <AlertDescription className="text-green-800 dark:text-green-200">
              <strong>Simulación superada:</strong> No se detectaron incidencias críticas con esta configuración.
            </AlertDescription>
          </Alert>
        )
      ) : (
        <Alert>
          <Info className="h-4 w-4" />
          <AlertDescription>
            <strong>Simulación pendiente:</strong> Se recomienda ejecutar una simulación antes de publicar 
            (paso anterior) para validar la configuración.
          </AlertDescription>
        </Alert>
      )}

      {/* Effective Dates */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Calendar className="h-4 w-4" />
            Fechas de vigencia
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Vigente desde</Label>
              <Input
                type="date"
                value={effectiveFrom}
                onChange={(e) => setEffectiveFrom(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Vigente hasta</Label>
              <Input
                type="date"
                value={effectiveTo}
                onChange={(e) => setEffectiveTo(e.target.value)}
                min={effectiveFrom}
              />
            </div>
          </div>
          <p className="text-xs text-muted-foreground mt-2">
            Se recomienda revisar la plantilla cuando cambie el convenio o las condiciones laborales.
          </p>
        </CardContent>
      </Card>

      {/* Confirmations */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Confirmaciones requeridas</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-start space-x-3 p-3 border rounded-lg">
            <Checkbox
              checked={confirmations.reviewed}
              onCheckedChange={(checked) => setConfirmations(prev => ({ ...prev, reviewed: checked as boolean }))}
            />
            <div>
              <Label className="font-medium cursor-pointer">
                He revisado toda la configuración
              </Label>
              <p className="text-xs text-muted-foreground">
                Confirmo que los valores configurados corresponden a mi convenio y situación particular.
              </p>
            </div>
          </div>

          <div className="flex items-start space-x-3 p-3 border rounded-lg">
            <Checkbox
              checked={confirmations.legal}
              onCheckedChange={(checked) => setConfirmations(prev => ({ ...prev, legal: checked as boolean }))}
            />
            <div>
              <Label className="font-medium cursor-pointer">
                Entiendo que los valores seed son orientativos
              </Label>
              <p className="text-xs text-muted-foreground">
                Las plantillas predefinidas son referencias. Debo verificar con mi convenio específico 
                y/o asesor laboral antes de aplicar en producción.
              </p>
            </div>
          </div>

          <div className="flex items-start space-x-3 p-3 border rounded-lg">
            <Checkbox
              checked={confirmations.simulation}
              onCheckedChange={(checked) => setConfirmations(prev => ({ ...prev, simulation: checked as boolean }))}
            />
            <div>
              <Label className="font-medium cursor-pointer">
                He verificado los resultados de la simulación
              </Label>
              <p className="text-xs text-muted-foreground">
                {isSimulationComplete 
                  ? `Revisé ${simulationResult?.summary?.total || 0} incidencias detectadas y estoy conforme.`
                  : 'Entiendo los riesgos de publicar sin simular previamente.'
                }
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Separator />

      {/* Publish Button */}
      <div className="flex justify-end">
        <Button
          size="lg"
          onClick={handlePublish}
          disabled={!canPublish || isPublishing}
          className="min-w-[200px]"
        >
          {isPublishing ? (
            <>
              <div className="animate-spin mr-2 h-4 w-4 border-2 border-current border-t-transparent rounded-full" />
              Publicando...
            </>
          ) : (
            <>
              <Rocket className="h-4 w-4 mr-2" />
              Publicar plantilla
            </>
          )}
        </Button>
      </div>

      {!canPublish && allConfirmed && criticalCount > 0 && (
        <p className="text-center text-sm text-destructive">
          Resuelva las incidencias críticas antes de publicar.
        </p>
      )}
    </div>
  );
}
