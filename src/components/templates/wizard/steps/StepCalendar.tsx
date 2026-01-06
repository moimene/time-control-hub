import { useWizard } from '../WizardContext';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Calendar, Clock, Globe, Info } from 'lucide-react';

const WEEK_DAYS = [
  { value: 'monday', label: 'Lunes' },
  { value: 'sunday', label: 'Domingo' },
];

const TIMEZONES = [
  { value: 'Europe/Madrid', label: 'España peninsular (Europe/Madrid)' },
  { value: 'Atlantic/Canary', label: 'Canarias (Atlantic/Canary)' },
];

const SPANISH_HOLIDAYS_2025 = [
  { date: '2025-01-01', name: 'Año Nuevo', type: 'nacional' },
  { date: '2025-01-06', name: 'Epifanía del Señor', type: 'nacional' },
  { date: '2025-04-18', name: 'Viernes Santo', type: 'nacional' },
  { date: '2025-05-01', name: 'Día del Trabajador', type: 'nacional' },
  { date: '2025-08-15', name: 'Asunción de la Virgen', type: 'nacional' },
  { date: '2025-10-12', name: 'Fiesta Nacional', type: 'nacional' },
  { date: '2025-11-01', name: 'Todos los Santos', type: 'nacional' },
  { date: '2025-12-06', name: 'Día de la Constitución', type: 'nacional' },
  { date: '2025-12-08', name: 'Inmaculada Concepción', type: 'nacional' },
  { date: '2025-12-25', name: 'Navidad', type: 'nacional' },
];

export function StepCalendar() {
  const { state, updateNestedPayload } = useWizard();
  const calendar = state.payload.calendar || {};
  const closures = calendar.period_closures || {};

  const isSummerIntensiveApplicable = ['servicios_profesionales', 'consultoria', 'oficinas'].includes(
    state.selectedSeedSector || ''
  );

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold mb-2">Paso 2: Calendario y Cierres</h3>
        <p className="text-muted-foreground text-sm">
          Configure el calendario base, festivos y ventanas de cierre que afectan a todas las reglas de cumplimiento.
        </p>
      </div>

      {/* Basic Calendar Settings */}
      <div className="grid md:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label className="flex items-center gap-2">
            <Calendar className="h-4 w-4" />
            Inicio de semana
          </Label>
          <select
            className="w-full border rounded-md p-2 bg-background"
            value={calendar.week_start_day || 'monday'}
            onChange={(e) => updateNestedPayload('calendar', { week_start_day: e.target.value })}
          >
            {WEEK_DAYS.map((day) => (
              <option key={day.value} value={day.value}>{day.label}</option>
            ))}
          </select>
        </div>

        <div className="space-y-2">
          <Label className="flex items-center gap-2">
            <Globe className="h-4 w-4" />
            Zona horaria
          </Label>
          <select
            className="w-full border rounded-md p-2 bg-background"
            value={calendar.timezone || 'Europe/Madrid'}
            onChange={(e) => updateNestedPayload('calendar', { timezone: e.target.value })}
          >
            {TIMEZONES.map((tz) => (
              <option key={tz.value} value={tz.value}>{tz.label}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Period Closures */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Clock className="h-4 w-4" />
            Ventanas de cierre de períodos
          </CardTitle>
          <CardDescription>
            Los cierres consolidan los datos y evitan modificaciones posteriores no autorizadas.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              { key: 'daily', label: 'Cierre diario', desc: 'Consolida fichajes cada día' },
              { key: 'weekly', label: 'Cierre semanal', desc: 'Verifica descansos semanales' },
              { key: 'monthly', label: 'Cierre mensual', desc: 'Genera informes mensuales' },
              { key: 'annual', label: 'Cierre anual', desc: 'Verifica jornada anual y extras' },
            ].map((closure) => (
              <div key={closure.key} className="flex items-start space-x-3 p-3 border rounded-lg">
                <Switch
                  checked={closures[closure.key as keyof typeof closures] || false}
                  onCheckedChange={(checked) =>
                    updateNestedPayload('calendar', {
                      period_closures: { ...closures, [closure.key]: checked },
                    })
                  }
                />
                <div>
                  <Label className="text-sm font-medium">{closure.label}</Label>
                  <p className="text-xs text-muted-foreground">{closure.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Summer Intensive Alert */}
      {isSummerIntensiveApplicable && (
        <Alert className="bg-blue-50 border-blue-200 dark:bg-blue-950 dark:border-blue-800">
          <Info className="h-4 w-4 text-blue-600" />
          <AlertDescription className="text-blue-800 dark:text-blue-200">
            <strong>Jornada intensiva de verano:</strong> En oficinas y despachos es habitual la jornada de 7 horas diarias
            durante los meses de verano (típicamente 15 jun - 15 sep). Se configurará en el paso de Turnos.
          </AlertDescription>
        </Alert>
      )}

      {/* Holidays Preview */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">Festivos nacionales 2025</CardTitle>
            <Badge variant="outline">10 días</Badge>
          </div>
          <CardDescription>
            Precargados automáticamente. Los festivos autonómicos y locales se añaden según ubicación del centro.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid sm:grid-cols-2 gap-2 text-sm max-h-48 overflow-y-auto">
            {SPANISH_HOLIDAYS_2025.map((holiday) => (
              <div
                key={holiday.date}
                className="flex items-center justify-between p-2 bg-muted/50 rounded"
              >
                <span>{holiday.name}</span>
                <span className="text-muted-foreground">
                  {new Date(holiday.date).toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })}
                </span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Region-specific note */}
      {state.region && (
        <Alert>
          <Info className="h-4 w-4" />
          <AlertDescription>
            Se añadirán automáticamente los festivos de <strong>{state.region}</strong> al publicar la plantilla.
          </AlertDescription>
        </Alert>
      )}
    </div>
  );
}
