import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  jsonResponse,
  requireAnyRole,
  requireCallerContext,
  requireCompanyAccess,
} from "../_shared/auth.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Legal minimums that cannot be violated (Spanish Labor Law)
const LEGAL_MINIMUMS = {
  min_daily_rest: 12, // hours
  max_daily_hours: 12, // absolute max
  min_weekly_rest: 36, // hours
  max_overtime_yearly: 80, // hours
  max_weekly_hours: 40, // standard week
  break_after_hours: 6, // must have break after 6h
  min_break_minutes: 15, // minimum break duration
};

interface ValidationError {
  field: string;
  message: string;
  severity: 'error' | 'warning';
  legal_reference?: string;
}

interface TemplatePayload {
  meta?: {
    sector?: string;
    convenio?: string;
    vigencia?: string;
  };
  limits?: {
    max_daily_hours?: number;
    min_daily_rest?: number;
    min_weekly_rest?: number;
    max_overtime_yearly?: number;
    max_weekly_hours?: number;
  };
  breaks?: {
    required_after_hours?: number;
    min_break_minutes?: number;
  };
  leaves_catalog?: Array<{
    type: string;
    days: number;
    paid: boolean;
    proof_required: boolean;
  }>;
  overtime?: {
    thresholds?: Array<{
      percent: number;
      severity: string;
    }>;
  };
}

