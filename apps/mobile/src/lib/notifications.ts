/**
 * Notifications (Phase 3).
 *
 * The API owns the daily digest and due pushes (see /api/jobs/reminders); the
 * device registers an Expo push token and keeps a local fallback schedule so a
 * reminder still fires when the server cannot reach the phone.
 */

import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

import { config } from './config';
import { StorageKeys, readJson, writeJson } from './storage';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

export const ensureAndroidChannel = async (): Promise<void> => {
  if (Platform.OS !== 'android') return;
  await Notifications.setNotificationChannelAsync('reminders', {
    name: 'Watering reminders',
    importance: Notifications.AndroidImportance.DEFAULT,
    // Quiet hours 10:00 PM – 7:00 AM are honoured by the server; the channel
    // stays silent at the OS level only for low-priority nudges.
    sound: 'default',
  });
};

export const requestNotificationPermission = async (): Promise<boolean> => {
  const current = await Notifications.getPermissionsAsync();
  if (current.granted) return true;
  const requested = await Notifications.requestPermissionsAsync();
  return requested.granted;
};

/** Returns the Expo push token, registering the device when allowed. */
export const registerForPushNotifications = async (): Promise<string | null> => {
  if (!Device.isDevice) return null;
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
  await Notifications.cancelScheduledNotificationAsync(plantId).catch(() => undefined);
  if (!nextDueAt) return;

  const trigger = new Date(nextDueAt);
  if (trigger.getTime() <= Date.now()) return;

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
};

export const cancelAllReminders = async (): Promise<void> => {
  await Notifications.cancelAllScheduledNotificationsAsync();
};
