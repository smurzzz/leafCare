/**
 * Scan session.
 *
 * The capture → identifying → result → add-plant chain shares a photo plus the
 * provider's response. Keeping it in a tiny module store avoids serialising the
 * whole payload through router params and keeps the local photo URI (which never
 * leaves the device until the plant is saved) in one place.
 */

import type { IdentifyResponse, IdentificationSuggestion } from '@leafcare/shared';

export type ScanSession = {
  /** Local file URI of the captured photo. */
  photoUri: string;
  identificationId: string | null;
  result: IdentifyResponse | null;
  selectedIndex: number;
  createdAt: number;
};

let current: ScanSession | null = null;

export const startScanSession = (photoUri: string): ScanSession => {
  current = { photoUri, identificationId: null, result: null, selectedIndex: 0, createdAt: Date.now() };
  return current;
};

export const setScanResult = (identificationId: string, result: IdentifyResponse): void => {
  if (!current) return;
  current = { ...current, identificationId, result, selectedIndex: 0 };
};

export const setScanIdentificationId = (identificationId: string): void => {
  if (!current) return;
  current = { ...current, identificationId };
};

export const selectSuggestion = (index: number): void => {
  if (!current) return;
  current = { ...current, selectedIndex: index };
};

export const getScanSession = (): ScanSession | null => current;

export const clearScanSession = (): void => {
  current = null;
};

export const selectedSuggestion = (): IdentificationSuggestion | null => {
  if (!current?.result) return null;
  const all = [current.result.top, ...current.result.alternatives];
  return all[current.selectedIndex] ?? current.result.top;
};

export const allSuggestions = (): IdentificationSuggestion[] => {
  if (!current?.result) return [];
  return [current.result.top, ...current.result.alternatives];
};
