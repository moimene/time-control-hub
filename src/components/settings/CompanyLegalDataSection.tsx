import { useState, useEffect } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useCompany } from '@/hooks/useCompany';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { FileText, Shield, Clock, Users, Building2, Check, AlertCircle } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';

// Interface for legal document configuration
export interface LegalDocumentData {
  // Data Protection
  dpd_email: string;
  privacy_contact: string;
  compliance_officer: string;
  // Clock-in Operations
  center_name: string;
  terminal_location: string;
  terminal_description: string;
  clock_modes: string;
  credential_loss_channel: string;
  // Document Management
  custody_responsible: string;
  paper_archive_location: string;
  transcription_hours: string;
  corrections_channel: string;
  correction_hours: string;
  export_formats: string;
  itss_contact: string;
  // HR & Absences
  absence_request_channel: string;
  absence_sla_hours: string;
  overlap_rule: string;
  hr_contact: string;
  support_channel: string;
  communications_channel: string;
}

const DEFAULT_VALUES: LegalDocumentData = {
  dpd_email: '',
  privacy_contact: 'Departamento de RRHH',
  compliance_officer: '',
  center_name: '',
  terminal_location: 'Entrada principal',
  terminal_description: 'Terminal táctil en modo kiosco',
  clock_modes: 'QR o PIN',
  credential_loss_channel: 'RRHH o supervisor directo',
  custody_responsible: '',
  paper_archive_location: 'Oficina central',
  transcription_hours: '24',
  corrections_channel: 'Portal del empleado',
  correction_hours: '48',
  export_formats: 'CSV, JSON, PDF',
  itss_contact: '',
  absence_request_channel: 'Portal del empleado',
  absence_sla_hours: '72',
  overlap_rule: 'Mínimo 2 empleados por turno',
  hr_contact: '',
  support_channel: '',
  communications_channel: 'Portal del empleado',
};

// Mapping from form fields to document template variables
export const FIELD_TO_VARIABLE_MAP: Record<keyof LegalDocumentData, string> = {
  dpd_email: 'EMAIL_CONTACTO_DPD',
  privacy_contact: 'CONTACTO_PRIVACIDAD',
  compliance_officer: 'RESPONSABLE_CUMPLIMIENTO',
  center_name: 'CENTRO_NOMBRE',
  terminal_location: 'UBICACION_TERMINAL',
  terminal_description: 'DESCRIPCION_TERMINAL',
  clock_modes: 'MODOS_FICHAJE',
  credential_loss_channel: 'CANAL_AVISO_PERDIDA',
  custody_responsible: 'RESPONSABLE_CUSTODIA',
  paper_archive_location: 'LUGAR_ARCHIVO_PARTES',
  transcription_hours: 'PLAZO_TRANSCRIPCION_HORAS',
  corrections_channel: 'CANAL_CORRECCIONES',
  correction_hours: 'PLAZO_CORRECCIONES_HORAS',
  export_formats: 'FORMATO_EXPORT',
  itss_contact: 'CONTACTO_ITSS',
  absence_request_channel: 'CANAL_SOLICITUD_AUSENCIAS',
  absence_sla_hours: 'SLA_APROBACION_AUSENCIAS',
  overlap_rule: 'REGLA_SOLAPAMIENTO',
  hr_contact: 'CONTACTO_RRHH',
  support_channel: 'CANAL_SOPORTE',
  communications_channel: 'CANAL_COMUNICACIONES',
};

