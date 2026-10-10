import { reminderTabSchema } from '@leafcare/shared';

import { authenticate } from '@/lib/auth';
import { handle, json, preflight } from '@/lib/http';
import { createContext } from '@/lib/plants';
import { ensureProfile } from '@/lib/profile';
import { buildRemindersPayload } from '@/lib/reminders';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const OPTIONS = (request: Request) => preflight(request);

/** GET /api/reminders?tab=upcoming|completed */
export const GET = handle(async (request) => {
  const { clerkUserId } = await authenticate(request);
  const rawTab = new URL(request.url).searchParams.get('tab') ?? 'upcoming';
  const tab = reminderTabSchema.safeParse(rawTab).success
    ? (rawTab as 'upcoming' | 'completed')
    : 'upcoming';
  const profile = await ensureProfile(clerkUserId);
  return json(await buildRemindersPayload(createContext(profile), tab));
});
