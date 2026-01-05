import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface Company {
  id: string;
  name: string;
  timezone: string;
}

interface ProcessResult {
  companyId: string;
  companyName: string;
  success: boolean;
  message: string;
  dailyRootId?: string;
  error?: string;
}

// Get yesterday's date in a specific timezone
function getYesterdayInTimezone(timezone: string): string {
  const now = new Date();
  
  // Get current time in the target timezone
  const formatter = new Intl.DateTimeFormat('en-CA', { 
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  });
  
  // Get yesterday by subtracting 24 hours
  const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  
  return formatter.format(yesterday); // Returns YYYY-MM-DD
}

// Check if it's the right time to process a company (between 2-4 AM local time)
function shouldProcessCompany(timezone: string): boolean {
  const now = new Date();
  
  // Get current hour in the company's timezone
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    hour: 'numeric',
    hour12: false
  });
  
  const hour = parseInt(formatter.format(now), 10);
  
  // Process between 2 AM and 5 AM local time
  return hour >= 2 && hour <= 5;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const startTime = Date.now();
  const results: ProcessResult[] = [];

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Parse optional request body
    let forceAll = false;
    let specificCompanyId: string | null = null;
    let specificDate: string | null = null;
    
    try {
      const body = await req.json();
      forceAll = body.force_all === true;
      specificCompanyId = body.company_id || null;
      specificDate = body.date || null;
    } catch {
      // No body or invalid JSON, use defaults
    }

    console.log(`QTSP Scheduler started. Force all: ${forceAll}, Company: ${specificCompanyId || 'all'}, Date: ${specificDate || 'auto'}`);

    // Get all active companies
    let companiesQuery = supabase
      .from('company')
      .select('id, name, timezone');

    if (specificCompanyId) {
      companiesQuery = companiesQuery.eq('id', specificCompanyId);
    }

    const { data: companies, error: companiesError } = await companiesQuery;

    if (companiesError) throw companiesError;
    if (!companies || companies.length === 0) {
      console.log('No companies found');
      return new Response(
        JSON.stringify({ success: true, message: 'No companies to process', results: [] }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Found ${companies.length} companies to check`);

    for (const company of companies as Company[]) {
      const timezone = company.timezone || 'Europe/Madrid';
      
      // Check if it's the right time for this company (unless forced or specific date)
      if (!forceAll && !specificDate && !shouldProcessCompany(timezone)) {
        console.log(`Skipping ${company.name}: not in processing window for timezone ${timezone}`);
        results.push({
          companyId: company.id,
          companyName: company.name,
          success: true,
          message: `Skipped: not in processing window (${timezone})`,
        });
        continue;
      }

      const dateToProcess = specificDate || getYesterdayInTimezone(timezone);
      console.log(`Processing ${company.name} (${timezone}) for date ${dateToProcess}`);

      try {
        // Check if daily root already exists for this date
        const { data: existingRoot } = await supabase
          .from('daily_roots')
          .select('id, root_hash')
          .eq('company_id', company.id)
          .eq('date', dateToProcess)
          .maybeSingle();

        if (existingRoot) {
          console.log(`Daily root already exists for ${company.name} on ${dateToProcess}`);
          
          // Check if it's already timestamped
          const { data: existingEvidence } = await supabase
            .from('dt_evidences')
            .select('id, status')
            .eq('daily_root_id', existingRoot.id)
            .maybeSingle();

          if (existingEvidence?.status === 'completed') {
            results.push({
              companyId: company.id,
              companyName: company.name,
              success: true,
              message: `Already processed: daily root and timestamp exist for ${dateToProcess}`,
              dailyRootId: existingRoot.id,
            });
            continue;
          }

          // Has root but not timestamped - call qtsp-notarize directly
          console.log(`Timestamping existing daily root for ${company.name}`);
          const notarizeResponse = await supabase.functions.invoke('qtsp-notarize', {
            body: {
              action: 'timestamp_daily',
              company_id: company.id,
              daily_root_id: existingRoot.id,
              root_hash: existingRoot.root_hash,
              date: dateToProcess,
            },
          });

          if (notarizeResponse.error) {
            throw new Error(notarizeResponse.error.message);
          }

          results.push({
            companyId: company.id,
            companyName: company.name,
            success: true,
            message: `Timestamped existing daily root for ${dateToProcess}`,
            dailyRootId: existingRoot.id,
          });
          continue;
        }

        // No daily root exists - call generate-daily-root
        console.log(`Generating daily root for ${company.name} on ${dateToProcess}`);
        const generateResponse = await supabase.functions.invoke('generate-daily-root', {
          body: {
            date: dateToProcess,
            company_id: company.id,
          },
        });

        if (generateResponse.error) {
          throw new Error(generateResponse.error.message);
        }

        const generateData = generateResponse.data;

        if (!generateData?.success) {
          throw new Error(generateData?.error || 'Unknown error generating daily root');
        }

        results.push({
          companyId: company.id,
          companyName: company.name,
          success: true,
          message: `Generated and timestamped daily root for ${dateToProcess}`,
          dailyRootId: generateData.companies?.[0]?.daily_root_id,
        });

      } catch (companyError: unknown) {
        const errorMessage = companyError instanceof Error ? companyError.message : 'Unknown error';
        console.error(`Error processing ${company.name}:`, companyError);
        results.push({
          companyId: company.id,
          companyName: company.name,
          success: false,
          message: `Failed to process ${dateToProcess}`,
          error: errorMessage,
        });
      }
    }

    const duration = Date.now() - startTime;
    const successCount = results.filter(r => r.success).length;
    const failCount = results.filter(r => !r.success).length;

    console.log(`QTSP Scheduler completed in ${duration}ms. Success: ${successCount}, Failed: ${failCount}`);

    return new Response(
      JSON.stringify({
        success: failCount === 0,
        message: `Processed ${companies.length} companies: ${successCount} success, ${failCount} failed`,
        duration_ms: duration,
        results,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('QTSP Scheduler error:', error);
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
