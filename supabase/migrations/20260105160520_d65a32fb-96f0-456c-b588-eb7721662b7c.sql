-- Create user_company table first
CREATE TABLE public.user_company (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  company_id uuid NOT NULL REFERENCES public.company(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, company_id)
);

ALTER TABLE public.user_company ENABLE ROW LEVEL SECURITY;

-- Indexes
CREATE INDEX idx_user_company_user_id ON public.user_company(user_id);
CREATE INDEX idx_user_company_company_id ON public.user_company(company_id);