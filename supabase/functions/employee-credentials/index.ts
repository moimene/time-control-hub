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
