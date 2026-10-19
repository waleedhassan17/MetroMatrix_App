// ═══════════════════════════════════════════════════════
// MetroMatrix — A purchase: typed, scanned from a receipt or spoken
// ═══════════════════════════════════════════════════════
// All three end as the same draft lines the cook checks before saving;
// unknown names become new ingredients only when the cook says so.

import type { IngredientCategory, PurchaseInput, PurchaseSource, ReceiptDraft, VoiceQtyLine } from '../../types/kitchen';
import type { ValidationErrors } from '../authModel';
import { UNITS, parseUnit, type BaseUnit, type StandardUnit } from '../../utils/units';
import { parseRupees } from '../../utils/money';
import { parseAmount } from './stockModel';

export interface DraftLine {
  /** A stable key for the list. */
  key: string;
  ingredientId: string | null;
  name: string;
  /** For a new ingredient (no id): what it is and how it is counted. */
  category: IngredientCategory;
  baseUnit: BaseUnit;
  qty: string;
  unit: StandardUnit | string;
  total: string;
  expiresOn: string | null;
}

export const MAX_PURCHASE_LINES = 40;

let seq = 0;
export const newLineKey = () => `line-${Date.now().toString(36)}-${++seq}`;

export const emptyLine = (): DraftLine => ({ key: newLineKey(), ingredientId: null, name: '', category: 'vegetables', baseUnit: 'g', qty: '', unit: 'kg', total: '', expiresOn: null });

const baseOfUnit = (unit: string): BaseUnit => {
  const u = parseUnit(unit) ?? (unit in UNITS ? (unit as StandardUnit) : null);
  return u ? UNITS[u].base : 'g';
};

/** A scanned receipt → lines to check (matched ones keep their ingredient). */
export const linesFromReceipt = (d: ReceiptDraft): DraftLine[] =>
  d.lines.map(l => {
    const unit = parseUnit(l.unit) ?? 'kg';
    return {
      key: newLineKey(),
      ingredientId: l.match?.ingredientId ?? null,
      name: l.match?.name ?? l.name,
      category: 'vegetables',
      baseUnit: UNITS[unit].base,
      qty: String(l.qty),
      unit,
      total: String(l.total),
      expiresOn: null,
    };
  });

/** A spoken purchase → lines to check. */
export const linesFromVoice = (lines: VoiceQtyLine[]): DraftLine[] =>
  lines.map(l => ({
    key: newLineKey(),
    ingredientId: l.ingredientId,
    name: l.name,
    category: 'vegetables',
    baseUnit: baseOfUnit(l.unit),
    qty: String(l.qty),
    unit: l.unit,
    total: l.total === null ? '' : String(l.total),
    expiresOn: null,
  }));

export const validatePurchase = (lines: DraftLine[]): { errors: ValidationErrors; lineErrors: Record<string, string> } => {
  const errors: ValidationErrors = {};
  const lineErrors: Record<string, string> = {};
  if (!lines.length) errors.lines = 'Add what you bought';
  if (lines.length > MAX_PURCHASE_LINES) errors.lines = `Up to ${MAX_PURCHASE_LINES} items`;
  for (const l of lines) {
    if (!l.ingredientId && l.name.trim().length < 2) lineErrors[l.key] = 'Pick an ingredient or name a new one';
    else if (!(parseAmount(l.qty) && parseAmount(l.qty)! > 0)) lineErrors[l.key] = 'Enter how much';
    else if (parseRupees(l.total) === null) lineErrors[l.key] = 'Enter what it cost';
  }
  return { errors, lineErrors };
};

export const purchaseInput = (lines: DraftLine[], source: PurchaseSource, more: { supplierId?: string | null; supplierName?: string | null; receiptUrl?: string | null; date?: string }): PurchaseInput => ({
  ...(more.date ? { date: more.date } : null),
  supplierId: more.supplierId ?? undefined,
  supplierName: more.supplierId ? undefined : more.supplierName?.trim() || undefined,
  source,
  receiptUrl: more.receiptUrl ?? undefined,
  lines: lines.map(l => ({
    ...(l.ingredientId ? { ingredientId: l.ingredientId } : { newIngredient: { name: l.name.trim(), category: l.category, baseUnit: l.baseUnit } }),
    qty: parseAmount(l.qty) ?? 0,
    unit: l.unit,
    total: parseRupees(l.total) ?? 0,
    ...(l.expiresOn ? { expiresOn: l.expiresOn } : null),
  })),
});

export const draftTotal = (lines: DraftLine[]) => lines.reduce((n, l) => n + (parseRupees(l.total) ?? 0), 0);
