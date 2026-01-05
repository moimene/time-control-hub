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

    const { date, company_id } = await req.json().catch(() => ({}));
    
    // Default to yesterday if no date provided
    const targetDate = date ? new Date(date) : new Date(Date.now() - 24 * 60 * 60 * 1000);
    targetDate.setHours(0, 0, 0, 0);
    
    const startOfDay = targetDate.toISOString();
    const endOfDay = new Date(targetDate.getTime() + 24 * 60 * 60 * 1000 - 1).toISOString();
    const dateStr = targetDate.toISOString().split('T')[0];

    // If no company_id provided, process all companies
    if (!company_id) {
      console.log(`Generating daily roots for ${dateStr} for all companies`);
      
      // Get all companies with events on this day
      const { data: companies, error: companiesError } = await supabase
        .from('company')
        .select('id, name');
      
      if (companiesError) {
        console.error('Error fetching companies:', companiesError);
        throw companiesError;
      }

      const results = [];
      for (const company of companies || []) {
        try {
          const result = await processCompanyDailyRoot(supabase, company.id, dateStr, startOfDay, endOfDay, supabaseUrl, supabaseServiceKey);
          results.push({ company_id: company.id, company_name: company.name, ...result });
        } catch (err) {
          console.error(`Error processing company ${company.id}:`, err);
          results.push({ company_id: company.id, company_name: company.name, success: false, error: String(err) });
        }
      }

      return new Response(
        JSON.stringify({
          success: true,
          date: dateStr,
          results,
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Process single company
    console.log(`Generating daily root for ${dateStr} for company ${company_id}`);
    const result = await processCompanyDailyRoot(supabase, company_id, dateStr, startOfDay, endOfDay, supabaseUrl, supabaseServiceKey);

    return new Response(
      JSON.stringify({
        company_id,
        ...result,
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

async function processCompanyDailyRoot(
  supabase: any, 
  companyId: string, 
  dateStr: string, 
  startOfDay: string, 
  endOfDay: string,
  supabaseUrl: string,
  supabaseServiceKey: string
) {
  // Check if root already exists for this date and company
  const { data: existing } = await supabase
    .from('daily_roots')
    .select('id')
    .eq('date', dateStr)
    .eq('company_id', companyId)
    .maybeSingle();

  if (existing) {
    console.log(`Daily root already exists for ${dateStr} company ${companyId}`);
    return { success: true, message: 'Root already exists', date: dateStr, already_exists: true };
  }

  // Get all time events for the day for this company
  const { data: events, error: eventsError } = await supabase
    .from('time_events')
    .select('id, event_hash')
    .eq('company_id', companyId)
    .gte('timestamp', startOfDay)
    .lte('timestamp', endOfDay)
    .order('timestamp', { ascending: true });

  if (eventsError) {
    console.error('Error fetching events:', eventsError);
    throw eventsError;
  }

  const eventCount = events?.length || 0;
  
  // Skip if no events for this company
  if (eventCount === 0) {
    console.log(`No events for ${dateStr} company ${companyId}, skipping`);
    return { success: true, message: 'No events for this day', date: dateStr, event_count: 0, skipped: true };
  }
  
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

  console.log(`Computed root hash for ${dateStr} company ${companyId}: ${rootHash.substring(0, 16)}... (${eventCount} events)`);

  // Insert daily root
  const { data: insertedRoot, error: insertError } = await supabase
    .from('daily_roots')
    .insert({
      date: dateStr,
      root_hash: rootHash,
      event_count: eventCount,
      company_id: companyId,
    })
    .select()
    .single();

  if (insertError) {
    console.error('Error inserting daily root:', insertError);
    throw insertError;
  }

  // Trigger QTSP timestamp for the daily root (non-blocking)
  let qtspResult = null;
  try {
    const qtspResponse = await fetch(`${supabaseUrl}/functions/v1/qtsp-notarize`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${supabaseServiceKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        action: 'timestamp_daily',
        daily_root_id: insertedRoot.id,
        root_hash: rootHash,
        date: dateStr,
        company_id: companyId,
      }),
    });

    if (qtspResponse.ok) {
      qtspResult = await qtspResponse.json();
      console.log(`QTSP timestamp requested for ${dateStr} company ${companyId}`);
    } else {
      const error = await qtspResponse.text();
      console.error('QTSP timestamp request failed:', error);
    }
  } catch (qtspError) {
    console.error('Error calling QTSP notarize:', qtspError);
    // Don't fail the entire operation if QTSP fails
  }

  return {
    success: true,
    date: dateStr,
    root_hash: rootHash,
    event_count: eventCount,
    qtsp_timestamped: qtspResult?.success || false,
  };
}
