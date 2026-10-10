/**
 * Plant domain service: schedule math, serialisation to the shared contract and
 * the watering/streak/achievement mutations.
 *
 * Every function takes `clerkUserId` first and filters by it — there is no code
 * path that can read another user's plant.
 */

import {
  ACHIEVEMENT_KEYS,
  ACHIEVEMENT_META,
  careCardsFor,
  computeNextDueAt,
  dueCountdownLabel,
  dueInfoFor,
  formatClockTime,
  formatMediumDate,
  formatWeekdayDate,
  locationLabel,
  nextStreak,
  statusLabel,
  toColorStatus,
  unlockedAchievements,
  localDateKey,
  type AchievementKey,
  type PlantSummary,
  type LocationKindValue,
} from '@leafcare/shared';

import type { AchievementRow, CareEventRow, PlantRow, ProfileRow } from './db-types';
import { HttpError, notFound } from './http';
import { signedPhotoUrl, supabaseAdmin } from './supabase';

export type RequestContext = {
  profile: ProfileRow;
  timeZone: string;
  now: Date;
};

export const createContext = (profile: ProfileRow, now = new Date()): RequestContext => ({
  profile,
  timeZone: profile.timezone?.trim() || 'Asia/Manila',
  now,
});

/** `last_watered_at + interval_days` at the plant's reminder time. */
export const computePlantNextDue = (plant: PlantRow, timeZone: string): Date | null =>
  computeNextDueAt({
    lastWateredAt: plant.last_watered_at,
    intervalDays: plant.interval_days,
    reminderTime: plant.reminder_time,
    timeZone,
  });

export const serializePlant = (options: {
  plant: PlantRow;
  photoUrl: string | null;
  context: RequestContext;
  /** Snooze pushes the notification without moving the schedule. */
  applySnooze?: boolean;
}): PlantSummary => {
  const { plant, photoUrl, context } = options;
  const nextDue = computePlantNextDue(plant, context.timeZone);
  const nextDueAt =
    options.applySnooze && plant.snoozed_until ? new Date(plant.snoozed_until) : nextDue;
  const info = dueInfoFor({ nextDueAt, now: context.now, timeZone: context.timeZone });

  return {
    id: plant.id,
    nickname: plant.nickname,
    speciesScientific: plant.species_scientific,
    speciesCommon: plant.species_common,
    locationKind: plant.location_kind as LocationKindValue | null,
    locationCustom: plant.location_custom,
    locationLabel: locationLabel(plant.location_kind, plant.location_custom),
    photoUrl,
    intervalDays: plant.interval_days,
    reminderTime: plant.reminder_time,
    lastWateredAt: plant.last_watered_at,
    nextDueAt: nextDueAt ? nextDueAt.toISOString() : null,
    status: info.status,
    overdueDays: info.overdueDays,
    dueInDays: info.dueInDays,
    statusLabel: statusLabel(info),
    streakWeeks: plant.streak_weeks,
    notes: plant.notes,
    confidence: plant.identify_confidence,
    createdAt: plant.created_at,
  };
};

export const colorStatusFor = (plant: PlantSummary) => toColorStatus(plant.status);

export const listPlantRows = async (clerkUserId: string): Promise<PlantRow[]> => {
  const { data, error } = await supabaseAdmin()
    .from('plants')
    .select('*')
    .eq('clerk_user_id', clerkUserId)
    .order('nickname', { ascending: true })
    .returns<PlantRow[]>();
  if (error) throw new Error(`Failed to list plants: ${error.message}`);
  return data ?? [];
};

export const requirePlant = async (clerkUserId: string, plantId: string): Promise<PlantRow> => {
  const { data, error } = await supabaseAdmin()
    .from('plants')
    .select('*')
    .eq('clerk_user_id', clerkUserId)
    .eq('id', plantId)
    .maybeSingle<PlantRow>();
  if (error) throw new Error(`Failed to read plant: ${error.message}`);
  if (!data) throw notFound('Plant not found');
  return data;
};

export const serializePlantWithPhoto = async (
  plant: PlantRow,
  context: RequestContext,
): Promise<PlantSummary> =>
  serializePlant({ plant, photoUrl: await signedPhotoUrl(plant.photo_path), context });

