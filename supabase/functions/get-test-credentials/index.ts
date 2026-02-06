import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function jsonResponse(payload: unknown, status = 200): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

function isFixtureEnvironmentAllowed(req: Request): boolean {
  const explicitFlag = Deno.env.get('ALLOW_TEST_FIXTURES') === 'true';
  const appEnv = (
    Deno.env.get('APP_ENV') ||
    Deno.env.get('ENV') ||
    Deno.env.get('NODE_ENV') ||
    ''
  ).toLowerCase();
  const nonProdEnv = ['dev', 'development', 'local', 'test', 'staging', 'preview'];
  const requestHost = new URL(req.url).hostname;
  const localHost = requestHost === 'localhost' || requestHost === '127.0.0.1';

  return explicitFlag || nonProdEnv.includes(appEnv) || localHost;
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    if (!isFixtureEnvironmentAllowed(req)) {
      return jsonResponse({ error: 'get-test-credentials is disabled in this environment' }, 403);
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    
    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false }
    });

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return jsonResponse({ error: 'Missing Authorization header' }, 401);
    }

    const token = authHeader.replace('Bearer ', '').trim();
    if (!token) {
      return jsonResponse({ error: 'Invalid Authorization token' }, 401);
    }

    const { data: authData, error: authError } = await supabase.auth.getUser(token);
    if (authError || !authData?.user) {
      return jsonResponse({ error: 'Unauthorized user' }, 401);
    }

    const { data: superAdminRole, error: roleError } = await supabase
      .from('user_roles')
      .select('id')
      .eq('user_id', authData.user.id)
      .eq('role', 'super_admin')
      .maybeSingle();

    if (roleError) {
      throw new Error(`Unable to validate super admin role: ${roleError.message}`);
    }

    if (!superAdminRole) {
      return jsonResponse({ error: 'Only super_admin can run get-test-credentials' }, 403);
    }

    console.log('Fetching test credentials data...');

    // Fetch auth users
    const { data: listedUsers, error: listUsersError } = await supabase.auth.admin.listUsers();
    if (listUsersError) {
      console.error('Error fetching auth users:', listUsersError);
    }
    const authUsers = listedUsers?.users || [];
    console.log(`Found ${authUsers.length} auth users`);

    // Fetch user roles
    const { data: userRoles, error: rolesError } = await supabase
      .from('user_roles')
      .select('*');
    if (rolesError) {
      console.error('Error fetching user roles:', rolesError);
    }
    console.log(`Found ${userRoles?.length || 0} user roles`);

    // Fetch user companies
    const { data: userCompanies, error: ucError } = await supabase
      .from('user_company')
      .select('user_id, company_id');
    if (ucError) {
      console.error('Error fetching user companies:', ucError);
    }

    // Fetch companies
    const { data: companies, error: compError } = await supabase
      .from('company')
      .select('id, name, cif, timezone, sector, employee_code_prefix');
    if (compError) {
      console.error('Error fetching companies:', compError);
    }
    console.log(`Found ${companies?.length || 0} companies`);

    // Fetch employees
    const { data: employees, error: empError } = await supabase
      .from('employees')
      .select('id, user_id, company_id, employee_code, first_name, last_name, email, pin_hash');
    if (empError) {
      console.error('Error fetching employees:', empError);
    }
    console.log(`Found ${employees?.length || 0} employees`);

    // Combine user roles with emails from auth
    const rolesWithEmail = (userRoles || []).map(role => {
      const user = authUsers.find(u => u.id === role.user_id);
      return { 
        ...role, 
        email: user?.email || null 
      };
    });

    const responseData = {
      userRoles: rolesWithEmail,
      userCompanies: userCompanies || [],
      companies: companies || [],
      employees: employees || [],
      summary: {
        totalUsers: authUsers.length,
        totalRoles: userRoles?.length || 0,
        totalCompanies: companies?.length || 0,
        totalEmployees: employees?.length || 0,
      }
    };

    console.log('Response summary:', responseData.summary);

    return jsonResponse(responseData);

  } catch (error: unknown) {
    const errMsg = error instanceof Error ? error.message : String(error);
    console.error('Error in get-test-credentials:', errMsg);
    return jsonResponse({ 
      error: errMsg,
      userRoles: [],
      userCompanies: [],
      companies: [],
      employees: [],
      summary: { totalUsers: 0, totalRoles: 0, totalCompanies: 0, totalEmployees: 0 }
    }, 500);
  }
});
