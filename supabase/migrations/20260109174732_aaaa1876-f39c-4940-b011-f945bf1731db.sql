-- Política para que Super Admins puedan gestionar calendar_holidays de cualquier empresa
CREATE POLICY "Super admins can manage all holidays"
ON public.calendar_holidays
FOR ALL
TO public
USING (is_super_admin(auth.uid()))
WITH CHECK (is_super_admin(auth.uid()));