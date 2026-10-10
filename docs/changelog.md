# Changelog

## Unreleased

### Added — point the camera at a plant and it captures itself

Screen 09 no longer needs the shutter tapped. An **Auto** pill (on by default) watches the frame
and fires the shutter once a plant has been centred and held still for a moment, so the whole
plant → species flow is "point and wait". Auto off returns the screen to exactly what the PNG
shows.

The camera runs **no model**. `expo-camera` exposes no preview frames, so the only way to see what
the lens sees is a capture — which means the device's job is deciding *when*, never *what*:

- `frame-analysis.ts` measures a 64×64 probe: leaf-green coverage in the centre box (HSV hue, so
yellowing and dark houseplants count) and the luma gradient across it. Coverage is worth 0.72 of
the score and texture 0.28, and the bar sits at 0.75, which is what stops a *flat* green surface
from firing on coverage alone. Off-centre leaves are excluded by construction — only the centre
box is measured.
- `auto-capture.ts` is the trigger: three consecutive ready-and-steady frames, where "steady" is
the mean-luma change between probes, so a blurred shot while the phone is still moving never
fires. Firing is latched, and the phone being repositioned reports `holding` so the caption can
say "Hold still" instead of leaving the user guessing.
- `frame-probe.ts` is the camera glue: `quality: 0.2` with `skipProcessing` (orientation is
irrelevant to a centre-box measurement and the rotation pass is what makes a probe slow), resized
to 64×64 PNG, decoded with `upng-js`, and **both files deleted in a `finally`** — a probe runs
about once a second, and each capture is a full-resolution JPEG however low the quality is.

The thresholds come from real photographs rather than intuition. The shipped `analyzeFrame` was run
over plants and non-plants downscaled to probe size (the full table is in `testing.md`): foliage
close-ups score 0.89–1.00, a flat green surface 0.72, a phone on a desk 0.28, a cat 0.17, a dog a
laptop and a skyline 0.00. Plants photographed *small* in a scene land at 0.11–0.50 and do **not**
fire — deliberate: the caption asks for the plant to fill the frame, and that is also the photo the
vendor answers best (32% for a distant ivy wall against 85% for a leaf close-up).

Two things the tests caught before a device did:

- The probe loop depended on the caller's camera-ref **object identity**, so a screen passing an
  inline `{ current: camera }` restarted the effect on every render and spun at 4 GB of heap in
  the hook suite. The ref is now wrapped in a ref of its own, and the effect depends on `enabled`
  alone.
- `base64ToBytes` filtered its input down to the base64 alphabet, which silently decoded a
  `data:image/png;base64,` **prefix as pixels**. The prefix is now stripped properly.

`enabled` also drives the reported status, so switching auto-capture off can never leave a stale
"capturing" on screen, and the effect body sets no state at all (the first tick does it) — the
React lint rule that flags synchronous `setState` in an effect stays on.

The two new native modules are loaded through lazy `require`s, the same way
`lib/notifications.ts` loads `expo-notifications`. That is not tidiness: the probe lives on the
scan route, expo-router imports every route file eagerly, and `requireNativeModule` throws while a
package is being *imported* when the build has no such module — so a static import would have
crashed the app on any development build made before auto-capture existed, instead of quietly
falling back to the shutter. `frame-probe-unavailable.test.ts` pins that fallback with a mock
factory that throws at load time.

**Needs a new build to demo:** `expo-image-manipulator` and `expo-file-system` are native modules,
so the already-started preview APK `a3092468` does not contain them. And the calibration is stills
— the probe cadence and `motionTolerance` are the values to expect tuning on a real phone.

### Verified — pointing the camera at a plant really identifies it (1.8–2.8 s)

Until now the identify path had only ever been proved against the deterministic `mock` provider:
`doctor` reports that a vendor key is *present* and never calls the vendor. Ran the repo's own
harness, `npm run identify:fixture --workspace @leafcare/api -- <photo>`, against three real leaf
photos with the `PLANTNET_API_KEY` from `apps/api/.env.local` — Ficus lyrata top 85.1% (`high` →
result screen 11), Monstera deliciosa top 79.1% and Hedera helix top 32.3% (`low` → uncertain
screen 12). Correct species first each time, 1.8–2.8 s per round trip.

- **0.80 is a high bar in the field, and that is the point.** The Monstera answer was *right* and
  still lands on screen 12, so a phone-held photo of a whole plant will often open "not quite
  sure" rather than the result. That is the specified behaviour — 12 offers retake and search
  instead of an error — but it is worth knowing before a demo.
- **There is no live detection.** Screen 09 runs nothing until the shutter is tapped. The frame and
  "Center the leaf in the frame" are guidance for the photo, not a trigger: centring improves the
  upload, it does not start one.
- Corrected a stale `docs/testing.md` row that claimed `PGRST205` (table not found) for all eight
  Supabase tables on the same page where the next row lists all eight as present. A direct REST
  probe with the service-role key settles it: six tables answer 200 on `?select=id`, and
  `notification_prefs`/`achievements` answer 400 because they have no `id` column — not because
  they are missing. The schema is applied.

### Fixed — the Android bundle carried two Reacts, and EAS guessed the environment

`expo-doctor` scored 20/21 before the first APK: **two React copies**, `react@19.2.3` in the app and a
hoisted `react@19.3.0` at the workspace root. The cause was a dev-only chain —
`@testing-library/react-native` requires `test-renderer`, which requires `react-reconciler@~0.34.0`,
whose peer is `react: ^19.3.0` — so npm satisfied that peer with a second copy at the root. Metro
resolves `react` per file, so a root-level dependency that Expo bundles (`@expo/ui`, `@clerk/expo`)
would have compiled against 19.3.0 while every screen used 19.2.3: the arrangement that produces
"Invalid hook call" on a real device.

