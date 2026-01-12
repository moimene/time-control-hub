
-- Add 'asesor' role to app_role enum
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'asesor';

-- Update is_admin_or_above to potentially include or exclude asesor depending on requirements
-- For now, let's keep it as is and create is_admin_or_asesor if needed
-- Actually, the user says "Asesor Laboral: acceso limitado y auditado".
-- Usually they should see what an admin sees but maybe not manage.

CREATE OR REPLACE FUNCTION public.is_admin_or_asesor(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role IN ('admin', 'super_admin', 'asesor')
  )
$$;
