-- Extend absence_types table with comprehensive Spanish legal parametrization
ALTER TABLE public.absence_types
ADD COLUMN IF NOT EXISTS absence_category TEXT NOT NULL DEFAULT 'permiso_retribuido',
ADD COLUMN IF NOT EXISTS compute_on TEXT NOT NULL DEFAULT 'dias_laborables',
ADD COLUMN IF NOT EXISTS duration_value NUMERIC DEFAULT NULL,
ADD COLUMN IF NOT EXISTS duration_unit TEXT DEFAULT 'days',
ADD COLUMN IF NOT EXISTS duration_is_range BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS extra_travel_days INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS travel_threshold_km INTEGER DEFAULT 200,
ADD COLUMN IF NOT EXISTS cap_per_year_value NUMERIC DEFAULT NULL,
ADD COLUMN IF NOT EXISTS cap_per_year_unit TEXT DEFAULT 'days',
ADD COLUMN IF NOT EXISTS counts_as_work BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS blocks_clocking BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS approval_flow TEXT DEFAULT 'manager',
ADD COLUMN IF NOT EXISTS sla_hours INTEGER DEFAULT 48,
ADD COLUMN IF NOT EXISTS legal_origin TEXT DEFAULT 'ley',
ADD COLUMN IF NOT EXISTS alt_mode TEXT DEFAULT NULL,
ADD COLUMN IF NOT EXISTS alt_mode_description TEXT DEFAULT NULL,
ADD COLUMN IF NOT EXISTS effective_from DATE DEFAULT NULL,
ADD COLUMN IF NOT EXISTS effective_to DATE DEFAULT NULL,
ADD COLUMN IF NOT EXISTS incompatible_with JSONB DEFAULT '[]'::jsonb,
ADD COLUMN IF NOT EXISTS half_day_allowed BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS justification_types JSONB DEFAULT '[]'::jsonb,
ADD COLUMN IF NOT EXISTS notes TEXT DEFAULT NULL,
ADD COLUMN IF NOT EXISTS convenio_reference TEXT DEFAULT NULL;

-- Add comment for documentation
COMMENT ON COLUMN public.absence_types.absence_category IS 'permiso_retribuido, permiso_no_retribuido, vacaciones, suspension, ajuste_jornada, representacion, fuerza_mayor, otros';
COMMENT ON COLUMN public.absence_types.compute_on IS 'dias_naturales, dias_laborables, horas';
COMMENT ON COLUMN public.absence_types.legal_origin IS 'ley, convenio, empresa';
COMMENT ON COLUMN public.absence_types.approval_flow IS 'auto, manager, admin, multi_level';

