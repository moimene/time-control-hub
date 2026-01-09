-- Tabla global de festivos nacionales y autonómicos (gestionada por super admin)
CREATE TABLE public.national_holidays (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  year INTEGER NOT NULL,
  holiday_date DATE NOT NULL,
  name TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('nacional', 'autonomico')),
  region TEXT, -- NULL = nacional, código CCAA para autonómicos
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Índice único para evitar duplicados (maneja NULL en region)
CREATE UNIQUE INDEX idx_national_holidays_unique 
ON public.national_holidays(holiday_date, COALESCE(region, '__NATIONAL__'));

-- Índices para consultas frecuentes
CREATE INDEX idx_national_holidays_year ON public.national_holidays(year);
CREATE INDEX idx_national_holidays_type ON public.national_holidays(type);
CREATE INDEX idx_national_holidays_region ON public.national_holidays(region) WHERE region IS NOT NULL;

-- RLS: Solo super_admin puede gestionar
ALTER TABLE public.national_holidays ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Super admins can manage national holidays"
ON public.national_holidays
FOR ALL
USING (public.is_super_admin(auth.uid()))
WITH CHECK (public.is_super_admin(auth.uid()));

CREATE POLICY "Anyone can view national holidays"
ON public.national_holidays
FOR SELECT
USING (true);

-- Comentarios
COMMENT ON TABLE public.national_holidays IS 'Festivos nacionales y autonómicos globales, gestionados por super admin';
COMMENT ON COLUMN public.national_holidays.region IS 'NULL para nacionales, código CCAA (AN, AR, AS, etc.) para autonómicos';