export const serializePlants = async (
  plants: PlantRow[],
  context: RequestContext,
): Promise<PlantSummary[]> =>
  Promise.all(plants.map((plant) => serializePlantWithPhoto(plant, context)));

const updatePlantRow = async (plantId: string, patch: Partial<PlantRow>): Promise<PlantRow> => {
  const { data, error } = await supabaseAdmin()
    .from('plants')
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq('id', plantId)
    .select('*')
    .single<PlantRow>();
  if (error) throw new Error(`Failed to update plant: ${error.message}`);
  return data;
};

/** Persists the computed `next_due_at` after an interval or reminder change. */
export const refreshSchedule = async (
  plant: PlantRow,
  timeZone: string,
): Promise<PlantRow> => {
  const nextDue = computePlantNextDue(plant, timeZone);
  return updatePlantRow(plant.id, {
    next_due_at: nextDue ? nextDue.toISOString() : null,
    snoozed_until: null,
  });
};

export type WaterResult = {
  plant: PlantRow;
  careEvent: CareEventRow;
  streakDays: number;
};

/**
 * Marks a plant watered: writes a care event, advances the schedule and updates
 * the household streak. Interval days are counted from the watering instant so
 * a late watering does not compress the next one.
 */
export const waterPlant = async (options: {
  clerkUserId: string;
  plantId: string;
  context: RequestContext;
  amountMl?: number;
  source?: string;
  occurredAt?: string;
}): Promise<WaterResult> => {
  const { clerkUserId, plantId, context } = options;
  const plant = await requirePlant(clerkUserId, plantId);

  const occurredAt = options.occurredAt ? new Date(options.occurredAt) : context.now;
  const previousInfo = dueInfoFor({
    nextDueAt: computePlantNextDue(plant, context.timeZone),
    now: context.now,
    timeZone: context.timeZone,
  });
  const wasOverdue = previousInfo.status === 'overdue';

  const nextDue = computeNextDueAt({
    lastWateredAt: occurredAt,
    intervalDays: plant.interval_days,
    reminderTime: plant.reminder_time,
    timeZone: context.timeZone,
  });

  const { data: careEvent, error: careError } = await supabaseAdmin()
    .from('care_events')
    .insert({
      plant_id: plant.id,
      clerk_user_id: clerkUserId,
      type: 'watered',
      amount_ml: options.amountMl ?? null,
      occurred_at: occurredAt.toISOString(),
      source: options.source ?? 'home',
    })
    .select('*')
    .single<CareEventRow>();
  if (careError) throw new Error(`Failed to log care event: ${careError.message}`);

  const updated = await updatePlantRow(plant.id, {
    last_watered_at: occurredAt.toISOString(),
    next_due_at: nextDue ? nextDue.toISOString() : null,
    snoozed_until: null,
    streak_weeks: wasOverdue ? 1 : plant.streak_weeks + 1,
  });

  const streakDays = await updateHouseholdStreak({
    profile: context.profile,
    careDateKey: localDateKey(occurredAt, context.timeZone),
    wasOverdue,
  });

  await unlockEligibleAchievements(clerkUserId);

  return { plant: updated, careEvent, streakDays };
};

/** Household streak: consecutive on-time care days, reset when a day is missed. */
export const updateHouseholdStreak = async (options: {
  profile: ProfileRow;
  careDateKey: string;
  wasOverdue: boolean;
}): Promise<number> => {
  const { profile, careDateKey, wasOverdue } = options;
  const streak = nextStreak({
    currentStreakDays: profile.current_streak_days,
    lastCareDateKey: profile.last_care_date,
    todayKey: careDateKey,
    wasOverdue,
  });

  const { error } = await supabaseAdmin()
    .from('profiles')
    .update({
      current_streak_days: streak,
      last_care_date: careDateKey,
      updated_at: new Date().toISOString(),
    })
    .eq('id', profile.id);
  if (error) throw new Error(`Failed to update streak: ${error.message}`);

  profile.current_streak_days = streak;
  profile.last_care_date = careDateKey;
  return streak;
};

