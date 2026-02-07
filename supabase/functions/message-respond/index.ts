import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { jsonResponse, requireCallerContext, requireCompanyAccess } from "../_shared/auth.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

type DeviceInfo = {
  type: 'kiosk' | 'web' | 'mobile';
  ip?: string;
  user_agent?: string;
  userAgent?: string;
};

type SignatureData = {
  type: 'checkbox' | 'drawn';
  value: string | boolean;
  timestamp: string;
};

type MessageRespondRequest = {
  recipientId?: string;
  threadId?: string;
  employeeId?: string;
  responseText?: string;
  responseAttachments?: string[];
  formData?: Record<string, any>;
  signatureData?: SignatureData;
  deviceInfo?: DeviceInfo;
  sign?: boolean;
  // Legacy / snake_case inputs (still accepted)
  recipient_id?: string;
  thread_id?: string;
  employee_id?: string;
  response_text?: string;
  response_attachments?: string[];
  form_data?: Record<string, any>;
  signature_data?: SignatureData;
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

    const body: MessageRespondRequest = await req.json().catch(() => ({}));
    const recipientId = body.recipientId || body.recipient_id;
    const thread_id = body.threadId || body.thread_id;
    const employee_id = body.employeeId || body.employee_id;
    const response_text = body.responseText ?? body.response_text;
    const response_attachments = body.responseAttachments ?? body.response_attachments;
    const form_data = body.formData ?? body.form_data;
    let signature_data = body.signatureData ?? body.signature_data;
    const device_info = body.deviceInfo || body.device_info;
    const sign = body.sign;

    if (!recipientId && (!thread_id || !employee_id)) {
      return jsonResponse({ error: 'recipientId (or threadId+employeeId) is required' }, 400, corsHeaders);
    }

    // Get recipient record with thread
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

    const thread = recipient.message_threads;
    const now = new Date().toISOString();

    const companyAccess = await requireCompanyAccess({
      supabaseAdmin: supabase,
      ctx: caller,
      companyId: recipient.company_id,
      corsHeaders,
      allowEmployee: true,
    });
    if (companyAccess instanceof Response) return companyAccess;
    if (!companyAccess.employeeId || companyAccess.employeeId !== recipient.employee_id) {
      return jsonResponse({ error: 'Employees can only respond/sign for their own messages' }, 403, corsHeaders);
    }

    // Validate requirements
    if (thread.requires_response && !response_text && !form_data && !response_attachments?.length) {
      return new Response(
        JSON.stringify({ error: 'Response is required for this message' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (thread.requires_signature && !signature_data) {
      if (sign) {
        signature_data = { type: 'checkbox', value: true, timestamp: now };
      } else {
        return jsonResponse({ error: 'Signature is required for this message' }, 400, corsHeaders);
      }
    }

    // Check deadline
    if (thread.response_deadline && new Date(thread.response_deadline) < new Date()) {
      return new Response(
        JSON.stringify({ error: 'Response deadline has passed' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Generate hashes
    const responseHash = response_text ? await generateHash(response_text) : null;
    const attachmentsHash = response_attachments?.length 
      ? await generateHash(JSON.stringify(response_attachments))
      : null;
    const signatureHash = signature_data 
      ? await generateHash(JSON.stringify(signature_data))
      : null;

    // Prepare update data
    const updateData: Record<string, any> = {
      updated_at: now
    };

    if (response_text) {
      updateData.response_text = response_text;
      updateData.responded_at = now;
      updateData.delivery_status = 'responded';
    }

    if (response_attachments?.length) {
      updateData.response_attachments = response_attachments;
      updateData.responded_at = now;
      updateData.delivery_status = 'responded';
    }

    if (form_data) {
      updateData.response_form_data = form_data;
      updateData.responded_at = now;
      updateData.delivery_status = 'responded';
    }

    if (signature_data) {
      updateData.signature_data = signature_data;
      updateData.signed_at = now;
      updateData.delivery_status = 'signed';
    }

    // Update recipient
    const { error: updateError } = await supabase
      .from('message_recipients')
      .update(updateData)
      .eq('id', recipient.id);

    if (updateError) throw updateError;

    // Create response evidence
    if (response_text || form_data || response_attachments?.length) {
      await createMessageEvidence(supabase, {
        company_id: thread.company_id,
        thread_id: recipient.thread_id,
        recipient_id: recipient.id,
        event_type: 'responded',
        event_data: {
          employee_id: recipient.employee_id,
          response_hash: responseHash,
          attachments_hash: attachmentsHash,
          has_form_data: !!form_data,
          device_info,
          actor_type: 'user'
        }
      });
    }

    // Create signature evidence (separate, with higher certification level)
    if (signature_data) {
      // Get document content hash for signature evidence
      const { data: content } = await supabase
        .from('message_contents')
        .select('body_text, body_markdown')
        .eq('thread_id', recipient.thread_id)
        .eq('is_current', true)
        .single();

      const documentHash = await generateHash(JSON.stringify({
        subject: thread.subject,
        body: content?.body_text || content?.body_markdown || ''
      }));

      await createMessageEvidence(supabase, {
        company_id: thread.company_id,
        thread_id: recipient.thread_id,
        recipient_id: recipient.id,
        event_type: 'signed',
        event_data: {
          employee_id: recipient.employee_id,
          document_hash: documentHash,
          signature_hash: signatureHash,
          signature_type: signature_data.type,
          device_info,
          actor_type: 'user'
        }
      });

      // Update recipient with evidence ID
      const { data: signatureEvidence } = await supabase
        .from('message_evidence')
        .select('id')
        .eq('thread_id', recipient.thread_id)
        .eq('recipient_id', recipient.id)
        .eq('event_type', 'signed')
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      if (signatureEvidence) {
        await supabase
          .from('message_recipients')
          .update({ signature_evidence_id: signatureEvidence.id })
          .eq('id', recipient.id);
      }
    }

    // Update kiosk notification if exists
    await supabase
      .from('kiosk_notifications')
      .update({
        status: 'actioned',
        actioned_at: now,
      })
      .eq('notification_type', 'message')
      .eq('reference_id', recipient.thread_id)
      .eq('employee_id', recipient.employee_id)
      .in('status', ['pending', 'shown']);

    // Notify sender about response (best-effort: sender might not have an employee record)
    try {
      const { data: senderEmployee } = await supabase
        .from('employees')
        .select('id')
        .eq('user_id', thread.created_by)
        .eq('company_id', thread.company_id)
        .maybeSingle();

      if (senderEmployee?.id) {
        await supabase.from('employee_notifications').insert({
          company_id: thread.company_id,
          employee_id: senderEmployee.id,
          notification_type: 'message_response',
          title: 'Respuesta recibida',
          message: `Un empleado ha respondido a "${thread.subject}"`,
          related_entity_type: 'message_thread',
          related_entity_id: recipient.thread_id,
        });
      }
    } catch (notificationError) {
      console.warn('Unable to notify sender about response:', notificationError);
    }

    console.log(
      `Response/signature recorded for message ${recipient.thread_id} by employee ${recipient.employee_id}`,
    );

    return new Response(
      JSON.stringify({
        success: true,
        response_recorded: !!(response_text || form_data || response_attachments?.length),
        signature_recorded: !!signature_data,
        response_hash: responseHash,
        signature_hash: signatureHash
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error recording response:', error);
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
