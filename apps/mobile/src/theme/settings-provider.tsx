/**
 * Theme (Light / System / Dark) and units (Metric / Imperial) preferences.
 *
 * Theme defaults to **Light**, not to the phone's setting: the cream/forest look
 * is the app's identity, and a device in dark mode must not silently change how
 * LeafCare looks on first launch. `system` remains selectable and subscribes to
 * Appearance, so a user who picks it sees an OS change immediately
 * (docs/troubleshooting.md). A stored choice, and then the account's value from
 * GET /api/me, both win over the default.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import type { ThemeValue, UnitSystemValue } from '@leafcare/shared';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { useColorScheme } from 'react-native';

import { darkColors, lightColors, type ThemeColors } from './colors';

const THEME_KEY = 'leafcare.settings.theme';
const UNITS_KEY = 'leafcare.settings.units';

/**
 * Light is the shipped default; System and Dark are one tap away in Settings.
 * Keeping it in one constant means the default cannot drift between the state
 * initialiser, the stored-value check and the tests.
 */
export const DEFAULT_THEME: ThemeValue = 'light';

type SettingsContextValue = {
  theme: ThemeValue;
  resolvedTheme: 'light' | 'dark';
  colors: ThemeColors;
  units: UnitSystemValue;
  ready: boolean;
  setTheme: (theme: ThemeValue) => Promise<void>;
  setUnits: (units: UnitSystemValue) => Promise<void>;
  /**
   * Applies the values from GET /api/me. They are also cached on the device, so
   * the next cold start renders the account's choice before the API answers.
   */
  hydrate: (values: { theme?: ThemeValue; units?: UnitSystemValue }) => void;
};

const SettingsContext = createContext<SettingsContextValue | null>(null);

/**
 * Preferences are read and written best-effort through the same static import as
 * `lib/storage.ts`. It used to be a dynamic `import()`, which bought nothing —
 * the module is already in every bundle through the offline cache — and cost a
 * microtask on every read and write.
 */
const loadStored = async (key: string): Promise<string | null> => {
  try {
    return await AsyncStorage.getItem(key);
  } catch {
    return null;
  }
};

const persist = async (key: string, value: string): Promise<void> => {
  try {
    await AsyncStorage.setItem(key, value);
  } catch {
    /* best effort */
  }
};

export const SettingsProvider = ({ children }: { children: ReactNode }) => {
  const systemScheme = useColorScheme();
  const [theme, setThemeState] = useState<ThemeValue>(DEFAULT_THEME);
  const [units, setUnitsState] = useState<UnitSystemValue>('metric');
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let mounted = true;
    void Promise.all([loadStored(THEME_KEY), loadStored(UNITS_KEY)]).then(([storedTheme, storedUnits]) => {
      if (!mounted) return;
      if (storedTheme === 'light' || storedTheme === 'system' || storedTheme === 'dark') {
        setThemeState(storedTheme);
      }
      if (storedUnits === 'metric' || storedUnits === 'imperial') setUnitsState(storedUnits);
      setReady(true);
    });
    return () => {
      mounted = false;
    };
  }, []);

  const setTheme = useCallback(async (next: ThemeValue) => {
    setThemeState(next);
    await persist(THEME_KEY, next);
  }, []);

  const setUnits = useCallback(async (next: UnitSystemValue) => {
    setUnitsState(next);
    await persist(UNITS_KEY, next);
  }, []);

  const hydrate = useCallback((values: { theme?: ThemeValue; units?: UnitSystemValue }) => {
    // The server is the source of truth once a profile exists, and mirroring it
    // into device storage is what makes an offline launch look right.
    if (values.theme) void setTheme(values.theme);
    if (values.units) void setUnits(values.units);
  }, [setTheme, setUnits]);

  const resolvedTheme: 'light' | 'dark' =
    theme === 'system' ? (systemScheme === 'dark' ? 'dark' : 'light') : theme;

  const value = useMemo<SettingsContextValue>(
    () => ({
      theme,
      resolvedTheme,
      colors: resolvedTheme === 'dark' ? darkColors : lightColors,
      units,
      ready,
      setTheme,
      setUnits,
      hydrate,
    }),
    [theme, resolvedTheme, units, ready, setTheme, setUnits, hydrate],
  );

  return <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>;
};

export const useSettings = (): SettingsContextValue => {
  const context = useContext(SettingsContext);
  if (!context) throw new Error('useSettings must be used inside <SettingsProvider>');
  return context;
};

/** Shortcut for the common case. */
export const useTheme = (): { colors: ThemeColors; resolvedTheme: 'light' | 'dark' } => {
  const { colors, resolvedTheme } = useSettings();
  return { colors, resolvedTheme };
};

export const useUnits = (): UnitSystemValue => useSettings().units;
