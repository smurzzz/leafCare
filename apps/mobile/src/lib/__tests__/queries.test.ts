/**
 * Offline cache (src/lib/queries.ts, XC-1 and screen 26).
 *
 * On launch the app restores the last Home / My Plants / Reminders payloads into
 * the React Query cache so a cold start or an unreachable API still shows the
 * user's plants instead of an empty screen. Two things are pinned here:
 *
 *  - hydration only ever reads keys belonging to the signed-in Clerk user,
 *  - and signing out (or wiping) clears only that user's keys.
 *
 * The fixtures are parsed through the shared zod contracts, so a shape drift in
 * `@leafcare/shared` fails this suite rather than the app.
 */

import { homeResponseSchema, type HomeResponse, type RemindersResponse } from '@leafcare/shared';
import { QueryClient } from '@tanstack/react-query';

import { asyncStorageControl } from '../../../test/async-storage';
import { clearUserCaches, hydrateQueryCache, queryKeys, setCacheOwner } from '../queries';
import { StorageKeys, readJson, userScopedKey, writeJson } from '../storage';

const homeFixture: HomeResponse = homeResponseSchema.parse({
  overline: 'Sunday, March 8',
  greeting: 'Good morning',
  firstName: 'Alex',
  dueCount: 2,
  progress: 0.5,
  headline: '2 plants need water today',
  streakDays: 9,
  today: [
    {
      plantId: 'plant_1',
      nickname: 'Ficus',
      species: 'Ficus lyrata',
      photoUrl: null,
      status: 'overdue',
      statusLabel: 'Overdue 2d',
      dueInDays: 0,
      overdueDays: 2,
      reminderTime: '08:15',
    },
  ],
  upcoming: [],
});

const remindersFixture: RemindersResponse = {
  groups: [
    {
      key: 'today',
      label: 'Today',
      items: [
        {
          plantId: 'plant_1',
          title: 'Water Ficus',
          nickname: 'Ficus',
          time: '08:15',
          photoUrl: null,
          overdue: true,
        },
      ],
    },
  ],
  completed: [],
  empty: false,
};

const newClient = (): QueryClient =>
  new QueryClient({ defaultOptions: { queries: { retry: false } } });

beforeEach(() => {
  asyncStorageControl.reset();
  setCacheOwner(null);
});

describe('hydrateQueryCache', () => {
  it('does nothing before a Clerk user is known', async () => {
    const client = newClient();
    await writeJson(userScopedKey(StorageKeys.homeCache, 'user_a'), homeFixture);

    await hydrateQueryCache(client);

    expect(client.getQueryData(queryKeys.home)).toBeUndefined();
  });

  it('restores the signed-in user payloads into the cache', async () => {
    const client = newClient();
    setCacheOwner('user_a');
    await writeJson(userScopedKey(StorageKeys.homeCache, 'user_a'), homeFixture);
    await writeJson(userScopedKey(StorageKeys.plantsCache, 'user_a'), { plants: [] });
    await writeJson(userScopedKey(StorageKeys.remindersCache, 'user_a'), remindersFixture);

    await hydrateQueryCache(client);

    expect(client.getQueryData(queryKeys.home)).toEqual(homeFixture);
    expect(client.getQueryData(queryKeys.plants())).toEqual({ plants: [] });
    expect(client.getQueryData(queryKeys.reminders('upcoming'))).toEqual(remindersFixture);
  });

  it('never hydrates another account payload left on the same device', async () => {
    const client = newClient();
    // The case that matters: user_b cached plants here, then signed out, and now
    // user_a opens the app. Reading that key would show user_b's plants.
    await writeJson(userScopedKey(StorageKeys.homeCache, 'user_b'), homeFixture);
    setCacheOwner('user_a');

    await hydrateQueryCache(client);

    expect(client.getQueryData(queryKeys.home)).toBeUndefined();
  });

  it('ignores a corrupted cached payload instead of seeding garbage', async () => {
    const client = newClient();
    setCacheOwner('user_a');
    asyncStorageControl.seed(userScopedKey(StorageKeys.homeCache, 'user_a'), '{"overline":');

    await hydrateQueryCache(client);

    expect(client.getQueryData(queryKeys.home)).toBeUndefined();
  });
});

describe('clearUserCaches', () => {
  it('drops only the current user keys and their queries', async () => {
    const client = newClient();
    setCacheOwner('user_a');
    await writeJson(userScopedKey(StorageKeys.homeCache, 'user_a'), homeFixture);
    await writeJson(userScopedKey(StorageKeys.plantsCache, 'user_b'), { plants: [] });
    client.setQueryData(queryKeys.home, homeFixture);

    await clearUserCaches(client);

    expect(await readJson(userScopedKey(StorageKeys.homeCache, 'user_a'))).toBeNull();
    // Another account's cache on this device is untouched.
    expect(await readJson(userScopedKey(StorageKeys.plantsCache, 'user_b'))).toEqual({ plants: [] });
    expect(client.getQueryData(queryKeys.home)).toBeUndefined();
  });

  it('does nothing without a signed-in user', async () => {
    setCacheOwner(null);
    await writeJson(userScopedKey(StorageKeys.homeCache, 'user_a'), homeFixture);

    await clearUserCaches();

    expect(await readJson(userScopedKey(StorageKeys.homeCache, 'user_a'))).toEqual(homeFixture);
  });
});

describe('queryKeys', () => {
  it('scopes list queries by filter and search term', () => {
    expect(queryKeys.plants()).toEqual(['plants', 'all', '']);
    expect(queryKeys.plants('overdue', 'ficus')).toEqual(['plants', 'overdue', 'ficus']);
  });

  it('scopes the care log by month and plant', () => {
    expect(queryKeys.careLog('2026-03')).toEqual(['care-log', '2026-03', 'all']);
    expect(queryKeys.careLog('2026-03', 'plant_1')).toEqual(['care-log', '2026-03', 'plant_1']);
  });
});
