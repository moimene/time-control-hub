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

    // Verify caller is authenticated
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "No authorization header" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const token = authHeader.replace("Bearer ", "");
    const { data: { user: caller }, error: authError } = await supabaseAdmin.auth.getUser(token);

    if (authError || !caller) {
      return new Response(JSON.stringify({ error: "Invalid token" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Verify roles (admin, super_admin, or asesor)
    const { data: roles } = await supabaseAdmin
      .from('user_roles')
      .select('role')
      .eq('user_id', caller.id);

    const hasPermission = roles?.some(r => ['admin', 'super_admin', 'asesor'].includes(r.role));

    if (!hasPermission) {
      return new Response(JSON.stringify({ error: "No tienes permisos para realizar esta acción" }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { action, employee_id, email, password, user_id, new_password } = await req.json();

    console.log(`Processing action: ${action} by user ${caller.id}`);

    if (action === 'create') {
      // Security check: verify caller belongs to the same company as the employee
      const { data: employeeCheck } = await supabaseAdmin
        .from('employees')
        .select('company_id')
        .eq('id', employee_id)
        .single();

      if (!employeeCheck) {
        return new Response(JSON.stringify({ error: "Empleado no encontrado" }), {
          status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      const isSuperAdmin = roles?.some(r => r.role === 'super_admin');
      if (!isSuperAdmin) {
        const { data: callerCompany } = await supabaseAdmin
          .from('user_company')
          .select('company_id')
          .eq('user_id', caller.id)
          .eq('company_id', employeeCheck.company_id)
          .maybeSingle();

        if (!callerCompany) {
          return new Response(JSON.stringify({ error: "No tienes acceso a esta empresa" }), {
            status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }
      }

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

      // Use the already fetched employee data
      const employeeData = employeeCheck;

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
      const isSuperAdmin = roles?.some(r => r.role === 'super_admin');

      if (!isSuperAdmin) {
        // Get target user's company
        const { data: targetUserCompany } = await supabaseAdmin
          .from('user_company')
          .select('company_id')
          .eq('user_id', user_id)
          .maybeSingle();

        if (!targetUserCompany) {
          return new Response(JSON.stringify({ error: "Usuario destino no asociado a empresa" }), {
            status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }

        // Check if caller is in same company
        const { data: callerCompany } = await supabaseAdmin
          .from('user_company')
          .select('company_id')
          .eq('user_id', caller.id)
          .eq('company_id', targetUserCompany.company_id)
          .maybeSingle();

        if (!callerCompany) {
          return new Response(JSON.stringify({ error: "No tienes acceso a esta empresa" }), {
            status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }
      }

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
