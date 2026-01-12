import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface BootstrapBody {
  company_id: string;
  autonomous_community?: string; // For autonomic holidays
  skip_absence_types?: boolean;
  skip_holidays?: boolean;
  skip_terminal?: boolean;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey, {
      auth: { autoRefreshToken: false, persistSession: false }
    });

    const body: BootstrapBody = await req.json();

    if (!body.company_id) {
      return new Response(JSON.stringify({ error: "company_id requerido" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const companyId = body.company_id;
    const autonomousCommunity = body.autonomous_community;
    const results: Record<string, { success: boolean; count?: number; error?: string }> = {};
    const currentYear = new Date().getFullYear();

    console.log(`[company-bootstrap] Starting bootstrap for company ${companyId}`);

    // 1. Seed default absence types
    if (!body.skip_absence_types) {
      try {
        const { error: absenceError } = await supabase.rpc("seed_default_absence_types", {
          p_company_id: companyId
        });

        if (absenceError) {
          console.error("[company-bootstrap] absence types error:", absenceError);
          results.absence_types = { success: false, error: absenceError.message };
        } else {
          const { count } = await supabase
            .from("absence_types")
            .select("*", { count: "exact", head: true })
            .eq("company_id", companyId);

          results.absence_types = { success: true, count: count || 0 };
          console.log(`[company-bootstrap] Seeded ${count} absence types`);
        }
      } catch (e) {
        console.error("[company-bootstrap] absence types exception:", e);
        results.absence_types = { success: false, error: String(e) };
      }
    }

    // 2. Seed default data retention config
    try {
      const { error: retentionError } = await supabase.rpc("seed_default_retention_config", {
        p_company_id: companyId
      });

      if (retentionError) {
        console.error("[company-bootstrap] retention config error:", retentionError);
        results.retention_config = { success: false, error: retentionError.message };
      } else {
        const { count } = await supabase
          .from("data_retention_config")
          .select("*", { count: "exact", head: true })
          .eq("company_id", companyId);

        results.retention_config = { success: true, count: count || 0 };
        console.log(`[company-bootstrap] Seeded ${count} retention configs`);
      }
    } catch (e) {
      console.error("[company-bootstrap] retention config exception:", e);
      results.retention_config = { success: false, error: String(e) };
    }

    // 3. Seed default rule sets (Cycle 2)
    try {
      const { data: ruleResult, error: ruleError } = await supabase.rpc("seed_default_rule_sets", {
        p_company_id: companyId
      });

      if (ruleError) {
        console.error("[company-bootstrap] rule sets error:", ruleError);
        results.rule_sets = { success: false, error: ruleError.message };
      } else {
        results.rule_sets = ruleResult;
        console.log(`[company-bootstrap] Seeded rule sets for sector: ${ruleResult.sector}`);
      }
    } catch (e) {
      console.error("[company-bootstrap] rule sets exception:", e);
      results.rule_sets = { success: false, error: String(e) };
    }

    // 4. Copy national holidays from global table
    if (!body.skip_holidays) {
      try {
        // Get national holidays for current year
        const { data: nationalHolidays, error: fetchError } = await supabase
          .from("national_holidays")
          .select("*")
          .eq("year", currentYear);

        if (fetchError) {
          console.error("[company-bootstrap] fetch national holidays error:", fetchError);
          results.holidays = { success: false, error: fetchError.message };
        } else if (nationalHolidays && nationalHolidays.length > 0) {
          // Check existing holidays to avoid duplicates
          const { data: existing } = await supabase
            .from("calendar_holidays")
            .select("holiday_date, holiday_type")
            .eq("company_id", companyId)
            .in("holiday_type", ["nacional", "autonomico", "estatal"]);

          const existingSet = new Set(
            (existing || []).map(h => `${h.holiday_date}-${h.holiday_type}`)
          );

          // Filter holidays: national always, autonomic only if matching region
          const holidaysToInsert = nationalHolidays
            .filter(h => {
              // Skip if already exists
              const holidayType = h.type === 'nacional' ? 'nacional' : 'autonomico';
              if (existingSet.has(`${h.holiday_date}-${holidayType}`)) {
                return false;
              }
              // Include all national holidays
              if (h.type === 'nacional') {
                return true;
              }
              // Include autonomic only if region matches
              if (h.type === 'autonomico' && autonomousCommunity) {
                return h.region === autonomousCommunity;
              }
              return false;
            })
            .map(h => ({
              company_id: companyId,
              holiday_date: h.holiday_date,
              holiday_type: h.type === 'nacional' ? 'nacional' : 'autonomico',
              description: h.region
                ? `[${h.region}] ${h.name}`
                : h.name,
              is_working_day: false,
            }));

          if (holidaysToInsert.length > 0) {
            const { error: insertError } = await supabase
              .from("calendar_holidays")
              .insert(holidaysToInsert);

            if (insertError) {
              console.error("[company-bootstrap] insert holidays error:", insertError);
              results.holidays = { success: false, error: insertError.message };
            } else {
              results.holidays = { success: true, count: holidaysToInsert.length };
              console.log(`[company-bootstrap] Inserted ${holidaysToInsert.length} holidays`);
            }
          } else {
            results.holidays = { success: true, count: 0 };
            console.log("[company-bootstrap] No new holidays to insert");
          }
        } else {
          results.holidays = { success: true, count: 0 };
          console.log("[company-bootstrap] No national holidays found for current year");
        }
      } catch (e) {
        console.error("[company-bootstrap] holidays exception:", e);
        results.holidays = { success: false, error: String(e) };
      }
    }

    // 4. Create default virtual terminal for kiosk
    if (!body.skip_terminal) {
      try {
        // Check if terminal already exists
        const { data: existingTerminal } = await supabase
          .from("terminals")
          .select("id")
          .eq("company_id", companyId)
          .limit(1)
          .maybeSingle();

        if (!existingTerminal) {
          const { error: terminalError } = await supabase
            .from("terminals")
            .insert({
              company_id: companyId,
              name: "Terminal Virtual",
              location: "Navegador Web",
              status: "active",
              settings: { virtual: true, allow_all_employees: true }
            });

          if (terminalError) {
            console.error("[company-bootstrap] terminal error:", terminalError);
            results.terminal = { success: false, error: terminalError.message };
          } else {
            results.terminal = { success: true, count: 1 };
            console.log("[company-bootstrap] Created virtual terminal");
          }
        } else {
          results.terminal = { success: true, count: 0 };
          console.log("[company-bootstrap] Terminal already exists");
        }
      } catch (e) {
        console.error("[company-bootstrap] terminal exception:", e);
        results.terminal = { success: false, error: String(e) };
      }
    }

    // 5. Audit log
    try {
      await supabase.from("audit_log").insert({
        action: "company_bootstrap",
        actor_type: "system",
        entity_type: "company",
        entity_id: companyId,
        company_id: companyId,
        new_values: results,
      });
    } catch (e) {
      console.error("[company-bootstrap] audit log error:", e);
    }

    console.log(`[company-bootstrap] Complete for company ${companyId}:`, results);

    return new Response(JSON.stringify({
      success: true,
      company_id: companyId,
      results,
    }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (e) {
    console.error("[company-bootstrap] unexpected error:", e);
    return new Response(JSON.stringify({ error: "Error inesperado", details: String(e) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
