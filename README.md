# LeafCare

A mobile app that identifies houseplants from a photo, builds a watering schedule, and reminds the owner before the plant dries out.

**Know your plant. Keep it alive.**

This repository starts as the **source of truth for what to build**. Application code (Expo mobile + Next.js API) is added in later phases. Do not invent features that are not in `docs/`.

## What it does

- Photograph a leaf → species identification via Plant.id / PlantNet
- Recommended watering interval, light, and difficulty
- Personal collection with nicknames, rooms, photos, and care history
- Push reminders, snooze, overdue nudges, and watering streaks
- Account via Clerk (email + Google), data in Supabase

## Stack (locked)

| Layer | Technology |
| --- | --- |
| Mobile | React Native (Expo) |
| Backend | Next.js API Routes |
| Auth | Clerk (Expo SDK) |
| Database | Supabase (PostgreSQL) + Storage |
| Plant ID | Plant.id (preferred) or PlantNet |
| Push | Expo Notifications |
| Android APK | EAS Build |

## Docs map (read in this order)

1. [AGENTS.md](./AGENTS.md) — contract for any coding agent
2. [docs/overview.md](./docs/overview.md) — product + users
3. [docs/requirements.md](./docs/requirements.md) — in/out of scope
4. [docs/specification.md](./docs/specification.md) — **every screen and interaction**
5. [docs/ui-ux.md](./docs/ui-ux.md) — visual system + screenshot index
6. [docs/architecture.md](./docs/architecture.md) — components and data flow
7. [docs/database.md](./docs/database.md) — schema
8. [docs/api.md](./docs/api.md) — REST endpoints
9. [docs/security.md](./docs/security.md)
10. [docs/plan.md](./docs/plan.md) — **phases: install → backend → frontend → ship**
11. [docs/tasks.md](./docs/tasks.md) — checkbox work breakdown
12. [docs/testing.md](./docs/testing.md)
13. [docs/deployment.md](./docs/deployment.md)
14. [docs/troubleshooting.md](./docs/troubleshooting.md)
15. [docs/changelog.md](./docs/changelog.md)

Pixel-perfect screens live in [`docs/screenshots/`](./docs/screenshots/). Treat those PNGs as the UI spec.

## Repository layout

```
leafcare/
  apps/
    mobile/          # Expo Router app (React Native, TypeScript)
    api/             # Next.js App Router API + Supabase migrations
  packages/
    shared/          # zod contracts, schedule math, domain rules, design tokens
  tests/             # dependency-free domain checks
  docs/
```

## Current status

Phases 0–3 are implemented: the monorepo, the full backend (schema + every route
in [docs/api.md](./docs/api.md)), all 27 screens, and notifications/theme/units
polish. What remains is filling in your own keys (Clerk, Supabase, optional
Plant.id), running the demo seed, and the device/EAS steps in
[docs/plan.md](./docs/plan.md).

## Run it locally

```bash
npm install                       # installs apps/* and packages/*

# 1. API
cp apps/api/.env.example apps/api/.env.local   # fill in Clerk + Supabase keys
npm run api                                    # http://localhost:3000/api/health

# 2. Apply the schema
#    Paste apps/api/supabase/migrations/0001_init.sql into the Supabase SQL editor.

# 3. Sign up once in the app, then seed the demo account with that user's id
npm run seed -- <clerk_user_id>

# 4. Mobile
cp apps/mobile/.env.example apps/mobile/.env   # Clerk publishable key + API base URL
npm run mobile                                 # then press a / i, or scan the QR
```

Each app loads its own env file — Next.js reads `apps/api/.env.local` from the app
directory and Expo reads `apps/mobile/.env`. A `.env.local` at the repository root is
**not** read by either app.

Check the setup at any time:

```bash
npm run doctor --workspace @leafcare/api   # makes a real call to each integration
npm run check                              # docs present + no committed secrets
```

Useful checks:

```bash
npm run typecheck      # shared + api + mobile
npm test               # shared domain math + identify provider contract
npm run check          # docs present + scan tracked files for credentials
```

`IDENTIFY_PROVIDER=mock` (the default when no Plant.id key is present) makes the
whole capture → identify → add-plant flow work offline with deterministic scores
on both sides of the 0.80 confidence threshold.

## Demo account (UI spec)

Used in all mock screens. Seed this user after auth + DB exist.

| Field | Value |
| --- | --- |
| Name | Alex Morgan |
| Email | alex.morgan@leafcare.app |
| Plants | Monty, Pearl, Ficus, Sunny, Zizi, Rio |

## License

Private student project unless otherwise stated.
