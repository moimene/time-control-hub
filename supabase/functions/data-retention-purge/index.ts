import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Helper function to compute SHA-256 hash
async function computeHash(data: string): Promise<string> {
  const encoder = new TextEncoder();
  const dataBuffer = encoder.encode(data);
  const hashBuffer = await crypto.subtle.digest('SHA-256', dataBuffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

// Table configurations for purging
const PURGE_CONFIGS: Record<string, {
  table: string;
  dateColumn: string;
  companyColumn: string;
  additionalFilters?: Record<string, any>;
}> = {
  time_events: {
    table: 'time_events',
    dateColumn: 'timestamp',
    companyColumn: 'company_id',
  },
  corrected_events: {
    table: 'corrected_events',
    dateColumn: 'timestamp',
    companyColumn: 'company_id',
  },
  correction_requests: {
    table: 'correction_requests',
    dateColumn: 'created_at',
    companyColumn: 'company_id',
  },
  absence_requests: {
    table: 'absence_requests',
    dateColumn: 'end_date',
    companyColumn: 'company_id',
  },
  audit_log: {
    table: 'audit_log',
    dateColumn: 'created_at',
    companyColumn: 'company_id',
  },
  document_acknowledgments: {
    table: 'document_acknowledgments',
    dateColumn: 'acknowledged_at',
    companyColumn: 'company_id',
  },
  contingency_records: {
    table: 'contingency_records',
    dateColumn: 'contingency_date',
    companyColumn: 'company_id',
  },
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const body = await req.json().catch(() => ({}));
    const { company_id, dry_run = false } = body;

    console.log(`Data retention purge started. Dry run: ${dry_run}, Company: ${company_id || 'all'}`);

    const results: Array<{
      company_id: string;
      company_name: string;
      category: string;
      records_found: number;
      records_purged: number;
      oldest_date: string | null;
      newest_date: string | null;
      cutoff_date: string;
    }> = [];

    // Get all companies with retention config (or specific company)
    let companiesQuery = supabase
      .from('company')
      .select('id, name');
    
    if (company_id) {
      companiesQuery = companiesQuery.eq('id', company_id);
    }

    const { data: companies, error: companiesError } = await companiesQuery;

    if (companiesError) {
      console.error('Error fetching companies:', companiesError);
      return new Response(
        JSON.stringify({ success: false, error: 'Error fetching companies' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    for (const company of companies || []) {
      // Get retention config for this company
      const { data: retentionConfigs, error: configError } = await supabase
        .from('data_retention_config')
        .select('*')
        .eq('company_id', company.id)
        .eq('is_active', true);

      if (configError) {
        console.error(`Error fetching retention config for ${company.name}:`, configError);
        continue;
      }

      // If no config, seed defaults
      if (!retentionConfigs || retentionConfigs.length === 0) {
        console.log(`Seeding default retention config for ${company.name}`);
        await supabase.rpc('seed_default_retention_config', { p_company_id: company.id });
        
        // Re-fetch
        const { data: newConfigs } = await supabase
          .from('data_retention_config')
          .select('*')
          .eq('company_id', company.id)
          .eq('is_active', true);
        
        if (!newConfigs || newConfigs.length === 0) continue;
        retentionConfigs.push(...newConfigs);
      }

      for (const config of retentionConfigs) {
        const purgeConfig = PURGE_CONFIGS[config.data_category];
        if (!purgeConfig) {
          console.log(`No purge config for category: ${config.data_category}`);
          continue;
        }

        // Calculate cutoff date
        const cutoffDate = new Date();
        cutoffDate.setFullYear(cutoffDate.getFullYear() - config.retention_years);
        const cutoffDateStr = cutoffDate.toISOString().split('T')[0];

        console.log(`Processing ${config.data_category} for ${company.name}: cutoff ${cutoffDateStr}`);

        // Count records to purge
        const { count, error: countError } = await supabase
          .from(purgeConfig.table)
          .select('*', { count: 'exact', head: true })
          .eq(purgeConfig.companyColumn, company.id)
          .lt(purgeConfig.dateColumn, cutoffDateStr);

        if (countError) {
          console.error(`Error counting ${config.data_category}:`, countError);
          continue;
        }

        if (!count || count === 0) {
          console.log(`No records to purge for ${config.data_category} in ${company.name}`);
          continue;
        }

        // Get date range of records to purge
        const { data: dateRange } = await supabase
          .from(purgeConfig.table)
          .select(purgeConfig.dateColumn)
          .eq(purgeConfig.companyColumn, company.id)
          .lt(purgeConfig.dateColumn, cutoffDateStr)
          .order(purgeConfig.dateColumn, { ascending: true })
          .limit(1);

        const { data: newestRange } = await supabase
          .from(purgeConfig.table)
          .select(purgeConfig.dateColumn)
          .eq(purgeConfig.companyColumn, company.id)
          .lt(purgeConfig.dateColumn, cutoffDateStr)
          .order(purgeConfig.dateColumn, { ascending: false })
          .limit(1);

        const oldestDate = dateRange?.[0] ? (dateRange[0] as Record<string, any>)[purgeConfig.dateColumn] : null;
        const newestDate = newestRange?.[0] ? (newestRange[0] as Record<string, any>)[purgeConfig.dateColumn] : null;

        // Generate content hash before purge (for evidence)
        const hashData = `${company.id}|${config.data_category}|${count}|${oldestDate}|${newestDate}|${cutoffDateStr}`;
        const contentHash = await computeHash(hashData);

        let purgedCount = 0;

        if (!dry_run) {
          // Actually delete the records
          const { error: deleteError } = await supabase
            .from(purgeConfig.table)
            .delete()
            .eq(purgeConfig.companyColumn, company.id)
            .lt(purgeConfig.dateColumn, cutoffDateStr);

          if (deleteError) {
            console.error(`Error deleting ${config.data_category}:`, deleteError);
            continue;
          }

          purgedCount = count;

          // Log the purge
          const { error: logError } = await supabase
            .from('data_purge_log')
            .insert({
              company_id: company.id,
              data_category: config.data_category,
              records_purged: purgedCount,
              oldest_record_date: oldestDate?.split('T')[0] || null,
              newest_record_date: newestDate?.split('T')[0] || null,
              purge_cutoff_date: cutoffDateStr,
              content_hash_before: contentHash,
              purged_by: 'system_scheduled',
            });

          if (logError) {
            console.error('Error logging purge:', logError);
          }

          console.log(`Purged ${purgedCount} records from ${config.data_category} for ${company.name}`);
        }

        results.push({
          company_id: company.id,
          company_name: company.name,
          category: config.data_category,
          records_found: count,
          records_purged: dry_run ? 0 : purgedCount,
          oldest_date: oldestDate,
          newest_date: newestDate,
          cutoff_date: cutoffDateStr,
        });
      }
    }

    const totalPurged = results.reduce((sum, r) => sum + r.records_purged, 0);
    const totalFound = results.reduce((sum, r) => sum + r.records_found, 0);

    console.log(`Data retention purge completed. Total found: ${totalFound}, Total purged: ${totalPurged}`);

    return new Response(
      JSON.stringify({
        success: true,
        dry_run,
        summary: {
          total_records_found: totalFound,
          total_records_purged: totalPurged,
          companies_processed: companies?.length || 0,
        },
        results,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Data retention purge error:', error);
    return new Response(
      JSON.stringify({ success: false, error: 'Error interno del servidor' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
