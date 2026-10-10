/**
 * Regression test for the Expo Go on Android boot crash.
 *
 * `expo-notifications` throws while it is being *imported* there, not when it is
 * used, and that once took the whole router down (`Route "./_layout.tsx" is
 * missing the required default export`). The package is therefore loaded lazily
 * and every failure is absorbed, which is what this suite pins: with a module that
 * cannot even be required, the app still runs and only says so once, in a warning
 * a developer can act on.
 *
 * The sandbox is exactly that situation — the mock below throws on require, the
 * way the real package does on Android under Expo Go.
 */

import { asyncStorageControl } from '../../../test/async-storage';
import {
  cancelAllReminders,
  cancelPlantReminder,
  ensureAndroidChannel,
  registerForPushNotifications,
  requestNotificationPermission,
  schedulePlantReminder,
} from '../notifications';

jest.mock('expo-constants', () => ({
  __esModule: true,
  default: { executionEnvironment: 'bare', expoConfig: { version: '1.0.0' } },
  ExecutionEnvironment: { StoreClient: 'storeClient', Bare: 'bare' },
}));

jest.mock('expo-device', () => ({ __esModule: true, isDevice: true }));

jest.mock('expo-notifications', () => {
  throw new Error('Test Error: expo-notifications is unavailable in this runtime');
});

/**
 * Captured once for the whole file: the explanation is deliberately printed only
 * on the first failure, and `loadNotifications` caches that fact for the process,
 * so a per-test spy would see whatever order the tests happen to run in.
 */
const warnings: string[] = [];
let warn: jest.SpyInstance;

beforeAll(() => {
  warn = jest.spyOn(console, 'warn').mockImplementation((first: unknown) => {
    warnings.push(String(first));
  });
});

afterAll(() => {
  warn.mockRestore();
});

beforeEach(() => {
  asyncStorageControl.reset();
});

describe('when expo-notifications cannot be loaded', () => {
  it('reports no permission instead of throwing', async () => {
    await expect(requestNotificationPermission()).resolves.toBe(false);
  });

  it('registers no push token', async () => {
    await expect(registerForPushNotifications()).resolves.toBeNull();
  });

  it('quietly accepts scheduling, cancelling and channel setup', async () => {
    const future = new Date(Date.now() + 3_600_000).toISOString();

    await expect(
      schedulePlantReminder({ plantId: 'plant_1', nickname: 'Ficus', nextDueAt: future }),
    ).resolves.toBeUndefined();
    await expect(cancelPlantReminder('plant_1')).resolves.toBeUndefined();
    await expect(cancelAllReminders()).resolves.toBeUndefined();
    await expect(ensureAndroidChannel()).resolves.toBeUndefined();
  });

  it('explains the missing package once, not on every call', async () => {
    await schedulePlantReminder({ plantId: 'plant_1', nickname: 'Ficus', nextDueAt: null });
    await schedulePlantReminder({ plantId: 'plant_2', nickname: 'Basil', nextDueAt: null });
    await requestNotificationPermission();
    await cancelAllReminders();

    const explanations = warnings.filter((message) => message.includes('Expo Go'));
    expect(explanations).toHaveLength(1);
  });
});
