// ═══════════════════════════════════════════════════════
// MetroMatrix — Choosing a variant (customer)
// ═══════════════════════════════════════════════════════
// A product's options cross into variants; each variant has its own stock.
// An option value is offered only if some in-stock variant has it (given
// what is already chosen in the other option) — so a shopper never picks a
// combination that can't be bought.

import type { ProductDetail, ProductVariant } from '../shopping';

export interface VariantChoice {
  option1: string | null;
  option2: string | null;
}

type Product = Pick<ProductDetail, 'option1' | 'option2' | 'variants'>;

export const variantFor = (p: Product, c: VariantChoice): ProductVariant | null =>
  p.variants.find(
    v => (!p.option1 || v.option1 === c.option1) && (!p.option2 || v.option2 === c.option2),
  ) ?? null;

/** Is `value` of option `which` buyable with the other option as chosen? */
export const isValueAvailable = (p: Product, which: 1 | 2, value: string, c: VariantChoice): boolean =>
  p.variants.some(v => {
    if (v.stock <= 0) return false;
    if (which === 1) return v.option1 === value && (!p.option2 || !c.option2 || v.option2 === c.option2);
    return v.option2 === value && (!p.option1 || !c.option1 || v.option1 === c.option1);
  });

/** The first in-stock variant (in the options' own order), or the first at all. */
export const initialChoice = (p: Product, preferredVariantId?: string | null): VariantChoice => {
  const preferred = preferredVariantId ? p.variants.find(v => v.id === preferredVariantId && v.stock > 0) : null;
  const v = preferred ?? p.variants.find(x => x.stock > 0) ?? p.variants[0];
  return { option1: v?.option1 ?? null, option2: v?.option2 ?? null };
};

/**
 * Choose `value` for option `which`. If that makes the pair unbuyable, the
 * other option moves to its first value that is in stock with it.
 */
export const choose = (p: Product, c: VariantChoice, which: 1 | 2, value: string): VariantChoice => {
  const next = which === 1 ? { ...c, option1: value } : { ...c, option2: value };
  const v = variantFor(p, next);
  if (v && v.stock > 0) return next;
  const other = which === 1 ? p.option2 : p.option1;
  if (!other) return next;
  const fix = other.values.find(o =>
    which === 1 ? isValueAvailable(p, 2, o, next) : isValueAvailable(p, 1, o, next),
  );
  if (!fix) return next;
  return which === 1 ? { ...next, option2: fix } : { ...next, option1: fix };
};

/** "Only 2 left" / "In stock" / "Sold out" for the chosen variant. */
export const stockNote = (v: ProductVariant | null): { text: string; tone: 'muted' | 'warning' | 'danger' } => {
  if (!v || v.stock <= 0) return { text: 'Sold out', tone: 'danger' };
  if (v.stock <= 3) return { text: `Only ${v.stock} left`, tone: 'warning' };
  return { text: 'In stock', tone: 'muted' };
};
