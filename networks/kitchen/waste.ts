// ═══════════════════════════════════════════════════════
// MetroMatrix — Kitchen Waste Network (docs/API_KITCHEN.md §6, §10)
// ═══════════════════════════════════════════════════════
// One waste entry per request (an ingredient, or a dish in servings), the
// summary, donations.

import { API, toApiError, clean, pageParams } from '../network/network';
import type { WasteLineInput } from '../../models/kitchen';
import { lineQty } from './purchases';

const wasteBody = (line: WasteLineInput, note?: string) =>
  clean({
    ingredientId: line.ingredientId,
    menuItemId: line.itemId,
    ...(line.itemId ? { qty: line.qty, unit: 'serving' } : lineQty(line.qty, String(line.unit ?? 'g'))),
    reason: line.reason,
    note: note?.trim(),
  });

export const logWaste = async (line: WasteLineInput, note?: string): Promise<unknown> => {
  try {
    const response = await API.POST({ URL: '/food/vendor/kitchen/waste', data: wasteBody(line, note) });
    return response.data;
  } catch (e) {
    throw toApiError(e);
  }
};

export const fetchWaste = async (page: number, pageSize: number): Promise<unknown> => {
  try {
    const response = await API.GET({ URL: '/food/vendor/kitchen/waste', params: pageParams(page, pageSize) });
    return response.data;
  } catch (e) {
    throw toApiError(e);
  }
};

export const fetchWasteSummary = async (range: '7d' | '30d' | '90d'): Promise<unknown> => {
  try {
    const response = await API.GET({ URL: '/food/vendor/kitchen/waste/summary', params: { range } });
    return response.data;
  } catch (e) {
    throw toApiError(e);
  }
};

/** Meals rescued (collected boxes and donated meals) and the donations. */
export const fetchDonations = async (): Promise<unknown> => {
  try {
    const response = await API.GET({ URL: '/food/vendor/kitchen/donations' });
    return response.data;
  } catch (e) {
    throw toApiError(e);
  }
};

export const logDonation = async (input: { meals: number; to: string; note?: string; photoUrl?: string | null }): Promise<unknown> => {
  try {
    const response = await API.POST({ URL: '/food/vendor/kitchen/donations', data: clean({ organisation: input.to.trim(), meals: input.meals, notes: input.note?.trim(), photoUrl: input.photoUrl }) });
    return response.data;
  } catch (e) {
    throw toApiError(e);
  }
};
