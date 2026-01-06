
-- =====================================================
-- FASE 0: PREPARACIÓN - CONSOLA DE CUMPLIMIENTO
-- =====================================================

-- 0.1 Corregir constraint de daily_roots para multi-tenant
ALTER TABLE public.daily_roots DROP CONSTRAINT IF EXISTS daily_roots_date_key;
ALTER TABLE public.daily_roots ADD CONSTRAINT daily_roots_company_date_key UNIQUE (company_id, date);

-- =====================================================
-- 0.2 Nuevos ENUMs para el sistema de cumplimiento
-- =====================================================

-- Estado de conjuntos de reglas
CREATE TYPE public.rule_set_status AS ENUM ('draft', 'validating', 'published', 'active', 'archived');

-- Severidad de violaciones
CREATE TYPE public.violation_severity AS ENUM ('info', 'warn', 'critical');

-- Estado de violaciones
CREATE TYPE public.violation_status AS ENUM ('open', 'acknowledged', 'resolved', 'dismissed');

-- Estado de incidencias
CREATE TYPE public.incident_status AS ENUM ('open', 'acknowledged', 'in_progress', 'resolved', 'closed');

-- Canal de notificación
CREATE TYPE public.notification_channel AS ENUM ('in_app', 'email', 'both');

-- =====================================================
-- 0.3 Tabla: rule_sets (Conjuntos de reglas)
-- =====================================================
CREATE TABLE public.rule_sets (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID REFERENCES public.company(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  sector TEXT,
  convenio TEXT,
  status public.rule_set_status NOT NULL DEFAULT 'draft',
  is_template BOOLEAN NOT NULL DEFAULT false,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Índices
CREATE INDEX idx_rule_sets_company ON public.rule_sets(company_id);
CREATE INDEX idx_rule_sets_status ON public.rule_sets(status);
CREATE INDEX idx_rule_sets_template ON public.rule_sets(is_template) WHERE is_template = true;

-- RLS
ALTER TABLE public.rule_sets ENABLE ROW LEVEL SECURITY;

-- Plantillas globales visibles para todos los admins
CREATE POLICY "Admins can view global templates"
  ON public.rule_sets FOR SELECT
  USING (is_template = true AND company_id IS NULL AND public.is_admin_or_above(auth.uid()));

-- Reglas de empresa visibles para miembros
CREATE POLICY "Company members can view their rule sets"
  ON public.rule_sets FOR SELECT
  USING (company_id IS NOT NULL AND public.user_belongs_to_company(company_id, auth.uid()));

-- Solo admins pueden crear/editar reglas de su empresa
CREATE POLICY "Admins can manage company rule sets"
  ON public.rule_sets FOR ALL
  USING (company_id IS NOT NULL AND public.is_admin_or_above(auth.uid()) AND public.user_belongs_to_company(company_id, auth.uid()));

-- Solo super_admin puede gestionar plantillas globales
CREATE POLICY "Super admins can manage global templates"
  ON public.rule_sets FOR ALL
  USING (is_template = true AND company_id IS NULL AND public.is_super_admin(auth.uid()));

-- =====================================================
-- 0.4 Tabla: rule_versions (Versiones de reglas)
-- =====================================================
CREATE TABLE public.rule_versions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  rule_set_id UUID NOT NULL REFERENCES public.rule_sets(id) ON DELETE CASCADE,
  version TEXT NOT NULL,
  effective_from DATE,
  effective_to DATE,
  payload_json JSONB NOT NULL DEFAULT '{}',
  payload_hash TEXT,
  published_at TIMESTAMPTZ,
  published_by UUID,
  dt_evidence_id UUID REFERENCES public.dt_evidences(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT rule_versions_unique_version UNIQUE (rule_set_id, version)
);

-- Índices
CREATE INDEX idx_rule_versions_rule_set ON public.rule_versions(rule_set_id);
CREATE INDEX idx_rule_versions_effective ON public.rule_versions(effective_from, effective_to);

-- RLS
ALTER TABLE public.rule_versions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view rule versions through rule sets"
  ON public.rule_versions FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.rule_sets rs
    WHERE rs.id = rule_versions.rule_set_id
    AND (
      (rs.is_template = true AND rs.company_id IS NULL)
      OR public.user_belongs_to_company(rs.company_id, auth.uid())
    )
  ));

CREATE POLICY "Admins can manage rule versions"
  ON public.rule_versions FOR ALL
  USING (EXISTS (
    SELECT 1 FROM public.rule_sets rs
    WHERE rs.id = rule_versions.rule_set_id
    AND rs.company_id IS NOT NULL
    AND public.is_admin_or_above(auth.uid())
    AND public.user_belongs_to_company(rs.company_id, auth.uid())
  ));

