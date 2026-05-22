-- Admin-scoped region/persona phase controls.
-- Stores the effective calamity phase for a given persona inside a specific region.

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

-- Function: return GeoJSON for a single region boundary
CREATE OR REPLACE FUNCTION public.get_region_boundary_geojson(p_region_id uuid)
RETURNS text
LANGUAGE sql STABLE
AS $$
  SELECT ST_AsGeoJSON(boundary)::text FROM public.regions WHERE id = p_region_id;
$$;

-- Function: return all regions with GeoJSON boundary
CREATE OR REPLACE FUNCTION public.get_all_regions_geojson()
RETURNS TABLE(id uuid, name text, geojson json)
LANGUAGE sql STABLE
AS $$
  SELECT id, name, ST_AsGeoJSON(boundary)::json FROM public.regions ORDER BY name;
$$;

-- Simple sample shelters table (for admin/demo/testing) with lat/lng and region link
CREATE TABLE IF NOT EXISTS public.admin_sample_shelters (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  region_id uuid REFERENCES public.regions(id) ON DELETE CASCADE,
  name text NOT NULL,
  lat double precision NOT NULL,
  lng double precision NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT admin_sample_shelters_pkey PRIMARY KEY (id)
);

-- Insert a couple of sample shelters inside Makati if region exists and no shelters present
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

-- Insert a sample region for testing (Makati) if it doesn't already exist
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