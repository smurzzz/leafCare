import { updateMeSchema } from '@leafcare/shared';
import { clerkClient } from '@clerk/nextjs/server';

import { authenticate } from '@/lib/auth';
import { handle, json, noContent, preflight, readJson } from '@/lib/http';
import { buildMePayload, updateProfile, wipeUserData } from '@/lib/me';
import { createContext } from '@/lib/plants';
import { ensureProfile } from '@/lib/profile';
import { removeFolder } from '@/lib/supabase';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const OPTIONS = (request: Request) => preflight(request);

/** GET /api/me — profile, stats, achievements and notification prefs. */
export const GET = handle(async (request) => {
  const { clerkUserId } = await authenticate(request);
  const profile = await ensureProfile(clerkUserId);
  return json(await buildMePayload(createContext(profile)));
});

/** PATCH /api/me — fullName, theme, units, timezone, avatar. */
export const PATCH = handle(async (request) => {
  const { clerkUserId } = await authenticate(request);
  const profile = await ensureProfile(clerkUserId);
  const input = await readJson(request, (value) => updateMeSchema.parse(value ?? {}));
  const updated = await updateProfile(profile, input);
  return json(await buildMePayload(createContext(updated)));
});

type MinimalClerkClient = { users: { deleteUser: (id: string) => Promise<unknown> } };

const deleteClerkUser = async (clerkUserId: string): Promise<void> => {
  try {
    // `clerkClient` is a lazily-resolved client: awaiting it yields the client.
    const client = (await clerkClient()) as unknown as MinimalClerkClient;
    await client.users.deleteUser(clerkUserId);
  } catch (error) {
    // docs/troubleshooting.md: our rows are already gone, so a Clerk failure
    // leaves a recoverable empty account rather than orphaned plant data.
    console.warn('[me] failed to delete Clerk user', error);
  }
};

/**
 * DELETE /api/me — wipes photos, plants, care history, prefs and achievements,
 * then the Clerk user. Data first so a Clerk failure cannot orphan rows.
 */
export const DELETE = handle(async (request) => {
  const { clerkUserId } = await authenticate(request);
  const profile = await ensureProfile(clerkUserId);

  await removeFolder(clerkUserId);
  await wipeUserData(clerkUserId, profile.id);
  await deleteClerkUser(clerkUserId);

  return noContent();
});
