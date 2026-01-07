import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

type EntityType = "empresa" | "autonomo";

interface CompanyCreateBody {
  entityType: EntityType;
  name: string;
  cif?: string | null;
  trade_name?: string | null;
  sector?: string | null;
  cnae?: string | null;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const supabase = createClient(supabaseUrl, serviceKey);

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "No authorization header" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);

    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Invalid token" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body: CompanyCreateBody = await req.json();
    if (!body?.name?.trim()) {
      return new Response(JSON.stringify({ error: "Nombre de empresa requerido" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Prevent creating a second company for regular users
    const { data: existingCompanyId, error: existingError } = await supabase
      .rpc("get_user_company_id", { _user_id: user.id });

    if (existingError) {
      console.error("[company-create] get_user_company_id error", existingError);
      return new Response(JSON.stringify({ error: "No se pudo comprobar la empresa del usuario" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: isSuperAdmin } = await supabase.rpc("is_super_admin", { _user_id: user.id });

    if (existingCompanyId && !isSuperAdmin) {
      return new Response(JSON.stringify({ error: "El usuario ya tiene una empresa asociada" }), {
        status: 409,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Create company
    const { data: company, error: companyError } = await supabase
      .from("company")
      .insert({
        name: body.name.trim(),
        cif: body.cif ?? null,
        entity_type: body.entityType,
        trade_name: body.trade_name ?? null,
        sector: body.sector ?? null,
        cnae: body.cnae ?? null,
      })
      .select("id, name")
      .single();

    if (companyError || !company) {
      console.error("[company-create] company insert error", companyError);
      return new Response(JSON.stringify({ error: companyError?.message ?? "Error creando empresa" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Link user to company (idempotent)
    const { error: linkError } = await supabase
      .from("user_company")
      .upsert({ user_id: user.id, company_id: company.id }, { onConflict: "user_id" });

    if (linkError) {
      console.error("[company-create] user_company upsert error", linkError);
      return new Response(JSON.stringify({ error: linkError.message }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Assign admin role (idempotent)
    const { error: roleError } = await supabase
      .from("user_roles")
      .upsert({ user_id: user.id, role: "admin" }, { onConflict: "user_id,role" });

    if (roleError) {
      console.error("[company-create] user_roles upsert error", roleError);
      return new Response(JSON.stringify({ error: roleError.message }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ company }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("[company-create] unexpected", e);
    return new Response(JSON.stringify({ error: "Error inesperado" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
