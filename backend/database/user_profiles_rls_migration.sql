-- Run this in the Supabase SQL Editor if user_profiles RLS is enabled.
-- The backend uses the service_role key which bypasses RLS automatically,
-- but these policies also allow users to manage their own profile row as
-- a fallback in case the client session state is ever used instead.

-- Enable RLS (safe to run even if already enabled)
ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;

-- Drop existing policies first (in case of partial state)
DROP POLICY IF EXISTS "user_profiles_select_own" ON public.user_profiles;
DROP POLICY IF EXISTS "user_profiles_insert_own" ON public.user_profiles;
DROP POLICY IF EXISTS "user_profiles_update_own" ON public.user_profiles;

-- Users can read their own profile
CREATE POLICY "user_profiles_select_own"
  ON public.user_profiles
  FOR SELECT
  USING (auth.uid() = auth_user_id);

-- Users can insert their own profile (signup flow)
CREATE POLICY "user_profiles_insert_own"
  ON public.user_profiles
  FOR INSERT
  WITH CHECK (auth.uid() = auth_user_id);

-- Users can update their own profile
CREATE POLICY "user_profiles_update_own"
  ON public.user_profiles
  FOR UPDATE
  USING (auth.uid() = auth_user_id)
  WITH CHECK (auth.uid() = auth_user_id);
