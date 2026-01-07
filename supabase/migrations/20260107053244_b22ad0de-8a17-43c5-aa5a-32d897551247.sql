-- Drop the restrictive insert policy and recreate as permissive
DROP POLICY IF EXISTS "mt_company_insert" ON public.company;

-- Create permissive INSERT policy for authenticated users
CREATE POLICY "mt_company_insert" 
ON public.company 
FOR INSERT 
TO authenticated
WITH CHECK (true);

-- Also ensure user_company and user_roles allow inserts for new company setup
DROP POLICY IF EXISTS "Users can create own company association" ON public.user_company;
CREATE POLICY "Users can create own company association"
ON public.user_company
FOR INSERT
TO authenticated
WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "Users can insert own roles" ON public.user_roles;
CREATE POLICY "Users can insert own roles"
ON public.user_roles
FOR INSERT
TO authenticated
WITH CHECK (user_id = auth.uid());