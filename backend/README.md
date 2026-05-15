# Damayan Backend

This backend is structured as three Nest.js processes:

- `src/main.ts`: HTTP API gateway for the frontend.
- `apps/auth-service/src/main.ts`: auth microservice for signup, login, forgot password, and reset password.
- `apps/operations-service/src/main.ts`: operations microservice for inventory, capacity, check-in, and dashboard data.

## Main Route Groups

- `POST /api/auth/signup`
- `POST /api/auth/login`
- `POST /api/auth/forgot-password`
- `POST /api/auth/reset-password`
- `GET /api/site-manager/dashboard`
- `GET /api/site-manager/inventory`
- `GET /api/site-manager/capacity`
- `GET /api/site-manager/organizations`
- `GET /api/site-manager/disaster-events`
- `GET /api/site-manager/dispatch-orders`
- `GET /api/site-manager/relief-operations`
- `GET /api/site-manager/incident-reports`
- `GET /api/site-manager/distributions`
- `GET /api/site-manager/citizens`
- `GET /api/site-manager/families`
- `GET /api/site-manager/check-ins`
- `GET /api/admin/dashboard`
- `GET /api/admin/inventory`
- `GET /api/admin/capacity`
- `GET /api/admin/organizations`
- `GET /api/admin/disaster-events`
- `GET /api/admin/dispatch-orders`
- `GET /api/admin/relief-operations`
- `GET /api/admin/incident-reports`
- `GET /api/admin/distributions`
- `GET /api/admin/citizens`
- `GET /api/admin/families`
- `GET /api/admin/check-ins`

## Environment Setup

1. Copy `.env.example` to `.env`.
2. Fill in the Supabase keys and your JWT secret.
3. Run the SQL in `database/damayan_schema.sql` in the Supabase SQL editor.
4. Run the SQL in `database/storage_policies.sql` in the Supabase SQL editor.
5. Install dependencies with `npm install`.

## Start Commands

Single terminal option (recommended):

```bash
npm run start:all
```

`start:all` now runs a stable startup profile. It auto-frees ports `3001`, `4001`, and `4002`, launches all three services, and auto-restarts any service that exits unexpectedly.

One-shot startup (no restart loop, useful for debugging):

```bash
npm run start:all:once
```

Stop all backend services:

```bash
npm run stop:all
```

Run each process in its own terminal:

```bash
npm run start:auth-service
npm run start:operations-service
npm run start:gateway
```

Important: run backend commands from the `backend` folder. Running `npm run start:all` from the repository root will fail because the root has no backend `package.json`.

## Notes

- The gateway uses JWT role claims to protect `admin` and `site-manager` routes. The `site-manager` route group maps to the `line_manager` role from Supabase.
- `rememberMe` is supported on login and extends token lifetime to 30 days.
- Password reset requests are stored in Supabase, which is safe for multiple service instances.
- Password reset delivery can be routed through a Supabase Edge Function by setting `SUPABASE_PASSWORD_RESET_FUNCTION_NAME`; the backend falls back to direct Resend/Twilio delivery if the function is not configured.
- Admin self-signup is disabled by default. Set `ALLOW_ADMIN_SELF_SIGNUP=true` only if you explicitly want it.
- The operations microservice now covers `organizations`, `disaster_events`, `dispatch_orders`, `relief_operations`, `incident_reports`, `relief_items`, `evacuation_centers`, `evacuees`, `distributions`, `distribution_items`, `register_citizens`, and `families`.
- Storage upload flow: request a signed upload URL from the gateway, upload the file directly to Supabase Storage, then save the returned `objectPath` into `cover_image_key` or `attachment_keys` using the related create/update endpoint.
- Government ID signup flow: request `POST /api/auth/uploads/government-id`, upload directly to the returned signed URL, then include `governmentIdKey` and `governmentIdFileName` in `POST /api/auth/signup`. Configure `SUPABASE_GOVERNMENT_IDS_BUCKET` for the storage bucket name.
