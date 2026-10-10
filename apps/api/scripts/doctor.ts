/**
 * Probes every integration and reports what is actually wired up.
 *
 * `/api/health` can only report which variables are *present*; this script makes
 * a real read-only call to each service so "configured" means "reachable":
 *
 *   - Supabase REST: the tables from `supabase/migrations/0001_init.sql`
 *   - Supabase schema: the column defaults every migration is supposed to have set,
 *     read from PostgREST's OpenAPI document, so half-applied migrations show up here
 *   - Supabase Storage: the private `plant-photos` bucket
 *   - Clerk Backend API: the secret key, plus how many users exist
 *   - Plant.Net / Plant.id: whether a vendor key is present (auth is only
 *     exercised by a real identification, see `npm run job:reminders`)
 *
 * No secret value is ever printed — only status codes and names.
 *
 *   npm run doctor --workspace @leafcare/api
 */

import './load-env';

import { env } from '../src/lib/env';

const TABLES = [
  'profiles',
  'notification_prefs',
  'plants',
  'identifications',
  'care_events',
  'achievements',
  'species_cache',
  'reminder_log',
];

const results: { label: string; ok: boolean; detail: string }[] = [];
const record = (label: string, ok: boolean, detail: string) => {
  results.push({ label, ok, detail });
};

const snippet = (text: string): string => text.replace(/\s+/g, ' ').trim().slice(0, 140);

/** Supabase's error codes mapped to the fix the reader actually needs. */
const EXPLAIN: Record<string, string> = {
  PGRST205: 'not in the schema cache — apply supabase/migrations/0001_init.sql',
  PGRST301: 'permission denied — check the service role key and RLS policies',
  NoSuchBucket: 'bucket missing — the migration creates it, or create it in Storage',
};

const explain = (status: number, body: string): string => {
  try {
    const parsed = JSON.parse(body) as { code?: string; message?: string };
    const code = parsed.code ?? `HTTP ${status}`;
    const hint = parsed.code ? EXPLAIN[parsed.code] : undefined;
    return hint ? `${code} — ${hint}` : `${code} ${snippet(parsed.message ?? body)}`;
  } catch {
    return `HTTP ${status} ${snippet(body)}`;
  }
};

const attempt = async (fn: () => Promise<void>): Promise<string | null> => {
  try {
    await fn();
    return null;
  } catch (error) {
    return error instanceof Error ? error.message : String(error);
  }
};

/**
 * Column defaults that only exist once a migration has actually run.
 *
 * PostgREST builds its OpenAPI document from the live schema, `default` included,
 * so this answers "did 0003 run?" without a database password. That mistake is
 * worth catching: the app ships Light, and a new profile row inserts with no
 * `theme`, so an unapplied migration leaves the server handing back `system`.
 */
const EXPECTED_DEFAULTS: Array<[table: string, column: string, value: string]> = [
  ['profiles', 'theme', 'light'],
  ['profiles', 'units', 'metric'],
  ['profiles', 'timezone', 'Asia/Manila'],
  ['plants', 'reminder_time', '08:00'],
  ['notification_prefs', 'quiet_start', '22:00'],
  ['notification_prefs', 'quiet_end', '07:00'],
  ['notification_prefs', 'snooze_preset', '3h'],
];

/** Postgres returns `22:00:00` for a `time` default, and the seconds are noise. */
const normalizeDefault = (value: unknown): string =>
  String(value).replace(/^(\d{2}:\d{2})(:00(\.0+)?)?$/, '$1');

const checkColumnDefaults = async (url: string, headers: Record<string, string>): Promise<void> => {
  try {
    const response = await fetch(`${url}/rest/v1/`, {
      headers: { ...headers, Accept: 'application/openapi+json' },
    });
    if (!response.ok) throw new Error(explain(response.status, await response.text()));

    const document = (await response.json()) as {
      definitions?: Record<string, { properties?: Record<string, { default?: unknown }> }>;
    };

    const drift = EXPECTED_DEFAULTS.flatMap(([table, column, expected]) => {
      const actual = document.definitions?.[table]?.properties?.[column]?.default;
      if (actual !== undefined && normalizeDefault(actual) === expected) return [];
      const found = actual === undefined ? 'unset' : `'${String(actual)}'`;
      return [`${table}.${column} is ${found} — expected '${expected}'`];
    });

    record(
      'Migration drift',
      drift.length === 0,
      drift.length === 0
        ? `${EXPECTED_DEFAULTS.length} column defaults match the migrations`
        : drift.join(' | '),
    );
  } catch (error) {
    record('Migration drift', false, error instanceof Error ? error.message : String(error));
  }
};

