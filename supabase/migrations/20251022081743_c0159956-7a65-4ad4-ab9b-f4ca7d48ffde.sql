-- Add delivered timestamp to messages table
ALTER TABLE public.messages 
ADD COLUMN IF NOT EXISTS delivered_at TIMESTAMP WITH TIME ZONE;

-- Create function to auto-delete delivered messages older than 5 minutes
CREATE OR REPLACE FUNCTION delete_old_messages()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  DELETE FROM public.messages
  WHERE delivered_at IS NOT NULL 
  AND delivered_at < NOW() - INTERVAL '5 minutes';
END;
$$;

-- Create function to auto-delete undelivered messages older than 24 hours
CREATE OR REPLACE FUNCTION delete_undelivered_messages()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  DELETE FROM public.messages
  WHERE delivered_at IS NULL 
  AND created_at < NOW() - INTERVAL '24 hours';
END;
$$;

-- Note: In production, you would set up pg_cron or call these functions periodically
-- For now, we'll call them when loading messages