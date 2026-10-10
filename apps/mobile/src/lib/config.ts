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
  clerkPublishableKey: process.env.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY ?? '',
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
  easProjectId: process.env.EXPO_PUBLIC_PROJECT_ID ?? Constants.expoConfig?.extra?.eas?.projectId,
  supabaseUrl: process.env.EXPO_PUBLIC_SUPABASE_URL ?? '',
} as const;

export const isClerkConfigured = (): boolean => config.clerkPublishableKey.length > 0;

export const versionLabel = (): string => `${config.appVersion}(${config.buildNumber})`;
