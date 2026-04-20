import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient, SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
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

function envFirst(...names: string[]): string | null {
  for (const name of names) {
    const value = Deno.env.get(name);
    if (value && value.trim()) return value.trim();
  }
  return null;
}

function requireEnv(...names: string[]): string {
  const value = envFirst(...names);
  if (!value) {
    throw new Error(`Missing required env var: ${names.join(' or ')}`);
  }
  return value;
}

// =============================================================================
// QTSP CONFIGURATION - Centralized constants (can be moved to env vars later)
// =============================================================================
const QTSP_CONFIG = {
  // TSP Provider for timestamping
  TSP_PROVIDER: Deno.env.get('QTSP_TSP_PROVIDER') || 'EADTrust',
  // Signature provider for PDF sealing
  SIGNATURE_PROVIDER: Deno.env.get('QTSP_SIGNATURE_PROVIDER') || 'EADTRUST',
  // Signature type for PDF sealing (PAdES-LTV for long-term validation)
  SIGNATURE_TYPE: Deno.env.get('QTSP_SIGNATURE_TYPE') || 'PADES_LTV',
  // Signature level (SIMPLE = simple electronic signature, not qualified)
  SIGNATURE_LEVEL: Deno.env.get('QTSP_SIGNATURE_LEVEL') || 'SIMPLE',
  // Authentication factor for signatures
  AUTH_FACTOR: 1,
  // System identifier
  SYSTEM_ID: 'time-control-hub',
  // Evidence group type (required by Digital Trust API)
  EVIDENCE_GROUP_TYPE: 'VIDEO',
  // Case file category
  CASE_FILE_CATEGORY: 'TIME_TRACKING',
  // Polling configuration
  TSP_POLL_INTERVAL_MS: 2000,
  TSP_POLL_MAX_ATTEMPTS: 10,
  PDF_POLL_INTERVAL_MS: 3000,
  PDF_POLL_MAX_ATTEMPTS: 30,
  HASH_POLL_MAX_ATTEMPTS: 5,
} as const;

// =============================================================================
// TYPE DEFINITIONS
// =============================================================================

// Digital Trust API Response Types
interface DTAuthResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
}

interface DTCaseFile {
  id: string;
  title: string;
  code: string;
  category: string;
  owner: string;
}

interface DTEvidenceGroup {
  id: string;
  name: string;
  code?: string;
}

interface DTEvidence {
  id: string;
  status: string;
  tspToken?: string;
  signedFile?: {
    content: string;
    name?: string;
  };
  signatureInfo?: Record<string, unknown>;
}

// Internal database types
interface DbEvidence {
  id: string;
  evidence_group_id: string;
  evidence_type: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  external_id: string | null;
  daily_root_id: string | null;
  report_month: string | null;
  original_pdf_path: string | null;
  sealed_pdf_path: string | null;
  tsp_token: string | null;
  tsp_timestamp: string | null;
  completed_at: string | null;
  error_message: string | null;
  retry_count: number;
  signature_data: Record<string, unknown> | null;
}

interface DbDailyRoot {
  id: string;
  date: string;
  root_hash: string;
  company_id: string;
}

interface Company {
  id: string;
  name: string;
}

// Request payload types
interface QTSPRequest {
  action: string;
  company_id?: string;
  daily_root_id?: string;
  root_hash?: string;
  date?: string;
  pdf_base64?: string;
  report_month?: string;
  file_name?: string;
  test_mode?: boolean;
  message_id?: string;
  content_hash?: string;
  recipient_id?: string;
  notification_id?: string;
  notification_type?: string;
  evidence_id?: string;
}

// QTSP Operation log entry
interface QTSPLogEntry {
  company_id: string;
  action: string;
  evidence_id: string | null;
  request_payload: Record<string, unknown>;
  response_payload: Record<string, unknown> | null;
  status: string;
  error_message: string | null;
  duration_ms: number;
}

