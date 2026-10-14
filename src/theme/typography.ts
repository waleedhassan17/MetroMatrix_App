// ═══════════════════════════════════════════════════════
// MetroMatrix — Type scale
// ═══════════════════════════════════════════════════════
// The ONLY place a typeface is named. Plus Jakarta Sans carries the UI;
// Instrument Serif is display-only (welcome, empty states, store names).
//
// Each role names the weight-specific FACE rather than pairing a family with
// `fontWeight`: Android ignores fontWeight for custom fonts and would render
// every weight as Regular.

import type { TextStyle } from 'react-native';

export const FONT_FACES = {
  sans400: 'PlusJakartaSans_400Regular',
  sans500: 'PlusJakartaSans_500Medium',
  sans600: 'PlusJakartaSans_600SemiBold',
  sans700: 'PlusJakartaSans_700Bold',
  serif400: 'InstrumentSerif_400Regular',
} as const;

export type TypeRole =
  | 'display'
  | 'h1'
  | 'h2'
  | 'title'
  | 'body'
  | 'bodyStrong'
  | 'small'
  | 'micro';

export type TypeScale = Record<TypeRole, TextStyle>;

export const type: TypeScale = {
  /** Welcome, empty states, store names. */
  display: { fontFamily: FONT_FACES.serif400, fontSize: 34, lineHeight: 40 },
  /** Screen large titles. */
  h1: { fontFamily: FONT_FACES.sans700, fontSize: 26, lineHeight: 32 },
  /** Section titles. */
  h2: { fontFamily: FONT_FACES.sans600, fontSize: 20, lineHeight: 26 },
  /** Card titles, list rows. */
  title: { fontFamily: FONT_FACES.sans600, fontSize: 17, lineHeight: 22 },
  /** Default. */
  body: { fontFamily: FONT_FACES.sans400, fontSize: 15, lineHeight: 22 },
  /** Emphasis, button labels. */
  bodyStrong: { fontFamily: FONT_FACES.sans600, fontSize: 15, lineHeight: 22 },
  /** Meta, helper text. */
  small: { fontFamily: FONT_FACES.sans500, fontSize: 13, lineHeight: 18 },
  /** Overlines, badges. */
  micro: {
    fontFamily: FONT_FACES.sans600,
    fontSize: 11,
    lineHeight: 14,
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
};

/** Dynamic type is honoured up to 130% — beyond that fixed-height controls clip. */
export const MAX_FONT_SCALE = 1.3;
