import { useWizard } from '../WizardContext';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Checkbox } from '@/components/ui/checkbox';
import { Bell, Clock, Laptop, Info } from 'lucide-react';
import { SECTOR_LABELS } from '@/types/templates';

export function StepNotifications() {
  const { state, updateNestedPayload } = useWizard();
  const notifications = state.payload.notifications || {};
  const remoteWork = state.payload.remote_work || {};
  const sector = state.selectedSeedSector || '';

  const quietHours = notifications.quiet_hours || { from: '22:00', to: '08:00' };
  const channels = notifications.notify_channels || ['inapp'];

  const isOfficeType = ['servicios_profesionales', 'consultoria', 'oficinas'].includes(sector);

  const handleChannelToggle = (channel: string, checked: boolean) => {
    const updated = checked
      ? [...channels, channel]
      : channels.filter(c => c !== channel);
    updateNestedPayload('notifications', { notify_channels: updated });
  };

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold mb-2">Paso 10: Notificaciones y Desconexión Digital</h3>
        <p className="text-muted-foreground text-sm">
          Configure canales de notificación y respete el derecho a la desconexión digital.
        </p>
      </div>

      {/* Digital Disconnection Alert for Office sectors */}
      {isOfficeType && (
        <Alert className="bg-blue-50 border-blue-200 dark:bg-blue-950 dark:border-blue-800">
          <Info className="h-4 w-4 text-blue-600" />
          <AlertDescription className="text-blue-800 dark:text-blue-200">
            <strong>Desconexión digital:</strong> En {SECTOR_LABELS[sector] || sector} es obligatorio 
            garantizar el derecho a la desconexión digital (Art. 88 LOPDGDD). Configure ventanas de silencio.
          </AlertDescription>
        </Alert>
      )}

      {/* Notification Channels */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Bell className="h-4 w-4" />
            Canales de notificación
          </CardTitle>
          <CardDescription>
            Seleccione cómo se enviarán las alertas de cumplimiento.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid sm:grid-cols-3 gap-4">
            <div className="flex items-start space-x-3 p-4 border rounded-lg">
              <Checkbox
                checked={channels.includes('inapp')}
                onCheckedChange={(checked) => handleChannelToggle('inapp', checked as boolean)}
              />
              <div>
                <Label className="font-medium">In-app</Label>
                <p className="text-xs text-muted-foreground">Notificaciones en la aplicación</p>
              </div>
            </div>
            <div className="flex items-start space-x-3 p-4 border rounded-lg">
              <Checkbox
                checked={channels.includes('email')}
                onCheckedChange={(checked) => handleChannelToggle('email', checked as boolean)}
              />
              <div>
                <Label className="font-medium">Email</Label>
                <p className="text-xs text-muted-foreground">Correo electrónico</p>
              </div>
            </div>
            <div className="flex items-start space-x-3 p-4 border rounded-lg opacity-50">
              <Checkbox disabled />
              <div>
                <Label className="font-medium">SMS</Label>
                <p className="text-xs text-muted-foreground">Próximamente</p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Quiet Hours */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Clock className="h-4 w-4" />
            Horas de silencio
          </CardTitle>
          <CardDescription>
            Durante estas horas no se enviarán notificaciones (excepto críticas si está habilitado).
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Inicio silencio</Label>
              <Input
                type="time"
                value={quietHours.from || '22:00'}
                onChange={(e) => updateNestedPayload('notifications', {
                  quiet_hours: { ...quietHours, from: e.target.value }
                })}
              />
            </div>
            <div className="space-y-2">
              <Label>Fin silencio</Label>
              <Input
                type="time"
                value={quietHours.to || '08:00'}
                onChange={(e) => updateNestedPayload('notifications', {
                  quiet_hours: { ...quietHours, to: e.target.value }
                })}
              />
            </div>
          </div>

          <div className="flex items-start space-x-4 p-4 border rounded-lg">
            <Switch
              checked={notifications.allow_critical_outside_quiet || false}
              onCheckedChange={(checked) => updateNestedPayload('notifications', { allow_critical_outside_quiet: checked })}
            />
            <div className="space-y-1">
              <Label className="font-medium">Permitir alertas críticas fuera de silencio</Label>
              <p className="text-sm text-muted-foreground">
                Las alertas de severidad crítica (riesgo legal) se enviarán inmediatamente.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Remote Work & Disconnection */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Laptop className="h-4 w-4" />
            Teletrabajo y desconexión
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-start space-x-4 p-4 border rounded-lg">
            <Switch
              checked={remoteWork.remote_allowed ?? false}
              onCheckedChange={(checked) => updateNestedPayload('remote_work', { remote_allowed: checked })}
            />
            <div className="space-y-1">
              <Label className="font-medium">Teletrabajo habilitado</Label>
              <p className="text-sm text-muted-foreground">
                La empresa tiene política de teletrabajo. Se aplicarán reglas de desconexión digital.
              </p>
            </div>
          </div>

          {remoteWork.remote_allowed && (
            <div className="space-y-3 p-4 bg-muted/50 rounded-lg">
              <Label>Horario de desconexión digital</Label>
              <div className="grid md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-sm text-muted-foreground">Desde</Label>
                  <Input
                    type="time"
                    value={remoteWork.disconnection_hours?.from || '18:00'}
                    onChange={(e) => updateNestedPayload('remote_work', {
                      disconnection_hours: { 
                        ...remoteWork.disconnection_hours, 
                        from: e.target.value 
                      }
                    })}
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-sm text-muted-foreground">Hasta</Label>
                  <Input
                    type="time"
                    value={remoteWork.disconnection_hours?.to || '09:00'}
                    onChange={(e) => updateNestedPayload('remote_work', {
                      disconnection_hours: { 
                        ...remoteWork.disconnection_hours, 
                        to: e.target.value 
                      }
                    })}
                  />
                </div>
              </div>
              <p className="text-xs text-muted-foreground">
                Durante estas horas el empleado tiene derecho a no responder comunicaciones laborales.
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
