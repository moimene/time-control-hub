import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

type AppRole = 'super_admin' | 'admin' | 'responsible' | 'employee' | 'asesor';

function jsonResponse(payload: unknown, status = 200): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

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

    // Require an authenticated caller and enforce role + tenant scope.
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

    const callerId = authData.user.id;
    const { data: roleRows, error: roleError } = await supabaseAdmin
      .from('user_roles')
      .select('role')
      .eq('user_id', callerId);

    if (roleError) {
      throw new Error(`Unable to resolve user roles: ${roleError.message}`);
    }

    const roles = (roleRows || []).map((r) => r.role as AppRole);
    const isSuperAdmin = roles.includes('super_admin');
    const isAdminLike = isSuperAdmin || roles.includes('admin') || roles.includes('responsible');

    if (!isAdminLike) {
      return jsonResponse({ error: 'Insufficient permissions' }, 403);
    }

    const { action, employee_id, email, password, user_id, new_password } = await req.json();

    if (action === 'create') {
      if (!employee_id || typeof employee_id !== 'string') {
        return jsonResponse({ error: 'employee_id requerido' }, 400);
      }
      if (!email || typeof email !== 'string') {
        return jsonResponse({ error: 'email requerido' }, 400);
      }
      if (!password || typeof password !== 'string') {
        return jsonResponse({ error: 'password requerido' }, 400);
      }

      // Resolve employee tenant and ensure caller is assigned to the same company (unless super_admin).
      const { data: targetEmployee, error: employeeError } = await supabaseAdmin
        .from('employees')
        .select('id, company_id, user_id')
        .eq('id', employee_id)
        .maybeSingle();

      if (employeeError) {
        throw new Error(`Unable to resolve employee: ${employeeError.message}`);
      }

      if (!targetEmployee) {
        return jsonResponse({ error: 'Empleado no encontrado' }, 400);
      }

      if (!isSuperAdmin) {
        const { data: linkedCompany, error: linkedCompanyError } = await supabaseAdmin
          .from('user_company')
          .select('company_id')
          .eq('user_id', callerId)
          .eq('company_id', targetEmployee.company_id)
          .maybeSingle();

        if (linkedCompanyError) {
          throw new Error(`Unable to validate user-company link: ${linkedCompanyError.message}`);
        }

        if (!linkedCompany) {
          return jsonResponse({ error: 'User not assigned to requested company' }, 403);
        }
      }

      if (targetEmployee.user_id) {
        return jsonResponse({ error: 'El empleado ya tiene un usuario vinculado' }, 400);
      }

      // Create auth user
      const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
      });

      if (authError) {
        console.error('Error creating auth user:', authError);
        return jsonResponse({ error: authError.message }, 400);
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
        return jsonResponse({ error: 'Error al vincular usuario con empleado' }, 400);
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

      return jsonResponse({ success: true, user_id: newUserId });
    }

    if (action === 'reset_password') {
      if (!user_id || typeof user_id !== 'string') {
        return jsonResponse({ error: 'user_id requerido' }, 400);
      }
      if (!new_password || typeof new_password !== 'string') {
        return jsonResponse({ error: 'new_password requerido' }, 400);
      }

      // Restrict password resets to employees within caller's company (unless super_admin).
      const { data: targetEmployee, error: targetEmployeeError } = await supabaseAdmin
        .from('employees')
        .select('id, company_id')
        .eq('user_id', user_id)
        .maybeSingle();

      if (targetEmployeeError) {
        throw new Error(`Unable to resolve target employee: ${targetEmployeeError.message}`);
      }

      if (!targetEmployee) {
        return jsonResponse({ error: 'Target user is not linked to an employee record' }, 400);
      }

      if (!isSuperAdmin) {
        const { data: linkedCompany, error: linkedCompanyError } = await supabaseAdmin
          .from('user_company')
          .select('company_id')
          .eq('user_id', callerId)
          .eq('company_id', targetEmployee.company_id)
          .maybeSingle();

        if (linkedCompanyError) {
          throw new Error(`Unable to validate user-company link: ${linkedCompanyError.message}`);
        }

        if (!linkedCompany) {
          return jsonResponse({ error: 'User not assigned to requested company' }, 403);
        }
      }

      const { error: resetError } = await supabaseAdmin.auth.admin.updateUserById(
        user_id,
        { password: new_password }
      );

      if (resetError) {
        console.error('Error resetting password:', resetError);
        return jsonResponse({ error: resetError.message }, 400);
      }

      return jsonResponse({ success: true });
    }

    return jsonResponse({ error: 'Acción no válida' }, 400);
  } catch (error: unknown) {
    console.error('Unexpected error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Error desconocido';
    return jsonResponse({ error: errorMessage }, 500);
  }
});
