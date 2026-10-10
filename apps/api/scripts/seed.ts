/**
 * Seeds Alex Morgan's six demo plants so Home / My Plants / Reminders match the
 * screenshots (docs/database.md "Seed plants").
 *
 * Usage:
 *   npm run seed --workspace @leafcare/api -- <clerk_user_id> [--reset]
 *
 * The Clerk user id is the only thing the script needs: profiles are created on
 * demand, exactly like the webhook would.
 */

import './load-env';

import { FALLBACK_TIME_ZONE, computeNextDueAt, localDateKey } from '@leafcare/shared';

import type { NotificationPrefsRow, PlantRow, ProfileRow } from '../src/lib/db-types';
import { supabaseAdmin } from '../src/lib/supabase';

type SeedPlant = {
  nickname: string;
  scientific: string;
  common: string;
  locationKind: PlantRow['location_kind'];
  intervalDays: number;
  recommendedIntervalDays: number;
  light: string;
  difficulty: string;
  /** Days before "today" the plant was last watered (relative mock). */
  wateredDaysAgo: number;
  streakWeeks: number;
  amountMl: number;
  reminderTime: string;
};

const SEED_PLANTS: SeedPlant[] = [
  {
    nickname: 'Monty',
    scientific: 'Monstera deliciosa',
    common: 'Swiss cheese plant',
    locationKind: 'living_room',
    intervalDays: 7,
    recommendedIntervalDays: 7,
    light: 'Bright indirect',
    difficulty: 'Easy',
    wateredDaysAgo: 7,
    streakWeeks: 7,
    amountMl: 250,
    reminderTime: '08:00',
  },
  {
    nickname: 'Pearl',
    scientific: 'Spathiphyllum wallisii',
    common: 'Peace Lily',
    locationKind: 'kitchen',
    intervalDays: 7,
    recommendedIntervalDays: 7,
    light: 'Medium indirect',
    difficulty: 'Easy',
    wateredDaysAgo: 7,
    streakWeeks: 4,
    amountMl: 150,
    reminderTime: '08:00',
  },
  {
    nickname: 'Ficus',
    scientific: 'Ficus lyrata',
    common: 'Fiddle Leaf Fig',
    locationKind: 'bedroom',
    intervalDays: 7,
    recommendedIntervalDays: 10,
    light: 'Bright, near window',
    difficulty: 'Fussy',
    wateredDaysAgo: 9,
    streakWeeks: 3,
    amountMl: 300,
    reminderTime: '08:00',
  },
  {
    nickname: 'Sunny',
    scientific: 'Echeveria elegans',
    common: 'Mexican snowball',
    locationKind: 'bedroom',
    intervalDays: 14,
    recommendedIntervalDays: 14,
    light: 'Direct sun',
    difficulty: 'Medium',
    wateredDaysAgo: 8,
    streakWeeks: 9,
    amountMl: 120,
    reminderTime: '10:00',
  },
  {
    nickname: 'Zizi',
    scientific: 'Zamioculcas zamiifolia',
    common: 'ZZ Plant',
    locationKind: 'office',
    intervalDays: 14,
    recommendedIntervalDays: 14,
    light: 'Low to medium',
    difficulty: 'Easy',
    wateredDaysAgo: 11,
    streakWeeks: 12,
    amountMl: 120,
    reminderTime: '09:00',
  },
  {
    nickname: 'Rio',
    scientific: 'Ficus elastica',
    common: 'Rubber plant',
    locationKind: 'living_room',
    intervalDays: 7,
    recommendedIntervalDays: 7,
    light: 'Bright indirect',
    difficulty: 'Easy',
    wateredDaysAgo: 5,
    streakWeeks: 5,
    amountMl: 200,
    reminderTime: '09:00',
  },
];

const shiftDays = (date: Date, days: number): Date => {
  const copy = new Date(date.getTime());
  copy.setUTCDate(copy.getUTCDate() - days);
  return copy;
};

