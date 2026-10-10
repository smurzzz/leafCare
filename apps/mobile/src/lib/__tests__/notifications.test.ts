/**
 * Notifications (src/lib/notifications.ts).
 *
 * `expo-notifications` is mocked here, which is the whole point of the lazy
 * `require` inside `loadNotifications`: the scheduling *decisions* are testable
 * without a device. What matters for the product is that a plant's reminder
 * follows the schedule the server returned (marking it watered moves it, deleting
 * the plant removes it), and that a due date in the past never produces a
 * notification that fires immediately and looks like a bug.
 *
 * The suite runs on both iOS and Android projects, so the Android channel and
 * the permission flow are exercised on both platforms.
 */

import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

import { asyncStorageControl } from '../../../test/async-storage';
import {
  cancelAllReminders,
  cancelPlantReminder,
  ensureAndroidChannel,
  registerForPushNotifications,
  requestNotificationPermission,
  schedulePlantReminder,
} from '../notifications';
import { StorageKeys } from '../storage';

jest.mock('expo-constants', () => ({
  __esModule: true,
  // `bare` so the Expo Go guard does not short-circuit push registration; that
  // path has its own suite (notifications-unavailable.test.ts).
  default: { executionEnvironment: 'bare', expoConfig: { version: '1.0.0' } },
  ExecutionEnvironment: { StoreClient: 'storeClient', Bare: 'bare' },
}));

jest.mock('expo-device', () => ({ __esModule: true, isDevice: true }));

jest.mock('expo-notifications', () => ({
  __esModule: true,
  SchedulableTriggerInputTypes: { DATE: 'date' },
  AndroidImportance: { DEFAULT: 3 },
  setNotificationHandler: jest.fn(),
  getPermissionsAsync: jest.fn(async () => ({ granted: false })),
  requestPermissionsAsync: jest.fn(async () => ({ granted: false })),
  setNotificationChannelAsync: jest.fn(async () => null),
  getExpoPushTokenAsync: jest.fn(async () => ({ data: 'ExponentPushToken[test]' })),
  cancelScheduledNotificationAsync: jest.fn(async () => undefined),
  cancelAllScheduledNotificationsAsync: jest.fn(async () => undefined),
  scheduleNotificationAsync: jest.fn(async () => 'scheduled'),
}));

const schedule = jest.mocked(Notifications.scheduleNotificationAsync);
const cancelOne = jest.mocked(Notifications.cancelScheduledNotificationAsync);
const cancelAll = jest.mocked(Notifications.cancelAllScheduledNotificationsAsync);
const getPermissions = jest.mocked(Notifications.getPermissionsAsync);
const requestPermissions = jest.mocked(Notifications.requestPermissionsAsync);
const createChannel = jest.mocked(Notifications.setNotificationChannelAsync);
const getPushToken = jest.mocked(Notifications.getExpoPushTokenAsync);

/**
 * The real calls return much more than the app reads — a permission status is
 * checked for `granted` and a push token for `data` — so the fixtures narrow to
 * that, with the shapes taken from the functions themselves rather than guessed.
 */
type PermissionsStatus = Awaited<ReturnType<typeof Notifications.getPermissionsAsync>>;
type PushToken = Awaited<ReturnType<typeof Notifications.getExpoPushTokenAsync>>;

const permissions = (granted: boolean): PermissionsStatus =>
  ({ granted }) as unknown as PermissionsStatus;
const pushToken = (data: string): PushToken => ({ data }) as unknown as PushToken;
/** The module object itself, because `expo-device` exports a plain boolean. */
const device = jest.requireMock('expo-device') as { isDevice: boolean };

const FUTURE = new Date(Date.now() + 6 * 60 * 60 * 1000).toISOString();
const PAST = new Date(Date.now() - 60 * 60 * 1000).toISOString();

/**
 * The failure paths in this module deliberately log a warning. It is captured
 * rather than printed — every case that provokes one asserts on it instead, so a
 * warning that appears for the wrong reason still fails a test.
 */
let warn: jest.SpyInstance;

beforeEach(() => {
  warn = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
  asyncStorageControl.reset();
  device.isDevice = true;
  // `clearMocks` empties call history but keeps implementations, and a sticky
  // `mockResolvedValue` from one test would otherwise follow the next one. Every
  // mock a test reconfigures is therefore reset to its documented default here.
  getPermissions.mockReset().mockResolvedValue(permissions(false));
  requestPermissions.mockReset().mockResolvedValue(permissions(false));
  getPushToken.mockReset().mockResolvedValue(pushToken('ExponentPushToken[test]'));
});

afterEach(() => {
  warn.mockRestore();
});

