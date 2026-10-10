import { updateNotificationPrefsSchema } from '@leafcare/shared';

import { authenticate } from '@/lib/auth';
import { handle, json, preflight, readJson } from '@/lib/http';
import { loadNotificationPrefs, prefsToPayload, updatePrefs } from '@/lib/me';
import { ensureProfile } from '@/lib/profile';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const OPTIONS = (request: Request) => preflight(request);

/** GET /api/me/notifications */
export const GET = handle(async (request) => {
  const { clerkUserId } = await authenticate(request);
  const profile = await ensureProfile(clerkUserId);
  return json(prefsToPayload(await loadNotificationPrefs(profile.id)));
});

/** PUT /api/me/notifications */
export const PUT = handle(async (request) => {
  const { clerkUserId } = await authenticate(request);
  const profile = await ensureProfile(clerkUserId);
  const input = await readJson(request, (value) =>
    updateNotificationPrefsSchema.parse(value ?? {}),
  );
  const updated = await updatePrefs(profile.id, input);
  return json(prefsToPayload(updated));
});
