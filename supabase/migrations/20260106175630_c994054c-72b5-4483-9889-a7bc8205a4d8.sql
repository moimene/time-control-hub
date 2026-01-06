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