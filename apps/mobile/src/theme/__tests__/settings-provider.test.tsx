/**
 * Theme and unit preferences (src/theme/settings-provider.tsx, screen 22).
 *
 * LeafCare ships in **Light** by default: the cream/forest look is the product's
 * identity, and a phone that happens to be in dark mode must not decide
 * otherwise on first launch. Dark and System remain selectable, and an explicit
 * choice — on this device or on the account — always wins. None of this is
 * visible in a developer build, so it is asserted here.
 *
 * The phone's own scheme is faked by substituting React Native's `useColorScheme`
 * hook, which is the only thing the provider reads. Note the v14 testing-library
 * API: `renderHook`, `act` and `unmount` are all async.
 */

import { act, renderHook, waitFor } from '@testing-library/react-native';
import type { ReactNode } from 'react';

import { asyncStorageControl } from '../../../test/async-storage';
import { darkColors, lightColors } from '../colors';
import { DEFAULT_THEME, SettingsProvider, useSettings, useTheme, useUnits } from '../settings-provider';

const THEME_KEY = 'leafcare.settings.theme';
const UNITS_KEY = 'leafcare.settings.units';

let mockColorScheme: 'light' | 'dark' = 'light';

jest.mock('react-native/Libraries/Utilities/useColorScheme', () => ({
  __esModule: true,
  default: (): 'light' | 'dark' => mockColorScheme,
}));

const wrapper = ({ children }: { children: ReactNode }) => (
  <SettingsProvider>{children}</SettingsProvider>
);

const mockSystemScheme = (scheme: 'light' | 'dark'): void => {
  mockColorScheme = scheme;
};

const renderSettings = () => renderHook(() => useSettings(), { wrapper });

beforeEach(() => {
  asyncStorageControl.reset();
  mockSystemScheme('light');
});

describe('theme default', () => {
  it('is Light, even when the phone is in dark mode', async () => {
    mockSystemScheme('dark');
    const { result } = await renderSettings();
    await waitFor(() => expect(result.current.ready).toBe(true));

    expect(DEFAULT_THEME).toBe('light');
    expect(result.current.theme).toBe('light');
    expect(result.current.resolvedTheme).toBe('light');
    expect(result.current.colors.background).toBe(lightColors.background);
  });

  it('writes no preference on first launch', async () => {
    const { result } = await renderSettings();
    await waitFor(() => expect(result.current.ready).toBe(true));

    expect(asyncStorageControl.snapshot()).toEqual({});
  });

  it('honours an explicit Dark choice stored on the device', async () => {
    asyncStorageControl.seed(THEME_KEY, 'dark');
    const { result } = await renderSettings();
    await waitFor(() => expect(result.current.ready).toBe(true));

    expect(result.current.theme).toBe('dark');
    expect(result.current.colors.background).toBe(darkColors.background);
  });

  it('follows the phone when System is chosen', async () => {
    asyncStorageControl.seed(THEME_KEY, 'system');
    mockSystemScheme('dark');

    const { result } = await renderSettings();
    await waitFor(() => expect(result.current.ready).toBe(true));

    expect(result.current.theme).toBe('system');
    expect(result.current.resolvedTheme).toBe('dark');
  });

  it('falls back to Light for an unreadable stored value', async () => {
    // A value written by a build that no longer exists must not leave the app unstyled.
    asyncStorageControl.seed(THEME_KEY, 'purple');

    const { result } = await renderSettings();
    await waitFor(() => expect(result.current.ready).toBe(true));

    expect(result.current.theme).toBe('light');
  });

  it('still becomes ready when storage cannot be read at all', async () => {
    asyncStorageControl.fail('read');

    const { result } = await renderSettings();
    await waitFor(() => expect(result.current.ready).toBe(true));

    expect(result.current.theme).toBe('light');
    expect(result.current.units).toBe('metric');
  });
});

describe('theme changes', () => {
  it('applies immediately and persists for the next cold start', async () => {
    const { result } = await renderSettings();
    await waitFor(() => expect(result.current.ready).toBe(true));

    await act(async () => {
      await result.current.setTheme('dark');
    });

    expect(result.current.resolvedTheme).toBe('dark');
    expect(asyncStorageControl.snapshot()[THEME_KEY]).toBe('dark');
  });

  it('applies account values from the server (hydrate) and caches them locally', async () => {
    const { result } = await renderSettings();
    await waitFor(() => expect(result.current.ready).toBe(true));

    await act(async () => {
      result.current.hydrate({ theme: 'dark', units: 'imperial' });
    });

    expect(result.current.theme).toBe('dark');
    expect(result.current.units).toBe('imperial');
    // Cached, so the next launch shows the account's choice before /api/me answers.
    expect(asyncStorageControl.snapshot()[THEME_KEY]).toBe('dark');
    expect(asyncStorageControl.snapshot()[UNITS_KEY]).toBe('imperial');
  });

  it('survives storage failing while saving a choice', async () => {
    const { result } = await renderSettings();
    await waitFor(() => expect(result.current.ready).toBe(true));
    asyncStorageControl.fail('write');

    await act(async () => {
      await result.current.setTheme('dark');
    });

    expect(result.current.resolvedTheme).toBe('dark');
  });
});

describe('units', () => {
  it('defaults to metric and remembers imperial', async () => {
    const { result } = await renderSettings();
    await waitFor(() => expect(result.current.ready).toBe(true));
    expect(result.current.units).toBe('metric');

    await act(async () => {
      await result.current.setUnits('imperial');
    });

    expect(result.current.units).toBe('imperial');
    expect(asyncStorageControl.snapshot()[UNITS_KEY]).toBe('imperial');
  });

  it('is exposed through the useUnits and useTheme shortcuts', async () => {
    const units = await renderHook(() => useUnits(), { wrapper });
    const theme = await renderHook(() => useTheme(), { wrapper });

    await waitFor(() => expect(units.result.current).toBe('metric'));
    expect(theme.result.current.colors).toBe(lightColors);
    expect(theme.result.current.resolvedTheme).toBe('light');
  });
});