-- Create table for absence calendar blocks (team unavailability)
CREATE TABLE IF NOT EXISTS public.absence_calendar_blocks (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID NOT NULL REFERENCES public.company(id) ON DELETE CASCADE,
  department TEXT DEFAULT NULL,
  center_id UUID DEFAULT NULL,
  block_date DATE NOT NULL,
  block_reason TEXT NOT NULL,
  min_staff_required INTEGER DEFAULT 1,
  created_by UUID DEFAULT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.absence_calendar_blocks ENABLE ROW LEVEL SECURITY;

-- RLS policies for absence_calendar_blocks
CREATE POLICY "Admins can manage calendar blocks"
  ON public.absence_calendar_blocks
  FOR ALL
  USING (is_admin_or_above(auth.uid()) AND user_belongs_to_company(auth.uid(), company_id));

CREATE POLICY "Company members can view calendar blocks"
  ON public.absence_calendar_blocks
  FOR SELECT
  USING (user_belongs_to_company(auth.uid(), company_id));

-- Seed default Spanish absence types for companies without them
-- This will be done via edge function to avoid duplication

-- Create function to seed default absence types for a company
CREATE OR REPLACE FUNCTION public.seed_default_absence_types(p_company_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Only seed if company has no absence types
  IF EXISTS (SELECT 1 FROM absence_types WHERE company_id = p_company_id LIMIT 1) THEN
    RETURN;
  END IF;

  -- Insert default Spanish absence types
  INSERT INTO absence_types (
    company_id, code, name, description, absence_category, category, color,
    is_paid, requires_justification, requires_approval, compute_on,
    duration_value, duration_unit, extra_travel_days, travel_threshold_km,
    max_days_per_year, advance_notice_days, counts_as_work, blocks_clocking,
    approval_flow, sla_hours, legal_origin, half_day_allowed, justification_types
  ) VALUES
  -- Vacaciones
  (p_company_id, 'VACACIONES', 'Vacaciones anuales', 'Vacaciones según ET y convenio', 'vacaciones', 'vacation', '#10B981',
   true, false, true, 'dias_laborables', 22, 'days', 0, 0, 22, 15, false, true, 'manager', 72, 'ley', true, '[]'::jsonb),
  
  -- Permisos retribuidos
  (p_company_id, 'MATRIMONIO', 'Matrimonio o registro de pareja', '15 días naturales por matrimonio o registro de pareja de hecho', 'permiso_retribuido', 'leave', '#8B5CF6',
   true, true, true, 'dias_naturales', 15, 'days', 0, 0, NULL, 15, false, true, 'manager', 48, 'ley', false, '["certificado_matrimonio", "certificado_registro"]'::jsonb),
  
  (p_company_id, 'FALLECIMIENTO_1GRADO', 'Fallecimiento familiar 1º grado', 'Fallecimiento de cónyuge, padres o hijos', 'permiso_retribuido', 'leave', '#6B7280',
   true, true, true, 'dias_naturales', 2, 'days', 2, 200, NULL, 0, false, true, 'auto', 24, 'ley', false, '["certificado_defuncion", "libro_familia"]'::jsonb),
  
  (p_company_id, 'FALLECIMIENTO_2GRADO', 'Fallecimiento familiar 2º grado', 'Fallecimiento de hermanos, abuelos, nietos, suegros', 'permiso_retribuido', 'leave', '#6B7280',
   true, true, true, 'dias_naturales', 2, 'days', 2, 200, NULL, 0, false, true, 'auto', 24, 'ley', false, '["certificado_defuncion", "libro_familia"]'::jsonb),
  
  (p_company_id, 'HOSPITALIZACION_1GRADO', 'Hospitalización familiar 1º grado', 'Accidente, enfermedad grave, hospitalización o intervención sin hospitalización con reposo de familiar 1º grado', 'permiso_retribuido', 'leave', '#F59E0B',
   true, true, true, 'dias_naturales', 2, 'days', 2, 200, NULL, 0, false, true, 'manager', 24, 'ley', false, '["informe_medico", "justificante_hospitalizacion"]'::jsonb),
  
  (p_company_id, 'HOSPITALIZACION_2GRADO', 'Hospitalización familiar 2º grado', 'Accidente, enfermedad grave, hospitalización de familiar 2º grado', 'permiso_retribuido', 'leave', '#F59E0B',
   true, true, true, 'dias_naturales', 2, 'days', 2, 200, NULL, 0, false, true, 'manager', 24, 'ley', false, '["informe_medico", "justificante_hospitalizacion"]'::jsonb),
  
  (p_company_id, 'MUDANZA', 'Traslado de domicilio', '1 día por traslado de domicilio habitual', 'permiso_retribuido', 'leave', '#3B82F6',
   true, true, true, 'dias_naturales', 1, 'days', 0, 0, 1, 7, false, true, 'manager', 48, 'ley', false, '["cambio_padron", "contrato_alquiler"]'::jsonb),
  
  (p_company_id, 'DEBER_PUBLICO', 'Deber inexcusable público', 'Mesa electoral, citación judicial, votaciones, etc.', 'permiso_retribuido', 'leave', '#0EA5E9',
   true, true, true, 'horas', NULL, 'hours', 0, 0, NULL, 0, false, false, 'auto', 24, 'ley', false, '["citacion_oficial", "certificado_asistencia"]'::jsonb),
  
  (p_company_id, 'EXAMEN_PRENATAL', 'Exámenes prenatales', 'Tiempo indispensable para exámenes prenatales y técnicas de preparación al parto', 'permiso_retribuido', 'leave', '#EC4899',
   true, true, false, 'horas', NULL, 'hours', 0, 0, NULL, 1, true, false, 'auto', 24, 'ley', false, '["cita_medica"]'::jsonb),
  
  (p_company_id, 'LACTANCIA', 'Permiso de lactancia', '1 hora diaria o acumulable hasta 14 días', 'permiso_retribuido', 'leave', '#EC4899',
   true, true, true, 'horas', 1, 'hours', 0, 0, NULL, 15, true, false, 'manager', 48, 'ley', false, '["libro_familia", "certificado_nacimiento"]'::jsonb),
  
  (p_company_id, 'CONSULTA_MEDICA', 'Consulta médica propia', 'Tiempo para asistencia médica propia (según convenio)', 'permiso_retribuido', 'leave', '#14B8A6',
   true, true, false, 'horas', NULL, 'hours', 0, 0, 16, 1, false, false, 'manager', 24, 'convenio', false, '["cita_medica", "justificante_asistencia"]'::jsonb),
  
  (p_company_id, 'ACOMPANAMIENTO_MEDICO', 'Acompañamiento médico familiar', 'Acompañamiento a consulta de menor o familiar dependiente (según convenio)', 'permiso_retribuido', 'leave', '#14B8A6',
   true, true, true, 'horas', NULL, 'hours', 0, 0, 16, 1, false, false, 'manager', 24, 'convenio', false, '["cita_medica", "justificante_asistencia"]'::jsonb),
  
  -- Suspensiones
  (p_company_id, 'IT_COMUN', 'Incapacidad temporal - Enfermedad común', 'Baja médica por enfermedad común o accidente no laboral', 'suspension', 'sick', '#EF4444',
   false, true, false, 'dias_naturales', NULL, 'days', 0, 0, NULL, 0, false, true, 'auto', 24, 'ley', false, '["parte_baja", "parte_confirmacion", "parte_alta"]'::jsonb),
  
  (p_company_id, 'IT_PROFESIONAL', 'Incapacidad temporal - Accidente laboral', 'Baja médica por accidente de trabajo o enfermedad profesional', 'suspension', 'sick', '#EF4444',
   false, true, false, 'dias_naturales', NULL, 'days', 0, 0, NULL, 0, false, true, 'auto', 24, 'ley', false, '["parte_baja", "parte_accidente"]'::jsonb),
  
  (p_company_id, 'NACIMIENTO_CUIDADO', 'Nacimiento y cuidado de menor', 'Permiso por nacimiento y cuidado de menor (16 semanas)', 'suspension', 'parental', '#D946EF',
   false, true, true, 'dias_naturales', 112, 'days', 0, 0, NULL, 15, false, true, 'admin', 72, 'ley', false, '["certificado_nacimiento", "resolucion_inss"]'::jsonb),
  
  (p_company_id, 'RIESGO_EMBARAZO', 'Riesgo durante embarazo', 'Suspensión por riesgo durante el embarazo', 'suspension', 'parental', '#D946EF',
   false, true, false, 'dias_naturales', NULL, 'days', 0, 0, NULL, 0, false, true, 'auto', 24, 'ley', false, '["informe_mutua", "resolucion_inss"]'::jsonb),
  
  (p_company_id, 'ADOPCION', 'Adopción o acogimiento', 'Permiso por adopción, guarda o acogimiento', 'suspension', 'parental', '#D946EF',
   false, true, true, 'dias_naturales', 112, 'days', 0, 0, NULL, 15, false, true, 'admin', 72, 'ley', false, '["resolucion_adopcion", "resolucion_inss"]'::jsonb),
  
  -- Representación
  (p_company_id, 'CREDITO_SINDICAL', 'Crédito horario sindical', 'Horas de representación legal de trabajadores', 'representacion', 'leave', '#6366F1',
   true, false, false, 'horas', NULL, 'hours', 0, 0, 20, 0, false, false, 'auto', 24, 'ley', false, '[]'::jsonb),
  
  -- Permisos no retribuidos
  (p_company_id, 'ASUNTOS_PROPIOS', 'Asuntos propios', 'Horas/días para asuntos personales sin retribución', 'permiso_no_retribuido', 'personal', '#9CA3AF',
   false, false, true, 'horas', NULL, 'hours', 0, 0, 16, 3, false, false, 'manager', 48, 'empresa', true, '[]'::jsonb),
  
  (p_company_id, 'PERMISO_SIN_SUELDO', 'Permiso sin sueldo', 'Permiso especial no retribuido', 'permiso_no_retribuido', 'personal', '#9CA3AF',
   false, false, true, 'dias_laborables', NULL, 'days', 0, 0, NULL, 7, false, true, 'admin', 72, 'empresa', false, '[]'::jsonb),
  
  -- Fuerza mayor
  (p_company_id, 'FUERZA_MAYOR', 'Fuerza mayor familiar', 'Ausencia por razones familiares urgentes imprevistas', 'fuerza_mayor', 'leave', '#F97316',
   true, true, false, 'horas', NULL, 'hours', 0, 0, 8, 0, false, false, 'auto', 24, 'ley', false, '["acreditacion_hecho"]'::jsonb),
  
  -- Otros
  (p_company_id, 'FORMACION', 'Formación vinculada al puesto', 'Horas de formación profesional', 'otros', 'training', '#0D9488',
   true, false, true, 'horas', NULL, 'hours', 0, 0, 20, 3, true, false, 'manager', 48, 'empresa', false, '[]'::jsonb);
  
END;
$$;

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_absence_types_company_category ON public.absence_types(company_id, absence_category);
CREATE INDEX IF NOT EXISTS idx_absence_requests_status ON public.absence_requests(status);
CREATE INDEX IF NOT EXISTS idx_absence_requests_dates ON public.absence_requests(start_date, end_date);
CREATE INDEX IF NOT EXISTS idx_absence_calendar_blocks_date ON public.absence_calendar_blocks(company_id, block_date);