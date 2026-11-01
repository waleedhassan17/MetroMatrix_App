// ═══════════════════════════════════════════════════════
// MetroMatrix — Kitchen Surplus Network (docs/API_KITCHEN.md §10)
// ═══════════════════════════════════════════════════════
// Bachat Box: the kitchen's boxes and their reservations (by id; a code the
// customer shows is checked when collecting). The customer's side is
// networks/food/surplus.ts.

import { API, toApiError, clean } from '../network/network';
import type { SurplusBoxInput } from '../../models/kitchen';

const enc = encodeURIComponent;
const K = '/food/vendor/kitchen';

/** Every box the kitchen has made, newest window first (live and past alike). */
export const fetchBoxes = async (): Promise<unknown> => {
  try {
    const response = await API.GET({ URL: `${K}/surplus-boxes` });
    return response.data;
  } catch (e) {
    throw toApiError(e);
  }
};

/** In the last two hours before closing: a draft from today's planned portions not yet sold. */
export const fetchBoxSuggestion = async (): Promise<unknown> => {
  try {
    const response = await API.GET({ URL: `${K}/surplus-boxes/suggestion` });
    return response.data;
  } catch (e) {
    throw toApiError(e);
  }
};

export const createBox = async (input: SurplusBoxInput): Promise<unknown> => {
  try {
    const data = clean({
      title: input.title.trim(),
      contentsHint: input.contentsHint.trim(),
      originalValue: input.value,
      price: input.price,
      quantity: input.quantity,
      pickupFrom: input.pickupFrom,
      pickupTo: input.pickupTo,
      photoUrl: input.photoUrl,
    });
    const response = await API.POST({ URL: `${K}/surplus-boxes`, data });
    return response.data;
  } catch (e) {
    throw toApiError(e);
  }
};

/** The quantity can't drop below what is reserved; setting it to that ends the sale (sold out). */
export const updateBox = async (id: string, patch: { quantity?: number; pickupTo?: string; price?: number }): Promise<unknown> => {
  try {
    const response = await API.PATCH({ URL: `${K}/surplus-boxes/${enc(id)}`, data: clean(patch) });
    return response.data;
  } catch (e) {
    throw toApiError(e);
  }
};

/** Called off: its reservations are cancelled and the customers told. */
export const cancelBox = async (id: string): Promise<unknown> => {
  try {
    const response = await API.POST({ URL: `${K}/surplus-boxes/${enc(id)}/cancel` });
    return response.data;
  } catch (e) {
    throw toApiError(e);
  }
};

/** Reservations (their customers, codes and payments): one box's, or every box's; optionally only those `reserved`. */
export const fetchBoxReservations = async (boxId?: string, status?: 'reserved' | 'collected' | 'no_show' | 'cancelled'): Promise<unknown> => {
  try {
    const response = await API.GET({ URL: `${K}/surplus-reservations`, params: clean({ boxId, status }) });
    return response.data;
  } catch (e) {
    throw toApiError(e);
  }
};

/** The customer showed their BB- code. */
export const collectReservation = async (id: string, code: string): Promise<unknown> => {
  try {
    const response = await API.POST({ URL: `${K}/surplus-reservations/${enc(id)}/collected`, data: { code: code.trim().toUpperCase() } });
    return response.data;
  } catch (e) {
    throw toApiError(e);
  }
};

/** After the pickup window: the customer never came. */
export const markNoShow = async (id: string): Promise<unknown> => {
  try {
    const response = await API.POST({ URL: `${K}/surplus-reservations/${enc(id)}/no-show` });
    return response.data;
  } catch (e) {
    throw toApiError(e);
  }
};

export const confirmBoxPayment = async (id: string): Promise<unknown> => {
  try {
    const response = await API.POST({ URL: `${K}/surplus-reservations/${enc(id)}/payment/confirm` });
    return response.data;
  } catch (e) {
    throw toApiError(e);
  }
};

/** The customer is told why and gets 15 more minutes to send it. */
export const rejectBoxPayment = async (id: string, reason: string): Promise<unknown> => {
  try {
    const response = await API.POST({ URL: `${K}/surplus-reservations/${enc(id)}/payment/reject`, data: { reason: reason.trim() } });
    return response.data;
  } catch (e) {
    throw toApiError(e);
  }
};
