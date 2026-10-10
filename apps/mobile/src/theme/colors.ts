/**
 * Colour schemes. Light values come straight from the shared design tokens
 * (docs/ui-ux.md); dark is the same story with lifted surface values so the
 * forest/mint language survives on a dark background.
 */

import { palette } from '@leafcare/shared';

export type ThemeColors = {
  background: string;
  surface: string;
  surfaceAlt: string;
  ink: string;
  muted: string;
  forest: string;
  forestDeep: string;
  forestLight: string;
  mint: string;
  mintIcon: string;
  coral: string;
  coralSoft: string;
  coralDeep: string;
  water: string;
  waterSoft: string;
  waterDeep: string;
  blue: string;
  ring: string;
  border: string;
  streak: string;
  tabBar: string;
  placeholder: string;
  shadow: string;
  overlay: string;
  toast: string;
};

export const lightColors: ThemeColors = {
  background: palette.cream,
  surface: palette.surface,
  surfaceAlt: palette.creamDeep,
  ink: palette.ink,
  muted: palette.muted,
  forest: palette.forest,
  forestDeep: palette.forestDeep,
  forestLight: palette.forestLight,
  mint: palette.mint,
  mintIcon: palette.mintIcon,
  coral: palette.coral,
  coralSoft: palette.coralSoft,
  coralDeep: palette.coralDeep,
  water: palette.water,
  waterSoft: palette.waterSoft,
  waterDeep: palette.waterDeep,
  blue: palette.blueAction,
  ring: palette.ring,
  border: palette.ring,
  streak: palette.streak,
  tabBar: palette.surface,
  placeholder: '#9CA3AF',
  shadow: palette.forestDeep,
  overlay: 'rgba(15, 35, 26, 0.45)',
  toast: palette.forestDeep,
};

export const darkColors: ThemeColors = {
  background: '#0E1411',
  surface: '#17201B',
  surfaceAlt: '#1D281F',
  ink: '#F1F5F2',
  muted: '#9AA79F',
  forest: '#4FA37C',
  forestDeep: '#08170F',
  forestLight: '#79C39D',
  mint: '#1B2A22',
  mintIcon: '#23372C',
  coral: '#F28482',
  coralSoft: '#3A2322',
  coralDeep: '#F0A19F',
  water: '#5FB6E5',
  waterSoft: '#152B36',
  waterDeep: '#9AD4F0',
  blue: '#60A5FA',
  ring: '#2A3730',
  border: '#26332C',
  streak: '#F08A4B',
  tabBar: '#131B16',
  placeholder: '#6C7A72',
  shadow: '#000000',
  overlay: 'rgba(0, 0, 0, 0.55)',
  toast: '#0B2A1D',
};
