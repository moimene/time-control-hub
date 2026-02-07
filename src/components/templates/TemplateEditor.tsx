import { useState, useEffect } from 'react';
import { useTemplates } from '@/hooks/useTemplates';
import { 
  RuleSetWithVersions, 
  RuleVersion, 
  TemplatePayload, 
  ValidationResult,
  DEFAULT_TEMPLATE_PAYLOAD 
} from '@/types/templates';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Separator } from '@/components/ui/separator';
import { 
  Save, 
  CheckCircle2, 
  AlertTriangle, 
  XCircle, 
  Play, 
  Upload, 
  Clock,
  Scale,
  Coffee,
  Calendar
} from 'lucide-react';
import { toast } from 'sonner';

interface TemplateEditorProps {
  ruleSet: RuleSetWithVersions;
  onSimulate: () => void;
}

export function TemplateEditor({ ruleSet, onSimulate }: TemplateEditorProps) {
  const { updateVersionPayload, validateTemplate, publishTemplate } = useTemplates();
  
  // Get the latest version
  const latestVersion = [...(ruleSet.rule_versions ?? [])]
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())[0];

  const initialPayload =
    (latestVersion?.payload_json as unknown as TemplatePayload) ?? DEFAULT_TEMPLATE_PAYLOAD;
  
  const [payload, setPayload] = useState<TemplatePayload>(initialPayload);
  const [validation, setValidation] = useState<ValidationResult | null>(null);
  const [isValidating, setIsValidating] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);

  useEffect(() => {
    setPayload(initialPayload);
    setValidation(null);
    setHasChanges(false);
  }, [ruleSet.id, latestVersion?.id, initialPayload]);

  // If no version exists, show error state
  if (!latestVersion) {
    return (
      <div className="space-y-4">
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Error de configuración</AlertTitle>
          <AlertDescription>
            Esta plantilla no tiene una versión inicial. Esto puede deberse a un error durante la creación o a permisos
            insuficientes. Por favor, elimina esta plantilla y créala de nuevo, o contacta al administrador del sistema.
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  const updatePayload = (path: string, value: unknown) => {
    setPayload(prev => {
      const newPayload = JSON.parse(JSON.stringify(prev));
      const keys = path.split('.');
      let current = newPayload;
      for (let i = 0; i < keys.length - 1; i++) {
        if (!current[keys[i]]) current[keys[i]] = {};
        current = current[keys[i]];
      }
      current[keys[keys.length - 1]] = value;
      return newPayload;
    });
    setHasChanges(true);
    setValidation(null);
  };

  const handleValidate = async () => {
    setIsValidating(true);
    try {
      const result = await validateTemplate(payload);
      setValidation(result);
      if (result.valid) {
        toast.success('Validación exitosa');
      } else {
        toast.error(`${result.summary.blocking_errors} errores encontrados`);
      }
    } catch (error) {
      toast.error('Error al validar');
    } finally {
      setIsValidating(false);
    }
  };

  const handleSave = async () => {
    if (!latestVersion) return;
    setIsSaving(true);
    try {
      await updateVersionPayload.mutateAsync({
        version_id: latestVersion.id,
        payload,
      });
      setHasChanges(false);
    } finally {
      setIsSaving(false);
    }
  };

  const handlePublish = async () => {
    if (!latestVersion) return;
    
    // First validate
    const result = await validateTemplate(payload);
    if (!result.valid) {
      toast.error('Corrige los errores antes de publicar');
      setValidation(result);
      return;
    }

    // Save if there are changes
    if (hasChanges) {
      await handleSave();
    }

    // Publish
    await publishTemplate.mutateAsync({
      rule_version_id: latestVersion.id,
    });
  };

  const isReadOnly = ruleSet.is_template && ruleSet.company_id === null;
  const canPublish = ruleSet.status === 'draft' || ruleSet.status === 'validating';

  return (
    <div className="space-y-6">
      {/* Header Actions */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {latestVersion && (
            <Badge variant="outline">v{latestVersion.version}</Badge>
          )}
          {hasChanges && (
            <Badge variant="secondary">Sin guardar</Badge>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={handleValidate} disabled={isValidating}>
            <CheckCircle2 className="mr-2 h-4 w-4" />
            {isValidating ? 'Validando...' : 'Validar'}
          </Button>
          <Button variant="outline" onClick={onSimulate}>
            <Play className="mr-2 h-4 w-4" />
            Simular
          </Button>
          {!isReadOnly && (
            <>
              <Button variant="outline" onClick={handleSave} disabled={!hasChanges || isSaving}>
                <Save className="mr-2 h-4 w-4" />
                {isSaving ? 'Guardando...' : 'Guardar'}
              </Button>
              {canPublish && (
                <Button onClick={handlePublish} disabled={publishTemplate.isPending}>
                  <Upload className="mr-2 h-4 w-4" />
                  {publishTemplate.isPending ? 'Publicando...' : 'Publicar'}
                </Button>
              )}
            </>
          )}
        </div>
      </div>

      {/* Validation Results */}
      {validation && (
        <Alert variant={validation.valid ? 'default' : 'destructive'}>
          {validation.valid ? (
            <CheckCircle2 className="h-4 w-4" />
          ) : (
            <XCircle className="h-4 w-4" />
          )}
          <AlertTitle>
            {validation.valid 
              ? 'Validación correcta' 
              : `${validation.summary.blocking_errors} errores de validación`
            }
          </AlertTitle>
          <AlertDescription>
            {validation.errors.length > 0 && (
              <ul className="mt-2 space-y-1">
                {validation.errors.map((err, i) => (
                  <li key={i} className="text-sm">
                    <strong>{err.field}:</strong> {err.message}
                    {err.legal_reference && (
                      <span className="ml-1 text-muted-foreground">({err.legal_reference})</span>
                    )}
                  </li>
                ))}
              </ul>
            )}
            {validation.warnings.length > 0 && (
              <div className="mt-2">
                <span className="text-amber-600 font-medium">{validation.summary.warnings} advertencias:</span>
                <ul className="mt-1 space-y-1">
                  {validation.warnings.map((warn, i) => (
                    <li key={i} className="text-sm text-amber-600">
                      <strong>{warn.field}:</strong> {warn.message}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </AlertDescription>
        </Alert>
      )}

      {isReadOnly && (
        <Alert>
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Plantilla de solo lectura</AlertTitle>
          <AlertDescription>
            Esta es una plantilla global. Para modificarla, crea una copia para tu empresa.
          </AlertDescription>
        </Alert>
      )}

      {/* Editor Tabs */}
      <Tabs defaultValue="limits">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="limits" className="gap-2">
            <Scale className="h-4 w-4" />
            Límites
          </TabsTrigger>
          <TabsTrigger value="breaks" className="gap-2">
            <Coffee className="h-4 w-4" />
            Pausas
          </TabsTrigger>
          <TabsTrigger value="overtime" className="gap-2">
            <Clock className="h-4 w-4" />
            Horas Extra
          </TabsTrigger>
          <TabsTrigger value="leaves" className="gap-2">
            <Calendar className="h-4 w-4" />
            Permisos
          </TabsTrigger>
        </TabsList>

        {/* Limits Tab */}
        <TabsContent value="limits" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Límites de Jornada</CardTitle>
              <CardDescription>
                Configura los límites máximos y mínimos de la jornada laboral
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid gap-6 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="max_daily_hours">Máximo horas diarias</Label>
                  <Input
                    id="max_daily_hours"
                    type="number"
                    min={1}
                    max={12}
                    step={0.5}
                    value={payload.limits?.max_daily_hours || 9}
                    onChange={(e) => updatePayload('limits.max_daily_hours', parseFloat(e.target.value))}
                    disabled={isReadOnly}
                  />
                  <p className="text-xs text-muted-foreground">
                    Máximo legal: 9h (ampliable a 10h por convenio)
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="min_daily_rest">Descanso diario mínimo (horas)</Label>
                  <Input
                    id="min_daily_rest"
                    type="number"
                    min={12}
                    max={24}
                    step={0.5}
                    value={payload.limits?.min_daily_rest || 12}
                    onChange={(e) => updatePayload('limits.min_daily_rest', parseFloat(e.target.value))}
                    disabled={isReadOnly}
                  />
                  <p className="text-xs text-muted-foreground">
                    Mínimo legal: 12 horas entre jornadas
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="min_weekly_rest">Descanso semanal mínimo (horas)</Label>
                  <Input
                    id="min_weekly_rest"
                    type="number"
                    min={36}
                    max={72}
                    step={1}
                    value={payload.limits?.min_weekly_rest || 36}
                    onChange={(e) => updatePayload('limits.min_weekly_rest', parseFloat(e.target.value))}
                    disabled={isReadOnly}
                  />
                  <p className="text-xs text-muted-foreground">
                    Mínimo legal: 36 horas consecutivas (día y medio)
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="max_weekly_hours">Máximo horas semanales</Label>
                  <Input
                    id="max_weekly_hours"
                    type="number"
                    min={20}
                    max={48}
                    step={1}
                    value={payload.limits?.max_weekly_hours || 40}
                    onChange={(e) => updatePayload('limits.max_weekly_hours', parseFloat(e.target.value))}
                    disabled={isReadOnly}
                  />
                  <p className="text-xs text-muted-foreground">
                    Estándar: 40 horas semanales
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Breaks Tab */}
        <TabsContent value="breaks" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Pausas y Descansos</CardTitle>
              <CardDescription>
                Configura las pausas obligatorias durante la jornada
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid gap-6 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="required_after_hours">Pausa obligatoria después de (horas)</Label>
                  <Input
                    id="required_after_hours"
                    type="number"
                    min={4}
                    max={6}
                    step={0.5}
                    value={payload.breaks?.required_after_hours || 6}
                    onChange={(e) => updatePayload('breaks.required_after_hours', parseFloat(e.target.value))}
                    disabled={isReadOnly}
                  />
                  <p className="text-xs text-muted-foreground">
                    Obligatoria después de 6 horas de trabajo continuado
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="min_break_minutes">Duración mínima de pausa (minutos)</Label>
                  <Input
                    id="min_break_minutes"
                    type="number"
                    min={15}
                    max={60}
                    step={5}
                    value={payload.breaks?.min_break_minutes || 15}
                    onChange={(e) => updatePayload('breaks.min_break_minutes', parseInt(e.target.value))}
                    disabled={isReadOnly}
                  />
                  <p className="text-xs text-muted-foreground">
                    Mínimo legal: 15 minutos
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Overtime Tab */}
        <TabsContent value="overtime" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Horas Extra</CardTitle>
              <CardDescription>
                Configura los límites y umbrales de alerta para horas extra
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="max_overtime_yearly">Máximo horas extra anuales</Label>
                <Input
                  id="max_overtime_yearly"
                  type="number"
                  min={0}
                  max={80}
                  step={1}
                  value={payload.limits?.max_overtime_yearly || 80}
                  onChange={(e) => updatePayload('limits.max_overtime_yearly', parseInt(e.target.value))}
                  disabled={isReadOnly}
                />
                <p className="text-xs text-muted-foreground">
                  Máximo legal: 80 horas anuales
                </p>
              </div>

              <Separator />

              <div className="space-y-4">
                <Label>Umbrales de alerta</Label>
                <p className="text-sm text-muted-foreground">
                  Define cuándo generar alertas según el porcentaje del límite consumido
                </p>
                
                {(payload.overtime?.thresholds || []).map((threshold, index) => (
                  <div key={index} className="flex items-center gap-4">
                    <div className="flex-1">
                      <Input
                        type="number"
                        min={1}
                        max={100}
                        value={threshold.percent}
                        onChange={(e) => {
                          const newThresholds = [...(payload.overtime?.thresholds || [])];
                          newThresholds[index] = { ...threshold, percent: parseInt(e.target.value) };
                          updatePayload('overtime.thresholds', newThresholds);
                        }}
                        disabled={isReadOnly}
                      />
                    </div>
                    <span className="text-sm text-muted-foreground">% →</span>
                    <Badge 
                      variant={threshold.severity === 'critical' ? 'destructive' : 'secondary'}
                    >
                      {threshold.severity === 'critical' ? 'Crítico' : 'Advertencia'}
                    </Badge>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Leaves Tab */}
        <TabsContent value="leaves" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Catálogo de Permisos</CardTitle>
              <CardDescription>
                Permisos retribuidos según el Estatuto de los Trabajadores
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {(payload.leaves_catalog || []).map((leave, index) => (
                  <div key={index} className="flex items-center gap-4 p-3 rounded-lg border">
                    <div className="flex-1">
                      <p className="font-medium">{leave.label || leave.type}</p>
                      <p className="text-sm text-muted-foreground">
                        {leave.paid ? 'Retribuido' : 'No retribuido'}
                        {leave.proof_required && ' • Requiere justificante'}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Input
                        type="number"
                        min={1}
                        max={30}
                        value={leave.days}
                        onChange={(e) => {
                          const newLeaves = [...(payload.leaves_catalog || [])];
                          newLeaves[index] = { ...leave, days: parseInt(e.target.value) };
                          updatePayload('leaves_catalog', newLeaves);
                        }}
                        disabled={isReadOnly}
                        className="w-20"
                      />
                      <span className="text-sm text-muted-foreground">días</span>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
