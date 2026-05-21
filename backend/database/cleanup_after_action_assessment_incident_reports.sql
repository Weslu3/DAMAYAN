-- One-time cleanup: remove legacy damage-focused after-action rows
-- Scope: only incident_reports rows created by the old after-action flow
-- Safe target: title = 'After-Action Assessment'

BEGIN;

-- 1) Preview rows that will be removed
SELECT
  id,
  disaster_id,
  reported_by,
  title,
  severity,
  location,
  status,
  created_at
FROM public.incident_reports
WHERE title = 'After-Action Assessment'
ORDER BY created_at DESC;

-- 2) Optional backup of affected rows before delete
-- Keep this backup table if you want rollback capability.
CREATE TABLE IF NOT EXISTS public.incident_reports_after_action_backup (
  id uuid PRIMARY KEY,
  disaster_id uuid NOT NULL,
  reported_by uuid NOT NULL,
  title text NOT NULL,
  content text NOT NULL,
  severity text NOT NULL,
  location text NOT NULL,
  attachment_keys text[] NOT NULL,
  status text NOT NULL,
  created_at timestamp with time zone NOT NULL,
  backed_up_at timestamp with time zone NOT NULL DEFAULT now()
);

INSERT INTO public.incident_reports_after_action_backup (
  id,
  disaster_id,
  reported_by,
  title,
  content,
  severity,
  location,
  attachment_keys,
  status,
  created_at
)
SELECT
  id,
  disaster_id,
  reported_by,
  title,
  content,
  severity,
  location,
  attachment_keys,
  status,
  created_at
FROM public.incident_reports
WHERE title = 'After-Action Assessment'
ON CONFLICT (id) DO NOTHING;

-- 3) Delete legacy rows
DELETE FROM public.incident_reports
WHERE title = 'After-Action Assessment';

-- 4) Verify cleanup result
SELECT count(*) AS remaining_after_action_rows
FROM public.incident_reports
WHERE title = 'After-Action Assessment';

COMMIT;
