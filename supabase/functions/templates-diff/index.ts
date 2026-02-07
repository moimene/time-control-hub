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

interface DiffItem {
  path: string;
  type: 'added' | 'removed' | 'changed';
  oldValue?: unknown;
  newValue?: unknown;
}

function deepDiff(obj1: unknown, obj2: unknown, path = ''): DiffItem[] {
  const diffs: DiffItem[] = [];

  if (obj1 === obj2) return diffs;

  if (typeof obj1 !== typeof obj2) {
    diffs.push({ path, type: 'changed', oldValue: obj1, newValue: obj2 });
    return diffs;
  }

  if (typeof obj1 !== 'object' || obj1 === null || obj2 === null) {
    if (obj1 !== obj2) {
      diffs.push({ path, type: 'changed', oldValue: obj1, newValue: obj2 });
    }
    return diffs;
  }

  if (Array.isArray(obj1) && Array.isArray(obj2)) {
    const maxLen = Math.max(obj1.length, obj2.length);
    for (let i = 0; i < maxLen; i++) {
      const newPath = path ? `${path}[${i}]` : `[${i}]`;
      if (i >= obj1.length) {
        diffs.push({ path: newPath, type: 'added', newValue: obj2[i] });
      } else if (i >= obj2.length) {
        diffs.push({ path: newPath, type: 'removed', oldValue: obj1[i] });
      } else {
        diffs.push(...deepDiff(obj1[i], obj2[i], newPath));
      }
    }
    return diffs;
  }

  const allKeys = new Set([...Object.keys(obj1 as object), ...Object.keys(obj2 as object)]);

  for (const key of allKeys) {
    const newPath = path ? `${path}.${key}` : key;
    const val1 = (obj1 as Record<string, unknown>)[key];
    const val2 = (obj2 as Record<string, unknown>)[key];

    if (!(key in (obj1 as object))) {
      diffs.push({ path: newPath, type: 'added', newValue: val2 });
    } else if (!(key in (obj2 as object))) {
      diffs.push({ path: newPath, type: 'removed', oldValue: val1 });
    } else {
      diffs.push(...deepDiff(val1, val2, newPath));
    }
  }

  return diffs;
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

    const { version_id_a, version_id_b } = await req.json();

    if (!version_id_a || !version_id_b) {
      return jsonResponse({ error: "Both version_id_a and version_id_b are required" }, 400, corsHeaders);
    }

    // Fetch both versions
    const { data: versionA, error: errorA } = await supabase
      .from('rule_versions')
      .select('id, version, payload_json, created_at, published_at, rule_sets!inner(company_id)')
      .eq('id', version_id_a)
      .single();

    const { data: versionB, error: errorB } = await supabase
      .from('rule_versions')
      .select('id, version, payload_json, created_at, published_at, rule_sets!inner(company_id)')
      .eq('id', version_id_b)
      .single();

    if (errorA || !versionA) {
      return new Response(JSON.stringify({ error: `Version A not found: ${version_id_a}` }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (errorB || !versionB) {
      return new Response(JSON.stringify({ error: `Version B not found: ${version_id_b}` }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const companyIdA = (versionA as any).rule_sets?.company_id as string | undefined;
    const companyIdB = (versionB as any).rule_sets?.company_id as string | undefined;

    if (!companyIdA || !companyIdB || companyIdA !== companyIdB) {
      return jsonResponse({ error: 'Versions must belong to the same company' }, 400, corsHeaders);
    }

    const companyAccess = await requireCompanyAccess({
      supabaseAdmin: supabase,
      ctx: caller,
      companyId: companyIdA,
      corsHeaders,
      allowEmployee: true,
    });
    if (companyAccess instanceof Response) return companyAccess;

    const differences = deepDiff(versionA.payload_json, versionB.payload_json);

    // Categorize differences
    const categorized = {
      limits: differences.filter(d => d.path.startsWith('limits')),
      breaks: differences.filter(d => d.path.startsWith('breaks')),
      leaves_catalog: differences.filter(d => d.path.startsWith('leaves_catalog')),
      overtime: differences.filter(d => d.path.startsWith('overtime')),
      meta: differences.filter(d => d.path.startsWith('meta')),
      other: differences.filter(d => 
        !d.path.startsWith('limits') && 
        !d.path.startsWith('breaks') && 
        !d.path.startsWith('leaves_catalog') && 
        !d.path.startsWith('overtime') && 
        !d.path.startsWith('meta')
      ),
    };

    return new Response(
      JSON.stringify({
        version_a: {
          id: versionA.id,
          version: versionA.version,
          created_at: versionA.created_at,
          published_at: versionA.published_at,
        },
        version_b: {
          id: versionB.id,
          version: versionB.version,
          created_at: versionB.created_at,
          published_at: versionB.published_at,
        },
        total_differences: differences.length,
        differences,
        categorized,
        summary: {
          added: differences.filter(d => d.type === 'added').length,
          removed: differences.filter(d => d.type === 'removed').length,
          changed: differences.filter(d => d.type === 'changed').length,
        }
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (err) {
    const error = err as Error;
    console.error("Error diffing templates:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
