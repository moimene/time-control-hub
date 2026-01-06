-- Table 1: Legal Document Templates (master templates)
CREATE TABLE public.legal_document_templates (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  category TEXT NOT NULL,
  description TEXT,
  content_markdown TEXT NOT NULL,
  variable_fields JSONB NOT NULL DEFAULT '[]'::jsonb,
  requires_employee_acceptance BOOLEAN NOT NULL DEFAULT false,
  priority TEXT NOT NULL DEFAULT 'medium',
  version INTEGER NOT NULL DEFAULT 1,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Table 2: Legal Documents (generated per company with substituted fields)
CREATE TABLE public.legal_documents (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID NOT NULL REFERENCES public.company(id) ON DELETE CASCADE,
  template_id UUID NOT NULL REFERENCES public.legal_document_templates(id),
  code TEXT NOT NULL,
  name TEXT NOT NULL,
  content_markdown TEXT NOT NULL,
  content_html TEXT,
  pdf_path TEXT,
  variable_values JSONB NOT NULL DEFAULT '{}'::jsonb,
  is_published BOOLEAN NOT NULL DEFAULT false,
  published_at TIMESTAMPTZ,
  published_by UUID,
  version INTEGER NOT NULL DEFAULT 1,
  effective_from TIMESTAMPTZ,
  effective_to TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(company_id, code, version)
);

-- Table 3: Document Acknowledgments (employee acceptances with QTSP seal)
CREATE TABLE public.document_acknowledgments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID NOT NULL REFERENCES public.company(id) ON DELETE CASCADE,
  document_id UUID NOT NULL REFERENCES public.legal_documents(id) ON DELETE CASCADE,
  employee_id UUID NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  content_hash TEXT NOT NULL,
  signature_hash TEXT NOT NULL,
  acknowledged_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  ip_address INET,
  user_agent TEXT,
  qtsp_evidence_id UUID REFERENCES public.dt_evidences(id),
  tsp_token TEXT,
  tsp_timestamp TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(document_id, employee_id)
);

-- Table 4: Data Retention Config
CREATE TABLE public.data_retention_config (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID NOT NULL REFERENCES public.company(id) ON DELETE CASCADE,
  data_category TEXT NOT NULL,
  retention_years INTEGER NOT NULL,
  description TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(company_id, data_category)
);

