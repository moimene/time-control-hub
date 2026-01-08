import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useCompany } from '@/hooks/useCompany';
import { useNavigate } from 'react-router-dom';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { AlertTriangle, Settings, CheckCircle2, XCircle } from 'lucide-react';

interface ConfigCheck {
  key: string;
  completed: boolean;
}

async function checkConfigStatus(companyId: string): Promise<ConfigCheck[]> {
  // Check employees
  const { count: employeesCount } = await supabase
    .from('employees')
    .select('id', { count: 'exact', head: true })
    .eq('company_id', companyId);
  
  // Check rule_sets (templates) with status = 'active'
  const { count: templatesCount } = await supabase
    .from('rule_sets')
    .select('id', { count: 'exact', head: true })
    .eq('company_id', companyId)
    .eq('status', 'active');
  
  // Check absence types
  const { count: absencesCount } = await supabase
    .from('absence_types')
    .select('id', { count: 'exact', head: true })
    .eq('company_id', companyId)
    .eq('is_active', true);
  
  // Check calendar holidays
  const { count: calendarCount } = await supabase
    .from('calendar_holidays')
    .select('id', { count: 'exact', head: true })
    .eq('company_id', companyId);
  
  // Check terminals
  const { count: terminalsCount } = await supabase
    .from('terminals')
    .select('id', { count: 'exact', head: true })
    .eq('company_id', companyId)
    .eq('status', 'active');

  return [
    { key: 'employees', completed: (employeesCount || 0) > 0 },
    { key: 'templates', completed: (templatesCount || 0) > 0 },
    { key: 'absences', completed: (absencesCount || 0) > 0 },
    { key: 'calendar', completed: (calendarCount || 0) > 0 },
    { key: 'terminals', completed: (terminalsCount || 0) > 0 },
  ];
}

export function SetupReminderBanner() {
  const { companyId } = useCompany();
  const navigate = useNavigate();

  const { data: configStatus, isLoading } = useQuery({
    queryKey: ['company-config-status', companyId],
    enabled: !!companyId,
    queryFn: () => checkConfigStatus(companyId!),
    staleTime: 1000 * 60 * 5, // 5 minutos
  });

  if (isLoading || !configStatus) {
    return null;
  }

  const completedCount = configStatus.filter(c => c.completed).length;
  const totalCount = configStatus.length;
  const progressPercent = Math.round((completedCount / totalCount) * 100);

  // Si todo está completo, no mostrar nada
  if (completedCount === totalCount) {
    return null;
  }

  const configLabels: Record<string, { label: string; path: string }> = {
    employees: { label: 'Añadir empleados', path: '/admin/employees' },
    templates: { label: 'Configurar plantilla horaria', path: '/admin/templates' },
    absences: { label: 'Configurar tipos de ausencia', path: '/admin/absences' },
    calendar: { label: 'Configurar calendario laboral', path: '/admin/settings' },
    terminals: { label: 'Configurar terminal de fichaje', path: '/admin/terminals' },
  };

  const pendingItems = configStatus.filter(c => !c.completed);

  return (
    <Alert variant="default" className="border-amber-500/50 bg-amber-50 dark:bg-amber-950/20">
      <AlertTriangle className="h-5 w-5 text-amber-600" />
      <AlertTitle className="text-amber-800 dark:text-amber-200 font-semibold">
        Configuración pendiente
      </AlertTitle>
      <AlertDescription className="mt-3 space-y-4">
        <p className="text-amber-700 dark:text-amber-300">
          Completa la configuración para que la plataforma funcione correctamente.
        </p>
        
        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="text-amber-700 dark:text-amber-300">
              Progreso: {completedCount} de {totalCount} pasos completados
            </span>
            <span className="font-medium text-amber-800 dark:text-amber-200">{progressPercent}%</span>
          </div>
          <Progress value={progressPercent} className="h-2" />
        </div>

        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {configStatus.map((item) => {
            const config = configLabels[item.key];
            return (
              <div
                key={item.key}
                className={`flex items-center gap-2 rounded-md px-3 py-2 text-sm ${
                  item.completed 
                    ? 'bg-green-100 dark:bg-green-950/30 text-green-700 dark:text-green-300' 
                    : 'bg-amber-100 dark:bg-amber-950/30 text-amber-700 dark:text-amber-300'
                }`}
              >
                {item.completed ? (
                  <CheckCircle2 className="h-4 w-4 text-green-600 flex-shrink-0" />
                ) : (
                  <XCircle className="h-4 w-4 text-amber-600 flex-shrink-0" />
                )}
                <span className="truncate">{config.label}</span>
              </div>
            );
          })}
        </div>

        <div className="flex flex-wrap gap-2 pt-2">
          {pendingItems.length > 0 && (
            <Button 
              size="sm" 
              onClick={() => navigate(configLabels[pendingItems[0].key].path)}
              className="gap-2"
            >
              <Settings className="h-4 w-4" />
              {configLabels[pendingItems[0].key].label}
            </Button>
          )}
          <Button 
            variant="outline" 
            size="sm" 
            onClick={() => navigate('/admin/settings')}
          >
            Ver toda la configuración
          </Button>
        </div>
      </AlertDescription>
    </Alert>
  );
}
