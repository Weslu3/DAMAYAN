-- Strict missing-only migration bundle for the live Supabase schema.

-- -----------------------------------------------------------------------------
-- Regions and region assignment support
-- -----------------------------------------------------------------------------
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

-- -----------------------------------------------------------------------------
-- Evacuation center geodata and region-linked sample shelters
-- -----------------------------------------------------------------------------
ALTER TABLE public.evacuation_centers
  ADD COLUMN IF NOT EXISTS lat double precision,
  ADD COLUMN IF NOT EXISTS lng double precision,
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

CREATE INDEX IF NOT EXISTS evacuation_centers_lat_lng_idx
  ON public.evacuation_centers (lat, lng);

CREATE TABLE IF NOT EXISTS public.admin_sample_shelters (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  region_id uuid REFERENCES public.regions(id) ON DELETE CASCADE,
  name text NOT NULL,
  lat double precision NOT NULL,
  lng double precision NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT admin_sample_shelters_pkey PRIMARY KEY (id)
);

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.regions WHERE name = 'Makati') THEN
    INSERT INTO public.regions (name, boundary, current_phase)
    VALUES (
      'Makati',
      ST_SetSRID(ST_GeomFromText('POLYGON((120.9822 14.5547, 121.0193 14.5547, 121.0193 14.5286, 120.9822 14.5286, 120.9822 14.5547))'), 4326),
      'beforecalamity'
    );
  END IF;
END $$;

DO $$
DECLARE
  makati_id uuid;
BEGIN
  SELECT id INTO makati_id FROM public.regions WHERE name = 'Makati' LIMIT 1;
  IF makati_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.admin_sample_shelters WHERE region_id = makati_id) THEN
    INSERT INTO public.admin_sample_shelters (region_id, name, lat, lng) VALUES
      (makati_id, 'Makati Central Evacuation Site', 14.5540, 121.0000),
      (makati_id, 'Poblacion Community Center', 14.5445, 121.0230);
  END IF;
END $$;

UPDATE public.evacuation_centers ec
SET lat = s.lat, lng = s.lng
FROM public.admin_sample_shelters s
WHERE ec.name = s.name
  AND (ec.lat IS NULL OR ec.lng IS NULL);

-- -----------------------------------------------------------------------------
-- Region persona controls and GeoJSON helpers
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.region_persona_phase_controls (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  region_id uuid NOT NULL REFERENCES public.regions(id) ON DELETE CASCADE,
  persona_role text NOT NULL CHECK (
    persona_role = ANY (ARRAY['admin'::text, 'dispatcher'::text, 'line_manager'::text, 'citizen'::text])
  ),
  phase text NOT NULL CHECK (
    phase = ANY (ARRAY['BEFORE'::text, 'DURING'::text, 'AFTER'::text])
  ),
  visible_to_assigned_users boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT region_persona_phase_controls_pkey PRIMARY KEY (id),
  CONSTRAINT region_persona_phase_controls_region_persona_unique UNIQUE (region_id, persona_role)
);

CREATE INDEX IF NOT EXISTS region_persona_phase_controls_region_id_idx
  ON public.region_persona_phase_controls (region_id);

CREATE INDEX IF NOT EXISTS region_persona_phase_controls_persona_role_idx
  ON public.region_persona_phase_controls (persona_role);

CREATE OR REPLACE FUNCTION public.get_region_persona_phase_audience(
  p_region_id uuid,
  p_persona_role text DEFAULT NULL
)
RETURNS TABLE (
  auth_user_id uuid,
  first_name text,
  last_name text,
  role text,
  assigned_region_id uuid
)
LANGUAGE sql
STABLE
AS $$
  SELECT
    profiles.auth_user_id,
    profiles.first_name,
    profiles.last_name,
    profiles.role,
    profiles.assigned_region_id
  FROM public.user_profiles profiles
  WHERE profiles.assigned_region_id = p_region_id
    AND (p_persona_role IS NULL OR profiles.role = p_persona_role)
  ORDER BY profiles.role, profiles.first_name, profiles.last_name;
$$;

CREATE OR REPLACE FUNCTION public.get_region_boundary_geojson(p_region_id uuid)
RETURNS text
LANGUAGE sql STABLE
AS $$
  SELECT ST_AsGeoJSON(boundary)::text FROM public.regions WHERE id = p_region_id;
$$;

CREATE OR REPLACE FUNCTION public.get_all_regions_geojson()
RETURNS TABLE(id uuid, name text, geojson json)
LANGUAGE sql STABLE
AS $$
  SELECT id, name, ST_AsGeoJSON(boundary)::json FROM public.regions ORDER BY name;
