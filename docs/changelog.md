# Changelog

## Unreleased

### Added — live data where the demo still showed placeholders

Three gaps remained between "wired to the API" and "actually live", plus one caused by the identity
fix above.

- **Profile photo upload (screen 21).** `POST /api/me/avatar` takes a multipart `image`, stores it
  in a new *public* `avatars` bucket under the Clerk user id, returns the whole `MeResponse`, and
  deletes the previous object so a user's folder holds one file. `DELETE /api/me/avatar` goes back to
  the drawn initials. Profile → Edit profile now has **Change photo** (8MB limit, JPEG/PNG/HEIC,
  square crop) and **Remove photo**. Public read is deliberate — an avatar is app chrome and must
  render without a signing round-trip — and writes still need the service role. Migration
  `0002_avatars.sql`.
- **The seeded plants had no photos at all** (`photo_path = null`), so Home, My Plants and Reminders
  rendered placeholder art. `npm run seed:photos -- <clerk_user_id>` looks each species up on
  Wikipedia, uploads the bytes to `plant-photos` exactly like a user upload, and credits the source
  in the plant's notes. Re-running skips plants that already have one.
- **The offline cache was written but never read**, so a stored cache could not help: an unreachable
  API produced the error screen despite a valid snapshot on the device. The device cache is now
  hydrated into the query cache on launch, which also makes a cold start render instantly. Keys are
  scoped per Clerk user and cleared on sign out, so one account's plants cannot appear under another.
- **A rename in the app was reverted by the identity sync**, a direct consequence of making Clerk
  authoritative. `PATCH /api/me` now pushes the name to Clerk and drops the memoised identity, so the
  edited name survives the next read.

Also prepared the development build that push has always needed: `expo-dev-client` is installed and
the `development` profile exists, so notifications can be tested off Expo Go (`deployment.md`).

### Fixed — the app greeted a real sign-up as "Alex Morgan"

The demo seed wrote Alex Morgan's identity onto whatever profile it touched, so a genuine
account read as someone else. Three things were wrong, and only the first was obvious.

- **The seed owned identity it should never have touched.** `scripts/seed.ts` upserted
  `full_name: 'Alex Morgan'` and a fake `email` onto the caller's `clerk_user_id`. Clerk is the
  only identity store (AGENTS.md), so the seed now writes plants and care history only and leaves
  identity alone; `--name` opts into the demo name for a throwaway account. Documented in
  `database.md`.
- **Nothing ever corrected the row.** A profile was only ever written from the Clerk webhook, so a
  name changed anywhere else stayed wrong forever. `GET /api/me` now mirrors name, email and photo
  from Clerk, which self-heals a seeded or edited profile. Reads are memoised for 60s per user, so
  an endpoint the app calls on every launch does not become a Clerk API amplifier.
- **The two Clerk user shapes are not the same shape, and mixing them fails silently.** The webhook
  payload is snake_case (`first_name`, `has_image`, `image_url`); `clerkClient().users.getUser()`
  resolves to a camelCase SDK object (`firstName`, `hasImage`, `imageUrl`). The first version of the
  sync read the payload shape from the SDK object, so every field was `undefined` and the sync
  quietly did nothing — no error, no warning, no patch. `identityFromClerkSdkUser` now canonicalises
  the SDK shape, and a test pins both.
- The avatar now survives a broken photo URL: `Avatar` fell back to initials only when no URL was set, so a dead remote image rendered as an empty circle. It falls back on load failure too.
- A *generated* initials PNG is not a photograph. Clerk reports `has_image: false` and serves a
  placeholder URL in that case, so it is never stored; the app draws its own themed initials
  instead, and a real photo (Google, or later an upload) is stored and shown.

`identity.ts` holds the mapping as pure, tested logic so the webhook and the API route cannot drift
apart again; `identityPatch` also refuses to erase a stored value with a `null` claim.

### Fixed — Expo Go on Android could not boot

Reported from a device run: eleven identical `expo-notifications ... removed from Expo Go with
SDK 53` errors, four routes warned as "missing the required default export", then
`Cannot read property 'ErrorBoundary' of undefined`. It looked like four broken screens; it was
one bad import.

- **Root cause:** `expo-notifications` throws while being *imported* on Android in Expo Go. Its
  `index.js` re-exports `DevicePushTokenAutoRegistration.fx`, whose module body calls
  `addPushTokenListener()` → `warnOfExpoGoPushUsage()`, and that throws. A throwing module fails
  its entire import graph, so the root layout was never evaluated and expo-router blamed whatever
  imported the package last — the four routes in the log are exactly its four importers.
- `src/lib/notifications.ts` no longer imports the package statically. It is loaded through a
  dynamic `await import('expo-notifications')` wrapped in a try/catch inside `loadNotifications()`,
  and the foreground handler is installed on first use instead of at module scope. On Android in
  Expo Go the module now resolves to `null` and the feature is skipped with one `console.warn`;
  a development build or the EAS APK still gets real local and remote reminders.
- `pushUnsupported` short-circuits registration there, so the app never asks for a permission it
  cannot use. Typecheck, lint and `expo export --platform android` all pass, and nothing else in
  `apps/mobile/src` calls a native namespace at module scope (checked).
- Documented the whole cascade in `troubleshooting.md`, including why the route warnings are a
  symptom rather than four bugs.

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