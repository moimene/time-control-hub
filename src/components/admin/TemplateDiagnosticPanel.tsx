import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { 
  AlertTriangle, 
  CheckCircle, 
  RefreshCw, 
  Wrench, 
  FileWarning,
  Loader2,
  Trash2
} from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

interface OrphanRuleSet {
  id: string;
  name: string;
  company_id: string | null;
  company_name?: string;
  status: string;
  created_at: string;
}

const DEFAULT_PAYLOAD = {
  limits: {
    max_daily_hours: 9,
    min_daily_rest: 12,
    min_weekly_rest: 36,
    max_overtime_yearly: 80,
    max_weekly_hours: 40
  },
  breaks: {
    required_after_hours: 6,
    min_break_minutes: 15
  },
  overtime: {
    max_yearly: 80,
    alert_threshold: 60
  },
  leaves: [
    { type: 'vacation', days: 22 },
    { type: 'sick', requires_justification: true }
  ]
};

export function TemplateDiagnosticPanel() {
  const queryClient = useQueryClient();
  const [repairing, setRepairing] = useState<string | null>(null);

  // Fetch orphan rule_sets (those without versions)
  const { data: orphanRuleSets, isLoading, refetch } = useQuery({
    queryKey: ['orphan-rule-sets'],
    queryFn: async () => {
      // Get all rule_sets
      const { data: ruleSets, error: rsError } = await supabase
        .from('rule_sets')
        .select(`
          id,
          name,
          company_id,
          status,
          created_at,
          company:company_id (name)
        `)
        .order('created_at', { ascending: false });

      if (rsError) throw rsError;

      // Get all rule_versions
      const { data: versions, error: rvError } = await supabase
        .from('rule_versions')
        .select('rule_set_id');

      if (rvError) throw rvError;

      // Find orphans (rule_sets without any version)
      const versionedSetIds = new Set(versions.map(v => v.rule_set_id));
      const orphans = ruleSets
        .filter(rs => !versionedSetIds.has(rs.id))
        .map(rs => ({
          id: rs.id,
          name: rs.name,
          company_id: rs.company_id,
          company_name: (rs.company as any)?.name || null,
          status: rs.status,
          created_at: rs.created_at
        }));

      return orphans as OrphanRuleSet[];
    },
  });

  // Repair a single orphan by creating a default version
  const repairMutation = useMutation({
    mutationFn: async (ruleSetId: string) => {
      const { data, error } = await supabase
        .from('rule_versions')
        .insert({
          rule_set_id: ruleSetId,
          version: '1.0.0',
          payload_json: DEFAULT_PAYLOAD,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['orphan-rule-sets'] });
      queryClient.invalidateQueries({ queryKey: ['rule-sets'] });
      toast.success('Plantilla reparada correctamente');
      setRepairing(null);
    },
    onError: (error) => {
      toast.error(`Error al reparar: ${error.message}`);
      setRepairing(null);
    },
  });

  // Delete an orphan rule_set
  const deleteMutation = useMutation({
    mutationFn: async (ruleSetId: string) => {
      const { error } = await supabase
        .from('rule_sets')
        .delete()
        .eq('id', ruleSetId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['orphan-rule-sets'] });
      queryClient.invalidateQueries({ queryKey: ['rule-sets'] });
      toast.success('Plantilla eliminada');
    },
    onError: (error) => {
      toast.error(`Error al eliminar: ${error.message}`);
    },
  });

  // Repair all orphans
  const repairAllMutation = useMutation({
    mutationFn: async () => {
      if (!orphanRuleSets || orphanRuleSets.length === 0) return;

      const inserts = orphanRuleSets.map(rs => ({
        rule_set_id: rs.id,
        version: '1.0.0',
        payload_json: DEFAULT_PAYLOAD,
      }));

      const { error } = await supabase
        .from('rule_versions')
        .insert(inserts);

      if (error) throw error;
      return inserts.length;
    },
    onSuccess: (count) => {
      queryClient.invalidateQueries({ queryKey: ['orphan-rule-sets'] });
      queryClient.invalidateQueries({ queryKey: ['rule-sets'] });
      toast.success(`${count} plantillas reparadas correctamente`);
    },
    onError: (error) => {
      toast.error(`Error al reparar: ${error.message}`);
    },
  });

  const handleRepair = (ruleSetId: string) => {
    setRepairing(ruleSetId);
    repairMutation.mutate(ruleSetId);
  };

  const orphanCount = orphanRuleSets?.length || 0;
  const hasOrphans = orphanCount > 0;

  return (
    <Card className={hasOrphans ? 'border-amber-500' : ''}>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <FileWarning className={`h-5 w-5 ${hasOrphans ? 'text-amber-500' : 'text-muted-foreground'}`} />
            <CardTitle className="text-base">Diagnóstico de Plantillas</CardTitle>
          </div>
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={() => refetch()}
            disabled={isLoading}
          >
            <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
          </Button>
        </div>
        <CardDescription>
          Detecta y repara plantillas huérfanas (rule_sets sin versiones)
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {isLoading ? (
          <div className="flex items-center justify-center py-6">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : hasOrphans ? (
          <>
            <Alert variant="destructive" className="bg-amber-500/10 border-amber-500 text-amber-700">
              <AlertTriangle className="h-4 w-4" />
              <AlertTitle>Se encontraron {orphanCount} plantillas huérfanas</AlertTitle>
              <AlertDescription>
                Estas plantillas no tienen una versión inicial y no pueden ser editadas ni publicadas.
              </AlertDescription>
            </Alert>

            <div className="flex justify-end">
              <Button 
                size="sm" 
                onClick={() => repairAllMutation.mutate()}
                disabled={repairAllMutation.isPending}
              >
                {repairAllMutation.isPending ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Wrench className="h-4 w-4 mr-2" />
                )}
                Reparar todas
              </Button>
            </div>

            <div className="space-y-2 max-h-64 overflow-y-auto">
              {orphanRuleSets.map((rs) => (
                <div 
                  key={rs.id} 
                  className="flex items-center justify-between p-3 border rounded-lg bg-muted/30"
                >
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate">{rs.name}</p>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <span>{rs.company_name || 'Plantilla global'}</span>
                      <span>•</span>
                      <Badge variant="outline" className="text-xs">
                        {rs.status}
                      </Badge>
                      <span>•</span>
                      <span>
                        {format(new Date(rs.created_at), 'dd MMM yyyy', { locale: es })}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleRepair(rs.id)}
                      disabled={repairing === rs.id || repairMutation.isPending}
                    >
                      {repairing === rs.id ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Wrench className="h-4 w-4" />
                      )}
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="text-destructive hover:text-destructive"
                      onClick={() => deleteMutation.mutate(rs.id)}
                      disabled={deleteMutation.isPending}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </>
        ) : (
          <div className="flex items-center gap-3 py-4 text-green-600">
            <CheckCircle className="h-5 w-5" />
            <span className="text-sm font-medium">
              Todas las plantillas están correctamente configuradas
            </span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
