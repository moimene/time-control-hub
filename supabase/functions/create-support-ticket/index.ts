import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.89.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'No authorization header' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get user from JWT
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: userError } = await supabase.auth.getUser(token);
    
    if (userError || !user) {
      return new Response(JSON.stringify({ error: 'Invalid token' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { subject, description, priority, category, conversationContext } = await req.json();

    if (!subject || !description) {
      return new Response(JSON.stringify({ error: 'Subject and description are required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Get user's employee record and company
    const { data: employee } = await supabase
      .from('employees')
      .select('id, company_id')
      .eq('user_id', user.id)
      .single();

    const companyId = employee?.company_id;

    // Find admin or asesor to assign the ticket to
    let assignedToUserId: string | null = null;
    let assignedToEmployeeId: string | null = null;

    if (companyId) {
      // First try to find an asesor (advisor) in the company
      const { data: asesor } = await supabase
        .from('employees')
        .select('id, user_id')
        .eq('company_id', companyId)
        .eq('position', 'asesor')
        .eq('status', 'active')
        .limit(1)
        .single();

      if (asesor?.user_id) {
        assignedToUserId = asesor.user_id;
        assignedToEmployeeId = asesor.id;
      } else {
        // Fall back to finding an admin-like user assigned to the same company.
        // Note: `user_roles` is global; company membership is tracked in `user_company` / `employees`.
        const { data: companyUsers, error: companyUsersError } = await supabase
          .from('user_company')
          .select('user_id')
          .eq('company_id', companyId);

        if (companyUsersError) {
          console.error('Error fetching company users:', companyUsersError);
        }

        const candidateUserIds = (companyUsers || [])
          .map((row: any) => row.user_id as string)
          .filter(Boolean);

        if (candidateUserIds.length > 0) {
          const { data: roleRows, error: rolesError } = await supabase
            .from('user_roles')
            .select('user_id, role')
            .in('user_id', candidateUserIds)
            .in('role', ['admin', 'super_admin', 'asesor']);

          if (rolesError) {
            console.error('Error fetching candidate roles:', rolesError);
          }

          const preferredOrder = ['asesor', 'admin', 'super_admin'] as const;
          const chosen = preferredOrder
            .map((role) => (roleRows || []).find((row: any) => row.role === role))
            .find(Boolean) as any;

          if (chosen?.user_id) {
            assignedToUserId = chosen.user_id;

            // Get assigned user's employee record if exists (used for notifications).
            const { data: assignedEmployee, error: assignedEmployeeError } = await supabase
              .from('employees')
              .select('id')
              .eq('user_id', assignedToUserId)
              .eq('company_id', companyId)
              .maybeSingle();

            if (assignedEmployeeError) {
              console.error('Error fetching assigned employee record:', assignedEmployeeError);
            }

            assignedToEmployeeId = assignedEmployee?.id || null;
          }
        }
      }
    }

    // Create the support ticket
    const { data: ticket, error: ticketError } = await supabase
      .from('support_tickets')
      .insert({
        company_id: companyId,
        created_by_user_id: user.id,
        created_by_employee_id: employee?.id,
        assigned_to_user_id: assignedToUserId,
        assigned_to_employee_id: assignedToEmployeeId,
        subject,
        description,
        priority: priority || 'medium',
        category: category || 'general',
        conversation_context: conversationContext,
      })
      .select()
      .single();

    if (ticketError) {
      console.error('Error creating ticket:', ticketError);
      throw new Error('Failed to create ticket');
    }

    // Create notification for assigned user
    if (assignedToEmployeeId && companyId) {
      await supabase
        .from('employee_notifications')
        .insert({
          company_id: companyId,
          employee_id: assignedToEmployeeId,
          notification_type: 'support_ticket',
          title: 'Nuevo ticket de soporte',
          message: `Se ha creado un nuevo ticket: ${subject}`,
          action_url: `/admin/tickets/${ticket.id}`,
          related_entity_type: 'support_ticket',
          related_entity_id: ticket.id,
        });
    }

    console.log('Ticket created successfully:', ticket.id);

    return new Response(JSON.stringify({ 
      success: true, 
      ticketId: ticket.id,
      message: 'Ticket creado correctamente'
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in create-support-ticket:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
