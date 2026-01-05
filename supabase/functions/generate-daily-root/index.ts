import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Compute SHA-256 hash
async function computeHash(data: string): Promise<string> {
  const encoder = new TextEncoder();
  const dataBuffer = encoder.encode(data);
  const hashBuffer = await crypto.subtle.digest('SHA-256', dataBuffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

// Build Merkle tree and return root hash
async function buildMerkleRoot(hashes: string[]): Promise<string> {
  if (hashes.length === 0) return await computeHash('EMPTY_DAY');
  if (hashes.length === 1) return hashes[0];

  const nextLevel: string[] = [];
  for (let i = 0; i < hashes.length; i += 2) {
    const left = hashes[i];
    const right = hashes[i + 1] || left; // Duplicate last if odd
    const combined = await computeHash(left + right);
    nextLevel.push(combined);
  }

  return buildMerkleRoot(nextLevel);
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { date } = await req.json().catch(() => ({}));
    
    // Default to yesterday if no date provided
    const targetDate = date ? new Date(date) : new Date(Date.now() - 24 * 60 * 60 * 1000);
    targetDate.setHours(0, 0, 0, 0);
    
    const startOfDay = targetDate.toISOString();
    const endOfDay = new Date(targetDate.getTime() + 24 * 60 * 60 * 1000 - 1).toISOString();
    const dateStr = targetDate.toISOString().split('T')[0];

    console.log(`Generating daily root for ${dateStr}`);

    // Check if root already exists for this date
    const { data: existing } = await supabase
      .from('daily_roots')
      .select('id')
      .eq('date', dateStr)
      .maybeSingle();

    if (existing) {
      console.log(`Daily root already exists for ${dateStr}`);
      return new Response(
        JSON.stringify({ success: true, message: 'Root already exists', date: dateStr }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get all time events for the day
    const { data: events, error: eventsError } = await supabase
      .from('time_events')
      .select('id, event_hash')
      .gte('timestamp', startOfDay)
      .lte('timestamp', endOfDay)
      .order('timestamp', { ascending: true });

    if (eventsError) {
      console.error('Error fetching events:', eventsError);
      throw eventsError;
    }

    const eventCount = events?.length || 0;
    
    // Extract hashes (compute if missing for legacy events)
    const hashes: string[] = [];
    for (const event of events || []) {
      if (event.event_hash) {
        hashes.push(event.event_hash);
      } else {
        // Fallback for events without hash (legacy)
        const fallbackHash = await computeHash(`${event.id}`);
        hashes.push(fallbackHash);
      }
    }

    // Build Merkle root
    const rootHash = await buildMerkleRoot(hashes);

    console.log(`Computed root hash for ${dateStr}: ${rootHash.substring(0, 16)}... (${eventCount} events)`);

    // Insert daily root
    const { error: insertError } = await supabase
      .from('daily_roots')
      .insert({
        date: dateStr,
        root_hash: rootHash,
        event_count: eventCount,
      });

    if (insertError) {
      console.error('Error inserting daily root:', insertError);
      throw insertError;
    }

    return new Response(
      JSON.stringify({
        success: true,
        date: dateStr,
        root_hash: rootHash,
        event_count: eventCount,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Generate daily root error:', error);
    return new Response(
      JSON.stringify({ success: false, error: 'Error generating daily root' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
