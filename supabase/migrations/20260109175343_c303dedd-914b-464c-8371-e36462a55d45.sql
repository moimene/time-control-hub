-- Añadir campos de ubicación geográfica a empleados
ALTER TABLE public.employees 
ADD COLUMN IF NOT EXISTS autonomous_community TEXT,
ADD COLUMN IF NOT EXISTS locality TEXT;

-- Comentarios para documentar los campos
COMMENT ON COLUMN public.employees.autonomous_community IS 'Código de comunidad autónoma (AND, CAT, MAD, etc.) para aplicar festivos autonómicos';
COMMENT ON COLUMN public.employees.locality IS 'Localidad/municipio del empleado para aplicar festivos locales';