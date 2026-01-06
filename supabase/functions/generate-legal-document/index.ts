import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface GenerateRequest {
  template_code: string;
  company_id: string;
  extra_variables?: Record<string, string>;
}

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
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    const body: GenerateRequest = await req.json();
    const { template_code, company_id, extra_variables = {} } = body;

    console.log(`Generating document ${template_code} for company ${company_id}`);

    // Get template
    const { data: template, error: templateError } = await supabase
      .from('legal_document_templates')
      .select('*')
      .eq('code', template_code)
      .eq('is_active', true)
      .single();

    if (templateError || !template) {
      throw new Error(`Template ${template_code} not found`);
    }

    // Get company info
    const { data: company, error: companyError } = await supabase
      .from('company')
      .select('*')
      .eq('id', company_id)
      .single();

    if (companyError || !company) {
      throw new Error('Company not found');
    }

    // Get company settings
    const { data: settings } = await supabase
      .from('company_settings')
      .select('setting_key, setting_value')
      .eq('company_id', company_id);

    const settingsMap: Record<string, any> = {};
    (settings || []).forEach((s: any) => {
      settingsMap[s.setting_key] = s.setting_value;
    });

    // Build variables map
    const variables: Record<string, string> = {
      // Company fields
      EMPRESA_NOMBRE: company.name || '',
      EMPRESA_CIF: company.cif || '',
      EMPRESA_DIRECCION: company.address || '',
      EMPRESA_CIUDAD: company.city || '',
      EMPRESA_CP: company.postal_code || '',
      
      // Date fields
      FECHA_GENERACION: new Date().toLocaleDateString('es-ES'),
      FECHA_ACTUAL: new Date().toISOString().split('T')[0],
      
      // System fields
      PROVEEDOR_PLATAFORMA: 'Time Control Hub',
      QTSP_NOMBRE: 'EADTrust',
      
      // Settings fields
      CONTACTO_PRIVACIDAD: settingsMap.privacy_contact || 'Departamento de RRHH',
      EMAIL_CONTACTO_DPD: settingsMap.dpd_email || 'privacidad@empresa.com',
      RESPONSABLE_CUMPLIMIENTO: settingsMap.compliance_officer || 'Responsable de Cumplimiento',
      CANAL_CORRECCIONES: settingsMap.corrections_channel || 'Portal del empleado',
      PLAZO_CORRECCIONES_HORAS: settingsMap.correction_hours || '48',
      RESPONSABLE_CUSTODIA: settingsMap.custody_responsible || 'Responsable de RRHH',
      LUGAR_ARCHIVO_PARTES: settingsMap.paper_archive_location || 'Oficina central',
      PLAZO_TRANSCRIPCION_HORAS: settingsMap.transcription_hours || '24',
      
      // Extra variables from request
      ...extra_variables
    };

    // Substitute variables in content
    let content = template.content_markdown;
    for (const [key, value] of Object.entries(variables)) {
      const regex = new RegExp(`\\{\\{${key}\\}\\}`, 'g');
      content = content.replace(regex, value);
    }

    // Calculate content hash
    const contentHash = await computeHash(content);

    // Check if document already exists for this company
    const { data: existingDoc } = await supabase
      .from('legal_documents')
      .select('id, version')
      .eq('company_id', company_id)
      .eq('template_id', template.id)
      .order('version', { ascending: false })
      .limit(1)
      .maybeSingle();

    const newVersion = existingDoc ? existingDoc.version + 1 : 1;

    // Create or update document
    const { data: document, error: docError } = await supabase
      .from('legal_documents')
      .insert({
        template_id: template.id,
        company_id,
        code: template.code,
        name: template.name,
        content_markdown: content,
        variable_values: variables,
        version: newVersion,
        is_published: false
      })
      .select()
      .single();

    if (docError) throw docError;

    console.log(`Document created: ${document.id}`);

    return new Response(JSON.stringify({
      success: true,
      document_id: document.id,
      code: template.code,
      name: template.name,
      version: newVersion,
      content_hash: contentHash,
      content_markdown: content,
      requires_acceptance: template.requires_employee_acceptance
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error: any) {
    console.error('Error generating document:', error);
    return new Response(JSON.stringify({
      success: false,
      error: error?.message || 'Unknown error'
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
