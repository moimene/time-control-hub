import { useWizard } from '../WizardContext';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Slider } from '@/components/ui/slider';
import { Clock, AlertTriangle, ShieldCheck, Info } from 'lucide-react';
import { SECTOR_LABELS } from '@/types/templates';

const HARD_STOPS = {
  min_daily_rest: 12,
  min_weekly_rest: 36,
};

const SECTOR_REFERENCE = {
  hosteleria: { hours_year: 1780, max_daily: 9, max_weekly: 40, irregular: 10 },
  comercio: { hours_year: 1780, max_daily: 9, max_weekly: 40, irregular: 5 },
  servicios_profesionales: { hours_year: 1765, max_daily: 8, max_weekly: 40, irregular: 5 },
  salud: { hours_year: 1750, max_daily: 9, max_weekly: 40, irregular: 5 },
  metal: { hours_year: 1760, max_daily: 9, max_weekly: 40, irregular: 5 },
  construccion: { hours_year: 1736, max_daily: 9, max_weekly: 40, irregular: 5 },
};

export function StepWorkingHours() {
  const { state, updateNestedPayload } = useWizard();
  const workingTime = state.payload.working_time || {};
  const limits = state.payload.limits || {};
  const sector = state.selectedSeedSector || '';
  const reference = SECTOR_REFERENCE[sector as keyof typeof SECTOR_REFERENCE];

  const dailyRest = workingTime.rest_daily_hours_min ?? limits.min_daily_rest ?? 12;
  const weeklyRest = workingTime.rest_weekly_hours_min ?? limits.min_weekly_rest ?? 36;

  const isDailyRestBelowMinimum = dailyRest < HARD_STOPS.min_daily_rest;
  const isWeeklyRestBelowMinimum = weeklyRest < HARD_STOPS.min_weekly_rest;

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold mb-2">Paso 3: Jornada y Descansos</h3>
        <p className="text-muted-foreground text-sm">
          Configure la jornada anual, topes diarios/semanales y descansos mínimos obligatorios.
        </p>
      </div>

      {/* Reference Values */}
      {reference && (
        <Alert className="bg-muted">
          <Info className="h-4 w-4" />
          <AlertDescription>
            <strong>Referencia {SECTOR_LABELS[sector] || sector}:</strong> {reference.hours_year} h/año, 
            máx. diario {reference.max_daily}h, máx. semanal {reference.max_weekly}h, 
            distribución irregular hasta {reference.irregular}%
          </AlertDescription>
        </Alert>
      )}

      {/* Hard-Stop Warning */}
      <Alert variant="destructive" className={(!isDailyRestBelowMinimum && !isWeeklyRestBelowMinimum) ? 'hidden' : ''}>
        <AlertTriangle className="h-4 w-4" />
        <AlertDescription>
          <strong>Requisitos legales inamovibles:</strong>
          <ul className="list-disc list-inside mt-1">
            {isDailyRestBelowMinimum && (
              <li>Descanso diario mínimo: 12 horas entre jornadas</li>
            )}
            {isWeeklyRestBelowMinimum && (
              <li>Descanso semanal mínimo: 36 horas ininterrumpidas</li>
            )}
          </ul>
        </AlertDescription>
      </Alert>

      {/* Annual Hours */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Clock className="h-4 w-4" />
            Jornada anual y límites
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Horas anuales totales</Label>
              <Input
                type="number"
                value={workingTime.hours_per_year || 1780}
                onChange={(e) => updateNestedPayload('working_time', { hours_per_year: Number(e.target.value) })}
              />
              <p className="text-xs text-muted-foreground">
                Según convenio aplicable. Estatuto: máx. 1826h (40h × 52 sem - festivos)
              </p>
            </div>

            <div className="space-y-2">
              <Label>Distribución irregular (%)</Label>
              <div className="flex items-center gap-4">
                <Slider
                  value={[workingTime.irregular_distribution_pct || 0]}
                  onValueChange={([value]) => updateNestedPayload('working_time', { irregular_distribution_pct: value })}
                  max={15}
                  min={0}
                  step={1}
                  className="flex-1"
                />
                <Badge variant="outline" className="w-12 justify-center">
                  {workingTime.irregular_distribution_pct || 0}%
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground">
                Permite mover horas entre semanas (hostelería/comercio hasta 10-15%)
              </p>
            </div>
          </div>

          <div className="grid md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Máximo diario (horas)</Label>
              <Input
                type="number"
                value={workingTime.max_daily_hours ?? limits.max_daily_hours ?? 9}
                onChange={(e) => {
                  const value = Number(e.target.value);
                  updateNestedPayload('working_time', { max_daily_hours: value });
                  updateNestedPayload('limits', { max_daily_hours: value });
                }}
              />
              <p className="text-xs text-muted-foreground">
                Estatuto: máx. 9h (salvo convenio). Menores: máx. 8h.
              </p>
            </div>

            <div className="space-y-2">
              <Label>Máximo semanal (horas)</Label>
              <Input
                type="number"
                value={workingTime.max_weekly_hours ?? limits.max_weekly_hours ?? 40}
                onChange={(e) => {
                  const value = Number(e.target.value);
                  updateNestedPayload('working_time', { max_weekly_hours: value });
                  updateNestedPayload('limits', { max_weekly_hours: value });
                }}
              />
              <p className="text-xs text-muted-foreground">
                Media en cómputo anual. Puede superarse puntualmente con distribución irregular.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Rest Periods - Hard Stops */}
      <Card className={isDailyRestBelowMinimum || isWeeklyRestBelowMinimum ? 'border-destructive' : 'border-primary'}>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <ShieldCheck className="h-4 w-4" />
            Descansos mínimos obligatorios
            <Badge variant={isDailyRestBelowMinimum || isWeeklyRestBelowMinimum ? 'destructive' : 'default'}>
              {isDailyRestBelowMinimum || isWeeklyRestBelowMinimum ? 'Por debajo del mínimo' : 'Conforme'}
            </Badge>
          </CardTitle>
          <CardDescription>
            Estos valores son mínimos legales inamovibles. No se permite publicar por debajo de ellos.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className={isDailyRestBelowMinimum ? 'text-destructive' : ''}>
                Descanso diario entre jornadas (horas)
              </Label>
              <Input
                type="number"
                min={HARD_STOPS.min_daily_rest}
                value={dailyRest}
                onChange={(e) => {
                  const value = Number(e.target.value);
                  updateNestedPayload('working_time', { rest_daily_hours_min: value });
                  updateNestedPayload('limits', { min_daily_rest: value });
                }}
                className={isDailyRestBelowMinimum ? 'border-destructive' : ''}
              />
              <p className="text-xs text-muted-foreground">
                <strong>Mínimo legal: 12 horas</strong> (Art. 34.3 ET)
              </p>
            </div>

            <div className="space-y-2">
              <Label className={isWeeklyRestBelowMinimum ? 'text-destructive' : ''}>
                Descanso semanal (horas)
              </Label>
              <Input
                type="number"
                min={HARD_STOPS.min_weekly_rest}
                value={weeklyRest}
                onChange={(e) => {
                  const value = Number(e.target.value);
                  updateNestedPayload('working_time', { rest_weekly_hours_min: value });
                  updateNestedPayload('limits', { min_weekly_rest: value });
                }}
                className={isWeeklyRestBelowMinimum ? 'border-destructive' : ''}
              />
              <p className="text-xs text-muted-foreground">
                <strong>Mínimo legal: 36 horas</strong> (día y medio, Art. 37.1 ET)
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
