/**
 * Notifications (Phase 3).
 *
 * The API owns the daily digest and due pushes (see /api/jobs/reminders); the
 * device registers an Expo push token and keeps a local fallback schedule so a
 * reminder still fires when the server cannot reach the phone.
 *
 * Why nothing here imports `expo-notifications` statically: in Expo Go on Android
 * the package throws while it is being *imported*, not when it is used. Its
 * `index.js` re-exports `DevicePushTokenAutoRegistration.fx`, whose module body
 * calls `addPushTokenListener()` → `warnOfExpoGoPushUsage()`, and that throws for
 * Android under Expo Go (remote push was removed in SDK 53). A static import
 * therefore killed every module in the same graph — the root layout first, which
 * expo-router reported as `Route "./_layout.tsx" is missing the required default
 * export` and then crashed with `Cannot read property 'ErrorBoundary' of
 * undefined`. The package is loaded through `loadNotifications()` below, so it is
 * evaluated only where it can actually work, and a development build (or the EAS
 * APK) gets real push support. Nothing here may run at module scope either.
 */

import Constants, { ExecutionEnvironment } from 'expo-constants';
import * as Device from 'expo-device';
import { Platform } from 'react-native';

import { config } from './config';
import { StorageKeys, readJson, writeJson } from './storage';

type NotificationsModule = typeof import('expo-notifications');

/**
 * Expo Go reports itself as `storeClient`. Android remote push was removed from it
 * in SDK 53, so push registration is skipped there — a development build (or an
 * EAS build) is required for real pushes.
 */
const isExpoGo = Constants.executionEnvironment === ExecutionEnvironment.StoreClient;
const pushUnsupported = isExpoGo && Platform.OS === 'android';

let warnedAboutExpoGo = false;

const warnOnce = (): void => {
  if (warnedAboutExpoGo) return;
  warnedAboutExpoGo = true;
  console.warn(
    '[notifications] Expo Go on Android has no push support — use a development build for reminders.',
  );
};

/**
 * Loads `expo-notifications` on first use. Returns null when the package cannot be
 * used here (Expo Go on Android), which is expected rather than an error: the app
 * stays fully usable, it just cannot push.
 */
const loadNotifications = async (): Promise<NotificationsModule | null> => {
  try {
    // Dynamic, so the package is evaluated on first use and never while a route module
    // is being imported. A static import would throw here in Expo Go on Android.
    return await import('expo-notifications');
  } catch {
    warnOnce();
    return null;
  }
};

let handlerInstalled = false;

/**
 * Installs the foreground presentation handler on first use rather than at import
 * time, because in Expo Go this call throws and a throw during route module
 * evaluation takes the whole router down with it.
 */
const installHandler = (Notifications: NotificationsModule): void => {
  if (handlerInstalled) return;
  try {
    Notifications.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowBanner: true,
        shouldShowList: true,
        shouldPlaySound: true,
        shouldSetBadge: false,
      }),
    });
  } catch (error) {
    console.warn('[notifications] foreground handler unavailable', error);
  }
  handlerInstalled = true;
};

export const ensureAndroidChannel = async (): Promise<void> => {
  if (Platform.OS !== 'android') return;
  const Notifications = await loadNotifications();
  if (!Notifications) return;

  try {
    await Notifications.setNotificationChannelAsync('reminders', {
      name: 'Watering reminders',
      importance: Notifications.AndroidImportance.DEFAULT,
      // Quiet hours 10:00 PM – 7:00 AM are honoured by the server; the channel
      // stays silent at the OS level only for low-priority nudges.
      sound: 'default',
    });
  } catch (error) {
    console.warn('[notifications] reminder channel unavailable', error);
  }
};

export const requestNotificationPermission = async (): Promise<boolean> => {
  const Notifications = await loadNotifications();
  if (!Notifications) return false;

  try {
    const current = await Notifications.getPermissionsAsync();
    if (current.granted) return true;
    const requested = await Notifications.requestPermissionsAsync();
    return requested.granted;
  } catch (error) {
    console.warn('[notifications] permission check failed', error);
    return false;
  }
};

/** Returns the Expo push token, registering the device when allowed. */
export const registerForPushNotifications = async (): Promise<string | null> => {
  if (pushUnsupported) {
    warnOnce();
    return null;
  }
  if (!Device.isDevice) return null;

  const Notifications = await loadNotifications();
  if (!Notifications) return null;

  installHandler(Notifications);

  const granted = await requestNotificationPermission();
  if (!granted) return null;

  await ensureAndroidChannel();

  const cached = await readJson<string>(StorageKeys.pushToken);
  if (cached) return cached;

  try {
    const token = await Notifications.getExpoPushTokenAsync(
      config.easProjectId ? { projectId: config.easProjectId } : undefined,
    );
    await writeJson(StorageKeys.pushToken, token.data);
    return token.data;
  } catch (error) {
    console.warn('[notifications] push token unavailable', error);
    return null;
  }
};

/**
 * Local fallback schedule for one plant. Titles avoid PII beyond the nickname the
 * user chose (docs/security.md).
 */
export const schedulePlantReminder = async (options: {
  plantId: string;
  nickname: string;
  nextDueAt: string | null;
}): Promise<void> => {
  const { plantId, nickname, nextDueAt } = options;

  const Notifications = await loadNotifications();
  if (!Notifications) return;

  installHandler(Notifications);
  await Notifications.cancelScheduledNotificationAsync(plantId).catch(() => undefined);
  if (!nextDueAt) return;

  const trigger = new Date(nextDueAt);
  if (trigger.getTime() <= Date.now()) return;

  try {
    await Notifications.scheduleNotificationAsync({
      identifier: plantId,
      content: {
        title: `Water ${nickname}`,
        body: 'Tap to open the plant and mark it watered.',
        data: { plantId },
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DATE,
        date: trigger,
        channelId: 'reminders',
      },
    });
  } catch (error) {
    console.warn('[notifications] could not schedule a reminder', error);
  }
};

export const cancelAllReminders = async (): Promise<void> => {
  const Notifications = await loadNotifications();
  if (!Notifications) return;
  await Notifications.cancelAllScheduledNotificationsAsync().catch(() => undefined);
};
