-- Desactivar trigger para inserción de datos de prueba
ALTER TABLE time_events DISABLE TRIGGER immutable_time_events;

-- Insertar fichajes coherentes para los últimos 30 días laborables
-- Solo empleados activos principales (BAR001-003, ZAP001-002, DEN001-002, FIS001-002)
-- Cada día: una entrada ~9:00 y una salida ~18:00

DO $$
DECLARE
  d DATE;
  emp RECORD;
  entry_time TIMESTAMP WITH TIME ZONE;
  exit_time TIMESTAMP WITH TIME ZONE;
  entry_minutes INT;
  exit_minutes INT;
  prev_hash TEXT := NULL;
  event_data TEXT;
  new_hash TEXT;
BEGIN
  -- Iterar últimos 30 días
  FOR d IN SELECT generate_series(CURRENT_DATE - INTERVAL '30 days', CURRENT_DATE - INTERVAL '1 day', '1 day')::DATE LOOP
    -- Solo días laborables (lunes a viernes)
    IF EXTRACT(DOW FROM d) BETWEEN 1 AND 5 THEN
      -- Iterar empleados principales de cada empresa
      FOR emp IN 
        SELECT e.id as employee_id, e.company_id, t.id as terminal_id
        FROM employees e
        LEFT JOIN terminals t ON t.company_id = e.company_id
        WHERE e.employee_code IN ('BAR001', 'BAR002', 'BAR003', 'ZAP001', 'ZAP002', 'DEN001', 'DEN002', 'FIS001', 'FIS002')
          AND e.status = 'active'
        GROUP BY e.id, e.company_id, t.id
      LOOP
        -- Generar hora de entrada con varianza (8:45-9:15)
        entry_minutes := 8 * 60 + 45 + floor(random() * 30)::INT;
        entry_time := (d + (entry_minutes || ' minutes')::INTERVAL) AT TIME ZONE 'Europe/Madrid';
        
        -- Generar hora de salida con varianza (17:45-18:15)
        exit_minutes := 17 * 60 + 45 + floor(random() * 30)::INT;
        exit_time := (d + (exit_minutes || ' minutes')::INTERVAL) AT TIME ZONE 'Europe/Madrid';
        
        -- Calcular hash para entrada
        event_data := emp.employee_id::TEXT || 'entry' || entry_time::TEXT;
        new_hash := encode(sha256(event_data::BYTEA), 'hex');
        
        -- Insertar ENTRADA
        INSERT INTO time_events (
          employee_id, company_id, terminal_id, event_type, event_source,
          timestamp, local_timestamp, timezone, event_hash, previous_hash
        ) VALUES (
          emp.employee_id, emp.company_id, emp.terminal_id, 'entry', 'pin',
          entry_time, entry_time, 'Europe/Madrid', new_hash, prev_hash
        );
        
        prev_hash := new_hash;
        
        -- Calcular hash para salida
        event_data := emp.employee_id::TEXT || 'exit' || exit_time::TEXT;
        new_hash := encode(sha256(event_data::BYTEA), 'hex');
        
        -- Insertar SALIDA
        INSERT INTO time_events (
          employee_id, company_id, terminal_id, event_type, event_source,
          timestamp, local_timestamp, timezone, event_hash, previous_hash
        ) VALUES (
          emp.employee_id, emp.company_id, emp.terminal_id, 'exit', 'pin',
          exit_time, exit_time, 'Europe/Madrid', new_hash, prev_hash
        );
        
        prev_hash := new_hash;
      END LOOP;
    END IF;
  END LOOP;
END $$;

-- Reactivar trigger
ALTER TABLE time_events ENABLE TRIGGER immutable_time_events;