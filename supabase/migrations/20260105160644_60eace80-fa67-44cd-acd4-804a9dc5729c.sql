-- Add company_id columns to all tenant-scoped tables
ALTER TABLE public.employees ADD COLUMN IF NOT EXISTS company_id uuid REFERENCES public.company(id) ON DELETE CASCADE;
ALTER TABLE public.terminals ADD COLUMN IF NOT EXISTS company_id uuid REFERENCES public.company(id) ON DELETE CASCADE;
ALTER TABLE public.time_events ADD COLUMN IF NOT EXISTS company_id uuid REFERENCES public.company(id) ON DELETE CASCADE;
ALTER TABLE public.correction_requests ADD COLUMN IF NOT EXISTS company_id uuid REFERENCES public.company(id) ON DELETE CASCADE;
ALTER TABLE public.corrected_events ADD COLUMN IF NOT EXISTS company_id uuid REFERENCES public.company(id) ON DELETE CASCADE;
ALTER TABLE public.employee_qr ADD COLUMN IF NOT EXISTS company_id uuid REFERENCES public.company(id) ON DELETE CASCADE;
ALTER TABLE public.daily_roots ADD COLUMN IF NOT EXISTS company_id uuid REFERENCES public.company(id) ON DELETE CASCADE;
ALTER TABLE public.audit_log ADD COLUMN IF NOT EXISTS company_id uuid REFERENCES public.company(id) ON DELETE SET NULL;

-- Indexes
CREATE INDEX IF NOT EXISTS idx_employees_company_id ON public.employees(company_id);
CREATE INDEX IF NOT EXISTS idx_terminals_company_id ON public.terminals(company_id);
CREATE INDEX IF NOT EXISTS idx_time_events_company_id ON public.time_events(company_id);
CREATE INDEX IF NOT EXISTS idx_correction_requests_company_id ON public.correction_requests(company_id);
CREATE INDEX IF NOT EXISTS idx_corrected_events_company_id ON public.corrected_events(company_id);
CREATE INDEX IF NOT EXISTS idx_employee_qr_company_id ON public.employee_qr(company_id);
CREATE INDEX IF NOT EXISTS idx_daily_roots_company_id ON public.daily_roots(company_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_company_id ON public.audit_log(company_id);