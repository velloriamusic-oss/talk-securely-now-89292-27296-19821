-- Fix search_path for auto-delete functions
CREATE OR REPLACE FUNCTION delete_old_messages()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  DELETE FROM public.messages
  WHERE delivered_at IS NOT NULL 
  AND delivered_at < NOW() - INTERVAL '5 minutes';
END;
$$;

CREATE OR REPLACE FUNCTION delete_undelivered_messages()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  DELETE FROM public.messages
  WHERE delivered_at IS NULL 
  AND created_at < NOW() - INTERVAL '24 hours';
END;
$$;