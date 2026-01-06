import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { useCompany } from '@/hooks/useCompany';
import { Bell, Mail, Calendar } from 'lucide-react';
import type { Json } from '@/integrations/supabase/types';

interface NotificationSettingsData {
  inconsistency_email_enabled: boolean;
  weekly_summary_enabled: boolean;
}

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
      
      const defaultSettings: NotificationSettingsData = {
        inconsistency_email_enabled: true,
        weekly_summary_enabled: true,
      };
      
      if (!data?.setting_value) return defaultSettings;
      
      const value = data.setting_value as { inconsistency_email_enabled?: boolean; weekly_summary_enabled?: boolean };
      return {
        inconsistency_email_enabled: value.inconsistency_email_enabled ?? true,
        weekly_summary_enabled: value.weekly_summary_enabled ?? true,
      };
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

      const settingValue: Json = {
        inconsistency_email_enabled: newSettings.inconsistency_email_enabled,
        weekly_summary_enabled: newSettings.weekly_summary_enabled,
      };

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
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <Bell className="h-5 w-5" />
          <CardTitle>Notificaciones de Inconsistencias</CardTitle>
        </div>
        <CardDescription>
          Configura las alertas automáticas por email cuando se detecten inconsistencias en los fichajes
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
              Enviar email al empleado cuando se detecten inconsistencias en sus fichajes
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
              Enviar resumen semanal de inconsistencias a los responsables de cada departamento
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
  );
}
