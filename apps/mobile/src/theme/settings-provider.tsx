/**
 * Theme (Light / System / Dark) and units (Metric / Imperial) preferences.
 *
 * Theme defaults to `system` and subscribes to Appearance so a change in the OS
 * is reflected immediately (docs/troubleshooting.md).
 */

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

type SettingsContextValue = {
  theme: ThemeValue;
  resolvedTheme: 'light' | 'dark';
  colors: ThemeColors;
  units: UnitSystemValue;
  ready: boolean;
  setTheme: (theme: ThemeValue) => Promise<void>;
  setUnits: (units: UnitSystemValue) => Promise<void>;
  /** Applies values returned by GET /api/me without writing them back. */
  hydrate: (values: { theme?: ThemeValue; units?: UnitSystemValue }) => void;
};

const SettingsContext = createContext<SettingsContextValue | null>(null);

const loadStored = async (key: string): Promise<string | null> => {
  try {
    const AsyncStorage = (await import('@react-native-async-storage/async-storage')).default;
    return await AsyncStorage.getItem(key);
  } catch {
    return null;
  }
};

const persist = async (key: string, value: string): Promise<void> => {
  try {
    const AsyncStorage = (await import('@react-native-async-storage/async-storage')).default;
    await AsyncStorage.setItem(key, value);
  } catch {
    /* best effort */
  }
};

export const SettingsProvider = ({ children }: { children: ReactNode }) => {
  const systemScheme = useColorScheme();
  const [theme, setThemeState] = useState<ThemeValue>('system');
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
    // The server is the source of truth once a profile exists.
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
