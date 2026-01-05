import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface DTAuthResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
}

interface DTCaseFile {
  id: string;
  name: string;
}

interface DTEvidenceGroup {
  id: string;
  name: string;
}

interface DTEvidence {
  id: string;
  status: string;
  tspToken?: string;
}

// Authenticate with Digital Trust
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
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    console.error('Auth failed:', error);
    throw new Error(`Authentication failed: ${response.status}`);
  }

  const data: DTAuthResponse = await response.json();
  return data.access_token;
}

// Get or create Case File
async function getOrCreateCaseFile(
  supabase: any,
  token: string,
  companyId: string,
  companyName: string
): Promise<{ id: string; externalId: string }> {
  const apiUrl = Deno.env.get('DIGITALTRUST_API_URL')!;
  
  // Check if we already have a case file
  const { data: existing } = await supabase
    .from('dt_case_files')
    .select('id, external_id')
    .eq('company_id', companyId)
    .maybeSingle();

  if (existing) {
    return { id: existing.id, externalId: existing.external_id };
  }

  // Create new case file in Digital Trust
  const response = await fetch(`${apiUrl}/case-files`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      name: `Registro Horario - ${companyName}`,
      description: `Evidencias de fichaje para ${companyName}`,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    console.error('Create case file failed:', error);
    throw new Error(`Failed to create case file: ${response.status}`);
  }

  const caseFile: DTCaseFile = await response.json();

  // Store in our database
  const { data: inserted, error: insertError } = await supabase
    .from('dt_case_files')
    .insert({
      external_id: caseFile.id,
      company_id: companyId,
      name: caseFile.name,
      description: `Evidencias de fichaje para ${companyName}`,
    })
    .select()
    .single();

  if (insertError) throw insertError;

  return { id: inserted.id, externalId: caseFile.id };
}

// Get or create Evidence Group for a month
async function getOrCreateEvidenceGroup(
  supabase: any,
  token: string,
  caseFileId: string,
  caseFileExternalId: string,
  yearMonth: string
): Promise<{ id: string; externalId: string }> {
  const apiUrl = Deno.env.get('DIGITALTRUST_API_URL')!;

  // Check if we already have an evidence group for this month
  const { data: existing } = await supabase
    .from('dt_evidence_groups')
    .select('id, external_id')
    .eq('case_file_id', caseFileId)
    .eq('year_month', yearMonth)
    .maybeSingle();

  if (existing) {
    return { id: existing.id, externalId: existing.external_id };
  }

  // Create new evidence group in Digital Trust
  const response = await fetch(`${apiUrl}/case-files/${caseFileExternalId}/evidence-groups`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      name: `Fichajes ${yearMonth}`,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    console.error('Create evidence group failed:', error);
    throw new Error(`Failed to create evidence group: ${response.status}`);
  }

  const evidenceGroup: DTEvidenceGroup = await response.json();

  // Store in our database
  const { data: inserted, error: insertError } = await supabase
    .from('dt_evidence_groups')
    .insert({
      external_id: evidenceGroup.id,
      case_file_id: caseFileId,
      name: evidenceGroup.name,
      year_month: yearMonth,
    })
    .select()
    .single();

  if (insertError) throw insertError;

  return { id: inserted.id, externalId: evidenceGroup.id };
}

