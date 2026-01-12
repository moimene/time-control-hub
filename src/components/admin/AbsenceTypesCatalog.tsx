import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useCompany } from '@/hooks/useCompany';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { useToast } from '@/hooks/use-toast';
import { 
  Plus, 
  Pencil, 
  Trash2, 
  Loader2,
  Settings2,
  Clock,
  Calendar,
  FileText,
  Shield,
  AlertTriangle
} from 'lucide-react';

interface AbsenceType {
  id: string;
  code: string;
  name: string;
  description: string | null;
  absence_category: string;
  category: string;
  color: string;
  is_paid: boolean;
  requires_justification: boolean;
  requires_approval: boolean;
  compute_on: string;
  duration_value: number | null;
  duration_unit: string;
  extra_travel_days: number;
  travel_threshold_km: number;
  max_days_per_year: number | null;
  cap_per_year_value: number | null;
  cap_per_year_unit: string;
  advance_notice_days: number;
  counts_as_work: boolean;
  blocks_clocking: boolean;
  approval_flow: string;
  sla_hours: number;
  legal_origin: string;
  half_day_allowed: boolean;
  is_active: boolean;
  notes: string | null;
  convenio_reference: string | null;
}

const categoryLabels: Record<string, string> = {
  permiso_retribuido: 'Permisos Retribuidos',
  permiso_no_retribuido: 'Permisos No Retribuidos',
  vacaciones: 'Vacaciones',
  suspension: 'Suspensiones (IT, Maternidad...)',
  ajuste_jornada: 'Ajustes de Jornada',
  representacion: 'Representación Sindical',
  fuerza_mayor: 'Fuerza Mayor',
  otros: 'Otros'
};

const computeOnLabels: Record<string, string> = {
  dias_naturales: 'Días naturales',
  dias_laborables: 'Días laborables',
  horas: 'Horas'
};

const legalOriginLabels: Record<string, string> = {
  ley: 'Estatuto de los Trabajadores',
  convenio: 'Convenio Colectivo',
  empresa: 'Política de Empresa'
};

const approvalFlowLabels: Record<string, string> = {
  auto: 'Auto-aprobación',
  manager: 'Responsable',
  admin: 'Administrador',
  multi_level: 'Multi-nivel'
};

