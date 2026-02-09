
-- Fix linter issues:
-- 1. Drop the SECURITY DEFINER view (linter error) - we'll use the function instead
DROP VIEW IF EXISTS public.user_ringcentral_tokens_safe;

-- 2. The RLS "no policy" warning is about INSERT/UPDATE which we intentionally removed
-- (edge functions use service_role). But let's be explicit with a "deny all" approach
-- by NOT adding policies - RLS is enabled so no client INSERT/UPDATE is possible.
-- This is the desired behavior.
