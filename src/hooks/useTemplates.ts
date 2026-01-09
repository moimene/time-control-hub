import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useCompany } from './useCompany';
import { 
  RuleSetWithVersions, 
  TemplatePayload,
  ValidationResult,
  SimulationResult,
  DiffResult 
} from '@/types/templates';
import { toast } from 'sonner';
import { Json } from '@/integrations/supabase/types';

export function useTemplates() {
  const { companyId } = useCompany();
  const queryClient = useQueryClient();

  // Fetch all rule sets (company's own + global templates)
  const { data: ruleSets, isLoading, refetch } = useQuery({
    queryKey: ['rule-sets', companyId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('rule_sets')
        .select(`
          *,
          rule_versions (*)
        `)
        .or(`company_id.eq.${companyId},and(is_template.eq.true,company_id.is.null)`)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data as RuleSetWithVersions[];
    },
    enabled: !!companyId,
  });

  // Create a new rule set
  const createRuleSet = useMutation({
    mutationFn: async (input: { 
      name: string; 
      description?: string; 
      sector?: string;
      convenio?: string;
      payload: TemplatePayload 
    }) => {
      // Create rule set
      const { data: ruleSet, error: ruleSetError } = await supabase
        .from('rule_sets')
        .insert({
          company_id: companyId,
          name: input.name,
          description: input.description,
          sector: input.sector,
          convenio: input.convenio,
          status: 'draft',
          is_template: false,
        })
        .select()
        .single();

      if (ruleSetError) throw ruleSetError;

      // Create initial version
      const { data: version, error: versionError } = await supabase
        .from('rule_versions')
        .insert({
          rule_set_id: ruleSet.id,
          version: '1.0.0',
          payload_json: input.payload as unknown as Json,
        })
        .select()
        .single();

      if (versionError) {
        // Rollback: eliminar el rule_set huérfano si falla la versión
        await supabase.from('rule_sets').delete().eq('id', ruleSet.id);
        throw new Error(`Error al crear versión inicial: ${versionError.message}. Verifica los permisos de usuario.`);
      }

      return { ruleSet, version };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['rule-sets'] });
      toast.success('Plantilla creada correctamente');
    },
    onError: (error) => {
      toast.error(`Error al crear plantilla: ${error.message}`);
    },
  });

  // Update rule set
  const updateRuleSet = useMutation({
    mutationFn: async (input: { 
      id: string;
      name?: string; 
      description?: string; 
      sector?: string;
      convenio?: string;
    }) => {
      const { id, ...updates } = input;
      const { data, error } = await supabase
        .from('rule_sets')
        .update(updates)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['rule-sets'] });
      toast.success('Plantilla actualizada');
    },
    onError: (error) => {
      toast.error(`Error al actualizar: ${error.message}`);
    },
  });

  // Save new version (draft)
  const saveVersion = useMutation({
    mutationFn: async (input: { 
      rule_set_id: string;
      version: string;
      payload: TemplatePayload 
    }) => {
      const { data, error } = await supabase
        .from('rule_versions')
        .insert({
          rule_set_id: input.rule_set_id,
          version: input.version,
          payload_json: input.payload as unknown as Json,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['rule-sets'] });
      toast.success('Versión guardada');
    },
    onError: (error) => {
      toast.error(`Error al guardar versión: ${error.message}`);
    },
  });

  // Update existing version payload
  const updateVersionPayload = useMutation({
    mutationFn: async (input: { 
      version_id: string;
      payload: TemplatePayload 
    }) => {
      const { data, error } = await supabase
        .from('rule_versions')
        .update({
          payload_json: input.payload as unknown as Json,
        })
        .eq('id', input.version_id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['rule-sets'] });
      toast.success('Cambios guardados');
    },
    onError: (error) => {
      toast.error(`Error al guardar: ${error.message}`);
    },
  });

  // Validate template
  const validateTemplate = async (payload: TemplatePayload): Promise<ValidationResult> => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) throw new Error('No session');

    const response = await supabase.functions.invoke('templates-validate', {
      body: { payload },
    });

    if (response.error) throw response.error;
    return response.data;
  };

  // Publish template
  const publishTemplate = useMutation({
    mutationFn: async (input: { rule_version_id: string; effective_from?: string }) => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('No session');

      const response = await supabase.functions.invoke('templates-publish', {
        body: input,
      });

      if (response.error) throw response.error;
      if (response.data.error) throw new Error(response.data.error);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['rule-sets'] });
      toast.success('Plantilla publicada correctamente');
    },
    onError: (error) => {
      toast.error(`Error al publicar: ${error.message}`);
    },
  });

  // Simulate template
  const simulateTemplate = async (rule_version_id: string, period_days = 30): Promise<SimulationResult> => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) throw new Error('No session');

    const response = await supabase.functions.invoke('templates-simulate', {
      body: { rule_version_id, company_id: companyId, period_days },
    });

    if (response.error) throw response.error;
    return response.data;
  };

  // Diff two versions
  const diffVersions = async (version_id_a: string, version_id_b: string): Promise<DiffResult> => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) throw new Error('No session');

    const response = await supabase.functions.invoke('templates-diff', {
      body: { version_id_a, version_id_b },
    });

    if (response.error) throw response.error;
    return response.data;
  };

  // Archive rule set
  const archiveRuleSet = useMutation({
    mutationFn: async (id: string) => {
      const { data, error } = await supabase
        .from('rule_sets')
        .update({ status: 'archived' })
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['rule-sets'] });
      toast.success('Plantilla archivada');
    },
    onError: (error) => {
      toast.error(`Error al archivar: ${error.message}`);
    },
  });

  return {
    ruleSets,
    isLoading,
    refetch,
    createRuleSet,
    updateRuleSet,
    saveVersion,
    updateVersionPayload,
    validateTemplate,
    publishTemplate,
    simulateTemplate,
    diffVersions,
    archiveRuleSet,
  };
}
