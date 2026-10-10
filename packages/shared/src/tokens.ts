/**
 * LeafCare design tokens.
 *
 * Values come from docs/ui-ux.md and were cross-checked against the Enter UI
 * kit (`src/index.css` in Downloads/leafcare-ui-kit), which defines the same
 * palette in HSL. Both platforms consume these so the Expo app and any web
 * preview stay in step.
 */

export const palette = {
  /** App background */
  cream: '#F6F3EE',
  creamDeep: '#F2EDE6',
  /** Cards */
  surface: '#FFFFFF',
  /** Titles */
  ink: '#1A1A1A',
  /** Subtitles */
  muted: '#6B7280',
  forest: '#1F6B4A',
  forestDeep: '#163D2E',
  forestLight: '#40916D',
  mint: '#E7F4EA',
  mintDeep: '#D8E9DC',
  mintIcon: '#CDE8D4',
  coral: '#F28482',
  coralSoft: '#FEE7E7',
  coralDeep: '#B4443C',
  water: '#4DA9DB',
  waterSoft: '#E5F3FA',
  waterDeep: '#2A6E93',
  blueAction: '#3B82F6',
  ring: '#D8E5DC',
  streak: '#E85D04',
} as const;

export const gradients = {
  forest: [palette.forestLight, palette.forest, palette.forestDeep] as const,
  mint: [palette.mint, '#EDF7F0'] as const,
  water: ['#59B4E4', palette.water] as const,
  cream: ['#FAF7F2', palette.creamDeep] as const,
};

export const radius = {
  sm: 10,
  input: 16,
  card: 22,
  sheet: 28,
  pill: 999,
  full: 999,
} as const;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  xxxl: 32,
} as const;

export const fontSize = {
  caption: 11,
  small: 12,
  body: 14,
  bodyLg: 15,
  label: 16,
  title: 17,
  heading: 23,
  display: 34,
  hero: 40,
} as const;

/** iOS-style status bar shown at the top of every mock screen. */
export const MOCK_STATUS_BAR_TIME = '9:41';

export const layout = {
  /** Design canvas from the UI kit's PhoneScreen. */
  designWidth: 390,
  designHeight: 844,
  screenPadding: 20,
  tabBarHeight: 64,
  fabSize: 60,
} as const;

export const shadows = {
  soft: {
    shadowColor: palette.forestDeep,
    shadowOpacity: 0.08,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },
  card: {
    shadowColor: palette.forestDeep,
    shadowOpacity: 0.12,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 8 },
    elevation: 4,
  },
  float: {
    shadowColor: palette.forestDeep,
    shadowOpacity: 0.22,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 6 },
    elevation: 8,
  },
} as const;
