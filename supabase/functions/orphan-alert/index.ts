import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { Resend } from "https://esm.sh/resend@2.0.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface OrphanEntry {
  employee_name: string;
  employee_code: string;
  department: string | null;
  entry_time: string;
  hours_open: number;
}

interface CompanyOrphans {
  company_id: string;
  company_name: string;
  admin_emails: string[];
  orphans: OrphanEntry[];
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const resendApiKey = Deno.env.get("RESEND_API_KEY");
    if (!resendApiKey) {
      console.log("RESEND_API_KEY not configured, skipping email notifications");
      return new Response(
        JSON.stringify({ success: false, message: "RESEND_API_KEY not configured" }),
        { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    const resend = new Resend(resendApiKey);
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const now = new Date();
    const twentyFourHoursAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);

    // Get all entries older than 24 hours
    const { data: entries, error: entriesError } = await supabase
      .from("time_events")
      .select(`
        id,
        employee_id,
        timestamp,
        local_timestamp,
        company_id,
        employees!inner(
          first_name,
          last_name,
          employee_code,
          department
        ),
        company!inner(
          id,
          name
        )
      `)
      .eq("event_type", "entry")
      .lt("timestamp", twentyFourHoursAgo.toISOString())
      .order("timestamp", { ascending: false });

    if (entriesError) {
      console.error("Error fetching entries:", entriesError);
      throw entriesError;
    }

    // Check which entries are orphans (no exit after them)
    const orphansByCompany: Record<string, CompanyOrphans> = {};

    for (const entry of entries || []) {
      // Check if there's an exit after this entry
      const { data: exitAfter } = await supabase
        .from("time_events")
        .select("id")
        .eq("employee_id", entry.employee_id)
        .eq("event_type", "exit")
        .gt("timestamp", entry.timestamp)
        .limit(1);

      if (!exitAfter || exitAfter.length === 0) {
        const companyId = entry.company_id;
        const emp = entry.employees as any;
        const comp = entry.company as any;
        const entryDate = new Date(entry.timestamp);
        const hoursOpen = Math.floor((now.getTime() - entryDate.getTime()) / (1000 * 60 * 60));

        if (!orphansByCompany[companyId]) {
          // Get admin emails for this company
          const { data: admins } = await supabase
            .from("user_company")
            .select(`
              user_id,
              auth.users!inner(email)
            `)
            .eq("company_id", companyId);

          // Also get admins from employees table
          const { data: employeeAdmins } = await supabase
            .from("employees")
            .select("email")
            .eq("company_id", companyId)
            .not("email", "is", null);

          const adminEmails: string[] = [];
          
          // Get emails from user_roles for admins
          const { data: adminRoles } = await supabase
            .from("user_roles")
            .select("user_id")
            .eq("role", "admin");

          if (adminRoles) {
            for (const role of adminRoles) {
              const { data: userData } = await supabase.auth.admin.getUserById(role.user_id);
              if (userData?.user?.email) {
                // Check if this admin belongs to the company
                const { data: belongsToCompany } = await supabase
                  .from("user_company")
                  .select("id")
                  .eq("user_id", role.user_id)
                  .eq("company_id", companyId)
                  .limit(1);

                const { data: employeeBelongs } = await supabase
                  .from("employees")
                  .select("id")
                  .eq("user_id", role.user_id)
                  .eq("company_id", companyId)
                  .limit(1);

                if ((belongsToCompany && belongsToCompany.length > 0) || 
                    (employeeBelongs && employeeBelongs.length > 0)) {
                  adminEmails.push(userData.user.email);
                }
              }
            }
          }

          orphansByCompany[companyId] = {
            company_id: companyId,
            company_name: comp.name,
            admin_emails: adminEmails,
            orphans: [],
          };
        }

        orphansByCompany[companyId].orphans.push({
          employee_name: `${emp.first_name} ${emp.last_name}`,
          employee_code: emp.employee_code,
          department: emp.department,
          entry_time: new Date(entry.local_timestamp).toLocaleString("es-ES", {
            weekday: "long",
            day: "numeric",
            month: "long",
            hour: "2-digit",
            minute: "2-digit",
          }),
          hours_open: hoursOpen,
        });
      }
    }

    // Send emails for each company with orphans
    let emailsSent = 0;
    const errors: string[] = [];

    for (const company of Object.values(orphansByCompany)) {
      if (company.orphans.length === 0 || company.admin_emails.length === 0) {
        continue;
      }

      const orphanList = company.orphans
        .map(o => `
          <tr>
            <td style="padding: 8px; border-bottom: 1px solid #e5e7eb;">${o.employee_name}</td>
            <td style="padding: 8px; border-bottom: 1px solid #e5e7eb;">${o.employee_code}</td>
            <td style="padding: 8px; border-bottom: 1px solid #e5e7eb;">${o.department || "-"}</td>
            <td style="padding: 8px; border-bottom: 1px solid #e5e7eb;">${o.entry_time}</td>
            <td style="padding: 8px; border-bottom: 1px solid #e5e7eb; color: #dc2626; font-weight: bold;">${o.hours_open}h</td>
          </tr>
        `)
        .join("");

      const htmlContent = `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <title>Fichajes Huérfanos Detectados</title>
        </head>
        <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; padding: 20px; background-color: #f9fafb;">
          <div style="max-width: 600px; margin: 0 auto; background: white; border-radius: 8px; padding: 24px; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
            <div style="text-align: center; margin-bottom: 24px;">
              <h1 style="color: #111827; margin: 0;">⚠️ Fichajes Huérfanos</h1>
              <p style="color: #6b7280; margin-top: 8px;">${company.company_name}</p>
            </div>
            
            <div style="background: #fef3c7; border-left: 4px solid #f59e0b; padding: 12px 16px; margin-bottom: 24px; border-radius: 4px;">
              <p style="margin: 0; color: #92400e;">
                <strong>Atención:</strong> Se han detectado ${company.orphans.length} fichaje(s) de entrada sin salida correspondiente con más de 24 horas de antigüedad.
              </p>
            </div>
            
            <table style="width: 100%; border-collapse: collapse; font-size: 14px;">
              <thead>
                <tr style="background: #f3f4f6;">
                  <th style="padding: 12px 8px; text-align: left; border-bottom: 2px solid #e5e7eb;">Empleado</th>
                  <th style="padding: 12px 8px; text-align: left; border-bottom: 2px solid #e5e7eb;">Código</th>
                  <th style="padding: 12px 8px; text-align: left; border-bottom: 2px solid #e5e7eb;">Departamento</th>
                  <th style="padding: 12px 8px; text-align: left; border-bottom: 2px solid #e5e7eb;">Entrada</th>
                  <th style="padding: 12px 8px; text-align: left; border-bottom: 2px solid #e5e7eb;">Tiempo Abierto</th>
                </tr>
              </thead>
              <tbody>
                ${orphanList}
              </tbody>
            </table>
            
            <div style="margin-top: 24px; padding-top: 24px; border-top: 1px solid #e5e7eb;">
              <p style="color: #6b7280; font-size: 14px; margin: 0;">
                Accede al panel de administración para gestionar estos fichajes huérfanos.
              </p>
              <p style="color: #9ca3af; font-size: 12px; margin-top: 16px;">
                Este es un mensaje automático del sistema de Control Horario.
              </p>
            </div>
          </div>
        </body>
        </html>
      `;

      try {
        await resend.emails.send({
          from: "Control Horario <onboarding@resend.dev>",
          to: company.admin_emails,
          subject: `⚠️ ${company.orphans.length} fichaje(s) huérfano(s) detectado(s) - ${company.company_name}`,
          html: htmlContent,
        });
        emailsSent++;
        console.log(`Email sent to ${company.admin_emails.join(", ")} for ${company.company_name}`);
      } catch (emailError: any) {
        console.error(`Error sending email for ${company.company_name}:`, emailError);
        errors.push(`${company.company_name}: ${emailError.message}`);
      }
    }

    const totalOrphans = Object.values(orphansByCompany).reduce((sum, c) => sum + c.orphans.length, 0);

    return new Response(
      JSON.stringify({
        success: true,
        total_orphans: totalOrphans,
        companies_affected: Object.keys(orphansByCompany).length,
        emails_sent: emailsSent,
        errors: errors.length > 0 ? errors : undefined,
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  } catch (error: any) {
    console.error("Error in orphan-alert function:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  }
});
