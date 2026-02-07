import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { requireAnyRole, requireCallerContext } from "../_shared/auth.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const ALERTS_ENABLED_KEY = "qtsp_alerts_enabled";

serve(async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const caller = await requireCallerContext({
      req,
      supabaseAdmin: supabase,
      corsHeaders,
      allowServiceRole: true,
    });
    if (caller instanceof Response) return caller;
    if (caller.kind === 'user') {
      const roleError = requireAnyRole({ ctx: caller, allowed: ['super_admin'], corsHeaders });
      if (roleError) return roleError;
    }

    const { action } = await req.json();

    if (action === 'get') {
      // Get current alerts enabled state
      const { data } = await supabase
        .from('qtsp_audit_log')
        .select('response_payload')
        .eq('action', `state_${ALERTS_ENABLED_KEY}`)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      
      const payload = data?.response_payload as { value?: string } | null;
      const enabled = payload?.value !== 'false';

      return new Response(
        JSON.stringify({ enabled }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (action === 'toggle') {
      // Get current state
      const { data: currentData } = await supabase
        .from('qtsp_audit_log')
        .select('response_payload')
        .eq('action', `state_${ALERTS_ENABLED_KEY}`)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      
      const currentPayload = currentData?.response_payload as { value?: string } | null;
      const currentEnabled = currentPayload?.value !== 'false';
      const newEnabled = !currentEnabled;

      // Save new state
      await supabase.from('qtsp_audit_log').insert({
        action: `state_${ALERTS_ENABLED_KEY}`,
        status: 'info',
        response_payload: { value: newEnabled.toString() },
      });

      // Log the action
      await supabase.from('qtsp_audit_log').insert({
        action: 'alerts_toggle',
        status: 'success',
        response_payload: { 
          alerts_enabled: newEnabled,
          toggled_at: new Date().toISOString(),
        },
      });

      console.log(`Email alerts ${newEnabled ? 'enabled' : 'disabled'}`);

      return new Response(
        JSON.stringify({ enabled: newEnabled, message: `Alertas por email ${newEnabled ? 'activadas' : 'desactivadas'}` }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ error: 'Invalid action. Use "get" or "toggle"' }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error: unknown) {
    console.error("Toggle alerts error:", error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
