import { supabase } from '@/integrations/supabase/client';
import { Json } from '@/integrations/supabase/types';
import { PublishDraftTarget, TemplatePayload } from '@/types/templates';

export interface WizardPublishError extends Error {
  publishDraft?: PublishDraftTarget | null;
}

interface EnsureWizardDraftInput {
  companyId: string | null;
  payload: TemplatePayload;
  publishDraft: PublishDraftTarget | null;
}

interface DraftPublishStatus {
  publishedAt: string | null;
  ruleSetStatus: string | null;
}

function getRuleSetInput(payload: TemplatePayload) {
  return {
    name: payload.meta?.template_name || 'Nueva plantilla',
    description: `Creada con asistente - ${payload.meta?.convenio || 'Sin convenio'}`,
    sector: payload.meta?.sector,
    convenio: payload.meta?.convenio,
  };
}

export function createWizardPublishError(
  message: string,
  publishDraft: PublishDraftTarget | null = null,
): WizardPublishError {
  const error = new Error(message) as WizardPublishError;
  if (publishDraft) {
    error.publishDraft = publishDraft;
  }
  return error;
}

export async function getDraftPublishStatus(
  publishDraft: PublishDraftTarget | null,
): Promise<DraftPublishStatus | null> {
  if (!publishDraft) {
    return null;
  }

  const { data, error } = await supabase
    .from('rule_versions')
    .select('published_at, rule_sets!inner(status)')
    .eq('id', publishDraft.versionId)
    .maybeSingle();

  if (error) {
    throw error;
  }

  if (!data) {
    return null;
  }

  return {
    publishedAt: data.published_at,
    ruleSetStatus: Array.isArray(data.rule_sets)
      ? data.rule_sets[0]?.status ?? null
      : data.rule_sets?.status ?? null,
  };
}

export async function ensureWizardDraft({
  companyId,
  payload,
  publishDraft,
}: EnsureWizardDraftInput): Promise<PublishDraftTarget> {
  if (!companyId) {
    throw new Error('No hay empresa configurada');
  }

  const ruleSetInput = getRuleSetInput(payload);

  if (publishDraft) {
    const { error: ruleSetError } = await supabase
      .from('rule_sets')
      .update(ruleSetInput)
      .eq('id', publishDraft.ruleSetId);

    if (ruleSetError) {
      throw ruleSetError;
    }

    const { error: versionError } = await supabase
      .from('rule_versions')
      .update({
        payload_json: payload as unknown as Json,
      })
      .eq('id', publishDraft.versionId);

    if (versionError) {
      throw versionError;
    }

    return publishDraft;
  }

  const { data: ruleSet, error: ruleSetError } = await supabase
    .from('rule_sets')
    .insert({
      company_id: companyId,
      ...ruleSetInput,
      status: 'draft',
      is_template: false,
    })
    .select('id')
    .single();

  if (ruleSetError) {
    throw ruleSetError;
  }

  const { data: version, error: versionError } = await supabase
    .from('rule_versions')
    .insert({
      rule_set_id: ruleSet.id,
      version: '1.0.0',
      payload_json: payload as unknown as Json,
    })
    .select('id')
    .single();

  if (versionError) {
    await supabase.from('rule_sets').delete().eq('id', ruleSet.id);
    throw new Error(`Error al crear versión inicial: ${versionError.message}. Verifica los permisos de usuario.`);
  }

  return {
    ruleSetId: ruleSet.id,
    versionId: version.id,
  };
}
