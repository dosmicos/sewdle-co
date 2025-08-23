-- Fix UUID to hexadecimal conversion for sync locks by removing hyphens
-- This fixes the error: "-" is not a valid hexadecimal digit

CREATE OR REPLACE FUNCTION public.acquire_delivery_sync_lock(delivery_uuid uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  lock_key BIGINT;
BEGIN
  -- Convert UUID to a consistent bigint for pg_advisory_lock
  -- Remove hyphens from UUID before hexadecimal conversion
  lock_key := ('x' || substr(replace(delivery_uuid::text, '-', ''), 1, 15))::bit(60)::bigint;
  
  -- Try to acquire the lock (non-blocking)
  -- Returns true if lock was acquired, false if already held
  RETURN pg_try_advisory_lock(lock_key);
END;
$function$;

CREATE OR REPLACE FUNCTION public.check_delivery_sync_lock(delivery_uuid uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  lock_key BIGINT;
  lock_held BOOLEAN;
BEGIN
  -- Convert UUID to the same consistent bigint
  -- Remove hyphens from UUID before hexadecimal conversion
  lock_key := ('x' || substr(replace(delivery_uuid::text, '-', ''), 1, 15))::bit(60)::bigint;
  
  -- Check if lock is currently held by trying to acquire and immediately release
  -- If we can acquire it, it wasn't held (we release it and return false)
  -- If we can't acquire it, it was held (return true)
  lock_held := NOT pg_try_advisory_lock(lock_key);
  
  -- If we acquired it, release it immediately
  IF NOT lock_held THEN
    PERFORM pg_advisory_unlock(lock_key);
  END IF;
  
  RETURN lock_held;
END;
$function$;

CREATE OR REPLACE FUNCTION public.release_delivery_sync_lock(delivery_uuid uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  lock_key BIGINT;
BEGIN
  -- Convert UUID to the same consistent bigint
  -- Remove hyphens from UUID before hexadecimal conversion
  lock_key := ('x' || substr(replace(delivery_uuid::text, '-', ''), 1, 15))::bit(60)::bigint;
  
  -- Release the lock
  -- Returns true if lock was held and released, false if not held
  RETURN pg_advisory_unlock(lock_key);
END;
$function$;