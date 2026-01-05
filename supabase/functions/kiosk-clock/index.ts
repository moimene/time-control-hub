import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { action, employee_code, pin, qr_token, terminal_id, event_type, override_reason } = await req.json();
    
    console.log(`Kiosk clock action: ${action}, employee_code: ${employee_code}, terminal: ${terminal_id}${override_reason ? `, override_reason: ${override_reason}` : ''}`);

    // Validate employee code action - returns employee info and next event type
    if (action === 'validate' && employee_code) {
      const { data: emp, error: empError } = await supabase
        .from('employees')
        .select('id, first_name, last_name, status')
        .eq('employee_code', employee_code)
        .maybeSingle();

      if (empError || !emp) {
        console.error('Employee not found for validation:', empError);
        return new Response(
          JSON.stringify({ success: false, error: 'Empleado no encontrado' }),
          { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      if (emp.status !== 'active') {
        return new Response(
          JSON.stringify({ success: false, error: 'Empleado no activo' }),
          { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Get last event to determine next type
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      const { data: lastEvent } = await supabase
        .from('time_events')
        .select('event_type')
        .eq('employee_id', emp.id)
        .gte('timestamp', today.toISOString())
        .order('timestamp', { ascending: false })
        .limit(1)
        .maybeSingle();

      const nextEventType = lastEvent?.event_type === 'entry' ? 'exit' : 'entry';

      console.log(`Validated employee ${employee_code}: ${emp.first_name} ${emp.last_name}, next event: ${nextEventType}`);

      return new Response(
        JSON.stringify({
          success: true,
          employee: {
            first_name: emp.first_name,
            last_name: emp.last_name,
          },
          next_event_type: nextEventType,
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Validate terminal if provided
    if (terminal_id) {
      const { data: terminal, error: terminalError } = await supabase
        .from('terminals')
        .select('id, status')
        .eq('id', terminal_id)
        .maybeSingle();
      
      if (terminalError || !terminal || terminal.status !== 'active') {
        console.error('Invalid terminal:', terminalError);
        return new Response(
          JSON.stringify({ success: false, error: 'Terminal no válido o inactivo' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    let employee = null;

    // Authenticate by PIN
    if (action === 'pin' && employee_code && pin) {
      const { data: emp, error: empError } = await supabase
        .from('employees')
        .select('id, first_name, last_name, employee_code, pin_hash, pin_salt, pin_locked_until, pin_failed_attempts, status')
        .eq('employee_code', employee_code)
        .maybeSingle();

      if (empError || !emp) {
        console.error('Employee not found:', empError);
        return new Response(
          JSON.stringify({ success: false, error: 'Empleado no encontrado' }),
          { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      if (emp.status !== 'active') {
        return new Response(
          JSON.stringify({ success: false, error: 'Empleado no activo' }),
          { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Check if account is locked
      if (emp.pin_locked_until && new Date(emp.pin_locked_until) > new Date()) {
        return new Response(
          JSON.stringify({ success: false, error: 'Cuenta bloqueada temporalmente' }),
          { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Verify PIN with hash
      const encoder = new TextEncoder();
      const pinWithSalt = encoder.encode(pin + emp.pin_salt);
      const hashBuffer = await crypto.subtle.digest('SHA-256', pinWithSalt);
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      const computedHash = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');

      if (computedHash !== emp.pin_hash) {
        // Increment failed attempts
        const newAttempts = (emp.pin_failed_attempts || 0) + 1;
        await supabase
          .from('employees')
          .update({ 
            pin_failed_attempts: newAttempts,
            pin_locked_until: newAttempts >= 5 
              ? new Date(Date.now() + 15 * 60 * 1000).toISOString() 
              : null
          })
          .eq('id', emp.id);

        console.log(`PIN failed for ${employee_code}, attempts: ${newAttempts}`);
        return new Response(
          JSON.stringify({ success: false, error: 'PIN incorrecto' }),
          { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Reset failed attempts on successful login
      await supabase
        .from('employees')
        .update({ pin_failed_attempts: 0, pin_locked_until: null })
        .eq('id', emp.id);

      employee = emp;
    }

    // Authenticate by QR
    if (action === 'qr' && qr_token) {
      // Parse QR token (format: employee_code:token_hash)
      const [empCode, tokenHash] = qr_token.split(':');
      
      const { data: qrData, error: qrError } = await supabase
        .from('employee_qr')
        .select('employee_id, is_active, employees(id, first_name, last_name, employee_code, status)')
        .eq('token_hash', tokenHash)
        .eq('is_active', true)
        .maybeSingle();

      if (qrError || !qrData || !qrData.employees) {
        console.error('QR not found or invalid:', qrError);
        return new Response(
          JSON.stringify({ success: false, error: 'Código QR no válido' }),
          { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const emp = qrData.employees as any;
      if (emp.status !== 'active') {
        return new Response(
          JSON.stringify({ success: false, error: 'Empleado no activo' }),
          { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      employee = emp;
    }

    if (!employee) {
      return new Response(
        JSON.stringify({ success: false, error: 'Método de autenticación no válido' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Determine event type and validate against last event
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const { data: lastEvent } = await supabase
      .from('time_events')
      .select('event_type, timestamp')
      .eq('employee_id', employee.id)
      .gte('timestamp', today.toISOString())
      .order('timestamp', { ascending: false })
      .limit(1)
      .maybeSingle();

    let finalEventType = event_type;
    if (!finalEventType) {
      // Toggle: if last was entry, next is exit; otherwise, entry
      finalEventType = lastEvent?.event_type === 'entry' ? 'exit' : 'entry';
    }

    // Validate: prevent duplicate consecutive events of the same type
    if (lastEvent && lastEvent.event_type === finalEventType) {
      const lastTypeEs = finalEventType === 'entry' ? 'Entrada' : 'Salida';
      const expectedTypeEs = finalEventType === 'entry' ? 'Salida' : 'Entrada';
      const lastTime = new Date(lastEvent.timestamp).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
      
      console.log(`Conflict: ${employee.employee_code} tried to register ${finalEventType} but last event was also ${lastEvent.event_type}`);
      
      return new Response(
        JSON.stringify({
          success: false,
          conflict: true,
          error: `No puedes registrar otra ${lastTypeEs}. Tu último fichaje de hoy (${lastTime}) ya fue ${lastTypeEs}. Deberías registrar ${expectedTypeEs}.`,
          last_event_type: lastEvent.event_type,
          last_event_time: lastEvent.timestamp,
        }),
        { status: 409, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Record the time event
    const now = new Date();
    const rawPayload = override_reason ? { override_reason } : null;
    
    const { data: timeEvent, error: eventError } = await supabase
      .from('time_events')
      .insert({
        employee_id: employee.id,
        event_type: finalEventType,
        event_source: action,
        timestamp: now.toISOString(),
        local_timestamp: now.toISOString(),
        terminal_id: terminal_id || null,
        timezone: 'Europe/Madrid',
        raw_payload: rawPayload,
      })
      .select()
      .single();

    if (eventError) {
      console.error('Error creating time event:', eventError);
      return new Response(
        JSON.stringify({ success: false, error: 'Error al registrar fichaje' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Time event created: ${timeEvent.id} - ${employee.first_name} ${employee.last_name} - ${finalEventType}`);

    return new Response(
      JSON.stringify({
        success: true,
        employee: {
          first_name: employee.first_name,
          last_name: employee.last_name,
          employee_code: employee.employee_code,
        },
        event: {
          id: timeEvent.id,
          type: finalEventType,
          timestamp: now.toISOString(),
        },
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Kiosk clock error:', error);
    return new Response(
      JSON.stringify({ success: false, error: 'Error interno del servidor' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
