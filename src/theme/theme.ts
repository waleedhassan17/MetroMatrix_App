// ═══════════════════════════════════════════════════════
// MetroMatrix — Theme assembly
// ═══════════════════════════════════════════════════════
// Combines the base tokens, one service accent and the type scale into the
// object useTheme() returns. Pure — no React, no Redux. Light only.

import { DefaultTheme, type Theme as NavigationTheme } from '@react-navigation/native';
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
import { type, type TypeScale } from './typography';
import { mix } from './contrast';

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

const build = (serviceName: ServiceName): Theme => {
  const colors = PALETTES.light;
  return {
    mode: 'light',
    serviceName,
    colors,
    service: SERVICE_PALETTES.light[serviceName],
    type,
    space,
    radius,
    size,
    opacity,
    elevation: buildElevation(colors),
    motion,
    gutter: GUTTER,
  };
};

// Built once, so useStyles() memoises on identity.
const THEMES = SERVICE_NAMES.reduce(
  (acc, name) => {
    acc[name] = build(name);
    return acc;
  },
  {} as Record<ServiceName, Theme>,
);

export const getTheme = (serviceName: ServiceName = 'neutral'): Theme => THEMES[serviceName];

/**
 * A service's page-header gradient, derived the way the FYP's AppBar does
 * (`headerGradientStops`): start at the accent's deep step, end 22% toward
 * ink. Both stops carry a white label at AA.
 */
export const headerGradient = (serviceName: ServiceName): [string, string] => {
  const deep = SERVICE_PALETTES.light[serviceName].accentDeep;
  return [deep, mix(deep, PALETTES.light.ink, 0.22)];
};

/** React Navigation theme: navigators paint white, never a grey default. */
export const navigationTheme = (theme: Theme): NavigationTheme => ({
  ...DefaultTheme,
  dark: false,
  colors: {
    ...DefaultTheme.colors,
    primary: theme.service.accent,
    background: theme.colors.canvas,
    card: theme.colors.surface,
    text: theme.colors.ink,
    border: theme.colors.line,
    notification: theme.colors.danger,
  },
});
