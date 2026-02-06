-- Supabase production migration bundle
-- Project ref: ouxzjfqqgxlvxhjyihum
-- Generated at (UTC): 20260206T210532Z
-- Source: /tmp/time-control-hub/supabase/migrations/*.sql
--
-- How to apply (recommended): supabase db push (requires DB password)
-- Fallback: paste into Supabase Dashboard SQL Editor and run in a maintenance window.


-- =========================================
-- BEGIN MIGRATION: 20260105102432_a52d1bc0-84f7-4a94-a334-b9ed167d6511.sql
-- =========================================

-- Enums para roles y estados
CREATE TYPE public.app_role AS ENUM ('super_admin', 'admin', 'responsible', 'employee');
CREATE TYPE public.employee_status AS ENUM ('active', 'inactive', 'suspended', 'on_leave');
CREATE TYPE public.event_type AS ENUM ('entry', 'exit');
CREATE TYPE public.event_source AS ENUM ('qr', 'pin', 'manual');
CREATE TYPE public.correction_status AS ENUM ('pending', 'approved', 'rejected');
CREATE TYPE public.terminal_status AS ENUM ('pending', 'active', 'inactive');

-- Tabla de empresa (configuración)
CREATE TABLE public.company (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  cif TEXT,
  address TEXT,
  city TEXT,
  postal_code TEXT,
  timezone TEXT NOT NULL DEFAULT 'Europe/Madrid',
  settings JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Tabla de roles de usuario (separada como indica la instrucción de seguridad)
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role app_role NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);

-- Tabla de empleados
CREATE TABLE public.employees (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  employee_code TEXT NOT NULL UNIQUE,
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  department TEXT,
  position TEXT,
  status employee_status NOT NULL DEFAULT 'active',
  hire_date DATE,
  termination_date DATE,
  pin_hash TEXT,
  pin_salt TEXT,
  pin_failed_attempts INTEGER DEFAULT 0,
  pin_locked_until TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Tabla de códigos QR de empleados
CREATE TABLE public.employee_qr (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id UUID NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL,
  version INTEGER NOT NULL DEFAULT 1,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  revoked_at TIMESTAMPTZ,
  UNIQUE (employee_id, version)
);

-- Tabla de terminales (kioscos)
CREATE TABLE public.terminals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  location TEXT,
  pairing_code TEXT,
  pairing_expires_at TIMESTAMPTZ,
  auth_token_hash TEXT,
  status terminal_status NOT NULL DEFAULT 'pending',
  last_seen_at TIMESTAMPTZ,
  ip_address INET,
  user_agent TEXT,
  settings JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Tabla de eventos de fichaje (inmutable)
CREATE TABLE public.time_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id UUID NOT NULL REFERENCES public.employees(id),
  terminal_id UUID REFERENCES public.terminals(id),
  event_type event_type NOT NULL,
  event_source event_source NOT NULL,
  timestamp TIMESTAMPTZ NOT NULL,
  local_timestamp TIMESTAMPTZ NOT NULL,
  timezone TEXT NOT NULL DEFAULT 'Europe/Madrid',
  offline_uuid UUID,
  synced_at TIMESTAMPTZ,
  qr_version INTEGER,
  ip_address INET,
  user_agent TEXT,
  raw_payload JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Tabla de solicitudes de corrección
CREATE TABLE public.correction_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id UUID NOT NULL REFERENCES public.employees(id),
  original_event_id UUID REFERENCES public.time_events(id),
  requested_event_type event_type,
  requested_timestamp TIMESTAMPTZ,
  reason TEXT NOT NULL,
  status correction_status NOT NULL DEFAULT 'pending',
  reviewed_by UUID REFERENCES auth.users(id),
  reviewed_at TIMESTAMPTZ,
  review_notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Tabla de eventos corregidos (vinculados a solicitudes aprobadas)
CREATE TABLE public.corrected_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  correction_request_id UUID NOT NULL REFERENCES public.correction_requests(id),
  employee_id UUID NOT NULL REFERENCES public.employees(id),
  event_type event_type NOT NULL,
  timestamp TIMESTAMPTZ NOT NULL,
  local_timestamp TIMESTAMPTZ NOT NULL,
  timezone TEXT NOT NULL DEFAULT 'Europe/Madrid',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Tabla de log de auditoría (inmutable)
CREATE TABLE public.audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id UUID REFERENCES auth.users(id),
  actor_type TEXT NOT NULL,
  action TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id UUID,
  old_values JSONB,
  new_values JSONB,
  ip_address INET,
  user_agent TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Tabla para hash-chain diario (preparación para evidencias)
CREATE TABLE public.daily_roots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  date DATE NOT NULL UNIQUE,
  root_hash TEXT NOT NULL,
  event_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Índices para rendimiento
CREATE INDEX idx_employees_status ON public.employees(status);
CREATE INDEX idx_employees_user_id ON public.employees(user_id);
CREATE INDEX idx_employee_qr_active ON public.employee_qr(employee_id, is_active) WHERE is_active = true;
CREATE INDEX idx_time_events_employee ON public.time_events(employee_id, timestamp DESC);
CREATE INDEX idx_time_events_terminal ON public.time_events(terminal_id, timestamp DESC);
CREATE INDEX idx_time_events_timestamp ON public.time_events(timestamp);
CREATE INDEX idx_correction_requests_status ON public.correction_requests(status, employee_id);
CREATE INDEX idx_audit_log_entity ON public.audit_log(entity_type, entity_id, created_at DESC);
CREATE INDEX idx_terminals_status ON public.terminals(status);

-- Habilitar RLS en todas las tablas
ALTER TABLE public.company ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.employees ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.employee_qr ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.terminals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.time_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.correction_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.corrected_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.daily_roots ENABLE ROW LEVEL SECURITY;

-- Función para verificar roles
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = _role
  )
$$;

-- Función para verificar si es admin o superior
CREATE OR REPLACE FUNCTION public.is_admin_or_above(_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role IN ('super_admin', 'admin')
  )
$$;

-- Función para obtener el employee_id de un user_id
CREATE OR REPLACE FUNCTION public.get_employee_id(_user_id UUID)
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT id FROM public.employees WHERE user_id = _user_id LIMIT 1
$$;

-- Función para actualizar updated_at
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Triggers para updated_at
CREATE TRIGGER update_company_updated_at
  BEFORE UPDATE ON public.company
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_employees_updated_at
  BEFORE UPDATE ON public.employees
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_terminals_updated_at
  BEFORE UPDATE ON public.terminals
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_correction_requests_updated_at
  BEFORE UPDATE ON public.correction_requests
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Políticas RLS para company
CREATE POLICY "Admins can manage company"
  ON public.company FOR ALL
  TO authenticated
  USING (public.is_admin_or_above(auth.uid()));

CREATE POLICY "Authenticated users can view company"
  ON public.company FOR SELECT
  TO authenticated
  USING (true);

-- Políticas RLS para user_roles
CREATE POLICY "Admins can manage roles"
  ON public.user_roles FOR ALL
  TO authenticated
  USING (public.is_admin_or_above(auth.uid()));

CREATE POLICY "Users can view own roles"
  ON public.user_roles FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

-- Políticas RLS para employees
CREATE POLICY "Admins can manage employees"
  ON public.employees FOR ALL
  TO authenticated
  USING (public.is_admin_or_above(auth.uid()));

CREATE POLICY "Responsibles can view employees"
  ON public.employees FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'responsible'));

CREATE POLICY "Employees can view own record"
  ON public.employees FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

-- Políticas RLS para employee_qr
CREATE POLICY "Admins can manage QR codes"
  ON public.employee_qr FOR ALL
  TO authenticated
  USING (public.is_admin_or_above(auth.uid()));

-- Políticas RLS para terminals
CREATE POLICY "Admins can manage terminals"
  ON public.terminals FOR ALL
  TO authenticated
  USING (public.is_admin_or_above(auth.uid()));

-- Políticas RLS para time_events
CREATE POLICY "Admins can view all events"
  ON public.time_events FOR SELECT
  TO authenticated
  USING (public.is_admin_or_above(auth.uid()));

CREATE POLICY "Responsibles can view all events"
  ON public.time_events FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'responsible'));

CREATE POLICY "Employees can view own events"
  ON public.time_events FOR SELECT
  TO authenticated
  USING (employee_id = public.get_employee_id(auth.uid()));

-- Políticas RLS para correction_requests
CREATE POLICY "Admins can manage correction requests"
  ON public.correction_requests FOR ALL
  TO authenticated
  USING (public.is_admin_or_above(auth.uid()));

CREATE POLICY "Responsibles can view and update correction requests"
  ON public.correction_requests FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'responsible'));

CREATE POLICY "Responsibles can update correction requests"
  ON public.correction_requests FOR UPDATE
  TO authenticated
  USING (public.has_role(auth.uid(), 'responsible'));

CREATE POLICY "Employees can view own correction requests"
  ON public.correction_requests FOR SELECT
  TO authenticated
  USING (employee_id = public.get_employee_id(auth.uid()));

CREATE POLICY "Employees can create own correction requests"
  ON public.correction_requests FOR INSERT
  TO authenticated
  WITH CHECK (employee_id = public.get_employee_id(auth.uid()));

-- Políticas RLS para corrected_events
CREATE POLICY "Admins can view corrected events"
  ON public.corrected_events FOR SELECT
  TO authenticated
  USING (public.is_admin_or_above(auth.uid()));

CREATE POLICY "Employees can view own corrected events"
  ON public.corrected_events FOR SELECT
  TO authenticated
  USING (employee_id = public.get_employee_id(auth.uid()));

-- Políticas RLS para audit_log (solo lectura para admins)
CREATE POLICY "Admins can view audit log"
  ON public.audit_log FOR SELECT
  TO authenticated
  USING (public.is_admin_or_above(auth.uid()));

-- Políticas RLS para daily_roots (solo lectura para admins)
CREATE POLICY "Admins can view daily roots"
  ON public.daily_roots FOR SELECT
  TO authenticated
  USING (public.is_admin_or_above(auth.uid()));
-- =========================================
-- END MIGRATION: 20260105102432_a52d1bc0-84f7-4a94-a334-b9ed167d6511.sql
-- =========================================


-- =========================================
-- BEGIN MIGRATION: 20260105104649_0770bb95-9501-4246-b1bd-645a63579c8f.sql
-- =========================================

-- Drop the restrictive policies and recreate as permissive
DROP POLICY IF EXISTS "Admins can view all events" ON public.time_events;
DROP POLICY IF EXISTS "Employees can view own events" ON public.time_events;
DROP POLICY IF EXISTS "Responsibles can view all events" ON public.time_events;

-- Recreate as PERMISSIVE policies (default behavior)
CREATE POLICY "Admins can view all events" 
ON public.time_events 
FOR SELECT 
TO authenticated
USING (is_admin_or_above(auth.uid()));

CREATE POLICY "Employees can view own events" 
ON public.time_events 
FOR SELECT 
TO authenticated
USING (employee_id = get_employee_id(auth.uid()));

CREATE POLICY "Responsibles can view all events" 
ON public.time_events 
FOR SELECT 
TO authenticated
USING (has_role(auth.uid(), 'responsible'));
-- =========================================
-- END MIGRATION: 20260105104649_0770bb95-9501-4246-b1bd-645a63579c8f.sql
-- =========================================


-- =========================================
-- BEGIN MIGRATION: 20260105140956_ce3a648c-7b90-4098-ad26-6cd1596dce08.sql
-- =========================================

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
-- =========================================
-- END MIGRATION: 20260105140956_ce3a648c-7b90-4098-ad26-6cd1596dce08.sql
-- =========================================


-- =========================================
-- BEGIN MIGRATION: 20260105142118_0e194d81-297b-4601-a4bc-ef255d659959.sql
-- =========================================

-- Enable required extensions for cron jobs
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;
-- =========================================
-- END MIGRATION: 20260105142118_0e194d81-297b-4601-a4bc-ef255d659959.sql
-- =========================================


-- =========================================
-- BEGIN MIGRATION: 20260105144029_771462ea-3171-463d-bf4c-359dfca873d6.sql
-- =========================================

-- Create enum for evidence type
CREATE TYPE public.evidence_type AS ENUM ('daily_timestamp', 'monthly_report');

-- Create enum for evidence status
CREATE TYPE public.evidence_status AS ENUM ('pending', 'processing', 'completed', 'failed');

-- Table to store Digital Trust Case Files (one per company, created once)
CREATE TABLE public.dt_case_files (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  external_id TEXT NOT NULL UNIQUE,
  company_id UUID REFERENCES public.company(id),
  name TEXT NOT NULL,
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Table to store Digital Trust Evidence Groups (one per month for organization)
CREATE TABLE public.dt_evidence_groups (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  external_id TEXT NOT NULL UNIQUE,
  case_file_id UUID NOT NULL REFERENCES public.dt_case_files(id),
  name TEXT NOT NULL,
  year_month TEXT NOT NULL, -- Format: YYYY-MM
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(case_file_id, year_month)
);

-- Table to store individual evidences (timestamps and sealed PDFs)
CREATE TABLE public.dt_evidences (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  evidence_group_id UUID NOT NULL REFERENCES public.dt_evidence_groups(id),
  external_id TEXT UNIQUE,
  evidence_type public.evidence_type NOT NULL,
  status public.evidence_status NOT NULL DEFAULT 'pending',
  -- For daily timestamps
  daily_root_id UUID REFERENCES public.daily_roots(id),
  -- For monthly PDF reports
  report_month TEXT, -- Format: YYYY-MM
  original_pdf_path TEXT,
  sealed_pdf_path TEXT,
  -- TSP/Signature data
  tsp_token TEXT,
  tsp_timestamp TIMESTAMP WITH TIME ZONE,
  signature_data JSONB,
  -- Error tracking
  error_message TEXT,
  retry_count INTEGER NOT NULL DEFAULT 0,
  -- Metadata
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  completed_at TIMESTAMP WITH TIME ZONE
);

-- Enable RLS
ALTER TABLE public.dt_case_files ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dt_evidence_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dt_evidences ENABLE ROW LEVEL SECURITY;

-- RLS policies - only admins can view
CREATE POLICY "Admins can view case files" ON public.dt_case_files
  FOR SELECT USING (is_admin_or_above(auth.uid()));

CREATE POLICY "Admins can view evidence groups" ON public.dt_evidence_groups
  FOR SELECT USING (is_admin_or_above(auth.uid()));

CREATE POLICY "Admins can view evidences" ON public.dt_evidences
  FOR SELECT USING (is_admin_or_above(auth.uid()));

-- Triggers for updated_at
CREATE TRIGGER update_dt_case_files_updated_at
  BEFORE UPDATE ON public.dt_case_files
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_dt_evidence_groups_updated_at
  BEFORE UPDATE ON public.dt_evidence_groups
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_dt_evidences_updated_at
  BEFORE UPDATE ON public.dt_evidences
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Create storage bucket for sealed PDFs
INSERT INTO storage.buckets (id, name, public) VALUES ('sealed-reports', 'sealed-reports', false);

-- Storage policies for sealed reports
CREATE POLICY "Admins can view sealed reports" ON storage.objects
  FOR SELECT USING (bucket_id = 'sealed-reports' AND is_admin_or_above(auth.uid()));

CREATE POLICY "Service role can manage sealed reports" ON storage.objects
  FOR ALL USING (bucket_id = 'sealed-reports' AND auth.role() = 'service_role');
-- =========================================
-- END MIGRATION: 20260105144029_771462ea-3171-463d-bf4c-359dfca873d6.sql
-- =========================================


-- =========================================
-- BEGIN MIGRATION: 20260105160520_d65a32fb-96f0-456c-b588-eb7721662b7c.sql
-- =========================================

-- Create user_company table first
CREATE TABLE public.user_company (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  company_id uuid NOT NULL REFERENCES public.company(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, company_id)
);

ALTER TABLE public.user_company ENABLE ROW LEVEL SECURITY;

-- Indexes
CREATE INDEX idx_user_company_user_id ON public.user_company(user_id);
CREATE INDEX idx_user_company_company_id ON public.user_company(company_id);
-- =========================================
-- END MIGRATION: 20260105160520_d65a32fb-96f0-456c-b588-eb7721662b7c.sql
-- =========================================


-- =========================================
-- BEGIN MIGRATION: 20260105160644_60eace80-fa67-44cd-acd4-804a9dc5729c.sql
-- =========================================

-- Add company_id columns to all tenant-scoped tables
ALTER TABLE public.employees ADD COLUMN IF NOT EXISTS company_id uuid REFERENCES public.company(id) ON DELETE CASCADE;
ALTER TABLE public.terminals ADD COLUMN IF NOT EXISTS company_id uuid REFERENCES public.company(id) ON DELETE CASCADE;
ALTER TABLE public.time_events ADD COLUMN IF NOT EXISTS company_id uuid REFERENCES public.company(id) ON DELETE CASCADE;
ALTER TABLE public.correction_requests ADD COLUMN IF NOT EXISTS company_id uuid REFERENCES public.company(id) ON DELETE CASCADE;
ALTER TABLE public.corrected_events ADD COLUMN IF NOT EXISTS company_id uuid REFERENCES public.company(id) ON DELETE CASCADE;
ALTER TABLE public.employee_qr ADD COLUMN IF NOT EXISTS company_id uuid REFERENCES public.company(id) ON DELETE CASCADE;
ALTER TABLE public.daily_roots ADD COLUMN IF NOT EXISTS company_id uuid REFERENCES public.company(id) ON DELETE CASCADE;
ALTER TABLE public.audit_log ADD COLUMN IF NOT EXISTS company_id uuid REFERENCES public.company(id) ON DELETE SET NULL;

-- Indexes
CREATE INDEX IF NOT EXISTS idx_employees_company_id ON public.employees(company_id);
CREATE INDEX IF NOT EXISTS idx_terminals_company_id ON public.terminals(company_id);
CREATE INDEX IF NOT EXISTS idx_time_events_company_id ON public.time_events(company_id);
CREATE INDEX IF NOT EXISTS idx_correction_requests_company_id ON public.correction_requests(company_id);
CREATE INDEX IF NOT EXISTS idx_corrected_events_company_id ON public.corrected_events(company_id);
CREATE INDEX IF NOT EXISTS idx_employee_qr_company_id ON public.employee_qr(company_id);
CREATE INDEX IF NOT EXISTS idx_daily_roots_company_id ON public.daily_roots(company_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_company_id ON public.audit_log(company_id);
-- =========================================
-- END MIGRATION: 20260105160644_60eace80-fa67-44cd-acd4-804a9dc5729c.sql
-- =========================================


-- =========================================
-- BEGIN MIGRATION: 20260105160733_e2a3e86d-b70f-419c-aab9-4a2366933dc5.sql
-- =========================================

-- =====================================================
-- HELPER FUNCTIONS
-- =====================================================

CREATE OR REPLACE FUNCTION public.get_user_company_id(_user_id uuid)
RETURNS uuid
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _company_id uuid;
BEGIN
  SELECT company_id INTO _company_id FROM public.employees WHERE user_id = _user_id LIMIT 1;
  IF _company_id IS NOT NULL THEN
    RETURN _company_id;
  END IF;
  SELECT company_id INTO _company_id FROM public.user_company WHERE user_id = _user_id LIMIT 1;
  RETURN _company_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.user_belongs_to_company(_user_id uuid, _company_id uuid)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.employees WHERE user_id = _user_id AND company_id = _company_id
  ) OR EXISTS (
    SELECT 1 FROM public.user_company WHERE user_id = _user_id AND company_id = _company_id
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.is_super_admin(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = 'super_admin'
  )
$$;

-- =====================================================
-- DROP OLD POLICIES (they're already dropped but safe to try)
-- =====================================================

DROP POLICY IF EXISTS "Admins can manage company" ON public.company;
DROP POLICY IF EXISTS "Authenticated users can view company" ON public.company;
DROP POLICY IF EXISTS "Admins can manage employees" ON public.employees;
DROP POLICY IF EXISTS "Employees can view own record" ON public.employees;
DROP POLICY IF EXISTS "Responsibles can view employees" ON public.employees;
DROP POLICY IF EXISTS "Admins can manage terminals" ON public.terminals;
DROP POLICY IF EXISTS "Admins can view all events" ON public.time_events;
DROP POLICY IF EXISTS "Employees can view own events" ON public.time_events;
DROP POLICY IF EXISTS "Responsibles can view all events" ON public.time_events;
DROP POLICY IF EXISTS "Admins can manage correction requests" ON public.correction_requests;
DROP POLICY IF EXISTS "Employees can create own correction requests" ON public.correction_requests;
DROP POLICY IF EXISTS "Employees can view own correction requests" ON public.correction_requests;
DROP POLICY IF EXISTS "Responsibles can update correction requests" ON public.correction_requests;
DROP POLICY IF EXISTS "Responsibles can view and update correction requests" ON public.correction_requests;
DROP POLICY IF EXISTS "Admins can view corrected events" ON public.corrected_events;
DROP POLICY IF EXISTS "Employees can view own corrected events" ON public.corrected_events;
DROP POLICY IF EXISTS "Admins can manage QR codes" ON public.employee_qr;
DROP POLICY IF EXISTS "Admins can view daily roots" ON public.daily_roots;
DROP POLICY IF EXISTS "Admins can view audit log" ON public.audit_log;
DROP POLICY IF EXISTS "Admins can manage roles" ON public.user_roles;
DROP POLICY IF EXISTS "Users can view own roles" ON public.user_roles;

-- =====================================================
-- NEW MULTI-TENANT RLS POLICIES
-- =====================================================

-- COMPANY
CREATE POLICY "mt_company_super_admin" ON public.company FOR ALL USING (is_super_admin(auth.uid()));
CREATE POLICY "mt_company_view_own" ON public.company FOR SELECT USING (user_belongs_to_company(auth.uid(), id));
CREATE POLICY "mt_company_update_own" ON public.company FOR UPDATE USING (user_belongs_to_company(auth.uid(), id) AND is_admin_or_above(auth.uid()));
CREATE POLICY "mt_company_insert" ON public.company FOR INSERT WITH CHECK (true);

-- USER_COMPANY
CREATE POLICY "mt_uc_super_admin" ON public.user_company FOR ALL USING (is_super_admin(auth.uid()));
CREATE POLICY "mt_uc_company_admin" ON public.user_company FOR ALL USING (user_belongs_to_company(auth.uid(), company_id) AND is_admin_or_above(auth.uid()));
CREATE POLICY "mt_uc_view_own" ON public.user_company FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "mt_uc_insert_own" ON public.user_company FOR INSERT WITH CHECK (user_id = auth.uid());

-- EMPLOYEES
CREATE POLICY "mt_emp_super_admin" ON public.employees FOR ALL USING (is_super_admin(auth.uid()));
CREATE POLICY "mt_emp_company_admin" ON public.employees FOR ALL USING (user_belongs_to_company(auth.uid(), company_id) AND is_admin_or_above(auth.uid()));
CREATE POLICY "mt_emp_responsible_view" ON public.employees FOR SELECT USING (user_belongs_to_company(auth.uid(), company_id) AND has_role(auth.uid(), 'responsible'));
CREATE POLICY "mt_emp_view_own" ON public.employees FOR SELECT USING (user_id = auth.uid());

-- TERMINALS
CREATE POLICY "mt_term_super_admin" ON public.terminals FOR ALL USING (is_super_admin(auth.uid()));
CREATE POLICY "mt_term_company_admin" ON public.terminals FOR ALL USING (user_belongs_to_company(auth.uid(), company_id) AND is_admin_or_above(auth.uid()));

-- TIME_EVENTS
CREATE POLICY "mt_te_super_admin" ON public.time_events FOR SELECT USING (is_super_admin(auth.uid()));
CREATE POLICY "mt_te_company_admin" ON public.time_events FOR SELECT USING (user_belongs_to_company(auth.uid(), company_id) AND is_admin_or_above(auth.uid()));
CREATE POLICY "mt_te_responsible" ON public.time_events FOR SELECT USING (user_belongs_to_company(auth.uid(), company_id) AND has_role(auth.uid(), 'responsible'));
CREATE POLICY "mt_te_employee_own" ON public.time_events FOR SELECT USING (employee_id = get_employee_id(auth.uid()));

-- CORRECTION_REQUESTS
CREATE POLICY "mt_cr_super_admin" ON public.correction_requests FOR ALL USING (is_super_admin(auth.uid()));
CREATE POLICY "mt_cr_company_admin" ON public.correction_requests FOR ALL USING (user_belongs_to_company(auth.uid(), company_id) AND is_admin_or_above(auth.uid()));
CREATE POLICY "mt_cr_responsible_view" ON public.correction_requests FOR SELECT USING (user_belongs_to_company(auth.uid(), company_id) AND has_role(auth.uid(), 'responsible'));
CREATE POLICY "mt_cr_responsible_update" ON public.correction_requests FOR UPDATE USING (user_belongs_to_company(auth.uid(), company_id) AND has_role(auth.uid(), 'responsible'));
CREATE POLICY "mt_cr_employee_view" ON public.correction_requests FOR SELECT USING (employee_id = get_employee_id(auth.uid()));
CREATE POLICY "mt_cr_employee_create" ON public.correction_requests FOR INSERT WITH CHECK (employee_id = get_employee_id(auth.uid()));

-- CORRECTED_EVENTS
CREATE POLICY "mt_ce_super_admin" ON public.corrected_events FOR SELECT USING (is_super_admin(auth.uid()));
CREATE POLICY "mt_ce_company_admin" ON public.corrected_events FOR SELECT USING (user_belongs_to_company(auth.uid(), company_id) AND is_admin_or_above(auth.uid()));
CREATE POLICY "mt_ce_employee_own" ON public.corrected_events FOR SELECT USING (employee_id = get_employee_id(auth.uid()));

-- EMPLOYEE_QR
CREATE POLICY "mt_qr_super_admin" ON public.employee_qr FOR ALL USING (is_super_admin(auth.uid()));
CREATE POLICY "mt_qr_company_admin" ON public.employee_qr FOR ALL USING (user_belongs_to_company(auth.uid(), company_id) AND is_admin_or_above(auth.uid()));

-- DAILY_ROOTS
CREATE POLICY "mt_dr_super_admin" ON public.daily_roots FOR SELECT USING (is_super_admin(auth.uid()));
CREATE POLICY "mt_dr_company_admin" ON public.daily_roots FOR SELECT USING (user_belongs_to_company(auth.uid(), company_id) AND is_admin_or_above(auth.uid()));

-- AUDIT_LOG
CREATE POLICY "mt_al_super_admin" ON public.audit_log FOR SELECT USING (is_super_admin(auth.uid()));
CREATE POLICY "mt_al_company_admin" ON public.audit_log FOR SELECT USING (user_belongs_to_company(auth.uid(), company_id) AND is_admin_or_above(auth.uid()));

-- USER_ROLES
CREATE POLICY "mt_ur_super_admin" ON public.user_roles FOR ALL USING (is_super_admin(auth.uid()));
CREATE POLICY "mt_ur_view_own" ON public.user_roles FOR SELECT USING (user_id = auth.uid());
-- =========================================
-- END MIGRATION: 20260105160733_e2a3e86d-b70f-419c-aab9-4a2366933dc5.sql
-- =========================================


-- =========================================
-- BEGIN MIGRATION: 20260105162437_9eae47ee-0463-4d21-9e74-073ef23cdfca.sql
-- =========================================

-- Create QTSP audit log table for tracking all QTSP operations
CREATE TABLE public.qtsp_audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid REFERENCES public.company(id) ON DELETE CASCADE,
  action text NOT NULL, -- 'timestamp', 'seal_pdf', 'retry', 'check_status', 'export_package'
  evidence_id uuid REFERENCES public.dt_evidences(id) ON DELETE SET NULL,
  request_payload jsonb,
  response_payload jsonb,
  status text NOT NULL, -- 'success', 'failed', 'pending'
  error_message text,
  duration_ms integer,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.qtsp_audit_log ENABLE ROW LEVEL SECURITY;

-- RLS policies for qtsp_audit_log
CREATE POLICY "mt_qtsp_al_company_admin" ON public.qtsp_audit_log
  FOR SELECT USING (
    user_belongs_to_company(auth.uid(), company_id) AND is_admin_or_above(auth.uid())
  );

CREATE POLICY "mt_qtsp_al_super_admin" ON public.qtsp_audit_log
  FOR SELECT USING (is_super_admin(auth.uid()));

-- Update RLS for dt_case_files to be company-scoped
DROP POLICY IF EXISTS "Admins can view case files" ON public.dt_case_files;
CREATE POLICY "mt_cf_company_admin" ON public.dt_case_files
  FOR SELECT USING (
    user_belongs_to_company(auth.uid(), company_id) AND is_admin_or_above(auth.uid())
  );
CREATE POLICY "mt_cf_super_admin" ON public.dt_case_files
  FOR SELECT USING (is_super_admin(auth.uid()));

-- Update RLS for dt_evidence_groups - need to join through case_files for company
DROP POLICY IF EXISTS "Admins can view evidence groups" ON public.dt_evidence_groups;
CREATE POLICY "mt_eg_admin" ON public.dt_evidence_groups
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.dt_case_files cf 
      WHERE cf.id = case_file_id 
      AND user_belongs_to_company(auth.uid(), cf.company_id) 
      AND is_admin_or_above(auth.uid())
    )
  );
CREATE POLICY "mt_eg_super_admin" ON public.dt_evidence_groups
  FOR SELECT USING (is_super_admin(auth.uid()));

-- Update RLS for dt_evidences - need to join through evidence_groups and case_files
DROP POLICY IF EXISTS "Admins can view evidences" ON public.dt_evidences;
CREATE POLICY "mt_ev_admin" ON public.dt_evidences
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.dt_evidence_groups eg
      JOIN public.dt_case_files cf ON cf.id = eg.case_file_id
      WHERE eg.id = evidence_group_id
      AND user_belongs_to_company(auth.uid(), cf.company_id)
      AND is_admin_or_above(auth.uid())
    )
  );
CREATE POLICY "mt_ev_super_admin" ON public.dt_evidences
  FOR SELECT USING (is_super_admin(auth.uid()));

-- Add index for performance on qtsp_audit_log
CREATE INDEX idx_qtsp_audit_log_company ON public.qtsp_audit_log(company_id);
CREATE INDEX idx_qtsp_audit_log_evidence ON public.qtsp_audit_log(evidence_id);
CREATE INDEX idx_qtsp_audit_log_created ON public.qtsp_audit_log(created_at DESC);
-- =========================================
-- END MIGRATION: 20260105162437_9eae47ee-0463-4d21-9e74-073ef23cdfca.sql
-- =========================================


-- =========================================
-- BEGIN MIGRATION: 20260105191037_2065b1fd-2cf3-4648-a55a-0eacbc9d5feb.sql
-- =========================================

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
-- =========================================
-- END MIGRATION: 20260105191037_2065b1fd-2cf3-4648-a55a-0eacbc9d5feb.sql
-- =========================================


-- =========================================
-- BEGIN MIGRATION: 20260106035015_0a8434ac-8ba5-4a24-8996-685612827b45.sql
-- =========================================

-- Create kiosk_sessions table for persistent device authentication
CREATE TABLE public.kiosk_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.company(id) ON DELETE CASCADE,
  terminal_id UUID REFERENCES public.terminals(id) ON DELETE SET NULL,
  device_token_hash TEXT NOT NULL UNIQUE,
  device_name TEXT,
  activated_by UUID,
  last_seen_at TIMESTAMPTZ DEFAULT now(),
  expires_at TIMESTAMPTZ, -- NULL = never expires
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Create index for faster lookups
CREATE INDEX idx_kiosk_sessions_device_token ON public.kiosk_sessions(device_token_hash);
CREATE INDEX idx_kiosk_sessions_company ON public.kiosk_sessions(company_id);

-- Enable RLS
ALTER TABLE public.kiosk_sessions ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "mt_ks_company_admin" ON public.kiosk_sessions
FOR ALL USING (
  user_belongs_to_company(auth.uid(), company_id) AND is_admin_or_above(auth.uid())
);

CREATE POLICY "mt_ks_super_admin" ON public.kiosk_sessions
FOR ALL USING (
  is_super_admin(auth.uid())
);

-- Trigger for updated_at
CREATE TRIGGER update_kiosk_sessions_updated_at
BEFORE UPDATE ON public.kiosk_sessions
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();
-- =========================================
-- END MIGRATION: 20260106035015_0a8434ac-8ba5-4a24-8996-685612827b45.sql
-- =========================================


-- =========================================
-- BEGIN MIGRATION: 20260106043057_894c74ee-e562-4a90-9ca9-3b4ea0495459.sql
-- =========================================

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
-- =========================================
-- END MIGRATION: 20260106043057_894c74ee-e562-4a90-9ca9-3b4ea0495459.sql
-- =========================================


-- =========================================
-- BEGIN MIGRATION: 20260106043249_19837981-13b1-4fb9-a2cb-c019d4534797.sql
-- =========================================

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
-- =========================================
-- END MIGRATION: 20260106043249_19837981-13b1-4fb9-a2cb-c019d4534797.sql
-- =========================================


-- =========================================
-- BEGIN MIGRATION: 20260106060700_c8466a3e-adb7-4e52-9e47-d2668f7d7d21.sql
-- =========================================

-- Add company_settings table for notification preferences
CREATE TABLE IF NOT EXISTS public.company_settings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID NOT NULL REFERENCES public.company(id) ON DELETE CASCADE,
  setting_key TEXT NOT NULL,
  setting_value JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(company_id, setting_key)
);

-- Enable RLS
ALTER TABLE public.company_settings ENABLE ROW LEVEL SECURITY;

-- Policies for company_settings
CREATE POLICY "Admins can view company settings"
  ON public.company_settings
  FOR SELECT
  USING (user_belongs_to_company(auth.uid(), company_id) AND is_admin_or_above(auth.uid()));

CREATE POLICY "Admins can update company settings"
  ON public.company_settings
  FOR UPDATE
  USING (user_belongs_to_company(auth.uid(), company_id) AND is_admin_or_above(auth.uid()));

CREATE POLICY "Admins can insert company settings"
  ON public.company_settings
  FOR INSERT
  WITH CHECK (user_belongs_to_company(auth.uid(), company_id) AND is_admin_or_above(auth.uid()));

-- Trigger for updated_at
CREATE TRIGGER update_company_settings_updated_at
  BEFORE UPDATE ON public.company_settings
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Add department and is_responsible columns to employees if not exist
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'employees' AND column_name = 'department') THEN
    ALTER TABLE public.employees ADD COLUMN department TEXT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'employees' AND column_name = 'is_department_responsible') THEN
    ALTER TABLE public.employees ADD COLUMN is_department_responsible BOOLEAN DEFAULT false;
  END IF;
END $$;
-- =========================================
-- END MIGRATION: 20260106060700_c8466a3e-adb7-4e52-9e47-d2668f7d7d21.sql
-- =========================================


-- =========================================
-- BEGIN MIGRATION: 20260106073715_1a500aeb-77da-488b-8754-4092030864f3.sql
-- =========================================


-- =====================================================
-- FASE 0: PREPARACIÓN - CONSOLA DE CUMPLIMIENTO
-- =====================================================

-- 0.1 Corregir constraint de daily_roots para multi-tenant
ALTER TABLE public.daily_roots DROP CONSTRAINT IF EXISTS daily_roots_date_key;
ALTER TABLE public.daily_roots ADD CONSTRAINT daily_roots_company_date_key UNIQUE (company_id, date);

-- =====================================================
-- 0.2 Nuevos ENUMs para el sistema de cumplimiento
-- =====================================================

-- Estado de conjuntos de reglas
CREATE TYPE public.rule_set_status AS ENUM ('draft', 'validating', 'published', 'active', 'archived');

-- Severidad de violaciones
CREATE TYPE public.violation_severity AS ENUM ('info', 'warn', 'critical');

-- Estado de violaciones
CREATE TYPE public.violation_status AS ENUM ('open', 'acknowledged', 'resolved', 'dismissed');

-- Estado de incidencias
CREATE TYPE public.incident_status AS ENUM ('open', 'acknowledged', 'in_progress', 'resolved', 'closed');

-- Canal de notificación
CREATE TYPE public.notification_channel AS ENUM ('in_app', 'email', 'both');

-- =====================================================
-- 0.3 Tabla: rule_sets (Conjuntos de reglas)
-- =====================================================
CREATE TABLE public.rule_sets (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID REFERENCES public.company(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  sector TEXT,
  convenio TEXT,
  status public.rule_set_status NOT NULL DEFAULT 'draft',
  is_template BOOLEAN NOT NULL DEFAULT false,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Índices
CREATE INDEX idx_rule_sets_company ON public.rule_sets(company_id);
CREATE INDEX idx_rule_sets_status ON public.rule_sets(status);
CREATE INDEX idx_rule_sets_template ON public.rule_sets(is_template) WHERE is_template = true;

-- RLS
ALTER TABLE public.rule_sets ENABLE ROW LEVEL SECURITY;

-- Plantillas globales visibles para todos los admins
CREATE POLICY "Admins can view global templates"
  ON public.rule_sets FOR SELECT
  USING (is_template = true AND company_id IS NULL AND public.is_admin_or_above(auth.uid()));

-- Reglas de empresa visibles para miembros
CREATE POLICY "Company members can view their rule sets"
  ON public.rule_sets FOR SELECT
  USING (company_id IS NOT NULL AND public.user_belongs_to_company(company_id, auth.uid()));

-- Solo admins pueden crear/editar reglas de su empresa
CREATE POLICY "Admins can manage company rule sets"
  ON public.rule_sets FOR ALL
  USING (company_id IS NOT NULL AND public.is_admin_or_above(auth.uid()) AND public.user_belongs_to_company(company_id, auth.uid()));

-- Solo super_admin puede gestionar plantillas globales
CREATE POLICY "Super admins can manage global templates"
  ON public.rule_sets FOR ALL
  USING (is_template = true AND company_id IS NULL AND public.is_super_admin(auth.uid()));

-- =====================================================
-- 0.4 Tabla: rule_versions (Versiones de reglas)
-- =====================================================
CREATE TABLE public.rule_versions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  rule_set_id UUID NOT NULL REFERENCES public.rule_sets(id) ON DELETE CASCADE,
  version TEXT NOT NULL,
  effective_from DATE,
  effective_to DATE,
  payload_json JSONB NOT NULL DEFAULT '{}',
  payload_hash TEXT,
  published_at TIMESTAMPTZ,
  published_by UUID,
  dt_evidence_id UUID REFERENCES public.dt_evidences(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT rule_versions_unique_version UNIQUE (rule_set_id, version)
);

-- Índices
CREATE INDEX idx_rule_versions_rule_set ON public.rule_versions(rule_set_id);
CREATE INDEX idx_rule_versions_effective ON public.rule_versions(effective_from, effective_to);

-- RLS
ALTER TABLE public.rule_versions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view rule versions through rule sets"
  ON public.rule_versions FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.rule_sets rs
    WHERE rs.id = rule_versions.rule_set_id
    AND (
      (rs.is_template = true AND rs.company_id IS NULL)
      OR public.user_belongs_to_company(rs.company_id, auth.uid())
    )
  ));

CREATE POLICY "Admins can manage rule versions"
  ON public.rule_versions FOR ALL
  USING (EXISTS (
    SELECT 1 FROM public.rule_sets rs
    WHERE rs.id = rule_versions.rule_set_id
    AND rs.company_id IS NOT NULL
    AND public.is_admin_or_above(auth.uid())
    AND public.user_belongs_to_company(rs.company_id, auth.uid())
  ));

CREATE POLICY "Super admins can manage template versions"
  ON public.rule_versions FOR ALL
  USING (EXISTS (
    SELECT 1 FROM public.rule_sets rs
    WHERE rs.id = rule_versions.rule_set_id
    AND rs.is_template = true
    AND rs.company_id IS NULL
    AND public.is_super_admin(auth.uid())
  ));

-- =====================================================
-- 0.5 Tabla: rule_assignments (Asignaciones de reglas)
-- =====================================================
CREATE TABLE public.rule_assignments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  rule_version_id UUID NOT NULL REFERENCES public.rule_versions(id) ON DELETE CASCADE,
  company_id UUID NOT NULL REFERENCES public.company(id) ON DELETE CASCADE,
  center_id UUID,
  department TEXT,
  employee_id UUID REFERENCES public.employees(id) ON DELETE CASCADE,
  priority INTEGER NOT NULL DEFAULT 0,
  fallback_policy TEXT DEFAULT 'inherit',
  is_active BOOLEAN NOT NULL DEFAULT true,
  assigned_by UUID,
  assigned_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Índices
CREATE INDEX idx_rule_assignments_company ON public.rule_assignments(company_id);
CREATE INDEX idx_rule_assignments_employee ON public.rule_assignments(employee_id);
CREATE INDEX idx_rule_assignments_active ON public.rule_assignments(is_active) WHERE is_active = true;

-- RLS
ALTER TABLE public.rule_assignments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Company members can view assignments"
  ON public.rule_assignments FOR SELECT
  USING (public.user_belongs_to_company(company_id, auth.uid()));

CREATE POLICY "Admins can manage assignments"
  ON public.rule_assignments FOR ALL
  USING (public.is_admin_or_above(auth.uid()) AND public.user_belongs_to_company(company_id, auth.uid()));

-- =====================================================
-- 0.6 Tabla: compliance_violations (Violaciones detectadas)
-- =====================================================
CREATE TABLE public.compliance_violations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID NOT NULL REFERENCES public.company(id) ON DELETE CASCADE,
  employee_id UUID NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  rule_code TEXT NOT NULL,
  rule_version_id UUID REFERENCES public.rule_versions(id),
  severity public.violation_severity NOT NULL DEFAULT 'warn',
  status public.violation_status NOT NULL DEFAULT 'open',
  violation_date DATE NOT NULL,
  detected_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  evidence_json JSONB NOT NULL DEFAULT '{}',
  auto_resolved_at TIMESTAMPTZ,
  resolved_by UUID,
  resolved_at TIMESTAMPTZ,
  resolution_notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Índices
CREATE INDEX idx_violations_company ON public.compliance_violations(company_id);
CREATE INDEX idx_violations_employee ON public.compliance_violations(employee_id);
CREATE INDEX idx_violations_date ON public.compliance_violations(violation_date);
CREATE INDEX idx_violations_status ON public.compliance_violations(status);
CREATE INDEX idx_violations_severity ON public.compliance_violations(severity);
CREATE INDEX idx_violations_rule ON public.compliance_violations(rule_code);

-- RLS
ALTER TABLE public.compliance_violations ENABLE ROW LEVEL SECURITY;

-- Empleados pueden ver sus propias violaciones
CREATE POLICY "Employees can view own violations"
  ON public.compliance_violations FOR SELECT
  USING (employee_id = public.get_employee_id(auth.uid()));

-- Admins/responsables pueden ver violaciones de su empresa
CREATE POLICY "Admins can view company violations"
  ON public.compliance_violations FOR SELECT
  USING (public.is_admin_or_above(auth.uid()) AND public.user_belongs_to_company(company_id, auth.uid()));

-- Solo admins pueden gestionar violaciones
CREATE POLICY "Admins can manage violations"
  ON public.compliance_violations FOR ALL
  USING (public.is_admin_or_above(auth.uid()) AND public.user_belongs_to_company(company_id, auth.uid()));

-- =====================================================
-- 0.7 Tabla: compliance_incidents (Incidencias escaladas)
-- =====================================================
CREATE TABLE public.compliance_incidents (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID NOT NULL REFERENCES public.company(id) ON DELETE CASCADE,
  violation_id UUID REFERENCES public.compliance_violations(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  description TEXT,
  severity public.violation_severity NOT NULL DEFAULT 'warn',
  status public.incident_status NOT NULL DEFAULT 'open',
  assigned_to UUID,
  sla_due_at TIMESTAMPTZ,
  acknowledged_at TIMESTAMPTZ,
  acknowledged_by UUID,
  resolved_at TIMESTAMPTZ,
  resolved_by UUID,
  resolution_notes TEXT,
  linked_correction_id UUID REFERENCES public.correction_requests(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Índices
CREATE INDEX idx_incidents_company ON public.compliance_incidents(company_id);
CREATE INDEX idx_incidents_status ON public.compliance_incidents(status);
CREATE INDEX idx_incidents_severity ON public.compliance_incidents(severity);
CREATE INDEX idx_incidents_assigned ON public.compliance_incidents(assigned_to);
CREATE INDEX idx_incidents_sla ON public.compliance_incidents(sla_due_at) WHERE status NOT IN ('resolved', 'closed');

-- RLS
ALTER TABLE public.compliance_incidents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Company members can view incidents"
  ON public.compliance_incidents FOR SELECT
  USING (public.user_belongs_to_company(company_id, auth.uid()));

CREATE POLICY "Admins can manage incidents"
  ON public.compliance_incidents FOR ALL
  USING (public.is_admin_or_above(auth.uid()) AND public.user_belongs_to_company(company_id, auth.uid()));

-- =====================================================
-- 0.8 Tabla: compliance_notifications (Notificaciones)
-- =====================================================
CREATE TABLE public.compliance_notifications (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID NOT NULL REFERENCES public.company(id) ON DELETE CASCADE,
  incident_id UUID REFERENCES public.compliance_incidents(id) ON DELETE CASCADE,
  violation_id UUID REFERENCES public.compliance_violations(id) ON DELETE CASCADE,
  recipient_user_id UUID,
  recipient_employee_id UUID REFERENCES public.employees(id) ON DELETE CASCADE,
  recipient_email TEXT,
  channel public.notification_channel NOT NULL DEFAULT 'email',
  notification_type TEXT NOT NULL,
  subject TEXT,
  body_json JSONB NOT NULL DEFAULT '{}',
  scheduled_for TIMESTAMPTZ NOT NULL DEFAULT now(),
  sent_at TIMESTAMPTZ,
  failed_at TIMESTAMPTZ,
  error_message TEXT,
  quiet_hours_delayed BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Índices
CREATE INDEX idx_notifications_company ON public.compliance_notifications(company_id);
CREATE INDEX idx_notifications_incident ON public.compliance_notifications(incident_id);
CREATE INDEX idx_notifications_scheduled ON public.compliance_notifications(scheduled_for) WHERE sent_at IS NULL;
CREATE INDEX idx_notifications_pending ON public.compliance_notifications(sent_at) WHERE sent_at IS NULL AND failed_at IS NULL;

-- RLS
ALTER TABLE public.compliance_notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own notifications"
  ON public.compliance_notifications FOR SELECT
  USING (recipient_user_id = auth.uid() OR recipient_employee_id = public.get_employee_id(auth.uid()));

CREATE POLICY "Admins can view company notifications"
  ON public.compliance_notifications FOR SELECT
  USING (public.is_admin_or_above(auth.uid()) AND public.user_belongs_to_company(company_id, auth.uid()));

CREATE POLICY "System can manage notifications"
  ON public.compliance_notifications FOR ALL
  USING (public.is_admin_or_above(auth.uid()) AND public.user_belongs_to_company(company_id, auth.uid()));

-- =====================================================
-- 0.9 Triggers para updated_at
-- =====================================================

CREATE TRIGGER update_rule_sets_updated_at
  BEFORE UPDATE ON public.rule_sets
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_rule_versions_updated_at
  BEFORE UPDATE ON public.rule_versions
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_rule_assignments_updated_at
  BEFORE UPDATE ON public.rule_assignments
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_compliance_violations_updated_at
  BEFORE UPDATE ON public.compliance_violations
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_compliance_incidents_updated_at
  BEFORE UPDATE ON public.compliance_incidents
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- =====================================================
-- 0.10 Comentarios de documentación
-- =====================================================

COMMENT ON TABLE public.rule_sets IS 'Conjuntos de reglas de cumplimiento. company_id NULL = plantilla global';
COMMENT ON TABLE public.rule_versions IS 'Versiones versionadas de conjuntos de reglas con payload JSON';
COMMENT ON TABLE public.rule_assignments IS 'Asignaciones de versiones de reglas a empresa/centro/departamento/empleado';
COMMENT ON TABLE public.compliance_violations IS 'Violaciones de cumplimiento detectadas por el evaluador';
COMMENT ON TABLE public.compliance_incidents IS 'Incidencias escaladas desde violaciones con workflow de resolución';
COMMENT ON TABLE public.compliance_notifications IS 'Registro de notificaciones enviadas o programadas';

-- =========================================
-- END MIGRATION: 20260106073715_1a500aeb-77da-488b-8754-4092030864f3.sql
-- =========================================


-- =========================================
-- BEGIN MIGRATION: 20260106080506_86a02b1a-8b85-4ca4-a2b1-ef2e86ff4140.sql
-- =========================================

-- Enable pg_cron and pg_net extensions for scheduled jobs
CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

-- Grant usage to postgres role
GRANT USAGE ON SCHEMA cron TO postgres;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA cron TO postgres;
-- =========================================
-- END MIGRATION: 20260106080506_86a02b1a-8b85-4ca4-a2b1-ef2e86ff4140.sql
-- =========================================


-- =========================================
-- BEGIN MIGRATION: 20260106090244_f3373539-c84c-4201-8694-25881d549c1a.sql
-- =========================================

-- Enable realtime for qtsp_audit_log to receive push notifications
ALTER PUBLICATION supabase_realtime ADD TABLE public.qtsp_audit_log;

-- Add retry tracking columns to dt_evidences for exponential backoff
ALTER TABLE public.dt_evidences 
ADD COLUMN IF NOT EXISTS next_retry_at TIMESTAMPTZ DEFAULT NULL,
ADD COLUMN IF NOT EXISTS last_retry_at TIMESTAMPTZ DEFAULT NULL,
ADD COLUMN IF NOT EXISTS backoff_seconds INTEGER DEFAULT 60;
-- =========================================
-- END MIGRATION: 20260106090244_f3373539-c84c-4201-8694-25881d549c1a.sql
-- =========================================


-- =========================================
-- BEGIN MIGRATION: 20260106091310_47746b4b-dc21-45ef-9f90-4419efabbdf4.sql
-- =========================================

-- Tabla de reglas de escalado
CREATE TABLE public.escalation_rules (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID REFERENCES public.company(id) ON DELETE CASCADE,
  level INTEGER NOT NULL DEFAULT 1, -- 1=L1, 2=L2, 3=L3
  severity_threshold TEXT NOT NULL, -- 'info', 'warn', 'critical'
  time_threshold_minutes INTEGER NOT NULL DEFAULT 30, -- tiempo sin resolver para escalar
  consecutive_failures_threshold INTEGER DEFAULT 5,
  notify_emails TEXT[] NOT NULL DEFAULT '{}',
  notify_in_app BOOLEAN DEFAULT true,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Historial de escalados
CREATE TABLE public.escalation_history (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID REFERENCES public.company(id) ON DELETE CASCADE,
  rule_id UUID REFERENCES public.escalation_rules(id) ON DELETE SET NULL,
  qtsp_log_id UUID REFERENCES public.qtsp_audit_log(id) ON DELETE SET NULL,
  escalation_level INTEGER NOT NULL,
  triggered_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  acknowledged_at TIMESTAMP WITH TIME ZONE,
  acknowledged_by UUID,
  resolved_at TIMESTAMP WITH TIME ZONE,
  notification_sent BOOLEAN DEFAULT false,
  notification_channel TEXT, -- 'email', 'in_app', 'both'
  error_category TEXT,
  error_message TEXT
);

-- Índices para búsquedas eficientes
CREATE INDEX idx_escalation_rules_company ON public.escalation_rules(company_id);
CREATE INDEX idx_escalation_rules_active ON public.escalation_rules(is_active) WHERE is_active = true;
CREATE INDEX idx_escalation_history_company ON public.escalation_history(company_id);
CREATE INDEX idx_escalation_history_unresolved ON public.escalation_history(resolved_at) WHERE resolved_at IS NULL;

-- RLS para escalation_rules
ALTER TABLE public.escalation_rules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Super admins can manage all escalation rules"
ON public.escalation_rules FOR ALL
USING (public.is_super_admin(auth.uid()));

CREATE POLICY "Admins can view company escalation rules"
ON public.escalation_rules FOR SELECT
USING (public.user_belongs_to_company(auth.uid(), company_id) AND public.is_admin_or_above(auth.uid()));

-- RLS para escalation_history
ALTER TABLE public.escalation_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Super admins can view all escalation history"
ON public.escalation_history FOR SELECT
USING (public.is_super_admin(auth.uid()));

CREATE POLICY "Super admins can insert escalation history"
ON public.escalation_history FOR INSERT
WITH CHECK (public.is_super_admin(auth.uid()));

CREATE POLICY "Super admins can update escalation history"
ON public.escalation_history FOR UPDATE
USING (public.is_super_admin(auth.uid()));

-- Trigger para updated_at
CREATE TRIGGER update_escalation_rules_updated_at
BEFORE UPDATE ON public.escalation_rules
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();
-- =========================================
-- END MIGRATION: 20260106091310_47746b4b-dc21-45ef-9f90-4419efabbdf4.sql
-- =========================================


-- =========================================
-- BEGIN MIGRATION: 20260106094329_9f538d80-3929-4c71-9573-32bcb5964304.sql
-- =========================================

-- Create table for certificate download audit history
CREATE TABLE public.certificate_downloads (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id uuid NOT NULL REFERENCES public.company(id) ON DELETE CASCADE,
  evidence_id uuid REFERENCES public.dt_evidences(id) ON DELETE SET NULL,
  notification_id uuid REFERENCES public.compliance_notifications(id) ON DELETE SET NULL,
  downloaded_by uuid NOT NULL,
  downloaded_at timestamp with time zone NOT NULL DEFAULT now(),
  download_type text NOT NULL, -- 'report', 'notification', 'overtime', 'breaks', 'night_work'
  document_title text NOT NULL,
  ip_address inet,
  user_agent text,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Create index for efficient queries
CREATE INDEX idx_certificate_downloads_company ON public.certificate_downloads(company_id);
CREATE INDEX idx_certificate_downloads_evidence ON public.certificate_downloads(evidence_id);
CREATE INDEX idx_certificate_downloads_downloaded_at ON public.certificate_downloads(downloaded_at DESC);

-- Enable RLS
ALTER TABLE public.certificate_downloads ENABLE ROW LEVEL SECURITY;

-- RLS policies for certificate_downloads
CREATE POLICY "Admins can view company certificate downloads"
  ON public.certificate_downloads
  FOR SELECT
  USING (is_admin_or_above(auth.uid()) AND user_belongs_to_company(company_id, auth.uid()));

CREATE POLICY "Admins can insert certificate downloads"
  ON public.certificate_downloads
  FOR INSERT
  WITH CHECK (is_admin_or_above(auth.uid()) AND user_belongs_to_company(company_id, auth.uid()));

CREATE POLICY "Super admins can view all certificate downloads"
  ON public.certificate_downloads
  FOR SELECT
  USING (is_super_admin(auth.uid()));

-- Add new evidence types to support additional reports
-- Update evidence_type enum to include new types
ALTER TYPE public.evidence_type ADD VALUE IF NOT EXISTS 'overtime_report';
ALTER TYPE public.evidence_type ADD VALUE IF NOT EXISTS 'breaks_report';
ALTER TYPE public.evidence_type ADD VALUE IF NOT EXISTS 'night_work_report';
ALTER TYPE public.evidence_type ADD VALUE IF NOT EXISTS 'notification_certificate';
-- =========================================
-- END MIGRATION: 20260106094329_9f538d80-3929-4c71-9573-32bcb5964304.sql
-- =========================================


-- =========================================
-- BEGIN MIGRATION: 20260106102124_87425e56-2572-4bab-b861-a60ecf496ae7.sql
-- =========================================

-- =====================================================
-- PHASE 1: Employee Portal - Database Schema
-- =====================================================

-- 1. Absence Types Catalog (configurable by company)
CREATE TABLE public.absence_types (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID NOT NULL REFERENCES public.company(id) ON DELETE CASCADE,
  code TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  category TEXT NOT NULL DEFAULT 'leave', -- 'vacation', 'leave', 'sick', 'personal', 'remote'
  is_paid BOOLEAN NOT NULL DEFAULT true,
  requires_justification BOOLEAN NOT NULL DEFAULT false,
  requires_approval BOOLEAN NOT NULL DEFAULT true,
  max_days_per_year INTEGER,
  advance_notice_days INTEGER DEFAULT 0,
  color TEXT DEFAULT '#3B82F6',
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(company_id, code)
);

-- 2. Absence Requests
CREATE TABLE public.absence_requests (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID NOT NULL REFERENCES public.company(id) ON DELETE CASCADE,
  employee_id UUID NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  absence_type_id UUID NOT NULL REFERENCES public.absence_types(id) ON DELETE RESTRICT,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  start_half_day BOOLEAN DEFAULT false,
  end_half_day BOOLEAN DEFAULT false,
  total_days NUMERIC(5,2) NOT NULL,
  reason TEXT,
  justification_path TEXT,
  status TEXT NOT NULL DEFAULT 'pending', -- 'pending', 'approved', 'rejected', 'cancelled'
  requested_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  CONSTRAINT valid_date_range CHECK (end_date >= start_date)
);

-- 3. Absence Approvals (workflow history)
CREATE TABLE public.absence_approvals (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  request_id UUID NOT NULL REFERENCES public.absence_requests(id) ON DELETE CASCADE,
  approver_id UUID NOT NULL,
  action TEXT NOT NULL, -- 'approved', 'rejected', 'escalated'
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- 4. Employee Documents (justifications, personal docs)
CREATE TABLE public.employee_documents (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID NOT NULL REFERENCES public.company(id) ON DELETE CASCADE,
  employee_id UUID NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  document_type TEXT NOT NULL, -- 'justification', 'medical_certificate', 'contract', 'policy_acceptance'
  title TEXT NOT NULL,
  description TEXT,
  file_path TEXT NOT NULL,
  file_size INTEGER,
  mime_type TEXT,
  related_request_id UUID REFERENCES public.absence_requests(id) ON DELETE SET NULL,
  uploaded_by UUID NOT NULL,
  is_verified BOOLEAN DEFAULT false,
  verified_by UUID,
  verified_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- 5. Monthly Closures (digital signature of hours)
CREATE TABLE public.monthly_closures (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID NOT NULL REFERENCES public.company(id) ON DELETE CASCADE,
  employee_id UUID NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  year INTEGER NOT NULL,
  month INTEGER NOT NULL CHECK (month >= 1 AND month <= 12),
  total_hours NUMERIC(8,2) NOT NULL DEFAULT 0,
  regular_hours NUMERIC(8,2) NOT NULL DEFAULT 0,
  overtime_hours NUMERIC(8,2) NOT NULL DEFAULT 0,
  night_hours NUMERIC(8,2) NOT NULL DEFAULT 0,
  summary_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  status TEXT NOT NULL DEFAULT 'pending', -- 'pending', 'signed', 'disputed'
  signed_at TIMESTAMP WITH TIME ZONE,
  signature_hash TEXT,
  sealed_pdf_path TEXT,
  evidence_id UUID REFERENCES public.dt_evidences(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(company_id, employee_id, year, month)
);

-- 6. Employee Notifications
CREATE TABLE public.employee_notifications (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID NOT NULL REFERENCES public.company(id) ON DELETE CASCADE,
  employee_id UUID NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  notification_type TEXT NOT NULL, -- 'absence_approved', 'absence_rejected', 'closure_reminder', 'document_required', etc.
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  action_url TEXT,
  related_entity_type TEXT,
  related_entity_id UUID,
  is_read BOOLEAN NOT NULL DEFAULT false,
  read_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- 7. Vacation Balances
CREATE TABLE public.vacation_balances (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID NOT NULL REFERENCES public.company(id) ON DELETE CASCADE,
  employee_id UUID NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  year INTEGER NOT NULL,
  entitled_days NUMERIC(5,2) NOT NULL DEFAULT 0,
  carried_over_days NUMERIC(5,2) NOT NULL DEFAULT 0,
  used_days NUMERIC(5,2) NOT NULL DEFAULT 0,
  pending_days NUMERIC(5,2) NOT NULL DEFAULT 0,
  available_days NUMERIC(5,2) GENERATED ALWAYS AS (entitled_days + carried_over_days - used_days - pending_days) STORED,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(company_id, employee_id, year)
);

-- Enable RLS on all tables
ALTER TABLE public.absence_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.absence_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.absence_approvals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.employee_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.monthly_closures ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.employee_notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vacation_balances ENABLE ROW LEVEL SECURITY;

-- =====================================================
-- RLS POLICIES
-- =====================================================

-- Absence Types: company admins can manage, employees can view
CREATE POLICY "Admins can manage absence types"
  ON public.absence_types FOR ALL
  USING (is_admin_or_above(auth.uid()) AND user_belongs_to_company(auth.uid(), company_id));

CREATE POLICY "Employees can view active absence types"
  ON public.absence_types FOR SELECT
  USING (user_belongs_to_company(auth.uid(), company_id) AND is_active = true);

-- Absence Requests: employees own, admins/responsibles can manage
CREATE POLICY "Employees can manage own requests"
  ON public.absence_requests FOR ALL
  USING (employee_id = get_employee_id(auth.uid()));

CREATE POLICY "Admins can manage all requests"
  ON public.absence_requests FOR ALL
  USING (is_admin_or_above(auth.uid()) AND user_belongs_to_company(auth.uid(), company_id));

CREATE POLICY "Responsibles can view and update requests"
  ON public.absence_requests FOR SELECT
  USING (has_role(auth.uid(), 'responsible') AND user_belongs_to_company(auth.uid(), company_id));

CREATE POLICY "Responsibles can update requests"
  ON public.absence_requests FOR UPDATE
  USING (has_role(auth.uid(), 'responsible') AND user_belongs_to_company(auth.uid(), company_id));

-- Absence Approvals: admins and responsibles can insert, all company can view
CREATE POLICY "Approvers can insert approvals"
  ON public.absence_approvals FOR INSERT
  WITH CHECK (is_admin_or_above(auth.uid()) OR has_role(auth.uid(), 'responsible'));

CREATE POLICY "Company members can view approvals"
  ON public.absence_approvals FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.absence_requests ar 
    WHERE ar.id = request_id AND user_belongs_to_company(auth.uid(), ar.company_id)
  ));

-- Employee Documents
CREATE POLICY "Employees can manage own documents"
  ON public.employee_documents FOR ALL
  USING (employee_id = get_employee_id(auth.uid()));

CREATE POLICY "Admins can manage all documents"
  ON public.employee_documents FOR ALL
  USING (is_admin_or_above(auth.uid()) AND user_belongs_to_company(auth.uid(), company_id));

-- Monthly Closures
CREATE POLICY "Employees can view and sign own closures"
  ON public.monthly_closures FOR SELECT
  USING (employee_id = get_employee_id(auth.uid()));

CREATE POLICY "Employees can update own pending closures"
  ON public.monthly_closures FOR UPDATE
  USING (employee_id = get_employee_id(auth.uid()) AND status = 'pending');

CREATE POLICY "Admins can manage all closures"
  ON public.monthly_closures FOR ALL
  USING (is_admin_or_above(auth.uid()) AND user_belongs_to_company(auth.uid(), company_id));

-- Employee Notifications
CREATE POLICY "Employees can manage own notifications"
  ON public.employee_notifications FOR ALL
  USING (employee_id = get_employee_id(auth.uid()));

CREATE POLICY "Admins can manage company notifications"
  ON public.employee_notifications FOR ALL
  USING (is_admin_or_above(auth.uid()) AND user_belongs_to_company(auth.uid(), company_id));

-- Vacation Balances
CREATE POLICY "Employees can view own balance"
  ON public.vacation_balances FOR SELECT
  USING (employee_id = get_employee_id(auth.uid()));

CREATE POLICY "Admins can manage all balances"
  ON public.vacation_balances FOR ALL
  USING (is_admin_or_above(auth.uid()) AND user_belongs_to_company(auth.uid(), company_id));

-- =====================================================
-- TRIGGERS
-- =====================================================

-- Update timestamps
CREATE TRIGGER update_absence_types_updated_at
  BEFORE UPDATE ON public.absence_types
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_absence_requests_updated_at
  BEFORE UPDATE ON public.absence_requests
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_monthly_closures_updated_at
  BEFORE UPDATE ON public.monthly_closures
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_vacation_balances_updated_at
  BEFORE UPDATE ON public.vacation_balances
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =====================================================
-- INDEXES
-- =====================================================

CREATE INDEX idx_absence_requests_employee ON public.absence_requests(employee_id);
CREATE INDEX idx_absence_requests_status ON public.absence_requests(status);
CREATE INDEX idx_absence_requests_dates ON public.absence_requests(start_date, end_date);
CREATE INDEX idx_monthly_closures_employee_period ON public.monthly_closures(employee_id, year, month);
CREATE INDEX idx_employee_notifications_employee ON public.employee_notifications(employee_id, is_read);
CREATE INDEX idx_vacation_balances_employee_year ON public.vacation_balances(employee_id, year);

-- =====================================================
-- SEED DEFAULT ABSENCE TYPES (will be copied per company)
-- =====================================================

-- Note: Default types will be created via edge function when company is set up
-- =========================================
-- END MIGRATION: 20260106102124_87425e56-2572-4bab-b861-a60ecf496ae7.sql
-- =========================================


-- =========================================
-- BEGIN MIGRATION: 20260106103529_48c3d32f-a5b2-41ff-8a9d-1b29863a69fd.sql
-- =========================================

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
-- =========================================
-- END MIGRATION: 20260106103529_48c3d32f-a5b2-41ff-8a9d-1b29863a69fd.sql
-- =========================================


-- =========================================
-- BEGIN MIGRATION: 20260106110734_09be545f-4b6d-4fe4-975f-a7186f4b554d.sql
-- =========================================

-- Table 1: Legal Document Templates (master templates)
CREATE TABLE public.legal_document_templates (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  category TEXT NOT NULL,
  description TEXT,
  content_markdown TEXT NOT NULL,
  variable_fields JSONB NOT NULL DEFAULT '[]'::jsonb,
  requires_employee_acceptance BOOLEAN NOT NULL DEFAULT false,
  priority TEXT NOT NULL DEFAULT 'medium',
  version INTEGER NOT NULL DEFAULT 1,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Table 2: Legal Documents (generated per company with substituted fields)
CREATE TABLE public.legal_documents (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID NOT NULL REFERENCES public.company(id) ON DELETE CASCADE,
  template_id UUID NOT NULL REFERENCES public.legal_document_templates(id),
  code TEXT NOT NULL,
  name TEXT NOT NULL,
  content_markdown TEXT NOT NULL,
  content_html TEXT,
  pdf_path TEXT,
  variable_values JSONB NOT NULL DEFAULT '{}'::jsonb,
  is_published BOOLEAN NOT NULL DEFAULT false,
  published_at TIMESTAMPTZ,
  published_by UUID,
  version INTEGER NOT NULL DEFAULT 1,
  effective_from TIMESTAMPTZ,
  effective_to TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(company_id, code, version)
);

-- Table 3: Document Acknowledgments (employee acceptances with QTSP seal)
CREATE TABLE public.document_acknowledgments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID NOT NULL REFERENCES public.company(id) ON DELETE CASCADE,
  document_id UUID NOT NULL REFERENCES public.legal_documents(id) ON DELETE CASCADE,
  employee_id UUID NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  content_hash TEXT NOT NULL,
  signature_hash TEXT NOT NULL,
  acknowledged_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  ip_address INET,
  user_agent TEXT,
  qtsp_evidence_id UUID REFERENCES public.dt_evidences(id),
  tsp_token TEXT,
  tsp_timestamp TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(document_id, employee_id)
);

-- Table 4: Data Retention Config
CREATE TABLE public.data_retention_config (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID NOT NULL REFERENCES public.company(id) ON DELETE CASCADE,
  data_category TEXT NOT NULL,
  retention_years INTEGER NOT NULL,
  description TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(company_id, data_category)
);

-- Table 5: Data Purge Log (evidence of destruction)
CREATE TABLE public.data_purge_log (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID NOT NULL REFERENCES public.company(id) ON DELETE CASCADE,
  data_category TEXT NOT NULL,
  records_purged INTEGER NOT NULL,
  oldest_record_date DATE,
  newest_record_date DATE,
  purge_cutoff_date DATE NOT NULL,
  content_hash_before TEXT NOT NULL,
  purged_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  purged_by TEXT NOT NULL DEFAULT 'system',
  qtsp_evidence_id UUID REFERENCES public.dt_evidences(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Table 6: Contingency Records (paper-based clock-ins transcribed)
CREATE TABLE public.contingency_records (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID NOT NULL REFERENCES public.company(id) ON DELETE CASCADE,
  employee_id UUID NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  contingency_date DATE NOT NULL,
  entry_time TIME,
  exit_time TIME,
  pause_start TIME,
  pause_end TIME,
  reason TEXT NOT NULL,
  paper_form_reference TEXT,
  employee_signature_confirmed BOOLEAN NOT NULL DEFAULT false,
  supervisor_signature_confirmed BOOLEAN NOT NULL DEFAULT false,
  transcribed_by UUID NOT NULL,
  transcribed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  validated_by UUID,
  validated_at TIMESTAMPTZ,
  time_events_created BOOLEAN NOT NULL DEFAULT false,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS on all tables
ALTER TABLE public.legal_document_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.legal_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.document_acknowledgments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.data_retention_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.data_purge_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contingency_records ENABLE ROW LEVEL SECURITY;

-- RLS Policies for legal_document_templates (read-only for authenticated users)
CREATE POLICY "Templates are viewable by authenticated users"
ON public.legal_document_templates FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Only super admins can manage templates"
ON public.legal_document_templates FOR ALL
TO authenticated
USING (public.is_super_admin(auth.uid()));

-- RLS Policies for legal_documents
CREATE POLICY "Users can view documents from their company"
ON public.legal_documents FOR SELECT
TO authenticated
USING (
  public.is_super_admin(auth.uid()) OR
  public.user_belongs_to_company(auth.uid(), company_id)
);

CREATE POLICY "Admins can manage documents for their company"
ON public.legal_documents FOR ALL
TO authenticated
USING (
  public.is_super_admin(auth.uid()) OR
  (public.is_admin_or_above(auth.uid()) AND public.user_belongs_to_company(auth.uid(), company_id))
);

-- RLS Policies for document_acknowledgments
CREATE POLICY "Users can view acknowledgments from their company"
ON public.document_acknowledgments FOR SELECT
TO authenticated
USING (
  public.is_super_admin(auth.uid()) OR
  public.user_belongs_to_company(auth.uid(), company_id) OR
  employee_id = public.get_employee_id(auth.uid())
);

CREATE POLICY "Employees can create their own acknowledgments"
ON public.document_acknowledgments FOR INSERT
TO authenticated
WITH CHECK (
  employee_id = public.get_employee_id(auth.uid()) AND
  public.user_belongs_to_company(auth.uid(), company_id)
);

-- RLS Policies for data_retention_config
CREATE POLICY "Users can view retention config from their company"
ON public.data_retention_config FOR SELECT
TO authenticated
USING (
  public.is_super_admin(auth.uid()) OR
  public.user_belongs_to_company(auth.uid(), company_id)
);

CREATE POLICY "Admins can manage retention config for their company"
ON public.data_retention_config FOR ALL
TO authenticated
USING (
  public.is_super_admin(auth.uid()) OR
  (public.is_admin_or_above(auth.uid()) AND public.user_belongs_to_company(auth.uid(), company_id))
);

-- RLS Policies for data_purge_log
CREATE POLICY "Users can view purge logs from their company"
ON public.data_purge_log FOR SELECT
TO authenticated
USING (
  public.is_super_admin(auth.uid()) OR
  public.user_belongs_to_company(auth.uid(), company_id)
);

CREATE POLICY "Only system can create purge logs"
ON public.data_purge_log FOR INSERT
TO authenticated
WITH CHECK (public.is_super_admin(auth.uid()));

-- RLS Policies for contingency_records
CREATE POLICY "Users can view contingency records from their company"
ON public.contingency_records FOR SELECT
TO authenticated
USING (
  public.is_super_admin(auth.uid()) OR
  public.user_belongs_to_company(auth.uid(), company_id)
);

CREATE POLICY "Admins can manage contingency records for their company"
ON public.contingency_records FOR ALL
TO authenticated
USING (
  public.is_super_admin(auth.uid()) OR
  (public.is_admin_or_above(auth.uid()) AND public.user_belongs_to_company(auth.uid(), company_id))
);

-- Create indexes for performance
CREATE INDEX idx_legal_documents_company ON public.legal_documents(company_id);
CREATE INDEX idx_legal_documents_template ON public.legal_documents(template_id);
CREATE INDEX idx_document_acknowledgments_company ON public.document_acknowledgments(company_id);
CREATE INDEX idx_document_acknowledgments_employee ON public.document_acknowledgments(employee_id);
CREATE INDEX idx_document_acknowledgments_document ON public.document_acknowledgments(document_id);
CREATE INDEX idx_data_retention_config_company ON public.data_retention_config(company_id);
CREATE INDEX idx_data_purge_log_company ON public.data_purge_log(company_id);
CREATE INDEX idx_contingency_records_company ON public.contingency_records(company_id);
CREATE INDEX idx_contingency_records_employee ON public.contingency_records(employee_id);
CREATE INDEX idx_contingency_records_date ON public.contingency_records(contingency_date);

-- Triggers for updated_at
CREATE TRIGGER update_legal_document_templates_updated_at
BEFORE UPDATE ON public.legal_document_templates
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_legal_documents_updated_at
BEFORE UPDATE ON public.legal_documents
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_data_retention_config_updated_at
BEFORE UPDATE ON public.data_retention_config
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_contingency_records_updated_at
BEFORE UPDATE ON public.contingency_records
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Insert default retention config for new companies (function to be called on company creation)
CREATE OR REPLACE FUNCTION public.seed_default_retention_config(p_company_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF EXISTS (SELECT 1 FROM data_retention_config WHERE company_id = p_company_id LIMIT 1) THEN
    RETURN;
  END IF;

  INSERT INTO data_retention_config (company_id, data_category, retention_years, description) VALUES
  (p_company_id, 'time_events', 4, 'Registros de jornada (art. 34.9 ET)'),
  (p_company_id, 'corrected_events', 4, 'Eventos corregidos'),
  (p_company_id, 'correction_requests', 4, 'Solicitudes de corrección'),
  (p_company_id, 'absence_requests', 4, 'Solicitudes de ausencias'),
  (p_company_id, 'audit_log', 4, 'Logs de auditoría'),
  (p_company_id, 'employee_documents_health', 5, 'Justificantes médicos'),
  (p_company_id, 'dt_evidences', 10, 'Evidencias QTSP'),
  (p_company_id, 'document_acknowledgments', 4, 'Aceptaciones de documentos'),
  (p_company_id, 'contingency_records', 4, 'Registros de contingencia');
END;
$function$;
-- =========================================
-- END MIGRATION: 20260106110734_09be545f-4b6d-4fe4-975f-a7186f4b554d.sql
-- =========================================


-- =========================================
-- BEGIN MIGRATION: 20260106113431_86837300-a573-4049-b76b-b7dfde87da92.sql
-- =========================================

-- Tabla para calendarios laborales
CREATE TABLE public.labor_calendars (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.company(id) ON DELETE CASCADE,
  center_id UUID,
  year INTEGER NOT NULL,
  name TEXT NOT NULL,
  holidays JSONB NOT NULL DEFAULT '[]',
  shifts_summary JSONB DEFAULT '[]',
  intensive_periods JSONB DEFAULT '[]',
  published_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(company_id, center_id, year)
);

-- Tabla para paquetes ITSS generados
CREATE TABLE public.itss_packages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.company(id) ON DELETE CASCADE,
  expedient_number TEXT,
  request_date DATE,
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  centers JSONB DEFAULT '[]',
  components JSONB NOT NULL DEFAULT '{}',
  manifest JSONB,
  package_hash TEXT,
  qtsp_evidence_id UUID REFERENCES public.dt_evidences(id),
  storage_path TEXT,
  status TEXT NOT NULL DEFAULT 'draft',
  generated_by UUID,
  generated_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.labor_calendars ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.itss_packages ENABLE ROW LEVEL SECURITY;

-- RLS policies for labor_calendars
CREATE POLICY "Users can view their company calendars"
  ON public.labor_calendars FOR SELECT
  USING (public.user_belongs_to_company(auth.uid(), company_id));

CREATE POLICY "Admins can manage labor calendars"
  ON public.labor_calendars FOR ALL
  USING (public.is_admin_or_above(auth.uid()) AND public.user_belongs_to_company(auth.uid(), company_id));

CREATE POLICY "Super admins can manage all calendars"
  ON public.labor_calendars FOR ALL
  USING (public.is_super_admin(auth.uid()));

-- RLS policies for itss_packages
CREATE POLICY "Users can view their company ITSS packages"
  ON public.itss_packages FOR SELECT
  USING (public.user_belongs_to_company(auth.uid(), company_id));

CREATE POLICY "Admins can manage ITSS packages"
  ON public.itss_packages FOR ALL
  USING (public.is_admin_or_above(auth.uid()) AND public.user_belongs_to_company(auth.uid(), company_id));

CREATE POLICY "Super admins can manage all ITSS packages"
  ON public.itss_packages FOR ALL
  USING (public.is_super_admin(auth.uid()));

-- Triggers for updated_at
CREATE TRIGGER update_labor_calendars_updated_at
  BEFORE UPDATE ON public.labor_calendars
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_itss_packages_updated_at
  BEFORE UPDATE ON public.itss_packages
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
-- =========================================
-- END MIGRATION: 20260106113431_86837300-a573-4049-b76b-b7dfde87da92.sql
-- =========================================


-- =========================================
-- BEGIN MIGRATION: 20260106153136_fb7471db-3cdd-4e4a-8652-d9193d1eccf9.sql
-- =========================================

-- Añadir nuevos campos a company para soportar autónomos y selección de actividad
ALTER TABLE company ADD COLUMN IF NOT EXISTS entity_type TEXT DEFAULT 'empresa';
ALTER TABLE company ADD COLUMN IF NOT EXISTS trade_name TEXT;
ALTER TABLE company ADD COLUMN IF NOT EXISTS sector TEXT;
ALTER TABLE company ADD COLUMN IF NOT EXISTS cnae TEXT;

-- Añadir constraint para entity_type
DO $$ BEGIN
  ALTER TABLE company ADD CONSTRAINT company_entity_type_check 
    CHECK (entity_type IN ('empresa', 'autonomo'));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
-- =========================================
-- END MIGRATION: 20260106153136_fb7471db-3cdd-4e4a-8652-d9193d1eccf9.sql
-- =========================================


-- =========================================
-- BEGIN MIGRATION: 20260106175630_c994054c-72b5-4483-9889-a7bc8205a4d8.sql
-- =========================================

-- Create enum types for messages
CREATE TYPE message_sender_type AS ENUM ('company', 'employee');
CREATE TYPE message_priority AS ENUM ('low', 'normal', 'high', 'urgent');

-- Create company_messages table for all communications
CREATE TABLE public.company_messages (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID NOT NULL REFERENCES public.company(id) ON DELETE CASCADE,
  thread_id UUID REFERENCES public.company_messages(id) ON DELETE CASCADE,
  sender_type message_sender_type NOT NULL,
  sender_user_id UUID, -- For company admins
  sender_employee_id UUID REFERENCES public.employees(id) ON DELETE SET NULL,
  recipient_type TEXT NOT NULL CHECK (recipient_type IN ('company', 'employee', 'department', 'all_employees')),
  recipient_employee_id UUID REFERENCES public.employees(id) ON DELETE SET NULL,
  recipient_department TEXT,
  subject TEXT NOT NULL,
  body TEXT NOT NULL,
  priority message_priority NOT NULL DEFAULT 'normal',
  requires_acknowledgment BOOLEAN NOT NULL DEFAULT false,
  attachments JSONB DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create message_recipients table for tracking individual read/acknowledgment status
CREATE TABLE public.message_recipients (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  message_id UUID NOT NULL REFERENCES public.company_messages(id) ON DELETE CASCADE,
  employee_id UUID NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  read_at TIMESTAMPTZ,
  acknowledged_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(message_id, employee_id)
);

-- Create indexes for performance
CREATE INDEX idx_company_messages_company_id ON public.company_messages(company_id);
CREATE INDEX idx_company_messages_thread_id ON public.company_messages(thread_id);
CREATE INDEX idx_company_messages_sender_employee_id ON public.company_messages(sender_employee_id);
CREATE INDEX idx_company_messages_recipient_employee_id ON public.company_messages(recipient_employee_id);
CREATE INDEX idx_company_messages_created_at ON public.company_messages(created_at DESC);
CREATE INDEX idx_message_recipients_employee_id ON public.message_recipients(employee_id);
CREATE INDEX idx_message_recipients_message_id ON public.message_recipients(message_id);
CREATE INDEX idx_message_recipients_unread ON public.message_recipients(employee_id) WHERE read_at IS NULL;

-- Enable RLS
ALTER TABLE public.company_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.message_recipients ENABLE ROW LEVEL SECURITY;

-- RLS Policies for company_messages

-- Admins can do everything with messages in their company
CREATE POLICY "Admins can manage company messages"
ON public.company_messages FOR ALL
USING (
  is_admin_or_above(auth.uid()) AND user_belongs_to_company(auth.uid(), company_id)
);

-- Employees can view messages sent to them or all employees
CREATE POLICY "Employees can view their messages"
ON public.company_messages FOR SELECT
USING (
  user_belongs_to_company(auth.uid(), company_id) AND (
    -- Messages sent directly to them
    (recipient_type = 'employee' AND recipient_employee_id = get_employee_id(auth.uid()))
    -- Messages sent to all employees
    OR recipient_type = 'all_employees'
    -- Messages sent to their department
    OR (recipient_type = 'department' AND recipient_department = (
      SELECT department FROM public.employees WHERE id = get_employee_id(auth.uid())
    ))
    -- Messages they sent
    OR sender_employee_id = get_employee_id(auth.uid())
    -- Messages in threads they participate in
    OR thread_id IN (
      SELECT id FROM public.company_messages 
      WHERE sender_employee_id = get_employee_id(auth.uid())
         OR recipient_employee_id = get_employee_id(auth.uid())
    )
    -- Replies to their messages
    OR id IN (
      SELECT thread_id FROM public.company_messages 
      WHERE sender_employee_id = get_employee_id(auth.uid())
    )
  )
);

-- Employees can insert messages (send to company)
CREATE POLICY "Employees can send messages"
ON public.company_messages FOR INSERT
WITH CHECK (
  user_belongs_to_company(auth.uid(), company_id)
  AND sender_type = 'employee'
  AND sender_employee_id = get_employee_id(auth.uid())
  AND recipient_type = 'company'
);

-- RLS Policies for message_recipients

-- Admins can manage all recipients in their company
CREATE POLICY "Admins can manage message recipients"
ON public.message_recipients FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM public.company_messages cm
    WHERE cm.id = message_id
    AND is_admin_or_above(auth.uid())
    AND user_belongs_to_company(auth.uid(), cm.company_id)
  )
);

-- Employees can view and update their own recipient records
CREATE POLICY "Employees can view their recipient records"
ON public.message_recipients FOR SELECT
USING (employee_id = get_employee_id(auth.uid()));

CREATE POLICY "Employees can update their recipient records"
ON public.message_recipients FOR UPDATE
USING (employee_id = get_employee_id(auth.uid()))
WITH CHECK (employee_id = get_employee_id(auth.uid()));

-- Trigger to update updated_at
CREATE TRIGGER update_company_messages_updated_at
  BEFORE UPDATE ON public.company_messages
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Function to auto-create recipient records for mass messages
CREATE OR REPLACE FUNCTION public.create_message_recipients()
RETURNS TRIGGER AS $$
BEGIN
  -- For messages to all employees, create recipient records
  IF NEW.recipient_type = 'all_employees' THEN
    INSERT INTO public.message_recipients (message_id, employee_id)
    SELECT NEW.id, e.id
    FROM public.employees e
    WHERE e.company_id = NEW.company_id
    AND e.status = 'active'
    AND e.id != COALESCE(NEW.sender_employee_id, '00000000-0000-0000-0000-000000000000'::uuid);
  -- For department messages
  ELSIF NEW.recipient_type = 'department' AND NEW.recipient_department IS NOT NULL THEN
    INSERT INTO public.message_recipients (message_id, employee_id)
    SELECT NEW.id, e.id
    FROM public.employees e
    WHERE e.company_id = NEW.company_id
    AND e.department = NEW.recipient_department
    AND e.status = 'active'
    AND e.id != COALESCE(NEW.sender_employee_id, '00000000-0000-0000-0000-000000000000'::uuid);
  -- For individual employee messages
  ELSIF NEW.recipient_type = 'employee' AND NEW.recipient_employee_id IS NOT NULL THEN
    INSERT INTO public.message_recipients (message_id, employee_id)
    VALUES (NEW.id, NEW.recipient_employee_id)
    ON CONFLICT (message_id, employee_id) DO NOTHING;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER trigger_create_message_recipients
  AFTER INSERT ON public.company_messages
  FOR EACH ROW
  EXECUTE FUNCTION public.create_message_recipients();

-- Function to create notification when message is received
CREATE OR REPLACE FUNCTION public.notify_message_recipients()
RETURNS TRIGGER AS $$
BEGIN
  -- Create notification for the employee
  INSERT INTO public.employee_notifications (
    company_id,
    employee_id,
    notification_type,
    title,
    message,
    related_entity_type,
    related_entity_id,
    action_url
  )
  SELECT 
    cm.company_id,
    NEW.employee_id,
    'message',
    CASE cm.priority
      WHEN 'urgent' THEN '🚨 ' || cm.subject
      WHEN 'high' THEN '⚠️ ' || cm.subject
      ELSE cm.subject
    END,
    CASE 
      WHEN cm.sender_type = 'company' THEN 'Has recibido un nuevo mensaje de la empresa'
      ELSE 'Has recibido una respuesta a tu mensaje'
    END,
    'message',
    cm.id::text,
    '/employee/communications'
  FROM public.company_messages cm
  WHERE cm.id = NEW.message_id;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER trigger_notify_message_recipients
  AFTER INSERT ON public.message_recipients
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_message_recipients();
-- =========================================
-- END MIGRATION: 20260106175630_c994054c-72b5-4483-9889-a7bc8205a4d8.sql
-- =========================================


-- =========================================
-- BEGIN MIGRATION: 20260106194636_bbe0dc44-1d4d-4cc8-bcaf-0a3104fcee7b.sql
-- =========================================

-- QTSP Certification fields for communications and notifications
-- This migration adds content_hash and qtsp_evidence_id to enable cryptographic timestamping

-- 1. Add QTSP certification fields to company_messages
ALTER TABLE public.company_messages 
ADD COLUMN IF NOT EXISTS content_hash TEXT,
ADD COLUMN IF NOT EXISTS qtsp_evidence_id UUID REFERENCES public.dt_evidences(id) ON DELETE SET NULL;

-- 2. Add QTSP certification fields to message_recipients (for acknowledgments)
ALTER TABLE public.message_recipients
ADD COLUMN IF NOT EXISTS ack_content_hash TEXT,
ADD COLUMN IF NOT EXISTS qtsp_evidence_id UUID REFERENCES public.dt_evidences(id) ON DELETE SET NULL;

-- 3. Add QTSP certification fields to compliance_notifications
ALTER TABLE public.compliance_notifications
ADD COLUMN IF NOT EXISTS content_hash TEXT,
ADD COLUMN IF NOT EXISTS qtsp_evidence_id UUID REFERENCES public.dt_evidences(id) ON DELETE SET NULL;

-- 4. Add QTSP certification fields to employee_notifications
ALTER TABLE public.employee_notifications
ADD COLUMN IF NOT EXISTS content_hash TEXT,
ADD COLUMN IF NOT EXISTS qtsp_evidence_id UUID REFERENCES public.dt_evidences(id) ON DELETE SET NULL;

-- 5. Add new evidence types to the enum (if they don't exist)
DO $$
BEGIN
  -- Add message_hash type
  IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'message_hash' AND enumtypid = 'evidence_type'::regtype) THEN
    ALTER TYPE evidence_type ADD VALUE 'message_hash';
  END IF;
  -- Add acknowledgment type  
  IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'acknowledgment' AND enumtypid = 'evidence_type'::regtype) THEN
    ALTER TYPE evidence_type ADD VALUE 'acknowledgment';
  END IF;
  -- Add notification_hash type
  IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'notification_hash' AND enumtypid = 'evidence_type'::regtype) THEN
    ALTER TYPE evidence_type ADD VALUE 'notification_hash';
  END IF;
EXCEPTION
  WHEN others THEN
    -- Enum values may already exist, ignore error
    NULL;
END $$;

-- 6. Create indexes for QTSP-related queries
CREATE INDEX IF NOT EXISTS idx_company_messages_qtsp ON public.company_messages(qtsp_evidence_id) WHERE qtsp_evidence_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_message_recipients_qtsp ON public.message_recipients(qtsp_evidence_id) WHERE qtsp_evidence_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_compliance_notifications_qtsp ON public.compliance_notifications(qtsp_evidence_id) WHERE qtsp_evidence_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_employee_notifications_qtsp ON public.employee_notifications(qtsp_evidence_id) WHERE qtsp_evidence_id IS NOT NULL;

-- 7. Comments for documentation
COMMENT ON COLUMN public.company_messages.content_hash IS 'SHA-256 hash of message content for QTSP certification';
COMMENT ON COLUMN public.company_messages.qtsp_evidence_id IS 'Reference to QTSP evidence for timestamped certification';
COMMENT ON COLUMN public.message_recipients.ack_content_hash IS 'SHA-256 hash of acknowledgment for QTSP certification';
COMMENT ON COLUMN public.message_recipients.qtsp_evidence_id IS 'Reference to QTSP evidence for acknowledgment certification';
-- =========================================
-- END MIGRATION: 20260106194636_bbe0dc44-1d4d-4cc8-bcaf-0a3104fcee7b.sql
-- =========================================


-- =========================================
-- BEGIN MIGRATION: 20260106201151_a033f0a2-7640-420e-9c7e-0e9ad096ed8b.sql
-- =========================================

-- Fix RLS policy for rule_sets table - correct parameter order in user_belongs_to_company
-- The function expects (_user_id uuid, _company_id uuid) but policy had them inverted

DROP POLICY IF EXISTS "Admins can manage company rule sets" ON public.rule_sets;

CREATE POLICY "Admins can manage company rule sets" 
ON public.rule_sets 
FOR ALL
TO public
USING (
  company_id IS NOT NULL 
  AND is_admin_or_above(auth.uid()) 
  AND user_belongs_to_company(auth.uid(), company_id)
)
WITH CHECK (
  company_id IS NOT NULL 
  AND is_admin_or_above(auth.uid()) 
  AND user_belongs_to_company(auth.uid(), company_id)
);
-- =========================================
-- END MIGRATION: 20260106201151_a033f0a2-7640-420e-9c7e-0e9ad096ed8b.sql
-- =========================================


-- =========================================
-- BEGIN MIGRATION: 20260106201538_ae8ed120-db77-45e7-ada5-ed2525324ba6.sql
-- =========================================

-- Fix RLS policies for rule_sets and rule_versions
-- Correct parameter order for user_belongs_to_company(_user_id, _company_id)
-- Ensure rule_versions has WITH CHECK for INSERT/UPDATE

-- rule_sets: fix member view policy
DROP POLICY IF EXISTS "Company members can view their rule sets" ON public.rule_sets;
CREATE POLICY "Company members can view their rule sets"
ON public.rule_sets
FOR SELECT
TO public
USING (
  company_id IS NOT NULL
  AND user_belongs_to_company(auth.uid(), company_id)
);

-- rule_versions: fix admin manage policy (and add WITH CHECK)
DROP POLICY IF EXISTS "Admins can manage rule versions" ON public.rule_versions;
CREATE POLICY "Admins can manage rule versions"
ON public.rule_versions
FOR ALL
TO public
USING (
  EXISTS (
    SELECT 1
    FROM public.rule_sets rs
    WHERE rs.id = rule_versions.rule_set_id
      AND rs.company_id IS NOT NULL
      AND is_admin_or_above(auth.uid())
      AND user_belongs_to_company(auth.uid(), rs.company_id)
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.rule_sets rs
    WHERE rs.id = rule_versions.rule_set_id
      AND rs.company_id IS NOT NULL
      AND is_admin_or_above(auth.uid())
      AND user_belongs_to_company(auth.uid(), rs.company_id)
  )
);

-- rule_versions: fix user view policy parameter order
DROP POLICY IF EXISTS "Users can view rule versions through rule sets" ON public.rule_versions;
CREATE POLICY "Users can view rule versions through rule sets"
ON public.rule_versions
FOR SELECT
TO public
USING (
  EXISTS (
    SELECT 1
    FROM public.rule_sets rs
    WHERE rs.id = rule_versions.rule_set_id
      AND (
        ((rs.is_template = true) AND (rs.company_id IS NULL))
        OR (rs.company_id IS NOT NULL AND user_belongs_to_company(auth.uid(), rs.company_id))
      )
  )
);

-- =========================================
-- END MIGRATION: 20260106201538_ae8ed120-db77-45e7-ada5-ed2525324ba6.sql
-- =========================================


-- =========================================
-- BEGIN MIGRATION: 20260106203600_qtsp_communications_certification.sql
-- =========================================

-- QTSP Certification fields for communications and notifications
-- This migration adds content_hash and qtsp_evidence_id to enable cryptographic timestamping

-- 1. Add QTSP certification fields to company_messages
ALTER TABLE public.company_messages 
ADD COLUMN IF NOT EXISTS content_hash TEXT,
ADD COLUMN IF NOT EXISTS qtsp_evidence_id UUID REFERENCES public.dt_evidences(id) ON DELETE SET NULL;

-- 2. Add QTSP certification fields to message_recipients (for acknowledgments)
ALTER TABLE public.message_recipients
ADD COLUMN IF NOT EXISTS ack_content_hash TEXT,
ADD COLUMN IF NOT EXISTS qtsp_evidence_id UUID REFERENCES public.dt_evidences(id) ON DELETE SET NULL;

-- 3. Add QTSP certification fields to compliance_notifications
ALTER TABLE public.compliance_notifications
ADD COLUMN IF NOT EXISTS content_hash TEXT,
ADD COLUMN IF NOT EXISTS qtsp_evidence_id UUID REFERENCES public.dt_evidences(id) ON DELETE SET NULL;

-- 4. Add QTSP certification fields to employee_notifications
ALTER TABLE public.employee_notifications
ADD COLUMN IF NOT EXISTS content_hash TEXT,
ADD COLUMN IF NOT EXISTS qtsp_evidence_id UUID REFERENCES public.dt_evidences(id) ON DELETE SET NULL;

-- 5. Add new evidence types to the enum (if they don't exist)
DO $$
BEGIN
  -- Add message_hash type
  IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'message_hash' AND enumtypid = 'evidence_type'::regtype) THEN
    ALTER TYPE evidence_type ADD VALUE 'message_hash';
  END IF;
  
  -- Add acknowledgment type  
  IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'acknowledgment' AND enumtypid = 'evidence_type'::regtype) THEN
    ALTER TYPE evidence_type ADD VALUE 'acknowledgment';
  END IF;
  
  -- Add notification_hash type
  IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'notification_hash' AND enumtypid = 'evidence_type'::regtype) THEN
    ALTER TYPE evidence_type ADD VALUE 'notification_hash';
  END IF;
EXCEPTION
  WHEN others THEN
    -- Enum values may already exist, ignore error
    NULL;
END $$;

-- 6. Create indexes for QTSP-related queries
CREATE INDEX IF NOT EXISTS idx_company_messages_qtsp ON public.company_messages(qtsp_evidence_id) WHERE qtsp_evidence_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_message_recipients_qtsp ON public.message_recipients(qtsp_evidence_id) WHERE qtsp_evidence_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_compliance_notifications_qtsp ON public.compliance_notifications(qtsp_evidence_id) WHERE qtsp_evidence_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_employee_notifications_qtsp ON public.employee_notifications(qtsp_evidence_id) WHERE qtsp_evidence_id IS NOT NULL;

-- 7. Comments for documentation
COMMENT ON COLUMN public.company_messages.content_hash IS 'SHA-256 hash of message content for QTSP certification';
COMMENT ON COLUMN public.company_messages.qtsp_evidence_id IS 'Reference to QTSP evidence for timestamped certification';
COMMENT ON COLUMN public.message_recipients.ack_content_hash IS 'SHA-256 hash of acknowledgment for QTSP certification';
COMMENT ON COLUMN public.message_recipients.qtsp_evidence_id IS 'Reference to QTSP evidence for acknowledgment certification';

-- =========================================
-- END MIGRATION: 20260106203600_qtsp_communications_certification.sql
-- =========================================


-- =========================================
-- BEGIN MIGRATION: 20260107042449_d0380a2c-be56-4116-bb0e-b8838f093a7b.sql
-- =========================================


-- ==============================================
-- FASE 1: Sistema de Ausencias Mejorado v2
-- ==============================================

-- 1. Tabla coverage_rules: Reglas de cobertura por empresa/centro/departamento
CREATE TABLE public.coverage_rules (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID NOT NULL REFERENCES public.company(id) ON DELETE CASCADE,
  center_id UUID NULL,
  department TEXT NULL,
  job_profile TEXT NULL,
  min_team_available_pct NUMERIC NOT NULL DEFAULT 50,
  max_simultaneous_absences INTEGER NULL,
  blackout_ranges JSONB NOT NULL DEFAULT '[]'::jsonb,
  approval_overrides BOOLEAN NOT NULL DEFAULT false,
  priority INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Índices para coverage_rules
CREATE INDEX idx_coverage_rules_company ON public.coverage_rules(company_id);
CREATE INDEX idx_coverage_rules_center ON public.coverage_rules(center_id) WHERE center_id IS NOT NULL;
CREATE INDEX idx_coverage_rules_department ON public.coverage_rules(department) WHERE department IS NOT NULL;

-- RLS para coverage_rules
ALTER TABLE public.coverage_rules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage coverage rules"
ON public.coverage_rules FOR ALL
USING (is_admin_or_above(auth.uid()) AND user_belongs_to_company(auth.uid(), company_id));

CREATE POLICY "Company members can view coverage rules"
ON public.coverage_rules FOR SELECT
USING (user_belongs_to_company(auth.uid(), company_id));

-- 2. Tabla calendar_holidays: Festivos por empresa/centro
CREATE TABLE public.calendar_holidays (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID NOT NULL REFERENCES public.company(id) ON DELETE CASCADE,
  center_id UUID NULL,
  holiday_date DATE NOT NULL,
  holiday_type TEXT NOT NULL DEFAULT 'local',
  description TEXT NULL,
  is_working_day BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  CONSTRAINT valid_holiday_type CHECK (holiday_type IN ('estatal', 'autonomico', 'local', 'empresa'))
);

-- Índices para calendar_holidays
CREATE INDEX idx_calendar_holidays_company ON public.calendar_holidays(company_id);
CREATE INDEX idx_calendar_holidays_date ON public.calendar_holidays(holiday_date);
CREATE INDEX idx_calendar_holidays_center ON public.calendar_holidays(center_id) WHERE center_id IS NOT NULL;
CREATE UNIQUE INDEX idx_calendar_holidays_unique ON public.calendar_holidays(company_id, COALESCE(center_id, '00000000-0000-0000-0000-000000000000'::uuid), holiday_date);

-- RLS para calendar_holidays
ALTER TABLE public.calendar_holidays ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage holidays"
ON public.calendar_holidays FOR ALL
USING (is_admin_or_above(auth.uid()) AND user_belongs_to_company(auth.uid(), company_id));

CREATE POLICY "Company members can view holidays"
ON public.calendar_holidays FOR SELECT
USING (user_belongs_to_company(auth.uid(), company_id));

-- 3. Tabla medical_docs: Documentos con datos de salud (acceso restringido)
CREATE TABLE public.medical_docs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  request_id UUID NOT NULL REFERENCES public.absence_requests(id) ON DELETE CASCADE,
  company_id UUID NOT NULL REFERENCES public.company(id) ON DELETE CASCADE,
  employee_id UUID NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  file_path TEXT NOT NULL,
  file_name TEXT NOT NULL,
  mime_type TEXT NULL,
  file_size INTEGER NULL,
  scope TEXT NOT NULL DEFAULT 'health',
  access_scope TEXT NOT NULL DEFAULT 'restricted',
  retention_until DATE NULL,
  uploaded_by UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Índices para medical_docs
CREATE INDEX idx_medical_docs_request ON public.medical_docs(request_id);
CREATE INDEX idx_medical_docs_employee ON public.medical_docs(employee_id);
CREATE INDEX idx_medical_docs_retention ON public.medical_docs(retention_until) WHERE retention_until IS NOT NULL;

-- RLS para medical_docs (acceso muy restringido)
ALTER TABLE public.medical_docs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Only admins can manage medical docs"
ON public.medical_docs FOR ALL
USING (is_admin_or_above(auth.uid()) AND user_belongs_to_company(auth.uid(), company_id));

CREATE POLICY "Employees can view own medical docs"
ON public.medical_docs FOR SELECT
USING (employee_id = get_employee_id(auth.uid()));

CREATE POLICY "Employees can upload own medical docs"
ON public.medical_docs FOR INSERT
WITH CHECK (employee_id = get_employee_id(auth.uid()) AND user_belongs_to_company(auth.uid(), company_id));

-- 4. Tabla template_absence_links: Vinculación entre plantillas y tipos de ausencia
CREATE TABLE public.template_absence_links (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID NOT NULL REFERENCES public.company(id) ON DELETE CASCADE,
  rule_version_id UUID NULL REFERENCES public.rule_versions(id) ON DELETE SET NULL,
  absence_type_id UUID NOT NULL REFERENCES public.absence_types(id) ON DELETE CASCADE,
  template_leave_code TEXT NOT NULL,
  mapping_config JSONB NOT NULL DEFAULT '{}'::jsonb,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Índices para template_absence_links
CREATE INDEX idx_template_absence_links_company ON public.template_absence_links(company_id);
CREATE INDEX idx_template_absence_links_rule_version ON public.template_absence_links(rule_version_id) WHERE rule_version_id IS NOT NULL;
CREATE INDEX idx_template_absence_links_absence_type ON public.template_absence_links(absence_type_id);

-- RLS para template_absence_links
ALTER TABLE public.template_absence_links ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage template absence links"
ON public.template_absence_links FOR ALL
USING (is_admin_or_above(auth.uid()) AND user_belongs_to_company(auth.uid(), company_id));

CREATE POLICY "Company members can view template absence links"
ON public.template_absence_links FOR SELECT
USING (user_belongs_to_company(auth.uid(), company_id));

-- 5. Extender absence_requests con nuevos campos
ALTER TABLE public.absence_requests 
  ADD COLUMN IF NOT EXISTS center_id UUID NULL,
  ADD COLUMN IF NOT EXISTS total_hours NUMERIC NULL,
  ADD COLUMN IF NOT EXISTS justification_required BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS justification_files JSONB NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS justification_meta JSONB NULL,
  ADD COLUMN IF NOT EXISTS coverage_check JSONB NULL,
  ADD COLUMN IF NOT EXISTS created_by UUID NULL,
  ADD COLUMN IF NOT EXISTS travel_km INTEGER NULL,
  ADD COLUMN IF NOT EXISTS extra_days_applied INTEGER NOT NULL DEFAULT 0;

-- Índice para búsquedas por centro
CREATE INDEX IF NOT EXISTS idx_absence_requests_center ON public.absence_requests(center_id) WHERE center_id IS NOT NULL;

-- 6. Extender vacation_balances con nuevos campos
ALTER TABLE public.vacation_balances
  ADD COLUMN IF NOT EXISTS devengado_days NUMERIC NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS total_hours_equiv NUMERIC NULL,
  ADD COLUMN IF NOT EXISTS policy JSONB NULL,
  ADD COLUMN IF NOT EXISTS accrual_type TEXT NOT NULL DEFAULT 'annual',
  ADD COLUMN IF NOT EXISTS last_calc_at TIMESTAMP WITH TIME ZONE NULL;

-- Añadir constraint para accrual_type si no existe
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'valid_accrual_type'
  ) THEN
    ALTER TABLE public.vacation_balances 
    ADD CONSTRAINT valid_accrual_type CHECK (accrual_type IN ('annual', 'monthly', 'anniversary'));
  END IF;
END $$;

-- 7. Extender absence_types con campos faltantes del spec
ALTER TABLE public.absence_types
  ADD COLUMN IF NOT EXISTS min_block_days INTEGER NULL,
  ADD COLUMN IF NOT EXISTS preaviso_hours INTEGER NULL;

-- 8. Trigger para updated_at en nuevas tablas
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_coverage_rules_updated_at
  BEFORE UPDATE ON public.coverage_rules
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_calendar_holidays_updated_at
  BEFORE UPDATE ON public.calendar_holidays
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_template_absence_links_updated_at
  BEFORE UPDATE ON public.template_absence_links
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 9. Habilitar realtime para las nuevas tablas
ALTER PUBLICATION supabase_realtime ADD TABLE public.coverage_rules;
ALTER PUBLICATION supabase_realtime ADD TABLE public.calendar_holidays;

-- =========================================
-- END MIGRATION: 20260107042449_d0380a2c-be56-4116-bb0e-b8838f093a7b.sql
-- =========================================


-- =========================================
-- BEGIN MIGRATION: 20260107043400_ad2ebe3c-0f6a-4c5b-a9dd-133e6d21532f.sql
-- =========================================

-- Fase 2: Extensiones para sistema de ausencias mejorado (corrección)

-- 2.3 Extender absence_requests con campos faltantes
ALTER TABLE public.absence_requests 
  ADD COLUMN IF NOT EXISTS origin TEXT DEFAULT 'employee',
  ADD COLUMN IF NOT EXISTS tz TEXT DEFAULT 'Europe/Madrid',
  ADD COLUMN IF NOT EXISTS revoked_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS revoked_by UUID,
  ADD COLUMN IF NOT EXISTS revoked_reason TEXT;

-- Añadir constraint para origin (drop primero si existe)
DO $$ 
BEGIN
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'absence_requests_origin_check') THEN
    ALTER TABLE public.absence_requests DROP CONSTRAINT absence_requests_origin_check;
  END IF;
END $$;

ALTER TABLE public.absence_requests 
  ADD CONSTRAINT absence_requests_origin_check 
  CHECK (origin IN ('employee', 'admin'));

-- 2.4 Extender absence_approvals con campo step
ALTER TABLE public.absence_approvals 
  ADD COLUMN IF NOT EXISTS step INTEGER DEFAULT 1;

-- Índice para búsqueda por step (con IF NOT EXISTS)
CREATE INDEX IF NOT EXISTS idx_absence_approvals_step ON public.absence_approvals(request_id, step);

-- 2.5 Añadir campos adicionales a absence_types si no existen
ALTER TABLE public.absence_types
  ADD COLUMN IF NOT EXISTS incompatible_with JSONB DEFAULT '[]',
  ADD COLUMN IF NOT EXISTS alt_mode TEXT,
  ADD COLUMN IF NOT EXISTS alt_mode_description TEXT;

-- 2.6 Crear función helper para verificar si usuario es admin de empresa
CREATE OR REPLACE FUNCTION public.user_is_company_admin(user_uuid UUID, comp_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.user_roles ur
    JOIN public.user_companies uc ON ur.user_id = uc.user_id
    WHERE ur.user_id = user_uuid
    AND uc.company_id = comp_id
    AND ur.role IN ('admin', 'super_admin')
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- 2.7 Crear función helper para obtener employee_id del usuario
CREATE OR REPLACE FUNCTION public.get_employee_id_for_user(user_uuid UUID)
RETURNS UUID AS $$
DECLARE
  emp_id UUID;
BEGIN
  SELECT id INTO emp_id FROM public.employees WHERE user_id = user_uuid LIMIT 1;
  RETURN emp_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- 2.8 Añadir índices faltantes con IF NOT EXISTS
CREATE INDEX IF NOT EXISTS idx_medical_docs_request ON public.medical_docs(request_id);
CREATE INDEX IF NOT EXISTS idx_medical_docs_company ON public.medical_docs(company_id);
CREATE INDEX IF NOT EXISTS idx_medical_docs_retention ON public.medical_docs(retention_until);
CREATE INDEX IF NOT EXISTS idx_template_absence_links_rule ON public.template_absence_links(rule_version_id);
CREATE INDEX IF NOT EXISTS idx_template_absence_links_company ON public.template_absence_links(company_id);
-- =========================================
-- END MIGRATION: 20260107043400_ad2ebe3c-0f6a-4c5b-a9dd-133e6d21532f.sql
-- =========================================


-- =========================================
-- BEGIN MIGRATION: 20260107045349_74d72525-07a0-4a8f-9bc3-ee3e3bec3102.sql
-- =========================================

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
-- =========================================
-- END MIGRATION: 20260107045349_74d72525-07a0-4a8f-9bc3-ee3e3bec3102.sql
-- =========================================


-- =========================================
-- BEGIN MIGRATION: 20260107053244_b22ad0de-8a17-43c5-aa5a-32d897551247.sql
-- =========================================

-- Drop the restrictive insert policy and recreate as permissive
DROP POLICY IF EXISTS "mt_company_insert" ON public.company;

-- Create permissive INSERT policy for authenticated users
CREATE POLICY "mt_company_insert" 
ON public.company 
FOR INSERT 
TO authenticated
WITH CHECK (true);

-- Also ensure user_company and user_roles allow inserts for new company setup
DROP POLICY IF EXISTS "Users can create own company association" ON public.user_company;
CREATE POLICY "Users can create own company association"
ON public.user_company
FOR INSERT
TO authenticated
WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "Users can insert own roles" ON public.user_roles;
CREATE POLICY "Users can insert own roles"
ON public.user_roles
FOR INSERT
TO authenticated
WITH CHECK (user_id = auth.uid());
-- =========================================
-- END MIGRATION: 20260107053244_b22ad0de-8a17-43c5-aa5a-32d897551247.sql
-- =========================================


-- =========================================
-- BEGIN MIGRATION: 20260107053944_e63c2e49-0566-457f-a12b-d29f00ec92c8.sql
-- =========================================

-- Tighten onboarding security: creation is done via backend function, so block direct client inserts.

-- COMPANY: only super admins can insert directly (regular onboarding uses backend function with service privileges)
DROP POLICY IF EXISTS "mt_company_insert" ON public.company;
CREATE POLICY "mt_company_insert"
ON public.company
FOR INSERT
TO authenticated
WITH CHECK (is_super_admin(auth.uid()));

-- USER_COMPANY: remove self-association policies (prevents users linking themselves to arbitrary companies)
DROP POLICY IF EXISTS "Users can create own company association" ON public.user_company;
DROP POLICY IF EXISTS "mt_uc_insert_own" ON public.user_company;

-- USER_ROLES: remove self-role assignment policy (prevents privilege escalation)
DROP POLICY IF EXISTS "Users can insert own roles" ON public.user_roles;

-- =========================================
-- END MIGRATION: 20260107053944_e63c2e49-0566-457f-a12b-d29f00ec92c8.sql
-- =========================================


-- =========================================
-- BEGIN MIGRATION: 20260107072627_a59cfee3-a264-4914-bf94-16fad99a4fdb.sql
-- =========================================

-- Create table to store OpenAI Assistant thread IDs per user
CREATE TABLE public.assistant_threads (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  thread_id TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id)
);

-- Enable Row Level Security
ALTER TABLE public.assistant_threads ENABLE ROW LEVEL SECURITY;

-- Create policies for user access
CREATE POLICY "Users can view their own thread" 
ON public.assistant_threads 
FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own thread" 
ON public.assistant_threads 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own thread" 
ON public.assistant_threads 
FOR UPDATE 
USING (auth.uid() = user_id);

-- Create trigger for automatic timestamp updates
CREATE TRIGGER update_assistant_threads_updated_at
BEFORE UPDATE ON public.assistant_threads
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();
-- =========================================
-- END MIGRATION: 20260107072627_a59cfee3-a264-4914-bf94-16fad99a4fdb.sql
-- =========================================


-- =========================================
-- BEGIN MIGRATION: 20260107074113_74e5b08e-6db4-4524-82a9-9ccac9d67b37.sql
-- =========================================

-- Create support_tickets table for help agent tickets
CREATE TABLE public.support_tickets (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID REFERENCES public.company(id),
  created_by_user_id UUID NOT NULL,
  created_by_employee_id UUID REFERENCES public.employees(id),
  assigned_to_user_id UUID,
  assigned_to_employee_id UUID REFERENCES public.employees(id),
  subject TEXT NOT NULL,
  description TEXT NOT NULL,
  priority TEXT NOT NULL DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'urgent')),
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'in_progress', 'resolved', 'closed')),
  category TEXT,
  conversation_context JSONB,
  resolved_at TIMESTAMP WITH TIME ZONE,
  resolved_by UUID,
  resolution_notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.support_tickets ENABLE ROW LEVEL SECURITY;

-- Policies for support_tickets
CREATE POLICY "Users can view tickets they created" 
ON public.support_tickets 
FOR SELECT 
USING (auth.uid() = created_by_user_id);

CREATE POLICY "Users can create their own tickets" 
ON public.support_tickets 
FOR INSERT 
WITH CHECK (auth.uid() = created_by_user_id);

CREATE POLICY "Assigned users can view tickets" 
ON public.support_tickets 
FOR SELECT 
USING (auth.uid() = assigned_to_user_id);

CREATE POLICY "Assigned users can update tickets" 
ON public.support_tickets 
FOR UPDATE 
USING (auth.uid() = assigned_to_user_id);

-- Create trigger for updated_at
CREATE TRIGGER update_support_tickets_updated_at
BEFORE UPDATE ON public.support_tickets
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();
-- =========================================
-- END MIGRATION: 20260107074113_74e5b08e-6db4-4524-82a9-9ccac9d67b37.sql
-- =========================================


-- =========================================
-- BEGIN MIGRATION: 20260107084155_1c587fd3-2ae2-4bcc-876f-c41c79769eeb.sql
-- =========================================

-- ============================================================
-- FASE 1: MÓDULO DE COMUNICACIONES INTERNAS CERTIFICADAS
-- Reemplazo completo de company_messages por nuevo modelo
-- ============================================================

-- 1. Eliminar triggers dependientes primero
DROP TRIGGER IF EXISTS trigger_notify_message_recipients ON public.message_recipients;
DROP TRIGGER IF EXISTS notify_recipients_on_insert ON public.message_recipients;
DROP TRIGGER IF EXISTS create_recipients_on_insert ON public.company_messages;

-- 2. Eliminar funciones con CASCADE
DROP FUNCTION IF EXISTS public.notify_message_recipients() CASCADE;
DROP FUNCTION IF EXISTS public.create_message_recipients() CASCADE;

-- 3. Eliminar tabla message_recipients antigua
DROP TABLE IF EXISTS public.message_recipients CASCADE;

-- 4. Eliminar tabla company_messages
DROP TABLE IF EXISTS public.company_messages CASCADE;

-- ============================================================
-- NUEVAS TABLAS
-- ============================================================

-- 5. Crear tabla message_threads (hilos de conversación)
CREATE TABLE public.message_threads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.company(id) ON DELETE CASCADE,
  
  -- Metadatos del hilo
  subject TEXT NOT NULL,
  thread_type TEXT NOT NULL CHECK (thread_type IN ('informativa', 'notificacion', 'requerimiento', 'formal', 'convocatoria', 'encuesta')),
  priority TEXT NOT NULL DEFAULT 'normal' CHECK (priority IN ('baja', 'normal', 'alta', 'urgente')),
  category TEXT CHECK (category IN ('rrhh', 'operaciones', 'legal', 'formacion', 'general', NULL)),
  tags JSONB DEFAULT '[]'::jsonb,
  
  -- Configuración
  requires_read_confirmation BOOLEAN NOT NULL DEFAULT true,
  requires_response BOOLEAN NOT NULL DEFAULT false,
  requires_signature BOOLEAN NOT NULL DEFAULT false,
  response_deadline TIMESTAMPTZ,
  allow_reply BOOLEAN NOT NULL DEFAULT true,
  
  -- Estado
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'scheduled', 'sent', 'closed', 'archived')),
  scheduled_at TIMESTAMPTZ,
  sent_at TIMESTAMPTZ,
  closed_at TIMESTAMPTZ,
  
  -- Emisor
  created_by UUID NOT NULL,
  sender_role TEXT CHECK (sender_role IN ('admin', 'rrhh', 'manager', NULL)),
  on_behalf_of TEXT,
  
  -- Audiencia
  audience_type TEXT NOT NULL CHECK (audience_type IN ('all', 'center', 'department', 'profile', 'individual', 'custom')),
  audience_filter JSONB,
  recipient_count INTEGER DEFAULT 0,
  
  -- Certificación
  certification_level TEXT NOT NULL DEFAULT 'complete' CHECK (certification_level IN ('none', 'basic', 'complete', 'reinforced')),
  
  -- Hash del contenido para certificación
  content_hash TEXT,
  
  -- Auditoría
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Índices para message_threads
CREATE INDEX idx_threads_company_status ON public.message_threads(company_id, status);
CREATE INDEX idx_threads_sent_at ON public.message_threads(sent_at DESC);
CREATE INDEX idx_threads_created_by ON public.message_threads(created_by);

-- 6. Crear tabla message_contents (contenido del mensaje)
CREATE TABLE public.message_contents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  thread_id UUID NOT NULL REFERENCES public.message_threads(id) ON DELETE CASCADE,
  
  -- Contenido
  body_text TEXT,
  body_html TEXT,
  body_markdown TEXT,
  
  -- Adjuntos: [{file_ref, filename, mime_type, size, hash}]
  attachments JSONB DEFAULT '[]'::jsonb,
  
  -- Para formularios/encuestas
  form_schema JSONB,
  
  -- Versión (para borradores)
  version INTEGER NOT NULL DEFAULT 1,
  is_current BOOLEAN NOT NULL DEFAULT true,
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Índices para message_contents
CREATE INDEX idx_contents_thread ON public.message_contents(thread_id);
CREATE INDEX idx_contents_current ON public.message_contents(thread_id) WHERE is_current = true;

-- 7. Crear tabla message_recipients (destinatarios)
CREATE TABLE public.message_recipients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  thread_id UUID NOT NULL REFERENCES public.message_threads(id) ON DELETE CASCADE,
  company_id UUID NOT NULL REFERENCES public.company(id) ON DELETE CASCADE,
  employee_id UUID NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  
  -- Estado de entrega
  delivery_status TEXT NOT NULL DEFAULT 'pending' CHECK (delivery_status IN (
    'pending', 'delivered', 'notified_kiosk', 'read', 'responded', 'signed', 'expired', 'failed'
  )),
  
  -- Timestamps de eventos
  delivered_at TIMESTAMPTZ,
  notified_kiosk_at TIMESTAMPTZ,
  notified_push_at TIMESTAMPTZ,
  notified_email_at TIMESTAMPTZ,
  first_read_at TIMESTAMPTZ,
  last_read_at TIMESTAMPTZ,
  read_count INTEGER NOT NULL DEFAULT 0,
  responded_at TIMESTAMPTZ,
  signed_at TIMESTAMPTZ,
  
  -- Respuesta
  response_text TEXT,
  response_attachments JSONB DEFAULT '[]'::jsonb,
  response_form_data JSONB,
  signature_data JSONB,
  
  -- Dispositivo/contexto de lectura
  read_device_type TEXT CHECK (read_device_type IN ('kiosk', 'web', 'mobile', NULL)),
  read_device_id TEXT,
  read_ip INET,
  read_user_agent TEXT,
  
  -- Certificación
  delivery_evidence_id UUID REFERENCES public.dt_evidences(id),
  read_evidence_id UUID REFERENCES public.dt_evidences(id),
  response_evidence_id UUID REFERENCES public.dt_evidences(id),
  signature_evidence_id UUID REFERENCES public.dt_evidences(id),
  
  -- Recordatorios
  reminder_count INTEGER NOT NULL DEFAULT 0,
  last_reminder_at TIMESTAMPTZ,
  next_reminder_at TIMESTAMPTZ,
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  
  UNIQUE(thread_id, employee_id)
);

-- Índices para message_recipients
CREATE INDEX idx_recipients_employee ON public.message_recipients(employee_id, delivery_status);
CREATE INDEX idx_recipients_thread ON public.message_recipients(thread_id, delivery_status);
CREATE INDEX idx_recipients_pending ON public.message_recipients(company_id, delivery_status) 
  WHERE delivery_status IN ('pending', 'delivered', 'notified_kiosk');
CREATE INDEX idx_recipients_reminder ON public.message_recipients(next_reminder_at) 
  WHERE delivery_status NOT IN ('read', 'responded', 'signed', 'expired');

-- 8. Crear tabla message_evidence (evidencias certificadas)
CREATE TABLE public.message_evidence (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.company(id) ON DELETE CASCADE,
  thread_id UUID NOT NULL REFERENCES public.message_threads(id) ON DELETE CASCADE,
  recipient_id UUID REFERENCES public.message_recipients(id) ON DELETE SET NULL,
  
  -- Tipo de evento
  event_type TEXT NOT NULL CHECK (event_type IN (
    'sent', 'delivered', 'notified', 'read', 'responded', 'signed', 'reminder', 'expired'
  )),
  
  -- Datos del evento
  event_timestamp TIMESTAMPTZ NOT NULL,
  event_data JSONB NOT NULL DEFAULT '{}'::jsonb,
  
  -- Hash y certificación
  content_hash TEXT NOT NULL,
  previous_hash TEXT,
  
  -- QTSP
  qtsp_timestamp TIMESTAMPTZ,
  qtsp_token TEXT,
  qtsp_provider TEXT,
  qtsp_serial TEXT,
  
  -- Metadatos
  device_info JSONB,
  ip_address INET,
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Índices para message_evidence
CREATE INDEX idx_evidence_thread ON public.message_evidence(thread_id, event_timestamp);
CREATE INDEX idx_evidence_recipient ON public.message_evidence(recipient_id, event_type);
CREATE INDEX idx_evidence_hash ON public.message_evidence(content_hash);

-- 9. Crear tabla message_templates (plantillas)
CREATE TABLE public.message_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.company(id) ON DELETE CASCADE,
  
  name TEXT NOT NULL,
  description TEXT,
  category TEXT CHECK (category IN ('rrhh', 'operaciones', 'legal', 'formacion', 'general', NULL)),
  thread_type TEXT NOT NULL CHECK (thread_type IN ('informativa', 'notificacion', 'requerimiento', 'formal', 'convocatoria', 'encuesta')),
  
  -- Contenido plantilla (con variables {{variable}})
  subject_template TEXT NOT NULL,
  body_template TEXT NOT NULL,
  
  -- Configuración por defecto
  default_priority TEXT DEFAULT 'normal',
  default_requires_read BOOLEAN DEFAULT true,
  default_requires_response BOOLEAN DEFAULT false,
  default_requires_signature BOOLEAN DEFAULT false,
  default_response_days INTEGER,
  default_certification_level TEXT DEFAULT 'complete',
  
  -- Variables disponibles
  available_variables JSONB DEFAULT '[]'::jsonb,
  
  -- Estado
  is_active BOOLEAN NOT NULL DEFAULT true,
  is_system BOOLEAN NOT NULL DEFAULT false,
  
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Índices para message_templates
CREATE INDEX idx_templates_company ON public.message_templates(company_id, is_active);
CREATE INDEX idx_templates_type ON public.message_templates(company_id, thread_type);

-- 10. Crear tabla kiosk_notifications (cola de notificaciones para kiosco)
CREATE TABLE public.kiosk_notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.company(id) ON DELETE CASCADE,
  employee_id UUID NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  
  -- Referencia
  notification_type TEXT NOT NULL CHECK (notification_type IN ('message', 'absence', 'correction', 'document', 'system')),
  reference_id UUID,
  
  -- Contenido
  title TEXT NOT NULL,
  preview TEXT,
  priority TEXT NOT NULL DEFAULT 'normal' CHECK (priority IN ('baja', 'normal', 'alta', 'urgente')),
  
  -- Estado
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'shown', 'dismissed', 'actioned')),
  shown_at TIMESTAMPTZ,
  dismissed_at TIMESTAMPTZ,
  actioned_at TIMESTAMPTZ,
  
  -- Expiración
  expires_at TIMESTAMPTZ,
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Índice para consulta rápida en kiosco
CREATE INDEX idx_kiosk_notif_employee_pending 
  ON public.kiosk_notifications(company_id, employee_id, status) 
  WHERE status = 'pending';
CREATE INDEX idx_kiosk_notif_expires ON public.kiosk_notifications(expires_at) 
  WHERE status = 'pending' AND expires_at IS NOT NULL;

-- ============================================================
-- RLS POLICIES
-- ============================================================

-- message_threads
ALTER TABLE public.message_threads ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage threads" ON public.message_threads
  FOR ALL USING (
    is_admin_or_above(auth.uid()) AND 
    user_belongs_to_company(auth.uid(), company_id)
  );

CREATE POLICY "Users can view sent threads they created" ON public.message_threads
  FOR SELECT USING (
    created_by = auth.uid() AND status != 'draft'
  );

-- message_contents
ALTER TABLE public.message_contents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage contents" ON public.message_contents
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.message_threads t
      WHERE t.id = message_contents.thread_id
      AND is_admin_or_above(auth.uid())
      AND user_belongs_to_company(auth.uid(), t.company_id)
    )
  );

CREATE POLICY "Recipients can view contents" ON public.message_contents
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.message_recipients r
      WHERE r.thread_id = message_contents.thread_id
      AND r.employee_id = get_employee_id(auth.uid())
    )
  );

-- message_recipients
ALTER TABLE public.message_recipients ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage recipients" ON public.message_recipients
  FOR ALL USING (
    is_admin_or_above(auth.uid()) AND 
    user_belongs_to_company(auth.uid(), company_id)
  );

CREATE POLICY "Employees can view own receipts" ON public.message_recipients
  FOR SELECT USING (
    employee_id = get_employee_id(auth.uid())
  );

CREATE POLICY "Employees can update own receipts" ON public.message_recipients
  FOR UPDATE USING (
    employee_id = get_employee_id(auth.uid())
  ) WITH CHECK (
    employee_id = get_employee_id(auth.uid())
  );

-- message_evidence
ALTER TABLE public.message_evidence ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view evidence" ON public.message_evidence
  FOR SELECT USING (
    is_admin_or_above(auth.uid()) AND 
    user_belongs_to_company(auth.uid(), company_id)
  );

CREATE POLICY "Employees can view own evidence" ON public.message_evidence
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.message_recipients r
      WHERE r.id = message_evidence.recipient_id
      AND r.employee_id = get_employee_id(auth.uid())
    )
  );

-- message_templates
ALTER TABLE public.message_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage templates" ON public.message_templates
  FOR ALL USING (
    is_admin_or_above(auth.uid()) AND 
    user_belongs_to_company(auth.uid(), company_id)
  );

CREATE POLICY "Users can view active templates" ON public.message_templates
  FOR SELECT USING (
    user_belongs_to_company(auth.uid(), company_id) AND is_active = true
  );

-- kiosk_notifications
ALTER TABLE public.kiosk_notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage kiosk notifications" ON public.kiosk_notifications
  FOR ALL USING (
    is_admin_or_above(auth.uid()) AND 
    user_belongs_to_company(auth.uid(), company_id)
  );

CREATE POLICY "Employees can view own kiosk notifications" ON public.kiosk_notifications
  FOR SELECT USING (
    employee_id = get_employee_id(auth.uid())
  );

CREATE POLICY "Employees can update own kiosk notifications" ON public.kiosk_notifications
  FOR UPDATE USING (
    employee_id = get_employee_id(auth.uid())
  );

-- ============================================================
-- TRIGGERS
-- ============================================================

-- Trigger para updated_at en message_threads
CREATE TRIGGER update_message_threads_updated_at
  BEFORE UPDATE ON public.message_threads
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Trigger para updated_at en message_recipients
CREATE TRIGGER update_message_recipients_updated_at
  BEFORE UPDATE ON public.message_recipients
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Trigger para updated_at en message_templates
CREATE TRIGGER update_message_templates_updated_at
  BEFORE UPDATE ON public.message_templates
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================================
-- FUNCIÓN: Crear destinatarios al enviar mensaje
-- ============================================================
CREATE OR REPLACE FUNCTION public.create_message_recipients_on_send()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- Solo cuando el status cambia a 'sent'
  IF NEW.status = 'sent' AND (OLD.status IS NULL OR OLD.status != 'sent') THEN
    -- Audiencia: todos los empleados
    IF NEW.audience_type = 'all' THEN
      INSERT INTO public.message_recipients (thread_id, company_id, employee_id, delivery_status, delivered_at)
      SELECT NEW.id, NEW.company_id, e.id, 'delivered', now()
      FROM public.employees e
      WHERE e.company_id = NEW.company_id
      AND e.status = 'active';
    
    -- Audiencia: por departamento
    ELSIF NEW.audience_type = 'department' AND NEW.audience_filter->>'department' IS NOT NULL THEN
      INSERT INTO public.message_recipients (thread_id, company_id, employee_id, delivery_status, delivered_at)
      SELECT NEW.id, NEW.company_id, e.id, 'delivered', now()
      FROM public.employees e
      WHERE e.company_id = NEW.company_id
      AND e.status = 'active'
      AND e.department = NEW.audience_filter->>'department';
    
    -- Audiencia: individual o custom
    ELSIF NEW.audience_type IN ('individual', 'custom') AND NEW.audience_filter->>'employee_ids' IS NOT NULL THEN
      INSERT INTO public.message_recipients (thread_id, company_id, employee_id, delivery_status, delivered_at)
      SELECT NEW.id, NEW.company_id, e.id, 'delivered', now()
      FROM public.employees e
      WHERE e.company_id = NEW.company_id
      AND e.status = 'active'
      AND e.id = ANY(ARRAY(SELECT jsonb_array_elements_text(NEW.audience_filter->'employee_ids'))::uuid[]);
    END IF;
    
    -- Actualizar contador de destinatarios
    UPDATE public.message_threads 
    SET recipient_count = (
      SELECT COUNT(*) FROM public.message_recipients WHERE thread_id = NEW.id
    ),
    sent_at = COALESCE(NEW.sent_at, now())
    WHERE id = NEW.id;
  END IF;
  
  RETURN NEW;
END;
$$;

CREATE TRIGGER create_recipients_on_thread_send
  AFTER UPDATE ON public.message_threads
  FOR EACH ROW
  WHEN (NEW.status = 'sent' AND (OLD.status IS NULL OR OLD.status != 'sent'))
  EXECUTE FUNCTION public.create_message_recipients_on_send();

-- ============================================================
-- FUNCIÓN: Crear notificación kiosco al entregar mensaje
-- ============================================================
CREATE OR REPLACE FUNCTION public.create_kiosk_notification_on_delivery()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_thread RECORD;
BEGIN
  -- Obtener datos del hilo
  SELECT subject, priority, response_deadline
  INTO v_thread
  FROM public.message_threads
  WHERE id = NEW.thread_id;
  
  -- Crear notificación para kiosco
  INSERT INTO public.kiosk_notifications (
    company_id, employee_id, notification_type, reference_id,
    title, preview, priority, expires_at
  ) VALUES (
    NEW.company_id,
    NEW.employee_id,
    'message',
    NEW.thread_id,
    v_thread.subject,
    'Tienes una nueva comunicación pendiente de leer',
    v_thread.priority,
    v_thread.response_deadline
  );
  
  RETURN NEW;
END;
$$;

CREATE TRIGGER create_kiosk_notif_on_delivery
  AFTER INSERT ON public.message_recipients
  FOR EACH ROW
  WHEN (NEW.delivery_status = 'delivered')
  EXECUTE FUNCTION public.create_kiosk_notification_on_delivery();

-- ============================================================
-- FUNCIÓN: Actualizar notificación kiosco al leer mensaje
-- ============================================================
CREATE OR REPLACE FUNCTION public.update_kiosk_notification_on_read()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- Marcar notificación como accionada
  IF NEW.delivery_status IN ('read', 'responded', 'signed') 
     AND OLD.delivery_status NOT IN ('read', 'responded', 'signed') THEN
    UPDATE public.kiosk_notifications
    SET status = 'actioned', actioned_at = now()
    WHERE notification_type = 'message'
    AND reference_id = NEW.thread_id
    AND employee_id = NEW.employee_id
    AND status IN ('pending', 'shown');
  END IF;
  
  RETURN NEW;
END;
$$;

CREATE TRIGGER update_kiosk_notif_on_read
  AFTER UPDATE ON public.message_recipients
  FOR EACH ROW
  EXECUTE FUNCTION public.update_kiosk_notification_on_read();

-- ============================================================
-- Habilitar realtime para notificaciones
-- ============================================================
ALTER PUBLICATION supabase_realtime ADD TABLE public.kiosk_notifications;
ALTER PUBLICATION supabase_realtime ADD TABLE public.message_recipients;
-- =========================================
-- END MIGRATION: 20260107084155_1c587fd3-2ae2-4bcc-876f-c41c79769eeb.sql
-- =========================================


-- =========================================
-- BEGIN MIGRATION: 20260108112326_6fec5efd-d860-45ed-b390-08ec2770ec20.sql
-- =========================================

-- Add RLS policy for super admins to manage rule_sets of any company
CREATE POLICY "Super admins can manage all company rule sets"
ON public.rule_sets
FOR ALL
USING (
  company_id IS NOT NULL 
  AND is_super_admin(auth.uid())
)
WITH CHECK (
  company_id IS NOT NULL 
  AND is_super_admin(auth.uid())
);
-- =========================================
-- END MIGRATION: 20260108112326_6fec5efd-d860-45ed-b390-08ec2770ec20.sql
-- =========================================


-- =========================================
-- BEGIN MIGRATION: 20260109124801_5da8c625-4e8d-4d44-b86a-d5a3d82763ee.sql
-- =========================================

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
-- =========================================
-- END MIGRATION: 20260109124801_5da8c625-4e8d-4d44-b86a-d5a3d82763ee.sql
-- =========================================


-- =========================================
-- BEGIN MIGRATION: 20260109144358_bd65eb51-7959-4701-acce-ba7f222cce7b.sql
-- =========================================

-- Insertar festivos nacionales España 2026
INSERT INTO public.national_holidays (year, holiday_date, name, type, region) VALUES
  (2026, '2026-01-01', 'Año Nuevo', 'nacional', NULL),
  (2026, '2026-01-06', 'Epifanía del Señor (Reyes)', 'nacional', NULL),
  (2026, '2026-04-03', 'Viernes Santo', 'nacional', NULL),
  (2026, '2026-05-01', 'Fiesta del Trabajo', 'nacional', NULL),
  (2026, '2026-08-15', 'Asunción de la Virgen', 'nacional', NULL),
  (2026, '2026-10-12', 'Fiesta Nacional de España', 'nacional', NULL),
  (2026, '2026-11-01', 'Todos los Santos', 'nacional', NULL),
  (2026, '2026-12-08', 'Inmaculada Concepción', 'nacional', NULL),
  (2026, '2026-12-25', 'Navidad', 'nacional', NULL);

-- Festivos autonómicos Andalucía
INSERT INTO public.national_holidays (year, holiday_date, name, type, region) VALUES
  (2026, '2026-02-28', 'Día de Andalucía', 'autonomico', 'andalucia'),
  (2026, '2026-04-02', 'Jueves Santo', 'autonomico', 'andalucia'),
  (2026, '2026-11-02', 'Todos los Santos (traslado)', 'autonomico', 'andalucia'),
  (2026, '2026-12-07', 'Día de la Constitución (traslado)', 'autonomico', 'andalucia');

-- Festivos autonómicos Aragón
INSERT INTO public.national_holidays (year, holiday_date, name, type, region) VALUES
  (2026, '2026-04-02', 'Jueves Santo', 'autonomico', 'aragon'),
  (2026, '2026-04-23', 'San Jorge, Día de Aragón', 'autonomico', 'aragon'),
  (2026, '2026-11-02', 'Todos los Santos (traslado)', 'autonomico', 'aragon'),
  (2026, '2026-12-07', 'Día de la Constitución (traslado)', 'autonomico', 'aragon');

-- Festivos autonómicos Asturias
INSERT INTO public.national_holidays (year, holiday_date, name, type, region) VALUES
  (2026, '2026-04-02', 'Jueves Santo', 'autonomico', 'asturias'),
  (2026, '2026-09-08', 'Día de Asturias', 'autonomico', 'asturias'),
  (2026, '2026-11-02', 'Todos los Santos (traslado)', 'autonomico', 'asturias'),
  (2026, '2026-12-07', 'Día de la Constitución (traslado)', 'autonomico', 'asturias');

-- Festivos autonómicos Baleares
INSERT INTO public.national_holidays (year, holiday_date, name, type, region) VALUES
  (2026, '2026-03-02', 'Día de las Illes Balears', 'autonomico', 'baleares'),
  (2026, '2026-04-02', 'Jueves Santo', 'autonomico', 'baleares'),
  (2026, '2026-04-06', 'Lunes de Pascua', 'autonomico', 'baleares'),
  (2026, '2026-12-26', 'San Esteban', 'autonomico', 'baleares');

-- Festivos autonómicos Canarias
INSERT INTO public.national_holidays (year, holiday_date, name, type, region) VALUES
  (2026, '2026-04-02', 'Jueves Santo', 'autonomico', 'canarias'),
  (2026, '2026-05-30', 'Día de Canarias', 'autonomico', 'canarias'),
  (2026, '2026-11-02', 'Todos los Santos (traslado)', 'autonomico', 'canarias'),
  (2026, '2026-12-06', 'Día de la Constitución', 'autonomico', 'canarias');

-- Festivos autonómicos Cantabria
INSERT INTO public.national_holidays (year, holiday_date, name, type, region) VALUES
  (2026, '2026-04-02', 'Jueves Santo', 'autonomico', 'cantabria'),
  (2026, '2026-07-28', 'Día de las Instituciones de Cantabria', 'autonomico', 'cantabria'),
  (2026, '2026-09-15', 'La Bien Aparecida', 'autonomico', 'cantabria'),
  (2026, '2026-12-07', 'Día de la Constitución (traslado)', 'autonomico', 'cantabria');

-- Festivos autonómicos Castilla-La Mancha
INSERT INTO public.national_holidays (year, holiday_date, name, type, region) VALUES
  (2026, '2026-04-02', 'Jueves Santo', 'autonomico', 'castilla_la_mancha'),
  (2026, '2026-04-06', 'Lunes de Pascua', 'autonomico', 'castilla_la_mancha'),
  (2026, '2026-06-04', 'Corpus Christi', 'autonomico', 'castilla_la_mancha'),
  (2026, '2026-11-02', 'Todos los Santos (traslado)', 'autonomico', 'castilla_la_mancha');

-- Festivos autonómicos Castilla y León
INSERT INTO public.national_holidays (year, holiday_date, name, type, region) VALUES
  (2026, '2026-04-02', 'Jueves Santo', 'autonomico', 'castilla_y_leon'),
  (2026, '2026-04-23', 'Día de Castilla y León', 'autonomico', 'castilla_y_leon'),
  (2026, '2026-11-02', 'Todos los Santos (traslado)', 'autonomico', 'castilla_y_leon'),
  (2026, '2026-12-07', 'Día de la Constitución (traslado)', 'autonomico', 'castilla_y_leon');

-- Festivos autonómicos Cataluña
INSERT INTO public.national_holidays (year, holiday_date, name, type, region) VALUES
  (2026, '2026-04-06', 'Lunes de Pascua', 'autonomico', 'cataluña'),
  (2026, '2026-06-24', 'San Juan', 'autonomico', 'cataluña'),
  (2026, '2026-09-11', 'Diada Nacional de Catalunya', 'autonomico', 'cataluña'),
  (2026, '2026-12-26', 'San Esteban', 'autonomico', 'cataluña');

-- Festivos autonómicos Comunidad Valenciana
INSERT INTO public.national_holidays (year, holiday_date, name, type, region) VALUES
  (2026, '2026-03-19', 'San José', 'autonomico', 'comunidad_valenciana'),
  (2026, '2026-04-06', 'Lunes de Pascua', 'autonomico', 'comunidad_valenciana'),
  (2026, '2026-06-24', 'San Juan', 'autonomico', 'comunidad_valenciana'),
  (2026, '2026-10-09', 'Día de la Comunitat Valenciana', 'autonomico', 'comunidad_valenciana');

-- Festivos autonómicos Extremadura
INSERT INTO public.national_holidays (year, holiday_date, name, type, region) VALUES
  (2026, '2026-04-02', 'Jueves Santo', 'autonomico', 'extremadura'),
  (2026, '2026-09-08', 'Día de Extremadura', 'autonomico', 'extremadura'),
  (2026, '2026-12-06', 'Día de la Constitución', 'autonomico', 'extremadura');

-- Festivos autonómicos Euskadi
INSERT INTO public.national_holidays (year, holiday_date, name, type, region) VALUES
  (2026, '2026-04-02', 'Jueves Santo', 'autonomico', 'euskadi'),
  (2026, '2026-04-06', 'Lunes de Pascua', 'autonomico', 'euskadi'),
  (2026, '2026-07-25', 'Santiago Apóstol', 'autonomico', 'euskadi'),
  (2026, '2026-12-06', 'Día de la Constitución', 'autonomico', 'euskadi');

-- Festivos autonómicos Galicia
INSERT INTO public.national_holidays (year, holiday_date, name, type, region) VALUES
  (2026, '2026-03-19', 'San José', 'autonomico', 'galicia'),
  (2026, '2026-04-02', 'Jueves Santo', 'autonomico', 'galicia'),
  (2026, '2026-06-24', 'San Juan', 'autonomico', 'galicia'),
  (2026, '2026-07-25', 'Santiago Apóstol, Día Nacional de Galicia', 'autonomico', 'galicia');

-- Festivos autonómicos La Rioja
INSERT INTO public.national_holidays (year, holiday_date, name, type, region) VALUES
  (2026, '2026-04-02', 'Jueves Santo', 'autonomico', 'la_rioja'),
  (2026, '2026-04-06', 'Lunes de Pascua', 'autonomico', 'la_rioja'),
  (2026, '2026-06-09', 'Día de La Rioja', 'autonomico', 'la_rioja'),
  (2026, '2026-12-07', 'Día de la Constitución (traslado)', 'autonomico', 'la_rioja');

-- Festivos autonómicos Madrid
INSERT INTO public.national_holidays (year, holiday_date, name, type, region) VALUES
  (2026, '2026-04-02', 'Jueves Santo', 'autonomico', 'madrid'),
  (2026, '2026-05-02', 'Fiesta de la Comunidad de Madrid', 'autonomico', 'madrid'),
  (2026, '2026-11-02', 'Todos los Santos (traslado)', 'autonomico', 'madrid'),
  (2026, '2026-12-07', 'Día de la Constitución (traslado)', 'autonomico', 'madrid');

-- Festivos autonómicos Murcia
INSERT INTO public.national_holidays (year, holiday_date, name, type, region) VALUES
  (2026, '2026-04-02', 'Jueves Santo', 'autonomico', 'murcia'),
  (2026, '2026-06-09', 'Día de la Región de Murcia', 'autonomico', 'murcia'),
  (2026, '2026-11-02', 'Todos los Santos (traslado)', 'autonomico', 'murcia'),
  (2026, '2026-12-07', 'Día de la Constitución (traslado)', 'autonomico', 'murcia');

-- Festivos autonómicos Navarra
INSERT INTO public.national_holidays (year, holiday_date, name, type, region) VALUES
  (2026, '2026-03-19', 'San José', 'autonomico', 'navarra'),
  (2026, '2026-04-02', 'Jueves Santo', 'autonomico', 'navarra'),
  (2026, '2026-04-06', 'Lunes de Pascua', 'autonomico', 'navarra'),
  (2026, '2026-11-02', 'Todos los Santos (traslado)', 'autonomico', 'navarra'),
  (2026, '2026-12-03', 'San Francisco Javier', 'autonomico', 'navarra');

-- Festivos autonómicos Ceuta
INSERT INTO public.national_holidays (year, holiday_date, name, type, region) VALUES
  (2026, '2026-04-02', 'Jueves Santo', 'autonomico', 'ceuta'),
  (2026, '2026-05-27', 'Fiesta del Sacrificio - Eid al-Adha', 'autonomico', 'ceuta'),
  (2026, '2026-08-05', 'Nuestra Señora de África', 'autonomico', 'ceuta');

-- Festivos autonómicos Melilla
INSERT INTO public.national_holidays (year, holiday_date, name, type, region) VALUES
  (2026, '2026-03-20', 'Fiesta del Eid Fitr', 'autonomico', 'melilla'),
  (2026, '2026-04-02', 'Jueves Santo', 'autonomico', 'melilla'),
  (2026, '2026-05-27', 'Fiesta del Sacrificio - Eid al-Adha', 'autonomico', 'melilla'),
  (2026, '2026-11-02', 'Todos los Santos (traslado)', 'autonomico', 'melilla'),
  (2026, '2026-12-07', 'Día de la Constitución (traslado)', 'autonomico', 'melilla');
-- =========================================
-- END MIGRATION: 20260109144358_bd65eb51-7959-4701-acce-ba7f222cce7b.sql
-- =========================================


-- =========================================
-- BEGIN MIGRATION: 20260109174115_ce34cc17-4919-4d03-bb9d-11ca5f668887.sql
-- =========================================

-- Política para que Super Admins puedan gestionar rule_versions de cualquier empresa
CREATE POLICY "Super admins can manage company rule versions"
ON public.rule_versions
FOR ALL
TO public
USING (
  EXISTS (
    SELECT 1 FROM rule_sets rs
    WHERE rs.id = rule_versions.rule_set_id 
    AND rs.company_id IS NOT NULL
    AND is_super_admin(auth.uid())
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM rule_sets rs
    WHERE rs.id = rule_versions.rule_set_id 
    AND rs.company_id IS NOT NULL
    AND is_super_admin(auth.uid())
  )
);

-- Crear la versión faltante para el rule_set huérfano existente
INSERT INTO public.rule_versions (rule_set_id, version, payload_json)
SELECT 
  'c72f06df-6f5d-4dc4-83e4-1a73c01b067e',
  '1.0.0',
  '{"limits":{"max_daily_hours":9,"min_daily_rest":12,"min_weekly_rest":36,"max_overtime_yearly":80,"max_weekly_hours":40},"breaks":{"required_after_hours":6,"min_break_minutes":15},"overtime":{"max_yearly":80,"alert_threshold":60},"leaves":[{"type":"vacation","days":22},{"type":"sick","requires_justification":true}]}'::jsonb
WHERE NOT EXISTS (
  SELECT 1 FROM rule_versions WHERE rule_set_id = 'c72f06df-6f5d-4dc4-83e4-1a73c01b067e'
);
-- =========================================
-- END MIGRATION: 20260109174115_ce34cc17-4919-4d03-bb9d-11ca5f668887.sql
-- =========================================


-- =========================================
-- BEGIN MIGRATION: 20260109174732_aaaa1876-f39c-4940-b011-f945bf1731db.sql
-- =========================================

-- Política para que Super Admins puedan gestionar calendar_holidays de cualquier empresa
CREATE POLICY "Super admins can manage all holidays"
ON public.calendar_holidays
FOR ALL
TO public
USING (is_super_admin(auth.uid()))
WITH CHECK (is_super_admin(auth.uid()));
-- =========================================
-- END MIGRATION: 20260109174732_aaaa1876-f39c-4940-b011-f945bf1731db.sql
-- =========================================


-- =========================================
-- BEGIN MIGRATION: 20260109175343_c303dedd-914b-464c-8371-e36462a55d45.sql
-- =========================================

-- Añadir campos de ubicación geográfica a empleados
ALTER TABLE public.employees 
ADD COLUMN IF NOT EXISTS autonomous_community TEXT,
ADD COLUMN IF NOT EXISTS locality TEXT;

-- Comentarios para documentar los campos
COMMENT ON COLUMN public.employees.autonomous_community IS 'Código de comunidad autónoma (AND, CAT, MAD, etc.) para aplicar festivos autonómicos';
COMMENT ON COLUMN public.employees.locality IS 'Localidad/municipio del empleado para aplicar festivos locales';
-- =========================================
-- END MIGRATION: 20260109175343_c303dedd-914b-464c-8371-e36462a55d45.sql
-- =========================================


-- =========================================
-- BEGIN MIGRATION: 20260109181137_f233bd0b-3fdc-4321-a26d-48fecd8bd3a9.sql
-- =========================================

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
-- =========================================
-- END MIGRATION: 20260109181137_f233bd0b-3fdc-4321-a26d-48fecd8bd3a9.sql
-- =========================================


-- =========================================
-- BEGIN MIGRATION: 20260111000000_fix_rls_flipped_args.sql
-- =========================================


-- Fix flipped arguments in user_belongs_to_company calls for various RLS policies
-- Function signature is: public.user_belongs_to_company(_user_id uuid, _company_id uuid)

-- 1. rule_sets
DROP POLICY IF EXISTS "Company members can view their rule sets" ON public.rule_sets;
CREATE POLICY "Company members can view their rule sets"
  ON public.rule_sets FOR SELECT
  USING (company_id IS NOT NULL AND public.user_belongs_to_company(auth.uid(), company_id));

DROP POLICY IF EXISTS "Admins can manage company rule sets" ON public.rule_sets;
CREATE POLICY "Admins can manage company rule sets"
  ON public.rule_sets FOR ALL
  USING (company_id IS NOT NULL AND public.is_admin_or_above(auth.uid()) AND public.user_belongs_to_company(auth.uid(), company_id));

-- 2. rule_versions
DROP POLICY IF EXISTS "Users can view rule versions through rule sets" ON public.rule_versions;
CREATE POLICY "Users can view rule versions through rule sets"
  ON public.rule_versions FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.rule_sets rs
    WHERE rs.id = rule_versions.rule_set_id
    AND (
      (rs.is_template = true AND rs.company_id IS NULL)
      OR public.user_belongs_to_company(auth.uid(), rs.company_id)
    )
  ));

DROP POLICY IF EXISTS "Admins can manage rule versions" ON public.rule_versions;
CREATE POLICY "Admins can manage rule versions"
  ON public.rule_versions FOR ALL
  USING (EXISTS (
    SELECT 1 FROM public.rule_sets rs
    WHERE rs.id = rule_versions.rule_set_id
    AND rs.company_id IS NOT NULL
    AND public.is_admin_or_above(auth.uid())
    AND public.user_belongs_to_company(auth.uid(), rs.company_id)
  ));

-- 3. rule_assignments
DROP POLICY IF EXISTS "Company members can view assignments" ON public.rule_assignments;
CREATE POLICY "Company members can view assignments"
  ON public.rule_assignments FOR SELECT
  USING (public.user_belongs_to_company(auth.uid(), company_id));

DROP POLICY IF EXISTS "Admins can manage assignments" ON public.rule_assignments;
CREATE POLICY "Admins can manage assignments"
  ON public.rule_assignments FOR ALL
  USING (public.is_admin_or_above(auth.uid()) AND public.user_belongs_to_company(auth.uid(), company_id));

-- 4. compliance_violations
DROP POLICY IF EXISTS "Admins can view company violations" ON public.compliance_violations;
CREATE POLICY "Admins can view company violations"
  ON public.compliance_violations FOR SELECT
  USING (public.is_admin_or_above(auth.uid()) AND public.user_belongs_to_company(auth.uid(), company_id));

DROP POLICY IF EXISTS "Admins can manage violations" ON public.compliance_violations;
CREATE POLICY "Admins can manage violations"
  ON public.compliance_violations FOR ALL
  USING (public.is_admin_or_above(auth.uid()) AND public.user_belongs_to_company(auth.uid(), company_id));

-- 5. compliance_incidents
DROP POLICY IF EXISTS "Company members can view incidents" ON public.compliance_incidents;
CREATE POLICY "Company members can view incidents"
  ON public.compliance_incidents FOR SELECT
  USING (public.user_belongs_to_company(auth.uid(), company_id));

DROP POLICY IF EXISTS "Admins can manage incidents" ON public.compliance_incidents;
CREATE POLICY "Admins can manage incidents"
  ON public.compliance_incidents FOR ALL
  USING (public.is_admin_or_above(auth.uid()) AND public.user_belongs_to_company(auth.uid(), company_id));

-- 6. compliance_notifications
DROP POLICY IF EXISTS "Admins can view company notifications" ON public.compliance_notifications;
CREATE POLICY "Admins can view company notifications"
  ON public.compliance_notifications FOR SELECT
  USING (public.is_admin_or_above(auth.uid()) AND public.user_belongs_to_company(auth.uid(), company_id));

DROP POLICY IF EXISTS "System can manage notifications" ON public.compliance_notifications;
CREATE POLICY "System can manage notifications"
  ON public.compliance_notifications FOR ALL
  USING (public.is_admin_or_above(auth.uid()) AND public.user_belongs_to_company(auth.uid(), company_id));

-- 7. certificate_downloads
DROP POLICY IF EXISTS "Admins can view company certificate downloads" ON public.certificate_downloads;
CREATE POLICY "Admins can view company certificate downloads"
  ON public.certificate_downloads FOR SELECT
  USING (is_admin_or_above(auth.uid()) AND user_belongs_to_company(auth.uid(), company_id));

DROP POLICY IF EXISTS "Admins can insert certificate downloads" ON public.certificate_downloads;
CREATE POLICY "Admins can insert certificate downloads"
  ON public.certificate_downloads FOR INSERT
  WITH CHECK (is_admin_or_above(auth.uid()) AND user_belongs_to_company(auth.uid(), company_id));

-- 8. employees (Fix loose policies from 20260105102432)
DROP POLICY IF EXISTS "Admins can manage employees" ON public.employees;
DROP POLICY IF EXISTS "Responsibles can view employees" ON public.employees;
DROP POLICY IF EXISTS "Employees can view own record" ON public.employees;

-- 9. time_events (Check for similar loose policies)
DROP POLICY IF EXISTS "Admins can view all events" ON public.time_events;
DROP POLICY IF EXISTS "Responsibles can view all events" ON public.time_events;
DROP POLICY IF EXISTS "Employees can view own events" ON public.time_events;

-- =========================================
-- END MIGRATION: 20260111000000_fix_rls_flipped_args.sql
-- =========================================


-- =========================================
-- BEGIN MIGRATION: 20260111000001_add_asesor_role.sql
-- =========================================


-- Add 'asesor' role to app_role enum
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'asesor';

-- Update is_admin_or_above to potentially include or exclude asesor depending on requirements
-- For now, let's keep it as is and create is_admin_or_asesor if needed
-- Actually, the user says "Asesor Laboral: acceso limitado y auditado".
-- Usually they should see what an admin sees but maybe not manage.

CREATE OR REPLACE FUNCTION public.is_admin_or_asesor(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role IN ('admin', 'super_admin', 'asesor')
  )
$$;

-- =========================================
-- END MIGRATION: 20260111000001_add_asesor_role.sql
-- =========================================


-- =========================================
-- BEGIN MIGRATION: 20260111000003_add_rule_templates.sql
-- =========================================

-- Add rule set templates and seeding logic
-- 1. Create Rule Set Templates
INSERT INTO public.rule_sets (id, name, description, sector, status, is_template)
VALUES 
  ('e0000000-0000-0000-0000-000000000001', 'Convenio Hostelería (Default)', 'Reglas base para el sector hostelería (Bar Pepe, etc.)', 'hostelería', 'published', true),
  ('e0000000-0000-0000-0000-000000000002', 'Convenio Sanidad (Default)', 'Reglas base para el sector sanidad (Clínica Vet, etc.)', 'sanidad', 'published', true),
  ('e0000000-0000-0000-0000-000000000003', 'Convenio Comercio (Default)', 'Reglas base para el sector comercio (Tienda Centro, etc.)', 'comercio', 'published', true);

-- 2. Create Rule Versions for Templates
-- Hostelería version
INSERT INTO public.rule_versions (id, rule_set_id, version, payload_json, published_at)
VALUES (
  'e0000000-0000-0000-0000-000000000011', 
  'e0000000-0000-0000-0000-000000000001', 
  '1.0.0', 
  '{
    "max_daily_hours": 9,
    "max_weekly_hours": 40,
    "min_daily_rest": 12,
    "min_weekly_rest": 36,
    "max_overtime_ytd": 80
  }'::jsonb,
  now()
);

-- Sanidad version
INSERT INTO public.rule_versions (id, rule_set_id, version, payload_json, published_at)
VALUES (
  'e0000000-0000-0000-0000-000000000012', 
  'e0000000-0000-0000-0000-000000000002', 
  '1.0.0', 
  '{
    "max_daily_hours": 8,
    "max_weekly_hours": 37.5,
    "min_daily_rest": 12,
    "min_weekly_rest": 48,
    "max_overtime_ytd": 80
  }'::jsonb,
  now()
);

-- Comercio version
INSERT INTO public.rule_versions (id, rule_set_id, version, payload_json, published_at)
VALUES (
  'e0000000-0000-0000-0000-000000000013', 
  'e0000000-0000-0000-0000-000000000003', 
  '1.0.0', 
  '{
    "max_daily_hours": 9,
    "max_weekly_hours": 40,
    "min_daily_rest": 12,
    "min_weekly_rest": 36,
    "max_overtime_ytd": 80
  }'::jsonb,
  now()
);

-- 3. Seeding RPC
CREATE OR REPLACE FUNCTION public.seed_default_rule_sets(p_company_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_sector TEXT;
    v_template_id UUID;
    v_new_rule_set_id UUID;
    v_version_id UUID;
    v_results JSONB := '[]'::jsonb;
BEGIN
    -- Get company sector
    SELECT sector INTO v_sector FROM public.company WHERE id = p_company_id;
    
    -- Find template by sector or fallback to first one
    SELECT id INTO v_template_id 
    FROM public.rule_sets 
    WHERE is_template = true 
    AND (sector = lower(v_sector) OR sector IS NULL)
    ORDER BY (sector = lower(v_sector)) DESC
    LIMIT 1;

    IF v_template_id IS NOT NULL THEN
        -- Clone Rule Set
        INSERT INTO public.rule_sets (company_id, name, description, sector, status, is_template)
        SELECT p_company_id, name || ' (Copy)', description, sector, 'active', false
        FROM public.rule_sets WHERE id = v_template_id
        RETURNING id INTO v_new_rule_set_id;

        -- Clone latest version
        INSERT INTO public.rule_versions (rule_set_id, version, payload_json, published_at, effective_from)
        SELECT v_new_rule_set_id, version, payload_json, now(), now()::date
        FROM public.rule_versions WHERE rule_set_id = v_template_id
        ORDER BY created_at DESC LIMIT 1
        RETURNING id INTO v_version_id;

        -- Assign to company level (priority 0)
        INSERT INTO public.rule_assignments (rule_version_id, company_id, priority, is_active)
        VALUES (v_version_id, p_company_id, 0, true);

        v_results := jsonb_build_object(
            'success', true,
            'rule_set_id', v_new_rule_set_id,
            'version_id', v_version_id,
            'sector', v_sector
        );
    ELSE
        v_results := jsonb_build_object('success', false, 'error', 'No templates found');
    END IF;

    RETURN v_results;
END;
$$;

-- =========================================
-- END MIGRATION: 20260111000003_add_rule_templates.sql
-- =========================================


-- =========================================
-- BEGIN MIGRATION: 20260111095528_8d92389b-7e62-4b19-b3be-d0b9af72d14f.sql
-- =========================================

-- =====================================================
-- MIGRACIÓN PARTE 1: Añadir rol asesor al enum
-- (El enum debe comitearse antes de usarse en funciones)
-- =====================================================

ALTER TYPE app_role ADD VALUE IF NOT EXISTS 'asesor';
-- =========================================
-- END MIGRATION: 20260111095528_8d92389b-7e62-4b19-b3be-d0b9af72d14f.sql
-- =========================================


-- =========================================
-- BEGIN MIGRATION: 20260111100213_ab761519-66a5-4b3a-8800-d61aabedd583.sql
-- =========================================

-- =====================================================
-- MIGRACIÓN PARTE 2: Políticas RLS para rol asesor
-- (Ahora que el enum 'asesor' está comiteado)
-- =====================================================

-- 1. Función helper para verificar si usuario es asesor de una empresa
CREATE OR REPLACE FUNCTION public.is_asesor_of_company(_user_id uuid, _company_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles ur
    JOIN public.user_company uc ON ur.user_id = uc.user_id
    WHERE ur.user_id = _user_id
      AND ur.role = 'asesor'
      AND uc.company_id = _company_id
  )
$$;

-- 2. Políticas RLS para asesor (solo lectura en tablas relevantes)

-- employees: asesor puede ver empleados de sus empresas asignadas
DROP POLICY IF EXISTS "asesor_can_view_assigned_company_employees" ON public.employees;
CREATE POLICY "asesor_can_view_assigned_company_employees" ON public.employees
  FOR SELECT
  TO authenticated
  USING (public.is_asesor_of_company(auth.uid(), company_id));

-- time_events: asesor puede ver fichajes de empresas asignadas
DROP POLICY IF EXISTS "asesor_can_view_assigned_company_events" ON public.time_events;
CREATE POLICY "asesor_can_view_assigned_company_events" ON public.time_events
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.employees e
      WHERE e.id = time_events.employee_id
        AND public.is_asesor_of_company(auth.uid(), e.company_id)
    )
  );

-- compliance_violations: asesor puede ver violaciones
DROP POLICY IF EXISTS "asesor_can_view_assigned_company_violations" ON public.compliance_violations;
CREATE POLICY "asesor_can_view_assigned_company_violations" ON public.compliance_violations
  FOR SELECT
  TO authenticated
  USING (public.is_asesor_of_company(auth.uid(), company_id));

-- compliance_incidents: asesor puede ver incidentes
DROP POLICY IF EXISTS "asesor_can_view_assigned_company_incidents" ON public.compliance_incidents;
CREATE POLICY "asesor_can_view_assigned_company_incidents" ON public.compliance_incidents
  FOR SELECT
  TO authenticated
  USING (public.is_asesor_of_company(auth.uid(), company_id));

-- rule_sets: asesor puede ver reglas
DROP POLICY IF EXISTS "asesor_can_view_assigned_company_rules" ON public.rule_sets;
CREATE POLICY "asesor_can_view_assigned_company_rules" ON public.rule_sets
  FOR SELECT
  TO authenticated
  USING (public.is_asesor_of_company(auth.uid(), company_id));

-- audit_log: asesor puede ver logs
DROP POLICY IF EXISTS "asesor_can_view_assigned_company_audit" ON public.audit_log;
CREATE POLICY "asesor_can_view_assigned_company_audit" ON public.audit_log
  FOR SELECT
  TO authenticated
  USING (public.is_asesor_of_company(auth.uid(), company_id));

-- absence_requests: asesor puede ver ausencias
DROP POLICY IF EXISTS "asesor_can_view_assigned_company_absences" ON public.absence_requests;
CREATE POLICY "asesor_can_view_assigned_company_absences" ON public.absence_requests
  FOR SELECT
  TO authenticated
  USING (public.is_asesor_of_company(auth.uid(), company_id));

-- correction_requests: asesor puede ver correcciones
DROP POLICY IF EXISTS "asesor_can_view_assigned_company_corrections" ON public.correction_requests;
CREATE POLICY "asesor_can_view_assigned_company_corrections" ON public.correction_requests
  FOR SELECT
  TO authenticated
  USING (public.is_asesor_of_company(auth.uid(), company_id));

-- company: asesor puede ver datos de empresas asignadas
DROP POLICY IF EXISTS "asesor_can_view_assigned_companies" ON public.company;
CREATE POLICY "asesor_can_view_assigned_companies" ON public.company
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.user_company uc
      JOIN public.user_roles ur ON uc.user_id = ur.user_id
      WHERE uc.user_id = auth.uid()
        AND uc.company_id = company.id
        AND ur.role = 'asesor'
    )
  );
-- =========================================
-- END MIGRATION: 20260111100213_ab761519-66a5-4b3a-8800-d61aabedd583.sql
-- =========================================


-- =========================================
-- BEGIN MIGRATION: 20260112030311_9c545219-63f8-4834-92dc-717d4fa8a603.sql
-- =========================================

-- Seed default absence types for all existing companies that don't have any
DO $$
DECLARE
  r RECORD;
  seeded_count INTEGER := 0;
BEGIN
  FOR r IN 
    SELECT c.id, c.name
    FROM company c
    LEFT JOIN absence_types at ON at.company_id = c.id
    GROUP BY c.id, c.name
    HAVING COUNT(at.id) = 0
  LOOP
    PERFORM seed_default_absence_types(r.id);
    seeded_count := seeded_count + 1;
    RAISE NOTICE 'Seeded absence types for company: %', r.name;
  END LOOP;
  
  RAISE NOTICE 'Total companies seeded: %', seeded_count;
END $$;
-- =========================================
-- END MIGRATION: 20260112030311_9c545219-63f8-4834-92dc-717d4fa8a603.sql
-- =========================================


-- =========================================
-- BEGIN MIGRATION: 20260112041103_372624e2-d2a7-47fb-ae10-8d4bd80af1f1.sql
-- =========================================

-- Ampliar tabla national_holidays para soportar festivos municipales
ALTER TABLE national_holidays 
  ADD COLUMN IF NOT EXISTS level TEXT DEFAULT 'national',
  ADD COLUMN IF NOT EXISTS province TEXT,
  ADD COLUMN IF NOT EXISTS municipality TEXT,
  ADD COLUMN IF NOT EXISTS island TEXT,
  ADD COLUMN IF NOT EXISTS source TEXT;

-- Actualizar registros existentes según su type
UPDATE national_holidays SET level = 'national' WHERE type = 'nacional' AND level IS NULL;
UPDATE national_holidays SET level = 'autonomous' WHERE type = 'autonomico' AND level IS NULL;

-- Índices para búsquedas eficientes
CREATE INDEX IF NOT EXISTS idx_national_holidays_level ON national_holidays(level);
CREATE INDEX IF NOT EXISTS idx_national_holidays_municipality ON national_holidays(municipality);
CREATE INDEX IF NOT EXISTS idx_national_holidays_province ON national_holidays(province);
CREATE INDEX IF NOT EXISTS idx_national_holidays_year_level ON national_holidays(year, level);
-- =========================================
-- END MIGRATION: 20260112041103_372624e2-d2a7-47fb-ae10-8d4bd80af1f1.sql
-- =========================================


-- =========================================
-- BEGIN MIGRATION: 20260206201500_a7b56cee-83d1-4110-934e-c81578237351.sql
-- =========================================

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


-- =========================================
-- END MIGRATION: 20260206201500_a7b56cee-83d1-4110-934e-c81578237351.sql
-- =========================================

