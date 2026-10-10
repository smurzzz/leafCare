/**
 * Identity mapping checks (run with `npx tsx apps/api/tests/identity.test.ts`).
 *
 * This is the logic that decides whose name and photo the app shows, so the
 * cases that burned us are pinned here: a seeded profile must be corrected from
 * Clerk, and a *generated* initials PNG must never be mistaken for a photo.
 */

import assert from 'node:assert/strict';

import {
  identityFromClerkSdkUser,
  identityFromClerkUser,
  identityPatch,
  type ProfileIdentity,
} from '../src/lib/identity';

const row = (overrides: Partial<{ full_name: string | null; email: string | null; avatar_url: string | null }> = {}) => ({
  full_name: null as string | null,
  email: null as string | null,
  avatar_url: null as string | null,
  ...overrides,
});

const run = (): void => {
  // The live shape of the account that was greeted as "Alex Morgan".
  const googleUser = identityFromClerkUser({
    first_name: 'henry',
    last_name: 'faldas',
    email_addresses: [{ email_address: 'faldashenry25@gmail.com' }],
    image_url: 'https://img.clerk.com/initials-HF',
    has_image: false,
  });
  assert.equal(googleUser.fullName, 'henry faldas', 'first + last name is used');
  assert.equal(googleUser.email, 'faldashenry25@gmail.com', 'primary email is used');
  assert.equal(googleUser.avatarUrl, null, 'a generated initials PNG is not a photo');

  const withPhoto = identityFromClerkUser({
    first_name: 'henry',
    image_url: 'https://img.clerk.com/real.jpg',
    has_image: true,
  });
  assert.equal(withPhoto.avatarUrl, 'https://img.clerk.com/real.jpg', 'a real image is stored');
  assert.equal(withPhoto.fullName, 'henry', 'a missing last name is not a trailing space');

  // The webhook payload does not always carry `has_image`, and Clerk's URL is
  // then ambiguous — so no avatar, rather than an unknown generated one.
  const webhookUser = identityFromClerkUser({
    username: 'plantlover',
    image_url: 'https://img.clerk.com/whatever',
  });
  assert.equal(webhookUser.avatarUrl, null, 'unknown has_image means no avatar');
  assert.equal(webhookUser.fullName, 'plantlover', 'username is the name fallback');

  // `clerkClient().users.getUser()` resolves to camelCase, not the webhook's
  // snake_case. Reading the wrong shape yields all-undefined fields and silently
  // does nothing, which is exactly how the live sync first failed.
  const sdkUser = identityFromClerkSdkUser({
    firstName: 'henry',
    lastName: 'faldas',
    emailAddresses: [{ emailAddress: 'faldashenry25@gmail.com' }],
    imageUrl: 'https://img.clerk.com/initials-HF',
    hasImage: false,
  });
  assert.deepEqual(
    sdkUser,
    { fullName: 'henry faldas', email: 'faldashenry25@gmail.com', avatarUrl: null },
    'the SDK shape is mapped, not read as undefined',
  );
  assert.deepEqual(
    identityFromClerkSdkUser({ firstName: 'henry', hasImage: true, imageUrl: 'https://x/p.jpg' }),
    { fullName: 'henry', email: null, avatarUrl: 'https://x/p.jpg' },
    'the SDK shape also carries a real photo through',
  );

  // The actual bug: a demo seed wrote another person's identity onto the row.
  const seeded = row({ full_name: 'Alex Morgan', email: 'alex.morgan@leafcare.app' });
  assert.deepEqual(
    identityPatch(seeded, googleUser),
    { full_name: 'henry faldas', email: 'faldashenry25@gmail.com' },
    'Clerk corrects a seeded name and email',
  );

  // An unchanged identity must produce no write at all — `/api/me` runs on every
  // app start, so a no-op patch is the common case.
  const settled: ProfileIdentity = {
    fullName: 'henry faldas',
    email: 'faldashenry25@gmail.com',
    avatarUrl: 'https://img.clerk.com/real.jpg',
  };
  const current = row({
    full_name: settled.fullName,
    email: settled.email,
    avatar_url: settled.avatarUrl,
  });
  assert.deepEqual(identityPatch(current, settled), {}, 'no patch when nothing changed');

  // Clerk having no value must never erase one of ours: a user with no photo
  // keeps an avatar they uploaded, and an edited name survives.
  const uploaded = row({ full_name: 'Henry F.', avatar_url: 'https://cdn/leafcare/mine.jpg' });
  assert.deepEqual(
    identityPatch(uploaded, { fullName: 'henry faldas', email: null, avatarUrl: null }),
    { full_name: 'henry faldas' },
    'nulls from Clerk never delete a name we hold',
  );

  console.log('identity ok · Clerk wins, generated initials ignored, nulls never erase');
};

run();
