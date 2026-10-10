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

## Current status

Documentation and agent brief only. No app runtime yet. Follow [docs/plan.md](./docs/plan.md) Phase 0 to scaffold.

## Demo account (UI spec)

Used in all mock screens. Seed this user after auth + DB exist.

| Field | Value |
| --- | --- |
| Name | Alex Morgan |
| Email | alex.morgan@leafcare.app |
| Plants | Monty, Pearl, Ficus, Sunny, Zizi, Rio |

## License

Private student project unless otherwise stated.
