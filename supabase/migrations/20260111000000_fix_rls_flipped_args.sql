
-- Fix flipped arguments in user_belongs_to_company calls for various RLS policies
-- Function signature is: public.user_belongs_to_company(_user_id uuid, _company_id uuid)

-- 1. rule_sets
DROP POLICY IF EXISTS "Company members can view their rule sets" ON public.rule_sets;
CREATE POLICY "Company members can view their rule sets"
  ON public.rule_sets FOR SELECT
  USING (company_id IS NOT NULL AND public.user_belongs_to_company(auth.uid(), company_id));

DROP POLICY IF EXISTS "Admins can manage company rule sets" ON public.rule_sets;
CREATE POLICY "Admins can manage company rule sets"
  ON public.rule_sets FOR ALL
  USING (company_id IS NOT NULL AND public.is_admin_or_above(auth.uid()) AND public.user_belongs_to_company(auth.uid(), company_id));

-- 2. rule_versions
DROP POLICY IF EXISTS "Users can view rule versions through rule sets" ON public.rule_versions;
CREATE POLICY "Users can view rule versions through rule sets"
  ON public.rule_versions FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.rule_sets rs
    WHERE rs.id = rule_versions.rule_set_id
    AND (
      (rs.is_template = true AND rs.company_id IS NULL)
      OR public.user_belongs_to_company(auth.uid(), rs.company_id)
    )
  ));

DROP POLICY IF EXISTS "Admins can manage rule versions" ON public.rule_versions;
CREATE POLICY "Admins can manage rule versions"
  ON public.rule_versions FOR ALL
  USING (EXISTS (
    SELECT 1 FROM public.rule_sets rs
    WHERE rs.id = rule_versions.rule_set_id
    AND rs.company_id IS NOT NULL
    AND public.is_admin_or_above(auth.uid())
    AND public.user_belongs_to_company(auth.uid(), rs.company_id)
  ));

-- 3. rule_assignments
DROP POLICY IF EXISTS "Company members can view assignments" ON public.rule_assignments;
CREATE POLICY "Company members can view assignments"
  ON public.rule_assignments FOR SELECT
  USING (public.user_belongs_to_company(auth.uid(), company_id));

DROP POLICY IF EXISTS "Admins can manage assignments" ON public.rule_assignments;
CREATE POLICY "Admins can manage assignments"
  ON public.rule_assignments FOR ALL
  USING (public.is_admin_or_above(auth.uid()) AND public.user_belongs_to_company(auth.uid(), company_id));

-- 4. compliance_violations
DROP POLICY IF EXISTS "Admins can view company violations" ON public.compliance_violations;
CREATE POLICY "Admins can view company violations"
  ON public.compliance_violations FOR SELECT
  USING (public.is_admin_or_above(auth.uid()) AND public.user_belongs_to_company(auth.uid(), company_id));

DROP POLICY IF EXISTS "Admins can manage violations" ON public.compliance_violations;
CREATE POLICY "Admins can manage violations"
  ON public.compliance_violations FOR ALL
  USING (public.is_admin_or_above(auth.uid()) AND public.user_belongs_to_company(auth.uid(), company_id));

-- 5. compliance_incidents
DROP POLICY IF EXISTS "Company members can view incidents" ON public.compliance_incidents;
CREATE POLICY "Company members can view incidents"
  ON public.compliance_incidents FOR SELECT
  USING (public.user_belongs_to_company(auth.uid(), company_id));

DROP POLICY IF EXISTS "Admins can manage incidents" ON public.compliance_incidents;
CREATE POLICY "Admins can manage incidents"
  ON public.compliance_incidents FOR ALL
  USING (public.is_admin_or_above(auth.uid()) AND public.user_belongs_to_company(auth.uid(), company_id));

-- 6. compliance_notifications
DROP POLICY IF EXISTS "Admins can view company notifications" ON public.compliance_notifications;
CREATE POLICY "Admins can view company notifications"
  ON public.compliance_notifications FOR SELECT
  USING (public.is_admin_or_above(auth.uid()) AND public.user_belongs_to_company(auth.uid(), company_id));

DROP POLICY IF EXISTS "System can manage notifications" ON public.compliance_notifications;
CREATE POLICY "System can manage notifications"
  ON public.compliance_notifications FOR ALL
  USING (public.is_admin_or_above(auth.uid()) AND public.user_belongs_to_company(auth.uid(), company_id));

-- 7. certificate_downloads
DROP POLICY IF EXISTS "Admins can view company certificate downloads" ON public.certificate_downloads;
CREATE POLICY "Admins can view company certificate downloads"
  ON public.certificate_downloads FOR SELECT
  USING (is_admin_or_above(auth.uid()) AND user_belongs_to_company(auth.uid(), company_id));

DROP POLICY IF EXISTS "Admins can insert certificate downloads" ON public.certificate_downloads;
CREATE POLICY "Admins can insert certificate downloads"
  ON public.certificate_downloads FOR INSERT
  WITH CHECK (is_admin_or_above(auth.uid()) AND user_belongs_to_company(auth.uid(), company_id));

-- 8. employees (Fix loose policies from 20260105102432)
DROP POLICY IF EXISTS "Admins can manage employees" ON public.employees;
DROP POLICY IF EXISTS "Responsibles can view employees" ON public.employees;
DROP POLICY IF EXISTS "Employees can view own record" ON public.employees;

-- 9. time_events (Check for similar loose policies)
DROP POLICY IF EXISTS "Admins can view all events" ON public.time_events;
DROP POLICY IF EXISTS "Responsibles can view all events" ON public.time_events;
DROP POLICY IF EXISTS "Employees can view own events" ON public.time_events;
