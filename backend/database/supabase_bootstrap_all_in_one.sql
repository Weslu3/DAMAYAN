-- DAMAYAN Supabase Bootstrap (all-in-one)
-- Run this whole script in Supabase SQL Editor on a NEW project.
-- It creates core schema + baseline seed rows needed by the backend.

BEGIN;

-- -----------------------------------------------------------------------------
-- Extensions
-- -----------------------------------------------------------------------------
CREATE SCHEMA IF NOT EXISTS extensions;
CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE EXTENSION IF NOT EXISTS postgis WITH SCHEMA extensions;

-- -----------------------------------------------------------------------------
-- Realtime helper
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.add_table_to_realtime(schema_name text, table_name text)
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = schema_name
      AND tablename = table_name
  ) THEN
    EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE %I.%I', schema_name, table_name);
  END IF;
END;
$$;

-- -----------------------------------------------------------------------------
-- Core app tables
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.system_settings (
  id integer PRIMARY KEY,
  current_phase text NOT NULL DEFAULT 'BEFORE'
    CHECK (current_phase = ANY (ARRAY['BEFORE','DURING','AFTER'])),
  updated_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO public.system_settings (id, current_phase)
VALUES (1, 'BEFORE')
ON CONFLICT (id) DO NOTHING;

CREATE TABLE IF NOT EXISTS public.phase_history_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  previous_phase text NOT NULL,
  new_phase text NOT NULL,
  changed_by text NOT NULL,
  changed_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.user_profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  auth_user_id uuid NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  first_name text NOT NULL,
  last_name text NOT NULL,
  phone text,
  address text,
  gender text,
  barangay text,
  municipality text,
  province text,
  profile_photo_key text,
  role text NOT NULL CHECK (role = ANY (ARRAY['admin','dispatcher','line_manager','citizen'])),
  status text NOT NULL DEFAULT 'pending' CHECK (status = ANY (ARRAY['pending','active','rejected'])),
  reject_reason text,
  assigned_region_id uuid,
  duty_status text NOT NULL DEFAULT 'off_duty' CHECK (duty_status = ANY (ARRAY['on_duty','off_duty'])),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.user_profiles
  ADD COLUMN IF NOT EXISTS gender text;

CREATE TABLE IF NOT EXISTS public.password_reset_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  auth_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  email text NOT NULL,
  token_hash text NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status = ANY (ARRAY['pending','used','expired'])),
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  used_at timestamptz
);

CREATE TABLE IF NOT EXISTS public.disaster_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  type text NOT NULL CHECK (type = ANY (ARRAY['typhoon','flood','earthquake','fire','other'])),
  severity_level text NOT NULL CHECK (severity_level = ANY (ARRAY['low','moderate','high','critical'])),
  affected_areas text[] NOT NULL DEFAULT '{}'::text[],
  province text NOT NULL,
  date_started date NOT NULL,
  date_ended date,
  status text NOT NULL DEFAULT 'monitoring' CHECK (status = ANY (ARRAY['active','resolved','monitoring'])),
  declared_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  cover_image_key text,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.relief_operations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  disaster_id uuid NOT NULL REFERENCES public.disaster_events(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  start_date date NOT NULL,
  end_date date,
  lead_agency_id uuid,
  lead_officer_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  status text NOT NULL DEFAULT 'planned' CHECK (status = ANY (ARRAY['planned','ongoing','completed'])),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.relief_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  operation_id uuid NOT NULL REFERENCES public.relief_operations(id) ON DELETE CASCADE,
  item_name text NOT NULL,
  category text NOT NULL CHECK (category = ANY (ARRAY['food','medicine','clothing','hygiene','other'])),
  quantity integer NOT NULL DEFAULT 0,
  unit text NOT NULL,
  source text NOT NULL CHECK (source = ANY (ARRAY['donated','procured','reallocated'])),
  status text NOT NULL DEFAULT 'available' CHECK (status = ANY (ARRAY['available','depleted','reserved'])),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.evacuation_centers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  address text NOT NULL,
  barangay text NOT NULL,
  municipality text NOT NULL,
  capacity integer NOT NULL DEFAULT 0,
  current_occupancy integer NOT NULL DEFAULT 0,
  facilities text[] NOT NULL DEFAULT '{}'::text[],
  contact_person text,
  contact_phone text,
  status text NOT NULL DEFAULT 'open' CHECK (status = ANY (ARRAY['open','full','closed'])),
  lat double precision,
  lng double precision,
  max_managers integer NOT NULL DEFAULT 1 CHECK (max_managers > 0),
  description text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.shelter_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  center_id uuid NOT NULL REFERENCES public.evacuation_centers(id) ON DELETE CASCADE,
  manager_id uuid NOT NULL REFERENCES public.user_profiles(auth_user_id) ON DELETE CASCADE,
  assigned_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT shelter_assignments_manager_id_unique UNIQUE (manager_id),
  CONSTRAINT shelter_assignments_center_manager_unique UNIQUE (center_id, manager_id)
);

