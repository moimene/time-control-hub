import { useState } from 'react';
import { SEED_TEMPLATES, SECTOR_LABELS, TemplatePayload } from '@/types/templates';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Building2, AlertTriangle, FileCheck, Copy, ArrowRight } from 'lucide-react';

interface SeedTemplateSelectorProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelect: (payload: TemplatePayload, name: string, sector: string, convenio: string) => void;
}

export function SeedTemplateSelector({ open, onOpenChange, onSelect }: SeedTemplateSelectorProps) {
  const [selectedTemplate, setSelectedTemplate] = useState<typeof SEED_TEMPLATES[0] | null>(null);
  const [step, setStep] = useState<'select' | 'confirm'>('select');

  const handleSelectTemplate = (template: typeof SEED_TEMPLATES[0]) => {
    setSelectedTemplate(template);
    setStep('confirm');
  };

  const handleConfirm = () => {
    if (selectedTemplate) {
      onSelect(
        selectedTemplate.payload,
        selectedTemplate.name,
        selectedTemplate.sector,
        selectedTemplate.convenio
      );
      handleClose();
    }
  };

  const handleClose = () => {
    setSelectedTemplate(null);
    setStep('select');
    onOpenChange(false);
  };

  const handleBack = () => {
    setStep('select');
    setSelectedTemplate(null);
  };

  // Group templates by category
  const groupedTemplates = {
    hosteleria: SEED_TEMPLATES.filter(t => t.sector === 'hosteleria'),
    comercio: SEED_TEMPLATES.filter(t => t.sector === 'comercio' || t.sector === 'comercio_alimentacion'),
    servicios: SEED_TEMPLATES.filter(t => ['servicios_profesionales', 'consultoria', 'limpieza'].includes(t.sector)),
    salud: SEED_TEMPLATES.filter(t => ['salud', 'veterinaria'].includes(t.sector)),
    industria: SEED_TEMPLATES.filter(t => ['metal', 'construccion'].includes(t.sector)),
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh]">
        {step === 'select' ? (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Building2 className="h-5 w-5" />
                Plantillas Preconfiguradas por Sector
              </DialogTitle>
              <DialogDescription>
                Selecciona una plantilla base según tu sector. Estas plantillas contienen configuraciones típicas 
                basadas en convenios colectivos de referencia y deberán ser verificadas para tu convenio específico.
              </DialogDescription>
            </DialogHeader>

            <Alert variant="default" className="border-amber-500/50 bg-amber-500/10">
              <AlertTriangle className="h-4 w-4 text-amber-600" />
              <AlertTitle className="text-amber-600">Importante</AlertTitle>
              <AlertDescription className="text-amber-600/90">
                Las cifras marcadas como "seed" reflejan prácticas habituales y deben ajustarse al convenio 
                aplicable del territorio de la empresa antes de activar la versión operativa.
              </AlertDescription>
            </Alert>

            <ScrollArea className="h-[50vh] pr-4">
              <div className="space-y-6">
                {/* Hostelería y Turismo */}
                <div className="space-y-3">
                  <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
                    Hostelería y Turismo
                  </h3>
                  <div className="grid gap-3">
                    {groupedTemplates.hosteleria.map((template) => (
                      <TemplateCard
                        key={template.sector}
                        template={template}
                        onSelect={() => handleSelectTemplate(template)}
                      />
                    ))}
                  </div>
                </div>

                {/* Comercio */}
                <div className="space-y-3">
                  <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
                    Comercio
                  </h3>
                  <div className="grid gap-3">
                    {groupedTemplates.comercio.map((template) => (
                      <TemplateCard
                        key={template.sector}
                        template={template}
                        onSelect={() => handleSelectTemplate(template)}
                      />
                    ))}
                  </div>
                </div>

                {/* Servicios */}
                <div className="space-y-3">
                  <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
                    Servicios Profesionales
                  </h3>
                  <div className="grid gap-3">
                    {groupedTemplates.servicios.map((template) => (
                      <TemplateCard
                        key={template.sector}
                        template={template}
                        onSelect={() => handleSelectTemplate(template)}
                      />
                    ))}
                  </div>
                </div>

                {/* Salud */}
                <div className="space-y-3">
                  <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
                    Sanidad
                  </h3>
                  <div className="grid gap-3">
                    {groupedTemplates.salud.map((template) => (
                      <TemplateCard
                        key={template.sector}
                        template={template}
                        onSelect={() => handleSelectTemplate(template)}
                      />
                    ))}
                  </div>
                </div>

                {/* Industria */}
                <div className="space-y-3">
                  <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
                    Industria y Construcción
                  </h3>
                  <div className="grid gap-3">
                    {groupedTemplates.industria.map((template) => (
                      <TemplateCard
                        key={template.sector}
                        template={template}
                        onSelect={() => handleSelectTemplate(template)}
                      />
                    ))}
                  </div>
                </div>
              </div>
            </ScrollArea>

            <DialogFooter>
              <Button variant="outline" onClick={handleClose}>
                Cancelar
              </Button>
            </DialogFooter>
          </>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <FileCheck className="h-5 w-5" />
                Confirmar Plantilla: {selectedTemplate?.name}
              </DialogTitle>
              <DialogDescription>
                Revisa los parámetros de la plantilla antes de crearla
              </DialogDescription>
            </DialogHeader>

            <Alert variant="destructive" className="border-destructive/50">
              <AlertTriangle className="h-4 w-4" />
              <AlertTitle>Verificación Obligatoria</AlertTitle>
              <AlertDescription>
                Esta plantilla seed debe ser verificada y adaptada a tu convenio colectivo aplicable 
                (provincial, autonómico o de empresa) antes de publicarla. Los parámetros son valores 
                de referencia que pueden no coincidir con tu situación específica.
              </AlertDescription>
            </Alert>

            {selectedTemplate && (
              <ScrollArea className="h-[40vh] pr-4">
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <InfoCard title="Sector" value={SECTOR_LABELS[selectedTemplate.sector] || selectedTemplate.sector} />
                    <InfoCard title="Convenio Referencia" value={selectedTemplate.convenio} />
                  </div>

                  <div className="space-y-2">
                    <h4 className="font-medium">Parámetros Principales</h4>
                    <div className="grid grid-cols-2 gap-2 text-sm">
                      <div className="flex justify-between p-2 rounded bg-muted">
                        <span className="text-muted-foreground">Jornada anual</span>
                        <span className="font-medium">{selectedTemplate.payload.working_time?.hours_per_year || '-'}h</span>
                      </div>
                      <div className="flex justify-between p-2 rounded bg-muted">
                        <span className="text-muted-foreground">Máx. diario</span>
                        <span className="font-medium">{selectedTemplate.payload.working_time?.max_daily_hours || '-'}h</span>
                      </div>
                      <div className="flex justify-between p-2 rounded bg-muted">
                        <span className="text-muted-foreground">Máx. semanal</span>
                        <span className="font-medium">{selectedTemplate.payload.working_time?.max_weekly_hours || '-'}h</span>
                      </div>
                      <div className="flex justify-between p-2 rounded bg-muted">
                        <span className="text-muted-foreground">Descanso diario mín.</span>
                        <span className="font-medium">{selectedTemplate.payload.working_time?.rest_daily_hours_min || '-'}h</span>
                      </div>
                      <div className="flex justify-between p-2 rounded bg-muted">
                        <span className="text-muted-foreground">Descanso semanal mín.</span>
                        <span className="font-medium">{selectedTemplate.payload.working_time?.rest_weekly_hours_min || '-'}h</span>
                      </div>
                      <div className="flex justify-between p-2 rounded bg-muted">
                        <span className="text-muted-foreground">Horas extra anuales</span>
                        <span className="font-medium">{selectedTemplate.payload.overtime?.overtime_yearly_cap || '-'}h</span>
                      </div>
                      <div className="flex justify-between p-2 rounded bg-muted">
                        <span className="text-muted-foreground">Vacaciones</span>
                        <span className="font-medium">{selectedTemplate.payload.vacations?.vacation_days_year || '-'} días</span>
                      </div>
                      <div className="flex justify-between p-2 rounded bg-muted">
                        <span className="text-muted-foreground">Pausa obligatoria</span>
                        <span className="font-medium">
                          {selectedTemplate.payload.breaks?.break_duration_minutes_min || '-'} min 
                          {selectedTemplate.payload.breaks?.break_counts_as_work ? ' (computable)' : ''}
                        </span>
                      </div>
                    </div>
                  </div>

                  {selectedTemplate.payload.shifts?.shift_templates && selectedTemplate.payload.shifts.shift_templates.length > 0 && (
                    <div className="space-y-2">
                      <h4 className="font-medium">Turnos Predefinidos</h4>
                      <div className="flex flex-wrap gap-2">
                        {selectedTemplate.payload.shifts.shift_templates.map((shift, idx) => (
                          <Badge key={idx} variant="outline">
                            {shift.name}: {shift.start} - {shift.end}
                            {shift.start2 && ` / ${shift.start2} - ${shift.end2}`}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </ScrollArea>
            )}

            <DialogFooter className="gap-2">
              <Button variant="outline" onClick={handleBack}>
                Volver
              </Button>
              <Button onClick={handleConfirm} className="gap-2">
                <Copy className="h-4 w-4" />
                Crear plantilla desde seed
                <ArrowRight className="h-4 w-4" />
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

function TemplateCard({ 
  template, 
  onSelect 
}: { 
  template: typeof SEED_TEMPLATES[0]; 
  onSelect: () => void;
}) {
  return (
    <Card 
      className="cursor-pointer transition-all hover:shadow-md hover:border-primary/50"
      onClick={onSelect}
    >
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between">
          <CardTitle className="text-base">{template.name}</CardTitle>
          <Badge variant="secondary">{SECTOR_LABELS[template.sector] || template.sector}</Badge>
        </div>
        <CardDescription className="text-xs">
          {template.convenio}
        </CardDescription>
      </CardHeader>
      <CardContent className="pt-0">
        <p className="text-sm text-muted-foreground line-clamp-2">
          {template.description}
        </p>
        <div className="mt-2 flex flex-wrap gap-1">
          <Badge variant="outline" className="text-xs">
            {template.payload.working_time?.hours_per_year || '-'}h/año
          </Badge>
          <Badge variant="outline" className="text-xs">
            Máx {template.payload.working_time?.max_daily_hours || '-'}h/día
          </Badge>
          {template.payload.night_work && (
            <Badge variant="outline" className="text-xs">Nocturnidad</Badge>
          )}
          {template.payload.remote_work?.remote_allowed && (
            <Badge variant="outline" className="text-xs">Teletrabajo</Badge>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function InfoCard({ title, value }: { title: string; value: string }) {
  return (
    <div className="p-3 rounded-lg border bg-muted/50">
      <p className="text-xs text-muted-foreground">{title}</p>
      <p className="font-medium">{value}</p>
    </div>
  );
}