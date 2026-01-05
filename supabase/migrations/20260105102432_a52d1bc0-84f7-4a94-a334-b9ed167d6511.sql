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