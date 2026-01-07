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
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    console.log('Starting scheduled message dispatcher...');

    const now = new Date();

    // Find scheduled messages ready to send
    const { data: scheduledThreads, error: threadsError } = await supabase
      .from('message_threads')
      .select('*')
      .eq('status', 'scheduled')
      .lte('scheduled_at', now.toISOString());

    if (threadsError) throw threadsError;

    if (!scheduledThreads || scheduledThreads.length === 0) {
      console.log('No scheduled messages ready to send');
      return new Response(
        JSON.stringify({ success: true, sent_count: 0 }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    let sentCount = 0;
    let errorCount = 0;

    for (const thread of scheduledThreads) {
      try {
        console.log(`Sending scheduled message: ${thread.id}`);

        // Update thread status to sent
        const { error: updateError } = await supabase
          .from('message_threads')
          .update({
            status: 'sent',
            sent_at: now.toISOString()
          })
          .eq('id', thread.id);

        if (updateError) throw updateError;

        // The trigger will create recipients automatically
        // Now invoke the message-send function to handle notifications
        const { error: sendError } = await supabase.functions.invoke('message-send', {
          body: { thread_id: thread.id, send_now: true }
        });

        if (sendError) {
          console.error(`Error sending message ${thread.id}:`, sendError);
          errorCount++;
        } else {
          sentCount++;
        }

        // Create evidence for scheduled send
        await createMessageEvidence(supabase, {
          company_id: thread.company_id,
          thread_id: thread.id,
          event_type: 'scheduled_send',
          event_data: {
            scheduled_at: thread.scheduled_at,
            actual_sent_at: now.toISOString(),
            actor_type: 'system'
          }
        });

      } catch (error) {
        console.error(`Error processing thread ${thread.id}:`, error);
        errorCount++;
      }
    }

    console.log(`Scheduled dispatch complete: ${sentCount} sent, ${errorCount} errors`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        sent_count: sentCount,
        error_count: errorCount,
        processed_count: scheduledThreads.length
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in message-scheduler:', error);
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
