import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface SyncTemplateLeavesRequest {
  company_id: string;
  rule_version_id: string;
}

// Catálogo base de tipos de ausencia según normativa española
const defaultAbsenceTypes = {
  'VACACIONES': {
    name: 'Vacaciones anuales',
    category: 'vacaciones',
    compute_on: 'dias_naturales',
    is_paid: true,
    requires_approval: true,
    requires_justification: false,
    blocks_clocking: true,
    half_day_allowed: true,
    advance_notice_days: 15,
    legal_origin: 'ley',
    description: 'Vacaciones anuales retribuidas (Art. 38 ET)'
  },
  'MATRIMONIO': {
    name: 'Permiso por matrimonio',
    category: 'permiso_retribuido',
    compute_on: 'dias_naturales',
    duration_value: 15,
    duration_unit: 'days',
    is_paid: true,
    requires_approval: true,
    requires_justification: true,
    blocks_clocking: true,
    legal_origin: 'ley',
    description: 'Permiso por matrimonio o registro de pareja de hecho (Art. 37.3.a ET)'
  },
  'NACIMIENTO': {
    name: 'Permiso por nacimiento de hijo',
    category: 'suspension',
    compute_on: 'dias_naturales',
    duration_value: 16,
    duration_unit: 'weeks',
    is_paid: true,
    requires_approval: false,
    requires_justification: true,
    blocks_clocking: true,
    legal_origin: 'ley',
    description: 'Suspensión por nacimiento y cuidado del menor (Art. 48.4 ET)'
  },
  'FALLECIMIENTO_1': {
    name: 'Permiso por fallecimiento (1er grado)',
    category: 'permiso_retribuido',
    compute_on: 'dias_naturales',
    duration_value: 3,
    duration_unit: 'days',
    is_paid: true,
    requires_approval: true,
    requires_justification: true,
    blocks_clocking: true,
    extra_travel_days: 2,
    travel_threshold_km: 200,
    legal_origin: 'ley',
    description: 'Permiso por fallecimiento de familiar de primer grado (Art. 37.3.b ET)'
  },
  'FALLECIMIENTO_2': {
    name: 'Permiso por fallecimiento (2º grado)',
    category: 'permiso_retribuido',
    compute_on: 'dias_naturales',
    duration_value: 2,
    duration_unit: 'days',
    is_paid: true,
    requires_approval: true,
    requires_justification: true,
    blocks_clocking: true,
    extra_travel_days: 2,
    travel_threshold_km: 200,
    legal_origin: 'ley',
    description: 'Permiso por fallecimiento de familiar de segundo grado (Art. 37.3.b ET)'
  },
  'HOSPITALIZACION': {
    name: 'Permiso por hospitalización familiar',
    category: 'permiso_retribuido',
    compute_on: 'dias_naturales',
    duration_value: 3,
    duration_unit: 'days',
    is_paid: true,
    requires_approval: true,
    requires_justification: true,
    blocks_clocking: true,
    extra_travel_days: 2,
    travel_threshold_km: 200,
    legal_origin: 'ley',
    description: 'Permiso por hospitalización o intervención de familiar (Art. 37.3.b ET)'
  },
  'MUDANZA': {
    name: 'Permiso por mudanza',
    category: 'permiso_retribuido',
    compute_on: 'dias_laborables',
    duration_value: 1,
    duration_unit: 'days',
    is_paid: true,
    requires_approval: true,
    requires_justification: true,
    blocks_clocking: true,
    legal_origin: 'ley',
    description: 'Permiso por traslado de domicilio habitual (Art. 37.3.c ET)'
  },
  'DEBER_INEXCUSABLE': {
    name: 'Deber inexcusable público/personal',
    category: 'permiso_retribuido',
    compute_on: 'horas',
    is_paid: true,
    requires_approval: true,
    requires_justification: true,
    blocks_clocking: false,
    legal_origin: 'ley',
    description: 'Cumplimiento de deber inexcusable de carácter público y personal (Art. 37.3.d ET)'
  },
  'EXAMEN_PRENATAL': {
    name: 'Exámenes prenatales',
    category: 'permiso_retribuido',
    compute_on: 'horas',
    is_paid: true,
    requires_approval: true,
    requires_justification: true,
    blocks_clocking: false,
    legal_origin: 'ley',
    description: 'Exámenes prenatales y técnicas de preparación al parto (Art. 37.3.f ET)'
  },
  'LACTANCIA': {
    name: 'Permiso de lactancia',
    category: 'permiso_retribuido',
    compute_on: 'horas',
    duration_value: 1,
    duration_unit: 'hours',
    is_paid: true,
    requires_approval: true,
    requires_justification: false,
    blocks_clocking: false,
    legal_origin: 'ley',
    description: 'Lactancia de menor de nueve meses (Art. 37.4 ET)'
  },
  'IT': {
    name: 'Incapacidad temporal',
    category: 'suspension',
    compute_on: 'dias_naturales',
    is_paid: true,
    requires_approval: false,
    requires_justification: true,
    blocks_clocking: true,
    legal_origin: 'ley',
    description: 'Incapacidad temporal por enfermedad o accidente'
  },
  'FORMACION': {
    name: 'Permiso de formación',
    category: 'permiso_retribuido',
    compute_on: 'horas',
    max_days_per_year: 20,
    is_paid: true,
    requires_approval: true,
    requires_justification: true,
    blocks_clocking: false,
    legal_origin: 'ley',
    description: 'Formación vinculada a la actividad empresarial (Art. 23 ET)'
  },
  'ASUNTOS_PROPIOS': {
    name: 'Asuntos propios',
    category: 'permiso_no_retribuido',
    compute_on: 'dias_laborables',
    is_paid: false,
    requires_approval: true,
    requires_justification: false,
    blocks_clocking: true,
    advance_notice_days: 3,
    legal_origin: 'convenio',
    description: 'Días de asuntos propios según convenio colectivo'
  },
  'CONSULTA_MEDICA': {
    name: 'Consulta médica',
    category: 'permiso_retribuido',
    compute_on: 'horas',
    is_paid: true,
    requires_approval: true,
    requires_justification: true,
    blocks_clocking: false,
    legal_origin: 'convenio',
    description: 'Asistencia a consulta médica'
  },
  'REPRESENTACION_SINDICAL': {
    name: 'Representación sindical',
    category: 'representacion',
    compute_on: 'horas',
    is_paid: true,
    requires_approval: true,
    requires_justification: true,
    blocks_clocking: false,
    legal_origin: 'ley',
    description: 'Crédito horario para representantes sindicales (Art. 68 ET)'
  }
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const body: SyncTemplateLeavesRequest = await req.json();
    const { company_id, rule_version_id } = body;

    console.log(`[sync-template-leaves] Syncing for company ${company_id}, rule ${rule_version_id}`);

    // 1. Obtener la plantilla de reglas
    const { data: ruleVersion, error: ruleError } = await supabase
      .from('rule_versions')
      .select('id, draft_json, published_json')
      .eq('id', rule_version_id)
      .single();

    if (ruleError) {
      console.error('[sync-template-leaves] Rule not found:', ruleError);
      throw new Error('Plantilla de reglas no encontrada');
    }

    // Usar published_json si existe, sino draft_json
    const ruleData = ruleVersion.published_json || ruleVersion.draft_json || {};
    const leavesCatalog = (ruleData as any).leaves_catalog || [];

    console.log(`[sync-template-leaves] Found ${leavesCatalog.length} leave types in template`);

    // 2. Obtener tipos de ausencia existentes
    const { data: existingTypes } = await supabase
      .from('absence_types')
      .select('id, code')
      .eq('company_id', company_id);

    const existingCodes = new Set((existingTypes || []).map(t => t.code));

    const typesCreated: string[] = [];
    const typesUpdated: string[] = [];
    const mapping: { template_code: string; absence_type_code: string }[] = [];

    // 3. Procesar cada tipo del catálogo de la plantilla
    for (const leave of leavesCatalog) {
      const code = leave.code || leave.id;
      const defaultType = defaultAbsenceTypes[code as keyof typeof defaultAbsenceTypes];

      const typeData = {
        company_id,
        code,
        name: leave.name || defaultType?.name || code,
        category: leave.category || defaultType?.category || 'otros',
        compute_on: leave.compute_on || defaultType?.compute_on || 'dias_naturales',
        duration_value: leave.duration_value || defaultType?.duration_value,
        duration_unit: leave.duration_unit || defaultType?.duration_unit,
        is_paid: leave.is_paid ?? defaultType?.is_paid ?? true,
        requires_approval: leave.requires_approval ?? defaultType?.requires_approval ?? true,
        requires_justification: leave.requires_justification ?? defaultType?.requires_justification ?? false,
        blocks_clocking: leave.blocks_clocking ?? defaultType?.blocks_clocking ?? true,
        half_day_allowed: leave.half_day_allowed ?? defaultType?.half_day_allowed ?? false,
        advance_notice_days: leave.advance_notice_days || defaultType?.advance_notice_days,
        extra_travel_days: leave.extra_travel_days || defaultType?.extra_travel_days,
        travel_threshold_km: leave.travel_threshold_km || defaultType?.travel_threshold_km,
        max_days_per_year: leave.max_days_per_year || defaultType?.max_days_per_year,
        legal_origin: leave.legal_origin || defaultType?.legal_origin || 'empresa',
        description: leave.description || defaultType?.description,
        is_active: true,
        updated_at: new Date().toISOString()
      };

      if (existingCodes.has(code)) {
        // Actualizar existente
        const { error: updateError } = await supabase
          .from('absence_types')
          .update(typeData)
          .eq('company_id', company_id)
          .eq('code', code);

        if (!updateError) {
          typesUpdated.push(code);
        }
      } else {
        // Crear nuevo
        const { error: insertError } = await supabase
          .from('absence_types')
          .insert(typeData);

        if (!insertError) {
          typesCreated.push(code);
        }
      }

      mapping.push({ template_code: code, absence_type_code: code });
    }

    // 4. Si no hay catálogo en la plantilla, usar defaults
    if (leavesCatalog.length === 0) {
      console.log('[sync-template-leaves] No catalog in template, using defaults');
      
      for (const [code, defaultType] of Object.entries(defaultAbsenceTypes)) {
        if (!existingCodes.has(code)) {
          const { error: insertError } = await supabase
            .from('absence_types')
            .insert({
              company_id,
              code,
              ...defaultType,
              is_active: true,
              updated_at: new Date().toISOString()
            });

          if (!insertError) {
            typesCreated.push(code);
          }
        }
        mapping.push({ template_code: code, absence_type_code: code });
      }
    }

    // 5. Registrar el mapeo
    await supabase.from('template_absence_links').insert({
      rule_version_id,
      company_id,
      mapping,
      applied_at: new Date().toISOString()
    });

    // 6. Registrar en audit_log
    await supabase.from('audit_log').insert({
      actor_type: 'system',
      action: 'sync_template_leaves',
      entity_type: 'absence_types',
      company_id,
      new_values: {
        rule_version_id,
        types_created: typesCreated,
        types_updated: typesUpdated
      }
    });

    console.log(`[sync-template-leaves] Completed. Created: ${typesCreated.length}, Updated: ${typesUpdated.length}`);

    return new Response(JSON.stringify({
      success: true,
      types_created: typesCreated,
      types_updated: typesUpdated,
      mapping
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200
    });

  } catch (error) {
    console.error('[sync-template-leaves] Error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});
