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

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get authorization header to identify user
    const authHeader = req.headers.get('authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ success: false, error: 'No autorizado' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Verify the JWT and get user
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    
    if (authError || !user) {
      return new Response(
        JSON.stringify({ success: false, error: 'Token no válido' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const body = await req.json();
    const { document_id } = body;

    if (!document_id) {
      return new Response(
        JSON.stringify({ success: false, error: 'Falta el ID del documento' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get employee ID from user
    const { data: employee, error: empError } = await supabase
      .from('employees')
      .select('id, company_id, first_name, last_name, employee_code')
      .eq('user_id', user.id)
      .single();

    if (empError || !employee) {
      console.error('Employee not found:', empError);
      return new Response(
        JSON.stringify({ success: false, error: 'Empleado no encontrado' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get the document
    const { data: document, error: docError } = await supabase
      .from('legal_documents')
      .select('id, company_id, code, name, content_markdown, is_published')
      .eq('id', document_id)
      .single();

    if (docError || !document) {
      console.error('Document not found:', docError);
      return new Response(
        JSON.stringify({ success: false, error: 'Documento no encontrado' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Verify document belongs to employee's company
    if (document.company_id !== employee.company_id) {
      return new Response(
        JSON.stringify({ success: false, error: 'Documento no pertenece a tu empresa' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check document is published
    if (!document.is_published) {
      return new Response(
        JSON.stringify({ success: false, error: 'El documento no está publicado' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check if already acknowledged
    const { data: existingAck } = await supabase
      .from('document_acknowledgments')
      .select('id')
      .eq('document_id', document_id)
      .eq('employee_id', employee.id)
      .maybeSingle();

    if (existingAck) {
      return new Response(
        JSON.stringify({ success: false, error: 'Ya has aceptado este documento' }),
        { status: 409, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Generate hashes for integrity
    const timestamp = new Date().toISOString();
    const contentHash = await computeHash(document.content_markdown);
    const signatureData = `${employee.id}|${document_id}|${contentHash}|${timestamp}`;
    const signatureHash = await computeHash(signatureData);

    // Get IP and User Agent
    const ipAddress = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 
                      req.headers.get('x-real-ip') || 
                      '0.0.0.0';
    const userAgent = req.headers.get('user-agent') || '';

    // Create acknowledgment record
    const { data: acknowledgment, error: ackError } = await supabase
      .from('document_acknowledgments')
      .insert({
        company_id: employee.company_id,
        document_id: document_id,
        employee_id: employee.id,
        content_hash: contentHash,
        signature_hash: signatureHash,
        acknowledged_at: timestamp,
        ip_address: ipAddress,
        user_agent: userAgent,
      })
      .select()
      .single();

    if (ackError) {
      console.error('Error creating acknowledgment:', ackError);
      return new Response(
        JSON.stringify({ success: false, error: 'Error al registrar la aceptación' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Document ${document.code} acknowledged by employee ${employee.employee_code}`);

    // Try to seal with QTSP (non-blocking)
    try {
      const qtspResponse = await supabase.functions.invoke('qtsp-notarize', {
        body: {
          action: 'notarize_acknowledgment',
          acknowledgment_id: acknowledgment.id,
          content_hash: contentHash,
          signature_hash: signatureHash,
          employee_id: employee.id,
          document_code: document.code,
          timestamp,
        }
      });

      if (qtspResponse.data?.success && qtspResponse.data?.evidence_id) {
        // Update acknowledgment with QTSP evidence
        await supabase
          .from('document_acknowledgments')
          .update({
            qtsp_evidence_id: qtspResponse.data.evidence_id,
            tsp_token: qtspResponse.data.tsp_token,
            tsp_timestamp: qtspResponse.data.tsp_timestamp,
          })
          .eq('id', acknowledgment.id);

        console.log(`QTSP seal applied to acknowledgment ${acknowledgment.id}`);
      }
    } catch (qtspError) {
      // Log but don't fail the acknowledgment
      console.error('QTSP sealing failed (non-blocking):', qtspError);
    }

    // Create audit log entry
    await supabase.from('audit_log').insert({
      actor_type: 'employee',
      actor_id: employee.id,
      action: 'acknowledge_document',
      entity_type: 'legal_document',
      entity_id: document_id,
      company_id: employee.company_id,
      new_values: {
        acknowledgment_id: acknowledgment.id,
        document_code: document.code,
        content_hash: contentHash,
        signature_hash: signatureHash,
      },
    });

    return new Response(
      JSON.stringify({
        success: true,
        acknowledgment: {
          id: acknowledgment.id,
          document_id: document_id,
          document_code: document.code,
          document_name: document.name,
          acknowledged_at: timestamp,
          content_hash: contentHash,
          signature_hash: signatureHash,
        },
        message: 'Documento aceptado correctamente',
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Acknowledge document error:', error);
    return new Response(
      JSON.stringify({ success: false, error: 'Error interno del servidor' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
