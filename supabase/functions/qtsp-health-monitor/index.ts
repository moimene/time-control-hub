import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Use environment variable - same as qtsp-notarize function
const CONSECUTIVE_FAILURES_KEY = "qtsp_consecutive_failures";
const LAST_ALERT_SENT_KEY = "qtsp_last_alert_sent";
const WAS_UNHEALTHY_KEY = "qtsp_was_unhealthy";
const UNHEALTHY_SINCE_KEY = "qtsp_unhealthy_since";
const ALERTS_ENABLED_KEY = "qtsp_alerts_enabled";

interface HealthResult {
  status: 'healthy' | 'degraded' | 'unhealthy';
  latency_ms: number;
  message: string;
}

async function checkQTSPHealth(): Promise<HealthResult> {
  const startTime = Date.now();
  const apiUrl = Deno.env.get('DIGITALTRUST_API_URL') || 'https://api.pre.gcloudfactory.com';

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);

    // Use the same base URL as qtsp-notarize, checking the case-files endpoint
    const response = await fetch(`${apiUrl}/digital-trust/api/v1/private/case-files?limit=1`, {
      method: 'GET',
      signal: controller.signal,
      headers: {
        'Accept': 'application/json',
      },
    });

    clearTimeout(timeoutId);
    const latency = Date.now() - startTime;

    // 401/403/404 means API is reachable - that's healthy for connectivity check
    // 404 can happen when endpoint needs auth, but server responds
    if (response.ok || response.status === 401 || response.status === 403 || response.status === 404) {
      return {
        status: latency > 3000 ? 'degraded' : 'healthy',
        latency_ms: latency,
        message: latency > 3000 ? 'Respuesta lenta del servicio' : 'Servicio operativo',
      };
    }

    return {
      status: 'unhealthy',
      latency_ms: latency,
      message: `HTTP ${response.status}: ${response.statusText}`,
    };
  } catch (error: unknown) {
    const latency = Date.now() - startTime;
    const errorMessage = error instanceof Error ? error.message : 'Error desconocido';

    return {
      status: 'unhealthy',
      latency_ms: latency,
      message: error instanceof Error && error.name === 'AbortError'
        ? 'Timeout: El servicio no respondió en 10 segundos'
        : `Error de conexión: ${errorMessage}`,
    };
  }
}

// Simple key-value store using qtsp_audit_log to track state
async function getState(supabase: any, key: string): Promise<string | null> {
  const { data } = await supabase
    .from('qtsp_audit_log')
    .select('response_payload')
    .eq('action', `state_${key}`)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  const payload = data?.response_payload as { value?: string } | null;
  return payload?.value ?? null;
}

async function setState(supabase: any, key: string, value: string): Promise<void> {
  await supabase.from('qtsp_audit_log').insert({
    action: `state_${key}`,
    status: 'info',
    response_payload: { value },
  });
}

serve(async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const startTime = Date.now();

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    console.log("Starting QTSP health check...");

    // Check QTSP health
    const healthResult = await checkQTSPHealth();
    console.log(`Health check result: ${healthResult.status} - ${healthResult.message} (${healthResult.latency_ms}ms)`);

    // Get current state
    const consecutiveFailuresStr = await getState(supabase, CONSECUTIVE_FAILURES_KEY);
    const wasUnhealthyStr = await getState(supabase, WAS_UNHEALTHY_KEY);
    const unhealthySinceStr = await getState(supabase, UNHEALTHY_SINCE_KEY);
    const alertsEnabledStr = await getState(supabase, ALERTS_ENABLED_KEY);

    let consecutiveFailures = parseInt(consecutiveFailuresStr || '0', 10);
    const wasUnhealthy = wasUnhealthyStr === 'true';
    const alertsEnabled = alertsEnabledStr !== 'false'; // Default to enabled
    const unhealthySince = unhealthySinceStr ? new Date(unhealthySinceStr) : null;

    // Update consecutive failures count
    if (healthResult.status === 'unhealthy' || healthResult.status === 'degraded') {
      consecutiveFailures++;

      // Track when system became unhealthy
      if (!wasUnhealthy) {
        await setState(supabase, WAS_UNHEALTHY_KEY, 'true');
        await setState(supabase, UNHEALTHY_SINCE_KEY, new Date().toISOString());
      }
    } else {
      // System is healthy now
      if (wasUnhealthy && consecutiveFailures >= 10 && alertsEnabled) {
        // System recovered after significant downtime - send recovery alert
        const downtimeMinutes = unhealthySince
          ? Math.round((Date.now() - unhealthySince.getTime()) / 60000)
          : Math.round(consecutiveFailures * 0.5);

        console.log(`System recovered after ${downtimeMinutes} minutes of downtime. Sending recovery alert...`);

        try {
          const alertResponse = await supabase.functions.invoke('qtsp-health-alert', {
            body: {
              status: 'healthy',
              message: 'Sistema recuperado',
              latency_ms: healthResult.latency_ms,
              timestamp: new Date().toISOString(),
              consecutive_failures: consecutiveFailures,
              alert_type: 'recovery',
              downtime_minutes: downtimeMinutes,
            },
          });

          console.log("Recovery alert response:", alertResponse.data);
        } catch (alertError) {
          console.error("Failed to send recovery alert:", alertError);
        }
      } else if (wasUnhealthy && consecutiveFailures >= 10 && !alertsEnabled) {
        console.log("Recovery detected but email alerts are disabled");
      }

      // Reset state
      consecutiveFailures = 0;
      await setState(supabase, WAS_UNHEALTHY_KEY, 'false');
    }

    // Save updated failure count
    await setState(supabase, CONSECUTIVE_FAILURES_KEY, consecutiveFailures.toString());

    // Check if we need to send failure alert (10 consecutive failures = ~10 min at 1min intervals)
    if (consecutiveFailures === 10) {
      if (alertsEnabled) {
        console.log("Reached 10 consecutive failures. Sending alert...");

        try {
          const alertResponse = await supabase.functions.invoke('qtsp-health-alert', {
            body: {
              status: healthResult.status,
              message: healthResult.message,
              latency_ms: healthResult.latency_ms,
              timestamp: new Date().toISOString(),
              consecutive_failures: consecutiveFailures,
              alert_type: 'failure',
            },
          });

          console.log("Alert response:", alertResponse.data);
        } catch (alertError) {
          console.error("Failed to send alert:", alertError);
        }
      } else {
        console.log("Reached 10 consecutive failures but email alerts are disabled");
      }
    }

    // Log health check to audit log
    await supabase.from('qtsp_audit_log').insert({
      action: 'health_check_auto',
      status: healthResult.status === 'healthy' ? 'success' : healthResult.status === 'degraded' ? 'warning' : 'error',
      duration_ms: Date.now() - startTime,
      request_payload: {
        check_type: 'automatic',
        alerts_enabled: alertsEnabled,
      },
      response_payload: {
        health_status: healthResult.status,
        latency_ms: healthResult.latency_ms,
        message: healthResult.message,
        consecutive_failures: consecutiveFailures,
        alerts_enabled: alertsEnabled,
      },
    });

    return new Response(
      JSON.stringify({
        success: true,
        health: healthResult,
        consecutive_failures: consecutiveFailures,
        duration_ms: Date.now() - startTime,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error: unknown) {
    console.error("Health monitor error:", error);
    const errorMessage = error instanceof Error ? error.message : String(error);

    return new Response(
      JSON.stringify({
        success: false,
        error: errorMessage,
        duration_ms: Date.now() - startTime,
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