// Log QTSP operation to audit table
async function logQTSPOperation(
  supabase: SupabaseClient,
  companyId: string,
  action: string,
  evidenceId: string | null,
  requestPayload: Record<string, unknown>,
  responsePayload: Record<string, unknown> | null,
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
  const loginUrl = requireEnv('DIGITALTRUST_LOGIN_URL', 'QTSP_OKTA_TOKEN_URL');
  const clientId = requireEnv('DIGITALTRUST_CLIENT_ID', 'QTSP_CLIENT_API');
  const clientSecret = requireEnv('DIGITALTRUST_CLIENT_SECRET', 'QTSP_CLIENT_SECRET');

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
  supabase: SupabaseClient,
  token: string,
  companyId: string,
  companyName: string
): Promise<{ id: string; externalId: string }> {
  const apiUrl = requireEnv('DIGITALTRUST_API_URL', 'QTSP_API_BASE_URL');

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
  // Generate a unique ID for the case file (UUID format required by DT API)
  const caseFileId = crypto.randomUUID();

  // Normalize company name to avoid special character issues
  const normalizedName = companyName
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9\s-]/g, '');

  const requestBody = {
    id: caseFileId,
    title: `Registro Horario - ${normalizedName}`.substring(0, 100),
    code: `RH-${companyId.substring(0, 8).toUpperCase()}`,
    category: QTSP_CONFIG.CASE_FILE_CATEGORY,
    owner: QTSP_CONFIG.SYSTEM_ID,
    metadata: {
      system: QTSP_CONFIG.SYSTEM_ID,
      company_id: companyId,
      company_name: normalizedName,
    },
  };
  console.log(`Creating case file with body: ${JSON.stringify(requestBody)}`);

  const response = await fetch(`${apiUrl}/digital-trust/api/v1/private/case-files`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(requestBody),
  });

  if (!response.ok) {
    const error = await response.text();
    console.error('Create case file failed:', error);

    // Handle 409 Conflict - Case File already exists in Digital Trust
    if (response.status === 409) {
      console.log(`Case file already exists in DT, searching by code...`);
      const caseCode = `RH-${companyId.substring(0, 8).toUpperCase()}`;

      const searchResponse = await fetch(
        `${apiUrl}/digital-trust/api/v1/private/case-files?code=${caseCode}`,
        { headers: { 'Authorization': `Bearer ${token}` } }
      );

      if (searchResponse.ok) {
        const searchData = await searchResponse.json();
        // API uses pagination, find by code in records array
        const existingCaseFile = searchData.records?.find(
          (cf: any) => cf.code === caseCode
        );

        if (existingCaseFile) {
          console.log(`Found existing case file in DT: ${existingCaseFile.id}`);

          // Save to our local database
          const { data: inserted, error: insertError } = await supabase
            .from('dt_case_files')
            .insert({
              external_id: existingCaseFile.id,
              company_id: companyId,
              name: existingCaseFile.title,
              description: `Evidencias de fichaje para ${companyName}`,
            })
            .select()
            .single();

          if (insertError) throw insertError;
          return { id: inserted.id, externalId: existingCaseFile.id };
        }
      }

      console.error('Could not find existing case file in DT after 409');
    }

    throw new Error(`Failed to create case file: ${response.status}`);
  }

  const caseFile: DTCaseFile = await response.json();

  // Store in our database
  const { data: inserted, error: insertError } = await supabase
    .from('dt_case_files')
    .insert({
      external_id: caseFile.id,
      company_id: companyId,
      name: caseFile.title,
      description: `Evidencias de fichaje para ${companyName}`,
    })
    .select()
    .single();

  if (insertError) throw insertError;

  return { id: inserted.id, externalId: caseFile.id };
}

