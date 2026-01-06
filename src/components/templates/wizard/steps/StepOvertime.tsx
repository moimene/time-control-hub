import { useWizard } from '../WizardContext';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Slider } from '@/components/ui/slider';
import { Zap, AlertTriangle, Info, TrendingUp } from 'lucide-react';

const HARD_STOPS = {
  max_yearly: 80,
};

export function StepOvertime() {
  const { state, updateNestedPayload } = useWizard();
  const overtime = state.payload.overtime || {};
  const workingTime = state.payload.working_time || {};

  const yearlyCapValue = overtime.overtime_yearly_cap ?? 80;
  const isAboveLimit = yearlyCapValue > HARD_STOPS.max_yearly;

  const warnThreshold = overtime.overtime_alert_thresholds?.warn ?? 0.75;
  const criticalThreshold = overtime.overtime_alert_thresholds?.critical ?? 0.9;

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold mb-2">Paso 5: Horas Extraordinarias</h3>
        <p className="text-muted-foreground text-sm">
          Configure el tope anual de horas extra, compensación y alertas preventivas.
        </p>
      </div>

      {/* Hard-Stop Warning */}
      {isAboveLimit && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            <strong>Límite legal:</strong> El máximo de horas extraordinarias es de 80 h/año (Art. 35.2 ET). 
            Solo pueden superarse por fuerza mayor.
          </AlertDescription>
        </Alert>
      )}

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Zap className="h-4 w-4" />
            Límites de horas extraordinarias
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Yearly Cap */}
          <div className="space-y-2">
            <Label className={isAboveLimit ? 'text-destructive' : ''}>
              Tope anual de horas extraordinarias
            </Label>
            <Input
              type="number"
              max={HARD_STOPS.max_yearly}
              value={yearlyCapValue}
              onChange={(e) => updateNestedPayload('overtime', { overtime_yearly_cap: Number(e.target.value) })}
              className={isAboveLimit ? 'border-destructive' : ''}
            />
            <p className="text-xs text-muted-foreground">
              <strong>Máximo legal: 80 horas/año</strong>. Las compensadas con descanso dentro de 4 meses no computan.
            </p>
          </div>

          {/* Compensation Policy */}
          <div className="space-y-3">
            <Label>Política de compensación</Label>
            <RadioGroup
              value={overtime.overtime_compensation || 'mixto'}
              onValueChange={(value) => updateNestedPayload('overtime', { overtime_compensation: value })}
              className="grid md:grid-cols-3 gap-3"
            >
              <div className="flex items-start space-x-3 p-3 border rounded-lg">
                <RadioGroupItem value="pago" id="pago" />
                <div>
                  <Label htmlFor="pago" className="font-medium cursor-pointer">Pago</Label>
                  <p className="text-xs text-muted-foreground">Retribución económica según convenio</p>
                </div>
              </div>
              <div className="flex items-start space-x-3 p-3 border rounded-lg">
                <RadioGroupItem value="descanso" id="descanso" />
                <div>
                  <Label htmlFor="descanso" className="font-medium cursor-pointer">Descanso</Label>
                  <p className="text-xs text-muted-foreground">Compensación con tiempo libre (4 meses)</p>
                </div>
              </div>
              <div className="flex items-start space-x-3 p-3 border rounded-lg">
                <RadioGroupItem value="mixto" id="mixto" />
                <div>
                  <Label htmlFor="mixto" className="font-medium cursor-pointer">Mixto</Label>
                  <p className="text-xs text-muted-foreground">Según acuerdo o convenio</p>
                </div>
              </div>
            </RadioGroup>
          </div>
        </CardContent>
      </Card>

      {/* Alert Thresholds */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <TrendingUp className="h-4 w-4" />
            Umbrales de alerta preventiva
          </CardTitle>
          <CardDescription>
            El sistema generará alertas al alcanzar estos porcentajes del tope anual.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-4">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="flex items-center gap-2">
                  <Badge variant="outline" className="bg-yellow-100 text-yellow-800 border-yellow-300">Aviso</Badge>
                  Umbral de advertencia
                </Label>
                <span className="text-sm font-medium">{Math.round(warnThreshold * 100)}%</span>
              </div>
              <Slider
                value={[warnThreshold * 100]}
                onValueChange={([value]) => updateNestedPayload('overtime', {
                  overtime_alert_thresholds: {
                    ...overtime.overtime_alert_thresholds,
                    warn: value / 100
                  }
                })}
                min={50}
                max={90}
                step={5}
              />
              <p className="text-xs text-muted-foreground">
                Alerta informativa: {Math.round(yearlyCapValue * warnThreshold)} horas de {yearlyCapValue}
              </p>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="flex items-center gap-2">
                  <Badge variant="outline" className="bg-red-100 text-red-800 border-red-300">Crítico</Badge>
                  Umbral crítico
                </Label>
                <span className="text-sm font-medium">{Math.round(criticalThreshold * 100)}%</span>
              </div>
              <Slider
                value={[criticalThreshold * 100]}
                onValueChange={([value]) => updateNestedPayload('overtime', {
                  overtime_alert_thresholds: {
                    ...overtime.overtime_alert_thresholds,
                    critical: value / 100
                  }
                })}
                min={70}
                max={99}
                step={5}
              />
              <p className="text-xs text-muted-foreground">
                Alerta crítica: {Math.round(yearlyCapValue * criticalThreshold)} horas de {yearlyCapValue}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Irregular Distribution Note */}
      {(workingTime.irregular_distribution_pct || 0) > 0 && (
        <Alert>
          <Info className="h-4 w-4" />
          <AlertDescription>
            <strong>Distribución irregular activa ({workingTime.irregular_distribution_pct}%):</strong> Las horas 
            movidas dentro del porcentaje de distribución irregular no cuentan como horas extra mientras se 
            respeten los descansos mínimos y el cómputo anual.
          </AlertDescription>
        </Alert>
      )}
    </div>
  );
}
