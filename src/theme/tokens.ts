// ═══════════════════════════════════════════════════════
// MetroMatrix — "Quiet Metro" tokens
// ═══════════════════════════════════════════════════════
// The base layer: neutrals, semantic colours, space, shape, depth, motion.
// Identical in every service — this is what makes the app one app. A service
// earns an accent (./services.ts); it does not earn its own greys or radii.
//
// Every value a component paints is written down HERE (or in ./services.ts,
// ./typography.ts, ./brandMarks.ts) and nowhere else. scripts/check-design-
// tokens.js fails the build on a raw value anywhere in the UI folders.
//
// Contrast is not asserted by eye: src/theme/__tests__/contrast.test.ts
// measures every text/background pair the components use, in both modes.

import { Platform, StyleSheet, type ViewStyle } from 'react-native';

export type ColorMode = 'light' | 'dark';

export interface Palette {
  /** Screen ground. */
  canvas: string;
  /** Cards, sheets, inputs. */
  surface: string;
  /** Wells, tracks, skeletons, pressed rows. */
  surfaceSunk: string;
  /** Primary text. */
  ink: string;
  /** Secondary text — passes AA body on every ground. */
  inkMuted: string;
  /**
   * Placeholder, disabled text and decorative icons ONLY (3:1, not 4.5:1),
   * and only on canvas or surface — on surfaceSunk the brief's light value
   * measures 2.97:1, so sunk wells use inkMuted.
   */
  inkFaint: string;
  /** Hairlines and resting borders. */
  line: string;
  /** Input borders, checkbox outlines — the line a control needs to be seen. */
  lineStrong: string;
  brand: string;
  onBrand: string;
  danger: string;
  dangerSoft: string;
  onDanger: string;
  success: string;
  successSoft: string;
  warning: string;
  warningSoft: string;
  /** Behind sheets and dialogs. */
  overlay: string;
  /** Text-legibility scrim over photography (bottom of onboarding pages). */
  scrim: string;
  /** Text and icons painted on `scrim`. */
  onScrim: string;
  /** Ground of the full-screen document viewer. */
  viewer: string;
}

const light: Palette = {
  canvas: '#F7F5F1',
  surface: '#FFFFFF',
  surfaceSunk: '#EFECE6',
  ink: '#16151A',
  inkMuted: '#5C5862',
  inkFaint: '#8C8792',
  line: '#E4DFD7',
  lineStrong: '#7D7883',
  brand: '#1B2A41',
  onBrand: '#FFFFFF',
  danger: '#B42318',
  dangerSoft: '#FEF3F2',
  onDanger: '#FFFFFF',
  success: '#067647',
  successSoft: '#ECFDF3',
  warning: '#B54708',
  warningSoft: '#FFFAEB',
  overlay: 'rgba(22, 21, 26, 0.40)',
  scrim: 'rgba(14, 14, 16, 0.62)',
  onScrim: '#FFFFFF',
  viewer: '#0E0E10',
};

// Dark semantic colours are LIFTED, not reused: #B42318 on #17171A is 2.6:1.
// Each lifted value clears 4.5:1 on `surface` (see the contrast test).
const dark: Palette = {
  canvas: '#0E0E10',
  surface: '#17171A',
  surfaceSunk: '#1F1F23',
  ink: '#F4F2EE',
  inkMuted: '#A9A5AE',
  inkFaint: '#77737C',
  line: '#2A2A2F',
  lineStrong: '#77737C',
  brand: '#C9D4E6',
  onBrand: '#0E0E10',
  danger: '#F97066',
  dangerSoft: '#2A1715',
  onDanger: '#0E0E10',
  success: '#47CD89',
  successSoft: '#0F2419',
  warning: '#FDB022',
  warningSoft: '#2A1F0B',
  overlay: 'rgba(0, 0, 0, 0.60)',
  scrim: 'rgba(0, 0, 0, 0.62)',
  onScrim: '#FFFFFF',
  viewer: '#000000',
};

export const PALETTES: Record<ColorMode, Palette> = { light, dark };

// ─── Space — 4-pt scale ─────────────────────────────
export const space = {
  s0: 0,
  s4: 4,
  s8: 8,
  s12: 12,
  s16: 16,
  s20: 20,
  s24: 24,
  s32: 32,
  s40: 40,
  s56: 56,
} as const;

/** Side gutter for every screen. */
export const GUTTER = space.s24;

// ─── Shape ──────────────────────────────────────────
export const radius = {
  sm: 8,
  md: 14,
  lg: 22,
  pill: 999,
} as const;

// ─── Sizes (controls, icons, avatars) ───────────────
// Not part of the brief's scale, but every component needs them and a
// literal `height: 48` in a component is exactly the drift the gate exists
// to stop.
export const size = {
  hairline: StyleSheet.hairlineWidth,
  border: 1,
  focusBorder: 2,
  /** Minimum touch target (WCAG / Material). */
  touch: 44,
  control: { sm: 36, md: 48, lg: 56 },
  icon: { sm: 16, md: 20, lg: 24, xl: 32 },
  avatar: { sm: 32, md: 44, lg: 64, xl: 96 },
  otpCell: { width: 48, height: 56 },
  checkbox: 22,
  progress: 4,
  timelineDot: 12,
  timelineLine: 2,
  pageDot: 8,
  pageDotActive: 24,
  qr: 196,
  tabBar: 64,
  headerBar: 52,
  sheetHandle: 4,
  thumb: 56,
  logoMark: 40,
} as const;

export const opacity = {
  disabled: 0.4,
  pressed: 0.72,
  skeletonLow: 0.45,
  skeletonHigh: 1,
} as const;

// ─── Depth ──────────────────────────────────────────
// `none` is a hairline in the `line` colour — the default for cards.
// `float` lifts sticky CTAs and sheets: y 8, blur 24, ink at 6% (Android
// elevation 6). Shadows vanish on dark grounds, so dark `float` keeps the
// hairline and deepens the shadow instead of relying on it alone.
export interface Elevation {
  none: ViewStyle;
  float: ViewStyle;
}

const floatShadow = (mode: ColorMode, ink: string): ViewStyle =>
  Platform.select<ViewStyle>({
    android: { elevation: 6, shadowColor: ink },
    ios: {
      shadowColor: ink,
      shadowOffset: { width: 0, height: 8 },
      shadowOpacity: mode === 'dark' ? 0.5 : 0.06,
      shadowRadius: 12,
    },
    default: {
      boxShadow:
        mode === 'dark' ? '0px 8px 24px rgba(0, 0, 0, 0.5)' : '0px 8px 24px rgba(22, 21, 26, 0.06)',
    },
  }) ?? {};

export const buildElevation = (mode: ColorMode, palette: Palette): Elevation => ({
  none: { borderWidth: size.hairline, borderColor: palette.line },
  float: {
    ...floatShadow(mode, mode === 'dark' ? '#000000' : palette.ink),
    ...(mode === 'dark' ? { borderWidth: size.hairline, borderColor: palette.line } : null),
  },
});

// ─── Motion ─────────────────────────────────────────
export const motion = {
  /** Press feedback: 180 ms ease-out. */
  press: { duration: 180, scale: 0.97 },
  /** Sheets and step transitions. */
  sheet: { duration: 240 },
  /** Badges and pills arriving. */
  spring: { damping: 14, stiffness: 220, mass: 1 },
  /** Skeleton pulse half-period. */
  pulse: { duration: 900 },
  /** Large-title collapse distance. */
  titleCollapse: 44,
} as const;