function validateTemplate(payload: TemplatePayload): ValidationError[] {
  const errors: ValidationError[] = [];

  // Validate limits
  if (payload.limits) {
    const { limits } = payload;

    // min_daily_rest must be >= 12 hours
    if (limits.min_daily_rest !== undefined && limits.min_daily_rest < LEGAL_MINIMUMS.min_daily_rest) {
      errors.push({
        field: 'limits.min_daily_rest',
        message: `El descanso diario mínimo no puede ser inferior a ${LEGAL_MINIMUMS.min_daily_rest} horas (Ley)`,
        severity: 'error',
        legal_reference: 'Art. 34.3 ET'
      });
    }

    // max_daily_hours must be <= 12 hours (absolute legal max)
    if (limits.max_daily_hours !== undefined && limits.max_daily_hours > LEGAL_MINIMUMS.max_daily_hours) {
      errors.push({
        field: 'limits.max_daily_hours',
        message: `La jornada máxima diaria no puede exceder ${LEGAL_MINIMUMS.max_daily_hours} horas (Ley)`,
        severity: 'error',
        legal_reference: 'Art. 34.3 ET'
      });
    }

    // Warning if max_daily_hours > 9 (standard is 9, but up to 10 can be allowed by convenio)
    if (limits.max_daily_hours !== undefined && limits.max_daily_hours > 9 && limits.max_daily_hours <= 10) {
      errors.push({
        field: 'limits.max_daily_hours',
        message: 'Jornadas superiores a 9 horas requieren justificación por convenio colectivo',
        severity: 'warning',
        legal_reference: 'Art. 34.3 ET'
      });
    }

    // min_weekly_rest must be >= 36 hours
    if (limits.min_weekly_rest !== undefined && limits.min_weekly_rest < LEGAL_MINIMUMS.min_weekly_rest) {
      errors.push({
        field: 'limits.min_weekly_rest',
        message: `El descanso semanal mínimo no puede ser inferior a ${LEGAL_MINIMUMS.min_weekly_rest} horas (Ley)`,
        severity: 'error',
        legal_reference: 'Art. 37.1 ET'
      });
    }

    // max_overtime_yearly must be <= 80 hours
    if (limits.max_overtime_yearly !== undefined && limits.max_overtime_yearly > LEGAL_MINIMUMS.max_overtime_yearly) {
      errors.push({
        field: 'limits.max_overtime_yearly',
        message: `El máximo de horas extra anuales no puede exceder ${LEGAL_MINIMUMS.max_overtime_yearly} horas (Ley)`,
        severity: 'error',
        legal_reference: 'Art. 35.2 ET'
      });
    }
  }

  // Validate breaks
  if (payload.breaks) {
    const { breaks } = payload;

    // break must be required after <= 6 hours
    if (breaks.required_after_hours !== undefined && breaks.required_after_hours > LEGAL_MINIMUMS.break_after_hours) {
      errors.push({
        field: 'breaks.required_after_hours',
        message: `La pausa es obligatoria después de ${LEGAL_MINIMUMS.break_after_hours} horas de trabajo continuado`,
        severity: 'error',
        legal_reference: 'Art. 34.4 ET'
      });
    }

    // min break must be >= 15 minutes
    if (breaks.min_break_minutes !== undefined && breaks.min_break_minutes < LEGAL_MINIMUMS.min_break_minutes) {
      errors.push({
        field: 'breaks.min_break_minutes',
        message: `La pausa mínima no puede ser inferior a ${LEGAL_MINIMUMS.min_break_minutes} minutos`,
        severity: 'error',
        legal_reference: 'Art. 34.4 ET'
      });
    }
  }

  // Validate leaves catalog
  if (payload.leaves_catalog) {
    const requiredLeaves: Record<string, number> = {
      marriage: 15,
      birth: 5,
      death_close: 2,
      moving: 1,
    };

    for (const leave of payload.leaves_catalog) {
      const minDays = requiredLeaves[leave.type];
      if (minDays !== undefined && leave.days < minDays) {
        errors.push({
          field: `leaves_catalog.${leave.type}`,
          message: `El permiso de ${leave.type} debe ser de al menos ${minDays} días según ley`,
          severity: 'error',
          legal_reference: 'Art. 37.3 ET'
        });
      }
    }
  }

  // Validate overtime thresholds
  if (payload.overtime?.thresholds) {
    const thresholds = payload.overtime.thresholds;
    const hasWarning = thresholds.some(t => t.severity === 'warn' && t.percent <= 90);
    const hasCritical = thresholds.some(t => t.severity === 'critical' && t.percent <= 100);

    if (!hasWarning) {
      errors.push({
        field: 'overtime.thresholds',
        message: 'Se recomienda configurar un umbral de advertencia antes del 90% de horas extra',
        severity: 'warning'
      });
    }

    if (!hasCritical) {
      errors.push({
        field: 'overtime.thresholds',
        message: 'Se recomienda configurar un umbral crítico al alcanzar el límite de horas extra',
        severity: 'warning'
      });
    }
  }

  return errors;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const caller = await requireCallerContext({ req, supabaseAdmin: supabase, corsHeaders });
    if (caller instanceof Response) return caller;
    if (caller.kind !== 'user') {
      return jsonResponse({ error: 'Unauthorized caller' }, 401, corsHeaders);
    }
    const roleError = requireAnyRole({
      ctx: caller,
      allowed: ['super_admin', 'admin', 'responsible'],
      corsHeaders,
    });
    if (roleError) return roleError;

    const { payload, rule_version_id } = await req.json();

    let templatePayload: TemplatePayload;

    // If rule_version_id provided, fetch the payload
    if (rule_version_id) {
      const { data: version, error } = await supabase
        .from('rule_versions')
        .select('payload_json, rule_sets!inner(company_id)')
        .eq('id', rule_version_id)
        .single();

      if (error || !version) {
        return new Response(JSON.stringify({ error: "Version not found" }), {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const companyId = (version as any).rule_sets?.company_id as string | undefined;
      if (companyId && !caller.isSuperAdmin) {
        const companyAccess = await requireCompanyAccess({
          supabaseAdmin: supabase,
          ctx: caller,
          companyId,
          corsHeaders,
          allowEmployee: true,
        });
        if (companyAccess instanceof Response) return companyAccess;
      }

      templatePayload = version.payload_json as TemplatePayload;
    } else if (payload) {
      templatePayload = payload;
    } else {
      return new Response(JSON.stringify({ error: "No payload or rule_version_id provided" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const errors = validateTemplate(templatePayload);
    const hasErrors = errors.some(e => e.severity === 'error');

    return new Response(
      JSON.stringify({
        valid: !hasErrors,
        errors: errors.filter(e => e.severity === 'error'),
        warnings: errors.filter(e => e.severity === 'warning'),
        summary: {
          total_issues: errors.length,
          blocking_errors: errors.filter(e => e.severity === 'error').length,
          warnings: errors.filter(e => e.severity === 'warning').length,
        }
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (err) {
    const error = err as Error;
    console.error("Error validating template:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
