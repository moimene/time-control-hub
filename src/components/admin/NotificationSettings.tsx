import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { useCompany } from '@/hooks/useCompany';
import { Bell, Mail, Calendar, AlertTriangle, Clock, ArrowUpCircle } from 'lucide-react';
import type { Json } from '@/integrations/supabase/types';
import { Separator } from '@/components/ui/separator';

interface NotificationSettingsData {
  inconsistency_email_enabled: boolean;
  weekly_summary_enabled: boolean;
  compliance_notifications_enabled: boolean;
  compliance_channel: 'in_app' | 'email' | 'both';
  quiet_hours_enabled: boolean;
  quiet_hours_start: number;
  quiet_hours_end: number;
  escalation_enabled: boolean;
  escalation_delay_hours: number;
}

const defaultSettings: NotificationSettingsData = {
  inconsistency_email_enabled: true,
  weekly_summary_enabled: true,
  compliance_notifications_enabled: true,
  compliance_channel: 'both',
  quiet_hours_enabled: true,
  quiet_hours_start: 22,
  quiet_hours_end: 8,
  escalation_enabled: true,
  escalation_delay_hours: 4,
};

export function NotificationSettings() {
  const { company } = useCompany();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: settings, isLoading } = useQuery({
    queryKey: ['notification-settings', company?.id],
    enabled: !!company?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('company_settings')
        .select('*')
        .eq('company_id', company!.id)
        .eq('setting_key', 'notifications')
        .maybeSingle();
      
      if (error) throw error;
      
      if (!data?.setting_value) return defaultSettings;
      
      const value = data.setting_value as Partial<NotificationSettingsData>;
      return { ...defaultSettings, ...value };
    },
  });

  const updateMutation = useMutation({
    mutationFn: async (newSettings: NotificationSettingsData) => {
      const { data: existing } = await supabase
        .from('company_settings')
        .select('id')
        .eq('company_id', company!.id)
        .eq('setting_key', 'notifications')
        .maybeSingle();

      const settingValue: Json = newSettings as unknown as Json;

      if (existing) {
        const { error } = await supabase
          .from('company_settings')
          .update({ setting_value: settingValue })
          .eq('id', existing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('company_settings')
          .insert([{
            company_id: company!.id,
            setting_key: 'notifications',
            setting_value: settingValue,
          }]);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notification-settings'] });
      toast({ title: 'Configuración guardada' });
    },
    onError: (error) => {
      toast({ variant: 'destructive', title: 'Error', description: error.message });
    },
  });

  const handleToggle = (key: keyof NotificationSettingsData, value: boolean) => {
    if (!settings) return;
    updateMutation.mutate({ ...settings, [key]: value });
  };

  const handleChange = (key: keyof NotificationSettingsData, value: string | number) => {
    if (!settings) return;
    updateMutation.mutate({ ...settings, [key]: value });
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-8">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Inconsistency Notifications */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Bell className="h-5 w-5" />
            <CardTitle>Notificaciones de Inconsistencias</CardTitle>
          </div>
          <CardDescription>
            Alertas automáticas cuando se detecten inconsistencias en los fichajes
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <Mail className="h-4 w-4 text-muted-foreground" />
                <Label htmlFor="inconsistency-email" className="font-medium">
                  Alertas individuales por email
                </Label>
              </div>
              <p className="text-sm text-muted-foreground">
                Enviar email al empleado cuando se detecten inconsistencias
              </p>
            </div>
            <Switch
              id="inconsistency-email"
              checked={settings?.inconsistency_email_enabled ?? true}
              onCheckedChange={(checked) => handleToggle('inconsistency_email_enabled', checked)}
              disabled={updateMutation.isPending}
            />
          </div>

          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <Calendar className="h-4 w-4 text-muted-foreground" />
                <Label htmlFor="weekly-summary" className="font-medium">
                  Resumen semanal a responsables
                </Label>
              </div>
              <p className="text-sm text-muted-foreground">
                Resumen semanal de inconsistencias a responsables de departamento
              </p>
            </div>
            <Switch
              id="weekly-summary"
              checked={settings?.weekly_summary_enabled ?? true}
              onCheckedChange={(checked) => handleToggle('weekly_summary_enabled', checked)}
              disabled={updateMutation.isPending}
            />
          </div>
        </CardContent>
      </Card>

      {/* Compliance Notifications */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5" />
            <CardTitle>Alertas de Cumplimiento</CardTitle>
          </div>
          <CardDescription>
            Notificaciones automáticas cuando se detecten violaciones de cumplimiento
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <Label htmlFor="compliance-enabled" className="font-medium">
                Activar alertas de cumplimiento
              </Label>
              <p className="text-sm text-muted-foreground">
                Enviar notificaciones cuando se detecten violaciones
              </p>
            </div>
            <Switch
              id="compliance-enabled"
              checked={settings?.compliance_notifications_enabled ?? true}
              onCheckedChange={(checked) => handleToggle('compliance_notifications_enabled', checked)}
              disabled={updateMutation.isPending}
            />
          </div>

          {settings?.compliance_notifications_enabled && (
            <>
              <Separator />
              
              <div className="space-y-2">
                <Label htmlFor="compliance-channel">Canal de notificación</Label>
                <Select
                  value={settings?.compliance_channel || 'both'}
                  onValueChange={(value) => handleChange('compliance_channel', value)}
                  disabled={updateMutation.isPending}
                >
                  <SelectTrigger id="compliance-channel">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="in_app">Solo en la aplicación</SelectItem>
                    <SelectItem value="email">Solo por email</SelectItem>
                    <SelectItem value="both">Aplicación y email</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Quiet Hours */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Clock className="h-5 w-5" />
            <CardTitle>Horas de Silencio</CardTitle>
          </div>
          <CardDescription>
            Retrasar notificaciones no críticas durante ciertas horas
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <Label htmlFor="quiet-hours-enabled" className="font-medium">
                Activar horas de silencio
              </Label>
              <p className="text-sm text-muted-foreground">
                Las alertas no críticas se enviarán a la mañana siguiente
              </p>
            </div>
            <Switch
              id="quiet-hours-enabled"
              checked={settings?.quiet_hours_enabled ?? true}
              onCheckedChange={(checked) => handleToggle('quiet_hours_enabled', checked)}
              disabled={updateMutation.isPending}
            />
          </div>

          {settings?.quiet_hours_enabled && (
            <>
              <Separator />
              
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="quiet-start">Inicio (hora)</Label>
                  <Input
                    id="quiet-start"
                    type="number"
                    min={0}
                    max={23}
                    value={settings?.quiet_hours_start ?? 22}
                    onChange={(e) => handleChange('quiet_hours_start', parseInt(e.target.value))}
                    disabled={updateMutation.isPending}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="quiet-end">Fin (hora)</Label>
                  <Input
                    id="quiet-end"
                    type="number"
                    min={0}
                    max={23}
                    value={settings?.quiet_hours_end ?? 8}
                    onChange={(e) => handleChange('quiet_hours_end', parseInt(e.target.value))}
                    disabled={updateMutation.isPending}
                  />
                </div>
              </div>
              <p className="text-sm text-muted-foreground">
                Las notificaciones se retendrán entre las {settings?.quiet_hours_start}:00 y las {settings?.quiet_hours_end}:00
              </p>
            </>
          )}
        </CardContent>
      </Card>

      {/* Escalation */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <ArrowUpCircle className="h-5 w-5" />
            <CardTitle>Escalado Automático</CardTitle>
          </div>
          <CardDescription>
            Escalar incidencias críticas no resueltas a niveles superiores
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <Label htmlFor="escalation-enabled" className="font-medium">
                Activar escalado automático
              </Label>
              <p className="text-sm text-muted-foreground">
                Notificar a administradores si las incidencias no se resuelven a tiempo
              </p>
            </div>
            <Switch
              id="escalation-enabled"
              checked={settings?.escalation_enabled ?? true}
              onCheckedChange={(checked) => handleToggle('escalation_enabled', checked)}
              disabled={updateMutation.isPending}
            />
          </div>

          {settings?.escalation_enabled && (
            <>
              <Separator />
              
              <div className="space-y-2">
                <Label htmlFor="escalation-delay">Tiempo antes de escalar (horas)</Label>
                <Input
                  id="escalation-delay"
                  type="number"
                  min={1}
                  max={72}
                  value={settings?.escalation_delay_hours ?? 4}
                  onChange={(e) => handleChange('escalation_delay_hours', parseInt(e.target.value))}
                  disabled={updateMutation.isPending}
                />
                <p className="text-sm text-muted-foreground">
                  Las incidencias críticas sin resolver se escalarán después de {settings?.escalation_delay_hours} horas
                </p>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