export function AbsenceTypesCatalog() {
  const { company, isLoading: companyLoading } = useCompany();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingType, setEditingType] = useState<AbsenceType | null>(null);
  const [formData, setFormData] = useState<Partial<AbsenceType>>({});

  // Fetch types
  const { data: types, isLoading } = useQuery({
    queryKey: ['absence-types-admin', company?.id],
    queryFn: async () => {
      if (!company?.id) return [];
      const { data, error } = await supabase
        .from('absence_types')
        .select('*')
        .eq('company_id', company.id)
        .order('absence_category', { ascending: true })
        .order('name', { ascending: true });
      if (error) throw error;
      return (data || []) as AbsenceType[];
    },
    enabled: !!company?.id,
  });

  // Create/Update mutation
  const saveMutation = useMutation({
    mutationFn: async (data: Partial<AbsenceType>) => {
      if (editingType) {
        const { error } = await supabase
          .from('absence_types')
          .update({ ...data, updated_at: new Date().toISOString() })
          .eq('id', editingType.id);
        if (error) throw error;
      } else {
        if (!data.code || !data.name) {
          throw new Error('Code and name are required');
        }
        const { error } = await supabase
          .from('absence_types')
          .insert({
            code: data.code,
            name: data.name,
            description: data.description || null,
            absence_category: data.absence_category || 'permiso_retribuido',
            category: data.category || 'leave',
            color: data.color || '#3B82F6',
            is_paid: data.is_paid ?? true,
            requires_justification: data.requires_justification ?? false,
            requires_approval: data.requires_approval ?? true,
            compute_on: data.compute_on || 'dias_laborables',
            duration_value: data.duration_value || null,
            duration_unit: data.duration_unit || 'days',
            extra_travel_days: data.extra_travel_days || 0,
            travel_threshold_km: data.travel_threshold_km || 200,
            max_days_per_year: data.max_days_per_year || null,
            advance_notice_days: data.advance_notice_days || 0,
            counts_as_work: data.counts_as_work ?? false,
            blocks_clocking: data.blocks_clocking ?? false,
            approval_flow: data.approval_flow || 'manager',
            sla_hours: data.sla_hours || 48,
            legal_origin: data.legal_origin || 'empresa',
            half_day_allowed: data.half_day_allowed ?? false,
            is_active: data.is_active ?? true,
            notes: data.notes || null,
            company_id: company?.id
          });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast({ title: editingType ? 'Tipo actualizado' : 'Tipo creado' });
      queryClient.invalidateQueries({ queryKey: ['absence-types-admin'] });
      queryClient.invalidateQueries({ queryKey: ['absence-stats'] });
      setIsDialogOpen(false);
      setEditingType(null);
      setFormData({});
    },
    onError: (error: Error) => {
      toast({ variant: 'destructive', title: 'Error', description: error.message });
    }
  });

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('absence_types')
        .delete()
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: 'Tipo eliminado' });
      queryClient.invalidateQueries({ queryKey: ['absence-types-admin'] });
      queryClient.invalidateQueries({ queryKey: ['absence-stats'] });
    },
    onError: (error: Error) => {
      toast({ variant: 'destructive', title: 'Error', description: error.message });
    }
  });

  // Seed default types mutation
  const seedMutation = useMutation({
    mutationFn: async () => {
      if (!company?.id) throw new Error('No hay empresa seleccionada');
      const { error } = await supabase.rpc('seed_default_absence_types', {
        p_company_id: company.id
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: 'Catálogo inicializado', description: '22 tipos de ausencia creados según normativa española' });
      queryClient.invalidateQueries({ queryKey: ['absence-types-admin'] });
      queryClient.invalidateQueries({ queryKey: ['absence-stats'] });
    },
    onError: (error: Error) => {
      toast({ variant: 'destructive', title: 'Error al inicializar', description: error.message });
    }
  });

  const openCreateDialog = () => {
    setEditingType(null);
    setFormData({
      code: '',
      name: '',
      description: '',
      absence_category: 'permiso_retribuido',
      category: 'leave',
      color: '#3B82F6',
      is_paid: true,
      requires_justification: false,
      requires_approval: true,
      compute_on: 'dias_laborables',
      duration_value: null,
      duration_unit: 'days',
      extra_travel_days: 0,
      travel_threshold_km: 200,
      max_days_per_year: null,
      advance_notice_days: 3,
      counts_as_work: false,
      blocks_clocking: false,
      approval_flow: 'manager',
      sla_hours: 48,
      legal_origin: 'empresa',
      half_day_allowed: false,
      is_active: true
    });
    setIsDialogOpen(true);
  };

  const openEditDialog = (type: AbsenceType) => {
    setEditingType(type);
    setFormData(type);
    setIsDialogOpen(true);
  };

  const handleSave = () => {
    if (!formData.code || !formData.name) {
      toast({ variant: 'destructive', title: 'Completa los campos obligatorios' });
      return;
    }
    saveMutation.mutate(formData);
  };

  // Group types by category
  const groupedTypes = types?.reduce((acc, type) => {
    const cat = type.absence_category || 'otros';
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(type);
    return acc;
  }, {} as Record<string, AbsenceType[]>) || {};

  // Show loading state while company is loading
  if (companyLoading) {
    return (
      <Card>
        <CardContent className="py-12">
          <div className="flex items-center justify-center">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        </CardContent>
      </Card>
    );
  }

  // Show error state if no company
  if (!company?.id) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <AlertTriangle className="h-12 w-12 text-amber-500 mx-auto mb-4" />
          <p className="text-muted-foreground">
            No se ha podido cargar la empresa. Por favor, recarga la página.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle>Catálogo de Tipos de Ausencia</CardTitle>
          <CardDescription>
            Configura los tipos de ausencia según normativa española y convenio
          </CardDescription>
        </div>
        <Button onClick={openCreateDialog}>
          <Plus className="h-4 w-4 mr-2" />
          Nuevo Tipo
        </Button>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : Object.keys(groupedTypes).length === 0 ? (
          <div className="text-center py-8 space-y-4">
            <Settings2 className="h-12 w-12 text-muted-foreground mx-auto" />
            <div>
              <p className="font-medium">No hay tipos de ausencia configurados</p>
              <p className="text-sm text-muted-foreground">
                Inicializa el catálogo con los 22 tipos estándar o crea tipos personalizados
              </p>
            </div>
            <div className="flex items-center justify-center gap-3">
              <Button 
                onClick={() => seedMutation.mutate()}
                disabled={seedMutation.isPending}
              >
                {seedMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Inicializar Catálogo Estándar
              </Button>
              <Button variant="outline" onClick={openCreateDialog}>
                <Plus className="h-4 w-4 mr-2" />
                Crear tipo personalizado
              </Button>
            </div>
          </div>
        ) : (
          <Accordion type="multiple" defaultValue={Object.keys(groupedTypes)} className="space-y-2">
            {Object.entries(groupedTypes).map(([category, categoryTypes]) => (
              <AccordionItem key={category} value={category} className="border rounded-lg px-4">
                <AccordionTrigger className="hover:no-underline">
                  <div className="flex items-center gap-3">
                    <span className="font-medium">{categoryLabels[category] || category}</span>
                    <Badge variant="secondary">{categoryTypes.length}</Badge>
                  </div>
                </AccordionTrigger>
                <AccordionContent>
                  <div className="space-y-3 pt-2">
                    {categoryTypes.map((type) => (
                      <div
                        key={type.id}
                        className="flex items-center justify-between p-3 rounded-lg border bg-card"
                      >
                        <div className="flex items-center gap-3">
                          <div
                            className="w-4 h-4 rounded-full"
                            style={{ backgroundColor: type.color }}
                          />
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="font-medium">{type.name}</span>
                              <Badge variant="outline" className="text-xs">
                                {type.code}
                              </Badge>
                              {!type.is_active && (
                                <Badge variant="secondary" className="text-xs">
                                  Inactivo
                                </Badge>
                              )}
                            </div>
                            <div className="flex items-center gap-3 text-xs text-muted-foreground mt-1">
                              <span className="flex items-center gap-1">
                                <Clock className="h-3 w-3" />
                                {computeOnLabels[type.compute_on]}
                              </span>
                              {type.duration_value && (
                                <span>{type.duration_value} {type.duration_unit === 'days' ? 'días' : 'horas'}</span>
                              )}
                              {type.extra_travel_days > 0 && (
                                <span>+{type.extra_travel_days} por desplazamiento</span>
                              )}
                              <span className="flex items-center gap-1">
                                <Shield className="h-3 w-3" />
                                {legalOriginLabels[type.legal_origin]}
                              </span>
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <div className="flex items-center gap-1 text-xs text-muted-foreground">
                            {type.is_paid && <Badge variant="outline" className="text-xs">Retribuido</Badge>}
                            {type.requires_justification && <Badge variant="outline" className="text-xs">Justificante</Badge>}
                            {type.blocks_clocking && <Badge variant="outline" className="text-xs">Bloquea fichaje</Badge>}
                          </div>
                          <Button size="sm" variant="ghost" onClick={() => openEditDialog(type)}>
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button 
                            size="sm" 
                            variant="ghost" 
                            className="text-destructive"
                            onClick={() => deleteMutation.mutate(type.id)}
                            disabled={deleteMutation.isPending}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        )}

        {/* Create/Edit Dialog */}
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{editingType ? 'Editar Tipo de Ausencia' : 'Nuevo Tipo de Ausencia'}</DialogTitle>
              <DialogDescription>
                Configura todos los parámetros según normativa española
              </DialogDescription>
            </DialogHeader>

            <div className="grid gap-6 py-4">
              {/* Basic Info */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Código *</Label>
                  <Input
                    value={formData.code || ''}
                    onChange={(e) => setFormData({ ...formData, code: e.target.value.toUpperCase() })}
                    placeholder="MATRIMONIO"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Nombre *</Label>
                  <Input
                    value={formData.name || ''}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="Matrimonio o registro de pareja"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label>Descripción</Label>
                <Textarea
                  value={formData.description || ''}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Descripción detallada del tipo de ausencia..."
                  rows={2}
                />
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label>Categoría</Label>
                  <Select
                    value={formData.absence_category || 'permiso_retribuido'}
                    onValueChange={(v) => setFormData({ ...formData, absence_category: v })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(categoryLabels).map(([value, label]) => (
                        <SelectItem key={value} value={value}>{label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Origen Legal</Label>
                  <Select
                    value={formData.legal_origin || 'empresa'}
                    onValueChange={(v) => setFormData({ ...formData, legal_origin: v })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(legalOriginLabels).map(([value, label]) => (
                        <SelectItem key={value} value={value}>{label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Color</Label>
                  <Input
                    type="color"
                    value={formData.color || '#3B82F6'}
                    onChange={(e) => setFormData({ ...formData, color: e.target.value })}
                    className="h-10"
                  />
                </div>
              </div>

              {/* Duration */}
              <div className="border rounded-lg p-4 space-y-4">
                <h4 className="font-medium flex items-center gap-2">
                  <Clock className="h-4 w-4" />
                  Duración y Cómputo
                </h4>
                <div className="grid grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label>Cómputo en</Label>
                    <Select
                      value={formData.compute_on || 'dias_laborables'}
                      onValueChange={(v) => setFormData({ ...formData, compute_on: v })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {Object.entries(computeOnLabels).map(([value, label]) => (
                          <SelectItem key={value} value={value}>{label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Duración base</Label>
                    <Input
                      type="number"
                      value={formData.duration_value || ''}
                      onChange={(e) => setFormData({ ...formData, duration_value: e.target.value ? Number(e.target.value) : null })}
                      placeholder="Ej: 15"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Unidad</Label>
                    <Select
                      value={formData.duration_unit || 'days'}
                      onValueChange={(v) => setFormData({ ...formData, duration_unit: v })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="days">Días</SelectItem>
                        <SelectItem value="hours">Horas</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label>+Días por desplazamiento</Label>
                    <Input
                      type="number"
                      value={formData.extra_travel_days || 0}
                      onChange={(e) => setFormData({ ...formData, extra_travel_days: Number(e.target.value) })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Umbral km desplazamiento</Label>
                    <Input
                      type="number"
                      value={formData.travel_threshold_km || 200}
                      onChange={(e) => setFormData({ ...formData, travel_threshold_km: Number(e.target.value) })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Máx. días/año</Label>
                    <Input
                      type="number"
                      value={formData.max_days_per_year || ''}
                      onChange={(e) => setFormData({ ...formData, max_days_per_year: e.target.value ? Number(e.target.value) : null })}
                      placeholder="Sin límite"
                    />
                  </div>
                </div>
              </div>

              {/* Approval */}
              <div className="border rounded-lg p-4 space-y-4">
                <h4 className="font-medium flex items-center gap-2">
                  <FileText className="h-4 w-4" />
                  Aprobación y Documentación
                </h4>
                <div className="grid grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label>Flujo de aprobación</Label>
                    <Select
                      value={formData.approval_flow || 'manager'}
                      onValueChange={(v) => setFormData({ ...formData, approval_flow: v })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {Object.entries(approvalFlowLabels).map(([value, label]) => (
                          <SelectItem key={value} value={value}>{label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>SLA respuesta (horas)</Label>
                    <Input
                      type="number"
                      value={formData.sla_hours || 48}
                      onChange={(e) => setFormData({ ...formData, sla_hours: Number(e.target.value) })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Preaviso (días)</Label>
                    <Input
                      type="number"
                      value={formData.advance_notice_days || 0}
                      onChange={(e) => setFormData({ ...formData, advance_notice_days: Number(e.target.value) })}
                    />
                  </div>
                </div>
              </div>

              {/* Toggles */}
              <div className="grid grid-cols-2 gap-4">
                <div className="flex items-center justify-between p-3 border rounded-lg">
                  <Label>Retribuido</Label>
                  <Switch
                    checked={formData.is_paid ?? true}
                    onCheckedChange={(v) => setFormData({ ...formData, is_paid: v })}
                  />
                </div>
                <div className="flex items-center justify-between p-3 border rounded-lg">
                  <Label>Requiere justificante</Label>
                  <Switch
                    checked={formData.requires_justification ?? false}
                    onCheckedChange={(v) => setFormData({ ...formData, requires_justification: v })}
                  />
                </div>
                <div className="flex items-center justify-between p-3 border rounded-lg">
                  <Label>Requiere aprobación</Label>
                  <Switch
                    checked={formData.requires_approval ?? true}
                    onCheckedChange={(v) => setFormData({ ...formData, requires_approval: v })}
                  />
                </div>
                <div className="flex items-center justify-between p-3 border rounded-lg">
                  <Label>Cuenta como trabajo</Label>
                  <Switch
                    checked={formData.counts_as_work ?? false}
                    onCheckedChange={(v) => setFormData({ ...formData, counts_as_work: v })}
                  />
                </div>
                <div className="flex items-center justify-between p-3 border rounded-lg">
                  <Label>Bloquea fichaje</Label>
                  <Switch
                    checked={formData.blocks_clocking ?? false}
                    onCheckedChange={(v) => setFormData({ ...formData, blocks_clocking: v })}
                  />
                </div>
                <div className="flex items-center justify-between p-3 border rounded-lg">
                  <Label>Permite medio día</Label>
                  <Switch
                    checked={formData.half_day_allowed ?? false}
                    onCheckedChange={(v) => setFormData({ ...formData, half_day_allowed: v })}
                  />
                </div>
                <div className="flex items-center justify-between p-3 border rounded-lg">
                  <Label>Activo</Label>
                  <Switch
                    checked={formData.is_active ?? true}
                    onCheckedChange={(v) => setFormData({ ...formData, is_active: v })}
                  />
                </div>
              </div>

              {/* Notes */}
              <div className="space-y-2">
                <Label>Referencia convenio / Notas</Label>
                <Textarea
                  value={formData.notes || ''}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  placeholder="Art. 37.3 ET, Convenio Colectivo..."
                  rows={2}
                />
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
                Cancelar
              </Button>
              <Button onClick={handleSave} disabled={saveMutation.isPending}>
                {saveMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                {editingType ? 'Guardar Cambios' : 'Crear Tipo'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
}
