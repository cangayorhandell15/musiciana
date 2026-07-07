-- Migration: add added_by_name to scores and backfill from available sources
-- Run this in Supabase SQL editor or via your migration system.

BEGIN;

-- 1) Add the column if it doesn't exist
ALTER TABLE public.scores
  ADD COLUMN IF NOT EXISTS added_by_name text;

-- 2) Backfill from queue.added_by_name when present (preserves any existing values)
UPDATE public.scores s
SET added_by_name = q.added_by_name
FROM public.queue q
WHERE s.user_id = q.added_by
  AND (s.added_by_name IS NULL OR s.added_by_name = '');

-- 3) Backfill from auth.users metadata.display_name when available
-- (auth.users is the Supabase auth table; adjust if you use a different users table)
DO $$
BEGIN
  -- Prefer `user_metadata` if present (newer Supabase installs), otherwise
  -- fall back to `raw_user_meta_data` (older installs).
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'auth' AND table_name = 'users' AND column_name = 'user_metadata'
  ) THEN
    UPDATE public.scores s
    SET added_by_name = u.user_metadata ->> 'display_name'
    FROM auth.users u
    WHERE s.user_id = u.id
      AND (s.added_by_name IS NULL OR s.added_by_name = '');

  ELSIF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'auth' AND table_name = 'users' AND column_name = 'raw_user_meta_data'
  ) THEN
    UPDATE public.scores s
    SET added_by_name = u.raw_user_meta_data ->> 'display_name'
    FROM auth.users u
    WHERE s.user_id = u.id
      AND (s.added_by_name IS NULL OR s.added_by_name = '');

  ELSE
    RAISE NOTICE 'No metadata column found on auth.users; skipping auth.users backfill.';
  END IF;
END;
$$ LANGUAGE plpgsql;

COMMIT;