// Get or create Evidence Group for a month
async function getOrCreateEvidenceGroup(
  supabase: SupabaseClient,
  token: string,
  caseFileId: string,
  caseFileExternalId: string,
  yearMonth: string
): Promise<{ id: string; externalId: string }> {
  const apiUrl = requireEnv('DIGITALTRUST_API_URL', 'QTSP_API_BASE_URL');

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
  const evidenceGroupId = crypto.randomUUID();

  const response = await fetch(`${apiUrl}/digital-trust/api/v1/private/case-files/${caseFileExternalId}/evidence-groups`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      id: evidenceGroupId,
      name: `Fichajes ${yearMonth}`,
      type: QTSP_CONFIG.EVIDENCE_GROUP_TYPE,
      code: `GRP-${yearMonth.replace('-', '')}`,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    console.error('Create evidence group failed:', error);

    // Handle 409 Conflict - Evidence Group already exists in Digital Trust
    if (response.status === 409) {
      const groupCode = `GRP-${yearMonth.replace('-', '')}`;
      console.log(`Evidence group already exists in DT (code: ${groupCode}), trying global search...`);

      // Try global evidence-groups endpoint with code filter
      const searchResponse = await fetch(
        `${apiUrl}/digital-trust/api/v1/private/evidence-groups?code=${groupCode}`,
        { headers: { 'Authorization': `Bearer ${token}` } }
      );

      if (searchResponse.ok) {
        const searchData = await searchResponse.json();
        console.log(`Evidence groups global search response: ${JSON.stringify(searchData).substring(0, 500)}`);

        // Try different response formats
        const groups = searchData.records || searchData.content || (Array.isArray(searchData) ? searchData : []);
        const existingGroup = groups.find((eg: any) => eg.code === groupCode);

        if (existingGroup) {
          console.log(`Found existing evidence group in DT: ${existingGroup.id}`);

          const { data: inserted, error: insertError } = await supabase
            .from('dt_evidence_groups')
            .insert({
              external_id: existingGroup.id,
              case_file_id: caseFileId,
              name: existingGroup.name,
              year_month: yearMonth,
            })
            .select()
            .single();

          if (insertError) throw insertError;
          return { id: inserted.id, externalId: existingGroup.id };
        }
      } else {
        const searchStatus = searchResponse.status;
        const searchError = await searchResponse.text();
        console.log(`Global evidence-groups search failed: ${searchStatus} - ${searchError}`);

        // Try extracting ID from error message if possible
        // Error format: "EvidenceGroup already exists with code GRP-202601"
        // Unfortunately the error doesn't include the ID, so we need an alternative

        // As a last resort, try to get the case file details which may include evidence groups
        console.log(`Trying to get case file details to find evidence group...`);
        const caseFileResponse = await fetch(
          `${apiUrl}/digital-trust/api/v1/private/case-files/${caseFileExternalId}`,
          { headers: { 'Authorization': `Bearer ${token}` } }
        );

        if (caseFileResponse.ok) {
          const caseFileData = await caseFileResponse.json();
          console.log(`Case file details: ${JSON.stringify(caseFileData).substring(0, 800)}`);

          // Check if evidence groups are included in case file response
          const evidenceGroups = caseFileData.evidenceGroups || caseFileData.groups || [];
          const existingGroup = evidenceGroups.find((eg: any) => eg.code === groupCode);

          if (existingGroup) {
            console.log(`Found evidence group in case file details: ${existingGroup.id}`);

            const { data: inserted, error: insertError } = await supabase
              .from('dt_evidence_groups')
              .insert({
                external_id: existingGroup.id,
                case_file_id: caseFileId,
                name: existingGroup.name || `Fichajes ${yearMonth}`,
                year_month: yearMonth,
              })
              .select()
              .single();

            if (insertError) throw insertError;
            return { id: inserted.id, externalId: existingGroup.id };
          }
        }
      }

      console.error('Could not find existing evidence group in DT after 409');
    }

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
  supabase: SupabaseClient,
  token: string,
  caseFileExternalId: string,
  evidenceGroupExternalId: string,
  evidenceGroupId: string,
  dailyRootId: string,
  rootHash: string,
  date: string,
  companyId: string
): Promise<{ success: boolean; alreadyExists?: boolean; evidence?: DbEvidence | null }> {
  const apiUrl = requireEnv('DIGITALTRUST_API_URL', 'QTSP_API_BASE_URL');
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
    // Create evidence in Digital Trust with TSP using correct API schema
    // Endpoint: /case-files/{caseFileId}/evidence-groups/{evidenceGroupId}/evidences
    const evidenceExternalId = crypto.randomUUID();

    const requestBody = {
      evidenceId: evidenceExternalId,
      hash: rootHash,
      createdBy: QTSP_CONFIG.SYSTEM_ID,
      title: `Merkle Root ${date}`,
      capturedAt: new Date().toISOString(),
      custodyType: 'EXTERNAL',
      testimony: {
        TSP: {
          required: true,
          providers: [QTSP_CONFIG.TSP_PROVIDER]
        }
      },
      metadata: {
        system: QTSP_CONFIG.SYSTEM_ID,
        daily_root_id: dailyRootId,
        date: date,
      }
    };

    console.log(`Creating evidence with body: ${JSON.stringify(requestBody)}`);

    const response = await fetch(`${apiUrl}/digital-trust/api/v1/private/case-files/${caseFileExternalId}/evidence-groups/${evidenceGroupExternalId}/evidences`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Failed to create evidence: ${error}`);
    }

    // Handle response - may be empty body with 201 status
    let dtEvidence: DTEvidence;
    const responseText = await response.text();
    if (responseText) {
      dtEvidence = JSON.parse(responseText);
    } else {
      // If response is empty, use the ID we generated
      console.log(`Evidence created with empty response, using generated ID: ${evidenceExternalId}`);
      dtEvidence = { id: evidenceExternalId, status: 'pending' };
    }
    console.log(`DT evidence created: ${dtEvidence.id}`);

    // Poll for TSP token (may take a few seconds)
    let tspToken = null;
    let attempts = 0;
    const maxAttempts = QTSP_CONFIG.TSP_POLL_MAX_ATTEMPTS;

    while (!tspToken && attempts < maxAttempts) {
      await new Promise(resolve => setTimeout(resolve, QTSP_CONFIG.TSP_POLL_INTERVAL_MS));

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

// Create generic hash evidence for messages, acknowledgments, notifications
async function createGenericHashEvidence(
  supabase: SupabaseClient,
  token: string,
  caseFileExternalId: string,
  evidenceGroupExternalId: string,
  evidenceGroupId: string,
  evidenceType: string, // 'message_hash', 'acknowledgment', 'notification_hash'
  entityId: string,
  contentHash: string,
  tableName: string, // 'company_messages', 'message_recipients', etc.
  companyId: string,
  metadata?: Record<string, unknown>
): Promise<{ success: boolean; alreadyExists?: boolean; evidence?: DbEvidence | null }> {
  const apiUrl = requireEnv('DIGITALTRUST_API_URL', 'QTSP_API_BASE_URL');
  const startTime = Date.now();

  // IDEMPOTENCY CHECK: Check if evidence already exists for this entity
  const { data: existingRecord } = await supabase
    .from(tableName)
    .select('qtsp_evidence_id')
    .eq('id', entityId)
    .maybeSingle();

  if (existingRecord?.qtsp_evidence_id) {
    console.log(`Evidence already exists for ${tableName}.${entityId}`);
    const { data: existingEvidence } = await supabase
      .from('dt_evidences')
      .select('*')
      .eq('id', existingRecord.qtsp_evidence_id)
      .single();

    if (existingEvidence?.status === 'completed') {
      return { success: true, alreadyExists: true, evidence: existingEvidence };
    }
  }

  // Create evidence record in dt_evidences
  const { data: evidence, error: evidenceError } = await supabase
    .from('dt_evidences')
    .insert({
      evidence_group_id: evidenceGroupId,
      evidence_type: evidenceType,
      status: 'processing',
    })
    .select()
    .single();

  if (evidenceError) throw evidenceError;

  try {
    // Create evidence in Digital Trust
    const evidenceExternalId = crypto.randomUUID();

    const requestBody = {
      evidenceId: evidenceExternalId,
      hash: contentHash,
      createdBy: QTSP_CONFIG.SYSTEM_ID,
      title: `${evidenceType} ${new Date().toISOString().split('T')[0]}`,
      capturedAt: new Date().toISOString(),
      custodyType: 'EXTERNAL',
      testimony: {
        TSP: {
          required: true,
          providers: [QTSP_CONFIG.TSP_PROVIDER]
        }
      },
      metadata: {
        system: QTSP_CONFIG.SYSTEM_ID,
        evidence_type: evidenceType,
        entity_id: entityId,
        table_name: tableName,
        ...metadata,
      }
    };

    console.log(`Creating ${evidenceType} evidence for ${tableName}.${entityId}`);

    const response = await fetch(`${apiUrl}/digital-trust/api/v1/private/case-files/${caseFileExternalId}/evidence-groups/${evidenceGroupExternalId}/evidences`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Failed to create evidence: ${error}`);
    }

    // Parse response
    let dtEvidence: DTEvidence;
    const responseText = await response.text();
    if (responseText) {
      dtEvidence = JSON.parse(responseText);
    } else {
      dtEvidence = { id: evidenceExternalId, status: 'pending' };
    }

    // Poll for TSP token (max 5 attempts for non-critical items)
    let tspToken = null;
    let attempts = 0;
    const maxAttempts = QTSP_CONFIG.HASH_POLL_MAX_ATTEMPTS;

    while (!tspToken && attempts < maxAttempts) {
      await new Promise(resolve => setTimeout(resolve, QTSP_CONFIG.TSP_POLL_INTERVAL_MS));

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

    // Update dt_evidences record
    const updateData = {
      external_id: dtEvidence.id,
      status: tspToken ? 'completed' : 'processing',
      tsp_token: tspToken,
      tsp_timestamp: tspToken ? new Date().toISOString() : null,
      completed_at: tspToken ? new Date().toISOString() : null,
    };

    await supabase.from('dt_evidences').update(updateData).eq('id', evidence.id);

    // Update the source table with evidence reference and hash
    const sourceUpdate: Record<string, string> = { qtsp_evidence_id: evidence.id };
    if (tableName === 'message_recipients') {
      sourceUpdate.ack_content_hash = contentHash;
    } else {
      sourceUpdate.content_hash = contentHash;
    }
    await supabase.from(tableName).update(sourceUpdate).eq('id', entityId);

    console.log(`${evidenceType} evidence created for ${entityId}, token: ${tspToken ? 'obtained' : 'pending'}`);

    await logQTSPOperation(supabase, companyId, evidenceType, evidence.id,
      { entity_id: entityId, table_name: tableName }, { external_id: dtEvidence.id, tsp_token: !!tspToken },
      tspToken ? 'success' : 'pending', null, Date.now() - startTime);

    return { success: true, evidence: { ...evidence, ...updateData } };

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error(`Error creating ${evidenceType} evidence:`, error);

    await supabase.from('dt_evidences').update({
      status: 'failed',
      error_message: errorMessage,
    }).eq('id', evidence.id);

    await logQTSPOperation(supabase, companyId, evidenceType, evidence.id,
      { entity_id: entityId, table_name: tableName }, null, 'failed', errorMessage, Date.now() - startTime);

    throw error;
  }
}

