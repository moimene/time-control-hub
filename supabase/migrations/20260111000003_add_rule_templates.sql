-- Add rule set templates and seeding logic
-- 1. Create Rule Set Templates
INSERT INTO public.rule_sets (id, name, description, sector, status, is_template)
VALUES 
  ('e0000000-0000-0000-0000-000000000001', 'Convenio Hostelería (Default)', 'Reglas base para el sector hostelería (Bar Pepe, etc.)', 'hostelería', 'published', true),
  ('e0000000-0000-0000-0000-000000000002', 'Convenio Sanidad (Default)', 'Reglas base para el sector sanidad (Clínica Vet, etc.)', 'sanidad', 'published', true),
  ('e0000000-0000-0000-0000-000000000003', 'Convenio Comercio (Default)', 'Reglas base para el sector comercio (Tienda Centro, etc.)', 'comercio', 'published', true);

-- 2. Create Rule Versions for Templates
-- Hostelería version
INSERT INTO public.rule_versions (id, rule_set_id, version, payload_json, published_at)
VALUES (
  'e0000000-0000-0000-0000-000000000011', 
  'e0000000-0000-0000-0000-000000000001', 
  '1.0.0', 
  '{
    "max_daily_hours": 9,
    "max_weekly_hours": 40,
    "min_daily_rest": 12,
    "min_weekly_rest": 36,
    "max_overtime_ytd": 80
  }'::jsonb,
  now()
);

-- Sanidad version
INSERT INTO public.rule_versions (id, rule_set_id, version, payload_json, published_at)
VALUES (
  'e0000000-0000-0000-0000-000000000012', 
  'e0000000-0000-0000-0000-000000000002', 
  '1.0.0', 
  '{
    "max_daily_hours": 8,
    "max_weekly_hours": 37.5,
    "min_daily_rest": 12,
    "min_weekly_rest": 48,
    "max_overtime_ytd": 80
  }'::jsonb,
  now()
);

-- Comercio version
INSERT INTO public.rule_versions (id, rule_set_id, version, payload_json, published_at)
VALUES (
  'e0000000-0000-0000-0000-000000000013', 
  'e0000000-0000-0000-0000-000000000003', 
  '1.0.0', 
  '{
    "max_daily_hours": 9,
    "max_weekly_hours": 40,
    "min_daily_rest": 12,
    "min_weekly_rest": 36,
    "max_overtime_ytd": 80
  }'::jsonb,
  now()
);

-- 3. Seeding RPC
CREATE OR REPLACE FUNCTION public.seed_default_rule_sets(p_company_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_sector TEXT;
    v_template_id UUID;
    v_new_rule_set_id UUID;
    v_version_id UUID;
    v_results JSONB := '[]'::jsonb;
BEGIN
    -- Get company sector
    SELECT sector INTO v_sector FROM public.company WHERE id = p_company_id;
    
    -- Find template by sector or fallback to first one
    SELECT id INTO v_template_id 
    FROM public.rule_sets 
    WHERE is_template = true 
    AND (sector = lower(v_sector) OR sector IS NULL)
    ORDER BY (sector = lower(v_sector)) DESC
    LIMIT 1;

    IF v_template_id IS NOT NULL THEN
        -- Clone Rule Set
        INSERT INTO public.rule_sets (company_id, name, description, sector, status, is_template)
        SELECT p_company_id, name || ' (Copy)', description, sector, 'active', false
        FROM public.rule_sets WHERE id = v_template_id
        RETURNING id INTO v_new_rule_set_id;

        -- Clone latest version
        INSERT INTO public.rule_versions (rule_set_id, version, payload_json, published_at, effective_from)
        SELECT v_new_rule_set_id, version, payload_json, now(), now()::date
        FROM public.rule_versions WHERE rule_set_id = v_template_id
        ORDER BY created_at DESC LIMIT 1
        RETURNING id INTO v_version_id;

        -- Assign to company level (priority 0)
        INSERT INTO public.rule_assignments (rule_version_id, company_id, priority, is_active)
        VALUES (v_version_id, p_company_id, 0, true);

        v_results := jsonb_build_object(
            'success', true,
            'rule_set_id', v_new_rule_set_id,
            'version_id', v_version_id,
            'sector', v_sector
        );
    ELSE
        v_results := jsonb_build_object('success', false, 'error', 'No templates found');
    END IF;

    RETURN v_results;
END;
$$;