CREATE TABLE IF NOT EXISTS public.organizations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  type text NOT NULL CHECK (type = ANY (ARRAY['ngo','lgu','private','government'])),
  contact_email text,
  contact_phone text,
  address text,
  verified boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.incident_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  disaster_id uuid NOT NULL REFERENCES public.disaster_events(id) ON DELETE CASCADE,
  reported_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  title text NOT NULL,
  content text NOT NULL,
  severity text NOT NULL CHECK (severity = ANY (ARRAY['low','moderate','high','critical'])),
  location text NOT NULL,
  attachment_keys text[] NOT NULL DEFAULT '{}'::text[],
  status text NOT NULL DEFAULT 'pending' CHECK (status = ANY (ARRAY['pending','reviewed','actioned','closed'])),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.dispatch_orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  report_id uuid NOT NULL REFERENCES public.incident_reports(id) ON DELETE CASCADE,
  operation_id uuid NOT NULL REFERENCES public.relief_operations(id) ON DELETE CASCADE,
  assigned_to uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  disaster_id uuid NOT NULL REFERENCES public.disaster_events(id) ON DELETE CASCADE,
  priority text NOT NULL DEFAULT 'normal' CHECK (priority = ANY (ARRAY['low','normal','urgent','critical'])),
  instructions text,
  status text NOT NULL DEFAULT 'pending' CHECK (status = ANY (ARRAY['pending','accepted','in_progress','completed'])),
  external_volunteer_id text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.distributions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  operation_id uuid NOT NULL REFERENCES public.relief_operations(id) ON DELETE CASCADE,
  center_id uuid NOT NULL REFERENCES public.evacuation_centers(id) ON DELETE CASCADE,
  distributed_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  distribution_date date NOT NULL,
  notes text,
  status text NOT NULL DEFAULT 'scheduled' CHECK (status = ANY (ARRAY['scheduled','completed','cancelled'])),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.distribution_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  distribution_id uuid NOT NULL REFERENCES public.distributions(id) ON DELETE CASCADE,
  item_id uuid NOT NULL REFERENCES public.relief_items(id) ON DELETE CASCADE,
  quantity_distributed integer NOT NULL DEFAULT 0,
  recipient_count integer NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS public.drm_sos (
  id text PRIMARY KEY,
  sender_id text NOT NULL,
  barangay text,
  name text DEFAULT 'Anonymous',
  message text NOT NULL,
  lat double precision,
  lng double precision,
  resolved boolean DEFAULT false,
  resolved_at timestamptz,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.drm_alerts (
  id text PRIMARY KEY,
  dispatcher_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  scope text NOT NULL CHECK (scope = ANY (ARRAY['all','barangay','disaster'])),
  target text,
  title text NOT NULL,
  message text NOT NULL,
  severity text NOT NULL CHECK (severity = ANY (ARRAY['info','warning','critical','evacuation'])),
  disaster_type text,
  evacuation_center text,
  instructions text[],
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.families (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  qr_code_id text NOT NULL UNIQUE,
  head_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now(),
  head_full_name text,
  family_member_name text,
  relationship text,
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  family_member_count integer DEFAULT 1,
  age smallint,
  accessibility_needs text
);

CREATE TABLE IF NOT EXISTS public.household_animals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  qr_code_id text,
  name text,
  species text,
  needs_cage boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.register_citizens (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  birth_date date,
  gender text,
  registration_type text NOT NULL CHECK (registration_type = ANY (ARRAY['Individual','Family'])),
  created_at timestamptz DEFAULT now(),
  family_id uuid REFERENCES public.families(id) ON DELETE SET NULL,
  full_name text,
  blood_type text,
  medical_conditions text,
  qr_code_id text
);

CREATE TABLE IF NOT EXISTS public.family_groups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  family_qr_code_id text NOT NULL UNIQUE,
  head_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  family_name text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.family_group_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  family_group_id uuid NOT NULL REFERENCES public.family_groups(id) ON DELETE CASCADE,
  citizen_qr_code_id text NOT NULL,
  member_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  member_full_name text,
  relationship text,
  added_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT family_group_members_unique_member UNIQUE (family_group_id, citizen_qr_code_id)
);

CREATE TABLE IF NOT EXISTS public.evacuees (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  auth_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  disaster_id uuid NOT NULL REFERENCES public.disaster_events(id) ON DELETE CASCADE,
  center_id uuid NOT NULL REFERENCES public.evacuation_centers(id) ON DELETE RESTRICT,
  family_head text NOT NULL,
  family_size integer NOT NULL DEFAULT 1,
  special_needs text,
  check_in_date timestamptz NOT NULL DEFAULT now(),
  check_out_date timestamptz,
  status text NOT NULL DEFAULT 'checked_in' CHECK (status = ANY (ARRAY['checked_in','checked_out','transferred']))
);

CREATE TABLE IF NOT EXISTS public.notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title text NOT NULL,
  body text NOT NULL,
  type text NOT NULL DEFAULT 'system',
  data jsonb,
  read boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- -----------------------------------------------------------------------------
-- Regions and geo support
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.regions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  boundary geometry(Polygon, 4326) NOT NULL,
  current_phase text NOT NULL DEFAULT 'beforecalamity' CHECK (current_phase = ANY (ARRAY['beforecalamity','duringcalamity','aftercalamity'])),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'regions'
      AND column_name = 'boundary'
  ) THEN
    ALTER TABLE public.regions
      ADD COLUMN boundary geometry(Polygon, 4326);
  ELSE
    ALTER TABLE public.regions
      ALTER COLUMN boundary TYPE geometry(Polygon, 4326)
      USING ST_Force2D(ST_SetSRID(boundary::geometry, 4326))::geometry(Polygon, 4326);
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.regions
    WHERE boundary IS NULL
  ) THEN
    ALTER TABLE public.regions
      ALTER COLUMN boundary SET NOT NULL;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'user_profiles_assigned_region_id_fkey'
  ) THEN
    ALTER TABLE public.user_profiles
      ADD CONSTRAINT user_profiles_assigned_region_id_fkey
      FOREIGN KEY (assigned_region_id)
      REFERENCES public.regions(id)
      ON DELETE SET NULL;
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.region_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  region_id uuid NOT NULL REFERENCES public.regions(id) ON DELETE CASCADE,
  auth_user_id uuid NOT NULL REFERENCES public.user_profiles(auth_user_id) ON DELETE CASCADE,
  role text NOT NULL CHECK (role = ANY (ARRAY['site_manager','dispatcher'])),
  assigned_at timestamptz NOT NULL DEFAULT now(),
  assigned_by uuid NULL REFERENCES public.user_profiles(auth_user_id) ON DELETE SET NULL,
  expires_at timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT region_assignments_unique UNIQUE (region_id, auth_user_id, role)
);

CREATE TABLE IF NOT EXISTS public.region_persona_phase_controls (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  region_id uuid NOT NULL REFERENCES public.regions(id) ON DELETE CASCADE,
  persona_role text NOT NULL CHECK (persona_role = ANY (ARRAY['admin','dispatcher','line_manager','citizen'])),
  phase text NOT NULL CHECK (phase = ANY (ARRAY['BEFORE','DURING','AFTER'])),
  visible_to_assigned_users boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT region_persona_phase_controls_region_persona_unique UNIQUE (region_id, persona_role)
);

