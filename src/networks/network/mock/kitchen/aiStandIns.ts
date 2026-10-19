// ═══════════════════════════════════════════════════════
// MetroMatrix — The dummy API's stand-ins for the assistant's drafts
// ═══════════════════════════════════════════════════════
// The real API asks a model; these answer from rules and templates, the
// same input always giving the same draft, so the app's confirm cards,
// edits and saves can be walked without a model. Every result is a draft:
// nothing here writes.
// TODO(API_AI): docs/AI_ASSUMED.md §3 (the drafts' shapes).

import type { MockDb } from '../mockDb';
import { k } from './kitchenLogic';

/** A stable small number from a string (which template, which tip). */
export const hashOf = (s: string) => {
  let h = 2166136261;
  for (let n = 0; n < s.length; n++) {
    h ^= s.charCodeAt(n);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
};

export interface ReceiptLine {
  name: string;
  qty: number;
  unit: string;
  total: number;
  match: { ingredientId: string; name: string; confidence: number } | null;
}

/**
 * A receipt photo → draft lines. The stand-in "reads" a typical sabzi and
 * dairy receipt: three things the kitchen stocks (matched) and one it
 * doesn't (offered as a new ingredient).
 */
export const scanReceipt = (db: MockDb, businessId: string, imageUrl: string) => {
  const mine = k(db).ingredients.filter(i => i.businessId === businessId && i.category !== 'packaging');
  const pick = (key: string) => mine.find(i => i.priceRefKey === key);
  const wanted: [string, number, string, number][] = [
    ['tomato', 5, 'kg', 1150],
    ['onion', 3, 'kg', 420],
    ['coriander', 0.5, 'kg', 150],
    ['yoghurt', 4, 'kg', 1080],
    ['potato', 5, 'kg', 460],
    ['milk', 6, 'l', 1350],
  ];
  const known = wanted.filter(([key]) => pick(key)).slice(0, 3);
  const seed = hashOf(imageUrl) % 3;
  const lines: ReceiptLine[] = known.map(([key, qty, unit, total]) => {
    const i = pick(key)!;
    return { name: i.name, qty, unit, total: total + seed * 10, match: { ingredientId: i.id, name: i.name, confidence: 0.92 } };
  });
  lines.push({ name: 'Shimla mirch (capsicum)', qty: 1, unit: 'kg', total: 280, match: null });
  return {
    supplierName: 'Anwar Sabzi Wala',
    date: null as string | null,
    lines,
    total: lines.reduce((n, l) => n + l.total, 0),
  };
};

const PACKING_NOTES: { ok: boolean; note: string }[] = [
  { ok: true, note: 'Lid closed and the order slip is visible.' },
  { ok: true, note: 'Sealed bag, with the drink kept upright.' },
  { ok: true, note: 'Everything packed and the bag is sealed.' },
  { ok: true, note: 'Lid closed and the order slip is visible.' },
  { ok: false, note: 'The bag looks open. Seal it before handing it over.' },
];

/** A packing photo → an advisory line (never blocks the handover). */
export const checkPacking = (imageUrl: string) => PACKING_NOTES[hashOf(imageUrl) % PACKING_NOTES.length];
