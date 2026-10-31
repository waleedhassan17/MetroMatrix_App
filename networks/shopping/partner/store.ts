// ═══════════════════════════════════════════════════════
// MetroMatrix — Shopping Partner Store Network (API_SHOPPING.md)
// ═══════════════════════════════════════════════════════
// The dashboard, profile, settings (pausing is a setting), payment accounts.

import { API, toApiError } from '../../network/network';
import type { PaymentAccountInput, StoreProfileInput, StoreSettings } from '../../../models/shopping';
import { COD_NO_LIMIT } from '../../../models/shopping/storeModel';

const BASE = '/shop/partner';

/**
 * The links the store set (StoreSocials keeps only those); the server picks
 * the text colour on the brand. The logo and cover go only when they changed:
 * the API checks each one it is sent is the owner's own upload.
 */
const profileBody = (input: StoreProfileInput, before: Pick<StoreProfileInput, 'logoUrl' | 'coverUrl'> | null) => ({
  tagline: input.tagline.trim() || null,
  about: input.about.trim() || null,
  ...(!before || input.logoUrl !== before.logoUrl ? { logoUrl: input.logoUrl } : {}),
  ...(!before || input.coverUrl !== before.coverUrl ? { coverUrl: input.coverUrl } : {}),
  brandColor: input.brandColor,
  socials: Object.fromEntries(
    Object.entries({ ...input.socials, whatsapp: input.whatsapp }).filter((e): e is [string, string] => !!e[1]?.trim()),
  ),
});

/** Nationwide is no city list; pausing is a setting too (the pause message only while paused). */
const settingsBody = (input: StoreSettings) => ({
  returnWindowDays: input.returnWindowDays,
  codEnabled: input.codEnabled,
  codLimit: input.codLimit ?? COD_NO_LIMIT,
  shippingFlatFee: input.shippingFee,
  freeShippingOver: input.freeShippingOver,
  deliveryCities: input.nationwide ? [] : input.deliveryCities,
  dispatchDaysMin: input.dispatchMinDays,
  dispatchDaysMax: input.dispatchMaxDays,
  isPaused: input.isPaused,
  pauseMessage: input.isPaused ? input.pauseMessage?.trim() || null : null,
});

const accountBody = (input: PaymentAccountInput) => ({
  kind: input.kind,
  accountTitle: input.title.trim(),
  accountNumber: input.number.trim(),
  ...(input.bankName?.trim() ? { bankName: input.bankName.trim() } : {}),
  isActive: input.isActive,
});

export const fetchDashboard = async (): Promise<unknown> => {
  try {
    const response = await API.GET({ URL: `${BASE}/dashboard` });
    return response.data;
  } catch (e) {
    throw toApiError(e);
  }
};

export const fetchStoreProfile = async (): Promise<unknown> => {
  try {
    const response = await API.GET({ URL: `${BASE}/store` });
    return response.data;
  } catch (e) {
    throw toApiError(e);
  }
};
export const updateStoreProfile = async (input: StoreProfileInput, before: Pick<StoreProfileInput, 'logoUrl' | 'coverUrl'> | null = null): Promise<unknown> => {
  try {
    const response = await API.PATCH({ URL: `${BASE}/store`, data: profileBody(input, before) });
    return response.data;
  } catch (e) {
    throw toApiError(e);
  }
};

export const fetchStoreSettings = async (): Promise<unknown> => {
  try {
    const response = await API.GET({ URL: `${BASE}/store/settings` });
    return response.data;
  } catch (e) {
    throw toApiError(e);
  }
};
export const updateStoreSettings = async (input: StoreSettings): Promise<unknown> => {
  try {
    const response = await API.PATCH({ URL: `${BASE}/store/settings`, data: settingsBody(input) });
    return response.data;
  } catch (e) {
    throw toApiError(e);
  }
};

export const pauseStore = async (message: string): Promise<unknown> => {
  try {
    const response = await API.PATCH({ URL: `${BASE}/store/settings`, data: { isPaused: true, pauseMessage: message.trim() || null } });
    return response.data;
  } catch (e) {
    throw toApiError(e);
  }
};
export const resumeStore = async (): Promise<unknown> => {
  try {
    const response = await API.PATCH({ URL: `${BASE}/store/settings`, data: { isPaused: false } });
    return response.data;
  } catch (e) {
    throw toApiError(e);
  }
};

export const fetchPaymentAccounts = async (): Promise<unknown> => {
  try {
    const response = await API.GET({ URL: `${BASE}/store/payment-accounts` });
    return response.data;
  } catch (e) {
    throw toApiError(e);
  }
};
export const createPaymentAccount = async (input: PaymentAccountInput): Promise<unknown> => {
  try {
    const response = await API.POST({ URL: `${BASE}/store/payment-accounts`, data: accountBody(input) });
    return response.data;
  } catch (e) {
    throw toApiError(e);
  }
};
export const updatePaymentAccount = async (id: string, input: PaymentAccountInput): Promise<unknown> => {
  try {
    const response = await API.PATCH({ URL: `${BASE}/store/payment-accounts/${encodeURIComponent(id)}`, data: accountBody(input) });
    return response.data;
  } catch (e) {
    throw toApiError(e);
  }
};
export const deletePaymentAccount = async (id: string): Promise<unknown> => {
  try {
    const response = await API.DELETE({ URL: `${BASE}/store/payment-accounts/${encodeURIComponent(id)}` });
    return response.data;
  } catch (e) {
    throw toApiError(e);
  }
};
