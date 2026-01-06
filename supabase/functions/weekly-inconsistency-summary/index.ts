import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { Resend } from "https://esm.sh/resend@2.0.0";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface Inconsistency {
  employee_id: string;
  employee_name: string;
  employee_code: string;
  type: string;
  count: number;
}

interface DepartmentSummary {
  department: string;
  responsible_email: string;
  responsible_name: string;
  inconsistencies: Inconsistency[];
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    // Get all companies with weekly summary enabled
    const { data: companies, error: companiesError } = await supabaseClient
      .from('company')
      .select('id, name');

    if (companiesError) throw companiesError;

    for (const company of companies || []) {
      // Check if weekly summary is enabled for this company
      const { data: settings } = await supabaseClient
        .from('company_settings')
        .select('setting_value')
        .eq('company_id', company.id)
        .eq('setting_key', 'notifications')
        .maybeSingle();

      const notificationSettings = settings?.setting_value as { weekly_summary_enabled?: boolean } | null;
      if (notificationSettings?.weekly_summary_enabled === false) {
        console.log(`Weekly summary disabled for company ${company.name}`);
        continue;
      }

      // Get all department responsibles
      const { data: responsibles, error: responsiblesError } = await supabaseClient
        .from('employees')
        .select('id, first_name, last_name, email, department')
        .eq('company_id', company.id)
        .eq('is_department_responsible', true)
        .eq('status', 'active')
        .not('email', 'is', null)
        .not('department', 'is', null);

      if (responsiblesError) {
        console.error(`Error fetching responsibles for ${company.name}:`, responsiblesError);
        continue;
      }

      if (!responsibles || responsibles.length === 0) {
        console.log(`No department responsibles found for ${company.name}`);
        continue;
      }

      // Get time events from the last 7 days
      const oneWeekAgo = new Date();
      oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);

