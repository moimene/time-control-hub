import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { AppLayout } from '@/components/layout/AppLayout';
import { ITSSWizardStep } from '@/components/itss/ITSSWizardStep';
import { PackagePreview } from '@/components/itss/PackagePreview';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  FileText, 
  Calendar, 
  Shield, 
  Users, 
  Download, 
  CheckCircle2, 
  AlertTriangle,
  Loader2,
  FileSpreadsheet
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useCompany } from '@/hooks/useCompany';
import { toast } from 'sonner';

interface WizardState {
  step: number;
  // Step 1: Parameters
  periodStart: string;
  periodEnd: string;
  expedientNumber: string;
  requestDate: string;
  contactPerson: string;
  // Step 2: Components
  components: {
    daily_record: boolean;
    labor_calendar: boolean;
    policies: boolean;
    contract_summary: boolean;
  };
  // Step 3-6: Generated data
  previewData: any;
  packageId: string | null;
}

const initialState: WizardState = {
  step: 1,
  periodStart: '',
  periodEnd: '',
  expedientNumber: '',
  requestDate: '',
  contactPerson: '',
  components: {
    daily_record: true,
    labor_calendar: true,
    policies: true,
    contract_summary: false
  },
  previewData: null,
  packageId: null
};

export default function ITSSPackageGenerator() {
  const { company } = useCompany();
  const queryClient = useQueryClient();
  const [state, setState] = useState<WizardState>(initialState);

  // Fetch previous packages
  const { data: previousPackages } = useQuery({
    queryKey: ['itss-packages', company?.id],
    queryFn: async () => {
      if (!company?.id) return [];
      const { data, error } = await supabase
        .from('itss_packages')
        .select('*')
        .eq('company_id', company.id)
        .order('created_at', { ascending: false })
        .limit(10);
      if (error) throw error;
      return data;
    },
    enabled: !!company?.id
  });

  // Preview mutation (dry run)
  const previewMutation = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke('generate-itss-package', {
        body: {
          company_id: company?.id,
          period_start: state.periodStart,
          period_end: state.periodEnd,
          expedient_number: state.expedientNumber,
          request_date: state.requestDate,
          contact_person: state.contactPerson,
          components: state.components,
          dry_run: true
        }
      });
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      setState(prev => ({ ...prev, previewData: data, step: 4 }));
    },
    onError: (error: any) => {
      toast.error('Error al generar vista previa: ' + error.message);
    }
  });

  // Generate mutation (full generation)
  const generateMutation = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke('generate-itss-package', {
        body: {
          company_id: company?.id,
          period_start: state.periodStart,
          period_end: state.periodEnd,
          expedient_number: state.expedientNumber,
          request_date: state.requestDate,
          contact_person: state.contactPerson,
          components: state.components,
          dry_run: false
        }
      });
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      setState(prev => ({ 
        ...prev, 
        previewData: data, 
        packageId: data.package_id, 
        step: 6 
      }));
      queryClient.invalidateQueries({ queryKey: ['itss-packages'] });
      toast.success('Paquete ITSS generado correctamente');
    },
    onError: (error: any) => {
      toast.error('Error al generar paquete: ' + error.message);
    }
  });

  const handleNext = () => {
    if (state.step === 3) {
      previewMutation.mutate();
    } else if (state.step === 5) {
      generateMutation.mutate();
    } else {
      setState(prev => ({ ...prev, step: prev.step + 1 }));
    }
  };

  const handleBack = () => {
    setState(prev => ({ ...prev, step: Math.max(1, prev.step - 1) }));
  };

  const canProceedStep1 = !!(state.periodStart && state.periodEnd);
  const canProceedStep2 = Object.values(state.components).some(v => v);

  const downloadCSV = (content: string, filename: string) => {
    const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.click();
    URL.revokeObjectURL(url);
  };

  const downloadJSON = (content: any, filename: string) => {
    const blob = new Blob([JSON.stringify(content, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <AppLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Generador de Paquete ITSS</h1>
            <p className="text-muted-foreground">
              Genera documentación completa para requerimientos de la Inspección de Trabajo
            </p>
          </div>
        </div>

        <Tabs defaultValue="generate" className="space-y-4">
          <TabsList>
            <TabsTrigger value="generate">Generar Nuevo</TabsTrigger>
            <TabsTrigger value="history">Historial</TabsTrigger>
          </TabsList>

          <TabsContent value="generate">
            {/* Step 1: Parameters */}
            {state.step === 1 && (
              <ITSSWizardStep
                step={1}
                totalSteps={6}
                title="Parámetros del Requerimiento"
                description="Introduce los datos del requerimiento de la ITSS"
                onNext={handleNext}
                onBack={handleBack}
                canProceed={canProceedStep1}
              >
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="periodStart">Fecha inicio período *</Label>
                    <Input
                      id="periodStart"
                      type="date"
                      value={state.periodStart}
                      onChange={(e) => setState(prev => ({ ...prev, periodStart: e.target.value }))}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="periodEnd">Fecha fin período *</Label>
                    <Input
                      id="periodEnd"
                      type="date"
                      value={state.periodEnd}
                      onChange={(e) => setState(prev => ({ ...prev, periodEnd: e.target.value }))}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="expedient">Número de expediente ITSS</Label>
                    <Input
                      id="expedient"
                      placeholder="Ej: 28/00001/2026"
                      value={state.expedientNumber}
                      onChange={(e) => setState(prev => ({ ...prev, expedientNumber: e.target.value }))}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="requestDate">Fecha del requerimiento</Label>
                    <Input
                      id="requestDate"
                      type="date"
                      value={state.requestDate}
                      onChange={(e) => setState(prev => ({ ...prev, requestDate: e.target.value }))}
                    />
                  </div>
                  <div className="space-y-2 md:col-span-2">
                    <Label htmlFor="contact">Persona de contacto</Label>
                    <Input
                      id="contact"
                      placeholder="Nombre del responsable"
                      value={state.contactPerson}
                      onChange={(e) => setState(prev => ({ ...prev, contactPerson: e.target.value }))}
                    />
                  </div>
                </div>

                <Alert>
                  <AlertTriangle className="h-4 w-4" />
                  <AlertDescription>
                    El período máximo para registros de jornada es de 4 años según la normativa española.
                  </AlertDescription>
                </Alert>
              </ITSSWizardStep>
            )}

            {/* Step 2: Components */}
            {state.step === 2 && (
              <ITSSWizardStep
                step={2}
                totalSteps={6}
                title="Selección de Componentes"
                description="Selecciona qué documentos incluir en el paquete"
                onNext={handleNext}
                onBack={handleBack}
                canProceed={canProceedStep2}
              >
                <div className="grid gap-4 md:grid-cols-2">
                  <Card className={state.components.daily_record ? 'ring-2 ring-primary' : ''}>
                    <CardHeader className="pb-2">
                      <div className="flex items-center space-x-2">
                        <Checkbox
                          id="daily_record"
                          checked={state.components.daily_record}
                          onCheckedChange={(checked) => 
                            setState(prev => ({
                              ...prev,
                              components: { ...prev.components, daily_record: !!checked }
                            }))
                          }
                        />
                        <Label htmlFor="daily_record" className="flex items-center gap-2 cursor-pointer">
                          <FileSpreadsheet className="h-5 w-5 text-green-600" />
                          Registro Diario de Jornada
                        </Label>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <p className="text-sm text-muted-foreground">
                        CSV con todos los fichajes del período, incluye referencias QTSP
                      </p>
                      <Badge className="mt-2">Obligatorio</Badge>
                    </CardContent>
                  </Card>

                  <Card className={state.components.labor_calendar ? 'ring-2 ring-primary' : ''}>
                    <CardHeader className="pb-2">
                      <div className="flex items-center space-x-2">
                        <Checkbox
                          id="labor_calendar"
                          checked={state.components.labor_calendar}
                          onCheckedChange={(checked) => 
                            setState(prev => ({
                              ...prev,
                              components: { ...prev.components, labor_calendar: !!checked }
                            }))
                          }
                        />
                        <Label htmlFor="labor_calendar" className="flex items-center gap-2 cursor-pointer">
                          <Calendar className="h-5 w-5 text-blue-600" />
                          Calendario Laboral
                        </Label>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <p className="text-sm text-muted-foreground">
                        Festivos, turnos y jornada intensiva configurados
                      </p>
                    </CardContent>
                  </Card>

                  <Card className={state.components.policies ? 'ring-2 ring-primary' : ''}>
                    <CardHeader className="pb-2">
                      <div className="flex items-center space-x-2">
                        <Checkbox
                          id="policies"
                          checked={state.components.policies}
                          onCheckedChange={(checked) => 
                            setState(prev => ({
                              ...prev,
                              components: { ...prev.components, policies: !!checked }
                            }))
                          }
                        />
                        <Label htmlFor="policies" className="flex items-center gap-2 cursor-pointer">
                          <Shield className="h-5 w-5 text-purple-600" />
                          Políticas y Normativas
                        </Label>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <p className="text-sm text-muted-foreground">
                        Política de control horario, privacidad y procedimientos
                      </p>
                    </CardContent>
                  </Card>

                  <Card className={state.components.contract_summary ? 'ring-2 ring-primary' : ''}>
                    <CardHeader className="pb-2">
                      <div className="flex items-center space-x-2">
                        <Checkbox
                          id="contract_summary"
                          checked={state.components.contract_summary}
                          onCheckedChange={(checked) => 
                            setState(prev => ({
                              ...prev,
                              components: { ...prev.components, contract_summary: !!checked }
                            }))
                          }
                        />
                        <Label htmlFor="contract_summary" className="flex items-center gap-2 cursor-pointer">
                          <Users className="h-5 w-5 text-orange-600" />
                          Sumario de Empleados
                        </Label>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <p className="text-sm text-muted-foreground">
                        Lista de empleados activos con datos básicos
                      </p>
                    </CardContent>
                  </Card>
                </div>
              </ITSSWizardStep>
            )}

            {/* Step 3: Pre-checks */}
            {state.step === 3 && (
              <ITSSWizardStep
                step={3}
                totalSteps={6}
                title="Verificación de Datos"
                description="Comprobando integridad y completitud de los datos"
                onNext={handleNext}
                onBack={handleBack}
                isLoading={previewMutation.isPending}
                nextLabel="Generar Vista Previa"
              >
                <div className="space-y-4">
                  <Alert>
                    <FileText className="h-4 w-4" />
                    <AlertDescription>
                      Se realizarán las siguientes verificaciones antes de generar el paquete:
                    </AlertDescription>
                  </Alert>

                  <div className="grid gap-2">
                    <div className="flex items-center gap-2 p-3 rounded-lg bg-muted/50">
                      <CheckCircle2 className="h-4 w-4 text-green-600" />
                      <span className="text-sm">Cobertura del período seleccionado</span>
                    </div>
                    <div className="flex items-center gap-2 p-3 rounded-lg bg-muted/50">
                      <CheckCircle2 className="h-4 w-4 text-green-600" />
                      <span className="text-sm">Entradas sin salida (fichajes abiertos)</span>
                    </div>
                    <div className="flex items-center gap-2 p-3 rounded-lg bg-muted/50">
                      <CheckCircle2 className="h-4 w-4 text-green-600" />
                      <span className="text-sm">Correcciones pendientes de aprobar</span>
                    </div>
                    <div className="flex items-center gap-2 p-3 rounded-lg bg-muted/50">
                      <CheckCircle2 className="h-4 w-4 text-green-600" />
                      <span className="text-sm">Evidencias QTSP del período</span>
                    </div>
                    <div className="flex items-center gap-2 p-3 rounded-lg bg-muted/50">
                      <CheckCircle2 className="h-4 w-4 text-green-600" />
                      <span className="text-sm">Documentos legales publicados</span>
                    </div>
                  </div>
                </div>
              </ITSSWizardStep>
            )}

            {/* Step 4: Preview */}
            {state.step === 4 && state.previewData && (
              <ITSSWizardStep
                step={4}
                totalSteps={6}
                title="Vista Previa del Paquete"
                description="Revisa el contenido antes de generar"
                onNext={handleNext}
                onBack={handleBack}
                nextLabel="Continuar"
              >
                <PackagePreview
                  manifest={state.previewData.manifest}
                  preChecks={state.previewData.pre_checks || []}
                />
              </ITSSWizardStep>
            )}

            {/* Step 5: Review Manifest */}
            {state.step === 5 && state.previewData && (
              <ITSSWizardStep
                step={5}
                totalSteps={6}
                title="Revisión del Manifiesto"
                description="Confirma la generación del paquete"
                onNext={handleNext}
                onBack={handleBack}
                isLoading={generateMutation.isPending}
                nextLabel="Generar Paquete"
              >
                <div className="space-y-4">
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-lg">Manifiesto de Integridad</CardTitle>
                      <CardDescription>
                        Este manifiesto será sellado con QTSP
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <pre className="text-xs bg-muted p-4 rounded-lg overflow-auto max-h-80">
                        {JSON.stringify(state.previewData.manifest, null, 2)}
                      </pre>
                    </CardContent>
                  </Card>

                  <Alert>
                    <Shield className="h-4 w-4" />
                    <AlertDescription>
                      Al generar el paquete, se creará un registro inmutable con sellado QTSP
                      que garantiza la integridad de los datos exportados.
                    </AlertDescription>
                  </Alert>
                </div>
              </ITSSWizardStep>
            )}

            {/* Step 6: Complete */}
            {state.step === 6 && state.previewData && (
              <ITSSWizardStep
                step={6}
                totalSteps={6}
                title="Paquete Generado"
                description="El paquete ITSS se ha generado correctamente"
                onNext={() => setState(initialState)}
                onBack={handleBack}
                nextLabel="Nuevo Paquete"
                isComplete
              >
                <div className="space-y-4">
                  <Alert className="bg-green-50 border-green-200">
                    <CheckCircle2 className="h-4 w-4 text-green-600" />
                    <AlertDescription className="text-green-800">
                      Paquete generado y registrado con ID: {state.packageId}
                    </AlertDescription>
                  </Alert>

                  <Card>
                    <CardHeader>
                      <CardTitle className="text-lg">Descargar Archivos</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-2">
                      {state.previewData.deliverables?.map((d: any, i: number) => (
                        <Button
                          key={i}
                          variant="outline"
                          className="w-full justify-start"
                          onClick={() => {
                            if (d.type === 'csv') {
                              downloadCSV(d.content, d.name);
                            } else {
                              downloadJSON(d.content, d.name);
                            }
                          }}
                        >
                          <Download className="h-4 w-4 mr-2" />
                          {d.name}
                          {d.rows && <Badge className="ml-auto">{d.rows} registros</Badge>}
                        </Button>
                      ))}
                      
                      <Button
                        variant="outline"
                        className="w-full justify-start"
                        onClick={() => downloadJSON(state.previewData.manifest, 'manifest.json')}
                      >
                        <Download className="h-4 w-4 mr-2" />
                        manifest.json
                        <Badge className="ml-auto" variant="secondary">Manifiesto</Badge>
                      </Button>
                    </CardContent>
                  </Card>
                </div>
              </ITSSWizardStep>
            )}
          </TabsContent>

          <TabsContent value="history">
            <Card>
              <CardHeader>
                <CardTitle>Paquetes Generados</CardTitle>
                <CardDescription>
                  Historial de paquetes ITSS generados
                </CardDescription>
              </CardHeader>
              <CardContent>
                {!previousPackages || previousPackages.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-8">
                    No hay paquetes generados
                  </p>
                ) : (
                  <div className="space-y-3">
                    {previousPackages.map((pkg: any) => (
                      <div
                        key={pkg.id}
                        className="flex items-center justify-between p-3 rounded-lg border"
                      >
                        <div>
                          <p className="font-medium">
                            {pkg.period_start} - {pkg.period_end}
                          </p>
                          <p className="text-sm text-muted-foreground">
                            {pkg.expedient_number || 'Sin expediente'}
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge variant={pkg.status === 'generated' ? 'default' : 'secondary'}>
                            {pkg.status}
                          </Badge>
                          <span className="text-sm text-muted-foreground">
                            {new Date(pkg.created_at).toLocaleDateString('es-ES')}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  );
}
