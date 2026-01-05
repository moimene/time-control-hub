import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Helper function to compute SHA-256 hash
async function computeHash(data: string): Promise<string> {
  const encoder = new TextEncoder();
  const dataBuffer = encoder.encode(data);
  const hashBuffer = await crypto.subtle.digest('SHA-256', dataBuffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

// Compute event hash for chain integrity
async function computeEventHash(event: {
  employee_id: string;
  event_type: string;
  timestamp: string;
  previous_hash: string | null;
}): Promise<string> {
  const dataToHash = `${event.employee_id}|${event.event_type}|${event.timestamp}|${event.previous_hash || 'GENESIS'}`;
  return computeHash(dataToHash);
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const body = await req.json();
    const { action, employee_code, pin, qr_token, terminal_id, event_type, override_reason, events, company_id: requestCompanyId } = body;
    
    console.log(`Kiosk clock action: ${action}, employee_code: ${employee_code}, terminal: ${terminal_id}${override_reason ? `, override_reason: ${override_reason}` : ''}`);

    // Get company_id from terminal if provided
    let companyId = requestCompanyId || null;
    if (terminal_id && !companyId) {
      const { data: terminal } = await supabase
        .from('terminals')
        .select('company_id')
        .eq('id', terminal_id)
        .maybeSingle();
      if (terminal?.company_id) {
        companyId = terminal.company_id;
      }
    }

    // ========== SYNC OFFLINE EVENTS ==========
    if (action === 'sync_offline' && events && Array.isArray(events)) {
      console.log(`Syncing ${events.length} offline events`);
      const results: Array<{ offline_uuid: string; success: boolean; error?: string; event_id?: string }> = [];

      for (const offlineEvent of events) {
        try {
          const { offline_uuid, employee_code: empCode, event_type: evtType, local_timestamp, auth_method, auth_data, override_reason: ovReason } = offlineEvent;

          // Check if already synced (prevent duplicates)
          const { data: existing } = await supabase
            .from('time_events')
            .select('id')
            .eq('offline_uuid', offline_uuid)
            .maybeSingle();

          if (existing) {
            console.log(`Event ${offline_uuid} already synced as ${existing.id}`);
            results.push({ offline_uuid, success: true, event_id: existing.id });
            continue;
          }

          // Get employee - filter by company if known
          let empQuery = supabase
            .from('employees')
            .select('id, first_name, last_name, employee_code, pin_hash, pin_salt, status, company_id')
            .eq('employee_code', empCode);
          
          if (companyId) {
            empQuery = empQuery.eq('company_id', companyId);
          }
          
          const { data: emp, error: empError } = await empQuery.maybeSingle();

          if (empError || !emp) {
            console.error(`Employee not found for offline event: ${empCode}`);
            results.push({ offline_uuid, success: false, error: 'Empleado no encontrado' });
            continue;
          }

          if (emp.status !== 'active') {
            results.push({ offline_uuid, success: false, error: 'Empleado no activo' });
            continue;
          }

          // Use employee's company_id if not set
          const eventCompanyId = companyId || emp.company_id;

          // Authenticate based on method
          if (auth_method === 'pin') {
            const encoder = new TextEncoder();
            const pinWithSalt = encoder.encode(auth_data + emp.pin_salt);
            const hashBuffer = await crypto.subtle.digest('SHA-256', pinWithSalt);
            const hashArray = Array.from(new Uint8Array(hashBuffer));
            const computedHash = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');

            if (computedHash !== emp.pin_hash) {
              console.log(`PIN verification failed for offline event ${offline_uuid}`);
              results.push({ offline_uuid, success: false, error: 'PIN incorrecto' });
              continue;
            }
          } else if (auth_method === 'qr') {
            const [, tokenHash] = auth_data.split(':');
            let qrQuery = supabase
              .from('employee_qr')
              .select('employee_id, is_active')
              .eq('token_hash', tokenHash)
              .eq('is_active', true);
            
            if (eventCompanyId) {
              qrQuery = qrQuery.eq('company_id', eventCompanyId);
            }
            
            const { data: qrData, error: qrError } = await qrQuery.maybeSingle();

            if (qrError || !qrData || qrData.employee_id !== emp.id) {
              console.log(`QR verification failed for offline event ${offline_uuid}`);
              results.push({ offline_uuid, success: false, error: 'QR no válido' });
              continue;
            }
          }

          // Get previous hash for chain integrity
          const { data: lastEventForHash } = await supabase
            .from('time_events')
            .select('event_hash')
            .eq('employee_id', emp.id)
            .order('timestamp', { ascending: false })
            .limit(1)
            .maybeSingle();

          const previousHash = lastEventForHash?.event_hash || null;

          // Compute hash for this event
          const eventHash = await computeEventHash({
            employee_id: emp.id,
            event_type: evtType,
            timestamp: local_timestamp,
            previous_hash: previousHash,
          });

          // Insert the time event
          const rawPayload = ovReason ? { override_reason: ovReason, offline_sync: true } : { offline_sync: true };
          
          const { data: timeEvent, error: eventError } = await supabase
            .from('time_events')
            .insert({
              employee_id: emp.id,
              event_type: evtType,
              event_source: auth_method,
              timestamp: local_timestamp,
              local_timestamp: local_timestamp,
              terminal_id: terminal_id || null,
              timezone: 'Europe/Madrid',
              raw_payload: rawPayload,
              event_hash: eventHash,
              previous_hash: previousHash,
              offline_uuid: offline_uuid,
              synced_at: new Date().toISOString(),
              company_id: eventCompanyId,
            })
            .select()
            .single();

          if (eventError) {
            console.error(`Error creating offline event ${offline_uuid}:`, eventError);
            results.push({ offline_uuid, success: false, error: 'Error al registrar' });
            continue;
          }

          console.log(`Offline event ${offline_uuid} synced as ${timeEvent.id}`);
          results.push({ offline_uuid, success: true, event_id: timeEvent.id });

        } catch (err) {
          console.error(`Error processing offline event:`, err);
          results.push({ offline_uuid: offlineEvent.offline_uuid, success: false, error: 'Error interno' });
        }
      }

      const synced = results.filter(r => r.success).length;
      const failed = results.filter(r => !r.success).length;
      console.log(`Sync complete: ${synced} synced, ${failed} failed`);

      return new Response(
        JSON.stringify({ success: true, results, synced, failed }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // ========== VALIDATE EMPLOYEE ==========
    if (action === 'validate' && employee_code) {
      let empQuery = supabase
        .from('employees')
        .select('id, first_name, last_name, status, company_id')
        .eq('employee_code', employee_code);
      
      if (companyId) {
        empQuery = empQuery.eq('company_id', companyId);
      }
      
      const { data: emp, error: empError } = await empQuery.maybeSingle();

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
        .select('id, status, company_id')
        .eq('id', terminal_id)
        .maybeSingle();
      
      if (terminalError || !terminal || terminal.status !== 'active') {
        console.error('Invalid terminal:', terminalError);
        return new Response(
          JSON.stringify({ success: false, error: 'Terminal no válido o inactivo' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      // Use terminal's company_id
      if (!companyId && terminal.company_id) {
        companyId = terminal.company_id;
      }
    }

    let employee = null;

    // ========== AUTHENTICATE BY PIN ==========
    if (action === 'pin' && employee_code && pin) {
      let empQuery = supabase
        .from('employees')
        .select('id, first_name, last_name, employee_code, pin_hash, pin_salt, pin_locked_until, pin_failed_attempts, status, company_id')
        .eq('employee_code', employee_code);
      
      if (companyId) {
        empQuery = empQuery.eq('company_id', companyId);
      }
      
      const { data: emp, error: empError } = await empQuery.maybeSingle();

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
      // Set company_id from employee if not already set
      if (!companyId && emp.company_id) {
        companyId = emp.company_id;
      }
    }

    // ========== AUTHENTICATE BY QR ==========
    if (action === 'qr' && qr_token) {
      // Parse QR token (format: employee_code:token_hash)
      const [empCode, tokenHash] = qr_token.split(':');
      
      let qrQuery = supabase
        .from('employee_qr')
        .select('employee_id, is_active, company_id, employees(id, first_name, last_name, employee_code, status, company_id)')
        .eq('token_hash', tokenHash)
        .eq('is_active', true);
      
      if (companyId) {
        qrQuery = qrQuery.eq('company_id', companyId);
      }
      
      const { data: qrData, error: qrError } = await qrQuery.maybeSingle();

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
      // Set company_id from employee if not already set
      if (!companyId && emp.company_id) {
        companyId = emp.company_id;
      }
    }

    if (!employee) {
      return new Response(
        JSON.stringify({ success: false, error: 'Método de autenticación no válido' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // ========== DETERMINE EVENT TYPE ==========
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

    // ========== RECORD TIME EVENT ==========
    const now = new Date();
    const rawPayload = override_reason ? { override_reason } : null;
    
    // Get previous hash for chain integrity
    const { data: lastEventForHash } = await supabase
      .from('time_events')
      .select('event_hash')
      .eq('employee_id', employee.id)
      .order('timestamp', { ascending: false })
      .limit(1)
      .maybeSingle();
    
    const previousHash = lastEventForHash?.event_hash || null;
    const timestamp = now.toISOString();
    
    // Compute hash for this event
    const eventHash = await computeEventHash({
      employee_id: employee.id,
      event_type: finalEventType,
      timestamp,
      previous_hash: previousHash,
    });
    
    const { data: timeEvent, error: eventError } = await supabase
      .from('time_events')
      .insert({
        employee_id: employee.id,
        event_type: finalEventType,
        event_source: action,
        timestamp,
        local_timestamp: timestamp,
        terminal_id: terminal_id || null,
        timezone: 'Europe/Madrid',
        raw_payload: rawPayload,
        event_hash: eventHash,
        previous_hash: previousHash,
        company_id: companyId,
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

    console.log(`Time event created: ${timeEvent.id} - ${employee.first_name} ${employee.last_name} - ${finalEventType} - hash: ${eventHash.substring(0, 8)}... - company: ${companyId}`);

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
