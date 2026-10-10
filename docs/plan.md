# Phase plan

Total academic window from the proposal: ~8 weeks. This plan is what an implementing agent follows **in order**. Do not start frontend screens before the matching backend contract exists, except static UI shells that use mock data **behind a `USE_MOCK=true` flag** (remove before testing phase).

```
Phase 0  Installation / scaffolding     (Week 1)
Phase 1  Backend                        (Week 2–3)
Phase 2  Frontend (all 27 screens)      (Week 3–6)
Phase 3  Notifications, theme, polish   (Week 6–7)
Phase 4  Testing                        (Week 7)
Phase 5  Deployment (EAS APK)           (Week 8)
```

Detailed checkboxes: `tasks.md`.

---

## Phase 0 — Installation

**Goal:** Empty but runnable mobile + API projects, env, git, docs already in this repo.

### 0.1 Tooling

- Node 20+, Git, Expo account, Clerk app, Supabase project, Plant.id (or PlantNet) key
- Copy `.env.example` → `apps/api/.env.local` and `apps/mobile/.env`

### 0.2 Scaffold

```
apps/mobile   npx create-expo-app --template tabs  (TypeScript, Expo Router)
apps/api      create-next-app (App Router, TypeScript)
```

Wire workspaces in root `package.json` if desired.

### 0.3 Mobile install

- `expo-router`, `expo-camera`, `expo-image-picker`, `expo-notifications`, `expo-secure-store`, `expo-file-system`, `@clerk/clerk-expo`, `@supabase/supabase-js` (optional on client), `expo-network` / `@react-native-community/netinfo`
- `app.json` name LeafCare, icon from splash droplet, scheme `leafcare`
- EAS project linked (`eas init`) — can wait until Phase 5 but creating now is fine

### 0.4 API install

- `@clerk/nextjs`, `@supabase/supabase-js`, zod
- `GET /api/health`
- Clerk webhook route stub

### 0.5 Definition of done

- `npx expo start` opens the app
- `npm run dev` in API returns health
- No feature screens required yet

---

## Phase 1 — Backend

**Goal:** Schema + identify proxy + plant CRUD + home/reminders payloads. No Plant.id key on the device.

### 1.1 Database

- Apply SQL from `database.md`
- Storage bucket `plant-photos`
- Clerk webhook: create `profiles` + default `notification_prefs`

### 1.2 Identify

- `POST /api/identify` → Plant.id → DTO + threshold
- Persist `identifications`
- Species search endpoint

### 1.3 Plants & care

- CRUD plants, water, schedule reset, delete
- `GET /api/home`, `GET /api/reminders`, `GET /api/care-log`
- `GET/PATCH /api/me`, notification prefs, `DELETE /api/me`

### 1.4 Seed

- Script to seed six demo plants for a test Clerk user (Alex data)

### 1.5 Definition of done

- Postman/HTTP collection matches `api.md`
- Identify with a monstera photo returns high-confidence payload
- Watering updates `next_due_at`

---

## Phase 2 — Frontend

Implement screens in this order so navigation never dead-ends. Each screen must match `specification.md` + PNG.

| Wave | Screens | Depends on |
| --- | --- | --- |
| 2.1 Auth shell | 01 splash, 02–04 onboarding, 05–07 auth | Clerk |
| 2.2 Chrome | Tab bar + FAB, 26 skeleton/offline, 25 error | NetInfo |
| 2.3 Collection | 14 My Plants, 15 detail, 13 add (manual), 16 sheet | Plants API |
| 2.4 Today | 08 Home, 27 toast, 17 care log | Home + care-log API |
| 2.5 Scan | 24 permission, 09 camera, 10 identifying, 11 result, 12 low | Identify API |
| 2.6 Reminders | 18, 19, 20 | Reminders API |
| 2.7 Account | 21 profile, 22 settings, 23 delete | Me API |

Wire theme (Light/System/Dark) and units (Metric/Imperial) in 2.7 but tokens in 2.2.

**Frontend definition of done:** walking the app produces the same flows as the 27 screenshots without using mock data.

---

## Phase 3 — Notifications and polish

- Register Expo push token
- Server job: due plants → Expo push (daily digest + per plant)
- Snooze, overdue nudges, quiet hours
- Achievement unlocks
- Password “last changed” if Clerk provides it
- Legal URLs
- Icon/splash assets

---

## Phase 4 — Testing

Follow `testing.md`. Fix bugs before EAS.

---

## Phase 5 — Deployment

Follow `deployment.md`. Produce Android APK via EAS; optional iOS if certificates exist. Present using demo user.

---

## Explicit non-goals during all phases

Disease ID, shop, IoT, social, rewriting copy, replacing Clerk/Supabase/Expo.
