-- 1. Drop and recreate the holiday_type constraint to include 'nacional'
ALTER TABLE public.calendar_holidays DROP CONSTRAINT IF EXISTS valid_holiday_type;
ALTER TABLE public.calendar_holidays 
ADD CONSTRAINT valid_holiday_type 
CHECK (holiday_type IN ('estatal', 'autonomico', 'local', 'empresa', 'nacional'));

-- 2. Create index for faster holiday lookups
CREATE INDEX IF NOT EXISTS idx_calendar_holidays_company_year 
ON public.calendar_holidays (company_id, holiday_date);

-- 3. Add trigger to auto-bootstrap company on creation
CREATE OR REPLACE FUNCTION public.trigger_company_bootstrap()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
  -- Seed default absence types
  PERFORM seed_default_absence_types(NEW.id);
  -- Seed default retention config  
  PERFORM seed_default_retention_config(NEW.id);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_company_created_bootstrap ON public.company;
CREATE TRIGGER on_company_created_bootstrap
  AFTER INSERT ON public.company
  FOR EACH ROW
  EXECUTE FUNCTION public.trigger_company_bootstrap();