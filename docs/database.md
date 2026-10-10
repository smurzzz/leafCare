# Database (Supabase PostgreSQL)

Auth identity lives in **Clerk**. Postgres stores app data keyed by `clerk_user_id` (`text`).

Enable RLS on all tables. Users `select/insert/update/delete` only where `clerk_user_id = auth.jwt()->>'sub'` **or** use a Next.js API with the user JWT and Supabase RLS policies that read the Clerk subject from a custom JWT hook. Recommended: **Next.js API uses Clerk-verified user id + Supabase service role only for admin/webhooks**; for user CRUD prefer a Supabase third-party Clerk integration so RLS works.

If Clerk↔Supabase JWT is not ready in Phase 1, all mutations go through Next.js with service role **and** explicit `WHERE clerk_user_id = $userId`. Never expose the service role to Expo.

**Implemented:** every request is authenticated with a Clerk bearer token and
handled in Next.js with the service role, with `WHERE clerk_user_id = <verified sub>`
on every query (see `apps/api/src/lib/auth.ts` and `apps/api/src/lib/plants.ts`).
RLS is still enabled on all tables with policies that read the Clerk `sub` claim
via `public.current_clerk_user_id()`, so a leaked anon key stays inert. The
migration is `apps/api/supabase/migrations/0001_init.sql`.

## Enums

```sql
create type plant_location_kind as enum (
  'living_room', 'bedroom', 'kitchen', 'office', 'custom'
);

create type care_event_type as enum ('watered', 'missed', 'snoozed');

create type identify_status as enum ('pending', 'succeeded', 'failed', 'cancelled');
```

## Tables

### profiles

| Column | Type | Notes |
| --- | --- | --- |
| id | uuid pk | |
| clerk_user_id | text unique not null | |
| full_name | text | |
| email | text | |
| avatar_url | text | |
| theme | text default `system` | `light` \| `system` \| `dark` |
| units | text default `metric` | `metric` \| `imperial` |
| timezone | text default `Asia/Manila` | |
| current_streak_days | int default 0 | |
| last_care_date | date | for streak calc |
| created_at, updated_at | timestamptz | |

### notification_prefs

| Column | Type | Notes |
| --- | --- | --- |
| user_id | uuid pk fk profiles | |
| watering_reminders | bool default true | |
| daily_digest_time | time default `09:00` | |
| snooze_preset | text default `3h` | `1h` \| `3h` \| `tomorrow` |
| overdue_nudges | bool default true | |
| quiet_start | time default `22:00` | |
| quiet_end | time default `07:00` | |
| expo_push_token | text | |

### species_cache

Optional local cache of identified species care defaults.

| Column | Type | Notes |
| --- | --- | --- |
| id | uuid pk | |
| scientific_name | text unique | |
| common_name | text | |
| default_interval_days | int | |
| light | text | e.g. Bright indirect |
| difficulty | text | Easy / Medium / Hard |
| care_notes | jsonb | light paragraph etc. |

### plants

| Column | Type | Notes |
| --- | --- | --- |
| id | uuid pk | |
| clerk_user_id | text not null | |
| nickname | text not null | |
| species_scientific | text | |
| species_common | text | |
| location_kind | plant_location_kind | |
| location_custom | text | when custom |
| photo_path | text | Supabase storage |
| interval_days | int not null | |
| recommended_interval_days | int | |
| reminder_time | time default `08:00` | |
| last_watered_at | timestamptz | |
| next_due_at | timestamptz | generated or maintained |
| streak_weeks | int default 0 | display on detail |
| notes | text | |
| identify_confidence | numeric | last accepted match |
| created_at, updated_at | timestamptz | |

Index `(clerk_user_id, next_due_at)`.

### identifications

| Column | Type | Notes |
| --- | --- | --- |
| id | uuid pk | |
| clerk_user_id | text | |
| photo_path | text | temp upload |
| status | identify_status | |
| provider | text | `plant.id` |
| raw_response | jsonb | |
| suggestions | jsonb | `[{name, score, care}]` |
| created_at | timestamptz | |

### care_events

| Column | Type | Notes |
| --- | --- | --- |
| id | uuid pk | |
| plant_id | uuid fk plants on delete cascade | |
| clerk_user_id | text | |
| type | care_event_type | |
| amount_ml | int | store metric; convert in UI |
| occurred_at | timestamptz | |
| source | text | `home` \| `detail` \| `reminders` |

### achievements

| Column | Type | Notes |
| --- | --- | --- |
| clerk_user_id | text | part of pk |
| key | text | `first_plant`, `streak_7`, `plants_10`, `streak_30` |
| unlocked_at | timestamptz | |
| pk (clerk_user_id, key) | | |

### reminder_log

Push idempotency (Phase 3). One row per (plant, due date, kind) so a retried job
cannot double-send.

| Column | Type | Notes |
| --- | --- | --- |
| id | uuid pk | |
| clerk_user_id | text | |
| plant_id | uuid fk plants on delete cascade | |
| due_date | date | |
| kind | reminder_kind | `due` \| `digest` \| `overdue` |
| sent_at | timestamptz | |
| unique (plant_id, due_date, kind) | | |

## Extra columns added during implementation

- `plants.snoozed_until timestamptz` — snooze moves the notification without
  moving the watering schedule.
- `plants.light`, `plants.difficulty` — cached care values from the identification
  so the detail Care tab does not depend on the species cache.
- `notification_prefs.created_at/updated_at`, `care_events.created_at` — audit only.

## Storage

Bucket `plant-photos` — path `{clerk_user_id}/{plant_id}.jpg`. Private; signed URLs via API.

Bucket `avatars` (migration `0002_avatars.sql`) — path `{clerk_user_id}/avatar-{timestamp}.{ext}`.
Public read, because a profile photo is rendered in the app's own header with no signing round-trip
and must keep working offline. Nothing sensitive lives there: it is a photo the user chose to upload,
and writes still require the service role that only the API holds. Uploading replaces the previous
object, so a user's folder holds at most one file.

`npm run seed:photos -- <clerk_user_id>` fills in missing `plant.photo_path` values with the plant's
species photo from Wikipedia (credited in the plant's notes), so the demo does not show placeholder
art. It writes to `plant-photos` like any other upload.

## Derived fields

- **Due today:** `date(next_due_at in user tz) = today`
- **Overdue days:** `today - date(next_due_at)` if positive
- **Home headline count:** plants due or overdue
- **Monthly waterings:** count `care_events` watered in month
- **Missed days:** scheduled days with no watered event (compute in API)

## Seed plants (Alex Morgan)

The seed writes **plants and care history only**. Identity — `full_name`, `email`,
`avatar_url` — always comes from Clerk (`apps/api/src/lib/identity.ts`), because Clerk is the
only identity store: seeding "Alex Morgan" onto a real account is why the app greeted a new
sign-up as Alex. `npm run seed -- --name` opts into the demo name for a throwaway account.

| Nickname | Species | Location | Interval | Status in mock |
| --- | --- | --- | --- | --- |
| Monty | Monstera deliciosa | Living room | 7 | Due today |
| Pearl | Peace Lily (Spathiphyllum) | | 7 | Due today |
| Ficus | Fiddle Leaf Fig (Ficus lyrata) | | 7 | Overdue 2d |
| Sunny | Echeveria elegans | | ~14 | in 6 days |
| Zizi | ZZ Plant (Zamioculcas zamiifolia) | | | in 3 days |
| Rio | Ficus elastica | | | in 2 days |

Last watered example: Monty Mar 8, 2026; next Mar 16 8:00 AM when “2 days” remains (mock clock **Tuesday 14 March 2026**).
