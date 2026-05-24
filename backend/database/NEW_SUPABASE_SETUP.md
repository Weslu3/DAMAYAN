# New Supabase Setup (Schema + Seed + Auth Users)

This project already contains SQL files for the schema and incremental migrations.
Use this order in Supabase SQL Editor for a fresh database.

## Fastest one-shot option
If you want one copy-paste SQL run, use:
1. `backend/database/supabase_bootstrap_all_in_one.sql`

Then run the auth/data seeder script in step 4.

## 1. Run core schema
1. `backend/database/supabase_schema.sql`

## 2. Run required migrations
1. `backend/database/notifications_migration.sql`
2. `backend/database/family_groups_migration.sql`
3. `backend/database/user_profiles_rls_migration.sql`
4. `backend/database/supabase_missing_migrations.sql`

## 3. Run latest feature migrations
1. `backend/database/20260521_add_geo_coordinates.sql`
2. `backend/database/20260522_add_evacuation_coords.sql`
3. `backend/database/20260522_feature_revisions.sql`
4. `backend/database/20260522_region_persona_phase_controls.sql`
5. `backend/database/20260523_dispatcher_barangay_and_duty_status.sql`

## 4. Seed auth users and dummy data
From `backend/` run:

```bash
npx tsx scripts/seed_new_supabase.ts
```

The script reads:
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`

from your `backend/.env`.

## 5. Default seeded logins
- admin@damayan.local / Damayan123!
- dispatcher@damayan.local / Damayan123!
- sitemanager@damayan.local / Damayan123!
- citizen1@damayan.local / Damayan123!
- citizen2@damayan.local / Damayan123!

## Notes
- The seeder is idempotent for auth users and user profiles.
- It intentionally inserts only baseline data needed by auth, dashboard, and core operations tables.
- If a migration-specific table is not present, the seeder skips that table instead of failing.