const main = async (): Promise<void> => {
  const [clerkUserId, ...flags] = process.argv.slice(2);
  if (!clerkUserId) {
    console.error(
      'Usage: npm run seed --workspace @leafcare/api -- <clerk_user_id> [--reset]\n' +
        'Find the id with `npx clerk api users list` or in the Clerk dashboard.',
    );
    process.exit(1);
  }
  const reset = flags.includes('--reset');

  const supabase = supabaseAdmin();
  const now = new Date();
  const timeZone = FALLBACK_TIME_ZONE;

  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .upsert(
      {
        clerk_user_id: clerkUserId,
        full_name: 'Alex Morgan',
        email: 'alex.morgan@leafcare.app',
        timezone: timeZone,
        theme: 'system',
        units: 'metric',
        current_streak_days: 7,
        last_care_date: localDateKey(shiftDays(now, 1), timeZone),
      },
      { onConflict: 'clerk_user_id' },
    )
    .select('*')
    .single<ProfileRow>();
  if (profileError) throw new Error(profileError.message);

  await supabase
    .from('notification_prefs')
    .upsert({ user_id: profile.id, daily_digest_time: '09:00', snooze_preset: '3h' }, {
      onConflict: 'user_id',
    })
    .returns<NotificationPrefsRow[]>();

  if (reset) {
    await supabase.from('care_events').delete().eq('clerk_user_id', clerkUserId);
    await supabase.from('plants').delete().eq('clerk_user_id', clerkUserId);
    await supabase.from('reminder_log').delete().eq('clerk_user_id', clerkUserId);
    await supabase.from('achievements').delete().eq('clerk_user_id', clerkUserId);
  }

  const { data: existing } = await supabase
    .from('plants')
    .select('nickname')
    .eq('clerk_user_id', clerkUserId)
    .returns<Array<{ nickname: string }>>();
  const have = new Set((existing ?? []).map((row) => row.nickname));

  for (const plant of SEED_PLANTS) {
    if (have.has(plant.nickname)) continue;

    const lastWateredAt = shiftDays(now, plant.wateredDaysAgo);
    const nextDueAt = computeNextDueAt({
      lastWateredAt,
      intervalDays: plant.intervalDays,
      reminderTime: plant.reminderTime,
      timeZone,
    });

    const { data: inserted, error } = await supabase
      .from('plants')
      .insert({
        clerk_user_id: clerkUserId,
        nickname: plant.nickname,
        species_scientific: plant.scientific,
        species_common: plant.common,
        location_kind: plant.locationKind,
        interval_days: plant.intervalDays,
        recommended_interval_days: plant.recommendedIntervalDays,
        reminder_time: plant.reminderTime,
        last_watered_at: lastWateredAt.toISOString(),
        next_due_at: nextDueAt ? nextDueAt.toISOString() : null,
        streak_weeks: plant.streakWeeks,
        light: plant.light,
        difficulty: plant.difficulty,
        identify_confidence: 0.94,
      })
      .select('*')
      .single<PlantRow>();
    if (error) throw new Error(`Failed to seed ${plant.nickname}: ${error.message}`);

    // A little history so the care log calendar has dots in the current month.
    const events = Array.from({ length: 5 }, (_, index) => ({
      plant_id: inserted.id,
      clerk_user_id: clerkUserId,
      type: 'watered' as const,
      amount_ml: plant.amountMl,
      occurred_at: shiftDays(now, plant.wateredDaysAgo + index * plant.intervalDays).toISOString(),
      source: index === 0 ? 'home' : 'detail',
    }));
    await supabase.from('care_events').insert(events);
  }

  await supabase.from('achievements').upsert(
    [
      { clerk_user_id: clerkUserId, key: 'first_plant' },
      { clerk_user_id: clerkUserId, key: 'streak_7' },
    ],
    { onConflict: 'clerk_user_id,key' },
  );

  console.log(`Seeded ${SEED_PLANTS.length} plants for ${clerkUserId}.`);
};

void main().catch((error) => {
  console.error(error);
  process.exit(1);
});