      for (const responsible of responsibles) {
        // Get employees in this department
        const { data: deptEmployees, error: empError } = await supabaseClient
          .from('employees')
          .select('id, first_name, last_name, employee_code')
          .eq('company_id', company.id)
          .eq('department', responsible.department)
          .eq('status', 'active');

        if (empError || !deptEmployees?.length) continue;

        const employeeIds = deptEmployees.map(e => e.id);

        // Get time events for department employees
        const { data: events, error: eventsError } = await supabaseClient
          .from('time_events')
          .select('*')
          .in('employee_id', employeeIds)
          .gte('event_timestamp', oneWeekAgo.toISOString())
          .order('employee_id')
          .order('event_timestamp', { ascending: true });

        if (eventsError) {
          console.error(`Error fetching events:`, eventsError);
          continue;
        }

        // Detect inconsistencies
        const inconsistenciesByEmployee: Map<string, { consecutive: number; orphan: number }> = new Map();

        const groupedByEmployee: Record<string, any[]> = events?.reduce((acc, event) => {
          if (!acc[event.employee_id]) acc[event.employee_id] = [];
          acc[event.employee_id].push(event);
          return acc;
        }, {} as Record<string, any[]>) || {};

        for (const employeeId of Object.keys(groupedByEmployee)) {
          const empEvents = groupedByEmployee[employeeId];
          let consecutive = 0;
          let orphan = 0;

          for (let i = 0; i < empEvents.length; i++) {
            const current = empEvents[i];
            const prev = i > 0 ? empEvents[i - 1] : null;

            // Check consecutive same type
            if (prev && prev.event_type === current.event_type) {
              consecutive++;
            }

            // Check orphan entries (entry without exit for >12 hours)
            if (current.event_type === 'entry') {
              const next = empEvents[i + 1];
              if (!next || next.event_type !== 'exit') {
                const eventTime = new Date(current.event_timestamp).getTime();
                const now = Date.now();
                if (now - eventTime > 12 * 60 * 60 * 1000) {
                  orphan++;
                }
              }
            }
          }

          if (consecutive > 0 || orphan > 0) {
            inconsistenciesByEmployee.set(employeeId, { consecutive, orphan });
          }
        }

        if (inconsistenciesByEmployee.size === 0) {
          console.log(`No inconsistencies for department ${responsible.department}`);
          continue;
        }

        // Build summary email
        const employeeInconsistencies = Array.from(inconsistenciesByEmployee.entries()).map(([empId, counts]) => {
          const emp = deptEmployees.find(e => e.id === empId);
          return {
            name: emp ? `${emp.first_name} ${emp.last_name}` : 'Desconocido',
            code: emp?.employee_code || '',
            consecutive: counts.consecutive,
            orphan: counts.orphan,
          };
        });

        const totalIssues = employeeInconsistencies.reduce((sum, e) => sum + e.consecutive + e.orphan, 0);

        const emailHtml = `
          <!DOCTYPE html>
          <html>
          <head>
            <meta charset="utf-8">
            <style>
              body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
              .container { max-width: 600px; margin: 0 auto; padding: 20px; }
              .header { background-color: #3b82f6; color: white; padding: 20px; border-radius: 8px 8px 0 0; }
              .content { background-color: #f8fafc; padding: 20px; border-radius: 0 0 8px 8px; }
              table { width: 100%; border-collapse: collapse; margin: 15px 0; }
              th, td { padding: 10px; text-align: left; border-bottom: 1px solid #e2e8f0; }
              th { background-color: #f1f5f9; }
              .footer { margin-top: 20px; font-size: 12px; color: #666; }
              .stat { display: inline-block; margin-right: 20px; }
              .stat-value { font-size: 24px; font-weight: bold; color: #3b82f6; }
            </style>
          </head>
          <body>
            <div class="container">
              <div class="header">
                <h1>📊 Resumen Semanal de Inconsistencias</h1>
                <p>Departamento: ${responsible.department}</p>
              </div>
              <div class="content">
                <p>Hola <strong>${responsible.first_name}</strong>,</p>
                <p>Este es el resumen semanal de inconsistencias en los fichajes de tu departamento:</p>
                
                <div style="margin: 20px 0;">
                  <span class="stat">
                    <span class="stat-value">${employeeInconsistencies.length}</span>
                    <br>Empleados afectados
                  </span>
                  <span class="stat">
                    <span class="stat-value">${totalIssues}</span>
                    <br>Total inconsistencias
                  </span>
                </div>

                <table>
                  <thead>
                    <tr>
                      <th>Empleado</th>
                      <th>Código</th>
                      <th>Fichajes Consecutivos</th>
                      <th>Entradas Huérfanas</th>
                    </tr>
                  </thead>
                  <tbody>
                    ${employeeInconsistencies.map(e => `
                      <tr>
                        <td>${e.name}</td>
                        <td>${e.code}</td>
                        <td>${e.consecutive > 0 ? `⚠️ ${e.consecutive}` : '✓'}</td>
                        <td>${e.orphan > 0 ? `⚠️ ${e.orphan}` : '✓'}</td>
                      </tr>
                    `).join('')}
                  </tbody>
                </table>

                <p>Te recomendamos revisar estos casos y contactar con los empleados afectados para regularizar sus fichajes.</p>
              </div>
              <div class="footer">
                <p>Este es un mensaje automático del sistema de fichajes de ${company.name}.</p>
              </div>
            </div>
          </body>
          </html>
        `;

        console.log(`Sending weekly summary to ${responsible.email} for department ${responsible.department}`);

        const emailResponse = await resend.emails.send({
          from: `${company.name} Fichajes <onboarding@resend.dev>`,
          to: [responsible.email],
          subject: `📊 Resumen Semanal: ${employeeInconsistencies.length} empleados con inconsistencias - ${responsible.department}`,
          html: emailHtml,
        });

        console.log("Weekly summary sent:", emailResponse);

        // Log in audit
        await supabaseClient.from('audit_log').insert({
          action: 'weekly_inconsistency_summary',
          actor_type: 'system',
          entity_type: 'notification',
          entity_id: responsible.id,
          company_id: company.id,
          new_values: {
            department: responsible.department,
            responsible_email: responsible.email,
            employees_with_issues: employeeInconsistencies.length,
            total_inconsistencies: totalIssues,
          },
        });
      }
    }

    return new Response(
      JSON.stringify({ success: true }),
      { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  } catch (error: any) {
    console.error("Error in weekly-inconsistency-summary function:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }
};

serve(handler);
