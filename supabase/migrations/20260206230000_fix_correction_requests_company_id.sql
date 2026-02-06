-- Ensure correction_requests.company_id is always derived from employees.company_id.
-- This prevents cross-tenant drift and ensures responsible/admin scopes work consistently.

-- Backfill missing company_id (safe on fresh DBs).
UPDATE public.correction_requests cr
SET company_id = e.company_id
FROM public.employees e
WHERE cr.company_id IS NULL
  AND cr.employee_id = e.id
  AND e.company_id IS NOT NULL;

CREATE OR REPLACE FUNCTION public.set_correction_request_company_id()
RETURNS TRIGGER AS $$
DECLARE
  derived_company_id uuid;
BEGIN
  SELECT company_id
  INTO derived_company_id
  FROM public.employees
  WHERE id = NEW.employee_id;

  IF derived_company_id IS NULL THEN
    RAISE EXCEPTION 'Unable to derive company_id for correction_request: employee % has no company_id', NEW.employee_id
      USING ERRCODE = '23514';
  END IF;

  IF NEW.company_id IS NULL THEN
    NEW.company_id := derived_company_id;
  ELSIF NEW.company_id <> derived_company_id THEN
    RAISE EXCEPTION 'Invalid company_id for correction_request: % does not match employee company %', NEW.company_id, derived_company_id
      USING ERRCODE = '23514';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS set_correction_requests_company_id ON public.correction_requests;
CREATE TRIGGER set_correction_requests_company_id
BEFORE INSERT OR UPDATE OF employee_id, company_id ON public.correction_requests
FOR EACH ROW
EXECUTE FUNCTION public.set_correction_request_company_id();

-- RLS: require company_id to match the caller tenant for employee inserts.
DROP POLICY IF EXISTS "mt_cr_employee_create" ON public.correction_requests;
CREATE POLICY "mt_cr_employee_create" ON public.correction_requests
FOR INSERT
WITH CHECK (
  employee_id = get_employee_id(auth.uid())
  AND company_id = get_user_company_id(auth.uid())
);