describe('schedulePlantReminder', () => {
  it('schedules one notification per plant, keyed by the plant id', async () => {
    await schedulePlantReminder({ plantId: 'plant_1', nickname: 'Ficus', nextDueAt: FUTURE });

    expect(cancelOne).toHaveBeenCalledWith('plant_1');
    expect(schedule).toHaveBeenCalledTimes(1);
    expect(schedule).toHaveBeenCalledWith(
      expect.objectContaining({
        identifier: 'plant_1',
        content: expect.objectContaining({
          title: 'Water Ficus',
          data: { plantId: 'plant_1' },
        }),
        trigger: expect.objectContaining({ type: 'date', channelId: 'reminders' }),
      }),
    );
  });

  it('clears the previous reminder before rescheduling, so a plant never doubles up', async () => {
    await schedulePlantReminder({ plantId: 'plant_1', nickname: 'Ficus', nextDueAt: FUTURE });
    cancelOne.mockClear();

    await schedulePlantReminder({ plantId: 'plant_1', nickname: 'Ficus', nextDueAt: FUTURE });

    expect(cancelOne).toHaveBeenCalledWith('plant_1');
    expect(schedule).toHaveBeenCalledTimes(2);
  });

  it('never schedules a reminder for a due date that has already passed', async () => {
    await schedulePlantReminder({ plantId: 'plant_1', nickname: 'Ficus', nextDueAt: PAST });

    expect(cancelOne).toHaveBeenCalledWith('plant_1');
    expect(schedule).not.toHaveBeenCalled();
  });

  it('clears the reminder when the server has no next due date', async () => {
    await schedulePlantReminder({ plantId: 'plant_1', nickname: 'Ficus', nextDueAt: null });

    expect(cancelOne).toHaveBeenCalledWith('plant_1');
    expect(schedule).not.toHaveBeenCalled();
  });
});

describe('cancelPlantReminder', () => {
  it('cancels by plant id', async () => {
    await cancelPlantReminder('plant_9');

    expect(cancelOne).toHaveBeenCalledWith('plant_9');
    expect(schedule).not.toHaveBeenCalled();
  });
});

describe('cancelAllReminders', () => {
  it('clears every scheduled notification on sign out', async () => {
    await cancelAllReminders();

    expect(cancelAll).toHaveBeenCalledTimes(1);
  });
});

describe('ensureAndroidChannel', () => {
  it('creates the reminders channel on Android and does nothing on iOS', async () => {
    await ensureAndroidChannel();

    if (Platform.OS === 'android') {
      expect(createChannel).toHaveBeenCalledWith(
        'reminders',
        expect.objectContaining({ name: 'Watering reminders', sound: 'default' }),
      );
    } else {
      expect(createChannel).not.toHaveBeenCalled();
    }
  });
});

describe('requestNotificationPermission', () => {
  it('does not ask again once permission is granted', async () => {
    getPermissions.mockResolvedValue(permissions(true));

    await expect(requestNotificationPermission()).resolves.toBe(true);
    expect(requestPermissions).not.toHaveBeenCalled();
  });

  it('asks when permission has not been granted yet', async () => {
    requestPermissions.mockResolvedValue(permissions(true));

    await expect(requestNotificationPermission()).resolves.toBe(true);
    expect(requestPermissions).toHaveBeenCalledTimes(1);
  });

  it('reports a refusal without throwing', async () => {
    await expect(requestNotificationPermission()).resolves.toBe(false);
  });

  it('reports a permissions API failure as no permission', async () => {
    getPermissions.mockRejectedValueOnce(new Error('no native module'));

    await expect(requestNotificationPermission()).resolves.toBe(false);
    expect(warn).toHaveBeenCalledWith('[notifications] permission check failed', expect.any(Error));
  });
});

describe('registerForPushNotifications', () => {
  it('does nothing on a simulator, where push cannot work', async () => {
    device.isDevice = false;

    await expect(registerForPushNotifications()).resolves.toBeNull();
    expect(getPushToken).not.toHaveBeenCalled();
  });

  it('returns null when the user declines notifications', async () => {
    await expect(registerForPushNotifications()).resolves.toBeNull();
    expect(getPushToken).not.toHaveBeenCalled();
  });

  it('registers once and reuses the cached token afterwards', async () => {
    getPermissions.mockResolvedValue(permissions(true));

    await expect(registerForPushNotifications()).resolves.toBe('ExponentPushToken[test]');
    await expect(registerForPushNotifications()).resolves.toBe('ExponentPushToken[test]');

    // The second call is served from storage, so Expo is not asked twice.
    expect(getPushToken).toHaveBeenCalledTimes(1);
  });

  it('uses a token already stored on the device', async () => {
    asyncStorageControl.seed(StorageKeys.pushToken, '"ExponentPushToken[cached]"');
    getPermissions.mockResolvedValue(permissions(true));

    await expect(registerForPushNotifications()).resolves.toBe('ExponentPushToken[cached]');
    expect(getPushToken).not.toHaveBeenCalled();
  });

  it('does not hand out a cached token once permission has been revoked', async () => {
    // The stored token is still readable, but handing it back would have the app
    // register a device that cannot display anything.
    asyncStorageControl.seed(StorageKeys.pushToken, '"ExponentPushToken[cached]"');

    await expect(registerForPushNotifications()).resolves.toBeNull();
  });

  it('resolves to null when Expo cannot mint a token', async () => {
    getPermissions.mockResolvedValue(permissions(true));
    getPushToken.mockRejectedValue(new Error('FCM not configured'));

    await expect(registerForPushNotifications()).resolves.toBeNull();
    expect(warn).toHaveBeenCalledWith('[notifications] push token unavailable', expect.any(Error));
  });
});
