import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  jsonResponse,
  requireAnyRole,
  requireCallerContext,
  requireCompanyAccess,
} from "../_shared/auth.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface SendRequest {
  thread_id: string;
  send_now?: boolean;
  scheduled_at?: string;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const caller = await requireCallerContext({
      req,
      supabaseAdmin: supabase,
      corsHeaders,
      allowServiceRole: true,
    });
    if (caller instanceof Response) return caller;

    const { thread_id, send_now = true, scheduled_at }: SendRequest = await req.json();

    if (!thread_id) {
      return jsonResponse({ error: 'thread_id is required' }, 400, corsHeaders);
    }

    // Get thread with content
    const { data: thread, error: threadError } = await supabase
      .from('message_threads')
      .select(`
        *,
        message_contents(*)
      `)
      .eq('id', thread_id)
      .single();

    if (threadError || !thread) {
      return new Response(
        JSON.stringify({ error: 'Thread not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (caller.kind === 'user') {
      const roleError = requireAnyRole({
        ctx: caller,
        allowed: ['super_admin', 'admin', 'responsible'],
        corsHeaders,
      });
      if (roleError) return roleError;

      const companyAccess = await requireCompanyAccess({
        supabaseAdmin: supabase,
        ctx: caller,
        companyId: thread.company_id,
        corsHeaders,
        allowEmployee: true,
      });
      if (companyAccess instanceof Response) return companyAccess;
    }

    if (thread.status !== 'draft' && thread.status !== 'scheduled') {
      return new Response(
        JSON.stringify({ error: 'Thread already sent or closed' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Calculate recipients based on audience_type
    let recipientIds: string[] = [];
    const { audience_type, audience_filter, company_id } = thread;

    if (audience_type === 'all') {
      const { data: employees } = await supabase
        .from('employees')
        .select('id')
        .eq('company_id', company_id)
        .eq('status', 'active');
      recipientIds = employees?.map(e => e.id) || [];
    } else if (audience_type === 'department' && audience_filter?.department) {
      const { data: employees } = await supabase
        .from('employees')
        .select('id')
        .eq('company_id', company_id)
        .eq('status', 'active')
        .eq('department', audience_filter.department);
      recipientIds = employees?.map(e => e.id) || [];
    } else if ((audience_type === 'individual' || audience_type === 'custom') && audience_filter?.employee_ids) {
      recipientIds = audience_filter.employee_ids;
    }

    if (recipientIds.length === 0) {
      return new Response(
        JSON.stringify({ error: 'No recipients found for the specified audience' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Generate content hash
    const content = thread.message_contents?.[0];
    const contentToHash = {
      subject: thread.subject,
      body: content?.body_text || content?.body_markdown || '',
      attachments: content?.attachments || [],
      timestamp: new Date().toISOString()
    };
    const contentHash = await generateHash(JSON.stringify(contentToHash));

    // Generate recipients list hash
    const recipientsHash = await generateHash(JSON.stringify(recipientIds.sort()));

    const now = new Date().toISOString();
    const sendAt = send_now ? now : scheduled_at;

    // Update thread status
    const newStatus = send_now ? 'sent' : 'scheduled';
    const { error: updateError } = await supabase
      .from('message_threads')
      .update({
        status: newStatus,
        sent_at: send_now ? now : null,
        scheduled_at: scheduled_at || null,
        recipient_count: recipientIds.length
      })
      .eq('id', thread_id);

    if (updateError) throw updateError;

    // If sending now, the trigger will create recipients
    // For scheduled, we'll create them when the scheduler runs

    if (send_now) {
      const actor =
        caller.kind === 'user'
          ? { actor_type: 'user', actor_id: caller.userId }
          : { actor_type: 'system' };

      // Create send evidence with QTSP
      await createMessageEvidence(supabase, {
        company_id,
        thread_id,
        event_type: 'sent',
        event_data: {
          content_hash: contentHash,
          recipients_hash: recipientsHash,
          recipient_count: recipientIds.length,
          ...actor
        }
      });

      // Create delivery evidence for each recipient
      const { data: recipients } = await supabase
        .from('message_recipients')
        .select('id, employee_id')
        .eq('thread_id', thread_id);

      if (recipients) {
        for (const recipient of recipients) {
          await createMessageEvidence(supabase, {
            company_id,
            thread_id,
            recipient_id: recipient.id,
            event_type: 'delivered',
            event_data: {
              employee_id: recipient.employee_id,
              actor_type: 'system'
            }
          });
        }
      }
    }

    console.log(`Message ${thread_id} ${newStatus} to ${recipientIds.length} recipients`);

    return new Response(
      JSON.stringify({
        success: true,
        status: newStatus,
        recipient_count: recipientIds.length,
        content_hash: contentHash
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error sending message:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

async function generateHash(content: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(content);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

async function createMessageEvidence(
  supabase: any,
  params: {
    company_id: string;
    thread_id: string;
    recipient_id?: string;
    event_type: string;
    event_data: Record<string, any>;
  }
): Promise<void> {
  try {
    // Get previous hash for chain
    const { data: lastEvidence } = await supabase
      .from('message_evidence')
      .select('content_hash')
      .eq('thread_id', params.thread_id)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    const previousHash = lastEvidence?.content_hash || null;
    const eventTimestamp = new Date().toISOString();

    const dataToHash = {
      event_type: params.event_type,
      thread_id: params.thread_id,
      recipient_id: params.recipient_id,
      event_timestamp: eventTimestamp,
      event_data: params.event_data,
      previous_hash: previousHash
    };

    const contentHash = await generateHash(JSON.stringify(dataToHash));

    // Insert evidence (QTSP certification will be handled by message-certify)
    await supabase.from('message_evidence').insert({
      company_id: params.company_id,
      thread_id: params.thread_id,
      recipient_id: params.recipient_id,
      event_type: params.event_type,
      event_timestamp: eventTimestamp,
      event_data: params.event_data,
      content_hash: contentHash,
      previous_hash: previousHash
    });
  } catch (error) {
    console.error('Error creating message evidence:', error);
  }
}
