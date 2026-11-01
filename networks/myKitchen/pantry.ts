// ═══════════════════════════════════════════════════════
// MetroMatrix — Pantry Network (docs/API_KITCHEN.md §35)
// ═══════════════════════════════════════════════════════
// The customer's pantry: items by state, what expires soon, the grocery
// lines from Shopping orders, reminder settings and the month's numbers.
// Urdu and Roman Urdu names get their canonical name (palak → spinach).

import { API, toApiError, clean, pageParams } from '../network/network';
import type { PantryLineInput, PantryReminders } from '../../models/myKitchen';
import type { StandardUnit } from '../../utils/units/units';

const enc = encodeURIComponent;
const P = '/my-kitchen/pantry';

/** The pantry counts in g, kg, ml, l, piece, dozen and pack; a pao is 250 g. */
const pantryQty = (qty: number, unit: StandardUnit | 'pack') => (unit === 'pao' ? { qty: qty * 250, unit: 'g' } : { qty, unit: unit === 'pc' ? 'piece' : unit });

const itemBody = (l: PantryLineInput) => clean({ name: l.name.trim(), ...pantryQty(l.qty, l.unit), expiresOn: l.expiresOn });

/** What is still in the pantry (`active`), or what has expired; soonest expiry first. */
export const fetchPantry = async (status: 'active' | 'expired', page = 1, pageSize = 100): Promise<unknown> => {
  try {
    const response = await API.GET({ URL: P, params: { status, ...pageParams(page, pageSize) } });
    return response.data;
  } catch (e) {
    throw toApiError(e);
  }
};

/** What expires within 3 days (or has passed). */
export const fetchExpiringPantry = async (): Promise<unknown> => {
  try {
    const response = await API.GET({ URL: `${P}/expiring` });
    return response.data;
  } catch (e) {
    throw toApiError(e);
  }
};

export const addPantryItem = async (line: PantryLineInput): Promise<unknown> => {
  try {
    const response = await API.POST({ URL: P, data: itemBody(line) });
    return response.data;
  } catch (e) {
    throw toApiError(e);
  }
};

/** Several at once (a confirmed voice command sends its proposed batch as it came). */
export const addPantryItems = async (lines: PantryLineInput[]): Promise<unknown> => {
  try {
    const response = await API.POST({ URL: `${P}/batch`, data: { items: lines.map(itemBody) } });
    return response.data;
  } catch (e) {
    throw toApiError(e);
  }
};

export const updatePantryItem = async (id: string, patch: { qty?: number; unit?: StandardUnit; expiresOn?: string | null }): Promise<unknown> => {
  try {
    const data = {
      ...(patch.qty !== undefined ? pantryQty(patch.qty, patch.unit ?? 'g') : {}),
      ...(patch.expiresOn !== undefined ? { expiresOn: patch.expiresOn } : {}),
    };
    const response = await API.PATCH({ URL: `${P}/${enc(id)}`, data });
    return response.data;
  } catch (e) {
    throw toApiError(e);
  }
};

export const removePantryItem = async (id: string): Promise<unknown> => {
  try {
    const response = await API.DELETE({ URL: `${P}/${enc(id)}` });
    return response.data;
  } catch (e) {
    throw toApiError(e);
  }
};

/** All of it used up (some of it: a PATCH of what is left). */
export const markPantryUsed = async (id: string): Promise<unknown> => {
  try {
    const response = await API.POST({ URL: `${P}/${enc(id)}/used` });
    return response.data;
  } catch (e) {
    throw toApiError(e);
  }
};

export const discardPantryItem = async (id: string): Promise<unknown> => {
  try {
    const response = await API.POST({ URL: `${P}/${enc(id)}/discard` });
    return response.data;
  } catch (e) {
    throw toApiError(e);
  }
};

/** Delivered grocery lines of the last 30 days not yet in the pantry. */
export const fetchGroceryOrders = async (): Promise<unknown> => {
  try {
    const response = await API.GET({ URL: `${P}/from-orders` });
    return response.data;
  } catch (e) {
    throw toApiError(e);
  }
};

/** Each line added once, with the aisle's suggested expiry unless the person set one. */
export const addFromShoppingOrder = async (lines: { storeOrderItemId: string; expiresOn?: string | null }[]): Promise<unknown> => {
  try {
    const response = await API.POST({ URL: `${P}/from-orders`, data: { lines: lines.map(l => clean({ ...l })) } });
    return response.data;
  } catch (e) {
    throw toApiError(e);
  }
};

export const fetchPantryReminders = async (): Promise<unknown> => {
  try {
    const response = await API.GET({ URL: `${P}/reminders` });
    return response.data;
  } catch (e) {
    throw toApiError(e);
  }
};

export const savePantryReminders = async (r: Partial<PantryReminders>): Promise<unknown> => {
  try {
    const data = { ...(r.enabled !== undefined ? { enabled: r.enabled } : {}), ...clean({ time: r.time, daysBefore: r.daysBefore }) };
    const response = await API.PUT({ URL: `${P}/reminders`, data });
    return response.data;
  } catch (e) {
    throw toApiError(e);
  }
};

/** Used, expired and discarded over `days`, and what is wasted most. */
export const fetchPantryStats = async (days = 30): Promise<unknown> => {
  try {
    const response = await API.GET({ URL: '/my-kitchen/stats', params: { days } });
    return response.data;
  } catch (e) {
    throw toApiError(e);
  }
};
