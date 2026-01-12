-- Ampliar tabla national_holidays para soportar festivos municipales
ALTER TABLE national_holidays 
  ADD COLUMN IF NOT EXISTS level TEXT DEFAULT 'national',
  ADD COLUMN IF NOT EXISTS province TEXT,
  ADD COLUMN IF NOT EXISTS municipality TEXT,
  ADD COLUMN IF NOT EXISTS island TEXT,
  ADD COLUMN IF NOT EXISTS source TEXT;

-- Actualizar registros existentes según su type
UPDATE national_holidays SET level = 'national' WHERE type = 'nacional' AND level IS NULL;
UPDATE national_holidays SET level = 'autonomous' WHERE type = 'autonomico' AND level IS NULL;

-- Índices para búsquedas eficientes
CREATE INDEX IF NOT EXISTS idx_national_holidays_level ON national_holidays(level);
CREATE INDEX IF NOT EXISTS idx_national_holidays_municipality ON national_holidays(municipality);
CREATE INDEX IF NOT EXISTS idx_national_holidays_province ON national_holidays(province);
CREATE INDEX IF NOT EXISTS idx_national_holidays_year_level ON national_holidays(year, level);