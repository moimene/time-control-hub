-- Migration: fix_setup_status_caller_validation
-- Purpose: Add cross-tenant protection to get_company_setup_status.
--          Revoke from PUBLIC; validate caller belongs to the requested company.

-- Revoke default PUBLIC execute (prevents anon role access)
REVOKE EXECUTE ON FUNCTION get_company_setup_status(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION get_company_setup_status(UUID) TO authenticated;

-- Recreate function with caller ownership check
CREATE OR REPLACE FUNCTION get_company_setup_status(p_company_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller_id UUID := auth.uid();
  v_current_year INT := EXTRACT(YEAR FROM NOW())::INT;

  v_employees_count         BIGINT;
  v_rule_assignments_count  BIGINT;
  v_convenio_set            BOOLEAN;
  v_calendar_published      BOOLEAN;
  v_holidays_count          BIGINT;
  v_local_holidays_count    BIGINT;
  v_coverage_count          BIGINT;
  v_absence_types_count     BIGINT;
  v_terminals_count         BIGINT;

  v_result JSONB;
BEGIN
  -- Caller must belong to the target company or be a super admin
  IF NOT (
    EXISTS (SELECT 1 FROM user_roles WHERE user_id = v_caller_id AND role = 'super_admin')
    OR EXISTS (SELECT 1 FROM user_company WHERE user_id = v_caller_id AND company_id = p_company_id)
  ) THEN
    RAISE EXCEPTION 'Access denied' USING ERRCODE = '42501';
  END IF;

  SELECT COUNT(*) INTO v_employees_count
  FROM employees
  WHERE company_id = p_company_id AND status = 'active';

  SELECT COUNT(*) INTO v_rule_assignments_count
  FROM rule_assignments
  WHERE company_id = p_company_id AND is_active = TRUE;

  SELECT EXISTS (
    SELECT 1
    FROM rule_assignments ra
    JOIN rule_versions rv ON rv.id = ra.rule_version_id
    WHERE ra.company_id = p_company_id
      AND ra.is_active = TRUE
      AND rv.payload_json -> 'meta' ->> 'convenio' IS NOT NULL
      AND trim(rv.payload_json -> 'meta' ->> 'convenio') <> ''
  ) INTO v_convenio_set;

  SELECT EXISTS (
    SELECT 1
    FROM labor_calendars
    WHERE company_id = p_company_id
      AND year = v_current_year
      AND published_at IS NOT NULL
  ) INTO v_calendar_published;

  SELECT COUNT(*) INTO v_holidays_count
  FROM calendar_holidays
  WHERE company_id = p_company_id;

  SELECT COUNT(*) INTO v_local_holidays_count
  FROM calendar_holidays
  WHERE company_id = p_company_id
    AND holiday_type IN ('local', 'empresa');

  SELECT COUNT(*) INTO v_coverage_count
  FROM coverage_rules
  WHERE company_id = p_company_id;

  SELECT COUNT(*) INTO v_absence_types_count
  FROM absence_types
  WHERE company_id = p_company_id AND is_active = TRUE;

  SELECT COUNT(*) INTO v_terminals_count
  FROM terminals
  WHERE company_id = p_company_id AND status = 'active';

  v_result := jsonb_build_object(
    'company_id', p_company_id,
    'evaluated_at', NOW(),
    'checks', jsonb_build_array(
      jsonb_build_object(
        'key', 'jornada_rules',
        'category', 'critical',
        'completed', v_rule_assignments_count > 0,
        'label', 'Reglas de jornada asignadas',
        'hint', 'Usa el asistente de configuración para definir y asignar una plantilla horaria',
        'path', '/admin/templates'
      ),
      jsonb_build_object(
        'key', 'convenio',
        'category', 'critical',
        'completed', v_convenio_set,
        'label', 'Convenio colectivo configurado',
        'hint', 'Selecciona el convenio colectivo aplicable en la plantilla horaria',
        'path', '/admin/templates'
      ),
      jsonb_build_object(
        'key', 'calendar_published',
        'category', 'critical',
        'completed', v_calendar_published,
        'label', 'Calendario laboral publicado (' || v_current_year || ')',
        'hint', 'Crea y publica el calendario laboral para el año en curso',
        'path', '/admin/settings'
      ),
      jsonb_build_object(
        'key', 'employees',
        'category', 'critical',
        'completed', v_employees_count > 1,
        'label', 'Empleados dados de alta',
        'hint', 'Registra al menos un empleado (además del administrador) antes de activar el sistema',
        'path', '/admin/employees'
      ),
      jsonb_build_object(
        'key', 'holidays',
        'category', 'recommended',
        'completed', v_holidays_count > 0,
        'auto_provided', v_holidays_count > 0 AND v_local_holidays_count = 0,
        'label', 'Festivos importados',
        'hint', 'Los festivos nacionales se cargan automáticamente; añade los locales de tu municipio',
        'path', '/admin/settings'
      ),
      jsonb_build_object(
        'key', 'coverage',
        'category', 'recommended',
        'completed', v_coverage_count > 0,
        'label', 'Reglas de cobertura',
        'hint', 'Define el número mínimo de trabajadores disponibles por departamento',
        'path', '/admin/settings'
      ),
      jsonb_build_object(
        'key', 'absence_types',
        'category', 'recommended',
        'completed', v_absence_types_count > 0,
        'auto_provided', TRUE,
        'label', 'Tipos de ausencia',
        'hint', 'Configurados automáticamente según la legislación española',
        'path', '/admin/absences'
      ),
      jsonb_build_object(
        'key', 'terminals',
        'category', 'recommended',
        'completed', v_terminals_count > 0,
        'auto_provided', TRUE,
        'label', 'Terminal de fichaje',
        'hint', 'Terminal virtual creado automáticamente; añade terminales físicos si los necesitas',
        'path', '/admin/terminals'
      )
    )
  );

  RETURN v_result;
END;
$$;
