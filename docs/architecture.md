# Architecture

## High-level

```
┌──────────────────────────┐
│  Expo app (TypeScript)   │
│  Expo Router + Clerk     │
│  Camera, Notifications   │
└────────────┬─────────────┘
             │ HTTPS + Clerk JWT
┌────────────▼─────────────┐
│  Next.js API (App Router)│
│  /api/identify           │
│  /api/plants             │
│  /api/care               │
│  /api/reminders          │
│  /api/webhooks/clerk     │
└──────┬─────────┬─────────┘
       │         │
       ▼         ▼
┌──────────┐  ┌─────────────────┐
│ Clerk    │  │ Supabase        │
│ users    │  │ Postgres +      │
│ sessions │  │ Storage (photos)│
└──────────┘  └────────┬────────┘
                       │
              ┌────────▼────────┐
              │ Plant.id /      │
              │ PlantNet        │
              └─────────────────┘
```

The mobile app never calls Plant.id. It posts the image (or storage URL) to `/api/identify`. The API stores the identification result and returns species + care defaults.

## Suggested repo layout (create in Phase 0)

```
leafcare/
  AGENTS.md
  docs/
  apps/
    mobile/          # Expo
    api/             # Next.js
  packages/
    shared/          # Zod types, care-interval helpers (optional)
```

Until Phase 0, only docs exist at the repo root.

## Client layers

- **app/** Expo Router groups: `(auth)`, `(onboarding)`, `(tabs)`, `scan`, `plants`, `settings`
- **components/ui** primitives: Button (filled forest, outline, coral danger), SegmentedControl, Card, ListRow, Badge, Toast, BottomSheet, TabBar, CircularProgress
- **lib/api** fetch wrapper attaching Clerk token
- **lib/notifications** register token, local fallback
- **stores** plant list cache (React Query or similar)

## Backend layers

- Auth middleware: verify Clerk JWT
- Domain: plants, identifications, care_events, reminder_prefs
- Integrations: Plant.id client, Supabase service role (webhooks only) vs user-scoped
- Jobs: cron or Supabase scheduled function to enqueue Expo push for due plants (quiet hours respected)

## Identification flow

1. User captures JPEG.
2. App requests camera permission screen if needed.
3. App shows identifying sheet immediately.
4. `POST /api/identify` with multipart image.
5. API calls Plant.id, maps top suggestions + care heuristics.
6. If top score ≥ 0.80 → result screen; else uncertain screen.
7. User taps Add to My Plants → add-plant form prefilled.

## Watering flow

1. Schedule = `last_watered_at + interval_days` at `reminder_time` in user timezone.
2. Home “need water today” = due date ≤ today.
3. Overdue days = today − due date (if > 0).
4. Mark watered writes `care_events` type `watered`, updates `last_watered_at`, refreshes streak.
5. Toast + optional Home banner confirmation.

## Auth flow

1. Splash → onboarding (once, AsyncStorage flag) → sign-up/sign-in
2. Clerk sign-up may require email code → verify-email
3. Clerk webhook upserts `profiles` row
4. Tabs only when signed in

## Offline

- Read cache for plants and home cards
- Mutations: retry queue for mark-watered; if unimplemented in early phase, disable buttons and show banner
- Identify requires network; show error screen `25`

## External systems

| System | Used for |
| --- | --- |
| Clerk | Identity, Google OAuth, email OTP, password |
| Supabase | Relational data, photo bucket `plant-photos` |
| Plant.id | Identification JSON |
| Expo Push | Device messages |
| EAS | Android APK / iOS build |
