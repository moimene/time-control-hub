import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
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

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const caller = await requireCallerContext({
      req,
      supabaseAdmin: supabase,
      corsHeaders,
      allowServiceRole: true,
    });
    if (caller instanceof Response) return caller;

    const { thread_id, format = 'json' } = await req.json();

    if (!thread_id) {
      return jsonResponse({ error: 'thread_id is required' }, 400, corsHeaders);
    }

    console.log(`Exporting evidence for thread ${thread_id}, format: ${format}`);

    // Fetch thread details
    const { data: thread, error: threadError } = await supabase
      .from('message_threads')
      .select('*')
      .eq('id', thread_id)
      .single();

    if (threadError || !thread) {
      return new Response(
        JSON.stringify({ error: 'Thread not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (caller.kind === 'user') {
      const roleError = requireAnyRole({
        ctx: caller,
        allowed: ['super_admin', 'admin', 'responsible', 'asesor'],
        corsHeaders,
      });
      if (roleError) return roleError;

      const companyAccess = await requireCompanyAccess({
        supabaseAdmin: supabase,
        ctx: caller,
        companyId: thread.company_id,
        corsHeaders,
        allowEmployee: true,
      });
      if (companyAccess instanceof Response) return companyAccess;
    }

    // Fetch content
    const { data: content } = await supabase
      .from('message_contents')
      .select('*')
      .eq('thread_id', thread_id)
      .order('version', { ascending: false })
      .limit(1)
      .maybeSingle();

    // Fetch recipients with employee info
    const { data: recipients } = await supabase
      .from('message_recipients')
      .select(`
        *,
        employees!inner(first_name, last_name, employee_code, department)
      `)
      .eq('thread_id', thread_id);

    // Fetch all evidence events
    const { data: evidenceEvents } = await supabase
      .from('message_evidence')
      .select('*')
      .eq('thread_id', thread_id)
      .order('event_timestamp', { ascending: true });

    // Build export package
    const exportPackage = {
      metadata: {
        export_timestamp: new Date().toISOString(),
        export_version: '1.0',
        thread_id: thread_id,
        certification_level: thread.certification_level,
      },
      thread: {
        id: thread.id,
        subject: thread.subject,
        thread_type: thread.thread_type,
        priority: thread.priority,
        status: thread.status,
        created_at: thread.created_at,
        sent_at: thread.sent_at,
        requires_read_confirmation: thread.requires_read_confirmation,
        requires_response: thread.requires_response,
        requires_signature: thread.requires_signature,
        response_deadline: thread.response_deadline,
        audience_type: thread.audience_type,
        recipient_count: thread.recipient_count,
      },
      content: content ? {
        body_text: content.body_text,
        content_hash: content.content_hash,
        version: content.version,
        created_at: content.created_at,
      } : null,
      recipients: (recipients || []).map(r => ({
        employee: {
          code: r.employees.employee_code,
          name: `${r.employees.first_name} ${r.employees.last_name}`,
          department: r.employees.department,
        },
        delivery_status: r.delivery_status,
        delivered_at: r.delivered_at,
        notified_kiosk_at: r.notified_kiosk_at,
        reminder_count: r.reminder_count,
        last_reminder_at: r.last_reminder_at,
        response_text: r.response_text,
        signature_hash: r.signature_hash,
      })),
      evidence_chain: (evidenceEvents || []).map(e => ({
        event_type: e.event_type,
        event_timestamp: e.event_timestamp,
        event_data: e.event_data,
        content_hash: e.content_hash,
        previous_hash: e.previous_hash,
        qtsp_timestamp: e.qtsp_timestamp,
        qtsp_token: e.qtsp_token,
      })),
      integrity: {
        total_events: evidenceEvents?.length || 0,
        chain_valid: validateEvidenceChain(evidenceEvents || []),
        has_qtsp_seal: evidenceEvents?.some(e => e.qtsp_timestamp) || false,
      }
    };

    if (format === 'pdf') {
      // Generate PDF certificate
      const pdfContent = generatePDFCertificate(exportPackage);
      
      return new Response(new Uint8Array(pdfContent), {
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/pdf',
          'Content-Disposition': `attachment; filename="certificado-${thread_id.slice(0, 8)}.pdf"`,
        },
      });
    }

    // Return JSON by default
    return new Response(
      JSON.stringify(exportPackage, null, 2),
      { 
        headers: { 
          ...corsHeaders, 
          'Content-Type': 'application/json',
          'Content-Disposition': `attachment; filename="evidencia-${thread_id.slice(0, 8)}.json"`,
        } 
      }
    );

  } catch (error) {
    console.error('Error exporting evidence:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

function validateEvidenceChain(events: any[]): boolean {
  if (events.length === 0) return true;
  
  for (let i = 1; i < events.length; i++) {
    if (events[i].previous_hash !== events[i - 1].content_hash) {
      return false;
    }
  }
  return true;
}

function generatePDFCertificate(data: any): number[] {
  // Simple PDF generation - creates a basic PDF structure
  const now = new Date().toISOString();
  const content = `
CERTIFICADO DE COMUNICACIÓN INTERNA
=====================================

Fecha de emisión: ${now}
ID de comunicación: ${data.thread.id}
Nivel de certificación: ${data.metadata.certification_level || 'Básico'}

DATOS DE LA COMUNICACIÓN
------------------------
Asunto: ${data.thread.subject}
Tipo: ${data.thread.thread_type}
Prioridad: ${data.thread.priority}
Fecha de envío: ${data.thread.sent_at || 'No enviado'}
Estado: ${data.thread.status}

REQUISITOS
----------
Confirmación de lectura: ${data.thread.requires_read_confirmation ? 'Sí' : 'No'}
Requiere respuesta: ${data.thread.requires_response ? 'Sí' : 'No'}
Requiere firma: ${data.thread.requires_signature ? 'Sí' : 'No'}
Fecha límite: ${data.thread.response_deadline || 'Sin límite'}

DESTINATARIOS (${data.recipients.length})
-----------------------------------------
${data.recipients.map((r: any) => 
  `- ${r.employee.name} (${r.employee.code})
   Departamento: ${r.employee.department || 'N/A'}
   Estado: ${r.delivery_status}
   Entregado: ${r.delivered_at || 'Pendiente'}`
).join('\n')}

CADENA DE EVIDENCIAS (${data.evidence_chain.length} eventos)
------------------------------------------------------------
${data.evidence_chain.map((e: any, i: number) => 
  `${i + 1}. ${e.event_type} - ${e.event_timestamp}
   Hash: ${e.content_hash?.slice(0, 16)}...
   ${e.qtsp_timestamp ? `QTSP: ${e.qtsp_timestamp}` : ''}`
).join('\n')}

INTEGRIDAD
----------
Eventos totales: ${data.integrity.total_events}
Cadena válida: ${data.integrity.chain_valid ? 'SÍ' : 'NO'}
Sello QTSP: ${data.integrity.has_qtsp_seal ? 'SÍ' : 'NO'}

---
Este documento ha sido generado automáticamente.
Hash del contenido: ${data.content?.content_hash || 'N/A'}
`;

  // Create a simple text-based PDF
  const pdfHeader = '%PDF-1.4\n';
  const objects: string[] = [];
  
  // Catalog
  objects.push('1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n');
  
  // Pages
  objects.push('2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n');
  
  // Page
  objects.push('3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>\nendobj\n');
  
  // Content stream
  const textLines = content.split('\n');
  let streamContent = 'BT\n/F1 10 Tf\n50 750 Td\n12 TL\n';
  for (const line of textLines.slice(0, 60)) {
    const escapedLine = line.replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)');
    streamContent += `(${escapedLine}) Tj T*\n`;
  }
  streamContent += 'ET';
  
  objects.push(`4 0 obj\n<< /Length ${streamContent.length} >>\nstream\n${streamContent}\nendstream\nendobj\n`);
  
  // Font
  objects.push('5 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Courier >>\nendobj\n');
  
  const body = objects.join('');
  const xrefOffset = pdfHeader.length + body.length;
  
  const xref = `xref\n0 6\n0000000000 65535 f \n${String(pdfHeader.length).padStart(10, '0')} 00000 n \n${String(pdfHeader.length + objects[0].length).padStart(10, '0')} 00000 n \n${String(pdfHeader.length + objects[0].length + objects[1].length).padStart(10, '0')} 00000 n \n${String(pdfHeader.length + objects[0].length + objects[1].length + objects[2].length).padStart(10, '0')} 00000 n \n${String(pdfHeader.length + objects[0].length + objects[1].length + objects[2].length + objects[3].length).padStart(10, '0')} 00000 n \n`;
  
  const trailer = `trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`;
  
  const pdfString = pdfHeader + body + xref + trailer;
  
  return Array.from(new TextEncoder().encode(pdfString));
}
