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

const testUsers = [
  {
    email: 'admin@test.com',
    password: 'admin123',
    role: 'super_admin',
    employeeCode: null,
  },
  {
    email: 'responsable@test.com',
    password: 'resp123',
    role: 'responsible',
    employeeCode: null,
  },
  {
    email: 'carlos.garcia@empresa.com',
    password: 'emp123',
    role: 'employee',
    employeeCode: 'EMP001',
  },
];

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    if (!isFixtureEnvironmentAllowed(req)) {
      return jsonResponse({ error: 'setup-test-users is disabled in this environment' }, 403);
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return jsonResponse({ error: 'Missing Authorization header' }, 401);
    }

    const token = authHeader.replace('Bearer ', '').trim();
    if (!token) {
      return jsonResponse({ error: 'Invalid Authorization token' }, 401);
    }

    const { data: authData, error: authError } = await supabaseAdmin.auth.getUser(token);
    if (authError || !authData?.user) {
      return jsonResponse({ error: 'Unauthorized user' }, 401);
    }

    const { data: superAdminRole, error: roleError } = await supabaseAdmin
      .from('user_roles')
      .select('id')
      .eq('user_id', authData.user.id)
      .eq('role', 'super_admin')
      .maybeSingle();

    if (roleError) {
      throw new Error(`Unable to validate super admin role: ${roleError.message}`);
    }

    if (!superAdminRole) {
      return jsonResponse({ error: 'Only super_admin can run setup-test-users' }, 403);
    }

    const results = [];

    for (const testUser of testUsers) {
      console.log(`Processing user: ${testUser.email}`);

      // Check if user already exists
      const { data: existingUsers } = await supabaseAdmin.auth.admin.listUsers();
      const existingUser = existingUsers?.users?.find(u => u.email === testUser.email);

      let userId: string;

      if (existingUser) {
        console.log(`User ${testUser.email} already exists, updating...`);
        userId = existingUser.id;
        
        // Update password
        await supabaseAdmin.auth.admin.updateUserById(userId, {
          password: testUser.password,
          email_confirm: true,
        });
      } else {
        // Create new user
        console.log(`Creating user: ${testUser.email}`);
        const { data: newUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
          email: testUser.email,
          password: testUser.password,
          email_confirm: true,
        });

        if (createError) {
          console.error(`Error creating user ${testUser.email}:`, createError);
          results.push({ email: testUser.email, status: 'error', error: createError.message });
          continue;
        }

        userId = newUser.user.id;
      }

      // Check if role already exists
      const { data: existingRole } = await supabaseAdmin
        .from('user_roles')
        .select('id')
        .eq('user_id', userId)
        .eq('role', testUser.role)
        .maybeSingle();

      if (!existingRole) {
        // Add role
        const { error: roleError } = await supabaseAdmin
          .from('user_roles')
          .insert({ user_id: userId, role: testUser.role });

        if (roleError) {
          console.error(`Error adding role for ${testUser.email}:`, roleError);
        }
      }

      // Link to employee if applicable
      if (testUser.employeeCode) {
        const { error: linkError } = await supabaseAdmin
          .from('employees')
          .update({ user_id: userId })
          .eq('employee_code', testUser.employeeCode);

        if (linkError) {
          console.error(`Error linking employee ${testUser.employeeCode}:`, linkError);
        }
      }

      results.push({ 
        email: testUser.email, 
        status: 'success', 
        userId,
        role: testUser.role,
        employeeCode: testUser.employeeCode,
      });
    }

    console.log('Setup complete:', results);

    return jsonResponse({ 
      success: true, 
      message: 'Test users created/updated successfully',
      results,
      credentials: {
        admin: { email: 'admin@test.com', password: 'admin123', url: '/admin' },
        responsible: { email: 'responsable@test.com', password: 'resp123', url: '/admin' },
        employee: { email: 'carlos.garcia@empresa.com', password: 'emp123', url: '/employee' },
        kiosk: { url: '/kiosk', codes: ['EMP001:1234', 'EMP002:2345', 'EMP003:3456'] },
      }
    });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('Error in setup-test-users:', error);
    return jsonResponse({ error: errorMessage }, 500);
  }
});