export const listAchievements = async (clerkUserId: string): Promise<AchievementRow[]> => {
  const { data, error } = await supabaseAdmin()
    .from('achievements')
    .select('*')
    .eq('clerk_user_id', clerkUserId)
    .returns<AchievementRow[]>();
  if (error) throw new Error(`Failed to list achievements: ${error.message}`);
  return data ?? [];
};

/** Counts plants + streak, then records any newly earned badges. */
export const unlockEligibleAchievements = async (clerkUserId: string): Promise<AchievementKey[]> => {
  const supabase = supabaseAdmin();
  const [{ count: plantCount }, { data: profile }] = await Promise.all([
    supabase
      .from('plants')
      .select('id', { count: 'exact', head: true })
      .eq('clerk_user_id', clerkUserId),
    supabase.from('profiles').select('*').eq('clerk_user_id', clerkUserId).maybeSingle<ProfileRow>(),
  ]);

  const earned = unlockedAchievements({
    plants: plantCount ?? 0,
    streakDays: profile?.current_streak_days ?? 0,
  });
  if (earned.length === 0) return [];

  const { data: existing } = await supabase
    .from('achievements')
    .select('key')
    .eq('clerk_user_id', clerkUserId)
    .returns<Array<{ key: string }>>();
  const have = new Set((existing ?? []).map((row) => row.key));
  const fresh = earned.filter((key) => !have.has(key));
  if (fresh.length === 0) return [];

  const { error } = await supabase.from('achievements').insert(
    fresh.map((key) => ({ clerk_user_id: clerkUserId, key, unlocked_at: new Date().toISOString() })),
  );
  // A unique-violation race is fine: another request unlocked the same badge.
  if (error && !error.message.includes('duplicate')) {
    throw new Error(`Failed to unlock achievements: ${error.message}`);
  }
  return fresh;
};

export const achievementPayload = (unlocked: AchievementRow[]) => {
  const unlockedMap = new Map(unlocked.map((row) => [row.key, row.unlocked_at]));
  return ACHIEVEMENT_KEYS.map((key) => ({
    key,
    title: ACHIEVEMENT_META[key].title,
    description: ACHIEVEMENT_META[key].description,
    unlocked: unlockedMap.has(key),
    unlockedAt: unlockedMap.get(key) ?? null,
  }));
};

/** Detail-only fields: care cards and human schedule labels. */
export const plantDetailExtras = (plant: PlantRow, context: RequestContext) => {
  const nextDue = computePlantNextDue(plant, context.timeZone);
  const info = dueInfoFor({ nextDueAt: nextDue, now: context.now, timeZone: context.timeZone });
  return {
    recommendedIntervalDays: plant.recommended_interval_days,
    careCards: careCardsFor({
      speciesScientific: plant.species_scientific,
      intervalDays: plant.interval_days,
      light: plant.light,
      difficulty: plant.difficulty,
    }),
    nextWateringLabel:
      info.status === 'overdue'
        ? `Overdue by ${dueCountdownLabel(info)}`
        : info.status === 'due_today'
          ? 'Due today'
          : `Next watering in ${dueCountdownLabel(info)}`,
    scheduledForLabel: nextDue
      ? `${formatWeekdayDate(nextDue, context.timeZone)} · ${formatClockTime(plant.reminder_time)}`
      : null,
  };
};

export const plantHistory = async (clerkUserId: string, plantId: string, limit = 40) => {
  const { data, error } = await supabaseAdmin()
    .from('care_events')
    .select('*')
    .eq('clerk_user_id', clerkUserId)
    .eq('plant_id', plantId)
    .order('occurred_at', { ascending: false })
    .limit(limit)
    .returns<CareEventRow[]>();
  if (error) throw new Error(`Failed to read care history: ${error.message}`);
  return (data ?? []).map((event) => ({
    id: event.id,
    type: event.type,
    amountMl: event.amount_ml,
    occurredAt: event.occurred_at,
    source: event.source,
  }));
};

export const plantLastWateredLabel = (plant: PlantRow, timeZone: string): string =>
  plant.last_watered_at
    ? formatMediumDate(new Date(plant.last_watered_at), timeZone)
    : 'Not yet watered';

export const requirePlantId = (plantId: string): string => {
  if (!plantId || plantId.length < 8) throw new HttpError(400, 'BAD_REQUEST', 'Invalid plant id');
  return plantId;
};
