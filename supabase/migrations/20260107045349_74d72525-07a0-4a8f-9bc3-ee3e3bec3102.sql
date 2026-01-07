-- =====================================================
-- FASE 2.5b: Función helper para días laborables (corregida)
-- =====================================================

CREATE OR REPLACE FUNCTION calculate_working_days(
  p_company_id UUID,
  p_center_id UUID,
  p_start_date DATE,
  p_end_date DATE,
  p_weekend_days INTEGER[] DEFAULT ARRAY[0, 6]
)
RETURNS INTEGER AS $$
DECLARE
  v_working_days INTEGER := 0;
  v_check_date DATE := p_start_date;
  v_day_of_week INTEGER;
  v_is_holiday BOOLEAN;
BEGIN
  WHILE v_check_date <= p_end_date LOOP
    v_day_of_week := EXTRACT(DOW FROM v_check_date)::INTEGER;
    
    IF NOT (v_day_of_week = ANY(p_weekend_days)) THEN
      SELECT EXISTS(
        SELECT 1 FROM calendar_holidays ch
        WHERE ch.company_id = p_company_id
          AND (ch.center_id = p_center_id OR ch.center_id IS NULL)
          AND ch.holiday_date = v_check_date
      ) INTO v_is_holiday;
      
      IF NOT v_is_holiday THEN
        v_working_days := v_working_days + 1;
      END IF;
    END IF;
    
    v_check_date := v_check_date + 1;
  END LOOP;
  
  RETURN v_working_days;
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public;