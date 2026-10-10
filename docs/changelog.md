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

## Unreleased — live-credential verification

First run against real Clerk, Supabase and PlantNet keys. Fixes found by turning the
services on:

- **Expired or forged session tokens returned 500 instead of 401.** Clerk's verifier
  throws `TokenVerificationError`, which nothing mapped, so the generic handler reported a
  server fault and logged an unhandled error for what is a routine client problem. Only
  genuine JWKS-reachability reasons stay a 503, so a transient Clerk outage cannot sign a
  working user out.
- **Pl@ntNet `404 Species not found` was reported as a 502 upstream failure.** That is a
  legitimate "no match" answer; it now returns zero suggestions so the caller can use the
  no-match path instead of telling the user the server broke.
- **`tsx` scripts could not see any env file.** Next.js loads `.env.local` on its own but
  `tsx` loads nothing, so `npm run seed` and the reminder job saw an empty environment.
  Both now load `apps/api/.env.local`, then `.env`, then the repo root.
- **The identify test depended on ambient env.** It asserted the mock provider without
  pinning `IDENTIFY_PROVIDER`, so exporting a vendor key broke it.

- **A photo the vendor cannot name was a dead end.** The identify response now allows
  `top: null`, so a no-match lands on the uncertain screen (12) with tips, Retake and Search
  manually instead of the error screen (25).

Verified once the schema was applied: all eight tables and the `plant-photos` bucket exist,
and `POST /api/jobs/reminders` returns `{"ok":true,"sent":0,"users":0}` against the live
database (0 users have a push token yet) while a wrong `x-cron-secret` still gets a 403.

## Unreleased — signed-in verification

The demo account is seeded and the whole signed-in surface is exercised end to end:

- `npm run smoke --workspace @leafcare/api -- <clerk_user_id>` mints a real Clerk session
  and validates every endpoint against the client's own zod contracts (10/10). Home matches
  the screenshots: `dueCount=3` with Ficus `Overdue 2d`.
- Marking watered persists — Ficus reads back as `upcoming` rather than trusting the write
  response.
- RLS confirmed against the live database: the publishable key that ships in the app sees
  0 rows where the service role sees 6 plants, 1 profile and 31 care events.
- The no-match branch is exercised end to end: an unmatchable photo returns `200` with
  `top: null` and `threshold: "low"` (previously `422`), and the row is stored as
  `succeeded` with empty suggestions rather than `failed`.

Added:

- `npm run doctor --workspace @leafcare/api` — probes Supabase REST, the photo bucket,
  Clerk and the identify provider and explains each failure in terms of the fix.
- `npm run identify:fixture --workspace @leafcare/api -- <image>` — runs the real vendor
  path against a photo, the only way to validate a key before a demo.
- `npm run check:secrets` — fails if a credential is ever written into a tracked file,
  which is how a live `CRON_SECRET` nearly reached `.env.example`.

## Unreleased — EAS project link and native permission trim

`eas init` created **@henry26/leafcare** and wrote the real `extra.eas.projectId`, replacing the
all-zeros placeholder that made `eas build` refuse the project. The same id now sits in
`apps/mobile/.env` as `EXPO_PUBLIC_PROJECT_ID`, which is the value `getExpoPushTokenAsync` reads,
so push registration can resolve the project instead of failing on device.

Opening the config to do that exposed two native permissions the app was requesting for free:

- **A plant app was asking for the microphone.** `expo-camera` and `expo-image-picker` add
  `RECORD_AUDIO` by default because they can capture video with sound; LeafCare only photographs
  leaves. `microphonePermission: false` deletes `NSMicrophoneUsageDescription` on iOS and blocks
  the Android permission with `tools:node="remove"`, so no other package can silently re-add it.
- **`expo-camera` bundled ML Kit barcode scanning**, a native dependency nothing in the app used.
  `barcodeScannerEnabled: false` sets `expo.camera.barcode-scanner-enabled=false` in both the
  Gradle and Podfile properties so the native build can leave it out.

Also recorded the dev-server trap behind the confusing `ENOENT .../assets/images` failure: Expo
started from the monorepo root treats the root `package.json` as the app, serves the wrong
`projectRoot` and breaks every bundled image. See `troubleshooting.md`.

## 1.0.0 — planned

First student demo APK: identification, collection, watering, reminders, Clerk auth, matching the screenshot flows.