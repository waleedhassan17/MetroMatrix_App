// ═══════════════════════════════════════════════════════
// MetroMatrix — Money (integer rupees, one formatter)
// ═══════════════════════════════════════════════════════
// Every amount in the app is an integer number of rupees, exactly as the API
// sends it. It is shown ONLY through formatPKR — no toFixed, no floats, no
// locale-dependent Intl (Hermes builds differ), so "Rs 1,250" reads the same
// on every device.

/** 1250 → "1,250" (Western grouping, as Pakistani storefronts print prices). */
const group = (n: number): string => {
  const digits = String(Math.abs(Math.round(n)));
  return digits.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
};

/** 1250 → "Rs 1,250"; -200 → "−Rs 200" (a true minus, for discounts). */
export const formatPKR = (n: number): string => {
  const safe = Number.isFinite(n) ? Math.round(n) : 0;
  return `${safe < 0 ? '−' : ''}Rs ${group(safe)}`;
};

/** Whole-percent discount from the was-price, or 0 ("-20%" badges). */
export const discountPercent = (price: number, compareAtPrice: number | null | undefined): number => {
  if (!compareAtPrice || compareAtPrice <= price || compareAtPrice <= 0) return 0;
  return Math.round(((compareAtPrice - price) / compareAtPrice) * 100);
};

/** Digits a person typed into a rupee field → integer rupees, or null. */
export const parseRupees = (raw: string): number | null => {
  const digits = raw.replace(/[^\d]/g, '');
  if (!digits) return null;
  const n = Number(digits);
  return Number.isSafeInteger(n) ? n : null;
};
