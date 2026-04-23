import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function generateSecurePassword(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789!@#$%";
  const randomValues = new Uint32Array(12);
  crypto.getRandomValues(randomValues);

  let password = "";
  for (let i = 0; i < 12; i++) {
    password += chars.charAt(randomValues[i] % chars.length);
  }
  return password;
}

interface ProvisionBody {
  company: {
    name: string;
    cif?: string;
    entity_type?: string;
    trade_name?: string;
    sector?: string;
    cnae?: string;
    address?: string;
    city?: string;
    postal_code?: string;
    timezone?: string;
  };
  admin: {
    email: string;
    first_name?: string;
    last_name?: string;
  };
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

    // Verify caller is super_admin
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "No authorization header" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const token = authHeader.replace("Bearer ", "");
    const { data: { user: caller }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !caller) {
      return new Response(JSON.stringify({ error: "Invalid token" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: isSuperAdmin } = await supabase.rpc("is_super_admin", { _user_id: caller.id });
    if (!isSuperAdmin) {
      return new Response(JSON.stringify({ error: "Solo super_admin puede provisionar empresas" }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body: ProvisionBody = await req.json();
    
    if (!body.company?.name?.trim()) {
      return new Response(JSON.stringify({ error: "Nombre de empresa requerido" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (!body.admin?.email?.trim()) {
      return new Response(JSON.stringify({ error: "Email del admin requerido" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Generate password for admin
    const tempPassword = generateSecurePassword();

    // 1. Create user in auth.users
    const { data: authUser, error: createUserError } = await supabase.auth.admin.createUser({
      email: body.admin.email.trim(),
      password: tempPassword,
      email_confirm: true, // Auto-confirm email
    });

    if (createUserError) {
      console.error("[company-provision] createUser error:", createUserError);
      return new Response(JSON.stringify({ error: `Error creando usuario: ${createUserError.message}` }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const userId = authUser.user.id;
    console.log(`[company-provision] Created user ${userId} for ${body.admin.email}`);

    // 2. Create company
    const { data: company, error: companyError } = await supabase
      .from("company")
      .insert({
        name: body.company.name.trim(),
        cif: body.company.cif || null,
        entity_type: body.company.entity_type || null,
        trade_name: body.company.trade_name || null,
        sector: body.company.sector || null,
        cnae: body.company.cnae || null,
        address: body.company.address || null,
        city: body.company.city || null,
        postal_code: body.company.postal_code || null,
        timezone: body.company.timezone || "Europe/Madrid",
      })
      .select("id, name")
      .single();

    if (companyError || !company) {
      console.error("[company-provision] company insert error:", companyError);
      // Try to cleanup user
      await supabase.auth.admin.deleteUser(userId);
      return new Response(JSON.stringify({ error: companyError?.message || "Error creando empresa" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log(`[company-provision] Created company ${company.id}: ${company.name}`);

    // 3. Link user to company
    const { error: linkError } = await supabase
      .from("user_company")
      .insert({ user_id: userId, company_id: company.id });

    if (linkError) {
      console.error("[company-provision] user_company insert error:", linkError);
    }

    // 4. Assign admin role
    const { error: roleError } = await supabase
      .from("user_roles")
      .insert({ user_id: userId, role: "admin" });

    if (roleError) {
      console.error("[company-provision] user_roles insert error:", roleError);
    }

    // 5. Create employee record
    const { error: empError } = await supabase
      .from("employees")
      .insert({
        user_id: userId,
        company_id: company.id,
        email: body.admin.email.trim(),
        first_name: body.admin.first_name || "Admin",
        last_name: body.admin.last_name || "",
        employee_code: `ADMIN-${Date.now().toString(36).toUpperCase()}`,
        status: "active",
      });

    if (empError) {
      console.error("[company-provision] employee insert error:", empError);
    }

    // 6. Audit log
    await supabase.from("audit_log").insert({
      action: "company_provision",
      actor_id: caller.id,
      actor_type: "super_admin",
      entity_type: "company",
      entity_id: company.id,
      company_id: company.id,
      new_values: { 
        company_name: company.name,
        admin_email: body.admin.email,
        provisioned_by: caller.id
      },
    });

    // 7. Bootstrap company with default data
    try {
      console.log(`[company-provision] Invoking company-bootstrap for ${company.id}`);
      const { error: bootstrapError } = await supabase.functions.invoke("company-bootstrap", {
        body: { company_id: company.id }
      });
      if (bootstrapError) {
        console.error("[company-provision] bootstrap error (non-fatal):", bootstrapError);
      } else {
        console.log(`[company-provision] Bootstrap complete for ${company.id}`);
      }
    } catch (bootstrapErr) {
      console.error("[company-provision] bootstrap exception (non-fatal):", bootstrapErr);
    }

    console.log(`[company-provision] Complete: company=${company.id}, user=${userId}`);

    return new Response(JSON.stringify({
      success: true,
      company: { id: company.id, name: company.name },
      admin: {
        email: body.admin.email,
        tempPassword,
        userId,
      },
      message: "Empresa y administrador creados correctamente"
    }), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (e) {
    console.error("[company-provision] unexpected error:", e);
    return new Response(JSON.stringify({ error: "Error inesperado" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
