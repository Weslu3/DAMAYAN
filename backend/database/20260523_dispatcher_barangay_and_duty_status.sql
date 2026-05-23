-- ─────────────────────────────────────────────────────────────────────────────
-- Migration: barangay_demographics table + duty_status on user_profiles
-- Created: 2026-05-23
-- Purpose: Replace hardcoded MOCK_BARANGAY_DATA and hardcoded team-status list
--          in the dispatcher persona with real Supabase-backed data.
--
-- Coordinates for each barangay are derived from ph_city_catalog using the
-- municipality name as the anchor, with per-barangay offsets applied so that
-- markers spread out on the map rather than stacking at the city centroid.
-- ─────────────────────────────────────────────────────────────────────────────

-- 1. Barangay demographics reference table
CREATE TABLE IF NOT EXISTS public.barangay_demographics (
  id            uuid             NOT NULL DEFAULT gen_random_uuid(),
  name          text             NOT NULL,
  population    integer          NOT NULL DEFAULT 0,
  density       integer          NOT NULL DEFAULT 0,  -- people / km²
  elderly       integer          NOT NULL DEFAULT 0,
  infants       integer          NOT NULL DEFAULT 0,
  risk_level    text             NOT NULL DEFAULT 'Low'
                  CHECK (risk_level = ANY (ARRAY['Low'::text, 'Medium'::text, 'High'::text])),
  lat           double precision NOT NULL,
  lng           double precision NOT NULL,
  municipality  text,
  created_at    timestamptz      NOT NULL DEFAULT now(),
  updated_at    timestamptz      NOT NULL DEFAULT now(),
  CONSTRAINT barangay_demographics_pkey PRIMARY KEY (id),
  CONSTRAINT barangay_demographics_name_municipality_unique UNIQUE (name, municipality)
);

-- Seed: Sampaloc / Manila reference barangays (Metro Cluster 3)
-- Coordinates pulled from ph_city_catalog for 'Manila'; each barangay gets a
-- fixed offset so markers are spread within the district on the map.
-- Falls back to the known Manila center (14.5958, 120.9772) when the catalog
-- row is absent.
-- city_name in ph_city_catalog is 'City of Manila' (psgc_code 133900000)
WITH manila_center AS (
  SELECT
    COALESCE(
      (SELECT latitude  FROM public.ph_city_catalog
       WHERE psgc_code = '133900000' LIMIT 1),
      14.5904
    ) AS base_lat,
    COALESCE(
      (SELECT longitude FROM public.ph_city_catalog
       WHERE psgc_code = '133900000' LIMIT 1),
      120.9804
    ) AS base_lng
),
barangays (name, population, density, elderly, infants, risk_level,
           offset_lat, offset_lng) AS (
  VALUES
    ('Brgy. 390',         5200, 45000, 450, 120, 'High',    0.0147::double precision, 0.0210::double precision),
    ('Brgy. 485',         3800, 32000, 280,  85, 'Medium',  0.0172::double precision, 0.0171::double precision),
    ('Brgy. 522',         6100, 51000, 510, 145, 'High',    0.0095::double precision, 0.0129::double precision),
    ('Brgy. 412',         4200, 38000, 320,  90, 'Medium',  0.0057::double precision, 0.0246::double precision),
    ('Brgy. Dona Imelda', 8500, 28000, 620, 180, 'Medium',  0.0114::double precision, 0.0266::double precision)
)
INSERT INTO public.barangay_demographics
  (name, population, density, elderly, infants, risk_level, lat, lng, municipality)
SELECT
  b.name,
  b.population,
  b.density,
  b.elderly,
  b.infants,
  b.risk_level,
  c.base_lat + b.offset_lat,
  c.base_lng + b.offset_lng,
  'Sampaloc, Manila'
FROM barangays b
CROSS JOIN manila_center c
ON CONFLICT (name, municipality) DO NOTHING;

-- 2. Add duty_status column to user_profiles (for line managers / site managers)
ALTER TABLE public.user_profiles
  ADD COLUMN IF NOT EXISTS duty_status text NOT NULL DEFAULT 'off_duty'
    CHECK (duty_status = ANY (ARRAY['on_duty'::text, 'off_duty'::text]));

-- Index for fast lookup of on-duty line managers by role
CREATE INDEX IF NOT EXISTS idx_user_profiles_role_duty
  ON public.user_profiles (role, duty_status);
