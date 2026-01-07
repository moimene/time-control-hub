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