CREATE TABLE IF NOT EXISTS public.admin_sample_shelters (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  region_id uuid REFERENCES public.regions(id) ON DELETE CASCADE,
  name text NOT NULL,
  lat double precision NOT NULL,
  lng double precision NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.ph_city_catalog (
  psgc_code text PRIMARY KEY,
  city_name text NOT NULL,
  province_name text,
  region_name text,
  latitude double precision,
  longitude double precision,
  region_id uuid REFERENCES public.regions(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.barangay_demographics (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  population integer NOT NULL DEFAULT 0,
  density integer NOT NULL DEFAULT 0,
  elderly integer NOT NULL DEFAULT 0,
  infants integer NOT NULL DEFAULT 0,
  risk_level text NOT NULL DEFAULT 'Low' CHECK (risk_level = ANY (ARRAY['Low','Medium','High'])),
  lat double precision NOT NULL,
  lng double precision NOT NULL,
  municipality text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT barangay_demographics_name_municipality_unique UNIQUE (name, municipality)
);

-- -----------------------------------------------------------------------------
-- Dispatcher support tables (queried by Bayanihub service)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.volunteer_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text,
  code text,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.volunteer_applications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  full_name text,
  email text,
  phone text,
  status text,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.volunteer_deployments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  volunteer_id uuid,
  assignment text,
  status text,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.volunteer_shifts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  volunteer_id uuid,
  shift_start timestamptz,
  shift_end timestamptz,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.volunteer_task_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  volunteer_id uuid,
  task_name text,
  status text,
  created_at timestamptz DEFAULT now()
);

-- -----------------------------------------------------------------------------
-- Indexes
-- -----------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS notifications_user_id_idx ON public.notifications (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS notifications_user_unread_idx ON public.notifications (user_id, read) WHERE read = false;
CREATE INDEX IF NOT EXISTS idx_user_profiles_role_duty ON public.user_profiles (role, duty_status);
CREATE INDEX IF NOT EXISTS regions_boundary_gist_idx ON public.regions USING gist (boundary);
CREATE INDEX IF NOT EXISTS user_profiles_assigned_region_id_idx ON public.user_profiles (assigned_region_id);
CREATE INDEX IF NOT EXISTS region_assignments_region_id_idx ON public.region_assignments (region_id);
CREATE INDEX IF NOT EXISTS region_assignments_auth_user_id_idx ON public.region_assignments (auth_user_id);
CREATE INDEX IF NOT EXISTS shelter_assignments_center_id_idx ON public.shelter_assignments (center_id);
CREATE INDEX IF NOT EXISTS dispatch_orders_external_volunteer_id_idx ON public.dispatch_orders (external_volunteer_id);

-- -----------------------------------------------------------------------------
-- Triggers for updated_at columns
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.touch_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_user_profiles_touch ON public.user_profiles;
CREATE TRIGGER trg_user_profiles_touch
BEFORE UPDATE ON public.user_profiles
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

DROP TRIGGER IF EXISTS trg_regions_touch ON public.regions;
CREATE TRIGGER trg_regions_touch
BEFORE UPDATE ON public.regions
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

DROP TRIGGER IF EXISTS trg_region_assignments_touch ON public.region_assignments;
CREATE TRIGGER trg_region_assignments_touch
BEFORE UPDATE ON public.region_assignments
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

DROP TRIGGER IF EXISTS trg_region_persona_phase_controls_touch ON public.region_persona_phase_controls;
CREATE TRIGGER trg_region_persona_phase_controls_touch
BEFORE UPDATE ON public.region_persona_phase_controls
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

DROP TRIGGER IF EXISTS trg_shelter_assignments_touch ON public.shelter_assignments;
CREATE TRIGGER trg_shelter_assignments_touch
BEFORE UPDATE ON public.shelter_assignments
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- -----------------------------------------------------------------------------
-- RLS baseline (safe for backend service-role usage)
-- -----------------------------------------------------------------------------
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own notifications" ON public.notifications;
CREATE POLICY "Users can view own notifications"
ON public.notifications
FOR SELECT
USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own notifications" ON public.notifications;
CREATE POLICY "Users can update own notifications"
ON public.notifications
FOR UPDATE
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

ALTER TABLE public.family_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.family_group_members ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Citizens manage own family groups" ON public.family_groups;
CREATE POLICY "Citizens manage own family groups"
ON public.family_groups
FOR ALL
USING (auth.uid() = head_user_id)
WITH CHECK (auth.uid() = head_user_id);

DROP POLICY IF EXISTS "Service role full access family_groups" ON public.family_groups;
CREATE POLICY "Service role full access family_groups"
ON public.family_groups
FOR ALL
USING (true)
WITH CHECK (true);

DROP POLICY IF EXISTS "Service role full access family_group_members" ON public.family_group_members;
CREATE POLICY "Service role full access family_group_members"
ON public.family_group_members
FOR ALL
USING (true)
WITH CHECK (true);

-- -----------------------------------------------------------------------------
-- Realtime registrations
-- -----------------------------------------------------------------------------
SELECT public.add_table_to_realtime('public', 'notifications');
SELECT public.add_table_to_realtime('public', 'drm_alerts');
SELECT public.add_table_to_realtime('public', 'drm_sos');

-- -----------------------------------------------------------------------------
-- Baseline seed rows (non-auth)
-- -----------------------------------------------------------------------------
INSERT INTO public.ph_city_catalog (psgc_code, city_name, province_name, region_name, latitude, longitude)
VALUES ('133900000', 'City of Manila', 'Metro Manila', 'NCR', 14.5904, 120.9804)
ON CONFLICT (psgc_code) DO NOTHING;

INSERT INTO public.barangay_demographics (name, population, density, elderly, infants, risk_level, lat, lng, municipality)
VALUES
  ('Brgy. 390', 5200, 45000, 450, 120, 'High', 14.6051, 120.9897, 'Sampaloc, Manila'),
  ('Brgy. 485', 3800, 32000, 280, 85, 'Medium', 14.6072, 120.9872, 'Sampaloc, Manila')
ON CONFLICT (name, municipality) DO NOTHING;

INSERT INTO public.evacuation_centers (
  name, address, barangay, municipality, capacity, current_occupancy, facilities,
  contact_person, contact_phone, status, lat, lng, max_managers, description
)
VALUES
  (
    'Sampaloc Evacuation Center A', 'Lacson Ave, Sampaloc, Manila', 'Sampaloc', 'Manila',
    300, 87, ARRAY['water','toilets','clinic'], 'Center Admin', '09170000003', 'open',
    14.6101, 120.9892, 2, 'Main center for north Sampaloc'
  ),
  (
    'Sampaloc Evacuation Center B', 'Espana Blvd, Sampaloc, Manila', 'Sampaloc', 'Manila',
    250, 140, ARRAY['water','food_station'], 'Center Admin', '09170000002', 'open',
    14.6048, 120.9885, 2, 'Overflow center'
  )
ON CONFLICT DO NOTHING;

INSERT INTO public.organizations (name, type, contact_email, contact_phone, address, verified)
SELECT s.name, s.type, s.contact_email, s.contact_phone, s.address, s.verified
FROM (
  VALUES
    ('Philippine Red Cross Manila', 'ngo', 'manila@redcross.example', '0289001001', 'Port Area, Manila', true),
    ('Sampaloc LGU DRRM', 'lgu', 'drrm@sampaloc.gov.ph', '0289001002', 'Sampaloc Municipal Hall, Manila', true),
    ('Bayanihan Logistics Inc.', 'private', 'ops@bayanihanlog.example', '0289001003', 'Sta. Cruz, Manila', false),
    ('DSWD Field Office NCR', 'government', 'ncr@dswd.gov.ph', '0289001004', 'Quezon City', true)
) AS s(name, type, contact_email, contact_phone, address, verified)
WHERE NOT EXISTS (
  SELECT 1 FROM public.organizations o WHERE o.name = s.name
);

INSERT INTO public.volunteer_roles (name, code)
SELECT s.name, s.code
FROM (
  VALUES
    ('Medical Responder', 'MED'),
    ('Logistics Support', 'LOG'),
    ('Evacuation Marshal', 'EVA'),
    ('Communications Aide', 'COMMS')
) AS s(name, code)
WHERE NOT EXISTS (
  SELECT 1 FROM public.volunteer_roles vr WHERE vr.code = s.code
);

INSERT INTO public.volunteer_applications (full_name, email, phone, status)
SELECT s.full_name, s.email, s.phone, s.status
FROM (
  VALUES
    ('Mica Santos', 'mica.santos@example.com', '09171110001', 'approved'),
    ('Paolo Reyes', 'paolo.reyes@example.com', '09171110002', 'pending'),
    ('Jessa Lim', 'jessa.lim@example.com', '09171110003', 'deployed'),
    ('Ramon Cruz', 'ramon.cruz@example.com', '09171110004', 'rejected')
) AS s(full_name, email, phone, status)
WHERE NOT EXISTS (
  SELECT 1 FROM public.volunteer_applications va WHERE lower(va.email) = lower(s.email)
);

INSERT INTO public.volunteer_deployments (volunteer_id, assignment, status)
SELECT va.id, s.assignment, s.status
FROM (
  VALUES
    ('mica.santos@example.com', 'Medical triage at Center A', 'active'),
    ('jessa.lim@example.com', 'Supply packing at warehouse', 'completed'),
    ('paolo.reyes@example.com', 'Road clearing support', 'queued')
) AS s(email, assignment, status)
JOIN public.volunteer_applications va ON lower(va.email) = lower(s.email)
WHERE NOT EXISTS (
  SELECT 1
  FROM public.volunteer_deployments vd
  WHERE vd.volunteer_id = va.id
    AND vd.assignment = s.assignment
);

INSERT INTO public.volunteer_shifts (volunteer_id, shift_start, shift_end)
SELECT va.id, s.shift_start, s.shift_end
FROM (
  VALUES
    ('mica.santos@example.com', now() - interval '4 hours', now() + interval '4 hours'),
    ('jessa.lim@example.com', now() - interval '1 day', now() - interval '20 hours')
) AS s(email, shift_start, shift_end)
JOIN public.volunteer_applications va ON lower(va.email) = lower(s.email)
WHERE NOT EXISTS (
  SELECT 1
  FROM public.volunteer_shifts vs
  WHERE vs.volunteer_id = va.id
    AND vs.shift_start = s.shift_start
);

INSERT INTO public.volunteer_task_assignments (volunteer_id, task_name, status)
SELECT va.id, s.task_name, s.status
FROM (
  VALUES
    ('mica.santos@example.com', 'Assist elderly check-in', 'in_progress'),
    ('jessa.lim@example.com', 'Inventory reconciliation', 'done'),
    ('paolo.reyes@example.com', 'Coordinate megaphone announcements', 'pending')
) AS s(email, task_name, status)
JOIN public.volunteer_applications va ON lower(va.email) = lower(s.email)
WHERE NOT EXISTS (
  SELECT 1
  FROM public.volunteer_task_assignments vta
  WHERE vta.volunteer_id = va.id
    AND vta.task_name = s.task_name
);

INSERT INTO public.phase_history_logs (previous_phase, new_phase, changed_by, changed_at)
SELECT s.previous_phase, s.new_phase, s.changed_by, s.changed_at
FROM (
  VALUES
    ('BEFORE', 'DURING', 'seed-script', now() - interval '3 days'),
    ('DURING', 'AFTER', 'seed-script', now() - interval '2 days'),
    ('AFTER', 'BEFORE', 'seed-script', now() - interval '1 day')
) AS s(previous_phase, new_phase, changed_by, changed_at)
WHERE NOT EXISTS (
  SELECT 1
  FROM public.phase_history_logs ph
  WHERE ph.previous_phase = s.previous_phase
    AND ph.new_phase = s.new_phase
    AND ph.changed_by = s.changed_by
);

-- -----------------------------------------------------------------------------
-- Simulation seed rows (auth-dependent)
-- NOTE:
--   This block populates operational tables if auth users exist.
--   Recommended auth users for full simulation:
--     admin@damayan.local
--     dispatcher@damayan.local
--     sitemanager@damayan.local
--     citizen1@damayan.local
--     citizen2@damayan.local
-- -----------------------------------------------------------------------------
DO $$
DECLARE
  v_admin uuid;
  v_dispatcher uuid;
  v_site_manager uuid;
  v_citizen1 uuid;
  v_citizen2 uuid;
  v_region uuid;
  v_disaster uuid;
  v_operation uuid;
  v_center_a uuid;
  v_center_b uuid;
  v_incident1 uuid;
  v_incident2 uuid;
  v_distribution uuid;
  v_family uuid;
  v_group uuid;
BEGIN
  SELECT id INTO v_admin FROM auth.users WHERE lower(email) = 'admin@damayan.local' LIMIT 1;
  SELECT id INTO v_dispatcher FROM auth.users WHERE lower(email) = 'dispatcher@damayan.local' LIMIT 1;
  SELECT id INTO v_site_manager FROM auth.users WHERE lower(email) = 'sitemanager@damayan.local' LIMIT 1;
  SELECT id INTO v_citizen1 FROM auth.users WHERE lower(email) = 'citizen1@damayan.local' LIMIT 1;
  SELECT id INTO v_citizen2 FROM auth.users WHERE lower(email) = 'citizen2@damayan.local' LIMIT 1;

  IF v_admin IS NULL THEN
    SELECT id INTO v_admin FROM auth.users ORDER BY created_at LIMIT 1;
  END IF;

  IF v_dispatcher IS NULL THEN
    SELECT id INTO v_dispatcher FROM auth.users WHERE id <> v_admin ORDER BY created_at LIMIT 1;
  END IF;

  IF v_site_manager IS NULL THEN
    SELECT id INTO v_site_manager
    FROM auth.users
    WHERE id NOT IN (COALESCE(v_admin, '00000000-0000-0000-0000-000000000000'::uuid), COALESCE(v_dispatcher, '00000000-0000-0000-0000-000000000000'::uuid))
    ORDER BY created_at
    LIMIT 1;
  END IF;

  IF v_citizen1 IS NULL THEN
    SELECT id INTO v_citizen1
    FROM auth.users
    WHERE id NOT IN (
      COALESCE(v_admin, '00000000-0000-0000-0000-000000000000'::uuid),
      COALESCE(v_dispatcher, '00000000-0000-0000-0000-000000000000'::uuid),
      COALESCE(v_site_manager, '00000000-0000-0000-0000-000000000000'::uuid)
    )
    ORDER BY created_at
    LIMIT 1;
  END IF;

  IF v_citizen2 IS NULL THEN
    SELECT id INTO v_citizen2
    FROM auth.users
    WHERE id NOT IN (
      COALESCE(v_admin, '00000000-0000-0000-0000-000000000000'::uuid),
      COALESCE(v_dispatcher, '00000000-0000-0000-0000-000000000000'::uuid),
      COALESCE(v_site_manager, '00000000-0000-0000-0000-000000000000'::uuid),
      COALESCE(v_citizen1, '00000000-0000-0000-0000-000000000000'::uuid)
    )
    ORDER BY created_at
    LIMIT 1;
  END IF;

  IF v_admin IS NULL THEN
    RAISE NOTICE 'No auth users found. Skipping auth-dependent simulation seed.';
    RETURN;
  END IF;

  INSERT INTO public.user_profiles (
    auth_user_id, first_name, last_name, phone, role, status, duty_status,
    barangay, municipality, province
  ) VALUES
    (v_admin, 'Alyssa', 'Admin', '09170000001', 'admin', 'active', 'off_duty', 'Sampaloc', 'Manila', 'Metro Manila')
  ON CONFLICT (auth_user_id) DO UPDATE SET
    role = EXCLUDED.role,
    status = EXCLUDED.status,
    updated_at = now();

  IF v_dispatcher IS NOT NULL THEN
    INSERT INTO public.user_profiles (
      auth_user_id, first_name, last_name, phone, role, status, duty_status,
      barangay, municipality, province
    ) VALUES
      (v_dispatcher, 'Diego', 'Dispatcher', '09170000002', 'dispatcher', 'active', 'on_duty', 'Sampaloc', 'Manila', 'Metro Manila')
    ON CONFLICT (auth_user_id) DO UPDATE SET
      role = EXCLUDED.role,
      status = EXCLUDED.status,
      duty_status = EXCLUDED.duty_status,
      updated_at = now();
  END IF;

  IF v_site_manager IS NOT NULL THEN
    INSERT INTO public.user_profiles (
      auth_user_id, first_name, last_name, phone, role, status, duty_status,
      barangay, municipality, province
    ) VALUES
      (v_site_manager, 'Mara', 'Manager', '09170000003', 'line_manager', 'active', 'on_duty', 'Sampaloc', 'Manila', 'Metro Manila')
    ON CONFLICT (auth_user_id) DO UPDATE SET
      role = EXCLUDED.role,
      status = EXCLUDED.status,
      duty_status = EXCLUDED.duty_status,
      updated_at = now();
  END IF;

  IF v_citizen1 IS NOT NULL THEN
    INSERT INTO public.user_profiles (
      auth_user_id, first_name, last_name, phone, role, status, duty_status,
      barangay, municipality, province
    ) VALUES
      (v_citizen1, 'Carlo', 'Citizen', '09170000004', 'citizen', 'active', 'off_duty', 'Sampaloc', 'Manila', 'Metro Manila')
    ON CONFLICT (auth_user_id) DO UPDATE SET
      role = EXCLUDED.role,
      status = EXCLUDED.status,
      updated_at = now();
  END IF;

  IF v_citizen2 IS NOT NULL THEN
    INSERT INTO public.user_profiles (
      auth_user_id, first_name, last_name, phone, role, status, duty_status,
      barangay, municipality, province
    ) VALUES
      (v_citizen2, 'Nina', 'Citizen', '09170000005', 'citizen', 'active', 'off_duty', 'Sampaloc', 'Manila', 'Metro Manila')
    ON CONFLICT (auth_user_id) DO UPDATE SET
      role = EXCLUDED.role,
      status = EXCLUDED.status,
      updated_at = now();
  END IF;

  SELECT id INTO v_region
  FROM public.regions
  WHERE name = 'Sampaloc Simulation Region'
  LIMIT 1;

  IF v_region IS NULL THEN
    INSERT INTO public.regions (name, boundary, current_phase)
    VALUES (
      'Sampaloc Simulation Region',
      ST_SetSRID(
        ST_GeomFromText('POLYGON((120.9720 14.6200, 121.0050 14.6200, 121.0050 14.5900, 120.9720 14.5900, 120.9720 14.6200))'),
        4326
      ),
      'duringcalamity'
    )
    RETURNING id INTO v_region;
  END IF;

  UPDATE public.user_profiles
  SET assigned_region_id = v_region, updated_at = now()
  WHERE auth_user_id IN (v_admin, v_dispatcher, v_site_manager)
    AND auth_user_id IS NOT NULL;

  IF v_dispatcher IS NOT NULL THEN
    INSERT INTO public.region_assignments (region_id, auth_user_id, role)
    VALUES (v_region, v_dispatcher, 'dispatcher')
    ON CONFLICT (region_id, auth_user_id, role) DO NOTHING;
  END IF;

  IF v_site_manager IS NOT NULL THEN
    INSERT INTO public.region_assignments (region_id, auth_user_id, role)
    VALUES (v_region, v_site_manager, 'site_manager')
    ON CONFLICT (region_id, auth_user_id, role) DO NOTHING;
  END IF;

  INSERT INTO public.region_persona_phase_controls (region_id, persona_role, phase, visible_to_assigned_users)
  VALUES
    (v_region, 'admin', 'DURING', true),
    (v_region, 'dispatcher', 'DURING', true),
    (v_region, 'line_manager', 'DURING', true),
    (v_region, 'citizen', 'DURING', true)
  ON CONFLICT (region_id, persona_role) DO UPDATE
    SET phase = EXCLUDED.phase,
        visible_to_assigned_users = EXCLUDED.visible_to_assigned_users,
        updated_at = now();

  SELECT id INTO v_disaster
  FROM public.disaster_events
  WHERE name = 'Typhoon Sample 2026'
  LIMIT 1;

  IF v_disaster IS NULL THEN
    INSERT INTO public.disaster_events (
      name, type, severity_level, affected_areas, province,
      date_started, status, declared_by, notes
    )
    VALUES (
      'Typhoon Sample 2026', 'typhoon', 'high', ARRAY['Manila', 'Quezon City'], 'Metro Manila',
      CURRENT_DATE, 'active', v_admin, 'Simulation disaster seed'
    )
    RETURNING id INTO v_disaster;
  END IF;

  SELECT id INTO v_operation
  FROM public.relief_operations
  WHERE name = 'Initial Relief Wave'
  LIMIT 1;

  IF v_operation IS NULL THEN
    INSERT INTO public.relief_operations (
      disaster_id, name, description, start_date, lead_officer_id, status
    )
    VALUES (
      v_disaster, 'Initial Relief Wave', 'Simulation relief operation', CURRENT_DATE, v_admin, 'ongoing'
    )
    RETURNING id INTO v_operation;
  END IF;

  INSERT INTO public.relief_items (operation_id, item_name, category, quantity, unit, source, status)
  VALUES
    (v_operation, 'Rice Packs', 'food', 500, 'packs', 'donated', 'available'),
    (v_operation, 'Bottled Water', 'food', 1000, 'bottles', 'procured', 'available'),
    (v_operation, 'Basic Medicines', 'medicine', 120, 'kits', 'procured', 'available')
  ON CONFLICT DO NOTHING;

  SELECT id INTO v_center_a FROM public.evacuation_centers WHERE name = 'Sampaloc Evacuation Center A' LIMIT 1;
  SELECT id INTO v_center_b FROM public.evacuation_centers WHERE name = 'Sampaloc Evacuation Center B' LIMIT 1;

  IF v_site_manager IS NOT NULL AND v_center_a IS NOT NULL THEN
    INSERT INTO public.shelter_assignments (center_id, manager_id)
    VALUES (v_center_a, v_site_manager)
    ON CONFLICT (manager_id) DO NOTHING;
  END IF;

  IF v_citizen1 IS NOT NULL THEN
    INSERT INTO public.incident_reports (
      disaster_id, reported_by, title, content, severity, location, status
    )
    VALUES (
      v_disaster,
      v_citizen1,
      'Flooded street near barangay hall',
      'Water is knee-deep and rising quickly.',
      'high',
      'Sampaloc, Manila',
      'pending'
    )
    ON CONFLICT DO NOTHING;
  END IF;

  IF v_citizen2 IS NOT NULL THEN
    INSERT INTO public.incident_reports (
      disaster_id, reported_by, title, content, severity, location, status
    )
    VALUES (
      v_disaster,
      v_citizen2,
      'Power outage in evacuation area',
      'No electricity for 3 hours around center perimeter.',
      'moderate',
      'Sampaloc, Manila',
      'reviewed'
    )
    ON CONFLICT DO NOTHING;
  END IF;

  SELECT id INTO v_incident1
  FROM public.incident_reports
  WHERE title = 'Flooded street near barangay hall'
  ORDER BY created_at DESC
  LIMIT 1;

  SELECT id INTO v_incident2
  FROM public.incident_reports
  WHERE title = 'Power outage in evacuation area'
  ORDER BY created_at DESC
  LIMIT 1;

  IF v_dispatcher IS NOT NULL AND v_incident1 IS NOT NULL THEN
    INSERT INTO public.dispatch_orders (
      report_id, operation_id, assigned_to, disaster_id, priority, instructions, status
    )
    VALUES (
      v_incident1,
      v_operation,
      v_dispatcher,
      v_disaster,
      'urgent',
      'Coordinate evac support and submit rapid assessment.',
      'in_progress'
    )
    ON CONFLICT DO NOTHING;
  END IF;

  IF v_dispatcher IS NOT NULL AND v_incident2 IS NOT NULL THEN
    INSERT INTO public.dispatch_orders (
      report_id, operation_id, assigned_to, disaster_id, priority, instructions, status
    )
    VALUES (
      v_incident2,
      v_operation,
      v_dispatcher,
      v_disaster,
      'normal',
      'Coordinate with utility responders.',
      'pending'
    )
    ON CONFLICT DO NOTHING;
  END IF;

  IF v_center_a IS NOT NULL THEN
    INSERT INTO public.distributions (
      operation_id, center_id, distributed_by, distribution_date, notes, status
    )
    VALUES (
      v_operation,
      v_center_a,
      v_admin,
      CURRENT_DATE,
      'Initial distribution batch for evacuees.',
      'completed'
    )
    ON CONFLICT DO NOTHING;
  END IF;

  SELECT id INTO v_distribution
  FROM public.distributions
  WHERE operation_id = v_operation
  ORDER BY created_at DESC
  LIMIT 1;

  IF v_distribution IS NOT NULL THEN
    INSERT INTO public.distribution_items (distribution_id, item_id, quantity_distributed, recipient_count)
    SELECT v_distribution, ri.id, 120, 80
    FROM public.relief_items ri
    WHERE ri.operation_id = v_operation
    LIMIT 2
    ON CONFLICT DO NOTHING;
  END IF;

  IF v_citizen1 IS NOT NULL THEN
    INSERT INTO public.families (qr_code_id, head_user_id, head_full_name, user_id, family_member_count, accessibility_needs)
    VALUES ('QR-FAMILY-0001', v_citizen1, 'Carlo Citizen', v_citizen1, 2, 'None')
    ON CONFLICT (qr_code_id) DO NOTHING;

    SELECT id INTO v_family FROM public.families WHERE qr_code_id = 'QR-FAMILY-0001' LIMIT 1;

    INSERT INTO public.register_citizens (user_id, registration_type, family_id, full_name, blood_type, medical_conditions, qr_code_id)
    VALUES (v_citizen1, 'Family', v_family, 'Carlo Citizen', 'O+', 'None', 'QR-CITIZEN-0001')
    ON CONFLICT (user_id) DO UPDATE SET
      family_id = EXCLUDED.family_id,
      full_name = EXCLUDED.full_name,
      qr_code_id = EXCLUDED.qr_code_id;
  END IF;

  IF v_citizen2 IS NOT NULL THEN
    INSERT INTO public.register_citizens (user_id, registration_type, family_id, full_name, blood_type, medical_conditions, qr_code_id)
    VALUES (v_citizen2, 'Individual', v_family, 'Nina Citizen', 'A+', 'Asthma', 'QR-CITIZEN-0002')
    ON CONFLICT (user_id) DO UPDATE SET
      family_id = EXCLUDED.family_id,
      full_name = EXCLUDED.full_name,
      qr_code_id = EXCLUDED.qr_code_id;

    INSERT INTO public.household_animals (user_id, qr_code_id, name, species, needs_cage)
    VALUES (v_citizen2, 'QR-ANIMAL-0001', 'Bantay', 'Dog', false)
    ON CONFLICT DO NOTHING;
  END IF;

  IF v_citizen1 IS NOT NULL THEN
    INSERT INTO public.family_groups (family_qr_code_id, head_user_id, family_name)
    VALUES ('QR-FAMILY-GROUP-0001', v_citizen1, 'Citizen Household')
    ON CONFLICT (family_qr_code_id) DO NOTHING;

    SELECT id INTO v_group FROM public.family_groups WHERE family_qr_code_id = 'QR-FAMILY-GROUP-0001' LIMIT 1;

    IF v_group IS NOT NULL AND v_citizen2 IS NOT NULL THEN
      INSERT INTO public.family_group_members (family_group_id, citizen_qr_code_id, member_user_id, member_full_name, relationship)
      VALUES (v_group, 'QR-CITIZEN-0002', v_citizen2, 'Nina Citizen', 'Sibling')
      ON CONFLICT (family_group_id, citizen_qr_code_id) DO NOTHING;
    END IF;
  END IF;

  IF v_citizen1 IS NOT NULL AND v_center_a IS NOT NULL THEN
    INSERT INTO public.evacuees (
      auth_user_id, disaster_id, center_id, family_head, family_size, special_needs, status
    )
    VALUES (
      v_citizen1, v_disaster, v_center_a, 'Carlo Citizen', 2, 'Elderly companion', 'checked_in'
    )
    ON CONFLICT DO NOTHING;
  END IF;

  IF v_dispatcher IS NOT NULL THEN
    INSERT INTO public.notifications (user_id, title, body, type, data, read)
    VALUES (
      v_dispatcher,
      'Dispatch Queue Updated',
      'Two active incidents are awaiting coordination.',
      'dispatch',
      jsonb_build_object('severity', 'high'),
      false
    )
    ON CONFLICT DO NOTHING;
  END IF;

  IF v_site_manager IS NOT NULL THEN
    INSERT INTO public.notifications (user_id, title, body, type, data, read)
    VALUES (
      v_site_manager,
      'Shelter Occupancy Alert',
      'Center B occupancy has reached 140/250.',
      'capacity',
      jsonb_build_object('center', 'Sampaloc Evacuation Center B'),
      false
    )
    ON CONFLICT DO NOTHING;
  END IF;

  IF v_dispatcher IS NOT NULL THEN
    INSERT INTO public.drm_alerts (
      id, dispatcher_id, scope, target, title, message, severity, instructions
    )
    VALUES (
      concat('ALERT-', extract(epoch FROM now())::bigint),
      v_dispatcher,
      'barangay',
      'Sampaloc',
      'Flood Advisory',
      'Moderate flooding expected in low-lying roads. Prepare evacuation support.',
      'warning',
      ARRAY['Avoid flooded roads', 'Proceed to nearest evacuation center']
    )
    ON CONFLICT DO NOTHING;
  END IF;

  IF v_citizen1 IS NOT NULL THEN
    INSERT INTO public.drm_sos (
      id, sender_id, barangay, name, message, lat, lng, resolved
    )
    VALUES (
      concat('SOS-', extract(epoch FROM now())::bigint),
      v_citizen1::text,
      'Sampaloc',
      'Carlo Citizen',
      'Need assistance for elderly evacuee.',
      14.6048,
      120.9885,
      false
    )
    ON CONFLICT DO NOTHING;
  END IF;

  INSERT INTO public.admin_sample_shelters (region_id, name, lat, lng)
  SELECT v_region, s.name, s.lat, s.lng
  FROM (
    VALUES
      ('Temporary Shelter - P. Campa School', 14.6079, 120.9904),
      ('Temporary Shelter - Earnshaw Covered Court', 14.6036, 120.9859),
      ('Temporary Shelter - UST Gym Annex', 14.6109, 120.9882)
  ) AS s(name, lat, lng)
  WHERE NOT EXISTS (
    SELECT 1 FROM public.admin_sample_shelters ash WHERE ash.region_id = v_region AND ash.name = s.name
  );

  IF v_citizen1 IS NOT NULL THEN
    INSERT INTO public.password_reset_requests (auth_user_id, email, token_hash, status, expires_at)
    SELECT v_citizen1, 'citizen1@damayan.local', 'seed-token-citizen1-pending', 'pending', now() + interval '2 hours'
    WHERE NOT EXISTS (
      SELECT 1 FROM public.password_reset_requests pr
      WHERE pr.auth_user_id = v_citizen1
        AND pr.token_hash = 'seed-token-citizen1-pending'
    );
  END IF;

  IF v_citizen2 IS NOT NULL THEN
    INSERT INTO public.password_reset_requests (auth_user_id, email, token_hash, status, expires_at, used_at)
    SELECT v_citizen2, 'citizen2@damayan.local', 'seed-token-citizen2-used', 'used', now() + interval '1 hour', now() - interval '30 minutes'
    WHERE NOT EXISTS (
      SELECT 1 FROM public.password_reset_requests pr
      WHERE pr.auth_user_id = v_citizen2
        AND pr.token_hash = 'seed-token-citizen2-used'
    );

    INSERT INTO public.password_reset_requests (auth_user_id, email, token_hash, status, expires_at)
    SELECT v_citizen2, 'citizen2@damayan.local', 'seed-token-citizen2-expired', 'expired', now() - interval '2 hours'
    WHERE NOT EXISTS (
      SELECT 1 FROM public.password_reset_requests pr
      WHERE pr.auth_user_id = v_citizen2
        AND pr.token_hash = 'seed-token-citizen2-expired'
    );
  END IF;

  INSERT INTO public.disaster_events (
    name, type, severity_level, affected_areas, province, date_started, date_ended, status, declared_by, notes
  )
  SELECT
    'Flood Drill Archive 2025', 'flood', 'moderate', ARRAY['Sampaloc'], 'Metro Manila',
    (CURRENT_DATE - 120), (CURRENT_DATE - 118), 'resolved', v_admin, 'Historical resolved event for dashboard trend testing.'
  WHERE NOT EXISTS (
    SELECT 1 FROM public.disaster_events d WHERE d.name = 'Flood Drill Archive 2025'
  );

  INSERT INTO public.disaster_events (
    name, type, severity_level, affected_areas, province, date_started, status, declared_by, notes
  )
  SELECT
    'Earthquake Monitoring Sample', 'earthquake', 'low', ARRAY['Manila'], 'Metro Manila',
    (CURRENT_DATE - 5), 'monitoring', v_admin, 'Monitoring-only case for phase transitions.'
  WHERE NOT EXISTS (
    SELECT 1 FROM public.disaster_events d WHERE d.name = 'Earthquake Monitoring Sample'
  );

  INSERT INTO public.relief_operations (
    disaster_id, name, description, start_date, end_date, lead_officer_id, status
  )
  SELECT
    d.id,
    'Post-Flood Recovery Batch',
    'Completed clean-up and hygiene distribution.',
    (CURRENT_DATE - 119),
    (CURRENT_DATE - 117),
    v_admin,
    'completed'
  FROM public.disaster_events d
  WHERE d.name = 'Flood Drill Archive 2025'
    AND NOT EXISTS (
      SELECT 1 FROM public.relief_operations ro WHERE ro.name = 'Post-Flood Recovery Batch'
    );

  IF v_center_b IS NOT NULL THEN
    INSERT INTO public.distributions (
      operation_id, center_id, distributed_by, distribution_date, notes, status
    )
    SELECT
      v_operation,
      v_center_b,
      v_admin,
      CURRENT_DATE + 1,
      'Scheduled second wave distribution.',
      'scheduled'
    WHERE NOT EXISTS (
      SELECT 1
      FROM public.distributions d
      WHERE d.operation_id = v_operation
        AND d.center_id = v_center_b
        AND d.status = 'scheduled'
    );

    INSERT INTO public.distributions (
      operation_id, center_id, distributed_by, distribution_date, notes, status
    )
    SELECT
      v_operation,
      v_center_b,
      v_admin,
      CURRENT_DATE - 1,
      'Cancelled run due to route obstruction.',
      'cancelled'
    WHERE NOT EXISTS (
      SELECT 1
      FROM public.distributions d
      WHERE d.operation_id = v_operation
        AND d.center_id = v_center_b
        AND d.status = 'cancelled'
    );
  END IF;

  IF v_citizen2 IS NOT NULL AND v_disaster IS NOT NULL AND v_center_b IS NOT NULL THEN
    INSERT INTO public.evacuees (
      auth_user_id, disaster_id, center_id, family_head, family_size, special_needs, check_in_date, check_out_date, status
    )
    SELECT
      v_citizen2,
      v_disaster,
      v_center_b,
      'Nina Citizen',
      1,
      'Asthma medication support',
      now() - interval '18 hours',
      now() - interval '3 hours',
      'checked_out'
    WHERE NOT EXISTS (
      SELECT 1 FROM public.evacuees e WHERE e.auth_user_id = v_citizen2 AND e.status = 'checked_out'
    );
  END IF;

  IF v_dispatcher IS NOT NULL THEN
    INSERT INTO public.notifications (user_id, title, body, type, data, read)
    SELECT
      v_dispatcher,
      'Route Cleared',
      'Main supply route to Center B is now passable.',
      'dispatch',
      jsonb_build_object('route', 'Lacson Ave', 'priority', 'normal'),
      true
    WHERE NOT EXISTS (
      SELECT 1
      FROM public.notifications n
      WHERE n.user_id = v_dispatcher
        AND n.title = 'Route Cleared'
    );
  END IF;

  IF v_dispatcher IS NOT NULL THEN
    INSERT INTO public.drm_alerts (
      id, dispatcher_id, scope, target, title, message, severity, instructions
    )
    SELECT
      'ALERT-SEED-EVAC-001',
      v_dispatcher,
      'all',
      'Metro Manila',
      'Evacuation Drill Notice',
      'Conducting drill in selected barangays this afternoon.',
      'info',
      ARRAY['Check assigned muster points', 'Report attendance by end of day']
    WHERE NOT EXISTS (
      SELECT 1 FROM public.drm_alerts da WHERE da.id = 'ALERT-SEED-EVAC-001'
    );
  END IF;

  IF v_citizen2 IS NOT NULL THEN
    INSERT INTO public.drm_sos (
      id, sender_id, barangay, name, message, lat, lng, resolved, resolved_at
    )
    SELECT
      'SOS-SEED-RESOLVED-001',
      v_citizen2::text,
      'Sampaloc',
      'Nina Citizen',
      'Requested transport support to center.',
      14.6062,
      120.9867,
      true,
      now() - interval '4 hours'
    WHERE NOT EXISTS (
      SELECT 1 FROM public.drm_sos s WHERE s.id = 'SOS-SEED-RESOLVED-001'
    );
  END IF;
END $$;

COMMIT;
