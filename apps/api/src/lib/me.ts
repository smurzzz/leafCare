/**
 * Profile + settings payload (screens 21–22) and notification preferences.
 */

import type { MeResponse } from '@leafcare/shared';

import type { NotificationPrefsRow, ProfileRow } from './db-types';
import { achievementPayload, listAchievements, type RequestContext } from './plants';
import { supabaseAdmin } from './supabase';

export const loadNotificationPrefs = async (userId: string): Promise<NotificationPrefsRow> => {
  const { data, error } = await supabaseAdmin()
    .from('notification_prefs')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle<NotificationPrefsRow>();
  if (error) throw new Error(`Failed to read notification prefs: ${error.message}`);
  if (data) return data;

  const { data: created, error: insertError } = await supabaseAdmin()
    .from('notification_prefs')
    .insert({ user_id: userId })
    .select('*')
    .single<NotificationPrefsRow>();
  if (insertError) throw new Error(`Failed to create notification prefs: ${insertError.message}`);
  return created;
};

export const prefsToPayload = (prefs: NotificationPrefsRow) => ({
  wateringReminders: prefs.watering_reminders,
  dailyDigestTime: prefs.daily_digest_time.slice(0, 5),
  snoozePreset: prefs.snooze_preset,
  overdueNudges: prefs.overdue_nudges,
  quietStart: prefs.quiet_start.slice(0, 5),
  quietEnd: prefs.quiet_end.slice(0, 5),
});

export const buildMePayload = async (context: RequestContext): Promise<MeResponse> => {
  const supabase = supabaseAdmin();
  const clerkUserId = context.profile.clerk_user_id;

  const [{ count: plantCount }, { count: wateringCount }, unlocked, prefs] = await Promise.all([
    supabase.from('plants').select('id', { count: 'exact', head: true }).eq('clerk_user_id', clerkUserId),
    supabase
      .from('care_events')
      .select('id', { count: 'exact', head: true })
      .eq('clerk_user_id', clerkUserId)
      .eq('type', 'watered'),
    listAchievements(clerkUserId),
    loadNotificationPrefs(context.profile.id),
  ]);

  const achievements = achievementPayload(unlocked);

  return {
    profile: {
      id: context.profile.id,
      fullName: context.profile.full_name,
      email: context.profile.email,
      avatarUrl: context.profile.avatar_url,
      theme: context.profile.theme,
      units: context.profile.units,
      timezone: context.profile.timezone,
      createdAt: context.profile.created_at,
    },
    stats: {
      plants: plantCount ?? 0,
      streakDays: context.profile.current_streak_days,
      waterings: wateringCount ?? 0,
      achievementsUnlocked: achievements.filter((entry) => entry.unlocked).length,
      achievementsTotal: achievements.length,
    },
    achievements,
    prefs: prefsToPayload(prefs),
  };
};

export const updateProfile = async (
  profile: ProfileRow,
  patch: {
    fullName?: string;
    theme?: ProfileRow['theme'];
    units?: ProfileRow['units'];
    timezone?: string;
    avatarUrl?: string | null;
  },
): Promise<ProfileRow> => {
  const update: Partial<ProfileRow> = { updated_at: new Date().toISOString() };
  if (patch.fullName !== undefined) update.full_name = patch.fullName;
  if (patch.theme !== undefined) update.theme = patch.theme;
  if (patch.units !== undefined) update.units = patch.units;
  if (patch.timezone !== undefined) update.timezone = patch.timezone;
  if (patch.avatarUrl !== undefined) update.avatar_url = patch.avatarUrl;

  const { data, error } = await supabaseAdmin()
    .from('profiles')
    .update(update)
    .eq('id', profile.id)
    .select('*')
    .single<ProfileRow>();
  if (error) throw new Error(`Failed to update profile: ${error.message}`);
  return data;
};

export const updatePrefs = async (
  userId: string,
  patch: {
    wateringReminders?: boolean;
    dailyDigestTime?: string;
    snoozePreset?: NotificationPrefsRow['snooze_preset'];
    overdueNudges?: boolean;
  },
): Promise<NotificationPrefsRow> => {
  const update: Partial<NotificationPrefsRow> = {};
  if (patch.wateringReminders !== undefined) update.watering_reminders = patch.wateringReminders;
  if (patch.dailyDigestTime !== undefined) update.daily_digest_time = patch.dailyDigestTime;
  if (patch.snoozePreset !== undefined) update.snooze_preset = patch.snoozePreset;
  if (patch.overdueNudges !== undefined) update.overdue_nudges = patch.overdueNudges;

  if (Object.keys(update).length === 0) return loadNotificationPrefs(userId);

  const { data, error } = await supabaseAdmin()
    .from('notification_prefs')
    .update(update)
    .eq('user_id', userId)
    .select('*')
    .single<NotificationPrefsRow>();
  if (error) throw new Error(`Failed to update notification prefs: ${error.message}`);
  return data;
};

export const savePushToken = async (userId: string, token: string): Promise<void> => {
  const { error } = await supabaseAdmin()
    .from('notification_prefs')
    .update({ expo_push_token: token })
    .eq('user_id', userId);
  if (error) throw new Error(`Failed to save push token: ${error.message}`);
};

/** Full data wipe for DELETE /api/me — data first, Clerk user second. */
export const wipeUserData = async (clerkUserId: string, profileId: string): Promise<void> => {
  const supabase = supabaseAdmin();
  await supabase.from('care_events').delete().eq('clerk_user_id', clerkUserId);
  await supabase.from('plants').delete().eq('clerk_user_id', clerkUserId);
  await supabase.from('identifications').delete().eq('clerk_user_id', clerkUserId);
  await supabase.from('achievements').delete().eq('clerk_user_id', clerkUserId);
  await supabase.from('reminder_log').delete().eq('clerk_user_id', clerkUserId);
  await supabase.from('notification_prefs').delete().eq('user_id', profileId);
  await supabase.from('profiles').delete().eq('id', profileId);
};
