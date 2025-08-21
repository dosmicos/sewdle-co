-- Fix search path security issues for the advisory lock functions
-- Add SET search_path TO '' to make them secure

-- Function to acquire an advisory lock for a delivery sync (SECURE VERSION)
CREATE OR REPLACE FUNCTION acquire_delivery_sync_lock(delivery_uuid UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
DECLARE
  lock_key BIGINT;
BEGIN
  -- Convert UUID to a consistent bigint for pg_advisory_lock
  lock_key := ('x' || substr(delivery_uuid::text, 1, 15))::bit(60)::bigint;
  
  -- Try to acquire the lock (non-blocking)
  -- Returns true if lock was acquired, false if already held
  RETURN pg_try_advisory_lock(lock_key);
END;
$$;

-- Function to release an advisory lock for a delivery sync (SECURE VERSION)
CREATE OR REPLACE FUNCTION release_delivery_sync_lock(delivery_uuid UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
DECLARE
  lock_key BIGINT;
BEGIN
  -- Convert UUID to the same consistent bigint
  lock_key := ('x' || substr(delivery_uuid::text, 1, 15))::bit(60)::bigint;
  
  -- Release the lock
  -- Returns true if lock was held and released, false if not held
  RETURN pg_advisory_unlock(lock_key);
END;
$$;

-- Function to check if a delivery sync lock is currently held (SECURE VERSION)
CREATE OR REPLACE FUNCTION check_delivery_sync_lock(delivery_uuid UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
DECLARE
  lock_key BIGINT;
  lock_held BOOLEAN;
BEGIN
  -- Convert UUID to the same consistent bigint
  lock_key := ('x' || substr(delivery_uuid::text, 1, 15))::bit(60)::bigint;
  
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
$$;