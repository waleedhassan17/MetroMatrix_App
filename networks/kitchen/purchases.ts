// ═══════════════════════════════════════════════════════
// MetroMatrix — Kitchen Purchases Network (docs/API_KITCHEN.md §4–5)
// ═══════════════════════════════════════════════════════
// Purchases, suppliers, the price watch and the PBS items it maps to. A
// purchase's lines all name an ingredient (a new one is created first); each
// keeps the unit the cook bought in.

import { API, toApiError, clean, pageParams } from '../network/network';
import type { PurchaseInput, PurchaseSource } from '../../models/kitchen';

const enc = encodeURIComponent;

const SOURCE: Record<PurchaseSource, string> = { manual: 'manual', voice: 'voice', receipt: 'receipt_scan' };

/** A quantity in the unit the cook used: the API reads kg, dozen and the ingredient's own units; a pao is 250 g. */
export const lineQty = (qty: number, unit: string) => (unit === 'pao' ? { qty: qty * 250, unit: 'g' } : { qty, unit: unit === 'pc' ? 'piece' : unit });

const purchaseBody = (input: PurchaseInput) => ({
  ...clean({
    supplierId: input.supplierId,
    purchasedAt: input.date,
    receiptUrl: input.receiptUrl,
    receiptPublicId: input.receiptPublicId,
    source: SOURCE[input.source],
    note: input.note?.trim(),
  }),
  lines: input.lines.map(l => clean({ ingredientId: l.ingredientId, ...lineQty(l.qty, String(l.unit)), totalPrice: l.total, expiresOn: l.expiresOn })),
});

/** Newest first. */
export const fetchPurchases = async (page: number, pageSize: number): Promise<unknown> => {
  try {
    const response = await API.GET({ URL: '/food/vendor/kitchen/purchases', params: pageParams(page, pageSize) });
    return response.data;
  } catch (e) {
    throw toApiError(e);
  }
};

/** With its lines and a 10-minute receipt link. */
export const fetchPurchase = async (id: string): Promise<unknown> => {
  try {
    const response = await API.GET({ URL: `/food/vendor/kitchen/purchases/${enc(id)}` });
    return response.data;
  } catch (e) {
    throw toApiError(e);
  }
};

export const createPurchase = async (input: PurchaseInput): Promise<unknown> => {
  try {
    const response = await API.POST({ URL: '/food/vendor/kitchen/purchases', data: purchaseBody(input) });
    return response.data;
  } catch (e) {
    throw toApiError(e);
  }
};

/** The supplier, the date or the note only. */
export const updatePurchase = async (id: string, patch: { supplierId?: string | null; date?: string; note?: string | null }): Promise<unknown> => {
  try {
    const data = {
      ...(patch.supplierId !== undefined ? { supplierId: patch.supplierId } : {}),
      ...(patch.date ? { purchasedAt: patch.date } : {}),
      ...(patch.note !== undefined ? { note: patch.note?.trim() || null } : {}),
    };
    const response = await API.PATCH({ URL: `/food/vendor/kitchen/purchases/${enc(id)}`, data });
    return response.data;
  } catch (e) {
    throw toApiError(e);
  }
};

/** Only while none of it has been used (409 otherwise: count the stock instead). */
export const deletePurchase = async (id: string): Promise<unknown> => {
  try {
    const response = await API.DELETE({ URL: `/food/vendor/kitchen/purchases/${enc(id)}` });
    return response.data;
  } catch (e) {
    throw toApiError(e);
  }
};

export const fetchSuppliers = async (): Promise<unknown> => {
  try {
    const response = await API.GET({ URL: '/food/vendor/kitchen/suppliers' });
    return response.data;
  } catch (e) {
    throw toApiError(e);
  }
};

export const createSupplier = async (input: { name: string; phone?: string | null; note?: string | null }): Promise<unknown> => {
  try {
    const response = await API.POST({ URL: '/food/vendor/kitchen/suppliers', data: clean({ name: input.name.trim(), phone: input.phone?.trim(), notes: input.note?.trim() }) });
    return response.data;
  } catch (e) {
    throw toApiError(e);
  }
};

export const updateSupplier = async (id: string, patch: { name?: string; phone?: string | null; note?: string | null }): Promise<unknown> => {
  try {
    const data = {
      ...(patch.name ? { name: patch.name.trim() } : {}),
      ...(patch.phone !== undefined ? { phone: patch.phone?.trim() || null } : {}),
      ...(patch.note !== undefined ? { notes: patch.note?.trim() || null } : {}),
    };
    const response = await API.PATCH({ URL: `/food/vendor/kitchen/suppliers/${enc(id)}`, data });
    return response.data;
  } catch (e) {
    throw toApiError(e);
  }
};

export const deleteSupplier = async (id: string): Promise<unknown> => {
  try {
    const response = await API.DELETE({ URL: `/food/vendor/kitchen/suppliers/${enc(id)}` });
    return response.data;
  } catch (e) {
    throw toApiError(e);
  }
};

/** Your last price against the PBS weekly city price. */
export const fetchPriceWatch = async (): Promise<unknown> => {
  try {
    const response = await API.GET({ URL: '/food/vendor/kitchen/price-watch' });
    return response.data;
  } catch (e) {
    throw toApiError(e);
  }
};

/** The PBS SPI items an ingredient can be compared with. */
export const fetchReferenceItems = async (q: string): Promise<unknown> => {
  try {
    const response = await API.GET({ URL: '/food/vendor/kitchen/price-watch/reference-items', params: clean({ q: q.trim() }) });
    return response.data;
  } catch (e) {
    throw toApiError(e);
  }
};
