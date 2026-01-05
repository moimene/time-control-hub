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

// Log QTSP operation to audit table
async function logQTSPOperation(
  supabase: any,
  companyId: string,
  action: string,
  evidenceId: string | null,
  requestPayload: any,
  responsePayload: any,
  status: string,
  errorMessage: string | null,
  durationMs: number
): Promise<void> {
  try {
    await supabase.from('qtsp_audit_log').insert({
      company_id: companyId,
      action,
      evidence_id: evidenceId,
      request_payload: requestPayload,
      response_payload: responsePayload,
      status,
      error_message: errorMessage,
      duration_ms: durationMs,
    });
  } catch (error) {
    console.error('Failed to log QTSP operation:', error);
  }
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
      scope: 'token',
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

// Get or create Case File for a specific company
async function getOrCreateCaseFile(
  supabase: any,
  token: string,
  companyId: string,
  companyName: string
): Promise<{ id: string; externalId: string }> {
  const apiUrl = Deno.env.get('DIGITALTRUST_API_URL')!;
  
  // Check if we already have a case file for this company
  const { data: existing } = await supabase
    .from('dt_case_files')
    .select('id, external_id')
    .eq('company_id', companyId)
    .maybeSingle();

  if (existing) {
    console.log(`Using existing case file for company ${companyId}: ${existing.external_id}`);
    return { id: existing.id, externalId: existing.external_id };
  }

  console.log(`Creating new case file for company ${companyId}`);
  
  // Create new case file in Digital Trust
  const response = await fetch(`${apiUrl}/digital-trust/api/v1/private/case-files`, {
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
    console.log(`Using existing evidence group for ${yearMonth}: ${existing.external_id}`);
    return { id: existing.id, externalId: existing.external_id };
  }

  console.log(`Creating new evidence group for ${yearMonth}`);

  // Create new evidence group in Digital Trust
  const response = await fetch(`${apiUrl}/digital-trust/api/v1/private/case-files/${caseFileExternalId}/evidence-groups`, {
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

// Create TSP timestamp evidence for daily root - WITH IDEMPOTENCY
async function createTSPEvidence(
  supabase: any,
  token: string,
  evidenceGroupExternalId: string,
  evidenceGroupId: string,
  dailyRootId: string,
  rootHash: string,
  date: string,
  companyId: string
): Promise<{ success: boolean; alreadyExists?: boolean; evidence?: any }> {
  const apiUrl = Deno.env.get('DIGITALTRUST_API_URL')!;
  const startTime = Date.now();

  // IDEMPOTENCY CHECK: Check if evidence already exists for this daily_root
  const { data: existingEvidence } = await supabase
    .from('dt_evidences')
    .select('*')
    .eq('daily_root_id', dailyRootId)
    .maybeSingle();

  if (existingEvidence) {
    console.log(`Evidence already exists for daily_root ${dailyRootId}, status: ${existingEvidence.status}`);
    
    if (existingEvidence.status === 'completed') {
      await logQTSPOperation(supabase, companyId, 'timestamp', existingEvidence.id, 
        { daily_root_id: dailyRootId }, { already_exists: true }, 'success', null, Date.now() - startTime);
      return { success: true, alreadyExists: true, evidence: existingEvidence };
    }
    
    if (existingEvidence.status === 'processing') {
      // Check status in DT and update
      if (existingEvidence.external_id) {
        const updated = await checkAndUpdateEvidence(supabase, token, existingEvidence, companyId);
        return { success: updated.status === 'completed', evidence: updated };
      }
    }
    
    // If failed, we'll retry below
    console.log(`Retrying failed evidence for daily_root ${dailyRootId}`);
  }

  // Create evidence record first (or use existing failed one)
  let evidence = existingEvidence;
  if (!evidence) {
    const { data: newEvidence, error: evidenceError } = await supabase
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
    evidence = newEvidence;
  } else {
    // Reset status for retry
    await supabase.from('dt_evidences').update({ 
      status: 'processing', 
      error_message: null 
    }).eq('id', evidence.id);
  }

  try {
    console.log(`Creating TSP evidence in Digital Trust for ${date}`);
    
    // Create evidence in Digital Trust with TSP
    const response = await fetch(`${apiUrl}/digital-trust/api/v1/private/evidence-groups/${evidenceGroupExternalId}/evidences`, {
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
    console.log(`DT evidence created: ${dtEvidence.id}`);

    // Poll for TSP token (may take a few seconds)
    let tspToken = null;
    let attempts = 0;
    const maxAttempts = 10;

    while (!tspToken && attempts < maxAttempts) {
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      const statusResponse = await fetch(`${apiUrl}/digital-trust/api/v1/private/evidences/${dtEvidence.id}`, {
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
    const updateData = {
      external_id: dtEvidence.id,
      status: tspToken ? 'completed' : 'processing',
      tsp_token: tspToken,
      tsp_timestamp: tspToken ? new Date().toISOString() : null,
      completed_at: tspToken ? new Date().toISOString() : null,
      retry_count: evidence.retry_count || 0,
    };

    await supabase.from('dt_evidences').update(updateData).eq('id', evidence.id);

    console.log(`TSP evidence created for ${date}, token: ${tspToken ? 'obtained' : 'pending'}`);

    await logQTSPOperation(supabase, companyId, 'timestamp', evidence.id,
      { daily_root_id: dailyRootId, date }, { external_id: dtEvidence.id, tsp_token: !!tspToken },
      tspToken ? 'success' : 'pending', null, Date.now() - startTime);

    return { success: true, evidence: { ...evidence, ...updateData } };

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('Error creating TSP evidence:', error);
    
    await supabase.from('dt_evidences').update({
      status: 'failed',
      error_message: errorMessage,
      retry_count: (evidence.retry_count || 0) + 1,
    }).eq('id', evidence.id);

    await logQTSPOperation(supabase, companyId, 'timestamp', evidence.id,
      { daily_root_id: dailyRootId, date }, null, 'failed', errorMessage, Date.now() - startTime);

    throw error;
  }
}

// Check and update evidence status from Digital Trust
async function checkAndUpdateEvidence(
  supabase: any,
  token: string,
  evidence: any,
  companyId: string
): Promise<any> {
  const apiUrl = Deno.env.get('DIGITALTRUST_API_URL')!;
  const startTime = Date.now();

  if (!evidence.external_id) {
    return evidence;
  }

  try {
    const response = await fetch(`${apiUrl}/digital-trust/api/v1/private/evidences/${evidence.external_id}`, {
      headers: { 'Authorization': `Bearer ${token}` },
    });

    if (!response.ok) {
      console.error(`Failed to check evidence status: ${response.status}`);
      return evidence;
    }

    const dtEvidence = await response.json();
    
    const updateData: any = {};
    
    if (evidence.evidence_type === 'daily_timestamp' && dtEvidence.tspToken && !evidence.tsp_token) {
      updateData.tsp_token = dtEvidence.tspToken;
      updateData.tsp_timestamp = new Date().toISOString();
      updateData.status = 'completed';
      updateData.completed_at = new Date().toISOString();
    } else if (evidence.evidence_type === 'monthly_report' && dtEvidence.signedFile?.content && !evidence.sealed_pdf_path) {
      // Handle sealed PDF
      const sealedPdfBase64 = dtEvidence.signedFile.content;
      const sealedPdfBytes = Uint8Array.from(atob(sealedPdfBase64), c => c.charCodeAt(0));
      const sealedFileName = `${evidence.report_month}/${evidence.original_pdf_path?.replace('.pdf', '_sealed.pdf') || 'report_sealed.pdf'}`;

      const { error: uploadError } = await supabase.storage
        .from('sealed-reports')
        .upload(sealedFileName, sealedPdfBytes, {
          contentType: 'application/pdf',
          upsert: true,
        });

      if (!uploadError) {
        updateData.sealed_pdf_path = sealedFileName;
        updateData.status = 'completed';
        updateData.completed_at = new Date().toISOString();
        updateData.signature_data = dtEvidence.signatureInfo || {};
      }
    }

    if (Object.keys(updateData).length > 0) {
      await supabase.from('dt_evidences').update(updateData).eq('id', evidence.id);
      
      await logQTSPOperation(supabase, companyId, 'check_status', evidence.id,
        { external_id: evidence.external_id }, updateData, 'success', null, Date.now() - startTime);
      
      return { ...evidence, ...updateData };
    }

    return evidence;
  } catch (error) {
    console.error('Error checking evidence status:', error);
    return evidence;
  }
}

// Seal PDF with qualified signature - WITH IDEMPOTENCY
async function sealPDF(
  supabase: any,
  token: string,
  evidenceGroupExternalId: string,
  evidenceGroupId: string,
  pdfBuffer: ArrayBuffer,
  reportMonth: string,
  fileName: string,
  companyId: string
): Promise<{ sealedPdfPath: string; alreadyExists?: boolean }> {
  const apiUrl = Deno.env.get('DIGITALTRUST_API_URL')!;
  const startTime = Date.now();

  // IDEMPOTENCY CHECK: Check if evidence already exists for this report_month
  const { data: existingEvidence } = await supabase
    .from('dt_evidences')
    .select('*')
    .eq('evidence_group_id', evidenceGroupId)
    .eq('evidence_type', 'monthly_report')
    .eq('report_month', reportMonth)
    .maybeSingle();

  if (existingEvidence) {
    console.log(`PDF seal evidence already exists for ${reportMonth}, status: ${existingEvidence.status}`);
    
    if (existingEvidence.status === 'completed' && existingEvidence.sealed_pdf_path) {
      await logQTSPOperation(supabase, companyId, 'seal_pdf', existingEvidence.id,
        { report_month: reportMonth }, { already_exists: true }, 'success', null, Date.now() - startTime);
      return { sealedPdfPath: existingEvidence.sealed_pdf_path, alreadyExists: true };
    }
    
    if (existingEvidence.status === 'processing' && existingEvidence.external_id) {
      const updated = await checkAndUpdateEvidence(supabase, token, existingEvidence, companyId);
      if (updated.sealed_pdf_path) {
        return { sealedPdfPath: updated.sealed_pdf_path };
      }
    }
  }

  // Create evidence record
  let evidence = existingEvidence;
  if (!evidence) {
    const { data: newEvidence, error: evidenceError } = await supabase
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
    evidence = newEvidence;
  } else {
    await supabase.from('dt_evidences').update({ 
      status: 'processing', 
      error_message: null 
    }).eq('id', evidence.id);
  }

  try {
    // Convert PDF to base64
    const pdfBase64 = btoa(String.fromCharCode(...new Uint8Array(pdfBuffer)));

    console.log(`Creating sealed PDF in Digital Trust for ${reportMonth}`);

    // Create evidence with qualified signature
    const response = await fetch(`${apiUrl}/digital-trust/api/v1/private/evidence-groups/${evidenceGroupExternalId}/evidences`, {
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
    console.log(`DT evidence created for PDF: ${dtEvidence.id}`);

    // Poll for sealed PDF
    let sealedPdfBase64 = null;
    let attempts = 0;
    const maxAttempts = 30; // More attempts for PDF signing

    while (!sealedPdfBase64 && attempts < maxAttempts) {
      await new Promise(resolve => setTimeout(resolve, 3000));
      
      const statusResponse = await fetch(`${apiUrl}/digital-trust/api/v1/private/evidences/${dtEvidence.id}`, {
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
      // Mark as processing, can be checked later
      await supabase.from('dt_evidences').update({
        external_id: dtEvidence.id,
        status: 'processing',
      }).eq('id', evidence.id);
      
      throw new Error('Timeout waiting for sealed PDF - will retry later');
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
    await supabase.from('dt_evidences').update({
      external_id: dtEvidence.id,
      status: 'completed',
      sealed_pdf_path: sealedFileName,
      signature_data: dtEvidence.signatureInfo || {},
      completed_at: new Date().toISOString(),
    }).eq('id', evidence.id);

    console.log(`PDF sealed successfully: ${sealedFileName}`);

    await logQTSPOperation(supabase, companyId, 'seal_pdf', evidence.id,
      { report_month: reportMonth, file_name: fileName }, { sealed_pdf_path: sealedFileName },
      'success', null, Date.now() - startTime);

    return { sealedPdfPath: sealedFileName };

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('Error sealing PDF:', error);
    
    await supabase.from('dt_evidences').update({
      status: 'failed',
      error_message: errorMessage,
      retry_count: (evidence.retry_count || 0) + 1,
    }).eq('id', evidence.id);

    await logQTSPOperation(supabase, companyId, 'seal_pdf', evidence.id,
      { report_month: reportMonth, file_name: fileName }, null, 'failed', errorMessage, Date.now() - startTime);

    throw error;
  }
}

// Retry all failed evidences for a company
async function retryFailedEvidences(
  supabase: any,
  token: string,
  companyId: string
): Promise<{ retried: number; succeeded: number; failed: number }> {
  const startTime = Date.now();
  
  // Get all failed evidences for this company
  const { data: failedEvidences, error } = await supabase
    .from('dt_evidences')
    .select(`
      *,
      evidence_group:dt_evidence_groups!inner(
        id, external_id, case_file_id,
        case_file:dt_case_files!inner(company_id)
      ),
      daily_roots(date, root_hash)
    `)
    .eq('status', 'failed')
    .eq('evidence_group.case_file.company_id', companyId);

  if (error) throw error;
  if (!failedEvidences || failedEvidences.length === 0) {
    return { retried: 0, succeeded: 0, failed: 0 };
  }

  console.log(`Retrying ${failedEvidences.length} failed evidences for company ${companyId}`);

  let succeeded = 0;
  let failed = 0;

  for (const evidence of failedEvidences) {
    try {
      if (evidence.evidence_type === 'daily_timestamp' && evidence.daily_roots) {
        await createTSPEvidence(
          supabase, token,
          evidence.evidence_group.external_id,
          evidence.evidence_group.id,
          evidence.daily_root_id,
          evidence.daily_roots.root_hash,
          evidence.daily_roots.date,
          companyId
        );
        succeeded++;
      }
      // Note: monthly_report retry would need the original PDF, which is more complex
    } catch (err) {
      console.error(`Failed to retry evidence ${evidence.id}:`, err);
      failed++;
    }
  }

  await logQTSPOperation(supabase, companyId, 'retry_failed', null,
    { count: failedEvidences.length }, { succeeded, failed },
    failed === 0 ? 'success' : 'partial', null, Date.now() - startTime);

  return { retried: failedEvidences.length, succeeded, failed };
}

// Check all pending evidences for a company
async function checkPendingEvidences(
  supabase: any,
  token: string,
  companyId: string
): Promise<{ checked: number; completed: number }> {
  const startTime = Date.now();

  // Get all processing evidences for this company
  const { data: pendingEvidences, error } = await supabase
    .from('dt_evidences')
    .select(`
      *,
      evidence_group:dt_evidence_groups!inner(
        case_file:dt_case_files!inner(company_id)
      )
    `)
    .eq('status', 'processing')
    .eq('evidence_group.case_file.company_id', companyId)
    .not('external_id', 'is', null);

  if (error) throw error;
  if (!pendingEvidences || pendingEvidences.length === 0) {
    return { checked: 0, completed: 0 };
  }

  console.log(`Checking ${pendingEvidences.length} pending evidences for company ${companyId}`);

  let completed = 0;

  for (const evidence of pendingEvidences) {
    const updated = await checkAndUpdateEvidence(supabase, token, evidence, companyId);
    if (updated.status === 'completed') {
      completed++;
    }
  }

  await logQTSPOperation(supabase, companyId, 'check_pending', null,
    { count: pendingEvidences.length }, { completed },
    'success', null, Date.now() - startTime);

  return { checked: pendingEvidences.length, completed };
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { action, company_id, ...params } = await req.json();

    // company_id is now REQUIRED for all actions
    if (!company_id) {
      throw new Error('company_id is required');
    }

    // Get company info
    const { data: company } = await supabase
      .from('company')
      .select('id, name')
      .eq('id', company_id)
      .single();

    if (!company) {
      throw new Error(`Company not found: ${company_id}`);
    }

    console.log(`Processing QTSP action '${action}' for company: ${company.name} (${company.id})`);

    // Authenticate with Digital Trust
    const token = await authenticate();

    // Get or create case file for this company
    const caseFile = await getOrCreateCaseFile(supabase, token, company.id, company.name);

    if (action === 'timestamp_daily') {
      const { daily_root_id, root_hash, date } = params;
      
      if (!daily_root_id || !root_hash || !date) {
        throw new Error('Missing required parameters: daily_root_id, root_hash, date');
      }

      const yearMonth = date.substring(0, 7);
      const evidenceGroup = await getOrCreateEvidenceGroup(
        supabase, token, caseFile.id, caseFile.externalId, yearMonth
      );

      const result = await createTSPEvidence(
        supabase, token, evidenceGroup.externalId, evidenceGroup.id,
        daily_root_id, root_hash, date, company.id
      );

      return new Response(
        JSON.stringify({ 
          success: true, 
          message: result.alreadyExists ? 'Daily root already timestamped' : 'Daily root timestamped',
          already_exists: result.alreadyExists,
          evidence: result.evidence 
        }),
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

      const pdfBytes = Uint8Array.from(atob(pdf_base64), c => c.charCodeAt(0));
      
      const result = await sealPDF(
        supabase, token, evidenceGroup.externalId, evidenceGroup.id,
        pdfBytes.buffer, report_month, file_name, company.id
      );

      return new Response(
        JSON.stringify({ 
          success: true, 
          sealed_pdf_path: result.sealedPdfPath,
          already_exists: result.alreadyExists
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );

    } else if (action === 'check_status') {
      const { evidence_id } = params;
      
      if (evidence_id) {
        const { data: evidence } = await supabase
          .from('dt_evidences')
          .select('*')
          .eq('id', evidence_id)
          .single();

        if (evidence && evidence.status === 'processing') {
          const updated = await checkAndUpdateEvidence(supabase, token, evidence, company.id);
          return new Response(
            JSON.stringify({ success: true, evidence: updated }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        return new Response(
          JSON.stringify({ success: true, evidence }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      } else {
        // Check all pending evidences
        const result = await checkPendingEvidences(supabase, token, company.id);
        return new Response(
          JSON.stringify({ success: true, ...result }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

    } else if (action === 'retry_failed') {
      const result = await retryFailedEvidences(supabase, token, company.id);
      return new Response(
        JSON.stringify({ success: true, ...result }),
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
