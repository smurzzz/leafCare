# Tasks

Use this as the implementation backlog. Check items in PRs / changelog when done.

## Phase 0 — Installation

- [ ] Create `apps/mobile` Expo Router TypeScript app named LeafCare
- [ ] Create `apps/api` Next.js App Router TypeScript app
- [ ] Add root env files from `.env.example`
- [ ] Create Clerk application (email + Google + email code)
- [ ] Create Supabase project
- [ ] Obtain Plant.id (or PlantNet) API key
- [ ] `GET /api/health` works
- [ ] Expo app launches on a device/simulator
- [ ] Document local run commands in README when apps exist

## Phase 1 — Backend

- [ ] `profiles`, `notification_prefs`, `plants`, `identifications`, `care_events`, `achievements`, `species_cache`
- [ ] Storage bucket + policies
- [ ] Clerk webhook user.created / user.deleted
- [ ] `POST /api/identify` server-side Plant.id
- [ ] Identify threshold ≥ 0.80 → `high` else `low`
- [ ] `GET /api/species`
- [ ] Plants CRUD + photo upload
- [ ] `POST /api/plants/:id/water` + streak update
- [ ] Schedule reset + delete plant
- [ ] `GET /api/home`
- [ ] `GET /api/reminders` + snooze + done
- [ ] `GET /api/care-log`
- [ ] `GET/PATCH /api/me` + notification prefs + push token
- [ ] `DELETE /api/me`
- [ ] Seed script for six demo plants
- [ ] Rate limit identify

## Phase 2 — Frontend screens

### Auth & onboarding

- [ ] **01 Splash** — tap/timeout routing
- [ ] **02 Onboarding 1** — Identify any plant in seconds
- [ ] **03 Onboarding 2** — Never forget to water again
- [ ] **04 Onboarding 3** — Watch your plant family grow + Get Started
- [ ] Skip onboarding persistence
- [ ] **05 Sign up** — name, email, password, meter, Google, legal
- [ ] **06 Log in** — hero, forgot password, Google, sign up link
- [ ] **07 Verify email** — 6 OTP boxes, resend timer, verify

### App chrome & states

- [ ] Tab bar: Home, My Plants, Scan FAB, Reminders, Profile
- [ ] **26** Offline banner + skeletons
- [ ] **25** Error + Try again + Contact support
- [ ] **27** Success toast `{name} watered`

### Plants

- [ ] **14 My Plants** — count, search, chips, overdue border, + FAB
- [ ] **15 Plant detail** — ring, mark watered, stats, Care/History/Notes
- [ ] **13 Add plant** — photo, nickname, locations, last watered, stepper
- [ ] **16 Edit schedule** — stepper, reset, reminder time, delete plant
- [ ] **17 Care log** — calendar dots, month summary, recent activity

### Home

- [ ] **08 Home** — greeting, due card, today's care, upcoming, water actions

### Scan

- [ ] **24 Camera permission**
- [ ] **09 Camera** — frame, shutter, gallery, flash, flip, close
- [ ] **10 Identifying** — progress, match count, cancel
- [ ] **11 Scan result** — % match, care tiles, alternatives, add, retake
- [ ] **12 Low confidence** — tips, possible matches, retake, search manually
- [ ] Manual species search UI

### Reminders & profile

- [ ] **18 Reminders** — grouping, Done, Snooze, completed tab
- [ ] **19 Empty reminders**
- [ ] **20 Notification settings** — toggles, digest time, snooze 1h/3h/Tomorrow, overdue, quiet hours copy
- [ ] **21 Profile** — stats, achievements, menu, log out
- [ ] **22 Settings** — email, password, theme, units, version, legal, danger zone
- [ ] **23 Delete account modal**

## Phase 3 — Notifications & polish

- [ ] Expo push token registration
- [ ] Daily digest job
- [ ] Per-plant due notification
- [ ] Snooze reschedule
- [ ] Overdue nudge next day
- [ ] Quiet hours 10:00 PM–7:00 AM
- [ ] Theme Light/System/Dark applied globally
- [ ] Metric/Imperial conversion on volumes
- [ ] Achievement unlock first plant / 7-day / 10 plants / 30-day
- [ ] App icon + native splash

## Phase 4 — Testing

- [ ] Auth happy path + Google
- [ ] Identify high vs low confidence
- [ ] Save plant appears on Home and My Plants
- [ ] Overdue badge math
- [ ] Mark watered from three surfaces + toast
- [ ] Reminder empty vs filled
- [ ] Offline banner
- [ ] Delete plant and delete account
- [ ] Camera deny / allow
- [ ] Record results in testing.md notes if needed

## Phase 5 — Deployment

- [ ] EAS build Android APK
- [ ] Production Clerk/Supabase/Plant.id env
- [ ] Version string on Settings matches build
- [ ] Demo account seeded
- [ ] Changelog 1.0.0
