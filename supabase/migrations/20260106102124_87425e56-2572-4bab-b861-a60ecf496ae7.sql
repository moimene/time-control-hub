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