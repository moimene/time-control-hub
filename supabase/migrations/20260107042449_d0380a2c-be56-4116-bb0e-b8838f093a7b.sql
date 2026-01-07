
-- ==============================================
-- FASE 1: Sistema de Ausencias Mejorado v2
-- ==============================================

-- 1. Tabla coverage_rules: Reglas de cobertura por empresa/centro/departamento
CREATE TABLE public.coverage_rules (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID NOT NULL REFERENCES public.company(id) ON DELETE CASCADE,
  center_id UUID NULL,
  department TEXT NULL,
  job_profile TEXT NULL,
  min_team_available_pct NUMERIC NOT NULL DEFAULT 50,
  max_simultaneous_absences INTEGER NULL,
  blackout_ranges JSONB NOT NULL DEFAULT '[]'::jsonb,
  approval_overrides BOOLEAN NOT NULL DEFAULT false,
  priority INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Índices para coverage_rules
CREATE INDEX idx_coverage_rules_company ON public.coverage_rules(company_id);
CREATE INDEX idx_coverage_rules_center ON public.coverage_rules(center_id) WHERE center_id IS NOT NULL;
CREATE INDEX idx_coverage_rules_department ON public.coverage_rules(department) WHERE department IS NOT NULL;

-- RLS para coverage_rules
ALTER TABLE public.coverage_rules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage coverage rules"
ON public.coverage_rules FOR ALL
USING (is_admin_or_above(auth.uid()) AND user_belongs_to_company(auth.uid(), company_id));

CREATE POLICY "Company members can view coverage rules"
ON public.coverage_rules FOR SELECT
USING (user_belongs_to_company(auth.uid(), company_id));

-- 2. Tabla calendar_holidays: Festivos por empresa/centro
CREATE TABLE public.calendar_holidays (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID NOT NULL REFERENCES public.company(id) ON DELETE CASCADE,
  center_id UUID NULL,
  holiday_date DATE NOT NULL,
  holiday_type TEXT NOT NULL DEFAULT 'local',
  description TEXT NULL,
  is_working_day BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  CONSTRAINT valid_holiday_type CHECK (holiday_type IN ('estatal', 'autonomico', 'local', 'empresa'))
);

-- Índices para calendar_holidays
CREATE INDEX idx_calendar_holidays_company ON public.calendar_holidays(company_id);
CREATE INDEX idx_calendar_holidays_date ON public.calendar_holidays(holiday_date);
CREATE INDEX idx_calendar_holidays_center ON public.calendar_holidays(center_id) WHERE center_id IS NOT NULL;
CREATE UNIQUE INDEX idx_calendar_holidays_unique ON public.calendar_holidays(company_id, COALESCE(center_id, '00000000-0000-0000-0000-000000000000'::uuid), holiday_date);

-- RLS para calendar_holidays
ALTER TABLE public.calendar_holidays ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage holidays"
ON public.calendar_holidays FOR ALL
USING (is_admin_or_above(auth.uid()) AND user_belongs_to_company(auth.uid(), company_id));

CREATE POLICY "Company members can view holidays"
ON public.calendar_holidays FOR SELECT
USING (user_belongs_to_company(auth.uid(), company_id));

-- 3. Tabla medical_docs: Documentos con datos de salud (acceso restringido)
CREATE TABLE public.medical_docs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  request_id UUID NOT NULL REFERENCES public.absence_requests(id) ON DELETE CASCADE,
  company_id UUID NOT NULL REFERENCES public.company(id) ON DELETE CASCADE,
  employee_id UUID NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  file_path TEXT NOT NULL,
  file_name TEXT NOT NULL,
  mime_type TEXT NULL,
  file_size INTEGER NULL,
  scope TEXT NOT NULL DEFAULT 'health',
  access_scope TEXT NOT NULL DEFAULT 'restricted',
  retention_until DATE NULL,
  uploaded_by UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Índices para medical_docs
CREATE INDEX idx_medical_docs_request ON public.medical_docs(request_id);
CREATE INDEX idx_medical_docs_employee ON public.medical_docs(employee_id);
CREATE INDEX idx_medical_docs_retention ON public.medical_docs(retention_until) WHERE retention_until IS NOT NULL;

-- RLS para medical_docs (acceso muy restringido)
ALTER TABLE public.medical_docs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Only admins can manage medical docs"
ON public.medical_docs FOR ALL
USING (is_admin_or_above(auth.uid()) AND user_belongs_to_company(auth.uid(), company_id));

CREATE POLICY "Employees can view own medical docs"
ON public.medical_docs FOR SELECT
USING (employee_id = get_employee_id(auth.uid()));

CREATE POLICY "Employees can upload own medical docs"
ON public.medical_docs FOR INSERT
WITH CHECK (employee_id = get_employee_id(auth.uid()) AND user_belongs_to_company(auth.uid(), company_id));

-- 4. Tabla template_absence_links: Vinculación entre plantillas y tipos de ausencia
CREATE TABLE public.template_absence_links (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID NOT NULL REFERENCES public.company(id) ON DELETE CASCADE,
  rule_version_id UUID NULL REFERENCES public.rule_versions(id) ON DELETE SET NULL,
  absence_type_id UUID NOT NULL REFERENCES public.absence_types(id) ON DELETE CASCADE,
  template_leave_code TEXT NOT NULL,
  mapping_config JSONB NOT NULL DEFAULT '{}'::jsonb,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Índices para template_absence_links
CREATE INDEX idx_template_absence_links_company ON public.template_absence_links(company_id);
CREATE INDEX idx_template_absence_links_rule_version ON public.template_absence_links(rule_version_id) WHERE rule_version_id IS NOT NULL;
CREATE INDEX idx_template_absence_links_absence_type ON public.template_absence_links(absence_type_id);

-- RLS para template_absence_links
ALTER TABLE public.template_absence_links ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage template absence links"
ON public.template_absence_links FOR ALL
USING (is_admin_or_above(auth.uid()) AND user_belongs_to_company(auth.uid(), company_id));

CREATE POLICY "Company members can view template absence links"
ON public.template_absence_links FOR SELECT
USING (user_belongs_to_company(auth.uid(), company_id));

-- 5. Extender absence_requests con nuevos campos
ALTER TABLE public.absence_requests 
  ADD COLUMN IF NOT EXISTS center_id UUID NULL,
  ADD COLUMN IF NOT EXISTS total_hours NUMERIC NULL,
  ADD COLUMN IF NOT EXISTS justification_required BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS justification_files JSONB NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS justification_meta JSONB NULL,
  ADD COLUMN IF NOT EXISTS coverage_check JSONB NULL,
  ADD COLUMN IF NOT EXISTS created_by UUID NULL,
  ADD COLUMN IF NOT EXISTS travel_km INTEGER NULL,
  ADD COLUMN IF NOT EXISTS extra_days_applied INTEGER NOT NULL DEFAULT 0;

-- Índice para búsquedas por centro
CREATE INDEX IF NOT EXISTS idx_absence_requests_center ON public.absence_requests(center_id) WHERE center_id IS NOT NULL;

-- 6. Extender vacation_balances con nuevos campos
ALTER TABLE public.vacation_balances
  ADD COLUMN IF NOT EXISTS devengado_days NUMERIC NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS total_hours_equiv NUMERIC NULL,
  ADD COLUMN IF NOT EXISTS policy JSONB NULL,
  ADD COLUMN IF NOT EXISTS accrual_type TEXT NOT NULL DEFAULT 'annual',
  ADD COLUMN IF NOT EXISTS last_calc_at TIMESTAMP WITH TIME ZONE NULL;

-- Añadir constraint para accrual_type si no existe
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'valid_accrual_type'
  ) THEN
    ALTER TABLE public.vacation_balances 
    ADD CONSTRAINT valid_accrual_type CHECK (accrual_type IN ('annual', 'monthly', 'anniversary'));
  END IF;
END $$;

-- 7. Extender absence_types con campos faltantes del spec
ALTER TABLE public.absence_types
  ADD COLUMN IF NOT EXISTS min_block_days INTEGER NULL,
  ADD COLUMN IF NOT EXISTS preaviso_hours INTEGER NULL;

-- 8. Trigger para updated_at en nuevas tablas
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_coverage_rules_updated_at
  BEFORE UPDATE ON public.coverage_rules
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_calendar_holidays_updated_at
  BEFORE UPDATE ON public.calendar_holidays
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_template_absence_links_updated_at
  BEFORE UPDATE ON public.template_absence_links
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 9. Habilitar realtime para las nuevas tablas
ALTER PUBLICATION supabase_realtime ADD TABLE public.coverage_rules;
ALTER PUBLICATION supabase_realtime ADD TABLE public.calendar_holidays;
