import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCompany } from "@/hooks/useCompany";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Slider } from "@/components/ui/slider";
import { toast } from "sonner";
import { format, parseISO } from "date-fns";
import { es } from "date-fns/locale";
import { Plus, Trash2, Edit2, Users, AlertTriangle, Loader2, Calendar } from "lucide-react";

interface BlackoutRange {
  start: string;
  end: string;
  reason: string;
}

interface CoverageRule {
  id: string;
  company_id: string;
  center_id: string | null;
  department: string | null;
  job_profile: string | null;
  min_team_available_pct: number;
  max_simultaneous_absences: number | null;
  blackout_ranges: BlackoutRange[];
  approval_overrides: boolean;
  priority: number;
  is_active: boolean;
}

interface FormData {
  department: string;
  min_team_available_pct: number;
  max_simultaneous_absences: string;
  approval_overrides: boolean;
  is_active: boolean;
  blackout_ranges: BlackoutRange[];
}

const defaultFormData: FormData = {
  department: "",
  min_team_available_pct: 50,
  max_simultaneous_absences: "",
  approval_overrides: false,
  is_active: true,
  blackout_ranges: []
};

export function CoverageRulesEditor() {
  const { company } = useCompany();
  const queryClient = useQueryClient();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingRule, setEditingRule] = useState<CoverageRule | null>(null);
  const [formData, setFormData] = useState<FormData>(defaultFormData);
  const [newBlackout, setNewBlackout] = useState({ start: "", end: "", reason: "" });

  const { data: rules, isLoading } = useQuery({
    queryKey: ['coverage-rules', company?.id],
    queryFn: async () => {
      if (!company?.id) return [];
      const { data, error } = await supabase
        .from('coverage_rules')
        .select('*')
        .eq('company_id', company.id)
        .order('priority', { ascending: false });
      if (error) throw error;
      return (data || []).map(r => ({
        ...r,
        blackout_ranges: (r.blackout_ranges as unknown as BlackoutRange[]) || []
      })) as CoverageRule[];
    },
    enabled: !!company?.id
  });

  const { data: departments } = useQuery({
    queryKey: ['departments', company?.id],
    queryFn: async () => {
      if (!company?.id) return [];
      const { data, error } = await supabase
        .from('employees')
        .select('department')
        .eq('company_id', company.id)
        .eq('status', 'active')
        .not('department', 'is', null);
      if (error) throw error;
      return [...new Set(data.map(e => e.department).filter(Boolean))] as string[];
    },
    enabled: !!company?.id
  });

  const saveMutation = useMutation({
    mutationFn: async (data: FormData) => {
      if (!company?.id) throw new Error("No company");
      const payload = {
        company_id: company.id,
        department: data.department || null,
        min_team_available_pct: data.min_team_available_pct,
        max_simultaneous_absences: data.max_simultaneous_absences ? parseInt(data.max_simultaneous_absences) : null,
        approval_overrides: data.approval_overrides,
        is_active: data.is_active,
        blackout_ranges: JSON.parse(JSON.stringify(data.blackout_ranges))
      };
      if (editingRule) {
        const { error } = await supabase.from('coverage_rules').update(payload).eq('id', editingRule.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('coverage_rules').insert([payload]);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['coverage-rules'] });
      toast.success(editingRule ? "Regla actualizada" : "Regla creada");
      resetForm();
    },
    onError: () => toast.error("Error al guardar la regla")
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('coverage_rules').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['coverage-rules'] });
      toast.success("Regla eliminada");
    },
    onError: () => toast.error("Error al eliminar la regla")
  });

  const resetForm = () => {
    setIsDialogOpen(false);
    setEditingRule(null);
    setFormData(defaultFormData);
    setNewBlackout({ start: "", end: "", reason: "" });
  };

  const openEditDialog = (rule: CoverageRule) => {
    setEditingRule(rule);
    setFormData({
      department: rule.department || "",
      min_team_available_pct: rule.min_team_available_pct,
      max_simultaneous_absences: rule.max_simultaneous_absences?.toString() || "",
      approval_overrides: rule.approval_overrides,
      is_active: rule.is_active,
      blackout_ranges: rule.blackout_ranges || []
    });
    setIsDialogOpen(true);
  };

  const addBlackoutRange = () => {
    if (!newBlackout.start || !newBlackout.end) {
      toast.error("Completa las fechas del periodo");
      return;
    }
    setFormData(prev => ({ ...prev, blackout_ranges: [...prev.blackout_ranges, { ...newBlackout }] }));
    setNewBlackout({ start: "", end: "", reason: "" });
  };

  const removeBlackoutRange = (index: number) => {
    setFormData(prev => ({ ...prev, blackout_ranges: prev.blackout_ranges.filter((_, i) => i !== index) }));
  };

  if (!company) return <Card><CardContent className="p-6"><p className="text-muted-foreground">Cargando...</p></CardContent></Card>;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2"><Users className="h-5 w-5" />Reglas de Cobertura</CardTitle>
            <CardDescription>Define restricciones de ausencias simultáneas y periodos bloqueados</CardDescription>
          </div>
          <Button size="sm" onClick={() => setIsDialogOpen(true)}><Plus className="h-4 w-4 mr-2" />Nueva Regla</Button>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex items-center justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
        ) : rules && rules.length > 0 ? (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Ámbito</TableHead>
                <TableHead>Cobertura mínima</TableHead>
                <TableHead>Máx. simultáneas</TableHead>
                <TableHead>Periodos bloqueados</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead className="w-[100px]"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rules.map((rule) => (
                <TableRow key={rule.id}>
                  <TableCell className="font-medium">{rule.department ? <Badge variant="outline">{rule.department}</Badge> : <span className="text-muted-foreground">Toda la empresa</span>}</TableCell>
                  <TableCell><div className="flex items-center gap-2"><div className="w-16 h-2 bg-secondary rounded-full overflow-hidden"><div className="h-full bg-primary rounded-full" style={{ width: `${rule.min_team_available_pct}%` }} /></div><span className="text-sm">{rule.min_team_available_pct}%</span></div></TableCell>
                  <TableCell>{rule.max_simultaneous_absences ?? <span className="text-muted-foreground">Sin límite</span>}</TableCell>
                  <TableCell>{rule.blackout_ranges && rule.blackout_ranges.length > 0 ? <div className="flex items-center gap-1"><AlertTriangle className="h-4 w-4 text-amber-500" /><span className="text-sm">{rule.blackout_ranges.length} periodos</span></div> : <span className="text-muted-foreground text-sm">Ninguno</span>}</TableCell>
                  <TableCell><Badge variant={rule.is_active ? "default" : "secondary"}>{rule.is_active ? "Activa" : "Inactiva"}</Badge></TableCell>
                  <TableCell><div className="flex items-center gap-1"><Button variant="ghost" size="icon" onClick={() => openEditDialog(rule)}><Edit2 className="h-4 w-4" /></Button><Button variant="ghost" size="icon" onClick={() => deleteMutation.mutate(rule.id)} disabled={deleteMutation.isPending}><Trash2 className="h-4 w-4 text-destructive" /></Button></div></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        ) : (
          <div className="text-center py-8 text-muted-foreground"><Users className="h-12 w-12 mx-auto mb-4 opacity-50" /><p>No hay reglas de cobertura configuradas</p><p className="text-sm">Crea una regla para gestionar ausencias simultáneas</p></div>
        )}

        <Dialog open={isDialogOpen} onOpenChange={(open) => !open && resetForm()}>
          <DialogContent className="max-w-lg">
            <DialogHeader><DialogTitle>{editingRule ? "Editar Regla" : "Nueva Regla de Cobertura"}</DialogTitle><DialogDescription>Define restricciones para las ausencias del equipo</DialogDescription></DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label>Departamento (opcional)</Label>
                <Input value={formData.department} onChange={(e) => setFormData(prev => ({ ...prev, department: e.target.value }))} placeholder="Dejar vacío para toda la empresa" list="departments-list" />
                <datalist id="departments-list">{departments?.map(dept => <option key={dept} value={dept} />)}</datalist>
              </div>
              <div className="space-y-2">
                <Label>Cobertura mínima del equipo: {formData.min_team_available_pct}%</Label>
                <Slider value={[formData.min_team_available_pct]} onValueChange={([value]) => setFormData(prev => ({ ...prev, min_team_available_pct: value }))} min={0} max={100} step={5} />
                <p className="text-xs text-muted-foreground">No se aprobarán ausencias si el equipo disponible baja de este porcentaje</p>
              </div>
              <div className="space-y-2">
                <Label>Máximo de ausencias simultáneas (opcional)</Label>
                <Input type="number" value={formData.max_simultaneous_absences} onChange={(e) => setFormData(prev => ({ ...prev, max_simultaneous_absences: e.target.value }))} placeholder="Sin límite" min="1" />
              </div>
              <div className="space-y-2">
                <Label className="flex items-center gap-2"><Calendar className="h-4 w-4" />Periodos bloqueados (blackout)</Label>
                {formData.blackout_ranges.length > 0 && (
                  <div className="space-y-2 mb-2">
                    {formData.blackout_ranges.map((range, idx) => (
                      <div key={idx} className="flex items-center gap-2 p-2 bg-secondary/50 rounded-md">
                        <span className="text-sm flex-1">{format(parseISO(range.start), 'dd/MM/yyyy', { locale: es })} - {format(parseISO(range.end), 'dd/MM/yyyy', { locale: es })}{range.reason && <span className="text-muted-foreground"> ({range.reason})</span>}</span>
                        <Button variant="ghost" size="icon" onClick={() => removeBlackoutRange(idx)}><Trash2 className="h-3 w-3" /></Button>
                      </div>
                    ))}
                  </div>
                )}
                <div className="grid grid-cols-3 gap-2">
                  <Input type="date" value={newBlackout.start} onChange={(e) => setNewBlackout(prev => ({ ...prev, start: e.target.value }))} />
                  <Input type="date" value={newBlackout.end} onChange={(e) => setNewBlackout(prev => ({ ...prev, end: e.target.value }))} />
                  <Button variant="outline" size="sm" onClick={addBlackoutRange}><Plus className="h-4 w-4" /></Button>
                </div>
                <Input value={newBlackout.reason} onChange={(e) => setNewBlackout(prev => ({ ...prev, reason: e.target.value }))} placeholder="Motivo (opcional)" className="mt-1" />
              </div>
              <div className="flex items-center justify-between">
                <div className="space-y-0.5"><Label>Permitir override de admin</Label><p className="text-xs text-muted-foreground">Los administradores pueden aprobar ignorando estas reglas</p></div>
                <Switch checked={formData.approval_overrides} onCheckedChange={(checked) => setFormData(prev => ({ ...prev, approval_overrides: checked }))} />
              </div>
              <div className="flex items-center justify-between"><Label>Regla activa</Label><Switch checked={formData.is_active} onCheckedChange={(checked) => setFormData(prev => ({ ...prev, is_active: checked }))} /></div>
            </div>
            <DialogFooter><Button variant="outline" onClick={resetForm}>Cancelar</Button><Button onClick={() => saveMutation.mutate(formData)} disabled={saveMutation.isPending}>{saveMutation.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}{editingRule ? "Guardar" : "Crear"}</Button></DialogFooter>
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
}
