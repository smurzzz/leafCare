/**
 * Expo public configuration.
 *
 * Only EXPO_PUBLIC_* values are readable here — by design, because everything in
 * this file ends up in the app bundle. Vendor keys (Plant.id, Clerk secret,
 * Supabase service role) live on the API only.
 */

import Constants from 'expo-constants';

const read = (value: string | undefined, fallback: string): string => {
  const trimmed = value?.trim();
  return trimmed && trimmed.length > 0 ? trimmed : fallback;
};

export const config = {
  // Trimmed, like the other values: a key pasted into a build environment with a
  // trailing space or newline is not an empty string, and Clerk would then throw
  // on a white screen instead of the app explaining what is wrong.
  clerkPublishableKey: read(process.env.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY, ''),
  apiBaseUrl: read(process.env.EXPO_PUBLIC_API_BASE_URL, 'http://localhost:3000').replace(
    /\/+$/,
    '',
  ),
  supportEmail: read(process.env.EXPO_PUBLIC_SUPPORT_EMAIL, 'support@leafcare.app'),
  /** Real build version so Settings matches the shipped binary (XC-4). */
  appVersion: `${Constants.expoConfig?.version ?? read(process.env.EXPO_PUBLIC_APP_VERSION, '1.0.0')}`,
  buildNumber:
    Constants.expoConfig?.android?.versionCode?.toString() ??
    Constants.expoConfig?.ios?.buildNumber ??
    '1',
  easProjectId:
    read(process.env.EXPO_PUBLIC_PROJECT_ID, '') ||
    Constants.expoConfig?.extra?.eas?.projectId,
  supabaseUrl: read(process.env.EXPO_PUBLIC_SUPABASE_URL, ''),
} as const;

export const isClerkConfigured = (): boolean => config.clerkPublishableKey.length > 0;

const LOOPBACK = /^https?:\/\/(localhost|127\.0\.0\.1)([:/]|$)/i;

/**
 * Why a *built* app cannot work, in one line — or `null` when it can.
 *
 * Every one of these is legitimate in development: Expo Go, the iOS simulator
 * and web all treat `localhost` as the machine running the API. In a release
 * build `localhost` is the phone itself, so the same config means every request
 * fails and the user sees empty screens with no explanation. The app says this
 * out loud at startup instead of looking broken.
 *
 * The values come from the EAS environment variables for the build profile, not
 * from a `.env` file — `.env` is gitignored and so is never uploaded to a build.
 */
export const releaseConfigIssue = (): string | null => {
  if (!isClerkConfigured()) return 'EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY is missing';
  if (LOOPBACK.test(config.apiBaseUrl)) {
    return `EXPO_PUBLIC_API_BASE_URL is ${config.apiBaseUrl}, which on a phone is the phone itself`;
  }
  return null;
};

export const versionLabel = (): string => `${config.appVersion}(${config.buildNumber})`;
