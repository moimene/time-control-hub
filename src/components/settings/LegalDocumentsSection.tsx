import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useCompany } from "@/hooks/useCompany";
import { 
  LEGAL_DOCUMENT_TEMPLATES, 
  CATEGORY_LABELS, 
  PRIORITY_CONFIG,
  substituteVariables,
  type LegalDocumentTemplate 
} from "@/lib/legalDocumentTemplates";
import { 
  FileText, 
  CheckCircle2, 
  Users, 
  Eye, 
  Send,
  Shield,
  Loader2
} from "lucide-react";
import { sanitizeHtml } from "@/lib/security";

export function LegalDocumentsSection() {
  const { companyId, company } = useCompany();
  const queryClient = useQueryClient();
  const [selectedTemplate, setSelectedTemplate] = useState<LegalDocumentTemplate | null>(null);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [variableValues, setVariableValues] = useState<Record<string, string>>({});
  const [sendDialogOpen, setSendDialogOpen] = useState(false);

  const { data: publishedDocs, isLoading: docsLoading } = useQuery({
    queryKey: ['legal-documents', companyId],
    queryFn: async () => {
      if (!companyId) return [];
      const { data, error } = await supabase
        .from('legal_documents')
        .select('*')
        .eq('company_id', companyId)
        .order('code');
      if (error) throw error;
      return data || [];
    },
    enabled: !!companyId,
  });

  const { data: acknowledgmentCounts } = useQuery({
    queryKey: ['document-acknowledgments-count', companyId],
    queryFn: async () => {
      if (!companyId) return {};
      const { data, error } = await supabase
        .from('document_acknowledgments')
        .select('document_id')
        .eq('company_id', companyId);
      if (error) throw error;
      
      const counts: Record<string, number> = {};
      data?.forEach(ack => {
        counts[ack.document_id] = (counts[ack.document_id] || 0) + 1;
      });
      return counts;
    },
    enabled: !!companyId,
  });

  const { data: employeeCount } = useQuery({
    queryKey: ['employee-count', companyId],
    queryFn: async () => {
      if (!companyId) return 0;
      const { count, error } = await supabase
        .from('employees')
        .select('*', { count: 'exact', head: true })
        .eq('company_id', companyId)
        .eq('status', 'active');
      if (error) throw error;
      return count || 0;
    },
    enabled: !!companyId,
  });

  const { data: activeEmployees } = useQuery({
    queryKey: ['active-employees', companyId],
    queryFn: async () => {
      if (!companyId) return [];
      const { data, error } = await supabase
        .from('employees')
        .select('id, first_name, last_name, email')
        .eq('company_id', companyId)
        .eq('status', 'active');
      if (error) throw error;
      return data || [];
    },
    enabled: !!companyId,
  });

  const sendToEmployeesMutation = useMutation({
    mutationFn: async ({ template, values }: { template: LegalDocumentTemplate; values: Record<string, string> }) => {
      if (!companyId) throw new Error('No company');
      
      const content = substituteVariables(template.contentMarkdown, values);
      
      const { data: docData, error: docError } = await supabase
        .from('legal_documents')
        .upsert({
          company_id: companyId,
          template_id: null,
          code: template.code,
          name: template.name,
          content_markdown: content,
          variable_values: values,
          is_published: true,
          published_at: new Date().toISOString(),
          version: 1,
        }, {
          onConflict: 'company_id,code,version'
        })
        .select()
        .single();
      
      if (docError) throw docError;

      const notifications = activeEmployees?.map(emp => ({
        company_id: companyId,
        employee_id: emp.id,
        notification_type: 'legal_document',
        title: `Nuevo documento: ${template.name}`,
        message: `Se ha publicado un nuevo documento que requiere tu revisión: ${template.name}. Accede a "Normativa y Cumplimiento" en tu portal para verlo.`,
        related_entity_type: 'legal_document',
        related_entity_id: docData.id,
        action_url: '/employee/legal-documents',
      })) || [];

      if (notifications.length > 0) {
        const { error: notifError } = await supabase
          .from('employee_notifications')
          .insert(notifications);
        
        if (notifError) throw notifError;
      }

      return { document: docData, notificationsSent: notifications.length };
    },
    onSuccess: (data) => {
      toast.success(`Documento enviado a ${data.notificationsSent} empleados`);
      queryClient.invalidateQueries({ queryKey: ['legal-documents'] });
      setSendDialogOpen(false);
      setSelectedTemplate(null);
      setVariableValues({});
    },
    onError: (error) => {
      console.error('Send error:', error);
      toast.error('Error al enviar el documento');
    },
  });

  const getDefaultValues = (template: LegalDocumentTemplate): Record<string, string> => {
    const defaults: Record<string, string> = {
      EMPRESA_NOMBRE: company?.name || '',
      EMPRESA_CIF: company?.cif || '',
      EMPRESA_DIRECCION: company?.address || '',
      EMPRESA_CIUDAD: company?.city || '',
      EMPRESA_CP: company?.postal_code || '',
      FECHA_GENERACION: new Date().toLocaleDateString('es-ES'),
      PROVEEDOR_PLATAFORMA: 'Time Control Hub',
      QTSP_NOMBRE: 'DigitalTrust',
    };
    return defaults;
  };

  const openSendDialog = (template: LegalDocumentTemplate) => {
    setSelectedTemplate(template);
    setVariableValues(getDefaultValues(template));
    setSendDialogOpen(true);
  };

  const openPreview = (template: LegalDocumentTemplate) => {
    setSelectedTemplate(template);
    setVariableValues(getDefaultValues(template));
    setPreviewOpen(true);
  };

  const isPublished = (code: string) => {
    return publishedDocs?.some(doc => doc.code === code && doc.is_published);
  };

  const getPublishedDoc = (code: string) => {
    return publishedDocs?.find(doc => doc.code === code && doc.is_published);
  };

  const categories = Object.keys(CATEGORY_LABELS) as Array<LegalDocumentTemplate['category']>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold">Documentos Legales</h2>
          <p className="text-sm text-muted-foreground">
            Gestiona y envía los documentos de cumplimiento legal a tus empleados
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="gap-1">
            <FileText className="h-3 w-3" />
            {publishedDocs?.filter(d => d.is_published).length || 0} enviados
          </Badge>
          <Badge variant="outline" className="gap-1">
            <Users className="h-3 w-3" />
            {employeeCount} empleados
          </Badge>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Plantillas</CardTitle>
            <FileText className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{LEGAL_DOCUMENT_TEMPLATES.length}</div>
            <p className="text-xs text-muted-foreground">documentos disponibles</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Enviados</CardTitle>
            <CheckCircle2 className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{publishedDocs?.filter(d => d.is_published).length || 0}</div>
            <p className="text-xs text-muted-foreground">notificados a empleados</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Requieren Aceptación</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {LEGAL_DOCUMENT_TEMPLATES.filter(t => t.requiresEmployeeAcceptance).length}
            </div>
            <p className="text-xs text-muted-foreground">documentos</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Prioridad Alta</CardTitle>
            <Shield className="h-4 w-4 text-destructive" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {LEGAL_DOCUMENT_TEMPLATES.filter(t => t.priority === 'high').length}
            </div>
            <p className="text-xs text-muted-foreground">críticos</p>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="privacy" className="space-y-4">
        <TabsList className="flex-wrap h-auto gap-1">
          {categories.map(cat => (
            <TabsTrigger key={cat} value={cat} className="text-xs">
              {CATEGORY_LABELS[cat]}
            </TabsTrigger>
          ))}
        </TabsList>

        {categories.map(cat => (
          <TabsContent key={cat} value={cat} className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {LEGAL_DOCUMENT_TEMPLATES.filter(t => t.category === cat).map(template => {
                const published = isPublished(template.code);
                const doc = getPublishedDoc(template.code);
                const ackCount = doc ? (acknowledgmentCounts?.[doc.id] || 0) : 0;

                return (
                  <Card key={template.code} className={published ? 'border-green-200 bg-green-50/50' : ''}>
                    <CardHeader className="pb-2">
                      <div className="flex items-start justify-between">
                        <div className="space-y-1">
                          <Badge variant="outline" className="text-xs mb-1">
                            {template.code}
                          </Badge>
                          <CardTitle className="text-base">{template.name}</CardTitle>
                        </div>
                        <Badge className={PRIORITY_CONFIG[template.priority].className}>
                          {PRIORITY_CONFIG[template.priority].label}
                        </Badge>
                      </div>
                      <CardDescription className="text-xs">
                        {template.description}
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <div className="flex flex-wrap gap-1">
                        {template.requiresEmployeeAcceptance && (
                          <Badge variant="secondary" className="text-xs">
                            <Users className="h-3 w-3 mr-1" />
                            Requiere aceptación
                          </Badge>
                        )}
                        {published && (
                          <Badge variant="default" className="text-xs bg-green-600">
                            <CheckCircle2 className="h-3 w-3 mr-1" />
                            Enviado
                          </Badge>
                        )}
                      </div>

                      {published && template.requiresEmployeeAcceptance && (
                        <div className="text-xs text-muted-foreground">
                          {ackCount} de {employeeCount} empleados han aceptado
                        </div>
                      )}

                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => openPreview(template)}
                          className="flex-1"
                        >
                          <Eye className="h-3 w-3 mr-1" />
                          Vista previa
                        </Button>
                        {!published ? (
                          <Button
                            size="sm"
                            onClick={() => openSendDialog(template)}
                            className="flex-1"
                          >
                            <Send className="h-3 w-3 mr-1" />
                            Enviar a empleados
                          </Button>
                        ) : (
                          <Button
                            size="sm"
                            variant="secondary"
                            onClick={() => openSendDialog(template)}
                            className="flex-1"
                          >
                            <Send className="h-3 w-3 mr-1" />
                            Reenviar
                          </Button>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </TabsContent>
        ))}
      </Tabs>

      <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
        <DialogContent className="max-w-3xl max-h-[80vh]">
          <DialogHeader>
            <DialogTitle>{selectedTemplate?.name}</DialogTitle>
            <DialogDescription>
              Vista previa del documento con los datos de tu empresa
            </DialogDescription>
          </DialogHeader>
          <ScrollArea className="h-[60vh] pr-4">
            <div className="prose prose-sm max-w-none">
              <div 
                dangerouslySetInnerHTML={{ 
                    __html: sanitizeHtml(selectedTemplate
                    ? substituteVariables(selectedTemplate.contentMarkdown, variableValues)
                        .replace(/\n/g, '<br>')
                        .replace(/#{1,6}\s(.+)/g, '<strong>$1</strong>')
                        .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
                    : '')
                }} 
              />
            </div>
          </ScrollArea>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPreviewOpen(false)}>
              Cerrar
            </Button>
            {selectedTemplate && (
              <Button onClick={() => {
                setPreviewOpen(false);
                openSendDialog(selectedTemplate);
              }}>
                Configurar y Enviar
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={sendDialogOpen} onOpenChange={setSendDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[80vh]">
          <DialogHeader>
            <DialogTitle>Enviar a empleados: {selectedTemplate?.name}</DialogTitle>
            <DialogDescription>
              Configura los campos variables y envía el documento a todos los empleados activos ({activeEmployees?.length || 0} empleados)
            </DialogDescription>
          </DialogHeader>
          <ScrollArea className="h-[50vh] pr-4">
            <div className="space-y-4">
              {selectedTemplate?.variableFields.map(field => (
                <div key={field} className="space-y-2">
                  <Label htmlFor={field}>{field.replace(/_/g, ' ')}</Label>
                  <Input
                    id={field}
                    value={variableValues[field] || ''}
                    onChange={(e) => setVariableValues(prev => ({
                      ...prev,
                      [field]: e.target.value
                    }))}
                    placeholder={`Introduce ${field.toLowerCase().replace(/_/g, ' ')}`}
                  />
                </div>
              ))}
            </div>
          </ScrollArea>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSendDialogOpen(false)}>
              Cancelar
            </Button>
            <Button 
              onClick={() => {
                if (selectedTemplate) {
                  sendToEmployeesMutation.mutate({ template: selectedTemplate, values: variableValues });
                }
              }}
              disabled={sendToEmployeesMutation.isPending}
            >
              {sendToEmployeesMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Enviando...
                </>
              ) : (
                <>
                  <Send className="h-4 w-4 mr-2" />
                  Enviar a {activeEmployees?.length || 0} empleados
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
