// ═══════════════════════════════════════════════════════
// MetroMatrix — Catering Network (docs/API_KITCHEN.md §20)
// ═══════════════════════════════════════════════════════
// A kitchen's catering page, a customer's requests, the kitchen's quotes and
// settings. Requests go by id (the CT- code is what people read).

import { API, toApiError, clean } from '../network/network';
import type { CateringRequestInput, CateringSettings, QuoteInput } from '../../models/kitchen';

const enc = encodeURIComponent;

// ── Customers ──
/** Open or not, the party size and notice, how it can be served, the menu. */
export const fetchCateringVendor = async (vendor: string): Promise<unknown> => {
  try {
    const response = await API.GET({ URL: `/food/catering/vendors/${enc(vendor)}` });
    return response.data;
  } catch (e) {
    throw toApiError(e);
  }
};

export const requestCatering = async (input: CateringRequestInput): Promise<unknown> => {
  try {
    const data = clean({
      vendorId: input.vendorId,
      eventDate: input.date,
      eventTime: input.time,
      guests: input.guests,
      eventType: input.eventType,
      requestedItems: input.dishes.map(d => clean({ menuItemId: d.itemId, name: d.name?.trim(), qty: d.qty })),
      budget: input.budget,
      fulfilment: input.mode,
      addressId: input.mode === 'pickup' ? undefined : input.addressId,
      notes: input.notes?.trim(),
    });
    const response = await API.POST({ URL: '/food/catering', data });
    return response.data;
  } catch (e) {
    throw toApiError(e);
  }
};

export const fetchMyCateringRequests = async (): Promise<unknown> => {
  try {
    const response = await API.GET({ URL: '/food/catering' });
    return response.data;
  } catch (e) {
    throw toApiError(e);
  }
};

export const fetchMyCateringRequest = async (id: string): Promise<unknown> => {
  try {
    const response = await API.GET({ URL: `/food/catering/${enc(id)}` });
    return response.data;
  } catch (e) {
    throw toApiError(e);
  }
};

/** Only the newest version, before `validUntil`. */
export const acceptQuote = async (id: string, version: number): Promise<unknown> => {
  try {
    const response = await API.POST({ URL: `/food/catering/${enc(id)}/accept`, data: { version } });
    return response.data;
  } catch (e) {
    throw toApiError(e);
  }
};

/** The advance's transfer receipt (a payment_proof upload of yours). */
export const submitAdvanceProof = async (id: string, input: { transactionId: string; imageUrl: string | null; publicId?: string | null }): Promise<unknown> => {
  try {
    const data = clean({ proofUrl: input.imageUrl, publicId: input.publicId, ref: input.transactionId.trim() });
    const response = await API.POST({ URL: `/food/catering/${enc(id)}/advance-proof`, data });
    return response.data;
  } catch (e) {
    throw toApiError(e);
  }
};

/** Until it is confirmed. */
export const cancelMyCatering = async (id: string, reason: string): Promise<unknown> => {
  try {
    const response = await API.POST({ URL: `/food/catering/${enc(id)}/cancel`, data: { reason: reason.trim() } });
    return response.data;
  } catch (e) {
    throw toApiError(e);
  }
};

// ── The kitchen ──
export const fetchCateringSettings = async (): Promise<unknown> => {
  try {
    const response = await API.GET({ URL: '/food/vendor/catering/settings' });
    return response.data;
  } catch (e) {
    throw toApiError(e);
  }
};

export const updateCateringSettings = async (patch: Partial<CateringSettings>): Promise<unknown> => {
  try {
    const response = await API.PATCH({ URL: '/food/vendor/catering/settings', data: patch });
    return response.data;
  } catch (e) {
    throw toApiError(e);
  }
};

/** Every request (by event date, at most 200), or those in one state. */
export const fetchCateringRequests = async (status?: string): Promise<unknown> => {
  try {
    const response = await API.GET({ URL: '/food/vendor/catering', params: clean({ status }) });
    return response.data;
  } catch (e) {
    throw toApiError(e);
  }
};

export const fetchCateringRequest = async (id: string): Promise<unknown> => {
  try {
    const response = await API.GET({ URL: `/food/vendor/catering/${enc(id)}` });
    return response.data;
  } catch (e) {
    throw toApiError(e);
  }
};

/** A new version every time; earlier ones can no longer be accepted. */
export const sendQuote = async (id: string, input: QuoteInput): Promise<unknown> => {
  try {
    const data = clean({
      lines: input.lines.map(l => clean({ menuItemId: l.itemId, name: (l.name ?? '').trim(), qty: l.qty, unitPrice: l.unitPrice })),
      deliveryFee: input.deliveryFee,
      advancePct: input.advancePct,
      validUntil: input.validUntil,
      notes: input.notes?.trim(),
    });
    const response = await API.POST({ URL: `/food/vendor/catering/${enc(id)}/quote`, data: { ...data, advancePct: input.advancePct, deliveryFee: input.deliveryFee } });
    return response.data;
  } catch (e) {
    throw toApiError(e);
  }
};

export const declineCatering = async (id: string, reason: string): Promise<unknown> => {
  try {
    const response = await API.POST({ URL: `/food/vendor/catering/${enc(id)}/decline`, data: { reason: reason.trim() } });
    return response.data;
  } catch (e) {
    throw toApiError(e);
  }
};

/** The advance reached your account: confirmed. */
export const confirmAdvance = async (id: string): Promise<unknown> => {
  try {
    const response = await API.POST({ URL: `/food/vendor/catering/${enc(id)}/advance/confirm` });
    return response.data;
  } catch (e) {
    throw toApiError(e);
  }
};

/** Back to accepted, with the reason. */
export const rejectAdvance = async (id: string, reason: string): Promise<unknown> => {
  try {
    const response = await API.POST({ URL: `/food/vendor/catering/${enc(id)}/advance/reject`, data: { reason: reason.trim() } });
    return response.data;
  } catch (e) {
    throw toApiError(e);
  }
};