CREATE POLICY "Super admins can manage template versions"
  ON public.rule_versions FOR ALL
  USING (EXISTS (
    SELECT 1 FROM public.rule_sets rs
    WHERE rs.id = rule_versions.rule_set_id
    AND rs.is_template = true
    AND rs.company_id IS NULL
    AND public.is_super_admin(auth.uid())
  ));

-- =====================================================
-- 0.5 Tabla: rule_assignments (Asignaciones de reglas)
-- =====================================================
CREATE TABLE public.rule_assignments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  rule_version_id UUID NOT NULL REFERENCES public.rule_versions(id) ON DELETE CASCADE,
  company_id UUID NOT NULL REFERENCES public.company(id) ON DELETE CASCADE,
  center_id UUID,
  department TEXT,
  employee_id UUID REFERENCES public.employees(id) ON DELETE CASCADE,
  priority INTEGER NOT NULL DEFAULT 0,
  fallback_policy TEXT DEFAULT 'inherit',
  is_active BOOLEAN NOT NULL DEFAULT true,
  assigned_by UUID,
  assigned_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Índices
CREATE INDEX idx_rule_assignments_company ON public.rule_assignments(company_id);
CREATE INDEX idx_rule_assignments_employee ON public.rule_assignments(employee_id);
CREATE INDEX idx_rule_assignments_active ON public.rule_assignments(is_active) WHERE is_active = true;

-- RLS
ALTER TABLE public.rule_assignments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Company members can view assignments"
  ON public.rule_assignments FOR SELECT
  USING (public.user_belongs_to_company(company_id, auth.uid()));

CREATE POLICY "Admins can manage assignments"
  ON public.rule_assignments FOR ALL
  USING (public.is_admin_or_above(auth.uid()) AND public.user_belongs_to_company(company_id, auth.uid()));

-- =====================================================
-- 0.6 Tabla: compliance_violations (Violaciones detectadas)
-- =====================================================
CREATE TABLE public.compliance_violations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID NOT NULL REFERENCES public.company(id) ON DELETE CASCADE,
  employee_id UUID NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  rule_code TEXT NOT NULL,
  rule_version_id UUID REFERENCES public.rule_versions(id),
  severity public.violation_severity NOT NULL DEFAULT 'warn',
  status public.violation_status NOT NULL DEFAULT 'open',
  violation_date DATE NOT NULL,
  detected_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  evidence_json JSONB NOT NULL DEFAULT '{}',
  auto_resolved_at TIMESTAMPTZ,
  resolved_by UUID,
  resolved_at TIMESTAMPTZ,
  resolution_notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Índices
CREATE INDEX idx_violations_company ON public.compliance_violations(company_id);
CREATE INDEX idx_violations_employee ON public.compliance_violations(employee_id);
CREATE INDEX idx_violations_date ON public.compliance_violations(violation_date);
CREATE INDEX idx_violations_status ON public.compliance_violations(status);
CREATE INDEX idx_violations_severity ON public.compliance_violations(severity);
CREATE INDEX idx_violations_rule ON public.compliance_violations(rule_code);

-- RLS
ALTER TABLE public.compliance_violations ENABLE ROW LEVEL SECURITY;

-- Empleados pueden ver sus propias violaciones
CREATE POLICY "Employees can view own violations"
  ON public.compliance_violations FOR SELECT
  USING (employee_id = public.get_employee_id(auth.uid()));

-- Admins/responsables pueden ver violaciones de su empresa
CREATE POLICY "Admins can view company violations"
  ON public.compliance_violations FOR SELECT
  USING (public.is_admin_or_above(auth.uid()) AND public.user_belongs_to_company(company_id, auth.uid()));

-- Solo admins pueden gestionar violaciones
CREATE POLICY "Admins can manage violations"
  ON public.compliance_violations FOR ALL
  USING (public.is_admin_or_above(auth.uid()) AND public.user_belongs_to_company(company_id, auth.uid()));

