// ═══════════════════════════════════════════════════════
// MetroMatrix — Defensive field readers for serializers
// ═══════════════════════════════════════════════════════
// The API is the source of truth, but a renamed field, a null or a number
// sent as a string must degrade to a sensible default, never crash a screen.

export const isObject = (v: unknown): v is Record<string, any> => !!v && typeof v === 'object' && !Array.isArray(v);

export const str = (v: unknown, fallback = ''): string =>
  typeof v === 'string' ? v : typeof v === 'number' && Number.isFinite(v) ? String(v) : fallback;

export const strOrNull = (v: unknown): string | null => {
  const s = str(v);
  return s ? s : null;
};

export const num = (v: unknown, fallback = 0): number => {
  const n = typeof v === 'number' ? v : typeof v === 'string' && v.trim() ? Number(v) : NaN;
  return Number.isFinite(n) ? n : fallback;
};

export const bool = (v: unknown, fallback = false): boolean =>
  typeof v === 'boolean' ? v : v === 'true' ? true : v === 'false' ? false : fallback;

export function oneOf<T extends string>(v: unknown, allowed: readonly T[], fallback: T): T;
export function oneOf<T extends string>(v: unknown, allowed: readonly T[], fallback: null): T | null;
export function oneOf<T extends string>(v: unknown, allowed: readonly T[], fallback: T | null): T | null {
  return typeof v === 'string' && (allowed as readonly string[]).includes(v) ? (v as T) : fallback;
}

export const arr = (v: unknown): unknown[] => (Array.isArray(v) ? v : []);

/** Keep only allowed string members, de-duplicated, order preserved. */
export function enumList<T extends string>(v: unknown, allowed: readonly T[]): T[] {
  const out: T[] = [];
  for (const item of arr(v)) {
    const ok = oneOf(item, allowed, null);
    if (ok && !out.includes(ok)) out.push(ok);
  }
  return out;
}
