-- Add public_key column to profiles for E2E encryption
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS public_key TEXT;