import { pushTokenSchema } from '@leafcare/shared';

import { authenticate } from '@/lib/auth';
import { handle, json, preflight, readJson } from '@/lib/http';
import { savePushToken } from '@/lib/me';
import { ensureProfile } from '@/lib/profile';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const OPTIONS = (request: Request) => preflight(request);

/** POST /api/me/push-token — tokens are stored, never logged. */
export const POST = handle(async (request) => {
  const { clerkUserId } = await authenticate(request);
  const profile = await ensureProfile(clerkUserId);
  const body = await readJson(request, (value) => pushTokenSchema.parse(value ?? {}));
  await savePushToken(profile.id, body.token);
  return json({ ok: true });
});
