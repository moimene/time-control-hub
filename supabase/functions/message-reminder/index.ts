import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface ReminderConfig {
  reminder_intervals_hours: number[];
  max_reminders: number;
  email_on_deadline_approaching: boolean;
}

const DEFAULT_CONFIG: ReminderConfig = {
  reminder_intervals_hours: [24, 48, 72],
  max_reminders: 3,
  email_on_deadline_approaching: false
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    console.log('Starting message reminder dispatcher...');

    const now = new Date();

    // Find messages with pending recipients that need reminders
    const { data: pendingRecipients, error: recipientsError } = await supabase
      .from('message_recipients')
      .select(`
        *,
        message_threads!inner(
          id, subject, company_id, requires_read_confirmation, 
          requires_response, response_deadline, certification_level
        )
      `)
      .in('delivery_status', ['pending', 'delivered', 'notified_kiosk'])
      .lt('reminder_count', DEFAULT_CONFIG.max_reminders)
      .or('next_reminder_at.is.null,next_reminder_at.lte.' + now.toISOString());

    if (recipientsError) throw recipientsError;

    if (!pendingRecipients || pendingRecipients.length === 0) {
      console.log('No pending reminders needed');
      return new Response(
        JSON.stringify({ success: true, reminders_sent: 0 }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    let remindersSent = 0;
    let expiredCount = 0;

    for (const recipient of pendingRecipients) {
      const thread = recipient.message_threads;
      const deliveredAt = new Date(recipient.delivered_at || recipient.created_at);
      const hoursSinceDelivery = (now.getTime() - deliveredAt.getTime()) / (1000 * 60 * 60);

      // Check if deadline has passed
      if (thread.response_deadline && new Date(thread.response_deadline) < now) {
        // Mark as expired
        await supabase
          .from('message_recipients')
          .update({ delivery_status: 'expired' })
          .eq('id', recipient.id);

        // Create expiration evidence
        await createMessageEvidence(supabase, {
          company_id: thread.company_id,
          thread_id: thread.id,
          recipient_id: recipient.id,
          event_type: 'expired',
          event_data: {
            deadline: thread.response_deadline,
            reminder_count: recipient.reminder_count,
            actor_type: 'system'
          }
        });

        expiredCount++;
        continue;
      }

      // Determine if reminder is due
      const reminderCount = recipient.reminder_count || 0;
      const reminderThreshold = DEFAULT_CONFIG.reminder_intervals_hours[reminderCount] || 
        DEFAULT_CONFIG.reminder_intervals_hours[DEFAULT_CONFIG.reminder_intervals_hours.length - 1];

      if (hoursSinceDelivery >= reminderThreshold) {
        // Create kiosk notification for reminder
        await supabase.from('kiosk_notifications').insert({
          company_id: thread.company_id,
          employee_id: recipient.employee_id,
          notification_type: 'message',
          reference_id: thread.id,
          title: `Recordatorio: ${thread.subject}`,
          preview: `Tienes una comunicación pendiente de ${thread.requires_response ? 'responder' : 'leer'}`,
          priority: reminderCount >= 2 ? 'alta' : 'normal',
          expires_at: thread.response_deadline
        });

        // Calculate next reminder
        const nextReminderHours = DEFAULT_CONFIG.reminder_intervals_hours[reminderCount + 1];
        const nextReminderAt = nextReminderHours 
          ? new Date(now.getTime() + nextReminderHours * 60 * 60 * 1000).toISOString()
          : null;

        // Update recipient
        await supabase
          .from('message_recipients')
          .update({
            reminder_count: reminderCount + 1,
            last_reminder_at: now.toISOString(),
            next_reminder_at: nextReminderAt
          })
          .eq('id', recipient.id);

        // Create reminder evidence
        await createMessageEvidence(supabase, {
          company_id: thread.company_id,
          thread_id: thread.id,
          recipient_id: recipient.id,
          event_type: 'reminder',
          event_data: {
            reminder_number: reminderCount + 1,
            hours_since_delivery: Math.round(hoursSinceDelivery),
            actor_type: 'system'
          }
        });

        remindersSent++;
      }
    }

    console.log(`Reminder dispatch complete: ${remindersSent} sent, ${expiredCount} expired`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        reminders_sent: remindersSent,
        expired_count: expiredCount,
        processed_count: pendingRecipients.length
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in message-reminder:', error);
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
