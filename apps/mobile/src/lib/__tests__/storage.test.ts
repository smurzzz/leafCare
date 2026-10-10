/**
 * Device-local state (src/lib/storage.ts).
 *
 * Two properties matter more than the mechanics. Per-user scoping: a device can
 * be signed into more than one account, and a payload cached for one of them must
 * never be read back for the other. And resilience: every read and write here is
 * best-effort, because a screen must keep working when storage throws.
 */

import { asyncStorage, asyncStorageControl } from '../../../test/async-storage';
import {
  StorageKeys,
  clearWateringQueue,
  enqueueWatering,
  hasOnboarded,
  readJson,
  readWateringQueue,
  removeKey,
  setHasOnboarded,
  userScopedKey,
  writeJson,
  writeWateringQueue,
} from '../storage';

beforeEach(() => {
  asyncStorageControl.reset();
});

describe('readJson / writeJson', () => {
  it('round-trips a value', async () => {
    await writeJson('leafcare.test', { nickname: 'Ficus', intervalDays: 7 });
    await expect(readJson('leafcare.test')).resolves.toEqual({
      nickname: 'Ficus',
      intervalDays: 7,
    });
  });

  it('returns null for a key that was never written', async () => {
    await expect(readJson('leafcare.missing')).resolves.toBeNull();
  });

  it('returns null rather than throwing on a corrupted value', async () => {
    // e.g. a value written by an older build, or a partially flushed write.
    asyncStorageControl.seed('leafcare.test', '{"nickname": "Fic');
    await expect(readJson('leafcare.test')).resolves.toBeNull();
  });

  it('survives a storage read failure', async () => {
    asyncStorageControl.seed('leafcare.test', '{"ok":true}');
    asyncStorageControl.fail('read');
    await expect(readJson('leafcare.test')).resolves.toBeNull();
  });

  it('survives a storage write failure', async () => {
    asyncStorageControl.fail('write');
    await expect(writeJson('leafcare.test', { ok: true })).resolves.toBeUndefined();
    expect(asyncStorageControl.snapshot()).toEqual({});
  });

  it('survives a failure while removing a key', async () => {
    asyncStorageControl.fail('write');
    await expect(removeKey('leafcare.test')).resolves.toBeUndefined();
  });
});

describe('userScopedKey', () => {
  it('namespaces a cache key by the Clerk user id', () => {
    expect(userScopedKey(StorageKeys.homeCache, 'user_a')).toBe('leafcare.cache.home.user_a');
    expect(userScopedKey(StorageKeys.homeCache, 'user_a')).not.toBe(
      userScopedKey(StorageKeys.homeCache, 'user_b'),
    );
  });

  it('keeps one account from reading another account payload', async () => {
    await writeJson(userScopedKey(StorageKeys.plantsCache, 'user_a'), { plants: ['Ficus'] });

    await expect(readJson(userScopedKey(StorageKeys.plantsCache, 'user_a'))).resolves.toEqual({
      plants: ['Ficus'],
    });
    await expect(readJson(userScopedKey(StorageKeys.plantsCache, 'user_b'))).resolves.toBeNull();
  });
});

describe('onboarding flag', () => {
  it('defaults to false and remembers true', async () => {
    await expect(hasOnboarded()).resolves.toBe(false);
    await setHasOnboarded(true);
    await expect(hasOnboarded()).resolves.toBe(true);
    expect(asyncStorageControl.snapshot()[StorageKeys.hasOnboarded]).toBe('true');
  });
});

describe('offline watering queue', () => {
  it('starts empty', async () => {
    await expect(readWateringQueue()).resolves.toEqual([]);
  });

  it('queues a tap with an id and a timestamp', async () => {
    const queue = await enqueueWatering({
      plantId: 'plant_1',
      nickname: 'Ficus',
      source: 'home',
    });

    expect(queue).toHaveLength(1);
    expect(queue[0]).toMatchObject({ plantId: 'plant_1', nickname: 'Ficus', source: 'home' });
    expect(queue[0]!.id.startsWith('plant_1:')).toBe(true);
    expect(Number.isNaN(Date.parse(queue[0]!.queuedAt))).toBe(false);
    await expect(readWateringQueue()).resolves.toHaveLength(1);
  });

  it('keeps only the last tap per plant', async () => {
    await enqueueWatering({ plantId: 'plant_1', nickname: 'Ficus', source: 'home' });
    await enqueueWatering({ plantId: 'plant_2', nickname: 'Basil', source: 'detail' });
    const queue = await enqueueWatering({ plantId: 'plant_1', nickname: 'Ficus', source: 'reminders' });

    expect(queue).toHaveLength(2);
    expect(queue.filter((item) => item.plantId === 'plant_1')).toHaveLength(1);
    // The latest tap wins, so the retry carries the source it came from.
    expect(queue.find((item) => item.plantId === 'plant_1')?.source).toBe('reminders');
  });

  it('clears the queue and drops anything left over', async () => {
    await enqueueWatering({ plantId: 'plant_1', nickname: 'Ficus', source: 'home' });
    await clearWateringQueue();
    await expect(readWateringQueue()).resolves.toEqual([]);
    expect(asyncStorageControl.snapshot()[StorageKeys.wateringQueue]).toBeUndefined();
  });

  it('writes and reads the queue back verbatim after a partial flush', async () => {
    const remaining = [
      { id: 'plant_9:1', plantId: 'plant_9', nickname: 'Pothos', source: 'home' as const, queuedAt: '2026-03-08T00:00:00.000Z' },
    ];
    await writeWateringQueue(remaining);
    await expect(readWateringQueue()).resolves.toEqual(remaining);
    expect(asyncStorage.setItem).toHaveBeenCalledWith(
      StorageKeys.wateringQueue,
      JSON.stringify(remaining),
    );
  });

  it('treats an unreadable queue as empty instead of crashing the flush', async () => {
    asyncStorageControl.seed(StorageKeys.wateringQueue, 'not json');
    await expect(readWateringQueue()).resolves.toEqual([]);
  });
});
