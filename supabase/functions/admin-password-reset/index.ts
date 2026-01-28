import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function generateSecurePassword(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789!@#$%";
  let password = "";
  const randomValues = new Uint32Array(12);
  crypto.getRandomValues(randomValues);
  for (let i = 0; i < 12; i++) {
    password += chars.charAt(randomValues[i] % chars.length);
  }
  return password;
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

    // Check if caller is super_admin
    const { data: isSuperAdmin } = await supabase.rpc("is_super_admin", { _user_id: caller.id });
    if (!isSuperAdmin) {
      return new Response(JSON.stringify({ error: "Solo super_admin puede resetear contraseñas" }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { user_id } = await req.json();
    if (!user_id) {
      return new Response(JSON.stringify({ error: "user_id requerido" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Generate new password
    const tempPassword = generateSecurePassword();

    // Update user password using Admin API
    const { error: updateError } = await supabase.auth.admin.updateUserById(user_id, {
      password: tempPassword
    });

    if (updateError) {
      console.error("[admin-password-reset] updateUserById error:", updateError);
      return new Response(JSON.stringify({ error: updateError.message }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get user email for audit log
    const { data: userData } = await supabase.auth.admin.getUserById(user_id);
    const userEmail = userData?.user?.email || user_id;

    // Log the action in audit_log
    await supabase.from("audit_log").insert({
      action: "password_reset",
      actor_id: caller.id,
      actor_type: "super_admin",
      entity_type: "user",
      entity_id: user_id,
      new_values: { reset_by: caller.id, target_email: userEmail },
    });

    console.log(`[admin-password-reset] Password reset for user ${user_id} by ${caller.id}`);

    return new Response(JSON.stringify({ 
      success: true, 
      tempPassword,
      message: "Contraseña reseteada. El usuario debe cambiarla al entrar."
    }), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (e) {
    console.error("[admin-password-reset] unexpected error:", e);
    return new Response(JSON.stringify({ error: "Error inesperado" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
