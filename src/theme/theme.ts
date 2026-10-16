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
  HEALTH_PALETTE,
  ROW_TINTS,
  type ColorMode,
  type Palette,
  type Elevation,
} from './tokens';
import { SERVICE_PALETTES, SERVICE_NAMES, type ServiceName, type ServicePalette } from './services';
import { type, type TypeScale, MAX_FONT_SCALE, CLINICAL_FONT_SCALE } from './typography';

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
  /** The FYP profile's categorical icon chips (fixed across services). */
  rowTint: typeof ROW_TINTS;
  /** How this service's bottom tab bar marks the selected tab (the FYP's per-module bars). */
  tabBar: TabBarStyle;
}

/**
 * The FYP's per-module tab bars:
 *   gradientPill  Health — the selected icon white on a small gradient pill
 *   tint          Shopping — a rounded, lifted bar; the selected tab in accent
 *   softPill      Home services (our Food Court) — a soft accent pill
 *   pill          the partner and staff apps' bar (RouteTabs)
 */
export type TabBarVariant = 'pill' | 'gradientPill' | 'tint' | 'softPill';
export interface TabBarStyle {
  variant: TabBarVariant;
  /** gradientPill only: highlight → accent (the FYP's #2A7FFF → #1E6AE1). */
  gradient: [string, string];
}
const TAB_BARS: Record<ServiceName, TabBarVariant> = {
  neutral: 'pill',
  healthcare: 'gradientPill',
  shopping: 'tint',
  food: 'softPill',
};

const GRADIENT_HEADERS: ServiceName[] = ['shopping', 'healthcare'];

/**
 * Health's touch targets stay at 48 and its text may scale to 150% (the
 * brief's accessibility rules for older patients); the type itself is the
 * FYP's, the same as every other service.
 */
const CLINICAL_SIZE: typeof size = { ...size, touch: 48 };

const build = (serviceName: ServiceName): Theme => {
  const clinical = serviceName === 'healthcare';
  // Health wears the FYP's healthcare ground and slate ink.
  const colors = clinical ? HEALTH_PALETTE : PALETTES.light;
  return {
    mode: 'light',
    serviceName,
    colors,
    service: SERVICE_PALETTES.light[serviceName],
    type,
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
    rowTint: ROW_TINTS,
    tabBar: {
      variant: TAB_BARS[serviceName],
      gradient: [SERVICE_PALETTES.light[serviceName].highlight, SERVICE_PALETTES.light[serviceName].accent],
    },
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
 * A service's page-header gradient: the FYP's bright module colour sweeping
 * to its deep step (accent → accentDeep), so a header reads as the service,
 * never as a dull navy or brown. White text passes AA on both stops (tested).
 */
export function headerGradient(serviceName: ServiceName): [string, string] {
  const { accent, accentDeep } = SERVICE_PALETTES.light[serviceName];
  return [accent, accentDeep];
}

const WITH_GRADIENT = new WeakMap<Theme, Theme>();

/**
 * The same theme wearing the gradient page header, in its own service's
 * colour — the customer shell's own pages (Orders, Profile and the account
 * pages), as in the FYP. Cached so useStyles() keeps memoising on identity.
 */
export const withGradientHeader = (theme: Theme): Theme => {
  if (theme.header.tone === 'gradient') return theme;
  let t = WITH_GRADIENT.get(theme);
  if (!t) {
    t = { ...theme, header: { tone: 'gradient', gradient: headerGradient(theme.serviceName) } };
    WITH_GRADIENT.set(theme, t);
  }
  return t;
};

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