// Check and update evidence status from Digital Trust
async function checkAndUpdateEvidence(
  supabase: SupabaseClient,
  token: string,
  evidence: DbEvidence,
  companyId: string
): Promise<DbEvidence> {
  const apiUrl = requireEnv('DIGITALTRUST_API_URL', 'QTSP_API_BASE_URL');
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

    const dtEvidence: DTEvidence = await response.json();

    const updateData: Partial<DbEvidence> = {};

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
  supabase: SupabaseClient,
  token: string,
  caseFileExternalId: string,
  evidenceGroupExternalId: string,
  evidenceGroupId: string,
  pdfBuffer: ArrayBuffer,
  reportMonth: string,
  fileName: string,
  companyId: string
): Promise<{ sealedPdfPath: string; alreadyExists?: boolean }> {
  const apiUrl = requireEnv('DIGITALTRUST_API_URL', 'QTSP_API_BASE_URL');
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

    // Create evidence with qualified signature (using nested endpoint with caseFileId)
    // FIX: Use nested endpoint as flat /evidence-groups endpoint often returns 404
    const response = await fetch(`${apiUrl}/digital-trust/api/v1/private/case-files/${caseFileExternalId}/evidence-groups/${evidenceGroupExternalId}/evidences`, {
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
          provider: QTSP_CONFIG.SIGNATURE_PROVIDER,
          type: QTSP_CONFIG.SIGNATURE_TYPE,
          level: QTSP_CONFIG.SIGNATURE_LEVEL,
          authenticationFactor: QTSP_CONFIG.AUTH_FACTOR,
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
    const maxAttempts = QTSP_CONFIG.PDF_POLL_MAX_ATTEMPTS;

    while (!sealedPdfBase64 && attempts < maxAttempts) {
      await new Promise(resolve => setTimeout(resolve, QTSP_CONFIG.PDF_POLL_INTERVAL_MS));

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
  supabase: SupabaseClient,
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
          evidence.evidence_group.case_file?.external_id || '',
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
  supabase: SupabaseClient,
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

// Health check - test Digital Trust API connectivity without creating entities
async function healthCheck(): Promise<{
  status: 'healthy' | 'degraded' | 'unhealthy';
  auth: boolean;
  api: boolean;
  latency_ms: number;
  message: string;
}> {
  const startTime = Date.now();
  let authOk = false;
  let apiOk = false;

  try {
    // Test authentication
    const token = await authenticate();
    authOk = true;

    // Test API connectivity with a simple GET request
    const apiUrl = requireEnv('DIGITALTRUST_API_URL', 'QTSP_API_BASE_URL');
    const response = await fetch(`${apiUrl}/digital-trust/api/v1/private/case-files?limit=1`, {
      headers: { 'Authorization': `Bearer ${token}` },
    });
    apiOk = response.ok;

    const latency = Date.now() - startTime;

    if (authOk && apiOk) {
      return {
        status: 'healthy',
        auth: true,
        api: true,
        latency_ms: latency,
        message: 'Digital Trust API is operational',
      };
    } else {
      return {
        status: 'degraded',
        auth: authOk,
        api: apiOk,
        latency_ms: latency,
        message: apiOk ? 'API accessible but with issues' : 'API endpoint not responding correctly',
      };
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return {
      status: 'unhealthy',
      auth: authOk,
      api: false,
      latency_ms: Date.now() - startTime,
      message: `Connection failed: ${errorMessage}`,
    };
  }
}

// Verify authorization for the request
async function authorizeRequest(
  req: Request,
  supabaseAdmin: SupabaseClient,
  companyId?: string
): Promise<void> {
  // 1. Check Service Role Key (Bypass for internal scheduler)
  const authHeader = req.headers.get('Authorization');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

  // Check if the token matches service role key directly
  if (authHeader?.replace('Bearer ', '') === serviceRoleKey) {
    return;
  }

  // 2. Verify User Token
  if (!authHeader) throw new Error('Unauthorized: No token provided');

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;

  const authClient = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: authHeader } }
  });

  const { data: { user }, error: userError } = await authClient.auth.getUser();

  if (userError || !user) {
    throw new Error('Unauthorized: Invalid token');
  }

  // If no companyId (e.g. health check), we just ensure the user is authenticated
  if (!companyId) {
    return;
  }

  // 3. Verify Company Access
  // Check if user is super_admin
  const { data: roles } = await supabaseAdmin
    .from('user_roles')
    .select('role')
    .eq('user_id', user.id);

  if (roles?.some(r => r.role === 'super_admin')) {
    return;
  }

  // Check if user belongs to the target company
  const { data: userCompany } = await supabaseAdmin
    .from('user_company')
    .select('company_id')
    .eq('user_id', user.id)
    .eq('company_id', companyId)
    .maybeSingle();

  if (!userCompany) {
    throw new Error('Forbidden: User does not belong to this company');
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json().catch(() => ({}));
    const { action, company_id, ...params } = body as Record<string, unknown>;

    if (!action || typeof action !== 'string') {
      return jsonResponse({ error: 'action is required' }, 400, corsHeaders);
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const caller = await requireCallerContext({
      req,
      supabaseAdmin: supabase,
      corsHeaders,
      allowServiceRole: true,
    });
    if (caller instanceof Response) return caller;

    if (caller.kind === 'user') {
      const roleError = requireAnyRole({ ctx: caller, allowed: ['super_admin', 'admin'], corsHeaders });
      if (roleError) return roleError;

      if (action !== 'health_check') {
        if (!company_id || typeof company_id !== 'string') {
          return jsonResponse({ error: 'company_id is required' }, 400, corsHeaders);
        }

        const companyAccess = await requireCompanyAccess({
          supabaseAdmin: supabase,
          ctx: caller,
          companyId: company_id,
          corsHeaders,
          allowEmployee: true,
        });
        if (companyAccess instanceof Response) return companyAccess;
      }
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Verify authorization
    await authorizeRequest(req, supabase, company_id);

    // Health check doesn't require company_id
    if (action === 'health_check') {
      const result = await healthCheck();
      return new Response(
        JSON.stringify({ success: true, ...result }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // company_id is REQUIRED for all other actions
    if (!company_id || typeof company_id !== 'string') {
      return jsonResponse({ error: 'company_id is required' }, 400, corsHeaders);
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
        supabase, token, caseFile.externalId, evidenceGroup.externalId, evidenceGroup.id,
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
      const { pdf_base64, report_month, file_name, test_mode } = params;

      // Define signature configuration from centralized config
      const signatureConfig = {
        provider: QTSP_CONFIG.SIGNATURE_PROVIDER,
        type: QTSP_CONFIG.SIGNATURE_TYPE,
        level: QTSP_CONFIG.SIGNATURE_LEVEL,
        authenticationFactor: QTSP_CONFIG.AUTH_FACTOR,
      };

      // Test mode: return signature configuration without actual sealing
      if (test_mode) {
        return new Response(
          JSON.stringify({
            success: true,
            test_mode: true,
            signature_config: signatureConfig,
            message: 'Test mode - signature configuration validated',
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      if (!pdf_base64 || !report_month || !file_name) {
        throw new Error('Missing required parameters: pdf_base64, report_month, file_name');
      }

      const evidenceGroup = await getOrCreateEvidenceGroup(
        supabase, token, caseFile.id, caseFile.externalId, report_month
      );

      const pdfBytes = Uint8Array.from(atob(pdf_base64), c => c.charCodeAt(0));

      const result = await sealPDF(
        supabase, token, caseFile.externalId, evidenceGroup.externalId, evidenceGroup.id,
        pdfBytes.buffer, report_month, file_name, company.id
      );

      return new Response(
        JSON.stringify({
          success: true,
          sealed_pdf_path: result.sealedPdfPath,
          already_exists: result.alreadyExists,
          signature_config: signatureConfig,
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

    } else if (action === 'timestamp_message') {
      // Timestamp a company message
      const { message_id, content_hash } = params;

      if (!message_id || !content_hash) {
        throw new Error('Missing required parameters: message_id, content_hash');
      }

      const yearMonth = new Date().toISOString().substring(0, 7);
      const evidenceGroup = await getOrCreateEvidenceGroup(
        supabase, token, caseFile.id, caseFile.externalId, yearMonth
      );

      const result = await createGenericHashEvidence(
        supabase, token, caseFile.externalId, evidenceGroup.externalId, evidenceGroup.id,
        'message_hash', message_id, content_hash, 'company_messages', company.id
      );

      return new Response(
        JSON.stringify({
          success: true,
          message: 'Message timestamped',
          evidence: result.evidence
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );

    } else if (action === 'timestamp_acknowledgment') {
      // Timestamp a message acknowledgment
      const { recipient_id, content_hash, message_id } = params;

      if (!recipient_id || !content_hash) {
        throw new Error('Missing required parameters: recipient_id, content_hash');
      }

      const yearMonth = new Date().toISOString().substring(0, 7);
      const evidenceGroup = await getOrCreateEvidenceGroup(
        supabase, token, caseFile.id, caseFile.externalId, yearMonth
      );

      const result = await createGenericHashEvidence(
        supabase, token, caseFile.externalId, evidenceGroup.externalId, evidenceGroup.id,
        'acknowledgment', recipient_id, content_hash, 'message_recipients', company.id,
        { message_id }
      );

      return new Response(
        JSON.stringify({
          success: true,
          message: 'Acknowledgment timestamped',
          evidence: result.evidence
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );

    } else if (action === 'timestamp_notification') {
      // Timestamp a notification
      const { notification_id, content_hash, notification_type, test_mode } = params;

      // Test mode: validate connectivity and return sample response
      if (test_mode) {
        return new Response(
          JSON.stringify({
            success: true,
            test_mode: true,
            evidence_id: 'test-evidence-id',
            status: 'completed',
            message: 'Test mode - timestamp_notification validated',
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      if (!notification_id || !content_hash) {
        throw new Error('Missing required parameters: notification_id, content_hash');
      }

      const tableName = notification_type === 'employee' ? 'employee_notifications' : 'compliance_notifications';
      const yearMonth = new Date().toISOString().substring(0, 7);
      const evidenceGroup = await getOrCreateEvidenceGroup(
        supabase, token, caseFile.id, caseFile.externalId, yearMonth
      );

      const result = await createGenericHashEvidence(
        supabase, token, caseFile.externalId, evidenceGroup.externalId, evidenceGroup.id,
        'notification_hash', notification_id, content_hash, tableName, company.id
      );

      return new Response(
        JSON.stringify({
          success: true,
          message: 'Notification timestamped',
          evidence: result.evidence
        }),
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
