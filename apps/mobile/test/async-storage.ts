/**
 * In-memory AsyncStorage for Jest, installed by `jest.setup.ts`.
 *
 * It is a real store — a write can be read back, and keys survive between reads
 * within a test — plus two things the real package cannot offer:
 *
 *  - `asyncStorageControl.snapshot()` / `seed()`, so a test can assert exactly
 *    what was persisted (a second account's payload must not be there) and can
 *    write the malformed values a previous app version may have left behind.
 *  - `asyncStorageControl.fail()`, so the caching and queueing paths can be run
 *    with storage throwing — the behaviour that keeps a screen working on a
 *    phone whose disk is full or whose keychain is locked.
 *
 * Every method is a `jest.fn`, so call counts are assertable too.
 */

export type StorageFailure = 'read' | 'write';

const store = new Map<string, string>();
let failure: StorageFailure | null = null;

const maybeFail = (kind: StorageFailure): void => {
  if (failure === kind) {
    throw new Error(`AsyncStorage ${kind} failed (forced by a test)`);
  }
};

export const asyncStorageControl = {
  /** Empties the store and cancels any forced failure. */
  reset(): void {
    store.clear();
    failure = null;
  },

  /** Everything currently stored, for assertions. */
  snapshot(): Record<string, string> {
    return Object.fromEntries(store);
  },

  /** Writes a raw string exactly as it will be read back. */
  seed(key: string, raw: string): void {
    store.set(key, raw);
  },

  /** Makes every read (or write) reject until `reset()`. */
  fail(kind: StorageFailure): void {
    failure = kind;
  },
};

export const asyncStorage = {
  getItem: jest.fn(async (key: string): Promise<string | null> => {
    maybeFail('read');
    const value = store.get(key);
    return value === undefined ? null : value;
  }),

  setItem: jest.fn(async (key: string, value: string): Promise<void> => {
    maybeFail('write');
    store.set(key, value);
  }),

  removeItem: jest.fn(async (key: string): Promise<void> => {
    maybeFail('write');
    store.delete(key);
  }),

  clear: jest.fn(async (): Promise<void> => {
    maybeFail('write');
    store.clear();
  }),

  getAllKeys: jest.fn(async (): Promise<string[]> => {
    maybeFail('read');
    return [...store.keys()];
  }),

  multiGet: jest.fn(async (keys: string[]): Promise<[string, string | null][]> => {
    maybeFail('read');
    return keys.map((key) => [key, store.get(key) ?? null]);
  }),

  multiSet: jest.fn(async (pairs: [string, string][]): Promise<void> => {
    maybeFail('write');
    for (const [key, value] of pairs) store.set(key, value);
  }),

  multiRemove: jest.fn(async (keys: string[]): Promise<void> => {
    maybeFail('write');
    for (const key of keys) store.delete(key);
  }),

  flushGetRequests: jest.fn((): void => undefined),
};

export default asyncStorage;
