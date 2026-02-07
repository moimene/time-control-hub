-- Fix audit trigger integrity: audit_log.actor_id references auth.users(id),
-- but older triggers wrote employees.id into actor_id causing FK violations.

ALTER TABLE public.audit_log
ADD COLUMN IF NOT EXISTS actor_employee_id uuid REFERENCES public.employees(id) ON DELETE SET NULL;

CREATE OR REPLACE FUNCTION public.log_correction_request_changes()
RETURNS TRIGGER AS $$
DECLARE
  actor_user_id uuid;
BEGIN
  actor_user_id := auth.uid();

  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.audit_log (company_id, actor_type, actor_id, actor_employee_id, action, entity_type, entity_id, new_values)
    VALUES (NEW.company_id, 'employee', actor_user_id, NEW.employee_id, 'create', 'correction_request', NEW.id, to_jsonb(NEW));
  ELSIF TG_OP = 'UPDATE' THEN
    INSERT INTO public.audit_log (company_id, actor_type, actor_id, action, entity_type, entity_id, old_values, new_values)
    VALUES (
      NEW.company_id,
      CASE WHEN NEW.reviewed_by IS NOT NULL THEN 'admin' ELSE 'system' END,
      COALESCE(NEW.reviewed_by, actor_user_id),
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

CREATE OR REPLACE FUNCTION public.log_employee_changes()
RETURNS TRIGGER AS $$
DECLARE
  actor_user_id uuid;
BEGIN
  actor_user_id := auth.uid();

  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.audit_log (company_id, actor_type, actor_id, action, entity_type, entity_id, new_values)
    VALUES (NEW.company_id, 'admin', actor_user_id, 'create', 'employee', NEW.id, to_jsonb(NEW));
  ELSIF TG_OP = 'UPDATE' THEN
    INSERT INTO public.audit_log (company_id, actor_type, actor_id, action, entity_type, entity_id, old_values, new_values)
    VALUES (NEW.company_id, 'admin', actor_user_id, 'update', 'employee', NEW.id, to_jsonb(OLD), to_jsonb(NEW));
  ELSIF TG_OP = 'DELETE' THEN
    INSERT INTO public.audit_log (company_id, actor_type, actor_id, action, entity_type, entity_id, old_values)
    VALUES (OLD.company_id, 'admin', actor_user_id, 'delete', 'employee', OLD.id, to_jsonb(OLD));
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