$$;

-- -----------------------------------------------------------------------------
-- Shelters, dispatch, and after-action assessment support
-- -----------------------------------------------------------------------------
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

CREATE TABLE public.after_action_assessments (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  disaster_id uuid NOT NULL,
  reported_by uuid NOT NULL,
  infra_status text NOT NULL CHECK (
    infra_status = ANY (
      ARRAY[
        'fully_restored'::text,
        'partially_restored'::text,
        'severely_degraded'::text,
        'non_functional'::text
      ]
    )
  ),
  estimated_cost integer NOT NULL DEFAULT 0 CHECK (estimated_cost >= 0),
  relief_needed integer NOT NULL DEFAULT 0 CHECK (relief_needed >= 0),
  duration_days integer NOT NULL DEFAULT 0 CHECK (duration_days >= 0),
  shelter_rating integer NOT NULL CHECK (shelter_rating BETWEEN 1 AND 5),
  success_notes text NOT NULL,
  bottlenecks text NOT NULL,
  attachment_keys text[] NOT NULL DEFAULT '{}'::text[],
  status text NOT NULL DEFAULT 'pending'::text CHECK (
    status = ANY (
      ARRAY['pending'::text, 'reviewed'::text, 'actioned'::text, 'closed'::text]
    )
  ),
  reviewed_by uuid,
  reviewed_at timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT after_action_assessments_pkey PRIMARY KEY (id),
  CONSTRAINT after_action_assessments_disaster_id_fkey
    FOREIGN KEY (disaster_id) REFERENCES public.disaster_events(id),
  CONSTRAINT after_action_assessments_reported_by_fkey
    FOREIGN KEY (reported_by) REFERENCES auth.users(id),
  CONSTRAINT after_action_assessments_reviewed_by_fkey
    FOREIGN KEY (reviewed_by) REFERENCES auth.users(id)
);

CREATE UNIQUE INDEX after_action_assessments_disaster_reporter_uidx
  ON public.after_action_assessments (disaster_id, reported_by);

CREATE INDEX after_action_assessments_disaster_status_idx
  ON public.after_action_assessments (disaster_id, status);

CREATE INDEX after_action_assessments_created_at_idx
  ON public.after_action_assessments (created_at DESC);

CREATE OR REPLACE FUNCTION public.set_after_action_assessments_updated_at()
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
    SELECT 1 FROM pg_trigger WHERE tgname = 'trg_after_action_assessments_updated_at'
  ) THEN
    CREATE TRIGGER trg_after_action_assessments_updated_at
    BEFORE UPDATE ON public.after_action_assessments
    FOR EACH ROW
    EXECUTE FUNCTION public.set_after_action_assessments_updated_at();
  END IF;
END $$;

