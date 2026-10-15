// ═══════════════════════════════════════════════════════
// MetroMatrix — Shared readers for the shopping serializers
// ═══════════════════════════════════════════════════════
// Money arrives as integer rupees; a float or a numeric string is rounded,
// never trusted. A record with no id is dropped rather than half-rendered.

import type { Paged, StoreRef } from '../../types/shopping';
import { isObject, num, str, strOrNull } from '../serializerUtils';

export const HEX = /^#[0-9A-Fa-f]{6}$/;

/** Integer rupees (rounded, never negative unless allowed). */
export const money = (v: unknown, fallback = 0): number => Math.round(num(v, fallback));
export const moneyOrNull = (v: unknown): number | null => (v === null || v === undefined || v === '' ? null : money(v));
export const count = (v: unknown): number => Math.max(0, Math.round(num(v)));
export const isoOrNull = (v: unknown): string | null => {
  const s = strOrNull(v);
  return s && !Number.isNaN(Date.parse(s)) ? s : null;
};
export const iso = (v: unknown): string => isoOrNull(v) ?? new Date(0).toISOString();
export const color = (v: unknown, fallback: string): string => {
  const s = str(v);
  return HEX.test(s) ? s.toUpperCase() : fallback;
};

export function compact<T>(items: (T | null)[]): T[] {
  return items.filter((x): x is T => x !== null);
}

/** `{ items, total, page, pageSize }` with each row through `item`. */
export function paged<T>(raw: unknown, item: (r: unknown) => T | null): Paged<T> {
  const r = isObject(raw) ? raw : {};
  const items = compact((Array.isArray(r.items) ? r.items : Array.isArray(raw) ? (raw as unknown[]) : []).map(item));
  return {
    items,
    total: Math.max(count(r.total), items.length),
    page: Math.max(1, Math.round(num(r.page, 1))),
    pageSize: Math.max(1, Math.round(num(r.pageSize, items.length || 20))),
  };
}

const DEFAULT_BRAND = '#1C1917';
const DEFAULT_ON_BRAND = '#FFFFFF';

export const storeRefSerializer = (raw: unknown): StoreRef | null => {
  if (!isObject(raw)) return null;
  const id = str(raw.id);
  if (!id) return null;
  return {
    id,
    slug: str(raw.slug, id),
    name: str(raw.name, 'Store'),
    logoUrl: strOrNull(raw.logoUrl),
    brandColor: color(raw.brandColor, DEFAULT_BRAND),
    onBrandColor: color(raw.onBrandColor, DEFAULT_ON_BRAND),
    phone: strOrNull(raw.phone),
    whatsapp: strOrNull(raw.whatsapp),
  };
};

export const BRAND_FALLBACK = { brand: DEFAULT_BRAND, onBrand: DEFAULT_ON_BRAND };
