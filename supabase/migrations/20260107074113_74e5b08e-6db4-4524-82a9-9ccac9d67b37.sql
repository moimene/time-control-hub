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