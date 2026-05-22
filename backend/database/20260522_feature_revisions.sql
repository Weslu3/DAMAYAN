-- Feature revisions: regions, shelter assignments, and dispatch geofencing.
-- Safe to run multiple times in Supabase SQL Editor.

CREATE TABLE IF NOT EXISTS public.regions (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  name text NOT NULL,
  boundary geometry(Polygon, 4326) NOT NULL,
  current_phase text NOT NULL DEFAULT 'beforecalamity' CHECK (
    current_phase = ANY (ARRAY['beforecalamity'::text, 'duringcalamity'::text, 'aftercalamity'::text])
  ),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT regions_pkey PRIMARY KEY (id)
);

CREATE INDEX IF NOT EXISTS regions_boundary_gist_idx
  ON public.regions
  USING gist (boundary);

ALTER TABLE public.user_profiles
  ADD COLUMN IF NOT EXISTS assigned_region_id uuid;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'user_profiles_assigned_region_id_fkey'
  ) THEN
    ALTER TABLE public.user_profiles
      ADD CONSTRAINT user_profiles_assigned_region_id_fkey
      FOREIGN KEY (assigned_region_id) REFERENCES public.regions(id)
      ON DELETE SET NULL;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS user_profiles_assigned_region_id_idx
  ON public.user_profiles (assigned_region_id);

ALTER TABLE public.evacuation_centers
  ADD COLUMN IF NOT EXISTS max_managers integer NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS description text;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'evacuation_centers_max_managers_check'
  ) THEN
    ALTER TABLE public.evacuation_centers
      ADD CONSTRAINT evacuation_centers_max_managers_check CHECK (max_managers > 0);
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.shelter_assignments (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  center_id uuid NOT NULL REFERENCES public.evacuation_centers(id) ON DELETE CASCADE,
  manager_id uuid NOT NULL REFERENCES public.user_profiles(auth_user_id) ON DELETE CASCADE,
  assigned_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT shelter_assignments_pkey PRIMARY KEY (id),
  CONSTRAINT shelter_assignments_manager_id_unique UNIQUE (manager_id),
  CONSTRAINT shelter_assignments_center_manager_unique UNIQUE (center_id, manager_id)
);

CREATE INDEX IF NOT EXISTS shelter_assignments_center_id_idx
  ON public.shelter_assignments (center_id);

ALTER TABLE public.dispatch_orders
  ADD COLUMN IF NOT EXISTS external_volunteer_id text;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'dispatch_orders_external_volunteer_id_fkey'
  ) THEN
    ALTER TABLE public.dispatch_orders
      ADD CONSTRAINT dispatch_orders_external_volunteer_id_fkey
      FOREIGN KEY (external_volunteer_id) REFERENCES public.drm_sos(id)
      ON DELETE SET NULL;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS dispatch_orders_external_volunteer_id_idx
  ON public.dispatch_orders (external_volunteer_id);

CREATE OR REPLACE FUNCTION public.is_sos_within_dispatcher_region(
  p_dispatcher_auth_user_id uuid,
  p_sos_id text
)
RETURNS boolean
LANGUAGE sql
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_profiles profiles
    JOIN public.regions regions
      ON regions.id = profiles.assigned_region_id
    JOIN public.drm_sos sos
      ON sos.id = p_sos_id
    WHERE profiles.auth_user_id = p_dispatcher_auth_user_id
      AND sos.lat IS NOT NULL
      AND sos.lng IS NOT NULL
      AND ST_Contains(
        regions.boundary,
        ST_SetSRID(ST_MakePoint(sos.lng, sos.lat), 4326)
      )
  );
$$;

-- Assign site managers and dispatchers to regions
CREATE TABLE IF NOT EXISTS public.region_assignments (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  region_id uuid NOT NULL REFERENCES public.regions(id) ON DELETE CASCADE,
  auth_user_id uuid NOT NULL REFERENCES public.user_profiles(auth_user_id) ON DELETE CASCADE,
  role text NOT NULL CHECK (
    role = ANY (ARRAY['site_manager'::text, 'dispatcher'::text])
  ),
  assigned_at timestamp with time zone NOT NULL DEFAULT now(),
  assigned_by uuid NULL REFERENCES public.user_profiles(auth_user_id) ON DELETE SET NULL,
  expires_at timestamp with time zone NULL,
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT region_assignments_pkey PRIMARY KEY (id),
  CONSTRAINT region_assignments_unique UNIQUE (region_id, auth_user_id, role)
);

CREATE INDEX IF NOT EXISTS region_assignments_region_id_idx
  ON public.region_assignments (region_id);

CREATE INDEX IF NOT EXISTS region_assignments_auth_user_id_idx
  ON public.region_assignments (auth_user_id);

CREATE INDEX IF NOT EXISTS region_assignments_role_idx
  ON public.region_assignments (role);

CREATE OR REPLACE FUNCTION public.region_assignments_set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'region_assignments_set_updated_at_trg'
  ) THEN
    CREATE TRIGGER region_assignments_set_updated_at_trg
    BEFORE UPDATE ON public.region_assignments
    FOR EACH ROW EXECUTE FUNCTION public.region_assignments_set_updated_at();
  END IF;
END $$;
