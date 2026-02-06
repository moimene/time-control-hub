-- Policy Snapshot / Drift Check (RLS)
--
-- How to run:
-- - Supabase dashboard: SQL Editor (preferred for quick verification).
-- - Or via psql against the target environment.
--
-- Goal:
-- - Verify RLS is enabled where expected.
-- - Verify policy definitions match intended state (including fixed argument order for
--   user_belongs_to_company(auth.uid(), company_id)).
-- - Detect drift across environments.

-- 1) Critical function signatures
select
  n.nspname as schema_name,
  p.proname as function_name,
  pg_get_function_identity_arguments(p.oid) as identity_args,
  pg_get_function_result(p.oid) as returns_type
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.proname in (
    'user_belongs_to_company',
    'is_admin_or_above',
    'has_role',
    'get_employee_id'
  )
order by p.proname;

-- 2) RLS enabled status for critical tables
select
  c.relname as table_name,
  c.relrowsecurity as rls_enabled,
  c.relforcerowsecurity as rls_forced
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public'
  and c.relkind = 'r'
  and c.relname in (
    'company',
    'user_roles',
    'user_company',
    'employees',
    'time_events',
    'correction_requests',
    'corrected_events',
    'audit_log'
  )
order by c.relname;

-- 3) Policy snapshot for critical tables
select
  schemaname,
  tablename,
  policyname,
  cmd,
  roles,
  qual as using_expr,
  with_check as with_check_expr
from pg_policies
where schemaname = 'public'
  and tablename in (
    'company',
    'user_roles',
    'user_company',
    'employees',
    'time_events',
    'correction_requests',
    'corrected_events',
    'audit_log'
  )
order by tablename, policyname;

-- 4) Detect flipped argument order in policies (should return 0 rows)
-- Correct signature: user_belongs_to_company(_user_id uuid, _company_id uuid)
-- Correct call in RLS: user_belongs_to_company(auth.uid(), company_id)
select
  schemaname,
  tablename,
  policyname,
  cmd,
  qual as using_expr,
  with_check as with_check_expr
from pg_policies
where schemaname = 'public'
  and (
    qual ilike '%user_belongs_to_company(%company_id%, auth.uid())%'
    or with_check ilike '%user_belongs_to_company(%company_id%, auth.uid())%'
  )
order by tablename, policyname;

