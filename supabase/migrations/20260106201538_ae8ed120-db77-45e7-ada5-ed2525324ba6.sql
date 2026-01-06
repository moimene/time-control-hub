-- Fix RLS policies for rule_sets and rule_versions
-- Correct parameter order for user_belongs_to_company(_user_id, _company_id)
-- Ensure rule_versions has WITH CHECK for INSERT/UPDATE

-- rule_sets: fix member view policy
DROP POLICY IF EXISTS "Company members can view their rule sets" ON public.rule_sets;
CREATE POLICY "Company members can view their rule sets"
ON public.rule_sets
FOR SELECT
TO public
USING (
  company_id IS NOT NULL
  AND user_belongs_to_company(auth.uid(), company_id)
);

-- rule_versions: fix admin manage policy (and add WITH CHECK)
DROP POLICY IF EXISTS "Admins can manage rule versions" ON public.rule_versions;
CREATE POLICY "Admins can manage rule versions"
ON public.rule_versions
FOR ALL
TO public
USING (
  EXISTS (
    SELECT 1
    FROM public.rule_sets rs
    WHERE rs.id = rule_versions.rule_set_id
      AND rs.company_id IS NOT NULL
      AND is_admin_or_above(auth.uid())
      AND user_belongs_to_company(auth.uid(), rs.company_id)
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.rule_sets rs
    WHERE rs.id = rule_versions.rule_set_id
      AND rs.company_id IS NOT NULL
      AND is_admin_or_above(auth.uid())
      AND user_belongs_to_company(auth.uid(), rs.company_id)
  )
);

-- rule_versions: fix user view policy parameter order
DROP POLICY IF EXISTS "Users can view rule versions through rule sets" ON public.rule_versions;
CREATE POLICY "Users can view rule versions through rule sets"
ON public.rule_versions
FOR SELECT
TO public
USING (
  EXISTS (
    SELECT 1
    FROM public.rule_sets rs
    WHERE rs.id = rule_versions.rule_set_id
      AND (
        ((rs.is_template = true) AND (rs.company_id IS NULL))
        OR (rs.company_id IS NOT NULL AND user_belongs_to_company(auth.uid(), rs.company_id))
      )
  )
);
