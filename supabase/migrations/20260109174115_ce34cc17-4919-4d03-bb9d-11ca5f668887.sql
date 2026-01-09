-- Política para que Super Admins puedan gestionar rule_versions de cualquier empresa
CREATE POLICY "Super admins can manage company rule versions"
ON public.rule_versions
FOR ALL
TO public
USING (
  EXISTS (
    SELECT 1 FROM rule_sets rs
    WHERE rs.id = rule_versions.rule_set_id 
    AND rs.company_id IS NOT NULL
    AND is_super_admin(auth.uid())
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM rule_sets rs
    WHERE rs.id = rule_versions.rule_set_id 
    AND rs.company_id IS NOT NULL
    AND is_super_admin(auth.uid())
  )
);

-- Crear la versión faltante para el rule_set huérfano existente
INSERT INTO public.rule_versions (rule_set_id, version, payload_json)
SELECT 
  'c72f06df-6f5d-4dc4-83e4-1a73c01b067e',
  '1.0.0',
  '{"limits":{"max_daily_hours":9,"min_daily_rest":12,"min_weekly_rest":36,"max_overtime_yearly":80,"max_weekly_hours":40},"breaks":{"required_after_hours":6,"min_break_minutes":15},"overtime":{"max_yearly":80,"alert_threshold":60},"leaves":[{"type":"vacation","days":22},{"type":"sick","requires_justification":true}]}'::jsonb
WHERE NOT EXISTS (
  SELECT 1 FROM rule_versions WHERE rule_set_id = 'c72f06df-6f5d-4dc4-83e4-1a73c01b067e'
);