The workspace root now declares `react` and `react-dom` **19.2.3** as dev dependencies, so npm hoists
the one copy Expo SDK 57 pins (`expo/bundledNativeModules.json`) and nests the reconciler's own copy
under `test-renderer`, where only the tests can see it. `jest.config.js` resolves `react` instead of
assuming `<rootDir>/node_modules/react` exists, because after that dedupe it does not.

`expo-doctor` is **21/21**, all 236 tests still pass, and the exported Android bundle holds a single
React version literal (`19.2.3`; zero hits for `19.3.0`).

Each `eas.json` profile also names its EAS environment now, so a build cannot quietly read another
profile's variables.

### Added — the app has a real test suite, and Light is the default theme

Done before the first EAS build, so the APK is handed out with the checks actually running rather
than promised.

- **The mobile app is under Jest.** `jest-expo`, run once for iOS and once for Android: 12 suites,
  **236 assertions**, covering the copy in the PNGs (`Mar 14 · 8:05 AM`, `Watered · 250 ml`), form
  validation, per-user cache scoping, the offline queue, reminder scheduling, the release-config
  guard and the theme default. `npm test` now runs the shared, API and mobile suites in one go.
- **Light is the default theme**, end to end: the app, the `profiles.theme` column
  (`0003_profile_theme_default.sql`) and the demo seed. System and Dark are still one tap away, and
  an explicit choice — on the device or on the account — still wins. This is a deliberate change to
  a locked decision in `AGENTS.md` and `docs/specification.md`, which said *System* was the default;
  those files are updated here so the docs and the app agree.
- **Local reminders are actually scheduled now.** `schedulePlantReminder` existed but nothing called
  it, so a phone whose API was unreachable (or that had no FCM credentials) never reminded anyone.
  It is wired to create, water, edit, reset and delete, so the device's schedule follows the
  server's — and a deleted plant stops nagging.
- **The status bar follows the app, not the phone.** It was `style="auto"`, which with Light as the
  default would have drawn light icons on the cream background on a phone in dark mode.
- **`npm run doctor` now catches a half-applied migration.** PostgREST's OpenAPI document is built
  from the live schema and includes each column's `default`, so doctor checks the seven defaults the
  migrations install — `profiles.theme` being the one that matters — and fails with the drift rather
  than leaving you to guess. `0003_profile_theme_default.sql` is **applied** on the live project:
  `profiles.theme` reads `light`, so a new profile row is Light server-side as well as on device.

### Fixed — four faults the new tests found

- **Preferences were silently never saved.** `settings-provider` read and wrote AsyncStorage through
  a dynamic `import()`, and its `try/catch` swallowed the failure. The theme and unit choices of the
  Settings screen therefore never reached the disk. It now uses the same static import as
  `lib/storage.ts`, which is where it came from in the first place.
- **A whitespace-only Clerk key counted as configured.** `EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY="  "`
  passed `isClerkConfigured()`, so the app would hand Clerk a blank key and die on a white screen
  instead of showing the setup guide. Every public value is trimmed now, as `apiBaseUrl` and
  `supportEmail` already were.
- **The scan session accepted a suggestion index with no result.** `selectSuggestion` now requires a
  result to exist, keeping the session's index meaningful at all times.
- **`expo-notifications` is loaded with a lazy `require`** instead of `await import()`. Same
  guarantee — evaluated on first use, never at bundle-evaluation time, which is what crashed Expo Go
  on Android — but synchronous, and the only form a test can substitute.

### Removed

- `useHealth`, `queryKeys.health` and `api.health`: no screen ever called them. `/api/health` itself
  stays, and is what `npm run doctor` and the smoke script probe.

### Fixed — an installed APK would have shipped unconfigured and unable to reach the API

Two faults meant "it builds" and "it runs on a phone" were not the same thing, and neither shows up
while developing in Expo Go.

- **The build never received its configuration.** `apps/mobile/.env` is gitignored, and `eas build`
  uploads the project minus everything gitignored, so every `EXPO_PUBLIC_*` value would have been
  undefined: no Clerk publishable key, no API URL, no Supabase URL. The bundle falls back to
  `http://localhost:3000`, which on a phone is the phone itself, so the APK would have opened a
  sign-in screen that cannot work. All seven public values are now EAS environment variables for the
  `development`, `preview` and `production` environments (`eas env:push`), verified with `eas env:list`
  — a build is self-contained and no secret is involved, since `EXPO_PUBLIC_*` values are inlined into
  every bundle anyway.
- **A release build could not use the API at all.** Android blocks cleartext HTTP from
  `targetSdkVersion` 28 on, and Expo's template sets `usesCleartextTraffic` in the *debug* manifest
  only. Verified empirically rather than assumed: `expo prebuild` produced **0** occurrences in the
  main manifest without the option and `android:usesCleartextTraffic="true"` with it.
  `expo-build-properties` now enables it, so the flag reaches release builds. Remove it once the API
  is served over HTTPS.
- **A misconfigured build said nothing.** `releaseConfigIssue()` runs at startup in a non-dev build and
  names the exact missing or unusable value, and the setup screen has build-specific copy: whoever
  installed the APK cannot edit a `.env` file, so telling them to is worse than useless.

Recorded in `troubleshooting.md` with the prebuild command that proves the manifest claim, and in
`deployment.md` for the per-environment values.

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