// ═══════════════════════════════════════════════════════
// MetroMatrix — WCAG contrast
// ═══════════════════════════════════════════════════════
// Ported from the FYP's theme/contrast.ts. Real relative luminance (sRGB
// gamma expansion, Rec. 709 coefficients) — not YIQ brightness, which
// disagrees with WCAG around mid-tones, exactly where decisions are close.

interface RGB {
  r: number;
  g: number;
  b: number;
}

/** WCAG AA for body text. */
export const AA_BODY = 4.5;
/** WCAG AA for large text (≥ 18.66 px bold / 24 px) and non-text UI (1.4.11). */
export const AA_LARGE = 3;

/**
 * Accepts `#abc`, `#aabbcc`, `#aabbccff` and the same without the hash.
 * Returns null for anything else. The 8-digit form's alpha is ignored —
 * contrast against an unknown backdrop cannot account for it.
 */
export const parseHex = (value?: string | null): RGB | null => {
  if (!value) return null;
  const hex = value.trim().replace(/^#/, '');
  if (/^[0-9a-f]{3}$/i.test(hex)) {
    return {
      r: parseInt(hex[0] + hex[0], 16),
      g: parseInt(hex[1] + hex[1], 16),
      b: parseInt(hex[2] + hex[2], 16),
    };
  }
  if (/^[0-9a-f]{6}([0-9a-f]{2})?$/i.test(hex)) {
    return {
      r: parseInt(hex.slice(0, 2), 16),
      g: parseInt(hex.slice(2, 4), 16),
      b: parseInt(hex.slice(4, 6), 16),
    };
  }
  return null;
};

const channel = (c: number): number => {
  const s = c / 255;
  return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
};

export const relativeLuminance = (hex: string): number => {
  const rgb = parseHex(hex);
  if (!rgb) throw new Error(`Not a hex colour: ${hex}`);
  return 0.2126 * channel(rgb.r) + 0.7152 * channel(rgb.g) + 0.0722 * channel(rgb.b);
};

export const contrastRatio = (a: string, b: string): number => {
  const la = relativeLuminance(a);
  const lb = relativeLuminance(b);
  const [hi, lo] = la > lb ? [la, lb] : [lb, la];
  return (hi + 0.05) / (lo + 0.05);
};
