/**
 * Profile bootstrap. A `profiles` row plus default `notification_prefs` is
 * created by the Clerk webhook on user.created; API routes call `ensureProfile`
 * too, so a session that lands before the webhook still works.
 */

import { clerkClient } from '@clerk/nextjs/server';
import { FALLBACK_TIME_ZONE } from '@leafcare/shared';

import type { ProfileRow } from './db-types';
import {
  identityFromClerkSdkUser,
  identityPatch,
  type ClerkSdkUser,
  type ProfileIdentity,
} from './identity';
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

type MinimalClerkClient = {
  users: {
    getUser: (id: string) => Promise<unknown>;
    updateUser: (id: string, params: { firstName?: string; lastName?: string }) => Promise<unknown>;
  };
};

/**
 * `/api/me` is called on every app start and after most mutations, so identity
 * is read from Clerk at most once a minute per user rather than once a request.
 */
const IDENTITY_TTL_MS = 60_000;
const identityCache = new Map<string, { at: number; identity: ProfileIdentity }>();

const readClerkIdentity = async (clerkUserId: string): Promise<ProfileIdentity | null> => {
  const cached = identityCache.get(clerkUserId);
  if (cached && Date.now() - cached.at < IDENTITY_TTL_MS) return cached.identity;

  try {
    const client = (await clerkClient()) as unknown as MinimalClerkClient;
    // The SDK resolves to a camelCase User object, unlike the webhook payload.
    const identity = identityFromClerkSdkUser(
      (await client.users.getUser(clerkUserId)) as ClerkSdkUser,
    );
    identityCache.set(clerkUserId, { at: Date.now(), identity });
    return identity;
  } catch (error) {
    // A Clerk hiccup must not blank a profile screen: keep the stored values.
    console.warn('[profile] could not read the Clerk user', error);
    return null;
  }
};

/** Drops the memoised read so the next sync sees a change we just made. */
const forgetIdentity = (clerkUserId: string): void => {
  identityCache.delete(clerkUserId);
};

/**
 * Pushes a name edited in the app back to Clerk.
 *
 * Without this the sync below would immediately undo it: Clerk wins on every
 * read, so an app-side rename has to reach Clerk to survive.
 */
export const pushNameToClerk = async (clerkUserId: string, fullName: string): Promise<void> => {
  const trimmed = fullName.trim();
  if (!trimmed) return;
  const [first, ...rest] = trimmed.split(/\s+/);

  try {
    const client = (await clerkClient()) as unknown as MinimalClerkClient;
    await client.users.updateUser(clerkUserId, {
      firstName: first,
      lastName: rest.join(' '),
    });
    forgetIdentity(clerkUserId);
  } catch (error) {
    // The row is already updated locally, and the next sync will reconcile from
    // whichever value Clerk holds — never fail the user's save over this.
    console.warn('[profile] could not push the name to Clerk', error);
  }
};

/**
 * Mirrors Clerk's name, email and photo onto the profile row. Clerk wins
 * whenever it has a value.
 *
 * This is what self-heals a profile whose name was overwritten by something
 * else — the demo seed writing "Alex Morgan" into a real account, for instance.
 */
export const syncIdentityFromClerk = async (profile: ProfileRow): Promise<ProfileRow> => {
  const identity = await readClerkIdentity(profile.clerk_user_id);
  if (!identity) return profile;

  const patch = identityPatch(profile, identity);
  if (Object.keys(patch).length === 0) return profile;

  const { data, error } = await supabaseAdmin()
    .from('profiles')
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq('id', profile.id)
    .select('*')
    .single<ProfileRow>();
  if (error) {
    console.warn('[profile] could not persist the Clerk identity', error);
    return profile;
  }

  return data;
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
