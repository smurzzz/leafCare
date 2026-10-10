/**
 * Clerk session storage on the device.
 *
 * SecureStore keeps the session JWT out of plain AsyncStorage (docs/security.md);
 * the cache shape matches Clerk's `TokenCache` contract.
 */

import * as SecureStore from 'expo-secure-store';

export const tokenCache = {
  async getToken(key: string): Promise<string | null> {
    try {
      return await SecureStore.getItemAsync(key);
    } catch {
      return null;
    }
  },
  async saveToken(key: string, value: string): Promise<void> {
    try {
      await SecureStore.setItemAsync(key, value);
    } catch {
      /* keychain unavailable — Clerk will simply re-fetch the session */
    }
  },
  async clearToken(key: string): Promise<void> {
    try {
      await SecureStore.deleteItemAsync(key);
    } catch {
      /* ignore */
    }
  },
};

export const CLERK_PUBLISHABLE_KEY = process.env.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY ?? '';

export const isClerkConfigured = (): boolean => CLERK_PUBLISHABLE_KEY.trim().length > 0;