-- =====================================================
-- 0.7 Tabla: compliance_incidents (Incidencias escaladas)
-- =====================================================
CREATE TABLE public.compliance_incidents (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID NOT NULL REFERENCES public.company(id) ON DELETE CASCADE,
  violation_id UUID REFERENCES public.compliance_violations(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  description TEXT,
  severity public.violation_severity NOT NULL DEFAULT 'warn',
  status public.incident_status NOT NULL DEFAULT 'open',
  assigned_to UUID,
  sla_due_at TIMESTAMPTZ,
  acknowledged_at TIMESTAMPTZ,
  acknowledged_by UUID,
  resolved_at TIMESTAMPTZ,
  resolved_by UUID,
  resolution_notes TEXT,
  linked_correction_id UUID REFERENCES public.correction_requests(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Índices
CREATE INDEX idx_incidents_company ON public.compliance_incidents(company_id);
CREATE INDEX idx_incidents_status ON public.compliance_incidents(status);
CREATE INDEX idx_incidents_severity ON public.compliance_incidents(severity);
CREATE INDEX idx_incidents_assigned ON public.compliance_incidents(assigned_to);
CREATE INDEX idx_incidents_sla ON public.compliance_incidents(sla_due_at) WHERE status NOT IN ('resolved', 'closed');

-- RLS
ALTER TABLE public.compliance_incidents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Company members can view incidents"
  ON public.compliance_incidents FOR SELECT
  USING (public.user_belongs_to_company(company_id, auth.uid()));

CREATE POLICY "Admins can manage incidents"
  ON public.compliance_incidents FOR ALL
  USING (public.is_admin_or_above(auth.uid()) AND public.user_belongs_to_company(company_id, auth.uid()));

-- =====================================================
-- 0.8 Tabla: compliance_notifications (Notificaciones)
-- =====================================================
CREATE TABLE public.compliance_notifications (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID NOT NULL REFERENCES public.company(id) ON DELETE CASCADE,
  incident_id UUID REFERENCES public.compliance_incidents(id) ON DELETE CASCADE,
  violation_id UUID REFERENCES public.compliance_violations(id) ON DELETE CASCADE,
  recipient_user_id UUID,
  recipient_employee_id UUID REFERENCES public.employees(id) ON DELETE CASCADE,
  recipient_email TEXT,
  channel public.notification_channel NOT NULL DEFAULT 'email',
  notification_type TEXT NOT NULL,
  subject TEXT,
  body_json JSONB NOT NULL DEFAULT '{}',
  scheduled_for TIMESTAMPTZ NOT NULL DEFAULT now(),
  sent_at TIMESTAMPTZ,
  failed_at TIMESTAMPTZ,
  error_message TEXT,
  quiet_hours_delayed BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Índices
CREATE INDEX idx_notifications_company ON public.compliance_notifications(company_id);
CREATE INDEX idx_notifications_incident ON public.compliance_notifications(incident_id);
CREATE INDEX idx_notifications_scheduled ON public.compliance_notifications(scheduled_for) WHERE sent_at IS NULL;
CREATE INDEX idx_notifications_pending ON public.compliance_notifications(sent_at) WHERE sent_at IS NULL AND failed_at IS NULL;

-- RLS
ALTER TABLE public.compliance_notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own notifications"
  ON public.compliance_notifications FOR SELECT
  USING (recipient_user_id = auth.uid() OR recipient_employee_id = public.get_employee_id(auth.uid()));

CREATE POLICY "Admins can view company notifications"
  ON public.compliance_notifications FOR SELECT
  USING (public.is_admin_or_above(auth.uid()) AND public.user_belongs_to_company(company_id, auth.uid()));

CREATE POLICY "System can manage notifications"
  ON public.compliance_notifications FOR ALL
  USING (public.is_admin_or_above(auth.uid()) AND public.user_belongs_to_company(company_id, auth.uid()));

-- =====================================================
-- 0.9 Triggers para updated_at
-- =====================================================

CREATE TRIGGER update_rule_sets_updated_at
  BEFORE UPDATE ON public.rule_sets
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_rule_versions_updated_at
  BEFORE UPDATE ON public.rule_versions
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_rule_assignments_updated_at
  BEFORE UPDATE ON public.rule_assignments
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_compliance_violations_updated_at
  BEFORE UPDATE ON public.compliance_violations
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_compliance_incidents_updated_at
  BEFORE UPDATE ON public.compliance_incidents
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- =====================================================
-- 0.10 Comentarios de documentación
-- =====================================================

COMMENT ON TABLE public.rule_sets IS 'Conjuntos de reglas de cumplimiento. company_id NULL = plantilla global';
COMMENT ON TABLE public.rule_versions IS 'Versiones versionadas de conjuntos de reglas con payload JSON';
COMMENT ON TABLE public.rule_assignments IS 'Asignaciones de versiones de reglas a empresa/centro/departamento/empleado';
COMMENT ON TABLE public.compliance_violations IS 'Violaciones de cumplimiento detectadas por el evaluador';
COMMENT ON TABLE public.compliance_incidents IS 'Incidencias escaladas desde violaciones con workflow de resolución';
COMMENT ON TABLE public.compliance_notifications IS 'Registro de notificaciones enviadas o programadas';
