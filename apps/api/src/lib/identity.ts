/**
 * The identity bridge between Clerk (the *only* identity store, per AGENTS.md)
 * and our `profiles` row.
 *
 * Deliberately pure — no network, no database, no environment. The Clerk client
 * and the persistence live in `profile.ts`, so this mapping is unit-testable and
 * the webhook and `GET /api/me` cannot drift apart.
 */

import type { ProfileRow } from './db-types';

export type ProfileIdentity = {
  fullName: string | null;
  email: string | null;
  avatarUrl: string | null;
};

/**
 * Clerk hands us the same user in two different shapes, and mixing them up is
 * silent: every field simply reads `undefined`.
 *
 * - `ClerkUserLike` — the webhook payload (and Backend API): snake_case.
 * - `ClerkSdkUser` — what `clerkClient().users.getUser()` resolves to: camelCase.
 */
export type ClerkUserLike = {
  first_name?: string | null;
  last_name?: string | null;
  username?: string | null;
  email_addresses?: Array<{ email_address?: string | null }> | null;
  image_url?: string | null;
  has_image?: boolean | null;
};

export type ClerkSdkUser = {
  firstName?: string | null;
  lastName?: string | null;
  username?: string | null;
  emailAddresses?: Array<{ emailAddress?: string | null }> | null;
  imageUrl?: string | null;
  hasImage?: boolean | null;
};

/** Canonicalises the SDK's camelCase user onto the payload shape above. */
export const clerkUserFromSdk = (user: ClerkSdkUser): ClerkUserLike => ({
  first_name: user.firstName,
  last_name: user.lastName,
  username: user.username,
  email_addresses: (user.emailAddresses ?? []).map((entry) => ({
    email_address: entry?.emailAddress ?? null,
  })),
  image_url: user.imageUrl,
  has_image: user.hasImage,
});

export const identityFromClerkSdkUser = (user: ClerkSdkUser): ProfileIdentity =>
  identityFromClerkUser(clerkUserFromSdk(user));

export const identityFromClerkUser = (user: ClerkUserLike): ProfileIdentity => {
  const fullName =
    [user.first_name, user.last_name].filter(Boolean).join(' ').trim() || user.username || null;
  const email = user.email_addresses?.find((entry) => entry.email_address)?.email_address ?? null;

  // When the user has no photo of their own, Clerk serves a *generated* initials
  // PNG and reports `has_image: false`. That is not a photograph, and the app
  // draws better initials itself from the live theme, so only a real image is
  // ever stored. It also keeps a remote fetch off the critical path.
  const avatarUrl = user.has_image && user.image_url ? user.image_url : null;

  return { fullName, email, avatarUrl };
};

/**
 * What has to change on the row, and nothing more.
 *
 * `null` from Clerk means "Clerk has no value", never "erase what we have": a
 * missing claim must not wipe a name the user edited in the app, and a user with
 * no photo must keep an avatar they uploaded themselves.
 */
export const identityPatch = (
  existing: Pick<ProfileRow, 'full_name' | 'email' | 'avatar_url'>,
  identity: ProfileIdentity,
): Partial<ProfileRow> => {
  const patch: Partial<ProfileRow> = {};
  if (identity.fullName && identity.fullName !== existing.full_name) {
    patch.full_name = identity.fullName;
  }
  if (identity.email && identity.email !== existing.email) patch.email = identity.email;
  if (identity.avatarUrl && identity.avatarUrl !== existing.avatar_url) {
    patch.avatar_url = identity.avatarUrl;
  }
  return patch;
};