export function CompanyLegalDataSection() {
  const { companyId, company } = useCompany();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [formData, setFormData] = useState<LegalDocumentData>(DEFAULT_VALUES);

  // Fetch existing settings
  const { data: existingSettings, isLoading } = useQuery({
    queryKey: ['company-legal-data', companyId],
    queryFn: async () => {
      if (!companyId) return null;
      const { data, error } = await supabase
        .from('company_settings')
        .select('setting_value')
        .eq('company_id', companyId)
        .eq('setting_key', 'legal_document_data')
        .maybeSingle();
      
      if (error) throw error;
      if (!data?.setting_value) return null;
      return data.setting_value as unknown as LegalDocumentData;
    },
    enabled: !!companyId,
  });

  // Initialize form with existing data
  useEffect(() => {
    if (existingSettings) {
      setFormData({ ...DEFAULT_VALUES, ...existingSettings });
    } else if (company) {
      // Pre-fill with company data if available
      setFormData(prev => ({
        ...prev,
        center_name: company.name || '',
        dpd_email: `dpd@${company.name?.toLowerCase().replace(/\s+/g, '')}.com` || '',
        hr_contact: `rrhh@${company.name?.toLowerCase().replace(/\s+/g, '')}.com` || '',
        support_channel: `soporte@${company.name?.toLowerCase().replace(/\s+/g, '')}.com` || '',
      }));
    }
  }, [existingSettings, company]);

  // Save mutation
  const saveMutation = useMutation({
    mutationFn: async (data: LegalDocumentData) => {
      if (!companyId) throw new Error('No hay empresa configurada');
      
      // Check if setting exists
      const { data: existing } = await supabase
        .from('company_settings')
        .select('id')
        .eq('company_id', companyId)
        .eq('setting_key', 'legal_document_data')
        .maybeSingle();

      // Cast to Json type compatible format
      const settingValue = JSON.parse(JSON.stringify(data));

      if (existing) {
        const { error } = await supabase
          .from('company_settings')
          .update({ setting_value: settingValue, updated_at: new Date().toISOString() })
          .eq('id', existing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('company_settings')
          .insert([{
            company_id: companyId,
            setting_key: 'legal_document_data',
            setting_value: settingValue,
          }]);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['company-legal-data', companyId] });
      toast({ title: 'Configuración guardada', description: 'Los datos se aplicarán automáticamente a todos los documentos legales.' });
    },
    onError: (error: any) => {
      toast({ variant: 'destructive', title: 'Error', description: error.message });
    },
  });

  const handleChange = (field: keyof LegalDocumentData, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    saveMutation.mutate(formData);
  };

  // Calculate completion percentage
  const filledFields = Object.values(formData).filter(v => v && v.trim() !== '').length;
  const totalFields = Object.keys(formData).length;
  const completionPct = Math.round((filledFields / totalFields) * 100);

  if (isLoading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-12">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            <CardTitle>Datos para Documentos Legales</CardTitle>
          </div>
          <div className="flex items-center gap-2 text-sm">
            {completionPct === 100 ? (
              <span className="flex items-center gap-1 text-green-600">
                <Check className="h-4 w-4" /> Completo
              </span>
            ) : (
              <span className="text-muted-foreground">{completionPct}% completado</span>
            )}
          </div>
        </div>
        <CardDescription>
          Configura estos datos una vez y se aplicarán automáticamente a todos los documentos legales
        </CardDescription>
      </CardHeader>
      <CardContent>
        {completionPct < 50 && (
          <Alert className="mb-6">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              Completa estos datos para generar documentos legales sin tener que introducirlos manualmente cada vez.
            </AlertDescription>
          </Alert>
        )}
        
        <form onSubmit={handleSubmit} className="space-y-6">
          <Accordion type="multiple" defaultValue={['data-protection', 'clock-operations']} className="w-full">
            {/* Data Protection Section */}
            <AccordionItem value="data-protection">
              <AccordionTrigger className="hover:no-underline">
                <div className="flex items-center gap-2">
                  <Shield className="h-4 w-4 text-primary" />
                  <span>Protección de Datos</span>
                </div>
              </AccordionTrigger>
              <AccordionContent className="space-y-4 pt-4">
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="dpd_email">Email del DPD *</Label>
                    <Input
                      id="dpd_email"
                      type="email"
                      value={formData.dpd_email}
                      onChange={(e) => handleChange('dpd_email', e.target.value)}
                      placeholder="dpd@empresa.com"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="privacy_contact">Contacto de Privacidad</Label>
                    <Input
                      id="privacy_contact"
                      value={formData.privacy_contact}
                      onChange={(e) => handleChange('privacy_contact', e.target.value)}
                      placeholder="Departamento de RRHH"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="compliance_officer">Responsable de Cumplimiento</Label>
                  <Input
                    id="compliance_officer"
                    value={formData.compliance_officer}
                    onChange={(e) => handleChange('compliance_officer', e.target.value)}
                    placeholder="Nombre del responsable"
                  />
                </div>
              </AccordionContent>
            </AccordionItem>

            {/* Clock-in Operations Section */}
            <AccordionItem value="clock-operations">
              <AccordionTrigger className="hover:no-underline">
                <div className="flex items-center gap-2">
                  <Clock className="h-4 w-4 text-primary" />
                  <span>Operativa de Fichaje</span>
                </div>
              </AccordionTrigger>
              <AccordionContent className="space-y-4 pt-4">
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="center_name">Nombre del Centro</Label>
                    <Input
                      id="center_name"
                      value={formData.center_name}
                      onChange={(e) => handleChange('center_name', e.target.value)}
                      placeholder="Oficina Central"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="terminal_location">Ubicación del Terminal</Label>
                    <Input
                      id="terminal_location"
                      value={formData.terminal_location}
                      onChange={(e) => handleChange('terminal_location', e.target.value)}
                      placeholder="Entrada principal"
                    />
                  </div>
                </div>
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="terminal_description">Descripción del Terminal (ITSS)</Label>
                    <Input
                      id="terminal_description"
                      value={formData.terminal_description}
                      onChange={(e) => handleChange('terminal_description', e.target.value)}
                      placeholder="Terminal táctil en modo kiosco"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="clock_modes">Modos de Fichaje</Label>
                    <Input
                      id="clock_modes"
                      value={formData.clock_modes}
                      onChange={(e) => handleChange('clock_modes', e.target.value)}
                      placeholder="QR o PIN"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="credential_loss_channel">Canal Aviso Pérdida Credenciales</Label>
                  <Input
                    id="credential_loss_channel"
                    value={formData.credential_loss_channel}
                    onChange={(e) => handleChange('credential_loss_channel', e.target.value)}
                    placeholder="RRHH o supervisor directo"
                  />
                </div>
              </AccordionContent>
            </AccordionItem>

            {/* Document Management Section */}
            <AccordionItem value="document-management">
              <AccordionTrigger className="hover:no-underline">
                <div className="flex items-center gap-2">
                  <Building2 className="h-4 w-4 text-primary" />
                  <span>Gestión Documental</span>
                </div>
              </AccordionTrigger>
              <AccordionContent className="space-y-4 pt-4">
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="custody_responsible">Responsable de Custodia</Label>
                    <Input
                      id="custody_responsible"
                      value={formData.custody_responsible}
                      onChange={(e) => handleChange('custody_responsible', e.target.value)}
                      placeholder="Nombre del responsable"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="paper_archive_location">Ubicación Archivo Físico</Label>
                    <Input
                      id="paper_archive_location"
                      value={formData.paper_archive_location}
                      onChange={(e) => handleChange('paper_archive_location', e.target.value)}
                      placeholder="Oficina central, Armario A"
                    />
                  </div>
                </div>
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="transcription_hours">Plazo Transcripción (horas)</Label>
                    <Input
                      id="transcription_hours"
                      type="number"
                      value={formData.transcription_hours}
                      onChange={(e) => handleChange('transcription_hours', e.target.value)}
                      placeholder="24"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="corrections_channel">Canal de Correcciones</Label>
                    <Input
                      id="corrections_channel"
                      value={formData.corrections_channel}
                      onChange={(e) => handleChange('corrections_channel', e.target.value)}
                      placeholder="Portal del empleado"
                    />
                  </div>
                </div>
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="correction_hours">Plazo Correcciones (horas)</Label>
                    <Input
                      id="correction_hours"
                      type="number"
                      value={formData.correction_hours}
                      onChange={(e) => handleChange('correction_hours', e.target.value)}
                      placeholder="48"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="export_formats">Formatos de Exportación</Label>
                    <Input
                      id="export_formats"
                      value={formData.export_formats}
                      onChange={(e) => handleChange('export_formats', e.target.value)}
                      placeholder="CSV, JSON, PDF"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="itss_contact">Contacto para ITSS</Label>
                  <Input
                    id="itss_contact"
                    value={formData.itss_contact}
                    onChange={(e) => handleChange('itss_contact', e.target.value)}
                    placeholder="Dirección de RRHH"
                  />
                </div>
              </AccordionContent>
            </AccordionItem>

            {/* HR & Absences Section */}
            <AccordionItem value="hr-absences">
              <AccordionTrigger className="hover:no-underline">
                <div className="flex items-center gap-2">
                  <Users className="h-4 w-4 text-primary" />
                  <span>RRHH y Ausencias</span>
                </div>
              </AccordionTrigger>
              <AccordionContent className="space-y-4 pt-4">
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="absence_request_channel">Canal Solicitud Ausencias</Label>
                    <Input
                      id="absence_request_channel"
                      value={formData.absence_request_channel}
                      onChange={(e) => handleChange('absence_request_channel', e.target.value)}
                      placeholder="Portal del empleado"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="absence_sla_hours">SLA Aprobación Ausencias (horas)</Label>
                    <Input
                      id="absence_sla_hours"
                      type="number"
                      value={formData.absence_sla_hours}
                      onChange={(e) => handleChange('absence_sla_hours', e.target.value)}
                      placeholder="72"
                    />
                  </div>
                </div>
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="overlap_rule">Regla de Solapamiento</Label>
                    <Input
                      id="overlap_rule"
                      value={formData.overlap_rule}
                      onChange={(e) => handleChange('overlap_rule', e.target.value)}
                      placeholder="Mínimo 2 empleados por turno"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="hr_contact">Contacto de RRHH</Label>
                    <Input
                      id="hr_contact"
                      type="email"
                      value={formData.hr_contact}
                      onChange={(e) => handleChange('hr_contact', e.target.value)}
                      placeholder="rrhh@empresa.com"
                    />
                  </div>
                </div>
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="support_channel">Canal de Soporte</Label>
                    <Input
                      id="support_channel"
                      value={formData.support_channel}
                      onChange={(e) => handleChange('support_channel', e.target.value)}
                      placeholder="soporte@empresa.com"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="communications_channel">Canal de Comunicaciones</Label>
                    <Input
                      id="communications_channel"
                      value={formData.communications_channel}
                      onChange={(e) => handleChange('communications_channel', e.target.value)}
                      placeholder="Portal del empleado"
                    />
                  </div>
                </div>
              </AccordionContent>
            </AccordionItem>
          </Accordion>

          <Button type="submit" disabled={saveMutation.isPending} className="w-full md:w-auto">
            {saveMutation.isPending ? 'Guardando...' : 'Guardar configuración'}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
