// ═══════════════════════════════════════════════════════
// MetroMatrix — Theme assembly
// ═══════════════════════════════════════════════════════
// Combines the base tokens, one service accent and the type scale into the
// object useTheme() returns. Pure — no React, no Redux — so tests and
// non-component code can build a theme directly.

import { DefaultTheme, DarkTheme, type Theme as NavigationTheme } from '@react-navigation/native';
import {
  PALETTES,
  buildElevation,
  space,
  radius,
  size,
  opacity,
  motion,
  GUTTER,
  type ColorMode,
  type Palette,
  type Elevation,
} from './tokens';
import { SERVICE_PALETTES, SERVICE_NAMES, type ServiceName, type ServicePalette } from './services';
import { type, FONT_FACES, type TypeScale } from './typography';

export interface Theme {
  mode: ColorMode;
  serviceName: ServiceName;
  colors: Palette;
  service: ServicePalette;
  type: TypeScale;
  space: typeof space;
  radius: typeof radius;
  size: typeof size;
  opacity: typeof opacity;
  elevation: Elevation;
  motion: typeof motion;
  gutter: number;
}

const build = (mode: ColorMode, serviceName: ServiceName): Theme => {
  const colors = PALETTES[mode];
  return {
    mode,
    serviceName,
    colors,
    service: SERVICE_PALETTES[mode][serviceName],
    type,
    space,
    radius,
    size,
    opacity,
    elevation: buildElevation(mode, colors),
    motion,
    gutter: GUTTER,
  };
};

// Built once: eight objects, referentially stable, so useStyles() memoises
// on identity and a re-render never rebuilds a StyleSheet needlessly.
const THEMES = (['light', 'dark'] as const).reduce(
  (acc, mode) => {
    acc[mode] = SERVICE_NAMES.reduce(
      (byService, name) => {
        byService[name] = build(mode, name);
        return byService;
      },
      {} as Record<ServiceName, Theme>,
    );
    return acc;
  },
  {} as Record<ColorMode, Record<ServiceName, Theme>>,
);

export const getTheme = (mode: ColorMode, serviceName: ServiceName = 'neutral'): Theme =>
  THEMES[mode][serviceName];

/** React Navigation theme: navigators paint canvas, never a white default. */
export const navigationTheme = (theme: Theme): NavigationTheme => {
  const base = theme.mode === 'dark' ? DarkTheme : DefaultTheme;
  return {
    ...base,
    dark: theme.mode === 'dark',
    colors: {
      ...base.colors,
      primary: theme.service.accent,
      background: theme.colors.canvas,
      card: theme.colors.surface,
      text: theme.colors.ink,
      border: theme.colors.line,
      notification: theme.colors.danger,
    },
    fonts: {
      regular: { fontFamily: FONT_FACES.sans400, fontWeight: '400' },
      medium: { fontFamily: FONT_FACES.sans500, fontWeight: '500' },
      bold: { fontFamily: FONT_FACES.sans600, fontWeight: '600' },
      heavy: { fontFamily: FONT_FACES.sans700, fontWeight: '700' },
    },
  };
};
