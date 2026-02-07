import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Exponential backoff configuration
const BASE_DELAY_SECONDS = 60; // 1 minute
const MAX_DELAY_SECONDS = 3600; // 1 hour max
const MAX_RETRIES = 10;

interface RetryResult {
  evidence_id: string;
  status: 'retried' | 'skipped' | 'max_retries' | 'error';
  message: string;
  next_retry_at?: string;
}

// Calculate next retry delay with exponential backoff + jitter
function calculateBackoff(retryCount: number, currentBackoff: number): number {
  // Exponential: 60, 120, 240, 480, 960, 1920, 3600...
  const exponentialDelay = Math.min(
    currentBackoff * 2 || BASE_DELAY_SECONDS,
    MAX_DELAY_SECONDS
  );
  
  // Add jitter (±10%) to prevent thundering herd
  const jitter = exponentialDelay * 0.1 * (Math.random() * 2 - 1);
  
  return Math.round(exponentialDelay + jitter);
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const startTime = Date.now();
  const results: RetryResult[] = [];

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Parse optional request body
    let specificEvidenceId: string | null = null;
    let forceRetry = false;
    
    try {
      const body = await req.json();
      specificEvidenceId = body.evidence_id || null;
      forceRetry = body.force === true;
    } catch {
      // No body
    }

    console.log(`QTSP Retry started. Evidence: ${specificEvidenceId || 'all failed'}, Force: ${forceRetry}`);

    // Find evidences that need retry
    let query = supabase
      .from('dt_evidences')
      .select(`
        id,
        status,
        retry_count,
        error_message,
        next_retry_at,
        backoff_seconds,
        evidence_type,
        daily_root_id,
        report_month,
        evidence_group_id,
        evidence_group:evidence_group_id (
          id,
          external_id,
          case_file_id,
          case_file:case_file_id (
            id,
            external_id,
            company_id,
            company:company_id (
              id,
              name
            )
          )
        )
      `)
      .eq('status', 'failed');

    if (specificEvidenceId) {
      query = query.eq('id', specificEvidenceId);
    } else {
      // Only get evidences that are ready for retry (next_retry_at is in the past or null)
      if (!forceRetry) {
        query = query.or(`next_retry_at.is.null,next_retry_at.lte.${new Date().toISOString()}`);
      }
    }

    query = query.lt('retry_count', MAX_RETRIES);

    const { data: failedEvidences, error: fetchError } = await query;

    if (fetchError) throw fetchError;

    if (!failedEvidences || failedEvidences.length === 0) {
      console.log('No evidences to retry');
      return new Response(
        JSON.stringify({ 
          success: true, 
          message: 'No evidences pending retry',
          results: [],
          duration_ms: Date.now() - startTime
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Found ${failedEvidences.length} evidences to retry`);

    for (const evidence of failedEvidences) {
      const retryCount = (evidence.retry_count || 0) + 1;
      const currentBackoff = evidence.backoff_seconds || BASE_DELAY_SECONDS;
      
      const evidenceGroup = evidence.evidence_group as any;
      const caseFile = evidenceGroup?.case_file as any;
      const company = caseFile?.company as any;
      const companyId = company?.id;
      const companyName = company?.name || 'Unknown';

      if (retryCount > MAX_RETRIES) {
        console.log(`Evidence ${evidence.id} exceeded max retries (${MAX_RETRIES})`);
        results.push({
          evidence_id: evidence.id,
          status: 'max_retries',
          message: `Exceeded max retries (${MAX_RETRIES}). Manual intervention required.`,
        });
        continue;
      }

      try {
        console.log(`Retrying evidence ${evidence.id} (attempt ${retryCount}) for ${companyName}`);

        // Update retry tracking before attempting
        await supabase.from('dt_evidences').update({
          last_retry_at: new Date().toISOString(),
          retry_count: retryCount,
        }).eq('id', evidence.id);

        // Call qtsp-notarize to retry the operation
        let notarizeBody: Record<string, unknown>;

        if (evidence.evidence_type === 'daily_timestamp' && evidence.daily_root_id) {
          // Get daily root info
          const { data: dailyRoot } = await supabase
            .from('daily_roots')
            .select('root_hash, date')
            .eq('id', evidence.daily_root_id)
            .single();

          if (!dailyRoot) {
            throw new Error(`Daily root ${evidence.daily_root_id} not found`);
          }

          notarizeBody = {
            action: 'timestamp_daily',
            company_id: companyId,
            daily_root_id: evidence.daily_root_id,
            root_hash: dailyRoot.root_hash,
            date: dailyRoot.date,
          };
        } else if (evidence.evidence_type === 'monthly_report' && evidence.report_month) {
          notarizeBody = {
            action: 'seal_monthly',
            company_id: companyId,
            year_month: evidence.report_month,
          };
        } else {
          throw new Error(`Unknown evidence type or missing data: ${evidence.evidence_type}`);
        }

        const { data: notarizeResult, error: notarizeError } = await supabase.functions.invoke('qtsp-notarize', {
          body: notarizeBody,
        });

        if (notarizeError) {
          throw new Error(notarizeError.message);
        }

        if (notarizeResult?.success) {
          console.log(`Evidence ${evidence.id} retried successfully`);
          
          // Log successful retry
          await supabase.from('qtsp_audit_log').insert({
            action: 'retry_success',
            status: 'success',
            company_id: companyId,
            evidence_id: evidence.id,
            duration_ms: Date.now() - startTime,
            request_payload: { retry_count: retryCount, evidence_type: evidence.evidence_type },
            response_payload: notarizeResult,
          });

          results.push({
            evidence_id: evidence.id,
            status: 'retried',
            message: `Successfully retried on attempt ${retryCount}`,
          });
        } else {
          throw new Error(notarizeResult?.error || 'Retry failed');
        }

      } catch (retryError: unknown) {
        const errorMessage = retryError instanceof Error ? retryError.message : 'Unknown error';
        console.error(`Retry failed for ${evidence.id}:`, retryError);

        // Calculate next retry time with exponential backoff
        const newBackoff = calculateBackoff(retryCount, currentBackoff);
        const nextRetryAt = new Date(Date.now() + newBackoff * 1000);

        // Update evidence with new retry schedule
        await supabase.from('dt_evidences').update({
          status: 'failed',
          error_message: errorMessage,
          backoff_seconds: newBackoff,
          next_retry_at: nextRetryAt.toISOString(),
        }).eq('id', evidence.id);

        // Log failed retry
        await supabase.from('qtsp_audit_log').insert({
          action: 'retry_failed',
          status: 'error',
          company_id: companyId,
          evidence_id: evidence.id,
          duration_ms: Date.now() - startTime,
          error_message: errorMessage,
          request_payload: { 
            retry_count: retryCount, 
            evidence_type: evidence.evidence_type,
            backoff_seconds: newBackoff,
          },
          response_payload: { 
            next_retry_at: nextRetryAt.toISOString(),
            retries_remaining: MAX_RETRIES - retryCount,
          },
        });

        results.push({
          evidence_id: evidence.id,
          status: 'error',
          message: `Retry ${retryCount} failed: ${errorMessage}. Next retry in ${Math.round(newBackoff / 60)} minutes.`,
          next_retry_at: nextRetryAt.toISOString(),
        });
      }
    }

    const duration = Date.now() - startTime;
    const successCount = results.filter(r => r.status === 'retried').length;
    const errorCount = results.filter(r => r.status === 'error').length;

    console.log(`QTSP Retry completed in ${duration}ms. Success: ${successCount}, Failed: ${errorCount}`);

    return new Response(
      JSON.stringify({
        success: errorCount === 0,
        message: `Processed ${failedEvidences.length} evidences: ${successCount} retried, ${errorCount} failed`,
        duration_ms: duration,
        results,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('QTSP Retry error:', error);

    return new Response(
      JSON.stringify({ 
        success: false, 
        error: errorMessage,
        duration_ms: Date.now() - startTime,
        results 
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
