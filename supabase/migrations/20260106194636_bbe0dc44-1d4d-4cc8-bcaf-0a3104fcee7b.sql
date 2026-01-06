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