-- -----------------------------------------------------------------------------
-- Nationwide city catalog + automatic assignment by municipality/province
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.ph_city_catalog (
  psgc_code text PRIMARY KEY,
  city_name text NOT NULL,
  province_name text,
  region_name text,
  latitude double precision,
  longitude double precision,
  region_id uuid REFERENCES public.regions(id) ON DELETE SET NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ph_city_catalog_city_idx
  ON public.ph_city_catalog (city_name);

CREATE INDEX IF NOT EXISTS ph_city_catalog_province_idx
  ON public.ph_city_catalog (province_name);

CREATE INDEX IF NOT EXISTS ph_city_catalog_region_id_idx
  ON public.ph_city_catalog (region_id);

CREATE OR REPLACE FUNCTION public.normalize_place_text(v text)
RETURNS text
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT NULLIF(
    trim(
      regexp_replace(
        lower(coalesce(v, '')),
        '[^a-z0-9]+',
        ' ',
        'g'
      )
    ),
    ''
  );
$$;

CREATE OR REPLACE FUNCTION public.ensure_city_region(
  p_psgc_code text,
  p_city_name text,
  p_province_name text,
  p_region_name text,
  p_latitude double precision,
  p_longitude double precision,
  p_radius_km double precision DEFAULT 7
)
RETURNS uuid
LANGUAGE plpgsql
AS $$
DECLARE
  v_region_id uuid;
  v_region_label text;
BEGIN
  IF p_city_name IS NULL OR p_longitude IS NULL OR p_latitude IS NULL THEN
    RETURN NULL;
  END IF;

  v_region_label := trim(
    both ', ' from concat_ws(', ', p_city_name, NULLIF(p_province_name, ''))
  );

  SELECT id INTO v_region_id
  FROM public.regions
  WHERE lower(name) = lower(v_region_label)
  LIMIT 1;

  IF v_region_id IS NULL THEN
    INSERT INTO public.regions (name, boundary, current_phase)
    VALUES (
      v_region_label,
      ST_Buffer(
        ST_SetSRID(ST_MakePoint(p_longitude, p_latitude), 4326)::geography,
        GREATEST(1, COALESCE(p_radius_km, 7)) * 1000
      )::geometry,
      'beforecalamity'
    )
    RETURNING id INTO v_region_id;
  END IF;

  INSERT INTO public.ph_city_catalog (
    psgc_code,
    city_name,
    province_name,
    region_name,
    latitude,
    longitude,
    region_id,
    updated_at
  )
  VALUES (
    p_psgc_code,
    p_city_name,
    p_province_name,
    p_region_name,
    p_latitude,
    p_longitude,
    v_region_id,
    now()
  )
  ON CONFLICT (psgc_code)
  DO UPDATE SET
    city_name = EXCLUDED.city_name,
    province_name = EXCLUDED.province_name,
    region_name = EXCLUDED.region_name,
    latitude = EXCLUDED.latitude,
    longitude = EXCLUDED.longitude,
    region_id = EXCLUDED.region_id,
    updated_at = now();

  RETURN v_region_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.sync_city_catalog_to_regions(
  p_radius_km double precision DEFAULT 7
)
RETURNS integer
LANGUAGE plpgsql
AS $$
DECLARE
  r RECORD;
  v_count integer := 0;
BEGIN
  FOR r IN
    SELECT psgc_code, city_name, province_name, region_name, latitude, longitude
    FROM public.ph_city_catalog
    WHERE latitude IS NOT NULL
      AND longitude IS NOT NULL
  LOOP
    PERFORM public.ensure_city_region(
      r.psgc_code,
      r.city_name,
      r.province_name,
      r.region_name,
      r.latitude,
      r.longitude,
      p_radius_km
    );
    v_count := v_count + 1;
  END LOOP;

  RETURN v_count;
END;
$$;

CREATE OR REPLACE FUNCTION public.assign_region_from_profile_address()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  v_region_id uuid;
  v_city text;
  v_province text;
BEGIN
  IF NEW.assigned_region_id IS NOT NULL THEN
    RETURN NEW;
  END IF;

  v_city := public.normalize_place_text(NEW.municipality);
  v_province := public.normalize_place_text(NEW.province);

  IF v_city IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT c.region_id
  INTO v_region_id
  FROM public.ph_city_catalog c
  WHERE public.normalize_place_text(c.city_name) = v_city
    AND (
      v_province IS NULL
      OR public.normalize_place_text(c.province_name) = v_province
      OR c.province_name IS NULL
    )
    AND c.region_id IS NOT NULL
  ORDER BY
    CASE
      WHEN v_province IS NOT NULL AND public.normalize_place_text(c.province_name) = v_province THEN 0
      ELSE 1
    END,
    c.updated_at DESC
  LIMIT 1;

  IF v_region_id IS NULL THEN
    SELECT r.id
    INTO v_region_id
    FROM public.regions r
    WHERE lower(r.name) = lower(trim(both ', ' from concat_ws(', ', NEW.municipality, NEW.province)))
       OR lower(r.name) = lower(NEW.municipality)
    LIMIT 1;
  END IF;

  IF v_region_id IS NOT NULL THEN
    NEW.assigned_region_id := v_region_id;
  END IF;

  RETURN NEW;
END;
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'trg_user_profiles_auto_assign_region'
  ) THEN
    CREATE TRIGGER trg_user_profiles_auto_assign_region
    BEFORE INSERT OR UPDATE OF municipality, province, assigned_region_id
    ON public.user_profiles
    FOR EACH ROW
    EXECUTE FUNCTION public.assign_region_from_profile_address();
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.backfill_user_profile_regions_from_city_catalog()
RETURNS integer
LANGUAGE plpgsql
AS $$
DECLARE
  v_updated integer := 0;
BEGIN
  UPDATE public.user_profiles up
  SET
    assigned_region_id = c.region_id,
    updated_at = now()
  FROM public.ph_city_catalog c
  WHERE up.assigned_region_id IS NULL
    AND c.region_id IS NOT NULL
    AND public.normalize_place_text(up.municipality) = public.normalize_place_text(c.city_name)
    AND (
      up.province IS NULL
      OR public.normalize_place_text(up.province) = public.normalize_place_text(c.province_name)
      OR c.province_name IS NULL
    );

  GET DIAGNOSTICS v_updated = ROW_COUNT;
  RETURN v_updated;
END;
$$;

SELECT count(*) AS remaining_after_action_rows
FROM public.incident_reports
WHERE title = 'After-Action Assessment';

COMMIT;
