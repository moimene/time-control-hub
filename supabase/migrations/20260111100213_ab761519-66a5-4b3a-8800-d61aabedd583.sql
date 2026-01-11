-- =====================================================
-- MIGRACIÓN PARTE 2: Políticas RLS para rol asesor
-- (Ahora que el enum 'asesor' está comiteado)
-- =====================================================

-- 1. Función helper para verificar si usuario es asesor de una empresa
CREATE OR REPLACE FUNCTION public.is_asesor_of_company(_user_id uuid, _company_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles ur
    JOIN public.user_company uc ON ur.user_id = uc.user_id
    WHERE ur.user_id = _user_id
      AND ur.role = 'asesor'
      AND uc.company_id = _company_id
  )
$$;

-- 2. Políticas RLS para asesor (solo lectura en tablas relevantes)

-- employees: asesor puede ver empleados de sus empresas asignadas
DROP POLICY IF EXISTS "asesor_can_view_assigned_company_employees" ON public.employees;
CREATE POLICY "asesor_can_view_assigned_company_employees" ON public.employees
  FOR SELECT
  TO authenticated
  USING (public.is_asesor_of_company(auth.uid(), company_id));

-- time_events: asesor puede ver fichajes de empresas asignadas
DROP POLICY IF EXISTS "asesor_can_view_assigned_company_events" ON public.time_events;
CREATE POLICY "asesor_can_view_assigned_company_events" ON public.time_events
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.employees e
      WHERE e.id = time_events.employee_id
        AND public.is_asesor_of_company(auth.uid(), e.company_id)
    )
  );

-- compliance_violations: asesor puede ver violaciones
DROP POLICY IF EXISTS "asesor_can_view_assigned_company_violations" ON public.compliance_violations;
CREATE POLICY "asesor_can_view_assigned_company_violations" ON public.compliance_violations
  FOR SELECT
  TO authenticated
  USING (public.is_asesor_of_company(auth.uid(), company_id));

-- compliance_incidents: asesor puede ver incidentes
DROP POLICY IF EXISTS "asesor_can_view_assigned_company_incidents" ON public.compliance_incidents;
CREATE POLICY "asesor_can_view_assigned_company_incidents" ON public.compliance_incidents
  FOR SELECT
  TO authenticated
  USING (public.is_asesor_of_company(auth.uid(), company_id));

-- rule_sets: asesor puede ver reglas
DROP POLICY IF EXISTS "asesor_can_view_assigned_company_rules" ON public.rule_sets;
CREATE POLICY "asesor_can_view_assigned_company_rules" ON public.rule_sets
  FOR SELECT
  TO authenticated
  USING (public.is_asesor_of_company(auth.uid(), company_id));

-- audit_log: asesor puede ver logs
DROP POLICY IF EXISTS "asesor_can_view_assigned_company_audit" ON public.audit_log;
CREATE POLICY "asesor_can_view_assigned_company_audit" ON public.audit_log
  FOR SELECT
  TO authenticated
  USING (public.is_asesor_of_company(auth.uid(), company_id));

-- absence_requests: asesor puede ver ausencias
DROP POLICY IF EXISTS "asesor_can_view_assigned_company_absences" ON public.absence_requests;
CREATE POLICY "asesor_can_view_assigned_company_absences" ON public.absence_requests
  FOR SELECT
  TO authenticated
  USING (public.is_asesor_of_company(auth.uid(), company_id));

-- correction_requests: asesor puede ver correcciones
DROP POLICY IF EXISTS "asesor_can_view_assigned_company_corrections" ON public.correction_requests;
CREATE POLICY "asesor_can_view_assigned_company_corrections" ON public.correction_requests
  FOR SELECT
  TO authenticated
  USING (public.is_asesor_of_company(auth.uid(), company_id));

-- company: asesor puede ver datos de empresas asignadas
DROP POLICY IF EXISTS "asesor_can_view_assigned_companies" ON public.company;
CREATE POLICY "asesor_can_view_assigned_companies" ON public.company
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.user_company uc
      JOIN public.user_roles ur ON uc.user_id = ur.user_id
      WHERE uc.user_id = auth.uid()
        AND uc.company_id = company.id
        AND ur.role = 'asesor'
    )
  );