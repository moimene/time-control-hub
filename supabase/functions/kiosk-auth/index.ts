import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Simple hash function for device tokens
async function hashToken(token: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(token);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

// Generate secure device token
function generateDeviceToken(): string {
  const array = new Uint8Array(32);
  crypto.getRandomValues(array);
  return Array.from(array).map(b => b.toString(16).padStart(2, '0')).join('');
}

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;

    const body = await req.json();
    const { action } = body;

    console.log(`[kiosk-auth] Action: ${action}`);

    // Admin client for database operations
    const adminClient = createClient(supabaseUrl, supabaseServiceKey);

    if (action === 'login') {
      const { email, password, deviceName } = body;

      if (!email || !password) {
        return new Response(
          JSON.stringify({ error: 'Email y contraseña requeridos' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Create auth client to verify credentials
      const authClient = createClient(supabaseUrl, supabaseAnonKey);
      const { data: authData, error: authError } = await authClient.auth.signInWithPassword({
        email,
        password,
      });

      if (authError || !authData.user) {
        console.log(`[kiosk-auth] Auth failed for ${email}: ${authError?.message}`);
        return new Response(
          JSON.stringify({ error: 'Credenciales inválidas' }),
          { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const userId = authData.user.id;
      console.log(`[kiosk-auth] User authenticated: ${userId}`);

      // Check if user is admin of a company
      const { data: roles, error: rolesError } = await adminClient
        .from('user_roles')
        .select('role')
        .eq('user_id', userId);

      if (rolesError) {
        console.error(`[kiosk-auth] Error fetching roles: ${rolesError.message}`);
        return new Response(
          JSON.stringify({ error: 'Error verificando permisos' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const isAdmin = roles?.some(r => r.role === 'admin' || r.role === 'super_admin' || r.role === 'asesor');
      if (!isAdmin) {
        console.log(`[kiosk-auth] User ${userId} is not an admin`);
        return new Response(
          JSON.stringify({ error: 'Solo los administradores pueden activar kioscos' }),
          { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Get user's company
      const { data: userCompany, error: companyError } = await adminClient
        .from('user_company')
        .select(`
          company_id,
          company:company_id (
            id,
            name,
            employee_code_prefix
          )
        `)
        .eq('user_id', userId)
        .single();

      if (companyError || !userCompany) {
        console.error(`[kiosk-auth] Error fetching company: ${companyError?.message}`);
        return new Response(
          JSON.stringify({ error: 'Usuario no asociado a ninguna empresa' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Generate device token
      const deviceToken = generateDeviceToken();
      const tokenHash = await hashToken(deviceToken);

      // Create kiosk session
      const { data: session, error: sessionError } = await adminClient
        .from('kiosk_sessions')
        .insert({
          company_id: userCompany.company_id,
          device_token_hash: tokenHash,
          device_name: deviceName || 'Kiosco',
          activated_by: userId,
        })
        .select()
        .single();

      if (sessionError) {
        console.error(`[kiosk-auth] Error creating session: ${sessionError.message}`);
        return new Response(
          JSON.stringify({ error: 'Error creando sesión de kiosco' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      console.log(`[kiosk-auth] Session created: ${session.id} for company ${userCompany.company_id}`);

      return new Response(
        JSON.stringify({
          success: true,
          deviceToken,
          sessionId: session.id,
          companyId: (userCompany.company as any).id,
          companyName: (userCompany.company as any).name,
          employeeCodePrefix: (userCompany.company as any).employee_code_prefix,
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (action === 'validate') {
      const { deviceToken } = body;

      if (!deviceToken) {
        return new Response(
          JSON.stringify({ error: 'Token requerido' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const tokenHash = await hashToken(deviceToken);

      // Find session
      const { data: session, error: sessionError } = await adminClient
        .from('kiosk_sessions')
        .select(`
          id,
          company_id,
          terminal_id,
          is_active,
          expires_at,
          company:company_id (
            id,
            name,
            employee_code_prefix
          ),
          terminal:terminal_id (
            id,
            name,
            location
          )
        `)
        .eq('device_token_hash', tokenHash)
        .single();

      if (sessionError || !session) {
        console.log(`[kiosk-auth] Session not found for token hash`);
        return new Response(
          JSON.stringify({ valid: false, error: 'Sesión no encontrada' }),
          { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Check if session is active
      if (!session.is_active) {
        return new Response(
          JSON.stringify({ valid: false, error: 'Sesión revocada' }),
          { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Check expiration
      if (session.expires_at && new Date(session.expires_at) < new Date()) {
        return new Response(
          JSON.stringify({ valid: false, error: 'Sesión expirada' }),
          { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Update last_seen_at
      await adminClient
        .from('kiosk_sessions')
        .update({ last_seen_at: new Date().toISOString() })
        .eq('id', session.id);

      console.log(`[kiosk-auth] Session validated: ${session.id}`);

      return new Response(
        JSON.stringify({
          valid: true,
          sessionId: session.id,
          companyId: (session.company as any).id,
          companyName: (session.company as any).name,
          employeeCodePrefix: (session.company as any).employee_code_prefix,
          terminalId: session.terminal_id,
          terminalName: (session.terminal as any)?.name || null,
          terminalLocation: (session.terminal as any)?.location || null,
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (action === 'set_terminal') {
      const { deviceToken, terminalId } = body;

      if (!deviceToken || !terminalId) {
        return new Response(
          JSON.stringify({ error: 'Token y terminal requeridos' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const tokenHash = await hashToken(deviceToken);

      // Get session
      const { data: session, error: sessionError } = await adminClient
        .from('kiosk_sessions')
        .select('id, company_id, is_active')
        .eq('device_token_hash', tokenHash)
        .single();

      if (sessionError || !session || !session.is_active) {
        return new Response(
          JSON.stringify({ error: 'Sesión inválida' }),
          { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Verify terminal belongs to same company
      const { data: terminal, error: terminalError } = await adminClient
        .from('terminals')
        .select('id, name, location, company_id')
        .eq('id', terminalId)
        .eq('company_id', session.company_id)
        .single();

      if (terminalError || !terminal) {
        return new Response(
          JSON.stringify({ error: 'Terminal no encontrado o no pertenece a esta empresa' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Update session with terminal
      await adminClient
        .from('kiosk_sessions')
        .update({
          terminal_id: terminalId,
          last_seen_at: new Date().toISOString()
        })
        .eq('id', session.id);

      console.log(`[kiosk-auth] Terminal ${terminalId} linked to session ${session.id}`);

      return new Response(
        JSON.stringify({
          success: true,
          terminalId: terminal.id,
          terminalName: terminal.name,
          terminalLocation: terminal.location,
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (action === 'logout') {
      const { deviceToken } = body;

      if (!deviceToken) {
        return new Response(
          JSON.stringify({ error: 'Token requerido' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const tokenHash = await hashToken(deviceToken);

      // Deactivate session
      const { error: updateError } = await adminClient
        .from('kiosk_sessions')
        .update({ is_active: false })
        .eq('device_token_hash', tokenHash);

      if (updateError) {
        console.error(`[kiosk-auth] Error deactivating session: ${updateError.message}`);
      }

      console.log(`[kiosk-auth] Session deactivated`);

      return new Response(
        JSON.stringify({ success: true }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({ error: 'Acción no válida' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error(`[kiosk-auth] Error: ${errorMessage}`);
    return new Response(
      JSON.stringify({ error: 'Error interno del servidor' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