-- Table 5: Data Purge Log (evidence of destruction)
CREATE TABLE public.data_purge_log (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID NOT NULL REFERENCES public.company(id) ON DELETE CASCADE,
  data_category TEXT NOT NULL,
  records_purged INTEGER NOT NULL,
  oldest_record_date DATE,
  newest_record_date DATE,
  purge_cutoff_date DATE NOT NULL,
  content_hash_before TEXT NOT NULL,
  purged_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  purged_by TEXT NOT NULL DEFAULT 'system',
  qtsp_evidence_id UUID REFERENCES public.dt_evidences(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Table 6: Contingency Records (paper-based clock-ins transcribed)
CREATE TABLE public.contingency_records (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID NOT NULL REFERENCES public.company(id) ON DELETE CASCADE,
  employee_id UUID NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  contingency_date DATE NOT NULL,
  entry_time TIME,
  exit_time TIME,
  pause_start TIME,
  pause_end TIME,
  reason TEXT NOT NULL,
  paper_form_reference TEXT,
  employee_signature_confirmed BOOLEAN NOT NULL DEFAULT false,
  supervisor_signature_confirmed BOOLEAN NOT NULL DEFAULT false,
  transcribed_by UUID NOT NULL,
  transcribed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  validated_by UUID,
  validated_at TIMESTAMPTZ,
  time_events_created BOOLEAN NOT NULL DEFAULT false,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS on all tables
ALTER TABLE public.legal_document_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.legal_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.document_acknowledgments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.data_retention_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.data_purge_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contingency_records ENABLE ROW LEVEL SECURITY;

-- RLS Policies for legal_document_templates (read-only for authenticated users)
CREATE POLICY "Templates are viewable by authenticated users"
ON public.legal_document_templates FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Only super admins can manage templates"
ON public.legal_document_templates FOR ALL
TO authenticated
USING (public.is_super_admin(auth.uid()));

-- RLS Policies for legal_documents
CREATE POLICY "Users can view documents from their company"
ON public.legal_documents FOR SELECT
TO authenticated
USING (
  public.is_super_admin(auth.uid()) OR
  public.user_belongs_to_company(auth.uid(), company_id)
);

CREATE POLICY "Admins can manage documents for their company"
ON public.legal_documents FOR ALL
TO authenticated
USING (
  public.is_super_admin(auth.uid()) OR
  (public.is_admin_or_above(auth.uid()) AND public.user_belongs_to_company(auth.uid(), company_id))
);

-- RLS Policies for document_acknowledgments
CREATE POLICY "Users can view acknowledgments from their company"
ON public.document_acknowledgments FOR SELECT
TO authenticated
USING (
  public.is_super_admin(auth.uid()) OR
  public.user_belongs_to_company(auth.uid(), company_id) OR
  employee_id = public.get_employee_id(auth.uid())
);

CREATE POLICY "Employees can create their own acknowledgments"
ON public.document_acknowledgments FOR INSERT
TO authenticated
WITH CHECK (
  employee_id = public.get_employee_id(auth.uid()) AND
  public.user_belongs_to_company(auth.uid(), company_id)
);

-- RLS Policies for data_retention_config
CREATE POLICY "Users can view retention config from their company"
ON public.data_retention_config FOR SELECT
TO authenticated
USING (
  public.is_super_admin(auth.uid()) OR
  public.user_belongs_to_company(auth.uid(), company_id)
);

CREATE POLICY "Admins can manage retention config for their company"
ON public.data_retention_config FOR ALL
TO authenticated
USING (
  public.is_super_admin(auth.uid()) OR
  (public.is_admin_or_above(auth.uid()) AND public.user_belongs_to_company(auth.uid(), company_id))
);

-- RLS Policies for data_purge_log
CREATE POLICY "Users can view purge logs from their company"
ON public.data_purge_log FOR SELECT
TO authenticated
USING (
  public.is_super_admin(auth.uid()) OR
  public.user_belongs_to_company(auth.uid(), company_id)
);

CREATE POLICY "Only system can create purge logs"
ON public.data_purge_log FOR INSERT
TO authenticated
WITH CHECK (public.is_super_admin(auth.uid()));

-- RLS Policies for contingency_records
CREATE POLICY "Users can view contingency records from their company"
ON public.contingency_records FOR SELECT
TO authenticated
USING (
  public.is_super_admin(auth.uid()) OR
  public.user_belongs_to_company(auth.uid(), company_id)
);

CREATE POLICY "Admins can manage contingency records for their company"
ON public.contingency_records FOR ALL
TO authenticated
USING (
  public.is_super_admin(auth.uid()) OR
  (public.is_admin_or_above(auth.uid()) AND public.user_belongs_to_company(auth.uid(), company_id))
);

-- Create indexes for performance
CREATE INDEX idx_legal_documents_company ON public.legal_documents(company_id);
CREATE INDEX idx_legal_documents_template ON public.legal_documents(template_id);
CREATE INDEX idx_document_acknowledgments_company ON public.document_acknowledgments(company_id);
CREATE INDEX idx_document_acknowledgments_employee ON public.document_acknowledgments(employee_id);
CREATE INDEX idx_document_acknowledgments_document ON public.document_acknowledgments(document_id);
CREATE INDEX idx_data_retention_config_company ON public.data_retention_config(company_id);
CREATE INDEX idx_data_purge_log_company ON public.data_purge_log(company_id);
CREATE INDEX idx_contingency_records_company ON public.contingency_records(company_id);
CREATE INDEX idx_contingency_records_employee ON public.contingency_records(employee_id);
CREATE INDEX idx_contingency_records_date ON public.contingency_records(contingency_date);

-- Triggers for updated_at
CREATE TRIGGER update_legal_document_templates_updated_at
BEFORE UPDATE ON public.legal_document_templates
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_legal_documents_updated_at
BEFORE UPDATE ON public.legal_documents
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_data_retention_config_updated_at
BEFORE UPDATE ON public.data_retention_config
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_contingency_records_updated_at
BEFORE UPDATE ON public.contingency_records
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Insert default retention config for new companies (function to be called on company creation)
CREATE OR REPLACE FUNCTION public.seed_default_retention_config(p_company_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF EXISTS (SELECT 1 FROM data_retention_config WHERE company_id = p_company_id LIMIT 1) THEN
    RETURN;
  END IF;

  INSERT INTO data_retention_config (company_id, data_category, retention_years, description) VALUES
  (p_company_id, 'time_events', 4, 'Registros de jornada (art. 34.9 ET)'),
  (p_company_id, 'corrected_events', 4, 'Eventos corregidos'),
  (p_company_id, 'correction_requests', 4, 'Solicitudes de corrección'),
  (p_company_id, 'absence_requests', 4, 'Solicitudes de ausencias'),
  (p_company_id, 'audit_log', 4, 'Logs de auditoría'),
  (p_company_id, 'employee_documents_health', 5, 'Justificantes médicos'),
  (p_company_id, 'dt_evidences', 10, 'Evidencias QTSP'),
  (p_company_id, 'document_acknowledgments', 4, 'Aceptaciones de documentos'),
  (p_company_id, 'contingency_records', 4, 'Registros de contingencia');
END;
$function$;