const checkSupabase = async (): Promise<void> => {
  let url: string;
  let key: string;
  try {
    url = env.supabaseUrl;
    key = env.supabaseServiceRoleKey;
  } catch (error) {
    record('Supabase', false, error instanceof Error ? error.message : String(error));
    return;
  }

  const headers = { apikey: key, Authorization: `Bearer ${key}` };
  const missing: string[] = [];

  const problem = new Map<string, string>();
  for (const table of TABLES) {
    const error = await attempt(async () => {
      const response = await fetch(`${url}/rest/v1/${table}?select=*&limit=0`, { headers });
      if (!response.ok) {
        throw new Error(explain(response.status, await response.text()));
      }
    });
    if (error) problem.set(table, error);
  }

  // Group by cause, not by table: a whole missing migration and one drifted
  // table need different fixes, but eight identical 404s need one line.
  const grouped = new Map<string, string[]>();
  for (const [table, error] of problem) {
    grouped.set(error, [...(grouped.get(error) ?? []), table]);
  }
  for (const [error, tables] of grouped) {
    missing.push(`${tables.length}/${TABLES.length} tables (${tables.join(', ')}) ${error}`);
  }

  record(
    'Supabase tables',
    missing.length === 0,
    missing.length === 0 ? `all ${TABLES.length} present` : missing.join(' | '),
  );

  // Both buckets matter, and their public flag is part of the contract: plant
  // photos are private and read through signed URLs, while avatars are public so
  // the app can render them without a signing round-trip. A bucket with the wrong
  // visibility looks configured and then silently shows no image.
  const buckets: Array<{ name: string; expectPublic: boolean }> = [
    { name: env.photoBucket, expectPublic: false },
    { name: 'avatars', expectPublic: true },
  ];

  for (const { name, expectPublic } of buckets) {
    const bucketError = await attempt(async () => {
      const response = await fetch(`${url}/storage/v1/bucket/${name}`, { headers });
      if (!response.ok) {
        throw new Error(explain(response.status, await response.text()));
      }
      const body = (await response.json()) as { public?: boolean };
      if (Boolean(body.public) !== expectPublic) {
        throw new Error(
          `${name} is ${body.public ? 'public' : 'private'} — expected ${expectPublic ? 'public' : 'private'}`,
        );
      }
    });
    record(
      'Supabase storage',
      !bucketError,
      bucketError ?? `${name} present (${expectPublic ? 'public' : 'private'})`,
    );
  }

  await checkColumnDefaults(url, headers);
};

const checkClerk = async (): Promise<void> => {
  let key: string;
  try {
    key = env.clerkSecretKey;
  } catch (error) {
    record('Clerk', false, error instanceof Error ? error.message : String(error));
    return;
  }

  try {
    const response = await fetch('https://api.clerk.com/v1/users?limit=100', {
      headers: { Authorization: `Bearer ${key}` },
    });
    if (!response.ok) {
      record('Clerk', false, `HTTP ${response.status} (check CLERK_SECRET_KEY)`);
      return;
    }
    // The Backend API answers with a bare JSON array — there is no `total_count` field, so
    // reading one reported "0 user(s)" on an instance that does have users and told you to
    // sign up for an account you had already created. The instance-wide total arrives in the
    // `x-total-count` header when pagination is used; otherwise the page length is the count.
    const body = (await response.json()) as unknown;
    const users = Array.isArray(body) ? body : [];
    const headerTotal = Number(response.headers.get('x-total-count'));
    const total = Number.isFinite(headerTotal) && headerTotal > 0 ? headerTotal : users.length;
    // Test vs live matters for deployment: a `sk_test_` instance keeps working in
    // a demo but every account is disposable and the data is not production.
    const instance = key.startsWith('sk_live_') ? 'live' : 'test';
    record(
      'Clerk',
      true,
      `${total} user(s) · ${instance} instance${total === 0 ? ' — no user to seed yet, sign up in the app first' : ''}`,
    );
  } catch (error) {
    record('Clerk', false, error instanceof Error ? error.message : String(error));
  }
};

const checkVendor = (): void => {
  const provider = env.identifyProvider;
  const detail =
    provider === 'plant_id'
      ? `Plant.id key present (${env.plantIdApiUrl})`
      : provider === 'plantnet'
        ? `Plant.Net key present (${env.plantNetApiUrl})`
        : 'no vendor key — deterministic mock will be used';
  record('Identification provider', true, `${provider} · ${detail}`);

  // The name in the root .env.example that nothing reads — the most common
  // copy/paste mistake.
  if (!process.env.PLANTNET_API_KEY && process.env.PLANTNET_ID_API_KEY) {
    record(
      'Identification key name',
      false,
      'PLANTNET_ID_API_KEY is set but no code reads it — rename it to PLANTNET_API_KEY',
    );
  }
};

const checkCron = (): void => {
  const hasSecret = Boolean(env.cronSecret);
  record(
    'Reminder job',
    hasSecret,
    hasSecret
      ? 'CRON_SECRET set — POST /api/jobs/reminders will require it'
      : 'CRON_SECRET unset — the job endpoint is open to anyone who can reach it',
  );
};

const wordmark = (ok: boolean) => (ok ? '  ok  ' : ' FAIL ');

const main = async (): Promise<void> => {
  await checkSupabase();
  await checkClerk();
  checkVendor();
  checkCron();

  console.log('\nLeafCare API setup\n');
  for (const { label, ok, detail } of results) {
    console.log(`[${wordmark(ok)}] ${label.padEnd(26)} ${detail}`);
  }

  const failures = results.filter((result) => !result.ok);
  console.log(
    failures.length === 0
      ? '\nEverything reachable. Next: npm run seed -- <clerk_user_id>\n'
      : `\n${failures.length} check(s) need attention.\n`,
  );

  process.exit(failures.length === 0 ? 0 : 1);
};

void main().catch((error) => {
  console.error(error);
  process.exit(1);
});
