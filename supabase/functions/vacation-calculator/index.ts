import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface VacationConfig {
  annual_days: number;
  compute_unit: 'natural' | 'working';
  accrual_type: 'annual' | 'monthly_prorate';
  carry_over_days: number;
  carry_over_deadline_month: number; // 1-12
}

const DEFAULT_CONFIG: VacationConfig = {
  annual_days: 22, // Working days (30 natural equivalent)
  compute_unit: 'working',
  accrual_type: 'annual',
  carry_over_days: 0,
  carry_over_deadline_month: 3, // March
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    const { company_id, year, employee_id, action } = await req.json();

    if (!company_id || !year) {
      throw new Error("company_id and year are required");
    }

    // Get company vacation configuration
    const { data: settings } = await supabaseClient
      .from('company_settings')
      .select('setting_value')
      .eq('company_id', company_id)
      .eq('setting_key', 'vacation_config')
      .maybeSingle();

    const config: VacationConfig = settings?.setting_value || DEFAULT_CONFIG;

    // Get all active employees for the company (or specific employee)
    let employeesQuery = supabaseClient
      .from('employees')
      .select('id, first_name, last_name, hire_date, termination_date')
      .eq('company_id', company_id)
      .eq('status', 'active');

    if (employee_id) {
      employeesQuery = employeesQuery.eq('id', employee_id);
    }

    const { data: employees, error: empError } = await employeesQuery;
    if (empError) throw empError;

    const results = [];

    for (const employee of employees || []) {
      // Calculate entitled days based on hire date and accrual type
      let entitledDays = config.annual_days;
      
      if (config.accrual_type === 'monthly_prorate' && employee.hire_date) {
        const hireDate = new Date(employee.hire_date);
        const yearStart = new Date(year, 0, 1);
        
        if (hireDate.getFullYear() === year) {
          // Calculate months worked in the year
          const monthsWorked = 12 - hireDate.getMonth();
          entitledDays = Math.round((config.annual_days / 12) * monthsWorked * 10) / 10;
        }
      }

      // Get previous year's carried over days
      let carriedOverDays = 0;
      if (config.carry_over_days > 0) {
        const { data: prevBalance } = await supabaseClient
          .from('vacation_balances')
          .select('available_days')
          .eq('employee_id', employee.id)
          .eq('year', year - 1)
          .maybeSingle();

        if (prevBalance && prevBalance.available_days > 0) {
          carriedOverDays = Math.min(prevBalance.available_days, config.carry_over_days);
        }
      }

      // Get used days from approved vacation requests
      const { data: approvedRequests } = await supabaseClient
        .from('absence_requests')
        .select('total_days, absence_types!inner(code)')
        .eq('employee_id', employee.id)
        .eq('status', 'approved')
        .gte('start_date', `${year}-01-01`)
        .lte('end_date', `${year}-12-31`)
        .eq('absence_types.code', 'VACACIONES');

      const usedDays = approvedRequests?.reduce((sum, r) => sum + (r.total_days || 0), 0) || 0;

      // Get pending days
      const { data: pendingRequests } = await supabaseClient
        .from('absence_requests')
        .select('total_days, absence_types!inner(code)')
        .eq('employee_id', employee.id)
        .eq('status', 'pending')
        .gte('start_date', `${year}-01-01`)
        .lte('end_date', `${year}-12-31`)
        .eq('absence_types.code', 'VACACIONES');

      const pendingDays = pendingRequests?.reduce((sum, r) => sum + (r.total_days || 0), 0) || 0;

      // Calculate available days
      const availableDays = Math.max(0, entitledDays + carriedOverDays - usedDays - pendingDays);

      // Upsert vacation balance
      const balanceData = {
        company_id,
        employee_id: employee.id,
        year,
        entitled_days: entitledDays,
        carried_over_days: carriedOverDays,
        used_days: usedDays,
        pending_days: pendingDays,
        available_days: availableDays,
        updated_at: new Date().toISOString(),
        notes: `Calculated on ${new Date().toISOString()}. Config: ${JSON.stringify(config)}`
      };

      const { data: existing } = await supabaseClient
        .from('vacation_balances')
        .select('id')
        .eq('employee_id', employee.id)
        .eq('year', year)
        .maybeSingle();

      if (existing) {
        await supabaseClient
          .from('vacation_balances')
          .update(balanceData)
          .eq('id', existing.id);
      } else {
        await supabaseClient
          .from('vacation_balances')
          .insert(balanceData);
      }

      results.push({
        ...balanceData,
        employee_name: `${employee.first_name} ${employee.last_name}`,
      });
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        year,
        employees_processed: results.length,
        balances: results 
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error: unknown) {
    console.error("Error in vacation-calculator:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
