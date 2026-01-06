import { useWizard } from '../WizardContext';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Moon, Sun, Info } from 'lucide-react';
import { SECTOR_LABELS } from '@/types/templates';

const SECTOR_NIGHT_REFERENCE = {
  hosteleria: { band: '22:00-06:00', policy: 'recargo', holiday_recargo: 75 },
  salud: { band: '22:00-06:00', policy: 'recargo', holiday_recargo: 100 },
  metal: { band: '22:00-06:00', policy: 'recargo', holiday_recargo: 75 },
  comercio_alimentacion: { band: '22:00-06:00', policy: 'recargo', holiday_recargo: 75 },
};

export function StepNightWork() {
  const { state, updateNestedPayload } = useWizard();
  const nightWork = state.payload.night_work || {};
  const holidays = state.payload.holidays || {};
  const sector = state.selectedSeedSector || '';
  const reference = SECTOR_NIGHT_REFERENCE[sector as keyof typeof SECTOR_NIGHT_REFERENCE];

  const nightBand = nightWork.night_band || '22:00-06:00';
  const [nightStart, nightEnd] = nightBand.split('-');

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold mb-2">Paso 7: Nocturnidad, Festivos y Fines de Semana</h3>
        <p className="text-muted-foreground text-sm">
          Configure la franja nocturna, recargos y compensaciones por trabajo en festivos.
        </p>
      </div>

      {/* Reference */}
      {reference && (
        <Alert className="bg-muted">
          <Info className="h-4 w-4" />
          <AlertDescription>
            <strong>Referencia {SECTOR_LABELS[sector] || sector}:</strong> Franja nocturna {reference.band}, 
            política de {reference.policy}, festivos +{reference.holiday_recargo}%.
          </AlertDescription>
        </Alert>
      )}

      {/* Night Work */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Moon className="h-4 w-4" />
            Trabajo nocturno
          </CardTitle>
          <CardDescription>
            La franja nocturna legal es de 22:00 a 06:00. Los convenios pueden ajustar condiciones.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Night Band */}
          <div className="grid md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Inicio franja nocturna</Label>
              <Input
                type="time"
                value={nightStart || '22:00'}
                onChange={(e) => updateNestedPayload('night_work', { 
                  night_band: `${e.target.value}-${nightEnd || '06:00'}` 
                })}
              />
            </div>
            <div className="space-y-2">
              <Label>Fin franja nocturna</Label>
              <Input
                type="time"
                value={nightEnd || '06:00'}
                onChange={(e) => updateNestedPayload('night_work', { 
                  night_band: `${nightStart || '22:00'}-${e.target.value}` 
                })}
              />
            </div>
          </div>

          {/* Night Premium Policy */}
          <div className="space-y-3">
            <Label>Política de compensación nocturna</Label>
            <RadioGroup
              value={nightWork.night_premium_policy || 'recargo'}
              onValueChange={(value) => updateNestedPayload('night_work', { night_premium_policy: value })}
              className="grid md:grid-cols-3 gap-3"
            >
              <div className="flex items-start space-x-3 p-3 border rounded-lg">
                <RadioGroupItem value="recargo" id="recargo" />
                <div>
                  <Label htmlFor="recargo" className="font-medium cursor-pointer">Recargo económico</Label>
                  <p className="text-xs text-muted-foreground">Según convenio (típico 20-25%)</p>
                </div>
              </div>
              <div className="flex items-start space-x-3 p-3 border rounded-lg">
                <RadioGroupItem value="descanso" id="descanso_noche" />
                <div>
                  <Label htmlFor="descanso_noche" className="font-medium cursor-pointer">Descanso compensatorio</Label>
                  <p className="text-xs text-muted-foreground">Reducción de jornada equivalente</p>
                </div>
              </div>
              <div className="flex items-start space-x-3 p-3 border rounded-lg">
                <RadioGroupItem value="mixto" id="mixto_noche" />
                <div>
                  <Label htmlFor="mixto_noche" className="font-medium cursor-pointer">Mixto</Label>
                  <p className="text-xs text-muted-foreground">Combinación según acuerdo</p>
                </div>
              </div>
            </RadioGroup>
          </div>
        </CardContent>
      </Card>

      {/* Holiday Work */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Sun className="h-4 w-4" />
            Trabajo en festivos
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Authorization Required */}
          <div className="flex items-start space-x-4 p-4 border rounded-lg">
            <Switch
              checked={holidays.work_on_holiday_requires_auth ?? true}
              onCheckedChange={(checked) => updateNestedPayload('holidays', { work_on_holiday_requires_auth: checked })}
            />
            <div className="space-y-1">
              <Label className="font-medium">Requiere autorización previa</Label>
              <p className="text-sm text-muted-foreground">
                El trabajo en festivo debe ser autorizado expresamente por la empresa.
              </p>
            </div>
          </div>

          <div className="grid md:grid-cols-2 gap-4">
            {/* Holiday Premium */}
            <div className="space-y-2">
              <Label>Recargo por festivo (%)</Label>
              <Input
                type="number"
                min={0}
                max={200}
                value={holidays.holiday_recargo_pct ?? 75}
                onChange={(e) => updateNestedPayload('holidays', { holiday_recargo_pct: Number(e.target.value) })}
              />
              <p className="text-xs text-muted-foreground">
                Típico: 75% en comercio/hostelería, 100% en sanidad
              </p>
            </div>

            {/* Substitute Rest */}
            <div className="space-y-2">
              <Label>Descanso sustitutivo (horas)</Label>
              <Input
                type="number"
                min={0}
                value={holidays.holiday_rest_substitute_hours ?? 8}
                onChange={(e) => updateNestedPayload('holidays', { holiday_rest_substitute_hours: Number(e.target.value) })}
              />
              <p className="text-xs text-muted-foreground">
                Horas de descanso compensatorio por jornada festiva trabajada
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Legal Note */}
      <Alert>
        <Info className="h-4 w-4" />
        <AlertDescription>
          <strong>Trabajador nocturno:</strong> Quien realice ≥3h en franja nocturna o ≥1/3 de su jornada anual 
          de noche. No puede realizar más de 8h de media en período de 15 días.
        </AlertDescription>
      </Alert>
    </div>
  );
}
