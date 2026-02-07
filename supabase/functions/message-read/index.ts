import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { jsonResponse, requireCallerContext, requireCompanyAccess } from "../_shared/auth.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

type DeviceInfo = {
  type: 'kiosk' | 'web' | 'mobile';
  id?: string;
  ip?: string;
  user_agent?: string;
  userAgent?: string;
};

type MessageReadRequest = {
  recipientId?: string;
  threadId?: string;
  employeeId?: string;
  confirmRead?: boolean;
  deviceInfo?: DeviceInfo;
  // Legacy / snake_case inputs (still accepted)
  recipient_id?: string;
  thread_id?: string;
  employee_id?: string;
  confirm_read?: boolean;
  device_info?: DeviceInfo;
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const caller = await requireCallerContext({ req, supabaseAdmin: supabase, corsHeaders });
    if (caller instanceof Response) return caller;
    if (caller.kind !== 'user') {
      return jsonResponse({ error: 'Unauthorized caller' }, 401, corsHeaders);
    }

    const body: MessageReadRequest = await req.json().catch(() => ({}));
    const recipientId = body.recipientId || body.recipient_id;
    const thread_id = body.threadId || body.thread_id;
    const employee_id = body.employeeId || body.employee_id;
    const device_info = body.deviceInfo || body.device_info;
    const confirm_read = body.confirmRead ?? body.confirm_read ?? true;

    if (!recipientId && (!thread_id || !employee_id)) {
      return jsonResponse({ error: 'recipientId (or threadId+employeeId) is required' }, 400, corsHeaders);
    }

    // Get recipient record
    const recipientQuery = supabase
      .from('message_recipients')
      .select('*, message_threads(*)')
      .single();

    const { data: recipient, error: recipientError } = recipientId
      ? await recipientQuery.eq('id', recipientId)
      : await recipientQuery.eq('thread_id', thread_id).eq('employee_id', employee_id);

    if (recipientError || !recipient) {
      return jsonResponse({ error: 'Recipient not found' }, 404, corsHeaders);
    }

    // Only the recipient employee can confirm read (even if the caller is also admin-like).
    const companyAccess = await requireCompanyAccess({
      supabaseAdmin: supabase,
      ctx: caller,
      companyId: recipient.company_id,
      corsHeaders,
      allowEmployee: true,
    });
    if (companyAccess instanceof Response) return companyAccess;
    if (!companyAccess.employeeId || companyAccess.employeeId !== recipient.employee_id) {
      return jsonResponse({ error: 'Employees can only confirm read for their own messages' }, 403, corsHeaders);
    }

    const now = new Date().toISOString();
    const isFirstRead = !recipient.first_read_at;
    const thread = recipient.message_threads;

    // Prepare update data
    const updateData: Record<string, any> = {
      last_read_at: now,
      read_count: (recipient.read_count || 0) + 1,
      read_device_type: device_info?.type || 'web',
      read_device_id: device_info?.id,
      read_ip: device_info?.ip,
      read_user_agent: device_info?.user_agent || device_info?.userAgent
    };

    if (isFirstRead) {
      updateData.first_read_at = now;
      updateData.delivery_status = 'read';
    }

    // If confirmation required and confirmed
    if (thread.requires_read_confirmation && confirm_read) {
      updateData.delivery_status = 'read';
    }

    // Update recipient
    const { error: updateError } = await supabase
      .from('message_recipients')
      .update(updateData)
      .eq('id', recipient.id);

    if (updateError) throw updateError;

    // Create read evidence with QTSP
    if (isFirstRead || confirm_read) {
      // Get content hash from thread
      const { data: content } = await supabase
        .from('message_contents')
        .select('body_text, body_markdown, attachments')
        .eq('thread_id', recipient.thread_id)
        .eq('is_current', true)
        .single();

      const contentHash = await generateHash(JSON.stringify({
        body: content?.body_text || content?.body_markdown || '',
        attachments: content?.attachments || []
      }));

      await createMessageEvidence(supabase, {
        company_id: thread.company_id,
        thread_id: recipient.thread_id,
        recipient_id: recipient.id,
        event_type: 'read',
        event_data: {
          employee_id: recipient.employee_id,
          content_hash: contentHash,
          device_info,
          is_first_read: isFirstRead,
          confirmed: confirm_read,
          actor_type: 'user'
        }
      });

      // Update kiosk notification if exists
      await supabase
        .from('kiosk_notifications')
        .update({ 
          status: 'actioned', 
          actioned_at: now 
        })
        .eq('notification_type', 'message')
        .eq('reference_id', recipient.thread_id)
        .eq('employee_id', recipient.employee_id)
        .in('status', ['pending', 'shown']);
    }

    console.log(`Message ${recipient.thread_id} read by employee ${recipient.employee_id}`);

    return new Response(
      JSON.stringify({
        success: true,
        is_first_read: isFirstRead,
        read_count: updateData.read_count,
        requires_response: thread.requires_response,
        requires_signature: thread.requires_signature,
        response_deadline: thread.response_deadline
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error recording message read:', error);
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
