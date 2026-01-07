-- Tighten onboarding security: creation is done via backend function, so block direct client inserts.

-- COMPANY: only super admins can insert directly (regular onboarding uses backend function with service privileges)
DROP POLICY IF EXISTS "mt_company_insert" ON public.company;
CREATE POLICY "mt_company_insert"
ON public.company
FOR INSERT
TO authenticated
WITH CHECK (is_super_admin(auth.uid()));

-- USER_COMPANY: remove self-association policies (prevents users linking themselves to arbitrary companies)
DROP POLICY IF EXISTS "Users can create own company association" ON public.user_company;
DROP POLICY IF EXISTS "mt_uc_insert_own" ON public.user_company;

-- USER_ROLES: remove self-role assignment policy (prevents privilege escalation)
DROP POLICY IF EXISTS "Users can insert own roles" ON public.user_roles;
