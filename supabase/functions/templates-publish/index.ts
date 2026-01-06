import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

async function hashPayload(payload: object): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(JSON.stringify(payload, Object.keys(payload).sort()));
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "No authorization header" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get user from token
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: userError } = await supabase.auth.getUser(token);
    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Invalid token" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { rule_version_id, effective_from } = await req.json();

    if (!rule_version_id) {
      return new Response(JSON.stringify({ error: "rule_version_id is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Fetch the version with its rule set
    const { data: version, error: versionError } = await supabase
      .from('rule_versions')
      .select(`
        *,
        rule_sets!inner (
          id,
          company_id,
          status,
          name
        )
      `)
      .eq('id', rule_version_id)
      .single();

    if (versionError || !version) {
      return new Response(JSON.stringify({ error: "Version not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const ruleSet = version.rule_sets as { id: string; company_id: string | null; status: string; name: string };

    // Check rule set is in draft status
    if (ruleSet.status !== 'draft' && ruleSet.status !== 'validating') {
      return new Response(JSON.stringify({ 
        error: "Solo se pueden publicar versiones de conjuntos en estado borrador o validando" 
      }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Validate the template before publishing
    const validateResponse = await fetch(`${supabaseUrl}/functions/v1/templates-validate`, {
      method: 'POST',
      headers: {
        'Authorization': authHeader,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ rule_version_id }),
    });

    const validationResult = await validateResponse.json();
    
    if (!validationResult.valid) {
      return new Response(JSON.stringify({ 
        error: "La plantilla tiene errores de validación que impiden su publicación",
        validation_errors: validationResult.errors
      }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Calculate payload hash
    const payloadHash = await hashPayload(version.payload_json);

    // Update version with hash and publish info
    const { error: updateVersionError } = await supabase
      .from('rule_versions')
      .update({
        payload_hash: payloadHash,
        published_at: new Date().toISOString(),
        published_by: user.id,
        effective_from: effective_from || new Date().toISOString().split('T')[0],
      })
      .eq('id', rule_version_id);

    if (updateVersionError) {
      throw updateVersionError;
    }

    // Update rule set status to published
    const { error: updateSetError } = await supabase
      .from('rule_sets')
      .update({ status: 'published' })
      .eq('id', ruleSet.id);

    if (updateSetError) {
      throw updateSetError;
    }

    // Log in audit
    await supabase.from('audit_log').insert({
      actor_id: user.id,
      actor_type: 'user',
      entity_type: 'rule_version',
      entity_id: rule_version_id,
      action: 'template_published',
      company_id: ruleSet.company_id,
      new_values: {
        payload_hash: payloadHash,
        effective_from: effective_from || new Date().toISOString().split('T')[0],
        rule_set_name: ruleSet.name,
      }
    });

    return new Response(
      JSON.stringify({
        success: true,
        payload_hash: payloadHash,
        published_at: new Date().toISOString(),
        warnings: validationResult.warnings || [],
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (err) {
    const error = err as Error;
    console.error("Error publishing template:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
