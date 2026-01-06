-- Desactivar temporalmente el trigger que impide modificar time_events
ALTER TABLE time_events DISABLE TRIGGER immutable_time_events;

-- Borrar todos los time_events de empleados de prueba
DELETE FROM time_events 
WHERE employee_id IN (
  SELECT id FROM employees 
  WHERE employee_code LIKE 'BAR%' 
     OR employee_code LIKE 'ZAP%' 
     OR employee_code LIKE 'DEN%' 
     OR employee_code LIKE 'FIS%'
);

-- Reactivar el trigger para mantener la protección de datos
ALTER TABLE time_events ENABLE TRIGGER immutable_time_events;