import { useWizard } from '../WizardContext';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Coffee, AlertTriangle, Info } from 'lucide-react';
import { SECTOR_LABELS } from '@/types/templates';

const HARD_STOPS = {
  min_break_minutes: 15,
};

const SECTOR_BREAK_REFERENCE = {
  hosteleria: { threshold: 6, duration: 15, counts: false, note: 'No computa generalmente' },
  comercio: { threshold: 6, duration: 15, counts: false, note: 'Variable según convenio provincial' },
  servicios_profesionales: { threshold: 6, duration: 15, counts: true, note: 'Suele computar como trabajo efectivo' },
  salud: { threshold: 6, duration: 15, counts: true, note: 'Pausas asistenciales computables' },
  metal: { threshold: 6, duration: 15, counts: false, note: 'Depende del convenio provincial' },
};

export function StepBreaks() {
  const { state, updateNestedPayload } = useWizard();
  const breaks = state.payload.breaks || {};
  const sector = state.selectedSeedSector || '';
  const reference = SECTOR_BREAK_REFERENCE[sector as keyof typeof SECTOR_BREAK_REFERENCE];

  const breakDuration = breaks.break_duration_minutes_min ?? breaks.min_break_minutes ?? 15;
  const isBelowMinimum = breakDuration < HARD_STOPS.min_break_minutes;

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold mb-2">Paso 4: Pausas Intrajornada</h3>
        <p className="text-muted-foreground text-sm">
          Configure cuándo y cómo se aplican las pausas durante la jornada continuada.
        </p>
      </div>

      {/* Reference */}
      {reference && (
        <Alert className="bg-muted">
          <Info className="h-4 w-4" />
          <AlertDescription>
            <strong>Referencia {SECTOR_LABELS[sector] || sector}:</strong> Pausa de {reference.duration} min 
            cuando jornada &gt; {reference.threshold}h. {reference.note}.
          </AlertDescription>
        </Alert>
      )}

      {/* Hard-Stop Warning */}
      {isBelowMinimum && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            <strong>Requisito legal:</strong> La pausa mínima obligatoria es de 15 minutos cuando la jornada 
            continuada supera las 6 horas (Art. 34.4 ET).
          </AlertDescription>
        </Alert>
      )}

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Coffee className="h-4 w-4" />
            Configuración de pausas
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Threshold */}
          <div className="grid md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Umbral de horas para pausa obligatoria</Label>
              <Input
                type="number"
                value={breaks.break_threshold_hours ?? 6}
                onChange={(e) => updateNestedPayload('breaks', { 
                  break_threshold_hours: Number(e.target.value),
                  required_after_hours: Number(e.target.value)
                })}
              />
              <p className="text-xs text-muted-foreground">
                Estatuto: pausa obligatoria cuando jornada continuada &gt; 6 horas
              </p>
            </div>

            <div className="space-y-2">
              <Label className={isBelowMinimum ? 'text-destructive' : ''}>
                Duración mínima de la pausa (minutos)
              </Label>
              <Input
                type="number"
                min={HARD_STOPS.min_break_minutes}
                value={breakDuration}
                onChange={(e) => {
                  const value = Number(e.target.value);
                  updateNestedPayload('breaks', { 
                    break_duration_minutes_min: value,
                    min_break_minutes: value
                  });
                }}
                className={isBelowMinimum ? 'border-destructive' : ''}
              />
              <p className="text-xs text-muted-foreground">
                <strong>Mínimo legal: 15 minutos</strong>. Convenios pueden ampliar (20-30 min común).
              </p>
            </div>
          </div>

          {/* Counts as work */}
          <div className="flex items-start space-x-4 p-4 border rounded-lg">
            <Switch
              checked={breaks.break_counts_as_work || false}
              onCheckedChange={(checked) => updateNestedPayload('breaks', { break_counts_as_work: checked })}
            />
            <div className="space-y-1">
              <Label className="font-medium">La pausa computa como tiempo de trabajo efectivo</Label>
              <p className="text-sm text-muted-foreground">
                Si está activado, la pausa se incluye en el cómputo de jornada. Habitual en oficinas/despachos 
                y sanidad; menos frecuente en hostelería y comercio.
              </p>
              {reference && (
                <Badge variant="outline" className="mt-1">
                  {SECTOR_LABELS[sector]}: {reference.counts ? 'Sí computa' : 'No computa'} (típico)
                </Badge>
              )}
            </div>
          </div>

          {/* Enforcement Policy */}
          <div className="space-y-3">
            <Label>Política de aplicación</Label>
            <RadioGroup
              value={breaks.break_enforcement || 'required'}
              onValueChange={(value) => updateNestedPayload('breaks', { break_enforcement: value })}
              className="space-y-2"
            >
              <div className="flex items-start space-x-3 p-3 border rounded-lg">
                <RadioGroupItem value="required" id="required" />
                <div>
                  <Label htmlFor="required" className="font-medium cursor-pointer">
                    Obligatoria (recommended)
                  </Label>
                  <p className="text-xs text-muted-foreground">
                    El sistema genera alerta si no se registra pausa en jornadas que la requieren.
                  </p>
                </div>
              </div>
              <div className="flex items-start space-x-3 p-3 border rounded-lg">
                <RadioGroupItem value="recommended" id="recommended" />
                <div>
                  <Label htmlFor="recommended" className="font-medium cursor-pointer">
                    Recomendada
                  </Label>
                  <p className="text-xs text-muted-foreground">
                    Aviso informativo pero no genera incidencia de cumplimiento.
                  </p>
                </div>
              </div>
              <div className="flex items-start space-x-3 p-3 border rounded-lg">
                <RadioGroupItem value="optional" id="optional" />
                <div>
                  <Label htmlFor="optional" className="font-medium cursor-pointer">
                    Opcional
                  </Label>
                  <p className="text-xs text-muted-foreground">
                    Solo para convenios que explícitamente no requieren pausa. <strong>Verificar con asesor.</strong>
                  </p>
                </div>
              </div>
            </RadioGroup>
          </div>
        </CardContent>
      </Card>

      {/* Additional Info */}
      <Alert>
        <Info className="h-4 w-4" />
        <AlertDescription>
          <strong>Menores de edad:</strong> La pausa mínima es de 30 minutos cuando la jornada diaria 
          continuada supera las 4,5 horas. Configure reglas específicas si aplica.
        </AlertDescription>
      </Alert>
    </div>
  );
}
