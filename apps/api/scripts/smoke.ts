/**
 * Authenticated smoke test — the pre-demo check.
 *
 * Mints a real Clerk session token for a user through the Backend API and then
 * exercises every signed-in endpoint, validating each response with the *same*
 * zod schema the mobile app uses. A pass therefore means the API's actual JSON
 * satisfies the client contract, not merely that it returned 200.
 *
 *   npm run smoke --workspace @leafcare/api -- <clerk_user_id> [baseUrl]
 *
 * Minting a session is a server-to-server test action; nothing is emailed and no
 * end-user credential is involved.
 */

import './load-env';

import {
  careLogResponseSchema,
  homeResponseSchema,
  meResponseSchema,
  plantDetailResponseSchema,
  plantListResponseSchema,
  remindersResponseSchema,
  speciesSearchResponseSchema,
  waterPlantResponseSchema,
} from '@leafcare/shared';

import { env } from '../src/lib/env';

const clerkUserId = process.argv[2];
const baseUrl = process.argv[3] ?? 'http://localhost:3000';

if (!clerkUserId) {
  console.error('Usage: npm run smoke --workspace @leafcare/api -- <clerk_user_id> [baseUrl]');
  process.exit(1);
}

type Check = { name: string; ok: boolean; detail: string };
const checks: Check[] = [];

const post = async (path: string, body: unknown) => {
  const response = await fetch(`https://api.clerk.com/v1${path}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${env.clerkSecretKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body ?? {}),
  });
  if (!response.ok) {
    throw new Error(`Clerk ${path} -> HTTP ${response.status} ${(await response.text()).slice(0, 200)}`);
  }
  return (await response.json()) as Record<string, unknown>;
};

const call = async <T>(
  name: string,
  path: string,
  token: string,
  schema: { safeParse: (value: unknown) => { success: boolean; error?: { issues: unknown[] } } },
  init?: { method?: string; body?: unknown },
): Promise<T | null> => {
  const response = await fetch(`${baseUrl}${path}`, {
    method: init?.method ?? 'GET',
    headers: {
      Authorization: `Bearer ${token}`,
      ...(init?.body ? { 'Content-Type': 'application/json' } : {}),
    },
    body: init?.body ? JSON.stringify(init.body) : undefined,
  });

  const text = await response.text();
  if (!response.ok) {
    checks.push({ name, ok: false, detail: `HTTP ${response.status} ${text.slice(0, 160)}` });
    return null;
  }

  let payload: unknown;
  try {
    payload = JSON.parse(text);
  } catch {
    checks.push({ name, ok: false, detail: 'response was not JSON' });
    return null;
  }

  const parsed = schema.safeParse(payload);
  if (!parsed.success) {
    checks.push({
      name,
      ok: false,
      detail: `contract mismatch: ${JSON.stringify(parsed.error?.issues?.[0] ?? {}).slice(0, 160)}`,
    });
    return null;
  }

  checks.push({ name, ok: true, detail: 'ok' });
  return payload as T;
};

const main = async (): Promise<void> => {
  console.log(`\nSmoke test\n  user    : ${clerkUserId}\n  baseUrl : ${baseUrl}\n`);

  const session = await post('/sessions', { user_id: clerkUserId });
  const sessionId = session.id as string;
  const tokens = await post(`/sessions/${sessionId}/tokens`, {});
  const token = tokens.jwt as string;
  if (!token) throw new Error('Clerk returned no session token');
  console.log(`  session : ${sessionId}\n`);

  await call<{ firstName: string }>('GET /api/me', '/api/me', token, meResponseSchema);
  const home = await call<{
    firstName: string;
    dueCount: number;
    today: { nickname: string; status: string; statusLabel: string; overdueDays: number }[];
    upcoming: { nickname: string }[];
  }>('GET /api/home', '/api/home', token, homeResponseSchema);
  const plants = await call<{ plants: { id: string; nickname: string; status: string }[] }>(
    'GET /api/plants',
    '/api/plants',
    token,
    plantListResponseSchema,
  );
  const reminders = await call<{ empty: boolean; groups: unknown[] }>(
    'GET /api/reminders',
    '/api/reminders',
    token,
    remindersResponseSchema,
  );
  const careLog = await call<{ wateringsThisMonth: number; recent: unknown[] }>(
    'GET /api/care-log',
    '/api/care-log',
    token,
    careLogResponseSchema,
  );
  await call('GET /api/species?q=f', '/api/species?q=f', token, speciesSearchResponseSchema);

  const firstPlant = plants?.plants[0];
  if (firstPlant) {
    await call(
      `GET /api/plants/${firstPlant.id.slice(0, 12)}…`,
      `/api/plants/${firstPlant.id}`,
      token,
      plantDetailResponseSchema,
    );

    // The one mutating call: mark the first plant watered, exactly as the app
    // does optimistically on tap.
    const watered = await call<{ streakDays?: number }>(
      'POST /api/plants/:id/water',
      `/api/plants/${firstPlant.id}/water`,
      token,
      waterPlantResponseSchema,
      { method: 'POST', body: { amountMl: 250, source: 'detail' } },
    );
    if (watered) {
      // Confirm it persisted, rather than trusting the write response.
      const after = await call<{ plants: { id: string; status: string }[] }>(
        'GET /api/plants (after water)',
        '/api/plants',
        token,
        plantListResponseSchema,
      );
      const updated = after?.plants.find((plant) => plant.id === firstPlant.id);
      checks.push({
        name: 'water persisted',
        ok: Boolean(updated) && updated?.status !== 'overdue',
        detail: `${firstPlant.nickname}: ${firstPlant.status} -> ${updated?.status ?? 'missing'}`,
      });
    }
  }

  console.log('Results');
  for (const { name, ok, detail } of checks) {
    console.log(`  [${ok ? ' ok ' : 'FAIL'}] ${name.padEnd(34)} ${detail}`);
  }

  if (home) {
    console.log(
      `\nHome for ${home.firstName}: dueCount=${home.dueCount}, today=${home.today.length}, upcoming=${home.upcoming.length}`,
    );
    for (const row of home.today) {
      console.log(`  today    ${row.nickname.padEnd(8)} ${row.status.padEnd(10)} ${row.statusLabel}`);
    }
    for (const row of home.upcoming) console.log(`  upcoming ${row.nickname}`);
  }
  if (reminders) console.log(`\nReminders: empty=${reminders.empty}, groups=${reminders.groups.length}`);
  if (careLog) console.log(`Care log: wateringsThisMonth=${careLog.wateringsThisMonth}, recent=${careLog.recent.length}`);

  const failures = checks.filter((check) => !check.ok);
  console.log(
    failures.length === 0
      ? `\nAll ${checks.length} checks passed.\n`
      : `\n${failures.length} of ${checks.length} checks failed.\n`,
  );
  process.exit(failures.length === 0 ? 0 : 1);
};

void main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
