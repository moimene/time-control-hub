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