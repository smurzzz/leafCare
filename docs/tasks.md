# Tasks

Use this as the implementation backlog. Check items in PRs / changelog when done.

## Phase 0 — Installation

- [x] Create `apps/mobile` Expo Router TypeScript app named LeafCare
- [x] Create `apps/api` Next.js App Router TypeScript app
- [x] Add root env files from `.env.example`
- [x] Create Clerk application — `CLERK_SECRET_KEY` validates against the Backend API
      (still enable email + Google + email code in the dashboard)
- [x] Create Supabase project — URL and secret key authenticate against REST + Storage
- [x] Obtain Plant.id (or PlantNet) API key — PlantNet key present and accepted; no-match
      answers now fall through to the uncertain flow instead of a 502
- [x] Apply `apps/api/supabase/migrations/0001_init.sql` — eight tables + the
      `plant-photos` bucket confirmed by `npm run doctor`
- [x] Sign up a user — one Clerk user exists and the demo data is seeded for it
- [x] Put real values in `apps/mobile/.env` — `EXPO_PUBLIC_PROJECT_ID` now carries the id
      `eas init` assigned to the project, so push registration can resolve it
- [ ] Point `EXPO_PUBLIC_API_BASE_URL` at your machine's LAN IP (or a tunnel) before
      running on a **physical** device — `http://localhost:3000` only resolves on a simulator
- [x] `GET /api/health` works
- [x] Expo app launches on a device/simulator (bundle exports cleanly for android)
- [x] Document local run commands in README when apps exist

## Phase 1 — Backend

- [x] `profiles`, `notification_prefs`, `plants`, `identifications`, `care_events`, `achievements`, `species_cache` (+ `reminder_log`)
- [x] Storage bucket + policies
- [x] Clerk webhook user.created / user.deleted
- [x] `POST /api/identify` server-side Plant.id (PlantNet + deterministic mock fallback)
- [x] Identify threshold ≥ 0.80 → `high` else `low`
- [x] `GET /api/species`
- [x] Plants CRUD + photo upload
- [x] `POST /api/plants/:id/water` + streak update
- [x] Schedule reset + delete plant
- [x] `GET /api/home`
- [x] `GET /api/reminders` + snooze + done
- [x] `GET /api/care-log`
- [x] `GET/PATCH /api/me` + notification prefs + push token
- [x] `DELETE /api/me`
- [x] Seed script for six demo plants
- [x] Rate limit identify

## Phase 2 — Frontend screens

### Auth & onboarding

- [x] **01 Splash** — tap/timeout routing
- [x] **02 Onboarding 1** — Identify any plant in seconds
- [x] **03 Onboarding 2** — Never forget to water again
- [x] **04 Onboarding 3** — Watch your plant family grow + Get Started
- [x] Skip onboarding persistence
- [x] **05 Sign up** — name, email, password, meter, Google, legal
- [x] **06 Log in** — hero, forgot password, Google, sign up link
- [x] **07 Verify email** — 6 OTP boxes, resend timer, verify

### App chrome & states

- [x] Tab bar: Home, My Plants, Scan FAB, Reminders, Profile
- [x] **26** Offline banner + skeletons
- [x] **25** Error + Try again + Contact support
- [x] **27** Success toast `{name} watered`

### Plants

- [x] **14 My Plants** — count, search, chips, overdue border, + FAB
- [x] **15 Plant detail** — ring, mark watered, stats, Care/History/Notes
- [x] **13 Add plant** — photo, nickname, locations, last watered, stepper
- [x] **16 Edit schedule** — stepper, reset, reminder time, delete plant
- [x] **17 Care log** — calendar dots, month summary, recent activity

### Home

- [x] **08 Home** — greeting, due card, today's care, upcoming, water actions

### Scan

- [x] **24 Camera permission**
- [x] **09 Camera** — frame, shutter, gallery, flash, flip, close
- [x] **10 Identifying** — progress, match count, cancel
- [x] **11 Scan result** — % match, care tiles, alternatives, add, retake
- [x] **12 Low confidence** — tips, possible matches, retake, search manually
- [x] Manual species search UI

### Reminders & profile

- [x] **18 Reminders** — grouping, Done, Snooze, completed tab
- [x] **19 Empty reminders**
- [x] **20 Notification settings** — toggles, digest time, snooze 1h/3h/Tomorrow, overdue, quiet hours copy
- [x] **21 Profile** — stats, achievements, menu, log out
- [x] **22 Settings** — email, password, theme, units, version, legal, danger zone
- [x] **23 Delete account modal**

