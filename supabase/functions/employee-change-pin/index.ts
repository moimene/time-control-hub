import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get authorization header
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'No authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Verify user
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    
    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Invalid token' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { currentPin, newPin } = await req.json();

    if (!currentPin || !newPin) {
      return new Response(
        JSON.stringify({ error: 'Se requiere el PIN actual y el nuevo PIN' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!/^\d{4}$/.test(newPin)) {
      return new Response(
        JSON.stringify({ error: 'El nuevo PIN debe tener exactamente 4 dígitos' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get employee record
    const { data: employee, error: empError } = await supabase
      .from('employees')
      .select('id, pin_hash, pin_salt, pin_locked_until, pin_failed_attempts')
      .eq('user_id', user.id)
      .single();

    if (empError || !employee) {
      console.error('Employee lookup error:', empError);
      return new Response(
        JSON.stringify({ error: 'Empleado no encontrado' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check if account is locked
    if (employee.pin_locked_until && new Date(employee.pin_locked_until) > new Date()) {
      return new Response(
        JSON.stringify({ error: 'Cuenta bloqueada temporalmente. Intente más tarde.' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Verify current PIN
    if (employee.pin_hash && employee.pin_salt) {
      const encoder = new TextEncoder();
      const currentPinData = encoder.encode(currentPin + employee.pin_salt);
      const currentHashBuffer = await crypto.subtle.digest('SHA-256', currentPinData);
      const currentHashArray = Array.from(new Uint8Array(currentHashBuffer));
      const currentHashHex = currentHashArray.map(b => b.toString(16).padStart(2, '0')).join('');

      if (currentHashHex !== employee.pin_hash) {
        const failedAttempts = (employee as any).pin_failed_attempts ? Number((employee as any).pin_failed_attempts) + 1 : 1;
        const shouldLock = failedAttempts >= 5;

        // Increment failed attempts
        await supabase
          .from('employees')
          .update({ 
            pin_failed_attempts: failedAttempts,
            pin_locked_until: shouldLock ? new Date(Date.now() + 15 * 60 * 1000).toISOString() : null
          })
          .eq('id', employee.id);

        return new Response(
          JSON.stringify({ error: 'PIN actual incorrecto' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    // Generate new salt and hash
    const newSalt = crypto.randomUUID();
    const encoder = new TextEncoder();
    const newPinData = encoder.encode(newPin + newSalt);
    const newHashBuffer = await crypto.subtle.digest('SHA-256', newPinData);
    const newHashArray = Array.from(new Uint8Array(newHashBuffer));
    const newHashHex = newHashArray.map(b => b.toString(16).padStart(2, '0')).join('');

    // Update employee PIN
    const { error: updateError } = await supabase
      .from('employees')
      .update({
        pin_hash: newHashHex,
        pin_salt: newSalt,
        pin_failed_attempts: 0,
        pin_locked_until: null
      })
      .eq('id', employee.id);

    if (updateError) {
      console.error('PIN update error:', updateError);
      return new Response(
        JSON.stringify({ error: 'Error al actualizar el PIN' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Log the action
    await supabase.from('audit_log').insert({
      actor_type: 'employee',
      actor_id: user.id,
      action: 'change_pin',
      entity_type: 'employee',
      entity_id: employee.id,
      new_values: { pin_changed: true }
    });

    console.log(`PIN changed successfully for employee ${employee.id}`);

    return new Response(
      JSON.stringify({ success: true, message: 'PIN actualizado correctamente' }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in employee-change-pin:', error);
    return new Response(
      JSON.stringify({ error: 'Error interno del servidor' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
