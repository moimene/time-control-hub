ALTER TABLE public.rule_assignments
ADD COLUMN IF NOT EXISTS effective_from DATE;

CREATE OR REPLACE FUNCTION public.assign_rule_version_to_employee(
  p_employee_id UUID,
  p_rule_version_id UUID,
  p_effective_from DATE DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_company_id UUID;
  v_rule_set_company_id UUID;
  v_rule_set_status public.rule_set_status;
  v_assignment_id UUID;
BEGIN
  SELECT company_id
  INTO v_company_id
  FROM public.employees
  WHERE id = p_employee_id;

  IF v_company_id IS NULL THEN
    RAISE EXCEPTION 'Empleado no encontrado' USING ERRCODE = 'P0002';
  END IF;

  IF NOT (
    public.is_super_admin(auth.uid())
    OR (
      public.is_admin_or_above(auth.uid())
      AND public.user_belongs_to_company(auth.uid(), v_company_id)
    )
  ) THEN
    RAISE EXCEPTION 'Access denied' USING ERRCODE = '42501';
  END IF;

  SELECT rs.company_id, rs.status
  INTO v_rule_set_company_id, v_rule_set_status
  FROM public.rule_versions rv
  JOIN public.rule_sets rs ON rs.id = rv.rule_set_id
  WHERE rv.id = p_rule_version_id;

  IF v_rule_set_company_id IS NULL THEN
    RAISE EXCEPTION 'Version de plantilla no encontrada' USING ERRCODE = 'P0002';
  END IF;

  IF v_rule_set_company_id <> v_company_id THEN
    RAISE EXCEPTION 'La plantilla no pertenece a la empresa del empleado' USING ERRCODE = '42501';
  END IF;

  IF v_rule_set_status <> 'published' THEN
    RAISE EXCEPTION 'Solo se pueden asignar plantillas publicadas' USING ERRCODE = '42501';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtext('rule-assignment:' || p_employee_id::text));

  UPDATE public.rule_assignments
  SET is_active = false
  WHERE employee_id = p_employee_id
    AND is_active = true;

  INSERT INTO public.rule_assignments (
    company_id,
    employee_id,
    rule_version_id,
    is_active,
    priority,
    effective_from,
    assigned_by
  )
  VALUES (
    v_company_id,
    p_employee_id,
    p_rule_version_id,
    true,
    1,
    p_effective_from,
    auth.uid()
  )
  RETURNING id INTO v_assignment_id;

  RETURN v_assignment_id;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.assign_rule_version_to_employee(UUID, UUID, DATE) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.assign_rule_version_to_employee(UUID, UUID, DATE) TO authenticated;