## Phase 3 — Notifications & polish

- [x] Expo push token registration
- [x] Daily digest job
- [x] Per-plant due notification
- [x] Snooze reschedule
- [x] Overdue nudge next day
- [x] Quiet hours 10:00 PM–7:00 AM
- [x] Theme Light/System/Dark applied globally — **Light is the default** (app, `profiles.theme`
      and the seed), System follows the phone, an explicit choice wins
- [x] Local fallback reminder scheduled per plant — follows the server's schedule on create, water,
      edit, reset and delete, so reminders fire even when the API cannot be reached
- [x] Metric/Imperial conversion on volumes
- [x] Achievement unlock first plant / 7-day / 10 plants / 30-day
- [ ] App icon + native splash (placeholder Expo assets still in place)

## Phase 4 — Testing

- [x] Mobile unit suite under Jest — `jest-expo` on iOS and Android, 12 suites / 236 assertions
      (`npm test`), covering formatting copy, validation, per-user cache scoping, the offline
      queue, reminder scheduling, the config guard and the theme default
- [x] Offline cache hydration and cache-key scoping (automated)
- [x] Reminder scheduling and cancellation, permission and push-token flow (automated)
- [x] Overdue badge math (automated in `tests/shared-domain.test.mjs`)
- [x] Identify threshold, streak, next-due and unit conversion (automated)
- [x] API typechecks and `next build` renders every route
- [x] Expo bundle exports for Android without errors
- [x] Signed-in backend flow — `npm run smoke` mints a real Clerk session and validates
      every endpoint against the client's own zod schemas (10/10 passing)
- [x] Save plant appears on Home and My Plants — six seeded plants, three due rows on Home
- [x] Mark watered persists — Ficus went `overdue` → `upcoming` on the next read
- [x] Reminder filled state — 2 groups, `empty: false`
- [x] RLS blocks anonymous reads — publishable key sees 0 rows where the API sees 6/1/31
- [ ] Auth happy path + Google on a device — **needs a device**
- [ ] Sign in with the same account to check the client's own request/response round trip
- [ ] Identify high vs low confidence on device — **needs a device and a real leaf photo**
      (the vendor path is verified only as far as auth + no-match; see testing.md)
- [x] No-match → uncertain screen (12) — an unmatchable photo returns 200 with `top: null`
      and is stored as `succeeded`, so the screen is reachable
- [ ] Reminder empty state — **needs a second user with no plants**
- [x] Offline cache readable — Home, My Plants and Reminders hydrate from the device cache on
      launch, scoped per Clerk user, so an unreachable API no longer means an empty app
- [ ] Offline banner on airplane mode — **needs a device**
- [ ] Delete plant and delete account — **needs a device flow over Clerk**
- [ ] Camera deny / allow — **needs a device**
- [ ] Record results in testing.md notes if needed

## Phase 5 — Deployment

- [x] EAS project linked — `eas init` created `@henry26/leafcare` and replaced the
      all-zeros `extra.eas.projectId` placeholder that made `eas build` refuse
- [x] Development build config — `expo-dev-client` installed and the `development` profile in
      `eas.json` set up, so push can finally be tested off Expo Go
- [x] Build configuration in EAS — the seven `EXPO_PUBLIC_*` values pushed to the `development`,
      `preview` and `production` environments, so a build is not missing its config the way a
      gitignored `.env` would leave it
- [x] Release builds can reach an HTTP API — `expo-build-properties` sets
      `android.usesCleartextTraffic`, verified in the generated main manifest (not the debug one)
- [x] Misconfigured build fails loudly — `releaseConfigIssue()` names the missing value at startup
      instead of opening into an app that cannot sign in
- [ ] First Android build — run `npx eas build --platform android --profile preview` (APK) or
      `--profile development` (push testing) in `apps/mobile`. The first run generates an Android
      keystore and must be run interactively; see `deployment.md`
- [ ] Production Clerk/Supabase/Plant.id env
- [x] Version string on Settings matches build (read from Expo config + build number)
- [x] Demo account seeded — Alex Morgan's six plants for the first Clerk user (plants only:
      identity always comes from Clerk, so a real account keeps its own name)
- [x] Demo plant photos — `npm run seed:photos` gives each seeded plant a real species photo
- [x] Profile photo upload — public `avatars` bucket, `POST/DELETE /api/me/avatar`, Change photo
      in Profile
      (`npm run seed -- <clerk_user_id>`)
- [ ] Changelog 1.0.0
