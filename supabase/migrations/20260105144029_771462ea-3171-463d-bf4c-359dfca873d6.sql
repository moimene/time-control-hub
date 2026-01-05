-- Create enum for evidence type
CREATE TYPE public.evidence_type AS ENUM ('daily_timestamp', 'monthly_report');

-- Create enum for evidence status
CREATE TYPE public.evidence_status AS ENUM ('pending', 'processing', 'completed', 'failed');

-- Table to store Digital Trust Case Files (one per company, created once)
CREATE TABLE public.dt_case_files (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  external_id TEXT NOT NULL UNIQUE,
  company_id UUID REFERENCES public.company(id),
  name TEXT NOT NULL,
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Table to store Digital Trust Evidence Groups (one per month for organization)
CREATE TABLE public.dt_evidence_groups (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  external_id TEXT NOT NULL UNIQUE,
  case_file_id UUID NOT NULL REFERENCES public.dt_case_files(id),
  name TEXT NOT NULL,
  year_month TEXT NOT NULL, -- Format: YYYY-MM
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(case_file_id, year_month)
);

-- Table to store individual evidences (timestamps and sealed PDFs)
CREATE TABLE public.dt_evidences (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  evidence_group_id UUID NOT NULL REFERENCES public.dt_evidence_groups(id),
  external_id TEXT UNIQUE,
  evidence_type public.evidence_type NOT NULL,
  status public.evidence_status NOT NULL DEFAULT 'pending',
  -- For daily timestamps
  daily_root_id UUID REFERENCES public.daily_roots(id),
  -- For monthly PDF reports
  report_month TEXT, -- Format: YYYY-MM
  original_pdf_path TEXT,
  sealed_pdf_path TEXT,
  -- TSP/Signature data
  tsp_token TEXT,
  tsp_timestamp TIMESTAMP WITH TIME ZONE,
  signature_data JSONB,
  -- Error tracking
  error_message TEXT,
  retry_count INTEGER NOT NULL DEFAULT 0,
  -- Metadata
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  completed_at TIMESTAMP WITH TIME ZONE
);

-- Enable RLS
ALTER TABLE public.dt_case_files ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dt_evidence_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dt_evidences ENABLE ROW LEVEL SECURITY;

-- RLS policies - only admins can view
CREATE POLICY "Admins can view case files" ON public.dt_case_files
  FOR SELECT USING (is_admin_or_above(auth.uid()));

CREATE POLICY "Admins can view evidence groups" ON public.dt_evidence_groups
  FOR SELECT USING (is_admin_or_above(auth.uid()));

CREATE POLICY "Admins can view evidences" ON public.dt_evidences
  FOR SELECT USING (is_admin_or_above(auth.uid()));

-- Triggers for updated_at
CREATE TRIGGER update_dt_case_files_updated_at
  BEFORE UPDATE ON public.dt_case_files
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_dt_evidence_groups_updated_at
  BEFORE UPDATE ON public.dt_evidence_groups
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_dt_evidences_updated_at
  BEFORE UPDATE ON public.dt_evidences
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Create storage bucket for sealed PDFs
INSERT INTO storage.buckets (id, name, public) VALUES ('sealed-reports', 'sealed-reports', false);

-- Storage policies for sealed reports
CREATE POLICY "Admins can view sealed reports" ON storage.objects
  FOR SELECT USING (bucket_id = 'sealed-reports' AND is_admin_or_above(auth.uid()));

CREATE POLICY "Service role can manage sealed reports" ON storage.objects
  FOR ALL USING (bucket_id = 'sealed-reports' AND auth.role() = 'service_role');