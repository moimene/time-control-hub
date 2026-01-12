-- Seed default absence types for all existing companies that don't have any
DO $$
DECLARE
  r RECORD;
  seeded_count INTEGER := 0;
BEGIN
  FOR r IN 
    SELECT c.id, c.name
    FROM company c
    LEFT JOIN absence_types at ON at.company_id = c.id
    GROUP BY c.id, c.name
    HAVING COUNT(at.id) = 0
  LOOP
    PERFORM seed_default_absence_types(r.id);
    seeded_count := seeded_count + 1;
    RAISE NOTICE 'Seeded absence types for company: %', r.name;
  END LOOP;
  
  RAISE NOTICE 'Total companies seeded: %', seeded_count;
END $$;