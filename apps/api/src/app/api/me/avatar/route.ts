import { authenticate } from '@/lib/auth';
import { extensionForContentType, handle, json, preflight, readImageUpload } from '@/lib/http';
import { buildMePayload, updateProfile } from '@/lib/me';
import { createContext } from '@/lib/plants';
import { ensureProfile } from '@/lib/profile';
import { avatarBucket, listInBucket, publicUrlIn, removeFromBucket, uploadToBucket } from '@/lib/supabase';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const OPTIONS = (request: Request) => preflight(request);

/**
 * POST /api/me/avatar — multipart `image`, sets the profile photo (screen 21).
 *
 * The photo is stored under the Clerk user id, and the previous object is removed
 * so a user's folder never accumulates versions. The returned payload is the whole
 * `MeResponse`, so the app can replace its cached profile in one round trip.
 */
export const POST = handle(async (request) => {
  const { clerkUserId } = await authenticate(request);
  const profile = await ensureProfile(clerkUserId);
  const image = await readImageUpload(request);

  const folder = clerkUserId;
  const previous = await listInBucket(avatarBucket, folder);
  const path = `${folder}/avatar-${Date.now()}.${extensionForContentType(image.contentType)}`;

  await uploadToBucket({
    bucket: avatarBucket,
    path,
    bytes: image.bytes,
    contentType: image.contentType,
  });

  const updated = await updateProfile(profile, { avatarUrl: publicUrlIn(avatarBucket, path) });

  // Best-effort cleanup: a stale object is untidy, not an error worth failing on.
  await removeFromBucket(avatarBucket, previous).catch(() => undefined);

  return json(await buildMePayload(createContext(updated)));
});

/** DELETE /api/me/avatar — back to the drawn initials. */
export const DELETE = handle(async (request) => {
  const { clerkUserId } = await authenticate(request);
  const profile = await ensureProfile(clerkUserId);

  const stored = await listInBucket(avatarBucket, clerkUserId);
  await removeFromBucket(avatarBucket, stored).catch(() => undefined);

  const updated = await updateProfile(profile, { avatarUrl: null });
  return json(await buildMePayload(createContext(updated)));
});
