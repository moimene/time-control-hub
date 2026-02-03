import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { autoRefreshToken: false, persistSession: false }
    });

    const { action, employee_id, email, password, user_id, new_password } = await req.json();

    console.log(`Processing action: ${action}`);

    // 1. Verify Authentication
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Missing Authorization header' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: userError } = await supabaseAdmin.auth.getUser(token);

    if (userError || !user) {
      return new Response(JSON.stringify({ error: 'Invalid token' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // 2. Verify Admin Role
    const { data: roles } = await supabaseAdmin
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id);

    const hasAdminRole = roles?.some((r: { role: string }) => ['admin', 'super_admin'].includes(r.role));
    if (!hasAdminRole) {
      return new Response(JSON.stringify({ error: 'Unauthorized: Admin role required' }), { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // 3. Verify Tenancy (ensure admin has access to the target company)
    const isSuperAdmin = roles?.some((r: { role: string }) => r.role === 'super_admin');
    if (!isSuperAdmin) {
      let targetCompanyId: string | null = null;

      if (action === 'create' && employee_id) {
        const { data: targetEmployee } = await supabaseAdmin
          .from('employees')
          .select('company_id')
          .eq('id', employee_id)
          .single();
        targetCompanyId = targetEmployee?.company_id;
      } else if (action === 'reset_password' && user_id) {
        const { data: targetEmployee } = await supabaseAdmin
          .from('employees')
          .select('company_id')
          .eq('user_id', user_id)
          .single();
        targetCompanyId = targetEmployee?.company_id;
      }

      if (targetCompanyId) {
        const { data: adminCompany } = await supabaseAdmin
          .from('user_company')
          .select('company_id')
          .eq('user_id', user.id)
          .eq('company_id', targetCompanyId)
          .single();

        if (!adminCompany) {
          return new Response(JSON.stringify({ error: 'Unauthorized: Access to this company denied' }), { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
        }
      }
    }

    if (action === 'create') {
      // Create auth user
      const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
      });

      if (authError) {
        console.error('Error creating auth user:', authError);
        return new Response(
          JSON.stringify({ error: authError.message }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const newUserId = authData.user.id;

      // Link user to employee
      const { error: updateError } = await supabaseAdmin
        .from('employees')
        .update({ user_id: newUserId })
        .eq('id', employee_id);

      if (updateError) {
        console.error('Error linking user to employee:', updateError);
        // Rollback: delete created user
        await supabaseAdmin.auth.admin.deleteUser(newUserId);
        return new Response(
          JSON.stringify({ error: 'Error al vincular usuario con empleado' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Get company_id from employee
      const { data: employeeData } = await supabaseAdmin
        .from('employees')
        .select('company_id')
        .eq('id', employee_id)
        .single();

      // Add user role
      const { error: roleError } = await supabaseAdmin
        .from('user_roles')
        .insert({
          user_id: newUserId,
          role: 'employee',
        });

      if (roleError) {
        console.error('Error adding user role:', roleError);
      }

      // Add user-company relationship
      if (employeeData?.company_id) {
        const { error: companyError } = await supabaseAdmin
          .from('user_company')
          .insert({
            user_id: newUserId,
            company_id: employeeData.company_id,
          });

        if (companyError) {
          console.error('Error adding user-company relationship:', companyError);
        }
      }

      console.log(`User created successfully: ${newUserId}`);

      return new Response(
        JSON.stringify({ success: true, user_id: newUserId }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (action === 'reset_password') {
      const { error: resetError } = await supabaseAdmin.auth.admin.updateUserById(
        user_id,
        { password: new_password }
      );

      if (resetError) {
        console.error('Error resetting password:', resetError);
        return new Response(
          JSON.stringify({ error: resetError.message }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      console.log(`Password reset successfully for user: ${user_id}`);

      return new Response(
        JSON.stringify({ success: true }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({ error: 'Acción no válida' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error: unknown) {
    console.error('Unexpected error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Error desconocido';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
