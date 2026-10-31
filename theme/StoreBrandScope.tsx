// ═══════════════════════════════════════════════════════
// MetroMatrix — StoreBrandScope: a store's own colours inside its pages
// ═══════════════════════════════════════════════════════
// Inside a store (its page, its products), the Shopping accent gives way to
// the store's brand colour. Stores choose any colour, so the scope enforces
// what the theme guarantees elsewhere:
//   accent      the brand, as the fill (buttons, selected chips)
//   onAccent    the store's text colour on it — or ink / white, whichever
//               reads, if theirs fails AA 4.5:1
//   accentDeep  brand-coloured TEXT: darkened toward ink until it passes AA
//               on white and on accentSoft
//   accentSoft  a 92% tint of the brand toward white
//   accentLine  a 72% tint
// A near-white brand is darkened until a button stands off the white page.
// A colour that isn't a hex falls back to the Shopping accent.

import React, { useMemo } from 'react';
import { AA_BODY, AA_LARGE, contrastRatio, mix, parseHex } from './contrast';
import { SERVICE_PALETTES, type ServicePalette } from './services';
import { getTheme, type Theme } from './theme';
import { PALETTES } from './tokens';
import { ThemeScope } from './ThemeProvider';

const INK = PALETTES.light.ink;
const WHITE = PALETTES.light.surface;

const hex = (c: string) => {
  const rgb = parseHex(c);
  return rgb ? `#${[rgb.r, rgb.g, rgb.b].map(n => n.toString(16).padStart(2, '0')).join('')}`.toUpperCase() : null;
};

/** The first step from `from` toward ink that reaches `ratio` on every ground. */
const darkenUntil = (from: string, grounds: string[], ratio = AA_BODY): string => {
  for (let t = 0; t <= 1.0001; t += 0.05) {
    const c = mix(from, INK, t);
    if (grounds.every(g => contrastRatio(c, g) >= ratio)) return c.toUpperCase();
  }
  return INK;
};

/** Below this a fill disappears into the white page (a white or cream brand). */
const VISIBLE_ON_WHITE = 1.5;

export const storePalette = (brand: string | null | undefined, onBrand: string | null | undefined): ServicePalette => {
  const raw = brand ? hex(brand) : null;
  if (!raw) return SERVICE_PALETTES.light.shopping;
  const accent = contrastRatio(raw, WHITE) < VISIBLE_ON_WHITE ? darkenUntil(raw, [WHITE], AA_LARGE) : raw;
  const wanted = onBrand ? hex(onBrand) : null;
  const onAccent =
    wanted && contrastRatio(accent, wanted) >= AA_BODY
      ? wanted
      : contrastRatio(accent, WHITE) >= contrastRatio(accent, INK)
        ? WHITE
        : INK;
  const accentSoft = mix(accent, WHITE, 0.92).toUpperCase();
  return {
    accent,
    onAccent,
    accentSoft,
    accentLine: mix(accent, WHITE, 0.72).toUpperCase(),
    accentDeep: darkenUntil(accent, [WHITE, accentSoft]),
    highlight: accent,
  };
};

const SHOPPING = getTheme('shopping');

export const storeTheme = (brand: string | null | undefined, onBrand: string | null | undefined): Theme => ({
  ...SHOPPING,
  service: storePalette(brand, onBrand),
  // Inside a store the bar is white with the store's colour as a rule under
  // it (the FYP's BrandHeader): a vendor's hex behind a title can't be trusted.
  header: { tone: 'surface', gradient: SHOPPING.header.gradient },
});

export const StoreBrandScope: React.FC<{
  brand: string | null | undefined;
  onBrand: string | null | undefined;
  children: React.ReactNode;
}> = ({ brand, onBrand, children }) => {
  const theme = useMemo(() => storeTheme(brand, onBrand), [brand, onBrand]);
  return <ThemeScope theme={theme}>{children}</ThemeScope>;
};
