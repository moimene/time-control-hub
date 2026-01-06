-- Añadir nuevos campos a company para soportar autónomos y selección de actividad
ALTER TABLE company ADD COLUMN IF NOT EXISTS entity_type TEXT DEFAULT 'empresa';
ALTER TABLE company ADD COLUMN IF NOT EXISTS trade_name TEXT;
ALTER TABLE company ADD COLUMN IF NOT EXISTS sector TEXT;
ALTER TABLE company ADD COLUMN IF NOT EXISTS cnae TEXT;

-- Añadir constraint para entity_type
DO $$ BEGIN
  ALTER TABLE company ADD CONSTRAINT company_entity_type_check 
    CHECK (entity_type IN ('empresa', 'autonomo'));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;