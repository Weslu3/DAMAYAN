-- Proposed production model for after-action assessments
-- Aligned with existing schema style:
-- - snake_case column names
-- - uuid PK with gen_random_uuid()
-- - text status fields with CHECK constraints
-- - created_at / updated_at timestamps
-- - FK links to existing disaster_events and auth.users

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

  -- Optional attachments (similar pattern to incident_reports.attachment_keys)
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

-- One draft/submission per user per disaster (prevents accidental duplicates)
CREATE UNIQUE INDEX after_action_assessments_disaster_reporter_uidx
  ON public.after_action_assessments (disaster_id, reported_by);

-- Query helpers for dashboard and admin review screens
CREATE INDEX after_action_assessments_disaster_status_idx
  ON public.after_action_assessments (disaster_id, status);

CREATE INDEX after_action_assessments_created_at_idx
  ON public.after_action_assessments (created_at DESC);

-- Keep updated_at current on every UPDATE
CREATE OR REPLACE FUNCTION public.set_after_action_assessments_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_after_action_assessments_updated_at
BEFORE UPDATE ON public.after_action_assessments
FOR EACH ROW
EXECUTE FUNCTION public.set_after_action_assessments_updated_at();
