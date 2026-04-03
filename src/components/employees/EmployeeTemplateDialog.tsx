import { useEffect, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import { supabase } from '@/integrations/supabase/client';
import { useCompany } from '@/hooks/useCompany';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { CheckCircle2, Briefcase } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface Employee {
  id: string;
  first_name: string;
  last_name: string;
  employee_code: string;
}

interface EmployeeTemplateDialogProps {
  employee: Employee | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface RuleVersion {
  id: string;
  published_at: string | null;
}

interface RuleSet {
  id: string;
  name: string;
  convenio: string | null;
  rule_versions: RuleVersion[];
}

interface ActiveAssignment {
  id: string;
  rule_version_id: string;
  effective_from: string | null;
  rule_versions: {
    rule_sets: {
      name: string;
      convenio: string | null;
    };
  };
}

function resolveLatestVersionId(versions: RuleVersion[]): string | null {
  if (!versions || versions.length === 0) return null;
  const sorted = [...versions].sort((a, b) => {
    if (!a.published_at) return 1;
    if (!b.published_at) return -1;
    return new Date(b.published_at).getTime() - new Date(a.published_at).getTime();
  });
  return sorted[0].id;
}

export function EmployeeTemplateDialog({
  employee,
  open,
  onOpenChange,
}: EmployeeTemplateDialogProps) {
  const { companyId } = useCompany();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const today = format(new Date(), 'yyyy-MM-dd');
  const [selectedVersionId, setSelectedVersionId] = useState<string>('');
  const [effectiveFrom, setEffectiveFrom] = useState(today);

  useEffect(() => {
    if (!open) {
      return;
    }

    setSelectedVersionId('');
    setEffectiveFrom(format(new Date(), 'yyyy-MM-dd'));
  }, [employee?.id, open]);

  // Current active assignment for this employee
  const { data: currentAssignment, isLoading: loadingAssignment } = useQuery<ActiveAssignment | null>({
    queryKey: ['employee-assignment', employee?.id],
    enabled: !!employee && open,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('rule_assignments')
        .select('id, rule_version_id, effective_from, rule_versions(rule_sets(name, convenio))')
        .eq('employee_id', employee!.id)
        .eq('is_active', true)
        .maybeSingle();
      if (error) throw error;
      return data as ActiveAssignment | null;
    },
  });

  // Published templates for this company
  const { data: ruleSets = [], isLoading: loadingTemplates } = useQuery<RuleSet[]>({
    queryKey: ['published-rule-sets', companyId],
    enabled: !!companyId && open,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('rule_sets')
        .select('id, name, convenio, rule_versions(id, published_at)')
        .eq('company_id', companyId!)
        .eq('status', 'published')
        .order('name');
      if (error) throw error;
      return (data as RuleSet[]).filter(
        rs => resolveLatestVersionId(rs.rule_versions) !== null
      );
    },
  });

  const assignMutation = useMutation({
    mutationFn: async () => {
      if (!employee || !companyId || !selectedVersionId) {
        throw new Error('Faltan datos para asignar');
      }
      const { error } = await supabase.rpc('assign_rule_version_to_employee', {
        p_employee_id: employee.id,
        p_rule_version_id: selectedVersionId,
        p_effective_from: effectiveFrom || null,
      });

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['employee-assignment', employee?.id] });
      queryClient.invalidateQueries({ queryKey: ['company-setup-status', companyId] });
      toast({ title: 'Jornada asignada correctamente' });
      onOpenChange(false);
    },
    onError: (err: Error) => {
      toast({ variant: 'destructive', title: 'Error al asignar jornada', description: err.message });
    },
  });

  const handleAssign = () => {
    if (!selectedVersionId) {
      toast({ variant: 'destructive', title: 'Selecciona una plantilla antes de asignar' });
      return;
    }
    assignMutation.mutate();
  };

  if (!employee) return null;

  const currentTemplate = (currentAssignment as ActiveAssignment | null)?.rule_versions?.rule_sets;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Briefcase className="h-5 w-5" />
            Jornada aplicable
          </DialogTitle>
          <DialogDescription>
            {employee.first_name} {employee.last_name} ({employee.employee_code})
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5">
          {/* Current assignment */}
          <div className="rounded-lg border p-3 bg-muted/30">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">
              Asignación actual
            </p>
            {loadingAssignment ? (
              <p className="text-sm text-muted-foreground">Cargando...</p>
            ) : currentTemplate ? (
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-green-600 flex-shrink-0" />
                <div>
                  <p className="text-sm font-medium">{currentTemplate.name}</p>
                  {currentTemplate.convenio && (
                    <p className="text-xs text-muted-foreground">{currentTemplate.convenio}</p>
                  )}
                </div>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground italic">Sin jornada asignada</p>
            )}
          </div>

          {/* Select new template */}
          <div className="space-y-2">
            <Label>Nueva plantilla</Label>
            {loadingTemplates ? (
              <p className="text-sm text-muted-foreground">Cargando plantillas...</p>
            ) : ruleSets.length === 0 ? (
              <div className="rounded-md border border-amber-200 bg-amber-50 p-3">
                <p className="text-sm text-amber-700">
                  No hay plantillas publicadas. Crea y publica una desde{' '}
                  <strong>Plantillas → Asistente de configuración</strong>.
                </p>
              </div>
            ) : (
              <Select value={selectedVersionId} onValueChange={setSelectedVersionId}>
                <SelectTrigger>
                  <SelectValue placeholder="Seleccionar plantilla..." />
                </SelectTrigger>
                <SelectContent>
                  {ruleSets.map(rs => {
                    const versionId = resolveLatestVersionId(rs.rule_versions)!;
                    return (
                      <SelectItem key={rs.id} value={versionId}>
                        {rs.name}
                        {rs.convenio ? ` — ${rs.convenio}` : ''}
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
            )}
          </div>

          {/* Effective from */}
          <div className="space-y-2">
            <Label htmlFor="effective-from">Vigente desde</Label>
            <Input
              id="effective-from"
              type="date"
              value={effectiveFrom}
              onChange={e => setEffectiveFrom(e.target.value)}
            />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button
              onClick={handleAssign}
              disabled={!selectedVersionId || assignMutation.isPending || ruleSets.length === 0}
            >
              {assignMutation.isPending ? 'Asignando...' : 'Asignar jornada'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
