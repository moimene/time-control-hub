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