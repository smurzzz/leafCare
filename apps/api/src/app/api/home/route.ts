import { authenticate } from '@/lib/auth';
import { buildHomePayload } from '@/lib/home';
import { handle, json, preflight } from '@/lib/http';
import { createContext } from '@/lib/plants';
import { ensureProfile } from '@/lib/profile';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const OPTIONS = (request: Request) => preflight(request);

/** GET /api/home — greeting, due card, today's care, upcoming rows. */
export const GET = handle(async (request) => {
  const { clerkUserId } = await authenticate(request);
  const profile = await ensureProfile(clerkUserId);
  return json(await buildHomePayload(createContext(profile)));
});
