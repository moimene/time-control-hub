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