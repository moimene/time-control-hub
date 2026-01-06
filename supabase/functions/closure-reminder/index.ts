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

    const now = new Date();
    const dayOfMonth = now.getDate();
    
    // Only run reminders on days 3-10 of the month
    if (dayOfMonth < 3 || dayOfMonth > 10) {
      console.log(`Day ${dayOfMonth}: No reminders needed (only days 3-10)`);
      return new Response(
        JSON.stringify({ message: 'No reminders needed today' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Calculate previous month
    const prevMonth = now.getMonth() === 0 ? 12 : now.getMonth();
    const prevYear = now.getMonth() === 0 ? now.getFullYear() - 1 : now.getFullYear();

    console.log(`Checking closure reminders for ${prevYear}-${String(prevMonth).padStart(2, '0')}`);

    // Get all active employees
    const { data: employees, error: empError } = await supabase
      .from('employees')
      .select('id, first_name, last_name, company_id, email')
      .eq('status', 'active');

    if (empError) {
      console.error('Error fetching employees:', empError);
      throw empError;
    }

    // Get existing signed closures for previous month
    const { data: signedClosures, error: closuresError } = await supabase
      .from('monthly_closures')
      .select('employee_id')
      .eq('year', prevYear)
      .eq('month', prevMonth)
      .eq('status', 'signed');

    if (closuresError) {
      console.error('Error fetching closures:', closuresError);
      throw closuresError;
    }

    const signedEmployeeIds = new Set(signedClosures?.map(c => c.employee_id) || []);
    const employeesWithoutClosure = employees?.filter(e => !signedEmployeeIds.has(e.id)) || [];

    console.log(`Found ${employeesWithoutClosure.length} employees without signed closure`);

    const monthNames = [
      'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
      'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'
    ];
    const monthName = monthNames[prevMonth - 1];

    let employeeNotifications = 0;
    let companyIncidents = 0;

    for (const employee of employeesWithoutClosure) {
      // Check if we already sent a reminder recently (within last 24h)
      const { data: recentNotification } = await supabase
        .from('employee_notifications')
        .select('id')
        .eq('employee_id', employee.id)
        .eq('notification_type', 'closure_reminder')
        .gte('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
        .limit(1);

      if (recentNotification && recentNotification.length > 0) {
        continue; // Skip, already notified today
      }

      if (dayOfMonth >= 3 && dayOfMonth <= 6) {
        // Days 3-6: Send reminder to employee
        await supabase.from('employee_notifications').insert({
          company_id: employee.company_id,
          employee_id: employee.id,
          notification_type: 'closure_reminder',
          title: 'Recordatorio: Cierre mensual pendiente',
          message: `Tu cierre de horas de ${monthName} ${prevYear} está pendiente de firma. Por favor, revisa y firma el cierre mensual.`,
          action_url: '/employee/closure',
          related_entity_type: 'monthly_closure'
        });
        employeeNotifications++;
        console.log(`Sent reminder to employee ${employee.id}`);
      } else if (dayOfMonth >= 7) {
        // Days 7+: Create incident for company
        const { data: existingIncident } = await supabase
          .from('compliance_incidents')
          .select('id')
          .eq('company_id', employee.company_id)
          .eq('title', `Cierre pendiente: ${employee.first_name} ${employee.last_name}`)
          .eq('status', 'open')
          .limit(1);

        if (!existingIncident || existingIncident.length === 0) {
          await supabase.from('compliance_incidents').insert({
            company_id: employee.company_id,
            title: `Cierre pendiente: ${employee.first_name} ${employee.last_name}`,
            description: `El empleado ${employee.first_name} ${employee.last_name} no ha firmado el cierre mensual de ${monthName} ${prevYear}. Han pasado más de 7 días desde el inicio del mes.`,
            severity: 'medium',
            status: 'open',
            sla_due_at: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString() // 3 days SLA
          });
          companyIncidents++;
          console.log(`Created incident for employee ${employee.id}`);
        }

        // Also send final reminder to employee
        await supabase.from('employee_notifications').insert({
          company_id: employee.company_id,
          employee_id: employee.id,
          notification_type: 'closure_reminder',
          title: 'URGENTE: Cierre mensual pendiente',
          message: `Tu cierre de horas de ${monthName} ${prevYear} sigue pendiente de firma. Se ha notificado a la empresa. Por favor, firma el cierre lo antes posible.`,
          action_url: '/employee/closure',
          related_entity_type: 'monthly_closure'
        });
        employeeNotifications++;
      }
    }

    console.log(`Closure reminder completed: ${employeeNotifications} notifications, ${companyIncidents} incidents`);

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Closure reminders processed',
        data: {
          employees_without_closure: employeesWithoutClosure.length,
          notifications_sent: employeeNotifications,
          incidents_created: companyIncidents,
          month: `${prevYear}-${String(prevMonth).padStart(2, '0')}`
        }
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in closure-reminder:', error);
    return new Response(
      JSON.stringify({ error: 'Error interno del servidor' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
