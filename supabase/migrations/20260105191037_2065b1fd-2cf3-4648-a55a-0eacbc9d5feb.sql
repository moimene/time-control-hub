-- Add employee_code_prefix column to company table
ALTER TABLE public.company 
ADD COLUMN employee_code_prefix VARCHAR(10) NOT NULL DEFAULT 'EMP';

-- Update existing companies with their correct prefixes based on current employee codes
UPDATE public.company 
SET employee_code_prefix = 'BAR' 
WHERE name = 'Bar El Rincón';

UPDATE public.company 
SET employee_code_prefix = 'DEN' 
WHERE name = 'Clínica Dental Sonrisas';

UPDATE public.company 
SET employee_code_prefix = 'FIS' 
WHERE name = 'Fisioterapia Wellness';

UPDATE public.company 
SET employee_code_prefix = 'ZAP' 
WHERE name = 'Zapatería López';