-- Enable realtime for qtsp_audit_log to receive push notifications
ALTER PUBLICATION supabase_realtime ADD TABLE public.qtsp_audit_log;

-- Add retry tracking columns to dt_evidences for exponential backoff
ALTER TABLE public.dt_evidences 
ADD COLUMN IF NOT EXISTS next_retry_at TIMESTAMPTZ DEFAULT NULL,
ADD COLUMN IF NOT EXISTS last_retry_at TIMESTAMPTZ DEFAULT NULL,
ADD COLUMN IF NOT EXISTS backoff_seconds INTEGER DEFAULT 60;