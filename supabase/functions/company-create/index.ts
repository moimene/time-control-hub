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

    // Create admin client that bypasses RLS
    const supabaseAdmin = createClient(supabaseUrl, serviceKey, {
      auth: { autoRefreshToken: false, persistSession: false }
    });

    // Also create a client with the user's token just to verify identity
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "No authorization header" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);

    if (authError || !user) {
      console.error("[company-create] auth error:", authError);
      return new Response(JSON.stringify({ error: "Invalid token" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log(`[company-create] User ${user.id} (${user.email}) requesting company creation`);

    const body: CompanyCreateBody = await req.json();
    if (!body?.name?.trim()) {
      return new Response(JSON.stringify({ error: "Nombre de empresa requerido" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Prevent creating a second company for regular users
    const { data: existingCompanyId, error: existingError } = await supabaseAdmin
      .rpc("get_user_company_id", { _user_id: user.id });

    if (existingError) {
      console.error("[company-create] get_user_company_id error", existingError);
      return new Response(JSON.stringify({ error: "No se pudo comprobar la empresa del usuario" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: isSuperAdmin } = await supabaseAdmin.rpc("is_super_admin", { _user_id: user.id });

    if (existingCompanyId && !isSuperAdmin) {
      return new Response(JSON.stringify({ error: "El usuario ya tiene una empresa asociada" }), {
        status: 409,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Create company using admin client (bypasses RLS)
    console.log(`[company-create] Creating company: ${body.name}`);
    const { data: company, error: companyError } = await supabaseAdmin
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

    console.log(`[company-create] Company created: ${company.id}`);

    // Link user to company - first check if already linked
    const { data: existingLink } = await supabaseAdmin
      .from("user_company")
      .select("id")
      .eq("user_id", user.id)
      .maybeSingle();

    if (!existingLink) {
      const { error: linkError } = await supabaseAdmin
        .from("user_company")
        .insert({ user_id: user.id, company_id: company.id });

      if (linkError) {
        console.error("[company-create] user_company insert error", linkError);
        return new Response(JSON.stringify({ error: linkError.message }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    // Assign admin role - check if already has role
    const { data: existingRole } = await supabaseAdmin
      .from("user_roles")
      .select("id")
      .eq("user_id", user.id)
      .eq("role", "admin")
      .maybeSingle();

    if (!existingRole) {
      const { error: roleError } = await supabaseAdmin
        .from("user_roles")
        .insert({ user_id: user.id, role: "admin" });

      if (roleError) {
        console.error("[company-create] user_roles insert error", roleError);
        return new Response(JSON.stringify({ error: roleError.message }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    console.log(`[company-create] Success: company=${company.id}, user=${user.id}`);

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