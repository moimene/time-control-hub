import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useCompany } from '@/hooks/useCompany';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ScrollArea } from '@/components/ui/scroll-area';
import { toast } from 'sonner';
import { 
  Plus, FileText, Edit2, Trash2, Copy, 
  CheckCircle, MessageSquare, FileSignature, Loader2 
} from 'lucide-react';

interface MessageTemplate {
  id: string;
  name: string;
  description: string | null;
  subject_template: string;
  body_template: string;
  thread_type: string;
  default_priority: string;
  default_certification_level: string;
  is_active: boolean;
}

export function MessageTemplatesManager() {
  const { company } = useCompany();
  const queryClient = useQueryClient();
  const [showEditor, setShowEditor] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<MessageTemplate | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    subject_template: '',
    body_template: '',
    thread_type: 'informativo',
    default_priority: 'normal',
    default_certification_level: 'basic',
    is_active: true,
  });

  const { data: templates = [], isLoading } = useQuery({
    queryKey: ['message-templates-manager', company?.id],
    queryFn: async () => {
      if (!company?.id) return [];
      const { data, error } = await supabase
        .from('message_templates')
        .select('*')
        .eq('company_id', company.id)
        .order('name');
      if (error) throw error;
      return data as MessageTemplate[];
    },
    enabled: !!company?.id
  });

  const saveMutation = useMutation({
    mutationFn: async (data: typeof formData & { id?: string }) => {
      if (data.id) {
        const { error } = await supabase
          .from('message_templates')
          .update({
            name: data.name,
            description: data.description || null,
            subject_template: data.subject_template,
            body_template: data.body_template,
            thread_type: data.thread_type,
            default_priority: data.default_priority,
            default_certification_level: data.default_certification_level,
            is_active: data.is_active,
          })
          .eq('id', data.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('message_templates')
          .insert({
            company_id: company!.id,
            name: data.name,
            description: data.description || null,
            subject_template: data.subject_template,
            body_template: data.body_template,
            thread_type: data.thread_type,
            default_priority: data.default_priority,
            default_certification_level: data.default_certification_level,
            is_active: data.is_active,
          });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success(editingTemplate ? 'Plantilla actualizada' : 'Plantilla creada');
      setShowEditor(false);
      setEditingTemplate(null);
      resetForm();
      queryClient.invalidateQueries({ queryKey: ['message-templates-manager'] });
    },
    onError: () => {
      toast.error('Error al guardar la plantilla');
    }
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('message_templates')
        .delete()
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Plantilla eliminada');
      queryClient.invalidateQueries({ queryKey: ['message-templates-manager'] });
    },
    onError: () => {
      toast.error('Error al eliminar la plantilla');
    }
  });

  const resetForm = () => {
    setFormData({
      name: '',
      description: '',
      subject_template: '',
      body_template: '',
      thread_type: 'informativo',
      default_priority: 'normal',
      default_certification_level: 'basic',
      is_active: true,
    });
  };

  const handleEdit = (template: MessageTemplate) => {
    setEditingTemplate(template);
    setFormData({
      name: template.name,
      description: template.description || '',
      subject_template: template.subject_template,
      body_template: template.body_template,
      thread_type: template.thread_type,
      default_priority: template.default_priority,
      default_certification_level: template.default_certification_level,
      is_active: template.is_active,
    });
    setShowEditor(true);
  };

  const handleDuplicate = (template: MessageTemplate) => {
    setEditingTemplate(null);
    setFormData({
      name: `${template.name} (copia)`,
      description: template.description || '',
      subject_template: template.subject_template,
      body_template: template.body_template,
      thread_type: template.thread_type,
      default_priority: template.default_priority,
      default_certification_level: template.default_certification_level,
      is_active: true,
    });
    setShowEditor(true);
  };

  const handleSave = () => {
    if (!formData.name || !formData.subject_template || !formData.body_template) {
      toast.error('Nombre, asunto y cuerpo son obligatorios');
      return;
    }
    saveMutation.mutate({ ...formData, id: editingTemplate?.id });
  };

  const threadTypeLabels: Record<string, string> = {
    informativo: 'Informativo',
    convocatoria: 'Convocatoria',
    normativa: 'Normativa',
    formacion: 'Formación',
    urgente: 'Urgente',
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold">Plantillas de Mensaje</h2>
          <p className="text-sm text-muted-foreground">
            Define plantillas reutilizables para comunicaciones frecuentes
          </p>
        </div>
        <Button onClick={() => { resetForm(); setEditingTemplate(null); setShowEditor(true); }}>
          <Plus className="h-4 w-4 mr-2" />
          Nueva plantilla
        </Button>
      </div>

      {templates.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <FileText className="h-12 w-12 text-muted-foreground mb-4" />
            <p className="text-muted-foreground">No hay plantillas creadas</p>
            <Button variant="outline" className="mt-4" onClick={() => { resetForm(); setShowEditor(true); }}>
              Crear primera plantilla
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {templates.map((template) => (
            <Card key={template.id} className={!template.is_active ? 'opacity-60' : ''}>
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div>
                    <CardTitle className="text-base">{template.name}</CardTitle>
                    {template.description && (
                      <CardDescription className="mt-1">{template.description}</CardDescription>
                    )}
                  </div>
                  {!template.is_active && (
                    <Badge variant="secondary">Inactiva</Badge>
                  )}
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex flex-wrap gap-1.5">
                  <Badge variant="outline">{threadTypeLabels[template.thread_type] || template.thread_type}</Badge>
                  <Badge variant="secondary">{template.default_certification_level}</Badge>
                </div>

                <div className="text-xs text-muted-foreground bg-muted/50 p-2 rounded">
                  <strong>Asunto:</strong> {template.subject_template}
                </div>

                <Separator />

                <div className="flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">
                    Prioridad: {template.default_priority}
                  </span>
                  <div className="flex gap-1">
                    <Button variant="ghost" size="icon" onClick={() => handleDuplicate(template)}>
                      <Copy className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => handleEdit(template)}>
                      <Edit2 className="h-4 w-4" />
                    </Button>
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      className="text-destructive hover:text-destructive"
                      onClick={() => deleteMutation.mutate(template.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={showEditor} onOpenChange={setShowEditor}>
        <DialogContent className="max-w-2xl max-h-[90vh]">
          <DialogHeader>
            <DialogTitle>
              {editingTemplate ? 'Editar plantilla' : 'Nueva plantilla'}
            </DialogTitle>
            <DialogDescription>
              Define una plantilla reutilizable para comunicaciones
            </DialogDescription>
          </DialogHeader>

          <ScrollArea className="max-h-[60vh] pr-4">
            <div className="space-y-4 py-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Nombre *</Label>
                  <Input
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="Ej: Comunicado cambio normativa"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Tipo de mensaje</Label>
                  <Select
                    value={formData.thread_type}
                    onValueChange={(v) => setFormData({ ...formData, thread_type: v })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="informativo">Informativo</SelectItem>
                      <SelectItem value="convocatoria">Convocatoria</SelectItem>
                      <SelectItem value="normativa">Normativa</SelectItem>
                      <SelectItem value="formacion">Formación</SelectItem>
                      <SelectItem value="urgente">Urgente</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <Label>Descripción</Label>
                <Input
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Descripción breve de la plantilla"
                />
              </div>

              <Separator />

              <div className="space-y-2">
                <Label>Asunto del mensaje *</Label>
                <Input
                  value={formData.subject_template}
                  onChange={(e) => setFormData({ ...formData, subject_template: e.target.value })}
                  placeholder="Ej: Actualización de política de {{politica}}"
                />
                <p className="text-xs text-muted-foreground">
                  Usa {"{{variable}}"} para campos dinámicos
                </p>
              </div>

              <div className="space-y-2">
                <Label>Cuerpo del mensaje *</Label>
                <Textarea
                  value={formData.body_template}
                  onChange={(e) => setFormData({ ...formData, body_template: e.target.value })}
                  placeholder="Estimado/a empleado/a,&#10;&#10;Le comunicamos que..."
                  rows={6}
                />
              </div>

              <Separator />

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Prioridad por defecto</Label>
                  <Select
                    value={formData.default_priority}
                    onValueChange={(v) => setFormData({ ...formData, default_priority: v })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="baja">Baja</SelectItem>
                      <SelectItem value="normal">Normal</SelectItem>
                      <SelectItem value="alta">Alta</SelectItem>
                      <SelectItem value="urgente">Urgente</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Nivel de certificación</Label>
                  <Select
                    value={formData.default_certification_level}
                    onValueChange={(v) => setFormData({ ...formData, default_certification_level: v })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Sin certificación</SelectItem>
                      <SelectItem value="basic">Básico</SelectItem>
                      <SelectItem value="timestamped">Con sello temporal</SelectItem>
                      <SelectItem value="qualified">Cualificado QTSP</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="flex items-center justify-between pt-2">
                <div>
                  <Label>Plantilla activa</Label>
                  <p className="text-xs text-muted-foreground">Disponible para usar en nuevas comunicaciones</p>
                </div>
                <Switch
                  checked={formData.is_active}
                  onCheckedChange={(v) => setFormData({ ...formData, is_active: v })}
                />
              </div>
            </div>
          </ScrollArea>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowEditor(false)}>
              Cancelar
            </Button>
            <Button onClick={handleSave} disabled={saveMutation.isPending}>
              {saveMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Guardando...
                </>
              ) : (
                'Guardar plantilla'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
