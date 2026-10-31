// ═══════════════════════════════════════════════════════
// MetroMatrix — Variant matrix (option1 × option2 → rows)
// ═══════════════════════════════════════════════════════
// "Size: S, M, L" × "Colour: Black, Rust" makes six rows, each with its own
// stock, price difference and SKU. Rebuilding after an option edit keeps
// what was typed for rows that still exist.

export interface VariantRow {
  /** option1|option2 — stable across rebuilds. */
  key: string;
  /** The server's id for an existing variant, or null for a new one. */
  id: string | null;
  option1: string | null;
  option2: string | null;
  sku: string;
  stock: string;
  priceDelta: string;
}

export const rowKey = (o1: string | null, o2: string | null) => `${o1 ?? ''}|${o2 ?? ''}`;

export const variantLabel = (o1: string | null, o2: string | null): string => [o1, o2].filter(Boolean).join(' / ');

const skuPart = (v: string | null) => (v ?? '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 4);

/** "KUR-01" + "M" + "Black" → "KUR-01-M-BLAC". */
export const skuFor = (base: string, o1: string | null, o2: string | null): string =>
  [base.trim().toUpperCase() || 'SKU', skuPart(o1), skuPart(o2)].filter(Boolean).join('-');

export const buildMatrix = (
  option1Values: string[],
  option2Values: string[],
  existing: VariantRow[],
  baseSku: string,
): VariantRow[] => {
  const o1s = option1Values.length ? option1Values : [null];
  const o2s = option2Values.length ? option2Values : [null];
  const byKey = new Map(existing.map(r => [r.key, r]));
  const rows: VariantRow[] = [];
  for (const o1 of o1s) {
    for (const o2 of o2s) {
      const key = rowKey(o1, o2);
      const kept = byKey.get(key);
      rows.push(kept ?? { key, id: null, option1: o1, option2: o2, sku: skuFor(baseSku, o1, o2), stock: '0', priceDelta: '0' });
    }
  }
  return rows;
};

export const setAllStock = (rows: VariantRow[], stock: number): VariantRow[] =>
  rows.map(r => ({ ...r, stock: String(Math.max(0, Math.floor(stock))) }));

export const toInt = (raw: string): number => {
  const n = Number(raw.replace(/[^\d-]/g, ''));
  return Number.isFinite(n) ? Math.trunc(n) : 0;
};

export const totalStock = (rows: Pick<VariantRow, 'stock'>[]): number =>
  rows.reduce((sum, r) => sum + Math.max(0, toInt(r.stock)), 0);
