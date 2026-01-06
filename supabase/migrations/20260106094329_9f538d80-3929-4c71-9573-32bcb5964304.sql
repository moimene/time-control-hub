-- Create table for certificate download audit history
CREATE TABLE public.certificate_downloads (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id uuid NOT NULL REFERENCES public.company(id) ON DELETE CASCADE,
  evidence_id uuid REFERENCES public.dt_evidences(id) ON DELETE SET NULL,
  notification_id uuid REFERENCES public.compliance_notifications(id) ON DELETE SET NULL,
  downloaded_by uuid NOT NULL,
  downloaded_at timestamp with time zone NOT NULL DEFAULT now(),
  download_type text NOT NULL, -- 'report', 'notification', 'overtime', 'breaks', 'night_work'
  document_title text NOT NULL,
  ip_address inet,
  user_agent text,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Create index for efficient queries
CREATE INDEX idx_certificate_downloads_company ON public.certificate_downloads(company_id);
CREATE INDEX idx_certificate_downloads_evidence ON public.certificate_downloads(evidence_id);
CREATE INDEX idx_certificate_downloads_downloaded_at ON public.certificate_downloads(downloaded_at DESC);

-- Enable RLS
ALTER TABLE public.certificate_downloads ENABLE ROW LEVEL SECURITY;

-- RLS policies for certificate_downloads
CREATE POLICY "Admins can view company certificate downloads"
  ON public.certificate_downloads
  FOR SELECT
  USING (is_admin_or_above(auth.uid()) AND user_belongs_to_company(company_id, auth.uid()));

CREATE POLICY "Admins can insert certificate downloads"
  ON public.certificate_downloads
  FOR INSERT
  WITH CHECK (is_admin_or_above(auth.uid()) AND user_belongs_to_company(company_id, auth.uid()));

CREATE POLICY "Super admins can view all certificate downloads"
  ON public.certificate_downloads
  FOR SELECT
  USING (is_super_admin(auth.uid()));

-- Add new evidence types to support additional reports
-- Update evidence_type enum to include new types
ALTER TYPE public.evidence_type ADD VALUE IF NOT EXISTS 'overtime_report';
ALTER TYPE public.evidence_type ADD VALUE IF NOT EXISTS 'breaks_report';
ALTER TYPE public.evidence_type ADD VALUE IF NOT EXISTS 'night_work_report';
ALTER TYPE public.evidence_type ADD VALUE IF NOT EXISTS 'notification_certificate';