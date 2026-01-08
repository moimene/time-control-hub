-- Add RLS policy for super admins to manage rule_sets of any company
CREATE POLICY "Super admins can manage all company rule sets"
ON public.rule_sets
FOR ALL
USING (
  company_id IS NOT NULL 
  AND is_super_admin(auth.uid())
)
WITH CHECK (
  company_id IS NOT NULL 
  AND is_super_admin(auth.uid())
);