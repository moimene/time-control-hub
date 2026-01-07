-- Fase 2: Extensiones para sistema de ausencias mejorado (corrección)

-- 2.3 Extender absence_requests con campos faltantes
ALTER TABLE public.absence_requests 
  ADD COLUMN IF NOT EXISTS origin TEXT DEFAULT 'employee',
  ADD COLUMN IF NOT EXISTS tz TEXT DEFAULT 'Europe/Madrid',
  ADD COLUMN IF NOT EXISTS revoked_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS revoked_by UUID,
  ADD COLUMN IF NOT EXISTS revoked_reason TEXT;

-- Añadir constraint para origin (drop primero si existe)
DO $$ 
BEGIN
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'absence_requests_origin_check') THEN
    ALTER TABLE public.absence_requests DROP CONSTRAINT absence_requests_origin_check;
  END IF;
END $$;

ALTER TABLE public.absence_requests 
  ADD CONSTRAINT absence_requests_origin_check 
  CHECK (origin IN ('employee', 'admin'));

-- 2.4 Extender absence_approvals con campo step
ALTER TABLE public.absence_approvals 
  ADD COLUMN IF NOT EXISTS step INTEGER DEFAULT 1;

-- Índice para búsqueda por step (con IF NOT EXISTS)
CREATE INDEX IF NOT EXISTS idx_absence_approvals_step ON public.absence_approvals(request_id, step);

-- 2.5 Añadir campos adicionales a absence_types si no existen
ALTER TABLE public.absence_types
  ADD COLUMN IF NOT EXISTS incompatible_with JSONB DEFAULT '[]',
  ADD COLUMN IF NOT EXISTS alt_mode TEXT,
  ADD COLUMN IF NOT EXISTS alt_mode_description TEXT;

-- 2.6 Crear función helper para verificar si usuario es admin de empresa
CREATE OR REPLACE FUNCTION public.user_is_company_admin(user_uuid UUID, comp_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.user_roles ur
    JOIN public.user_companies uc ON ur.user_id = uc.user_id
    WHERE ur.user_id = user_uuid
    AND uc.company_id = comp_id
    AND ur.role IN ('admin', 'super_admin')
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- 2.7 Crear función helper para obtener employee_id del usuario
CREATE OR REPLACE FUNCTION public.get_employee_id_for_user(user_uuid UUID)
RETURNS UUID AS $$
DECLARE
  emp_id UUID;
BEGIN
  SELECT id INTO emp_id FROM public.employees WHERE user_id = user_uuid LIMIT 1;
  RETURN emp_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- 2.8 Añadir índices faltantes con IF NOT EXISTS
CREATE INDEX IF NOT EXISTS idx_medical_docs_request ON public.medical_docs(request_id);
CREATE INDEX IF NOT EXISTS idx_medical_docs_company ON public.medical_docs(company_id);
CREATE INDEX IF NOT EXISTS idx_medical_docs_retention ON public.medical_docs(retention_until);
CREATE INDEX IF NOT EXISTS idx_template_absence_links_rule ON public.template_absence_links(rule_version_id);
CREATE INDEX IF NOT EXISTS idx_template_absence_links_company ON public.template_absence_links(company_id);