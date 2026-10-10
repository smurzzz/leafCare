# AGENTS.md — LeafCare build contract

You are implementing **LeafCare**, a camera-based plant identification and watering-reminder mobile app.

This file is mandatory. If a request conflicts with these docs, **the docs win**.

## Mission

Ship an Expo (iOS + Android) app plus a Next.js API that matches the screens in `docs/screenshots/` and the behavior in `docs/specification.md`.

Do **not** build a Vite/web clone of the UI kit. The UI kit and PNGs are visual reference only. The product is React Native.

## Read before writing code

1. `docs/specification.md` — every screen, control, empty/error state
2. `docs/ui-ux.md` — colors, type, components, navigation
3. `docs/plan.md` + `docs/tasks.md` — order of work
4. `docs/database.md` + `docs/api.md` — data and endpoints
5. `docs/security.md` — Clerk, RLS, no plant-API keys on device

## Locked decisions (do not reopen)

| Decision | Choice |
| --- | --- |
| Client | React Native + Expo (TypeScript) |
| Navigation | Expo Router |
| UI | Native components styled to the screenshots (not shadcn/web) |
| Auth | Clerk Expo SDK — email/password + Google + 6-digit email OTP |
| Backend | Next.js App Router API routes |
| DB | Supabase PostgreSQL; Storage for plant photos |
| Plant ID | Server-side only (Plant.id preferred) |
| Push | Expo Notifications; schedules stored in DB |
| Units | Metric default; Imperial toggle in Settings |
| Theme | System default; Light / System / Dark segmented control |
| Out of scope | Disease/pest diagnosis, marketplace, IoT sensors |

## Screen inventory (must all exist)

Implement these routes/screens. Details and interactions are in `docs/specification.md`. Screenshots are numbered to match.

| # | Screen | File | Route (suggested) |
| --- | --- | --- | --- |
| 01 | Splash | `01-splash.png` | `/` first launch |
| 02–04 | Onboarding (3 slides) | `02`–`04` | `/onboarding` |
| 05 | Sign up | `05-sign-up.png` | `/sign-up` |
| 06 | Log in | `06-log-in.png` | `/sign-in` |
| 07 | Verify email | `07-verify-email.png` | `/verify-email` |
| 08 | Home / Today | `08-home-today.png` | `/(tabs)/home` |
| 09 | Scan camera | `09-scan-camera.png` | `/scan` |
| 10 | Identifying | `10-identifying.png` | `/scan/identifying` |
| 11 | Scan result | `11-scan-result.png` | `/scan/result` |
| 12 | Low confidence | `12-low-confidence.png` | `/scan/uncertain` |
| 13 | Add plant | `13-add-plant.png` | `/plants/add` |
| 14 | My Plants | `14-my-plants.png` | `/(tabs)/plants` |
| 15 | Plant detail | `15-plant-detail.png` | `/plants/[id]` |
| 16 | Edit schedule | `16-edit-schedule.png` | sheet on detail |
| 17 | Care log | `17-care-log.png` | `/plants/[id]/log` or `/care-log` |
| 18 | Reminders | `18-reminders.png` | `/(tabs)/reminders` |
| 19 | Reminders empty | `19-reminders-empty.png` | same route, empty state |
| 20 | Notification settings | `20-notification-settings.png` | `/settings/notifications` |
| 21 | Profile | `21-profile.png` | `/(tabs)/profile` |
| 22 | Settings | `22-settings-account.png` | `/settings` |
| 23 | Delete account confirm | `23-settings-delete-confirm.png` | modal |
| 24 | Camera permission | `24-state-camera-permission.png` | `/scan` denied/undetermined |
| 25 | Error | `25-state-error.png` | global / identify failure |
| 26 | Loading + offline | `26-state-loading-offline.png` | skeleton + banner |
| 27 | Success toast | `27-state-success-toast.png` | overlay after water |

Also implement the **tab bar** (Home, My Plants, Scan FAB, Reminders, Profile) on authenticated tabs.

## Implementation rules

- Match copy, layout, and component states from the PNGs. Do not rewrite marketing copy unless a doc says so.
- Every user-visible string in the screenshots is canonical English copy.
- Plant ID keys never leave the Next.js server. The app uploads a photo to **our** API; the API calls Plant.id.
- Clerk is the only identity store. Supabase rows are keyed by `clerk_user_id`. Enable RLS.
- Mark-as-watered is optimistic on device, then persisted; show toast “{nickname} watered”.
- Overdue plants get a red/coral border and “Overdue Nd” badge (see Ficus).
- Due today uses a water-drop + “Due today” in teal.
- Future due uses “in N days”.
- Empty reminders uses the sleeping plant illustration + “Add a plant”.
- Offline: pink “No connection” banner + skeleton cards; local care logs queue and sync later if possible. If sync queue is too large for a phase, still show the offline UI and block mutating API with a retry.
- Do not add disease ID, shop, social feed, or sensors.

## Phase discipline

Work in the order in `docs/plan.md`:

0. **Installation** — Expo app, Next.js API, env, Clerk, Supabase projects
1. **Backend** — schema, RLS, identify proxy, CRUD, reminders jobs
2. **Frontend** — screens in the task list, wired to APIs
3. **Notifications + polish** — push, theme, units, offline, EAS

Check off items in `docs/tasks.md` as you complete them. Update `docs/changelog.md`.

## Demo seed (required for screenshots parity)

After backend exists, seed Alex Morgan’s six plants as specified in `docs/database.md` so Home / My Plants / Reminders match the mock data.

## Definition of done for a screen

- Looks like the PNG at iPhone 14/15 logical size (~393×852)
- All tappable controls in the spec work or navigate
- Loading, empty, error, permission, and success states exist where specified
- No plant-API or Clerk secret in the client bundle
