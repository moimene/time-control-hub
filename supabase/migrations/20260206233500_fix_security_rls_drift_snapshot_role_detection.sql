-- Fix role detection for security_rls_drift_snapshot().
-- Depending on the gateway, role may be exposed via request.jwt.claims or via current_user.

CREATE OR REPLACE FUNCTION public.security_rls_drift_snapshot()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  jwt_claims text;
  jwt_role text;
BEGIN
  jwt_claims := current_setting('request.jwt.claims', true);
  jwt_role := current_setting('request.jwt.claim.role', true);

  IF jwt_role IS NULL OR jwt_role = '' THEN
    BEGIN
      jwt_role := COALESCE(jwt_claims::jsonb ->> 'role', '');
    EXCEPTION
      WHEN others THEN
        jwt_role := '';
    END;
  END IF;

  IF jwt_role IS NULL THEN
    jwt_role := '';
  END IF;

  -- Fallback to the effective DB role (PostgREST sets role based on JWT).
  IF jwt_role = '' THEN
    jwt_role := current_user;
  END IF;

  IF jwt_role <> 'service_role' AND current_user <> 'service_role' AND NOT public.is_super_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Only service_role or super_admin can run security_rls_drift_snapshot'
      USING ERRCODE = '42501';
  END IF;

  RETURN jsonb_build_object(
    'checked_at', now(),
    'jwt_role', jwt_role,
    'current_user', current_user,
    'function_signatures', (
      SELECT jsonb_agg(
        jsonb_build_object(
          'schema', n.nspname,
          'name', p.proname,
          'identity_args', pg_get_function_identity_arguments(p.oid),
          'result_type', pg_get_function_result(p.oid)
        )
      )
      FROM pg_proc p
      JOIN pg_namespace n ON n.oid = p.pronamespace
      WHERE n.nspname = 'public'
        AND p.proname IN (
          'user_belongs_to_company',
          'get_user_company_id',
          'get_employee_id',
          'has_role',
          'is_admin_or_above',
          'is_super_admin',
          'is_asesor_of_company'
        )
    ),
    'policies', (
      SELECT jsonb_agg(
        jsonb_build_object(
          'schemaname', schemaname,
          'tablename', tablename,
          'policyname', policyname,
          'permissive', permissive,
          'roles', roles,
          'cmd', cmd,
          'qual', qual,
          'with_check', with_check
        )
      )
      FROM pg_policies
      WHERE schemaname = 'public'
    )
  );
END;
$$;

