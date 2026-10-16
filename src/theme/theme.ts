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
import { type, type TypeScale, MAX_FONT_SCALE, CLINICAL_FONT_SCALE } from './typography';
import { mix } from './contrast';

/**
 * The page header a module's screens wear (the FYP's `barTone`, chosen by the
 * module, never by a screen): `surface` is the white bar with a large title
 * in the content; `gradient` is the FYP's module-page header — the service's
 * deep accent sweeping toward ink under the status bar, a rounded bottom, and
 * a large white title. Shopping and Healthcare wear the gradient (the owner's
 * FYP headers); inside a store the bar turns white again, because a vendor's
 * arbitrary colour behind a page title is where legibility goes wrong.
 */
export interface HeaderStyle {
  tone: 'surface' | 'gradient';
  /** Both stops carry white text at AA (contrast.test). */
  gradient: [string, string];
}

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
  header: HeaderStyle;
  /** Dynamic type is honoured up to this multiple (Health: 150%). */
  maxFontScale: number;
}

const GRADIENT_HEADERS: ServiceName[] = ['shopping', 'healthcare'];

/**
 * Healthcare's clinical scale (the brief's accessibility rules, for older
 * patients): body text never below 15, captions 13, every touch target 48,
 * and dynamic type to 150% (screens are laid out to wrap, not clip).
 */
const CLINICAL_TYPE: TypeScale = {
  ...type,
  body: { ...type.body, fontSize: 15, lineHeight: 22 },
  bodyStrong: { ...type.bodyStrong, fontSize: 15, lineHeight: 22 },
  label: { ...type.label, fontSize: 15, lineHeight: 20 },
  small: { ...type.small, fontSize: 14, lineHeight: 20 },
  caption: { ...type.caption, fontSize: 13, lineHeight: 18 },
  chip: { ...type.chip, fontSize: 13, lineHeight: 18 },
  micro: { ...type.micro, fontSize: 12, lineHeight: 16 },
};
const CLINICAL_SIZE: typeof size = { ...size, touch: 48 };

const build = (serviceName: ServiceName): Theme => {
  const colors = PALETTES.light;
  const clinical = serviceName === 'healthcare';
  return {
    mode: 'light',
    serviceName,
    colors,
    service: SERVICE_PALETTES.light[serviceName],
    type: clinical ? CLINICAL_TYPE : type,
    space,
    radius,
    size: clinical ? CLINICAL_SIZE : size,
    opacity,
    elevation: buildElevation(colors),
    motion,
    gutter: GUTTER,
    header: {
      tone: GRADIENT_HEADERS.includes(serviceName) ? 'gradient' : 'surface',
      gradient: headerGradient(serviceName),
    },
    maxFontScale: clinical ? CLINICAL_FONT_SCALE : MAX_FONT_SCALE,
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
export function headerGradient(serviceName: ServiceName): [string, string] {
  const deep = SERVICE_PALETTES.light[serviceName].accentDeep;
  return [deep, mix(deep, PALETTES.light.ink, 0.22)];
}

/**
 * The same theme with every type role scaled — the Design Gallery's preview
 * of a phone set to large text (150%), where the OS multiplier can't be set.
 */
export const withTextScale = (theme: Theme, factor: number): Theme => ({
  ...theme,
  type: Object.fromEntries(
    Object.entries(theme.type).map(([role, style]) => [
      role,
      { ...style, fontSize: (style.fontSize ?? 14) * factor, lineHeight: style.lineHeight ? style.lineHeight * factor : undefined },
    ]),
  ) as TypeScale,
  maxFontScale: 1,
});

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
