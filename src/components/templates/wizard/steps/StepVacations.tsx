import { useState } from 'react';
import { useWizard } from '../WizardContext';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Palmtree, Plus, Trash2, Info, FileText } from 'lucide-react';
import { LeaveType, SECTOR_LABELS } from '@/types/templates';

const DEFAULT_LEAVES: LeaveType[] = [
  { type: 'marriage', label: 'Matrimonio', days: 15, paid: true, proof_required: true },
  { type: 'birth', label: 'Nacimiento hijo/a', days: 5, paid: true, proof_required: true },
  { type: 'death_close', label: 'Fallecimiento familiar 1º grado', days: 3, paid: true, proof_required: true },
  { type: 'death_extended', label: 'Fallecimiento familiar 2º grado', days: 2, paid: true, proof_required: true },
  { type: 'moving', label: 'Mudanza', days: 1, paid: true, proof_required: false },
  { type: 'medical', label: 'Consulta médica', days: 0, paid: true, proof_required: true },
  { type: 'exam', label: 'Exámenes oficiales', days: 0, paid: true, proof_required: true },
  { type: 'public_duty', label: 'Deber público inexcusable', days: 0, paid: true, proof_required: true },
];

export function StepVacations() {
  const { state, updateNestedPayload, updatePayload } = useWizard();
  const vacations = state.payload.vacations || {};
  const leavesCatalog = state.payload.leaves_catalog || DEFAULT_LEAVES;

  const [newLeaveType, setNewLeaveType] = useState('');
  const [newLeaveDays, setNewLeaveDays] = useState(1);

  const handleAddLeave = () => {
    if (newLeaveType.trim()) {
      const newLeave: LeaveType = {
        type: newLeaveType.toLowerCase().replace(/\s+/g, '_'),
        label: newLeaveType,
        days: newLeaveDays,
        paid: true,
        proof_required: true,
      };
      updatePayload({ leaves_catalog: [...leavesCatalog, newLeave] });
      setNewLeaveType('');
      setNewLeaveDays(1);
    }
  };

  const handleRemoveLeave = (index: number) => {
    const updated = leavesCatalog.filter((_, i) => i !== index);
    updatePayload({ leaves_catalog: updated });
  };

  const handleUpdateLeave = (index: number, updates: Partial<LeaveType>) => {
    const updated = leavesCatalog.map((leave, i) => 
      i === index ? { ...leave, ...updates } : leave
    );
    updatePayload({ leaves_catalog: updated });
  };

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold mb-2">Paso 8: Vacaciones y Permisos</h3>
        <p className="text-muted-foreground text-sm">
          Configure días de vacaciones y catálogo de permisos retribuidos según convenio.
        </p>
      </div>

      {/* Vacations */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Palmtree className="h-4 w-4" />
            Vacaciones anuales
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label>Días de vacaciones al año</Label>
              <Input
                type="number"
                min={22}
                max={45}
                value={vacations.vacation_days_year ?? 30}
                onChange={(e) => updateNestedPayload('vacations', { vacation_days_year: Number(e.target.value) })}
              />
              <p className="text-xs text-muted-foreground">
                Mínimo legal: 30 días naturales (≈22 laborables)
              </p>
            </div>

            <div className="space-y-2">
              <Label>Unidad de cómputo</Label>
              <RadioGroup
                value={vacations.vacation_unit || 'dias_naturales'}
                onValueChange={(value) => updateNestedPayload('vacations', { vacation_unit: value })}
                className="flex gap-4"
              >
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="dias_naturales" id="naturales" />
                  <Label htmlFor="naturales" className="cursor-pointer">Naturales</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="dias_laborables" id="laborables" />
                  <Label htmlFor="laborables" className="cursor-pointer">Laborables</Label>
                </div>
              </RadioGroup>
            </div>

            <div className="space-y-2">
              <Label>Sistema de devengo</Label>
              <select
                className="w-full border rounded-md p-2 bg-background"
                value={vacations.vacation_devengo || 'anual'}
                onChange={(e) => updateNestedPayload('vacations', { vacation_devengo: e.target.value })}
              >
                <option value="anual">Anual (año natural)</option>
                <option value="prorrata_mensual">Prorrata mensual</option>
                <option value="aniversario">Por aniversario contrato</option>
              </select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Leaves Catalog */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <FileText className="h-4 w-4" />
            Catálogo de permisos retribuidos
          </CardTitle>
          <CardDescription>
            Permisos según Estatuto de los Trabajadores. Los convenios pueden ampliar días y añadir permisos.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2 max-h-[300px] overflow-y-auto">
            {leavesCatalog.map((leave, index) => (
              <div
                key={leave.type}
                className="flex items-center gap-3 p-3 border rounded-lg"
              >
                <div className="flex-1 grid grid-cols-4 gap-3 items-center">
                  <Input
                    value={leave.label || leave.type}
                    onChange={(e) => handleUpdateLeave(index, { label: e.target.value })}
                    className="col-span-2"
                  />
                  <div className="flex items-center gap-2">
                    <Input
                      type="number"
                      min={0}
                      value={leave.days}
                      onChange={(e) => handleUpdateLeave(index, { days: Number(e.target.value) })}
                      className="w-16"
                    />
                    <span className="text-xs text-muted-foreground">días</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Switch
                      checked={leave.proof_required}
                      onCheckedChange={(checked) => handleUpdateLeave(index, { proof_required: checked })}
                    />
                    <span className="text-xs text-muted-foreground">Justificante</span>
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => handleRemoveLeave(index)}
                  className="text-muted-foreground hover:text-destructive"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ))}
          </div>

          {/* Add New Leave */}
          <div className="flex items-center gap-3 p-3 border-dashed border-2 rounded-lg">
            <Input
              placeholder="Nuevo tipo de permiso..."
              value={newLeaveType}
              onChange={(e) => setNewLeaveType(e.target.value)}
              className="flex-1"
            />
            <Input
              type="number"
              min={0}
              value={newLeaveDays}
              onChange={(e) => setNewLeaveDays(Number(e.target.value))}
              className="w-20"
            />
            <span className="text-xs text-muted-foreground">días</span>
            <Button onClick={handleAddLeave} size="sm">
              <Plus className="h-4 w-4 mr-1" />
              Añadir
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Legal Note */}
      <Alert>
        <Info className="h-4 w-4" />
        <AlertDescription>
          <strong>Novedades 2025-2026:</strong> Ampliación de permisos por cuidado de familiares (5 días), 
          permiso parental de 8 semanas, y flexibilización para conciliación. Verifique con su convenio.
        </AlertDescription>
      </Alert>
    </div>
  );
}
