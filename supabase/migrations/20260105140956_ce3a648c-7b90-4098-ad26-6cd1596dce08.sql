-- Phase 1.1: Add hash columns for chain integrity
ALTER TABLE public.time_events 
ADD COLUMN IF NOT EXISTS event_hash TEXT,
ADD COLUMN IF NOT EXISTS previous_hash TEXT;

-- Phase 1.2: Create immutability trigger to prevent UPDATE/DELETE on time_events
CREATE OR REPLACE FUNCTION public.prevent_time_events_modification()
RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION 'Los eventos de fichaje son inmutables y no pueden ser modificados o eliminados. Use el sistema de correcciones.';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER immutable_time_events
BEFORE UPDATE OR DELETE ON public.time_events
FOR EACH ROW EXECUTE FUNCTION public.prevent_time_events_modification();

-- Phase 1.3: Create trigger to auto-populate audit_log for correction_requests
CREATE OR REPLACE FUNCTION public.log_correction_request_changes()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.audit_log (actor_type, actor_id, action, entity_type, entity_id, new_values)
    VALUES ('employee', NEW.employee_id, 'create', 'correction_request', NEW.id, to_jsonb(NEW));
  ELSIF TG_OP = 'UPDATE' THEN
    INSERT INTO public.audit_log (actor_type, actor_id, action, entity_type, entity_id, old_values, new_values)
    VALUES (
      CASE WHEN NEW.reviewed_by IS NOT NULL THEN 'admin' ELSE 'system' END,
      COALESCE(NEW.reviewed_by, NEW.employee_id),
      CASE 
        WHEN NEW.status = 'approved' THEN 'approve'
        WHEN NEW.status = 'rejected' THEN 'reject'
        ELSE 'update'
      END,
      'correction_request',
      NEW.id,
      to_jsonb(OLD),
      to_jsonb(NEW)
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER audit_correction_requests
AFTER INSERT OR UPDATE ON public.correction_requests
FOR EACH ROW EXECUTE FUNCTION public.log_correction_request_changes();

-- Phase 1.3: Create trigger to auto-populate audit_log for employee changes
CREATE OR REPLACE FUNCTION public.log_employee_changes()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.audit_log (actor_type, action, entity_type, entity_id, new_values)
    VALUES ('admin', 'create', 'employee', NEW.id, to_jsonb(NEW));
  ELSIF TG_OP = 'UPDATE' THEN
    INSERT INTO public.audit_log (actor_type, action, entity_type, entity_id, old_values, new_values)
    VALUES ('admin', 'update', 'employee', NEW.id, to_jsonb(OLD), to_jsonb(NEW));
  ELSIF TG_OP = 'DELETE' THEN
    INSERT INTO public.audit_log (actor_type, action, entity_type, entity_id, old_values)
    VALUES ('admin', 'delete', 'employee', OLD.id, to_jsonb(OLD));
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER audit_employees
AFTER INSERT OR UPDATE OR DELETE ON public.employees
FOR EACH ROW EXECUTE FUNCTION public.log_employee_changes();

-- Add index for hash chain verification
CREATE INDEX IF NOT EXISTS idx_time_events_hash ON public.time_events (event_hash);
CREATE INDEX IF NOT EXISTS idx_time_events_employee_timestamp ON public.time_events (employee_id, timestamp DESC);