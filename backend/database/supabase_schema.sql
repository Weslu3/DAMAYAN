-- WARNING: This schema is for context only and is not meant to be run.
-- Table order and constraints may not be valid for execution.

CREATE TABLE public.disaster_events (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  name text NOT NULL,
  type text NOT NULL CHECK (type = ANY (ARRAY['typhoon'::text, 'flood'::text, 'earthquake'::text, 'fire'::text, 'other'::text])),
  severity_level text NOT NULL CHECK (severity_level = ANY (ARRAY['low'::text, 'moderate'::text, 'high'::text, 'critical'::text])),
  affected_areas ARRAY NOT NULL DEFAULT '{}'::text[],
  province text NOT NULL,
  date_started date NOT NULL,
  date_ended date,
  status text NOT NULL DEFAULT 'monitoring'::text CHECK (status = ANY (ARRAY['active'::text, 'resolved'::text, 'monitoring'::text])),
  declared_by uuid NOT NULL,
  cover_image_key text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  notes text,
  CONSTRAINT disaster_events_pkey PRIMARY KEY (id)
);
CREATE TABLE public.dispatch_orders (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  report_id uuid NOT NULL,
  operation_id uuid NOT NULL,
  assigned_to uuid NOT NULL,
  priority text NOT NULL DEFAULT 'normal'::text CHECK (priority = ANY (ARRAY['low'::text, 'normal'::text, 'urgent'::text, 'critical'::text])),
  instructions text,
  status text NOT NULL DEFAULT 'pending'::text CHECK (status = ANY (ARRAY['pending'::text, 'accepted'::text, 'in_progress'::text, 'completed'::text])),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  disaster_id uuid NOT NULL,
  CONSTRAINT dispatch_orders_pkey PRIMARY KEY (id)
);
CREATE TABLE public.distribution_items (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  distribution_id uuid NOT NULL,
  item_id uuid NOT NULL,
  quantity_distributed integer NOT NULL DEFAULT 0,
  recipient_count integer NOT NULL DEFAULT 0,
  CONSTRAINT distribution_items_pkey PRIMARY KEY (id)
);
CREATE TABLE public.distributions (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  operation_id uuid NOT NULL,
  center_id uuid NOT NULL,
  distributed_by uuid NOT NULL,
  distribution_date date NOT NULL,
  notes text,
  status text NOT NULL DEFAULT 'scheduled'::text CHECK (status = ANY (ARRAY['scheduled'::text, 'completed'::text, 'cancelled'::text])),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT distributions_pkey PRIMARY KEY (id)
);
CREATE TABLE public.drm_alerts (
  id text NOT NULL,
  dispatcher_id uuid,
  scope text NOT NULL CHECK (scope = ANY (ARRAY['all'::text, 'barangay'::text, 'disaster'::text])),
  target text,
  title text NOT NULL,
  message text NOT NULL,
  severity text NOT NULL CHECK (severity = ANY (ARRAY['info'::text, 'warning'::text, 'critical'::text, 'evacuation'::text])),
  disaster_type text,
  evacuation_center text,
  instructions ARRAY,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT drm_alerts_pkey PRIMARY KEY (id),
  CONSTRAINT drm_alerts_dispatcher_id_fkey FOREIGN KEY (dispatcher_id) REFERENCES auth.users(id)
);
CREATE TABLE public.drm_sos (
  id text NOT NULL,
  sender_id text NOT NULL,
  barangay text,
  name text DEFAULT 'Anonymous'::text,
  message text NOT NULL,
  lat double precision,
  lng double precision,
  resolved boolean DEFAULT false,
  resolved_at timestamp with time zone,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT drm_sos_pkey PRIMARY KEY (id)
);
ALTER PUBLICATION supabase_realtime ADD TABLE public.drm_alerts;
ALTER PUBLICATION supabase_realtime ADD TABLE public.drm_sos;
CREATE TABLE public.evacuation_centers (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  name text NOT NULL,
  address text NOT NULL,
  barangay text NOT NULL,
  municipality text NOT NULL,
  capacity integer NOT NULL DEFAULT 0,
  current_occupancy integer NOT NULL DEFAULT 0,
  facilities ARRAY NOT NULL DEFAULT '{}'::text[],
  contact_person text,
  contact_phone text,
  status text NOT NULL DEFAULT 'open'::text CHECK (status = ANY (ARRAY['open'::text, 'full'::text, 'closed'::text])),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT evacuation_centers_pkey PRIMARY KEY (id)
);
CREATE TABLE public.evacuees (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  auth_user_id uuid NOT NULL,
  disaster_id uuid NOT NULL,
  center_id uuid NOT NULL,
  family_head text NOT NULL,
  family_size integer NOT NULL DEFAULT 1,
  special_needs text,
  check_in_date timestamp with time zone NOT NULL DEFAULT now(),
  check_out_date timestamp with time zone,
  status text NOT NULL DEFAULT 'checked_in'::text CHECK (status = ANY (ARRAY['checked_in'::text, 'checked_out'::text, 'transferred'::text])),
  CONSTRAINT evacuees_pkey PRIMARY KEY (id)
);
CREATE TABLE public.families (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  qr_code_id text NOT NULL,
  head_user_id uuid,
  created_at timestamp with time zone DEFAULT now(),
  head_full_name text,
  family_member_name text,
  relationship text,
  user_id uuid,
  family_member_count integer DEFAULT 1,
  age smallint,
  accessibility_needs text,
  CONSTRAINT families_pkey PRIMARY KEY (id),
  CONSTRAINT families_head_user_id_fkey FOREIGN KEY (head_user_id) REFERENCES auth.users(id),
  CONSTRAINT families_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id)
);
CREATE TABLE public.household_animals (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  qr_code_id text,
  name text,
  species text,
  needs_cage boolean DEFAULT false,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT household_animals_pkey PRIMARY KEY (id),
  CONSTRAINT household_animals_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id)
);
CREATE TABLE public.incident_reports (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  disaster_id uuid NOT NULL,
  reported_by uuid NOT NULL,
  title text NOT NULL,
  content text NOT NULL,
  severity text NOT NULL CHECK (severity = ANY (ARRAY['low'::text, 'moderate'::text, 'high'::text, 'critical'::text])),
  location text NOT NULL,
  attachment_keys ARRAY NOT NULL DEFAULT '{}'::text[],
  status text NOT NULL DEFAULT 'pending'::text CHECK (status = ANY (ARRAY['pending'::text, 'reviewed'::text, 'actioned'::text, 'closed'::text])),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT incident_reports_pkey PRIMARY KEY (id)
);
CREATE TABLE public.organizations (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  name text NOT NULL,
  type text NOT NULL CHECK (type = ANY (ARRAY['ngo'::text, 'lgu'::text, 'private'::text, 'government'::text])),
  contact_email text,
  contact_phone text,
  address text,
  verified boolean NOT NULL DEFAULT false,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT organizations_pkey PRIMARY KEY (id)
);
CREATE TABLE public.password_reset_requests (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  auth_user_id uuid NOT NULL,
  email text NOT NULL,
  token_hash text NOT NULL,
  status text NOT NULL DEFAULT 'pending'::text CHECK (status = ANY (ARRAY['pending'::text, 'used'::text, 'expired'::text])),
  expires_at timestamp with time zone NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  used_at timestamp with time zone,
  CONSTRAINT password_reset_requests_pkey PRIMARY KEY (id)
);
CREATE TABLE public.register_citizens (
  user_id uuid NOT NULL,
  birth_date date,
  gender text,
  registration_type text NOT NULL CHECK (registration_type = ANY (ARRAY['Individual'::text, 'Family'::text])),
  created_at timestamp with time zone DEFAULT now(),
  family_id uuid,
  full_name text,
  blood_type text,
  medical_conditions text,
  qr_code_id text,
  CONSTRAINT register_citizens_pkey PRIMARY KEY (user_id),
  CONSTRAINT register_citizens_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id),
  CONSTRAINT register_citizens_family_id_fkey FOREIGN KEY (family_id) REFERENCES public.families(id)
);
CREATE TABLE public.relief_items (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  operation_id uuid NOT NULL,
  item_name text NOT NULL,
  category text NOT NULL CHECK (category = ANY (ARRAY['food'::text, 'medicine'::text, 'clothing'::text, 'hygiene'::text, 'other'::text])),
  quantity integer NOT NULL DEFAULT 0,
  unit text NOT NULL,
  source text NOT NULL CHECK (source = ANY (ARRAY['donated'::text, 'procured'::text, 'reallocated'::text])),
  status text NOT NULL DEFAULT 'available'::text CHECK (status = ANY (ARRAY['available'::text, 'depleted'::text, 'reserved'::text])),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT relief_items_pkey PRIMARY KEY (id)
);
CREATE TABLE public.relief_operations (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  disaster_id uuid NOT NULL,
  name text NOT NULL,
  description text,
  start_date date NOT NULL,
  end_date date,
  lead_agency_id uuid,
  lead_officer_id uuid NOT NULL,
  status text NOT NULL DEFAULT 'planned'::text CHECK (status = ANY (ARRAY['planned'::text, 'ongoing'::text, 'completed'::text])),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT relief_operations_pkey PRIMARY KEY (id)
);
-- Singleton row (id=1) that holds the current disaster phase.
-- Enable Realtime on this table in the Supabase dashboard.
CREATE TABLE public.system_settings (
  id integer NOT NULL,
  current_phase text NOT NULL DEFAULT 'BEFORE' CHECK (current_phase = ANY (ARRAY['BEFORE'::text, 'DURING'::text, 'AFTER'::text])),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT system_settings_pkey PRIMARY KEY (id)
);
-- Seed the single settings row on first run
INSERT INTO public.system_settings (id, current_phase) VALUES (1, 'BEFORE') ON CONFLICT DO NOTHING;

-- Immutable audit log of every phase shift for post-disaster review
CREATE TABLE public.phase_history_logs (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  previous_phase text NOT NULL,
  new_phase text NOT NULL,
  changed_by text NOT NULL,
  changed_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT phase_history_logs_pkey PRIMARY KEY (id)
);

CREATE TABLE public.user_profiles (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  auth_user_id uuid NOT NULL UNIQUE,
  first_name text NOT NULL,
  last_name text NOT NULL,
  phone text,
  address text,
  barangay text,
  municipality text,
  province text,
  profile_photo_key text,
  role text NOT NULL CHECK (role = ANY (ARRAY['admin'::text, 'dispatcher'::text, 'line_manager'::text, 'citizen'::text])),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  status text NOT NULL DEFAULT 'pending'::text CHECK (status = ANY (ARRAY['pending'::text, 'active'::text, 'rejected'::text])),
  reject_reason text,
  CONSTRAINT user_profiles_pkey PRIMARY KEY (id)
);
