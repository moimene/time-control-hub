import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface CertifyRequest {
  action: 'certify_pending' | 'certify_single' | 'verify_chain';
  company_id?: string;
  evidence_id?: string;
  thread_id?: string;
  test_mode?: boolean;
}

interface DTAuthResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { action, company_id, evidence_id, thread_id, test_mode = false }: CertifyRequest = await req.json();

    switch (action) {
      case 'certify_pending':
        return await certifyPendingEvidence(supabase, company_id, test_mode);
      
      case 'certify_single':
        return await certifySingleEvidence(supabase, evidence_id!, test_mode);
      
      case 'verify_chain':
        return await verifyEvidenceChain(supabase, thread_id!);
      
      default:
        return new Response(
          JSON.stringify({ error: 'Invalid action' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
    }

  } catch (error) {
    console.error('Error in message-certify:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

async function certifyPendingEvidence(
  supabase: any, 
  companyId: string | undefined,
  testMode: boolean
): Promise<Response> {
  // Get uncertified evidence (no QTSP timestamp)
  let query = supabase
    .from('message_evidence')
    .select('*')
    .is('qtsp_timestamp', null)
    .order('created_at', { ascending: true })
    .limit(50);

  if (companyId) {
    query = query.eq('company_id', companyId);
  }

  const { data: pendingEvidence, error } = await query;

  if (error) throw error;

  if (!pendingEvidence || pendingEvidence.length === 0) {
    return new Response(
      JSON.stringify({ success: true, certified: 0, message: 'No pending evidence to certify' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  let token: string | null = null;
  
  if (!testMode) {
    token = await authenticate();
  }

  let certified = 0;
  let failed = 0;

  for (const evidence of pendingEvidence) {
    try {
      if (testMode) {
        // Simulate certification
        await supabase.from('message_evidence').update({
          qtsp_timestamp: new Date().toISOString(),
          qtsp_token: `TEST-${crypto.randomUUID().substring(0, 8)}`,
          qtsp_provider: 'TEST_MODE',
          qtsp_serial: `TEST-SERIAL-${Date.now()}`
        }).eq('id', evidence.id);
        
        certified++;
      } else {
        const result = await requestQTSPTimestamp(token!, evidence.content_hash);
        
        await supabase.from('message_evidence').update({
          qtsp_timestamp: result.timestamp,
          qtsp_token: result.token,
          qtsp_provider: result.provider,
          qtsp_serial: result.serial
        }).eq('id', evidence.id);
        
        certified++;
      }
    } catch (err) {
      console.error(`Failed to certify evidence ${evidence.id}:`, err);
      failed++;
    }
  }

  console.log(`Certified ${certified} evidence records, ${failed} failed`);

  return new Response(
    JSON.stringify({ 
      success: true, 
      certified, 
      failed,
      test_mode: testMode
    }),
    { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  );
}

async function certifySingleEvidence(
  supabase: any,
  evidenceId: string,
  testMode: boolean
): Promise<Response> {
  const { data: evidence, error } = await supabase
    .from('message_evidence')
    .select('*')
    .eq('id', evidenceId)
    .single();

  if (error || !evidence) {
    return new Response(
      JSON.stringify({ error: 'Evidence not found' }),
      { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  if (evidence.qtsp_timestamp) {
    return new Response(
      JSON.stringify({ 
        success: true, 
        already_certified: true,
        qtsp_timestamp: evidence.qtsp_timestamp 
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  let result;
  if (testMode) {
    result = {
      timestamp: new Date().toISOString(),
      token: `TEST-${crypto.randomUUID().substring(0, 8)}`,
      provider: 'TEST_MODE',
      serial: `TEST-SERIAL-${Date.now()}`
    };
  } else {
    const token = await authenticate();
    result = await requestQTSPTimestamp(token, evidence.content_hash);
  }

  await supabase.from('message_evidence').update({
    qtsp_timestamp: result.timestamp,
    qtsp_token: result.token,
    qtsp_provider: result.provider,
    qtsp_serial: result.serial
  }).eq('id', evidenceId);

  return new Response(
    JSON.stringify({ 
      success: true, 
      certified: true,
      qtsp_timestamp: result.timestamp,
      test_mode: testMode
    }),
    { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  );
}

async function verifyEvidenceChain(
  supabase: any,
  threadId: string
): Promise<Response> {
  const { data: evidences, error } = await supabase
    .from('message_evidence')
    .select('*')
    .eq('thread_id', threadId)
    .order('created_at', { ascending: true });

  if (error) throw error;

  if (!evidences || evidences.length === 0) {
    return new Response(
      JSON.stringify({ 
        valid: true, 
        message: 'No evidence found for thread',
        evidence_count: 0 
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  let isValid = true;
  const issues: string[] = [];

  for (let i = 0; i < evidences.length; i++) {
    const evidence = evidences[i];
    
    // Verify chain
    if (i === 0) {
      if (evidence.previous_hash !== null) {
        isValid = false;
        issues.push(`First evidence should have null previous_hash`);
      }
    } else {
      const previousEvidence = evidences[i - 1];
      if (evidence.previous_hash !== previousEvidence.content_hash) {
        isValid = false;
        issues.push(`Chain broken at evidence ${i}: expected ${previousEvidence.content_hash}, got ${evidence.previous_hash}`);
      }
    }

    // Verify hash integrity
    const recalculatedHash = await generateHash(JSON.stringify({
      event_type: evidence.event_type,
      thread_id: evidence.thread_id,
      recipient_id: evidence.recipient_id,
      event_timestamp: evidence.event_timestamp,
      event_data: evidence.event_data,
      previous_hash: evidence.previous_hash
    }));

    if (recalculatedHash !== evidence.content_hash) {
      isValid = false;
      issues.push(`Hash mismatch at evidence ${i}: content may have been tampered`);
    }
  }

  return new Response(
    JSON.stringify({ 
      valid: isValid,
      evidence_count: evidences.length,
      first_hash: evidences[0]?.content_hash,
      last_hash: evidences[evidences.length - 1]?.content_hash,
      issues: issues.length > 0 ? issues : undefined,
      certified_count: evidences.filter((e: any) => e.qtsp_timestamp).length
    }),
    { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  );
}

async function authenticate(): Promise<string> {
  const loginUrl = Deno.env.get('DIGITALTRUST_LOGIN_URL')!;
  const clientId = Deno.env.get('DIGITALTRUST_CLIENT_ID')!;
  const clientSecret = Deno.env.get('DIGITALTRUST_CLIENT_SECRET')!;

  const response = await fetch(loginUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      grant_type: 'client_credentials',
      client_id: clientId,
      client_secret: clientSecret,
      scope: 'token',
    }),
  });

  if (!response.ok) {
    throw new Error(`QTSP Authentication failed: ${response.status}`);
  }

  const data: DTAuthResponse = await response.json();
  return data.access_token;
}

async function requestQTSPTimestamp(token: string, contentHash: string): Promise<{
  timestamp: string;
  token: string;
  provider: string;
  serial: string;
}> {
  const apiUrl = Deno.env.get('DIGITALTRUST_API_URL')!;

  const response = await fetch(`${apiUrl}/digital-trust/api/v1/private/tsp/timestamp`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      hash: contentHash,
      hashAlgorithm: 'SHA-256'
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`QTSP timestamp request failed: ${error}`);
  }

  const result = await response.json();

  return {
    timestamp: result.timestamp || new Date().toISOString(),
    token: result.tspToken || result.token,
    provider: 'EADTrust',
    serial: result.serialNumber || result.serial
  };
}

async function generateHash(content: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(content);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}
