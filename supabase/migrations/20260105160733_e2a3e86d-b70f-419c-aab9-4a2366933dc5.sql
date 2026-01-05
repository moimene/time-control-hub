-- =====================================================
-- HELPER FUNCTIONS
-- =====================================================

CREATE OR REPLACE FUNCTION public.get_user_company_id(_user_id uuid)
RETURNS uuid
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _company_id uuid;
BEGIN
  SELECT company_id INTO _company_id FROM public.employees WHERE user_id = _user_id LIMIT 1;
  IF _company_id IS NOT NULL THEN
    RETURN _company_id;
  END IF;
  SELECT company_id INTO _company_id FROM public.user_company WHERE user_id = _user_id LIMIT 1;
  RETURN _company_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.user_belongs_to_company(_user_id uuid, _company_id uuid)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.employees WHERE user_id = _user_id AND company_id = _company_id
  ) OR EXISTS (
    SELECT 1 FROM public.user_company WHERE user_id = _user_id AND company_id = _company_id
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.is_super_admin(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = 'super_admin'
  )
$$;

-- =====================================================
-- DROP OLD POLICIES (they're already dropped but safe to try)
-- =====================================================

DROP POLICY IF EXISTS "Admins can manage company" ON public.company;
DROP POLICY IF EXISTS "Authenticated users can view company" ON public.company;
DROP POLICY IF EXISTS "Admins can manage employees" ON public.employees;
DROP POLICY IF EXISTS "Employees can view own record" ON public.employees;
DROP POLICY IF EXISTS "Responsibles can view employees" ON public.employees;
DROP POLICY IF EXISTS "Admins can manage terminals" ON public.terminals;
DROP POLICY IF EXISTS "Admins can view all events" ON public.time_events;
DROP POLICY IF EXISTS "Employees can view own events" ON public.time_events;
DROP POLICY IF EXISTS "Responsibles can view all events" ON public.time_events;
DROP POLICY IF EXISTS "Admins can manage correction requests" ON public.correction_requests;
DROP POLICY IF EXISTS "Employees can create own correction requests" ON public.correction_requests;
DROP POLICY IF EXISTS "Employees can view own correction requests" ON public.correction_requests;
DROP POLICY IF EXISTS "Responsibles can update correction requests" ON public.correction_requests;
DROP POLICY IF EXISTS "Responsibles can view and update correction requests" ON public.correction_requests;
DROP POLICY IF EXISTS "Admins can view corrected events" ON public.corrected_events;
DROP POLICY IF EXISTS "Employees can view own corrected events" ON public.corrected_events;
DROP POLICY IF EXISTS "Admins can manage QR codes" ON public.employee_qr;
DROP POLICY IF EXISTS "Admins can view daily roots" ON public.daily_roots;
DROP POLICY IF EXISTS "Admins can view audit log" ON public.audit_log;
DROP POLICY IF EXISTS "Admins can manage roles" ON public.user_roles;
DROP POLICY IF EXISTS "Users can view own roles" ON public.user_roles;

-- =====================================================
-- NEW MULTI-TENANT RLS POLICIES
-- =====================================================

-- COMPANY
CREATE POLICY "mt_company_super_admin" ON public.company FOR ALL USING (is_super_admin(auth.uid()));
CREATE POLICY "mt_company_view_own" ON public.company FOR SELECT USING (user_belongs_to_company(auth.uid(), id));
CREATE POLICY "mt_company_update_own" ON public.company FOR UPDATE USING (user_belongs_to_company(auth.uid(), id) AND is_admin_or_above(auth.uid()));
CREATE POLICY "mt_company_insert" ON public.company FOR INSERT WITH CHECK (true);

-- USER_COMPANY
CREATE POLICY "mt_uc_super_admin" ON public.user_company FOR ALL USING (is_super_admin(auth.uid()));
CREATE POLICY "mt_uc_company_admin" ON public.user_company FOR ALL USING (user_belongs_to_company(auth.uid(), company_id) AND is_admin_or_above(auth.uid()));
CREATE POLICY "mt_uc_view_own" ON public.user_company FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "mt_uc_insert_own" ON public.user_company FOR INSERT WITH CHECK (user_id = auth.uid());

-- EMPLOYEES
CREATE POLICY "mt_emp_super_admin" ON public.employees FOR ALL USING (is_super_admin(auth.uid()));
CREATE POLICY "mt_emp_company_admin" ON public.employees FOR ALL USING (user_belongs_to_company(auth.uid(), company_id) AND is_admin_or_above(auth.uid()));
CREATE POLICY "mt_emp_responsible_view" ON public.employees FOR SELECT USING (user_belongs_to_company(auth.uid(), company_id) AND has_role(auth.uid(), 'responsible'));
CREATE POLICY "mt_emp_view_own" ON public.employees FOR SELECT USING (user_id = auth.uid());

-- TERMINALS
CREATE POLICY "mt_term_super_admin" ON public.terminals FOR ALL USING (is_super_admin(auth.uid()));
CREATE POLICY "mt_term_company_admin" ON public.terminals FOR ALL USING (user_belongs_to_company(auth.uid(), company_id) AND is_admin_or_above(auth.uid()));

-- TIME_EVENTS
CREATE POLICY "mt_te_super_admin" ON public.time_events FOR SELECT USING (is_super_admin(auth.uid()));
CREATE POLICY "mt_te_company_admin" ON public.time_events FOR SELECT USING (user_belongs_to_company(auth.uid(), company_id) AND is_admin_or_above(auth.uid()));
CREATE POLICY "mt_te_responsible" ON public.time_events FOR SELECT USING (user_belongs_to_company(auth.uid(), company_id) AND has_role(auth.uid(), 'responsible'));
CREATE POLICY "mt_te_employee_own" ON public.time_events FOR SELECT USING (employee_id = get_employee_id(auth.uid()));

-- CORRECTION_REQUESTS
CREATE POLICY "mt_cr_super_admin" ON public.correction_requests FOR ALL USING (is_super_admin(auth.uid()));
CREATE POLICY "mt_cr_company_admin" ON public.correction_requests FOR ALL USING (user_belongs_to_company(auth.uid(), company_id) AND is_admin_or_above(auth.uid()));
CREATE POLICY "mt_cr_responsible_view" ON public.correction_requests FOR SELECT USING (user_belongs_to_company(auth.uid(), company_id) AND has_role(auth.uid(), 'responsible'));
CREATE POLICY "mt_cr_responsible_update" ON public.correction_requests FOR UPDATE USING (user_belongs_to_company(auth.uid(), company_id) AND has_role(auth.uid(), 'responsible'));
CREATE POLICY "mt_cr_employee_view" ON public.correction_requests FOR SELECT USING (employee_id = get_employee_id(auth.uid()));
CREATE POLICY "mt_cr_employee_create" ON public.correction_requests FOR INSERT WITH CHECK (employee_id = get_employee_id(auth.uid()));

-- CORRECTED_EVENTS
CREATE POLICY "mt_ce_super_admin" ON public.corrected_events FOR SELECT USING (is_super_admin(auth.uid()));
CREATE POLICY "mt_ce_company_admin" ON public.corrected_events FOR SELECT USING (user_belongs_to_company(auth.uid(), company_id) AND is_admin_or_above(auth.uid()));
CREATE POLICY "mt_ce_employee_own" ON public.corrected_events FOR SELECT USING (employee_id = get_employee_id(auth.uid()));

-- EMPLOYEE_QR
CREATE POLICY "mt_qr_super_admin" ON public.employee_qr FOR ALL USING (is_super_admin(auth.uid()));
CREATE POLICY "mt_qr_company_admin" ON public.employee_qr FOR ALL USING (user_belongs_to_company(auth.uid(), company_id) AND is_admin_or_above(auth.uid()));

-- DAILY_ROOTS
CREATE POLICY "mt_dr_super_admin" ON public.daily_roots FOR SELECT USING (is_super_admin(auth.uid()));
CREATE POLICY "mt_dr_company_admin" ON public.daily_roots FOR SELECT USING (user_belongs_to_company(auth.uid(), company_id) AND is_admin_or_above(auth.uid()));

-- AUDIT_LOG
CREATE POLICY "mt_al_super_admin" ON public.audit_log FOR SELECT USING (is_super_admin(auth.uid()));
CREATE POLICY "mt_al_company_admin" ON public.audit_log FOR SELECT USING (user_belongs_to_company(auth.uid(), company_id) AND is_admin_or_above(auth.uid()));

-- USER_ROLES
CREATE POLICY "mt_ur_super_admin" ON public.user_roles FOR ALL USING (is_super_admin(auth.uid()));
CREATE POLICY "mt_ur_view_own" ON public.user_roles FOR SELECT USING (user_id = auth.uid());