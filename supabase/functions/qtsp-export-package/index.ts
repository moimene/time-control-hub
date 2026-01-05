import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface ExportManifest {
  version: string;
  generated_at: string;
  company: {
    id: string;
    name: string;
    cif: string | null;
  };
  period: {
    start: string;
    end: string;
  };
  case_file: {
    id: string;
    external_id: string;
    name: string;
  } | null;
  evidence_groups: Array<{
    id: string;
    external_id: string;
    year_month: string;
    name: string;
  }>;
  evidences: Array<{
    id: string;
    external_id: string | null;
    type: string;
    status: string;
    date?: string;
    root_hash?: string;
    event_count?: number;
    tsp_token?: string;
    tsp_timestamp?: string;
    report_month?: string;
    sealed_pdf_path?: string;
  }>;
  daily_roots: Array<{
    id: string;
    date: string;
    root_hash: string;
    event_count: number;
    created_at: string;
  }>;
  integrity: {
    algorithm: string;
    hash: string;
  };
}

// Simple SHA-256 hash function
async function computeHash(data: string): Promise<string> {
  const encoder = new TextEncoder();
  const dataBuffer = encoder.encode(data);
  const hashBuffer = await crypto.subtle.digest('SHA-256', dataBuffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { company_id, start_date, end_date, include_pdfs = false } = await req.json();

    if (!company_id || !start_date || !end_date) {
      throw new Error('Missing required parameters: company_id, start_date, end_date');
    }

    console.log(`Generating export package for company ${company_id} from ${start_date} to ${end_date}`);

    // Get company info
    const { data: company, error: companyError } = await supabase
      .from('company')
      .select('id, name, cif')
      .eq('id', company_id)
      .single();

    if (companyError || !company) {
      throw new Error(`Company not found: ${company_id}`);
    }

    // Get case file for this company
    const { data: caseFile } = await supabase
      .from('dt_case_files')
      .select('id, external_id, name')
      .eq('company_id', company_id)
      .maybeSingle();

    // Get daily roots for the period
    const { data: dailyRoots, error: rootsError } = await supabase
      .from('daily_roots')
      .select('id, date, root_hash, event_count, created_at')
      .eq('company_id', company_id)
      .gte('date', start_date)
      .lte('date', end_date)
      .order('date', { ascending: true });

    if (rootsError) throw rootsError;

    // Get evidence groups for the period
    const startMonth = start_date.substring(0, 7);
    const endMonth = end_date.substring(0, 7);
    
    let evidenceGroups: any[] = [];
    let evidences: any[] = [];

    if (caseFile) {
      const { data: groups, error: groupsError } = await supabase
        .from('dt_evidence_groups')
        .select('id, external_id, year_month, name')
        .eq('case_file_id', caseFile.id)
        .gte('year_month', startMonth)
        .lte('year_month', endMonth)
        .order('year_month', { ascending: true });

      if (groupsError) throw groupsError;
      evidenceGroups = groups || [];

      // Get evidences for these groups
      if (evidenceGroups.length > 0) {
        const groupIds = evidenceGroups.map(g => g.id);
        const { data: evs, error: evsError } = await supabase
          .from('dt_evidences')
          .select(`
            id, external_id, evidence_type, status, 
            tsp_token, tsp_timestamp, 
            report_month, sealed_pdf_path,
            daily_root_id,
            daily_roots(date, root_hash, event_count)
          `)
          .in('evidence_group_id', groupIds)
          .order('created_at', { ascending: true });

        if (evsError) throw evsError;
        evidences = evs || [];
      }
    }

    // Build manifest
    const manifest: ExportManifest = {
      version: '1.0',
      generated_at: new Date().toISOString(),
      company: {
        id: company.id,
        name: company.name,
        cif: company.cif,
      },
      period: {
        start: start_date,
        end: end_date,
      },
      case_file: caseFile ? {
        id: caseFile.id,
        external_id: caseFile.external_id,
        name: caseFile.name,
      } : null,
      evidence_groups: evidenceGroups.map(g => ({
        id: g.id,
        external_id: g.external_id,
        year_month: g.year_month,
        name: g.name,
      })),
      evidences: evidences.map(e => ({
        id: e.id,
        external_id: e.external_id,
        type: e.evidence_type,
        status: e.status,
        date: e.daily_roots?.date,
        root_hash: e.daily_roots?.root_hash,
        event_count: e.daily_roots?.event_count,
        tsp_token: e.tsp_token,
        tsp_timestamp: e.tsp_timestamp,
        report_month: e.report_month,
        sealed_pdf_path: e.sealed_pdf_path,
      })),
      daily_roots: (dailyRoots || []).map(r => ({
        id: r.id,
        date: r.date,
        root_hash: r.root_hash,
        event_count: r.event_count,
        created_at: r.created_at,
      })),
      integrity: {
        algorithm: 'SHA-256',
        hash: '', // Will be computed below
      },
    };

    // Compute integrity hash (hash of all daily root hashes concatenated)
    const allHashes = (dailyRoots || []).map(r => r.root_hash).join('');
    manifest.integrity.hash = await computeHash(allHashes + manifest.generated_at);

    // If include_pdfs is true, we'd need to fetch and include sealed PDFs
    // For now, we just include the paths in the manifest
    const pdfPaths: string[] = [];
    if (include_pdfs) {
      for (const evidence of evidences) {
        if (evidence.sealed_pdf_path) {
          pdfPaths.push(evidence.sealed_pdf_path);
        }
      }
    }

    // Calculate summary stats
    const stats = {
      total_days: dailyRoots?.length || 0,
      total_events: dailyRoots?.reduce((sum, r) => sum + r.event_count, 0) || 0,
      daily_timestamps: {
        total: evidences.filter(e => e.evidence_type === 'daily_timestamp').length,
        completed: evidences.filter(e => e.evidence_type === 'daily_timestamp' && e.status === 'completed').length,
      },
      monthly_reports: {
        total: evidences.filter(e => e.evidence_type === 'monthly_report').length,
        completed: evidences.filter(e => e.evidence_type === 'monthly_report' && e.status === 'completed').length,
      },
      pdf_paths: pdfPaths,
    };

    console.log(`Export package generated: ${stats.total_days} days, ${stats.total_events} events`);

    return new Response(
      JSON.stringify({
        success: true,
        manifest,
        stats,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('Export package error:', error);
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
