-- Add company_settings table for notification preferences
CREATE TABLE IF NOT EXISTS public.company_settings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID NOT NULL REFERENCES public.company(id) ON DELETE CASCADE,
  setting_key TEXT NOT NULL,
  setting_value JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(company_id, setting_key)
);

-- Enable RLS
ALTER TABLE public.company_settings ENABLE ROW LEVEL SECURITY;

-- Policies for company_settings
CREATE POLICY "Admins can view company settings"
  ON public.company_settings
  FOR SELECT
  USING (user_belongs_to_company(auth.uid(), company_id) AND is_admin_or_above(auth.uid()));

CREATE POLICY "Admins can update company settings"
  ON public.company_settings
  FOR UPDATE
  USING (user_belongs_to_company(auth.uid(), company_id) AND is_admin_or_above(auth.uid()));

CREATE POLICY "Admins can insert company settings"
  ON public.company_settings
  FOR INSERT
  WITH CHECK (user_belongs_to_company(auth.uid(), company_id) AND is_admin_or_above(auth.uid()));

-- Trigger for updated_at
CREATE TRIGGER update_company_settings_updated_at
  BEFORE UPDATE ON public.company_settings
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Add department and is_responsible columns to employees if not exist
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'employees' AND column_name = 'department') THEN
    ALTER TABLE public.employees ADD COLUMN department TEXT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'employees' AND column_name = 'is_department_responsible') THEN
    ALTER TABLE public.employees ADD COLUMN is_department_responsible BOOLEAN DEFAULT false;
  END IF;
END $$;