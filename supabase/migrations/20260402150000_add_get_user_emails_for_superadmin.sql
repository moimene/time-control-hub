-- Migration: Add RPC function for super admin to get user emails from auth.users
-- This fixes the bug where the super admin users page shows truncated UUIDs instead of actual emails

CREATE OR REPLACE FUNCTION public.get_user_emails_for_superadmin()
RETURNS TABLE (
  user_id UUID,
  email TEXT,
  created_at TIMESTAMPTZ,
  last_sign_in_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
BEGIN
  -- Only allow super_admin to call this function
  IF NOT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_roles.user_id = auth.uid()
    AND user_roles.role = 'super_admin'
  ) THEN
    RAISE EXCEPTION 'Access denied: super_admin role required';
  END IF;

  RETURN QUERY
  SELECT
    u.id AS user_id,
    u.email::TEXT AS email,
    u.created_at,
    u.last_sign_in_at
  FROM auth.users u;
END;
$$;

-- Grant execute to authenticated users (function self-validates role)
GRANT EXECUTE ON FUNCTION public.get_user_emails_for_superadmin() TO authenticated;

COMMENT ON FUNCTION public.get_user_emails_for_superadmin IS
  'Returns user emails from auth.users. Restricted to super_admin role.';
