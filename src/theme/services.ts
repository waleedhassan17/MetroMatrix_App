// ═══════════════════════════════════════════════════════
// MetroMatrix — Service accent layer
// ═══════════════════════════════════════════════════════
// Three layers resolve into what a screen sees (the FYP palettes.ts idea):
//
//   base      ./tokens.ts — neutrals, type, space, radius, depth. Identical
//             everywhere.
//   service   this file — an accent set, and NOTHING else.
//   brand     (later chunks) a store's own colours, same shape, overriding
//             the service accent inside that store's subtree only.
//
// A service layer is deliberately five colours. A vertical earns an accent;
// it does not earn a design language.
//
// Auth and admin wear `neutral`, which is the brand navy — nothing there
// implies a service the user has not entered yet.

import type { ColorMode } from './tokens';

export type ServiceName = 'shopping' | 'healthcare' | 'food' | 'neutral';

export interface ServicePalette {
  /** Primary action fill, selected state, accent iconography. */
  accent: string;
  /** Pressed fill, and accent-coloured TEXT — passes AA on surface and accentSoft. */
  accentDeep: string;
  /** Soft accent ground: selected chips, tinted wells, highlight rows. */
  accentSoft: string;
  /** Hairline on a selected control. */
  accentLine: string;
  /** Text and icons painted ON `accent`. Never assume this is white. */
  onAccent: string;
  /** Shopping's brass highlight — decorative only (rules, stars), never text. */
  highlight: string;
}

const LIGHT: Record<ServiceName, ServicePalette> = {
  shopping: {
    accent: '#1C1917',
    accentDeep: '#0C0A09',
    accentSoft: '#F3EDE3',
    accentLine: '#D9CBB4',
    onAccent: '#FFFFFF',
    highlight: '#B08D57',
  },
  healthcare: {
    accent: '#0B6E6E',
    accentDeep: '#075353',
    accentSoft: '#E3F1F0',
    accentLine: '#A9D3D0',
    onAccent: '#FFFFFF',
    highlight: '#0B6E6E',
  },
  food: {
    accent: '#C2410C',
    accentDeep: '#9A3412',
    accentSoft: '#FBEDE5',
    accentLine: '#F0C3A8',
    onAccent: '#FFFFFF',
    highlight: '#C2410C',
  },
  neutral: {
    accent: '#1B2A41',
    accentDeep: '#111B2B',
    accentSoft: '#E8ECF2',
    accentLine: '#C9D4E6',
    onAccent: '#FFFFFF',
    highlight: '#1B2A41',
  },
};

// Dark accents are re-tuned, not inverted: shopping's near-black accent would
// vanish on a near-black canvas, so it becomes warm stone with dark ink on it.
const DARK: Record<ServiceName, ServicePalette> = {
  shopping: {
    accent: '#E7E5E4',
    accentDeep: '#F5F5F4',
    accentSoft: '#26221E',
    accentLine: '#4A4038',
    onAccent: '#1C1917',
    highlight: '#C9A876',
  },
  healthcare: {
    accent: '#3FB8B0',
    accentDeep: '#7DD3CB',
    accentSoft: '#0F2726',
    accentLine: '#1F4A47',
    onAccent: '#0E0E10',
    highlight: '#3FB8B0',
  },
  food: {
    accent: '#F97316',
    accentDeep: '#FDBA8C',
    accentSoft: '#2B1A10',
    accentLine: '#4D2C17',
    onAccent: '#0E0E10',
    highlight: '#F97316',
  },
  neutral: {
    accent: '#C9D4E6',
    accentDeep: '#E2E8F2',
    accentSoft: '#1C2330',
    accentLine: '#34405A',
    onAccent: '#0E0E10',
    highlight: '#C9D4E6',
  },
};

export const SERVICE_PALETTES: Record<ColorMode, Record<ServiceName, ServicePalette>> = {
  light: LIGHT,
  dark: DARK,
};

export const SERVICE_NAMES: ServiceName[] = ['shopping', 'healthcare', 'food', 'neutral'];
