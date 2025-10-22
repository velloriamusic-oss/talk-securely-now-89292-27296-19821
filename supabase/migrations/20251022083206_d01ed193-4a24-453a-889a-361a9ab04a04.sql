-- Enable pg_cron extension for scheduled jobs
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Create scheduled jobs to clean up messages automatically
DO $do$
BEGIN
  -- Schedule delivered messages cleanup every minute
  IF NOT EXISTS (
    SELECT 1 FROM cron.job WHERE jobname = 'delete-old-messages'
  ) THEN
    PERFORM cron.schedule(
      'delete-old-messages',            -- job name
      '* * * * *',                      -- every minute
      'SELECT public.delete_old_messages();'
    );
  END IF;

  -- Schedule undelivered messages cleanup every hour
  IF NOT EXISTS (
    SELECT 1 FROM cron.job WHERE jobname = 'delete-undelivered-messages'
  ) THEN
    PERFORM cron.schedule(
      'delete-undelivered-messages',    -- job name
      '0 * * * *',                      -- at minute 0 of every hour
      'SELECT public.delete_undelivered_messages();'
    );
  END IF;
END
$do$;