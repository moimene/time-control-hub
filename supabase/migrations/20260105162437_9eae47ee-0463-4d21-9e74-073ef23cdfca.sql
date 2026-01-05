-- Create QTSP audit log table for tracking all QTSP operations
CREATE TABLE public.qtsp_audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid REFERENCES public.company(id) ON DELETE CASCADE,
  action text NOT NULL, -- 'timestamp', 'seal_pdf', 'retry', 'check_status', 'export_package'
  evidence_id uuid REFERENCES public.dt_evidences(id) ON DELETE SET NULL,
  request_payload jsonb,
  response_payload jsonb,
  status text NOT NULL, -- 'success', 'failed', 'pending'
  error_message text,
  duration_ms integer,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.qtsp_audit_log ENABLE ROW LEVEL SECURITY;

-- RLS policies for qtsp_audit_log
CREATE POLICY "mt_qtsp_al_company_admin" ON public.qtsp_audit_log
  FOR SELECT USING (
    user_belongs_to_company(auth.uid(), company_id) AND is_admin_or_above(auth.uid())
  );

CREATE POLICY "mt_qtsp_al_super_admin" ON public.qtsp_audit_log
  FOR SELECT USING (is_super_admin(auth.uid()));

-- Update RLS for dt_case_files to be company-scoped
DROP POLICY IF EXISTS "Admins can view case files" ON public.dt_case_files;
CREATE POLICY "mt_cf_company_admin" ON public.dt_case_files
  FOR SELECT USING (
    user_belongs_to_company(auth.uid(), company_id) AND is_admin_or_above(auth.uid())
  );
CREATE POLICY "mt_cf_super_admin" ON public.dt_case_files
  FOR SELECT USING (is_super_admin(auth.uid()));

-- Update RLS for dt_evidence_groups - need to join through case_files for company
DROP POLICY IF EXISTS "Admins can view evidence groups" ON public.dt_evidence_groups;
CREATE POLICY "mt_eg_admin" ON public.dt_evidence_groups
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.dt_case_files cf 
      WHERE cf.id = case_file_id 
      AND user_belongs_to_company(auth.uid(), cf.company_id) 
      AND is_admin_or_above(auth.uid())
    )
  );
CREATE POLICY "mt_eg_super_admin" ON public.dt_evidence_groups
  FOR SELECT USING (is_super_admin(auth.uid()));

-- Update RLS for dt_evidences - need to join through evidence_groups and case_files
DROP POLICY IF EXISTS "Admins can view evidences" ON public.dt_evidences;
CREATE POLICY "mt_ev_admin" ON public.dt_evidences
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.dt_evidence_groups eg
      JOIN public.dt_case_files cf ON cf.id = eg.case_file_id
      WHERE eg.id = evidence_group_id
      AND user_belongs_to_company(auth.uid(), cf.company_id)
      AND is_admin_or_above(auth.uid())
    )
  );
CREATE POLICY "mt_ev_super_admin" ON public.dt_evidences
  FOR SELECT USING (is_super_admin(auth.uid()));

-- Add index for performance on qtsp_audit_log
CREATE INDEX idx_qtsp_audit_log_company ON public.qtsp_audit_log(company_id);
CREATE INDEX idx_qtsp_audit_log_evidence ON public.qtsp_audit_log(evidence_id);
CREATE INDEX idx_qtsp_audit_log_created ON public.qtsp_audit_log(created_at DESC);