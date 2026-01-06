-- Fix RLS policy for rule_sets table - correct parameter order in user_belongs_to_company
-- The function expects (_user_id uuid, _company_id uuid) but policy had them inverted

DROP POLICY IF EXISTS "Admins can manage company rule sets" ON public.rule_sets;

CREATE POLICY "Admins can manage company rule sets" 
ON public.rule_sets 
FOR ALL
TO public
USING (
  company_id IS NOT NULL 
  AND is_admin_or_above(auth.uid()) 
  AND user_belongs_to_company(auth.uid(), company_id)
)
WITH CHECK (
  company_id IS NOT NULL 
  AND is_admin_or_above(auth.uid()) 
  AND user_belongs_to_company(auth.uid(), company_id)
);