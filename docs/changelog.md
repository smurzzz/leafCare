# Changelog

## Unreleased

### Added — Phase 0 (installation)

- Monorepo layout from `docs/architecture.md`: `apps/mobile` (Expo Router, TypeScript),
  `apps/api` (Next.js App Router, TypeScript) and `packages/shared`.
- `packages/shared` — the single source of truth for the HTTP contract (zod),
  timezone-aware schedule math, domain rules (status, streak, achievements,
  species care) and design tokens. Compiled to `dist/` so Next, Metro and `tsx`
  all consume the same code.
- Root npm workspaces with `api`, `mobile`, `typecheck`, `lint` and `seed` scripts.
- Environment templates: `.env.example`, `apps/api/.env.example`,
  `apps/mobile/.env.example`.

### Added — Phase 1 (backend)

- `apps/api/supabase/migrations/0001_init.sql` — every table from `docs/database.md`
  plus `reminder_log` for idempotent pushes: `profiles`, `notification_prefs`,
  `species_cache`, `plants`, `identifications`, `care_events`, `achievements`,
  enums, indexes, `updated_at` triggers, RLS policies reading the Clerk `sub`
  claim, and the private `plant-photos` bucket with per-user policies.
- Clerk bearer-token verification on every route except `/api/health` and the
  webhook (`apps/api/src/lib/auth.ts`).
- Endpoints from `docs/api.md`: `/api/health`, `/api/identify`,
  `/api/identify/:id`, `/api/species`, `/api/plants` (list/create),
  `/api/plants/:id` (get/patch/delete), `/api/plants/:id/water`,
  `/api/plants/:id/schedule/reset`, `/api/home`, `/api/reminders`,
  `/api/reminders/:plantId/{snooze,done}`, `/api/care-log`, `/api/me`,
  `/api/me/notifications`, `/api/me/push-token`, `/api/webhooks/clerk`.
- Server-side identification providers: Plant.id, Pl@ntNet and a deterministic
  `mock` used when no vendor key is configured, so the capture flow is testable
  without spend. Care defaults come from the curated species table and fall back
  to the documented 7 days / Bright indirect / Easy.
- Identify hardening: 8 MB limit, jpeg/png/heic only, 20 requests/hour/user rate
  limit, and the photo is dropped after identification (only the provider JSON is
  stored) to honour the "photos stay on your device" promise.
- Demo seed (`npm run seed --workspace @leafcare/api -- <clerk_user_id>`)
  reproducing Alex Morgan's six plants from `docs/database.md`.
- Reminder job (`POST /api/jobs/reminders`) with quiet hours 10:00 PM–7:00 AM,
  snooze presets, overdue nudges and `reminder_log` de-duplication.

### Added — Phase 2 (frontend)

- All 27 screens implemented in React Native with Expo Router, styled to the
  screenshots: splash, three onboarding slides, sign-up/log-in/verify/forgot
  password, Home, scan camera, identifying, result, low confidence, add plant,
  My Plants, plant detail, edit-schedule sheet, care log, reminders (filled and
  empty), notification settings, profile, settings, delete-account modal, camera
  permission, error, offline + skeleton and the success toast.
- Custom tab bar with the raised Scan FAB; SVG icon set and illustrations
  recreated from the UI kit (no stock artwork, no icon font).
- API client that attaches the Clerk session token and validates every response
  with the shared zod contracts, plus React Query hooks with AsyncStorage caching,
  optimistic mark-watered, an offline watering queue and the `{name} watered`
  toast.
- Theme (Light/System/Dark) and units (Metric/Imperial) providers wired to
  Settings and hydrated from `GET /api/me`; Metric/Imperial converts care-log
  volumes.
- `tests/shared-domain.test.mjs` covers `next_due_at`, overdue math, the 0.80
  identify threshold, streaks, achievements and ml↔oz conversion.
- `apps/api/tests/identify-provider.test.ts` covers the mock provider contract:
  determinism, descending scores, care enrichment and reachability of both
  confidence tiers.
- `npm test` runs both; `npm run typecheck` covers shared + api + mobile.

## 1.0.0 — planned

First student demo APK: identification, collection, watering, reminders, Clerk auth, matching the screenshot flows.