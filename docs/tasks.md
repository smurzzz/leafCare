# Tasks

Use this as the implementation backlog. Check items in PRs / changelog when done.

## Phase 0 — Installation

- [x] Create `apps/mobile` Expo Router TypeScript app named LeafCare
- [x] Create `apps/api` Next.js App Router TypeScript app
- [x] Add root env files from `.env.example`
- [ ] Create Clerk application (email + Google + email code) — **needs your dashboard keys**
- [ ] Create Supabase project — **needs your project keys**
- [ ] Obtain Plant.id (or PlantNet) API key — optional, `IDENTIFY_PROVIDER=mock` works without one
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
- [x] Theme Light/System/Dark applied globally
- [x] Metric/Imperial conversion on volumes
- [x] Achievement unlock first plant / 7-day / 10 plants / 30-day
- [ ] App icon + native splash (placeholder Expo assets still in place)

## Phase 4 — Testing

- [x] Overdue badge math (automated in `tests/shared-domain.test.mjs`)
- [x] Identify threshold, streak, next-due and unit conversion (automated)
- [x] API typechecks and `next build` renders every route
- [x] Expo bundle exports for Android without errors
- [ ] Auth happy path + Google — **needs live Clerk keys**
- [ ] Identify high vs low confidence on device — **needs a device + API keys**
- [ ] Save plant appears on Home and My Plants — **needs Supabase**
- [ ] Mark watered from three surfaces + toast — **needs Supabase**
- [ ] Reminder empty vs filled — **needs Supabase**
- [ ] Offline banner on airplane mode — **needs a device**
- [ ] Delete plant and delete account — **needs Supabase + Clerk**
- [ ] Camera deny / allow — **needs a device**
- [ ] Record results in testing.md notes if needed

## Phase 5 — Deployment

- [ ] EAS build Android APK — run `npx eas build --platform android --profile preview` in `apps/mobile`
- [ ] Production Clerk/Supabase/Plant.id env
- [x] Version string on Settings matches build (read from Expo config + build number)
- [ ] Demo account seeded — run the seed script once Supabase + a Clerk user exist
- [ ] Changelog 1.0.0
