-- LeafCare initial schema (docs/database.md) + reminder_log (Phase 3 idempotency).
-- Run in the Supabase SQL editor or with `supabase db push`.

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------- enums
do $$
begin
  if not exists (select 1 from pg_type where typname = 'plant_location_kind') then
    create type plant_location_kind as enum ('living_room', 'bedroom', 'kitchen', 'office', 'custom');
  end if;
  if not exists (select 1 from pg_type where typname = 'care_event_type') then
    create type care_event_type as enum ('watered', 'missed', 'snoozed');
  end if;
  if not exists (select 1 from pg_type where typname = 'identify_status') then
    create type identify_status as enum ('pending', 'succeeded', 'failed', 'cancelled');
  end if;
  if not exists (select 1 from pg_type where typname = 'reminder_kind') then
    create type reminder_kind as enum ('due', 'digest', 'overdue');
  end if;
end
$$;

-- ---------------------------------------------------------------- helpers
create or replace function public.current_clerk_user_id()
returns text
language sql
stable
as $$
  select coalesce(
    nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'sub',
    nullif(current_setting('request.jwt.claim.sub', true), '')
  );
$$;

create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ---------------------------------------------------------------- profiles
create table if not exists public.profiles (
  id uuid primary key default gen_random_uuid(),
  clerk_user_id text unique not null,
  full_name text,
  email text,
  avatar_url text,
  theme text not null default 'system' check (theme in ('light', 'system', 'dark')),
  units text not null default 'metric' check (units in ('metric', 'imperial')),
  timezone text not null default 'Asia/Manila',
  current_streak_days int not null default 0,
  last_care_date date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists profiles_touch on public.profiles;
create trigger profiles_touch before update on public.profiles
  for each row execute function public.touch_updated_at();

-- ------------------------------------------------- notification_prefs
create table if not exists public.notification_prefs (
  user_id uuid primary key references public.profiles (id) on delete cascade,
  watering_reminders boolean not null default true,
  daily_digest_time time not null default '09:00',
  snooze_preset text not null default '3h' check (snooze_preset in ('1h', '3h', 'tomorrow')),
  overdue_nudges boolean not null default true,
  quiet_start time not null default '22:00',
  quiet_end time not null default '07:00',
  expo_push_token text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists notification_prefs_touch on public.notification_prefs;
create trigger notification_prefs_touch before update on public.notification_prefs
  for each row execute function public.touch_updated_at();

-- ---------------------------------------------------------------- species
create table if not exists public.species_cache (
  id uuid primary key default gen_random_uuid(),
  scientific_name text unique not null,
  common_name text,
  default_interval_days int,
  light text,
  difficulty text,
  care_notes jsonb default '{}'::jsonb,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------- plants
create table if not exists public.plants (
  id uuid primary key default gen_random_uuid(),
  clerk_user_id text not null,
  nickname text not null,
  species_scientific text,
  species_common text,
  location_kind plant_location_kind,
  location_custom text,
  photo_path text,
  interval_days int not null check (interval_days between 1 and 60),
  recommended_interval_days int,
  reminder_time time not null default '08:00',
  last_watered_at timestamptz,
  next_due_at timestamptz,
  snoozed_until timestamptz,
  streak_weeks int not null default 0,
  light text,
  difficulty text,
  notes text,
  identify_confidence numeric(4, 3),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists plants_user_due_idx on public.plants (clerk_user_id, next_due_at);

drop trigger if exists plants_touch on public.plants;
create trigger plants_touch before update on public.plants
  for each row execute function public.touch_updated_at();

-- -------------------------------------------------------- identifications
create table if not exists public.identifications (
  id uuid primary key default gen_random_uuid(),
  clerk_user_id text not null,
  photo_path text,
  status identify_status not null default 'pending',
  provider text not null default 'plant.id',
  raw_response jsonb,
  suggestions jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists identifications_user_idx on public.identifications (clerk_user_id, created_at desc);

-- ---------------------------------------------------------- care_events
create table if not exists public.care_events (
  id uuid primary key default gen_random_uuid(),
  plant_id uuid not null references public.plants (id) on delete cascade,
  clerk_user_id text not null,
  type care_event_type not null,
  amount_ml int,
  occurred_at timestamptz not null default now(),
  source text,
  created_at timestamptz not null default now()
);

create index if not exists care_events_user_idx on public.care_events (clerk_user_id, occurred_at desc);
create index if not exists care_events_plant_idx on public.care_events (plant_id, occurred_at desc);

-- ---------------------------------------------------------- achievements
create table if not exists public.achievements (
  clerk_user_id text not null,
  key text not null,
  unlocked_at timestamptz not null default now(),
  primary key (clerk_user_id, key)
);

-- --------------------------------------------------------- reminder_log
create table if not exists public.reminder_log (
  id uuid primary key default gen_random_uuid(),
  clerk_user_id text not null,
  plant_id uuid not null references public.plants (id) on delete cascade,
  due_date date not null,
  kind reminder_kind not null,
  sent_at timestamptz not null default now(),
  unique (plant_id, due_date, kind)
);

-- ------------------------------------------------------------------- RLS
alter table public.profiles enable row level security;
alter table public.notification_prefs enable row level security;
alter table public.species_cache enable row level security;
alter table public.plants enable row level security;
alter table public.identifications enable row level security;
alter table public.care_events enable row level security;
alter table public.achievements enable row level security;
alter table public.reminder_log enable row level security;

-- Read-only species catalogue for signed-in users.
drop policy if exists species_read on public.species_cache;
create policy species_read on public.species_cache
  for select using (public.current_clerk_user_id() is not null);

drop policy if exists profiles_own on public.profiles;
create policy profiles_own on public.profiles
  for all using (clerk_user_id = public.current_clerk_user_id())
  with check (clerk_user_id = public.current_clerk_user_id());

drop policy if exists notification_prefs_own on public.notification_prefs;
create policy notification_prefs_own on public.notification_prefs
  for all using (
    user_id in (select id from public.profiles where clerk_user_id = public.current_clerk_user_id())
  )
  with check (
    user_id in (select id from public.profiles where clerk_user_id = public.current_clerk_user_id())
  );

drop policy if exists plants_own on public.plants;
create policy plants_own on public.plants
  for all using (clerk_user_id = public.current_clerk_user_id())
  with check (clerk_user_id = public.current_clerk_user_id());

drop policy if exists identifications_own on public.identifications;
create policy identifications_own on public.identifications
  for all using (clerk_user_id = public.current_clerk_user_id())
  with check (clerk_user_id = public.current_clerk_user_id());

drop policy if exists care_events_own on public.care_events;
create policy care_events_own on public.care_events
  for all using (clerk_user_id = public.current_clerk_user_id())
  with check (clerk_user_id = public.current_clerk_user_id());

drop policy if exists achievements_own on public.achievements;
create policy achievements_own on public.achievements
  for all using (clerk_user_id = public.current_clerk_user_id())
  with check (clerk_user_id = public.current_clerk_user_id());

drop policy if exists reminder_log_own on public.reminder_log;
create policy reminder_log_own on public.reminder_log
  for all using (clerk_user_id = public.current_clerk_user_id())
  with check (clerk_user_id = public.current_clerk_user_id());

-- --------------------------------------------------------------- storage
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('plant-photos', 'plant-photos', false, 8388608, array['image/jpeg', 'image/png', 'image/heic', 'image/heif'])
on conflict (id) do nothing;

drop policy if exists plant_photos_read on storage.objects;
create policy plant_photos_read on storage.objects
  for select using (
    bucket_id = 'plant-photos'
    and (storage.foldername(name))[1] = public.current_clerk_user_id()
  );

drop policy if exists plant_photos_write on storage.objects;
create policy plant_photos_write on storage.objects
  for insert with check (
    bucket_id = 'plant-photos'
    and (storage.foldername(name))[1] = public.current_clerk_user_id()
  );

drop policy if exists plant_photos_delete on storage.objects;
create policy plant_photos_delete on storage.objects
  for delete using (
    bucket_id = 'plant-photos'
    and (storage.foldername(name))[1] = public.current_clerk_user_id()
  );

-- --------------------------------------------------------- species seeds
insert into public.species_cache (scientific_name, common_name, default_interval_days, light, difficulty, care_notes)
values
  ('Monstera deliciosa', 'Swiss cheese plant', 7, 'Bright indirect', 'Easy', '{"lightDetail":"Bright indirect — 2 m from a south-facing window."}'),
  ('Spathiphyllum wallisii', 'Peace Lily', 7, 'Medium indirect', 'Easy', '{"lightDetail":"Medium indirect light; droops visibly when thirsty."}'),
  ('Ficus lyrata', 'Fiddle Leaf Fig', 10, 'Bright, near window', 'Fussy', '{"lightDetail":"Bright, near a window; hates being moved."}'),
  ('Zamioculcas zamiifolia', 'ZZ Plant', 14, 'Low to medium', 'Easy', '{"lightDetail":"Low to medium light; let the soil dry fully."}'),
  ('Ficus elastica', 'Rubber plant', 7, 'Bright indirect', 'Easy', '{"lightDetail":"Bright indirect light; wipe leaves monthly."}'),
  ('Echeveria elegans', 'Mexican snowball', 14, 'Direct sun', 'Medium', '{"lightDetail":"Direct sun; soak and dry only."}')
on conflict (scientific_name) do nothing;
