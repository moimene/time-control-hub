import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

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
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

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

    return new Response(JSON.stringify({ 
      success: true, 
      message: 'Test users created/updated successfully',
      results,
      credentials: {
        admin: { email: 'admin@test.com', password: 'admin123', url: '/admin' },
        responsible: { email: 'responsable@test.com', password: 'resp123', url: '/admin' },
        employee: { email: 'carlos.garcia@empresa.com', password: 'emp123', url: '/employee' },
        kiosk: { url: '/kiosk', codes: ['EMP001:1234', 'EMP002:2345', 'EMP003:3456'] },
      }
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('Error in setup-test-users:', error);
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
