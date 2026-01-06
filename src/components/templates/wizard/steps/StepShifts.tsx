import { useState } from 'react';
import { useWizard } from '../WizardContext';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Clock, Plus, Trash2, Info, RotateCcw, Sun } from 'lucide-react';
import { ShiftTemplate, RotationPattern, SECTOR_LABELS } from '@/types/templates';

const COMMON_SHIFTS: ShiftTemplate[] = [
  { name: 'Mañana', start: '06:00', end: '14:00', break_minutes: 15 },
  { name: 'Tarde', start: '14:00', end: '22:00', break_minutes: 15 },
  { name: 'Noche', start: '22:00', end: '06:00', break_minutes: 15 },
  { name: 'Partido', start: '09:00', end: '13:00', start2: '17:00', end2: '21:00', break_minutes: 0 },
  { name: 'Intensivo verano', start: '08:00', end: '15:00', break_minutes: 15 },
  { name: 'Comercial', start: '10:00', end: '14:00', start2: '17:00', end2: '20:30', break_minutes: 60 },
];

export function StepShifts() {
  const { state, updateNestedPayload, updatePayload } = useWizard();
  const shifts = state.payload.shifts || {};
  const shiftTemplates = shifts.shift_templates || [];
  const rotationPatterns = shifts.rotation_patterns || [];
  const sector = state.selectedSeedSector || '';

  const [showAddShift, setShowAddShift] = useState(false);
  const [newShift, setNewShift] = useState<ShiftTemplate>({ name: '', start: '09:00', end: '17:00' });

  const isSummerIntensiveApplicable = ['servicios_profesionales', 'consultoria', 'oficinas'].includes(sector);

  const handleAddShift = () => {
    if (newShift.name.trim()) {
      updateNestedPayload('shifts', {
        shift_templates: [...shiftTemplates, newShift],
      });
      setNewShift({ name: '', start: '09:00', end: '17:00' });
      setShowAddShift(false);
    }
  };

  const handleAddPresetShift = (preset: ShiftTemplate) => {
    if (!shiftTemplates.find(s => s.name === preset.name)) {
      updateNestedPayload('shifts', {
        shift_templates: [...shiftTemplates, preset],
      });
    }
  };

  const handleRemoveShift = (index: number) => {
    const updated = shiftTemplates.filter((_, i) => i !== index);
    updateNestedPayload('shifts', { shift_templates: updated });
  };

  const handleAddRotation = () => {
    const newRotation: RotationPattern = { name: 'Nueva rotación', cycle_days: 7 };
    updateNestedPayload('shifts', {
      rotation_patterns: [...rotationPatterns, newRotation],
    });
  };

  const handleRemoveRotation = (index: number) => {
    const updated = rotationPatterns.filter((_, i) => i !== index);
    updateNestedPayload('shifts', { rotation_patterns: updated });
  };

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold mb-2">Paso 9: Turnos y Patrones</h3>
        <p className="text-muted-foreground text-sm">
          Configure los turnos de trabajo y patrones de rotación aplicables.
        </p>
      </div>

      {/* Summer Intensive Alert */}
      {isSummerIntensiveApplicable && (
        <Alert className="bg-amber-50 border-amber-200 dark:bg-amber-950 dark:border-amber-800">
          <Sun className="h-4 w-4 text-amber-600" />
          <AlertDescription className="text-amber-800 dark:text-amber-200">
            <strong>Jornada intensiva de verano:</strong> En {SECTOR_LABELS[sector] || sector} es habitual 
            la jornada de 7h (08:00-15:00) durante verano. Añada el turno "Intensivo verano" si aplica.
          </AlertDescription>
        </Alert>
      )}

      {/* Shift Templates */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Clock className="h-4 w-4" />
            Plantillas de turno
          </CardTitle>
          <CardDescription>
            Define los turnos tipo que se asignarán a los empleados.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Current Shifts */}
          <div className="space-y-2">
            {shiftTemplates.map((shift, index) => (
              <div key={index} className="flex items-center gap-3 p-3 border rounded-lg">
                <div className="flex-1 grid grid-cols-5 gap-2 items-center">
                  <span className="font-medium">{shift.name}</span>
                  <div className="flex items-center gap-1 text-sm">
                    <span>{shift.start}</span>
                    <span>-</span>
                    <span>{shift.end}</span>
                  </div>
                  {shift.start2 && (
                    <div className="flex items-center gap-1 text-sm text-muted-foreground">
                      <span>+ {shift.start2}</span>
                      <span>-</span>
                      <span>{shift.end2}</span>
                    </div>
                  )}
                  {shift.break_minutes !== undefined && shift.break_minutes > 0 && (
                    <Badge variant="outline" className="text-xs">
                      {shift.break_minutes}' pausa
                    </Badge>
                  )}
                  <div />
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => handleRemoveShift(index)}
                  className="text-muted-foreground hover:text-destructive"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ))}
          </div>

          {/* Quick Add Presets */}
          <div className="space-y-2">
            <Label className="text-sm">Añadir turnos comunes:</Label>
            <div className="flex flex-wrap gap-2">
              {COMMON_SHIFTS.map((preset) => (
                <Button
                  key={preset.name}
                  variant="outline"
                  size="sm"
                  onClick={() => handleAddPresetShift(preset)}
                  disabled={shiftTemplates.some(s => s.name === preset.name)}
                >
                  <Plus className="h-3 w-3 mr-1" />
                  {preset.name}
                </Button>
              ))}
            </div>
          </div>

          {/* Custom Shift */}
          {showAddShift ? (
            <div className="p-4 border-dashed border-2 rounded-lg space-y-3">
              <div className="grid grid-cols-4 gap-3">
                <Input
                  placeholder="Nombre del turno"
                  value={newShift.name}
                  onChange={(e) => setNewShift({ ...newShift, name: e.target.value })}
                />
                <Input
                  type="time"
                  value={newShift.start}
                  onChange={(e) => setNewShift({ ...newShift, start: e.target.value })}
                />
                <Input
                  type="time"
                  value={newShift.end}
                  onChange={(e) => setNewShift({ ...newShift, end: e.target.value })}
                />
                <Input
                  type="number"
                  placeholder="Pausa (min)"
                  value={newShift.break_minutes || ''}
                  onChange={(e) => setNewShift({ ...newShift, break_minutes: Number(e.target.value) })}
                />
              </div>
              <div className="flex gap-2">
                <Button onClick={handleAddShift} size="sm">Añadir</Button>
                <Button variant="outline" onClick={() => setShowAddShift(false)} size="sm">Cancelar</Button>
              </div>
            </div>
          ) : (
            <Button variant="outline" onClick={() => setShowAddShift(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Crear turno personalizado
            </Button>
          )}
        </CardContent>
      </Card>

      {/* Rotation Patterns */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <RotateCcw className="h-4 w-4" />
            Patrones de rotación
          </CardTitle>
          <CardDescription>
            Define ciclos de rotación entre turnos (ej: M-T-N cada 6 días).
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {rotationPatterns.length > 0 ? (
            <div className="space-y-2">
              {rotationPatterns.map((pattern, index) => (
                <div key={index} className="flex items-center gap-3 p-3 border rounded-lg">
                  <Input
                    value={pattern.name}
                    onChange={(e) => {
                      const updated = [...rotationPatterns];
                      updated[index] = { ...pattern, name: e.target.value };
                      updateNestedPayload('shifts', { rotation_patterns: updated });
                    }}
                    className="flex-1"
                  />
                  <div className="flex items-center gap-2">
                    <Input
                      type="number"
                      min={1}
                      value={pattern.cycle_days}
                      onChange={(e) => {
                        const updated = [...rotationPatterns];
                        updated[index] = { ...pattern, cycle_days: Number(e.target.value) };
                        updateNestedPayload('shifts', { rotation_patterns: updated });
                      }}
                      className="w-20"
                    />
                    <span className="text-sm text-muted-foreground">días</span>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => handleRemoveRotation(index)}
                    className="text-muted-foreground hover:text-destructive"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              No hay patrones de rotación configurados. Añada uno si sus empleados rotan entre turnos.
            </p>
          )}
          <Button variant="outline" onClick={handleAddRotation}>
            <Plus className="h-4 w-4 mr-2" />
            Añadir patrón de rotación
          </Button>
        </CardContent>
      </Card>

      {/* Policy */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Política planificado vs. trabajado</CardTitle>
        </CardHeader>
        <CardContent>
          <select
            className="w-full border rounded-md p-2 bg-background"
            value={shifts.planned_vs_worked_policy || 'tolerant'}
            onChange={(e) => updateNestedPayload('shifts', { planned_vs_worked_policy: e.target.value })}
          >
            <option value="strict">Estricto - Alerta si difiere del turno planificado</option>
            <option value="tolerant">Tolerante - Permite variaciones menores</option>
            <option value="flexible">Flexible - Solo valida mínimos legales</option>
          </select>
        </CardContent>
      </Card>
    </div>
  );
}
