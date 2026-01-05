-- Drop the restrictive policies and recreate as permissive
DROP POLICY IF EXISTS "Admins can view all events" ON public.time_events;
DROP POLICY IF EXISTS "Employees can view own events" ON public.time_events;
DROP POLICY IF EXISTS "Responsibles can view all events" ON public.time_events;

-- Recreate as PERMISSIVE policies (default behavior)
CREATE POLICY "Admins can view all events" 
ON public.time_events 
FOR SELECT 
TO authenticated
USING (is_admin_or_above(auth.uid()));

CREATE POLICY "Employees can view own events" 
ON public.time_events 
FOR SELECT 
TO authenticated
USING (employee_id = get_employee_id(auth.uid()));

CREATE POLICY "Responsibles can view all events" 
ON public.time_events 
FOR SELECT 
TO authenticated
USING (has_role(auth.uid(), 'responsible'));