// Create TSP timestamp evidence for daily root
async function createTSPEvidence(
  supabase: any,
  token: string,
  evidenceGroupExternalId: string,
  evidenceGroupId: string,
  dailyRootId: string,
  rootHash: string,
  date: string
): Promise<void> {
  const apiUrl = Deno.env.get('DIGITALTRUST_API_URL')!;

  // Create evidence record first
  const { data: evidence, error: evidenceError } = await supabase
    .from('dt_evidences')
    .insert({
      evidence_group_id: evidenceGroupId,
      evidence_type: 'daily_timestamp',
      status: 'processing',
      daily_root_id: dailyRootId,
    })
    .select()
    .single();

  if (evidenceError) throw evidenceError;

  try {
    // Create evidence in Digital Trust with TSP
    const response = await fetch(`${apiUrl}/evidence-groups/${evidenceGroupExternalId}/evidences`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        name: `Merkle Root ${date}`,
        description: `Hash raíz del árbol Merkle de fichajes del día ${date}`,
        data: rootHash,
        tsp: {
          provider: 'EADTRUST',
          type: 'TIMESTAMP',
        },
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Failed to create evidence: ${error}`);
    }

    const dtEvidence: DTEvidence = await response.json();

    // Poll for TSP token (may take a few seconds)
    let tspToken = null;
    let attempts = 0;
    const maxAttempts = 10;

    while (!tspToken && attempts < maxAttempts) {
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      const statusResponse = await fetch(`${apiUrl}/evidences/${dtEvidence.id}`, {
        headers: { 'Authorization': `Bearer ${token}` },
      });

      if (statusResponse.ok) {
        const statusData = await statusResponse.json();
        if (statusData.tspToken) {
          tspToken = statusData.tspToken;
        }
      }
      attempts++;
    }

    // Update our evidence record
    await supabase
      .from('dt_evidences')
      .update({
        external_id: dtEvidence.id,
        status: tspToken ? 'completed' : 'processing',
        tsp_token: tspToken,
        tsp_timestamp: tspToken ? new Date().toISOString() : null,
        completed_at: tspToken ? new Date().toISOString() : null,
      })
      .eq('id', evidence.id);

    console.log(`TSP evidence created for ${date}, token: ${tspToken ? 'obtained' : 'pending'}`);

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('Error creating TSP evidence:', error);
    await supabase
      .from('dt_evidences')
      .update({
        status: 'failed',
        error_message: errorMessage,
        retry_count: evidence.retry_count + 1,
      })
      .eq('id', evidence.id);
    throw error;
  }
}

// Seal PDF with qualified signature
async function sealPDF(
  supabase: any,
  token: string,
  evidenceGroupExternalId: string,
  evidenceGroupId: string,
  pdfBuffer: ArrayBuffer,
  reportMonth: string,
  fileName: string
): Promise<{ sealedPdfPath: string }> {
  const apiUrl = Deno.env.get('DIGITALTRUST_API_URL')!;

  // Create evidence record
  const { data: evidence, error: evidenceError } = await supabase
    .from('dt_evidences')
    .insert({
      evidence_group_id: evidenceGroupId,
      evidence_type: 'monthly_report',
      status: 'processing',
      report_month: reportMonth,
      original_pdf_path: fileName,
    })
    .select()
    .single();

  if (evidenceError) throw evidenceError;

  try {
    // Convert PDF to base64
    const pdfBase64 = btoa(String.fromCharCode(...new Uint8Array(pdfBuffer)));

    // Create evidence with qualified signature
    const response = await fetch(`${apiUrl}/evidence-groups/${evidenceGroupExternalId}/evidences`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        name: `Informe Mensual ${reportMonth}`,
        description: `Informe de fichajes del mes ${reportMonth}`,
        file: {
          name: fileName,
          content: pdfBase64,
          contentType: 'application/pdf',
        },
        signature: {
          provider: 'EADTRUST',
          type: 'PADES_LTV',
          level: 'QUALIFIED',
        },
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Failed to seal PDF: ${error}`);
    }

    const dtEvidence = await response.json();

    // Poll for sealed PDF
    let sealedPdfBase64 = null;
    let attempts = 0;
    const maxAttempts = 30; // More attempts for PDF signing

    while (!sealedPdfBase64 && attempts < maxAttempts) {
      await new Promise(resolve => setTimeout(resolve, 3000));
      
      const statusResponse = await fetch(`${apiUrl}/evidences/${dtEvidence.id}`, {
        headers: { 'Authorization': `Bearer ${token}` },
      });

      if (statusResponse.ok) {
        const statusData = await statusResponse.json();
        if (statusData.signedFile?.content) {
          sealedPdfBase64 = statusData.signedFile.content;
        }
      }
      attempts++;
    }

    if (!sealedPdfBase64) {
      throw new Error('Timeout waiting for sealed PDF');
    }

    // Decode base64 and upload to storage
    const sealedPdfBytes = Uint8Array.from(atob(sealedPdfBase64), c => c.charCodeAt(0));
    const sealedFileName = `${reportMonth}/${fileName.replace('.pdf', '_sealed.pdf')}`;

    const { error: uploadError } = await supabase.storage
      .from('sealed-reports')
      .upload(sealedFileName, sealedPdfBytes, {
        contentType: 'application/pdf',
        upsert: true,
      });

    if (uploadError) throw uploadError;

    // Update evidence record
    await supabase
      .from('dt_evidences')
      .update({
        external_id: dtEvidence.id,
        status: 'completed',
        sealed_pdf_path: sealedFileName,
        signature_data: dtEvidence.signatureInfo || {},
        completed_at: new Date().toISOString(),
      })
      .eq('id', evidence.id);

    console.log(`PDF sealed successfully: ${sealedFileName}`);

    return { sealedPdfPath: sealedFileName };

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('Error sealing PDF:', error);
    await supabase
      .from('dt_evidences')
      .update({
        status: 'failed',
        error_message: errorMessage,
        retry_count: evidence.retry_count + 1,
      })
      .eq('id', evidence.id);
    throw error;
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { action, ...params } = await req.json();

    // Authenticate with Digital Trust
    const token = await authenticate();

    // Get company info
    const { data: company } = await supabase
      .from('company')
      .select('id, name')
      .single();

    if (!company) {
      throw new Error('Company not configured');
    }

    // Get or create case file
    const caseFile = await getOrCreateCaseFile(supabase, token, company.id, company.name);

    if (action === 'timestamp_daily') {
      const { daily_root_id, root_hash, date } = params;
      
      if (!daily_root_id || !root_hash || !date) {
        throw new Error('Missing required parameters: daily_root_id, root_hash, date');
      }

      const yearMonth = date.substring(0, 7); // YYYY-MM from YYYY-MM-DD
      const evidenceGroup = await getOrCreateEvidenceGroup(
        supabase, token, caseFile.id, caseFile.externalId, yearMonth
      );

      await createTSPEvidence(
        supabase, token, evidenceGroup.externalId, evidenceGroup.id,
        daily_root_id, root_hash, date
      );

      return new Response(
        JSON.stringify({ success: true, message: 'Daily root timestamped' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );

    } else if (action === 'seal_pdf') {
      const { pdf_base64, report_month, file_name } = params;
      
      if (!pdf_base64 || !report_month || !file_name) {
        throw new Error('Missing required parameters: pdf_base64, report_month, file_name');
      }

      const evidenceGroup = await getOrCreateEvidenceGroup(
        supabase, token, caseFile.id, caseFile.externalId, report_month
      );

      // Decode base64 PDF
      const pdfBytes = Uint8Array.from(atob(pdf_base64), c => c.charCodeAt(0));
      
      const result = await sealPDF(
        supabase, token, evidenceGroup.externalId, evidenceGroup.id,
        pdfBytes.buffer, report_month, file_name
      );

      return new Response(
        JSON.stringify({ success: true, sealed_pdf_path: result.sealedPdfPath }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );

    } else if (action === 'check_status') {
      const { evidence_id } = params;
      
      const { data: evidence } = await supabase
        .from('dt_evidences')
        .select('*')
        .eq('id', evidence_id)
        .single();

      return new Response(
        JSON.stringify({ success: true, evidence }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );

    } else {
      throw new Error(`Unknown action: ${action}`);
    }

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('QTSP notarize error:', error);
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
