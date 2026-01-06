import { useWizard } from '../WizardContext';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Slider } from '@/components/ui/slider';
import { Clock, AlertTriangle, Info, Ban } from 'lucide-react';
import { SECTOR_LABELS } from '@/types/templates';

const SECTOR_PARTTIME_REFERENCE = {
  hosteleria: { complementary_max: 30, notice_hours: 3 },
  comercio: { complementary_max: 40, notice_hours: 3 },
  comercio_alimentacion: { complementary_max: 40, notice_hours: 3 },
  servicios_profesionales: { complementary_max: 30, notice_hours: 3 },
};

export function StepPartTime() {
  const { state, updateNestedPayload } = useWizard();
  const partTime = state.payload.part_time || {};
  const sector = state.selectedSeedSector || '';
  const reference = SECTOR_PARTTIME_REFERENCE[sector as keyof typeof SECTOR_PARTTIME_REFERENCE];

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold mb-2">Paso 6: Tiempo Parcial y Horas Complementarias</h3>
        <p className="text-muted-foreground text-sm">
          Configure el régimen aplicable a trabajadores a tiempo parcial.
        </p>
      </div>

      {/* Reference */}
      {reference && (
        <Alert className="bg-muted">
          <Info className="h-4 w-4" />
          <AlertDescription>
            <strong>Referencia {SECTOR_LABELS[sector] || sector}:</strong> Horas complementarias hasta {reference.complementary_max}% 
            con preaviso mínimo de {reference.notice_hours} días.
          </AlertDescription>
        </Alert>
      )}

      {/* Important Legal Note */}
      <Alert variant="destructive" className="bg-amber-50 border-amber-300 dark:bg-amber-950 dark:border-amber-700">
        <AlertTriangle className="h-4 w-4 text-amber-600" />
        <AlertDescription className="text-amber-800 dark:text-amber-200">
          <strong>Régimen legal tiempo parcial:</strong> Los trabajadores a tiempo parcial <u>no pueden realizar 
          horas extraordinarias</u> (salvo fuerza mayor). Solo pueden realizar horas complementarias pactadas.
        </AlertDescription>
      </Alert>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Ban className="h-4 w-4" />
            Horas extraordinarias
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-start space-x-4 p-4 border rounded-lg bg-muted/50">
            <Switch
              checked={partTime.part_time_extras_allowed || false}
              onCheckedChange={(checked) => updateNestedPayload('part_time', { part_time_extras_allowed: checked })}
            />
            <div className="space-y-1">
              <Label className="font-medium">Permitir horas extra a tiempo parcial</Label>
              <p className="text-sm text-muted-foreground">
                <strong>No recomendado.</strong> Solo activar si existe justificación legal específica (fuerza mayor). 
                La regla general es que los trabajadores a tiempo parcial no pueden realizar horas extra.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Clock className="h-4 w-4" />
            Horas complementarias
          </CardTitle>
          <CardDescription>
            Horas adicionales pactadas por escrito que el trabajador a tiempo parcial se compromete a realizar.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Enable Complementary */}
          <div className="flex items-start space-x-4 p-4 border rounded-lg">
            <Switch
              checked={partTime.complementary_hours_allowed ?? true}
              onCheckedChange={(checked) => updateNestedPayload('part_time', { complementary_hours_allowed: checked })}
            />
            <div className="space-y-1">
              <Label className="font-medium">Permitir horas complementarias pactadas</Label>
              <p className="text-sm text-muted-foreground">
                Requiere pacto escrito específico. El trabajador puede renunciar al pacto con 15 días de preaviso.
              </p>
            </div>
          </div>

          {partTime.complementary_hours_allowed !== false && (
            <>
              {/* Max Percentage */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <Label>Porcentaje máximo de horas complementarias</Label>
                  <Badge variant="outline" className="font-mono">
                    {partTime.complementary_hours_max_pct ?? 30}%
                  </Badge>
                </div>
                <Slider
                  value={[partTime.complementary_hours_max_pct ?? 30]}
                  onValueChange={([value]) => updateNestedPayload('part_time', { complementary_hours_max_pct: value })}
                  min={15}
                  max={60}
                  step={5}
                />
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>15% (mínimo legal pactado)</span>
                  <span>30% (estatuto)</span>
                  <span>60% (máx. convenio)</span>
                </div>
                <p className="text-xs text-muted-foreground">
                  Base: 30% de jornada ordinaria pactada. Convenio colectivo puede ampliar hasta 60%.
                  Horas voluntarias: hasta 15% adicional.
                </p>
              </div>

              {/* Notice Period */}
              <div className="space-y-2">
                <Label>Preaviso mínimo (días)</Label>
                <Input
                  type="number"
                  min={1}
                  value={partTime.complementary_hours_notice_hours ? Math.ceil(partTime.complementary_hours_notice_hours / 24) : 3}
                  onChange={(e) => updateNestedPayload('part_time', { 
                    complementary_hours_notice_hours: Number(e.target.value) * 24 
                  })}
                />
                <p className="text-xs text-muted-foreground">
                  Estatuto: mínimo 3 días de antelación. Convenio puede reducirlo respetando razón de la reducción.
                </p>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Example Calculation */}
      <Alert>
        <Info className="h-4 w-4" />
        <AlertDescription>
          <strong>Ejemplo:</strong> Trabajador con contrato de 20h/semana y complementarias pactadas al 30%:
          <br />
          Máximo complementarias = 20h × 30% = <strong>6h/semana adicionales</strong> = 26h/semana total máximo.
        </AlertDescription>
      </Alert>
    </div>
  );
}
