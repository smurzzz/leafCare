/**
 * Device-local state: the onboarding flag, cached read payloads and the offline
 * watering queue (XC-1: local care logs queue and sync later).
 */

import AsyncStorage from '@react-native-async-storage/async-storage';

export const StorageKeys = {
  hasOnboarded: 'leafcare.hasOnboarded.v1',
  homeCache: 'leafcare.cache.home',
  plantsCache: 'leafcare.cache.plants',
  remindersCache: 'leafcare.cache.reminders',
  wateringQueue: 'leafcare.queue.watering',
  pushToken: 'leafcare.pushToken',
} as const;

/**
 * Cache keys are scoped per Clerk user: a device can be signed into more than one
 * account, and a cached Home payload must never render for the wrong one.
 */
export const userScopedKey = (base: string, userId: string): string => `${base}.${userId}`;

export const readJson = async <T>(key: string): Promise<T | null> => {
  try {
    const raw = await AsyncStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
};

export const writeJson = async (key: string, value: unknown): Promise<void> => {
  try {
    await AsyncStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Cache writes are best-effort; never break a screen because of storage.
  }
};

export const removeKey = async (key: string): Promise<void> => {
  try {
    await AsyncStorage.removeItem(key);
  } catch {
    /* ignore */
  }
};

export const hasOnboarded = async (): Promise<boolean> =>
  (await AsyncStorage.getItem(StorageKeys.hasOnboarded)) === 'true';

export const setHasOnboarded = async (value: boolean): Promise<void> => {
  await AsyncStorage.setItem(StorageKeys.hasOnboarded, String(value));
};

export type QueuedWatering = {
  id: string;
  plantId: string;
  nickname: string;
  source: 'home' | 'detail' | 'reminders' | 'scan';
  queuedAt: string;
};

const queueId = (plantId: string): string => `${plantId}:${Date.now()}`;

export const readWateringQueue = async (): Promise<QueuedWatering[]> =>
  (await readJson<QueuedWatering[]>(StorageKeys.wateringQueue)) ?? [];

export const enqueueWatering = async (
  entry: Omit<QueuedWatering, 'id' | 'queuedAt'>,
): Promise<QueuedWatering[]> => {
  const current = await readWateringQueue();
  // Only one pending watering per plant: the last tap wins.
  const withoutDuplicate = current.filter((item) => item.plantId !== entry.plantId);
  const next = [
    ...withoutDuplicate,
    { ...entry, id: queueId(entry.plantId), queuedAt: new Date().toISOString() },
  ];
  await writeJson(StorageKeys.wateringQueue, next);
  return next;
};

export const clearWateringQueue = async (): Promise<void> => {
  await removeKey(StorageKeys.wateringQueue);
};

export const writeWateringQueue = async (queue: QueuedWatering[]): Promise<void> => {
  await writeJson(StorageKeys.wateringQueue, queue);
};
