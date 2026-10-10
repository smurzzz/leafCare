/**
 * Profile bootstrap. A `profiles` row plus default `notification_prefs` is
 * created by the Clerk webhook on user.created; API routes call `ensureProfile`
 * too, so a session that lands before the webhook still works.
 */

import { FALLBACK_TIME_ZONE } from '@leafcare/shared';

import type { ProfileRow } from './db-types';
import { supabaseAdmin } from './supabase';

export type ProfileSeed = {
  fullName?: string | null;
  email?: string | null;
  avatarUrl?: string | null;
};

export const ensureProfile = async (
  clerkUserId: string,
  seed: ProfileSeed = {},
): Promise<ProfileRow> => {
  const supabase = supabaseAdmin();

  const { data: existing, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('clerk_user_id', clerkUserId)
    .maybeSingle<ProfileRow>();

  if (error) throw new Error(`Failed to read profile: ${error.message}`);

  if (existing) {
    const patch: Partial<ProfileRow> = {};
    if (seed.fullName && seed.fullName !== existing.full_name) patch.full_name = seed.fullName;
    if (seed.email && seed.email !== existing.email) patch.email = seed.email;
    if (seed.avatarUrl && seed.avatarUrl !== existing.avatar_url) patch.avatar_url = seed.avatarUrl;
    if (Object.keys(patch).length === 0) return existing;

    const { data: updated, error: updateError } = await supabase
      .from('profiles')
      .update({ ...patch, updated_at: new Date().toISOString() })
      .eq('clerk_user_id', clerkUserId)
      .select('*')
      .single<ProfileRow>();
    if (updateError) throw new Error(`Failed to update profile: ${updateError.message}`);
    return updated;
  }

  const { data: created, error: insertError } = await supabase
    .from('profiles')
    .insert({
      clerk_user_id: clerkUserId,
      full_name: seed.fullName ?? null,
      email: seed.email ?? null,
      avatar_url: seed.avatarUrl ?? null,
      timezone: FALLBACK_TIME_ZONE,
    })
    .select('*')
    .single<ProfileRow>();
  if (insertError) throw new Error(`Failed to create profile: ${insertError.message}`);

  await ensureNotificationPrefs(created.id);

  return created;
};

export const ensureNotificationPrefs = async (userId: string): Promise<void> => {
  const { error } = await supabaseAdmin()
    .from('notification_prefs')
    .upsert({ user_id: userId }, { onConflict: 'user_id', ignoreDuplicates: true });
  if (error) throw new Error(`Failed to create notification prefs: ${error.message}`);
};

export const getProfile = async (clerkUserId: string): Promise<ProfileRow> =>
  ensureProfile(clerkUserId);

export const profileTimeZone = (profile: ProfileRow): string =>
  profile.timezone?.trim() || FALLBACK_TIME_ZONE;
