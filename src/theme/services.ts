// ═══════════════════════════════════════════════════════
// MetroMatrix — Service accent layer
// ═══════════════════════════════════════════════════════
// The FYP's module palettes (theme/palettes.ts there):
//
//   neutral     the app before a service claims it — auth, onboarding,
//               admin. MetroMatrix's own emerald (the logo).
//   healthcare  clinical blue (FYP HealthcareTheme).
//   shopping    shopping orange (FYP Shopping/Brand theme).
//   food        Foodpanda is the competitor, so Food wears Foodpanda's pink
//               with only slight changes: the fill is a hair deeper than their
//               #D70F64 (#D90F66), with a richer wine-pink for text and a
//               cleaner blush for soft grounds — the premium touch is in the
//               restraint, not a different colour.
//
// `accent` is a FILL with `onAccent` text on it, so it must clear AA 4.5:1.
// Where the FYP's brightest hue does not (#2A7FFF 3.6, #E67E22 2.7, #059669
// 3.8), `accent` takes the FYP's own deeper step — exactly the rule the FYP's
// brand palette states for its buttons — and the bright hue lives on as
// `highlight`, for dots, glows and indicators that carry no text.

import type { ColorMode } from './tokens';

export type ServiceName = 'shopping' | 'healthcare' | 'food' | 'neutral';

export interface ServicePalette {
  /** Primary action fill, selected state, accent iconography. */
  accent: string;
  /** Pressed fill, and accent-coloured TEXT — passes AA on surface and accentSoft. */
  accentDeep: string;
  /** Soft accent ground: selected chips, tinted wells, icon tiles. */
  accentSoft: string;
  /** Hairline on a selected control. */
  accentLine: string;
  /** Text and icons painted ON `accent`. */
  onAccent: string;
  /** The service's brightest hue — decorative only (dots, glows, indicators). */
  highlight: string;
}

const LIGHT: Record<ServiceName, ServicePalette> = {
  neutral: {
    accent: '#047857',
    accentDeep: '#065F46',
    accentSoft: '#ECFDF5',
    accentLine: '#A7F3D0',
    onAccent: '#FFFFFF',
    highlight: '#10B981',
  },
  healthcare: {
    accent: '#1E6AE1',
    accentDeep: '#1857C0',
    accentSoft: '#EAF3FF',
    accentLine: '#D6E8FF',
    onAccent: '#FFFFFF',
    highlight: '#2A7FFF',
  },
  shopping: {
    accent: '#C25100',
    accentDeep: '#A84600',
    accentSoft: '#FFF5EB',
    accentLine: '#F8D1AD',
    onAccent: '#FFFFFF',
    highlight: '#E67E22',
  },
  food: {
    accent: '#D90F66',
    accentDeep: '#AE0C52',
    accentSoft: '#FFF0F6',
    accentLine: '#F9C6DC',
    onAccent: '#FFFFFF',
    highlight: '#E8287A',
  },
};

export const SERVICE_PALETTES: Record<ColorMode, Record<ServiceName, ServicePalette>> = {
  light: LIGHT,
};

export const SERVICE_NAMES: ServiceName[] = ['shopping', 'healthcare', 'food', 'neutral'];

/**
 * The FYP's brand glow: emerald at the heart, falling off through the logo's
 * teal. Decorative light behind the splash mark and the overview slide.
 */
export const BRAND_GLOW: [string, string] = ['#10B981', '#14B8A6'];

/** The logo's emerald → teal sweep (the overview card header on onboarding). */
export const BRAND_GRADIENT: [string, string] = ['#047857', '#0F766E'];
