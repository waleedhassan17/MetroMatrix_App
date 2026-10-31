// ═══════════════════════════════════════════════════════
// MetroMatrix — Food Vendor Settings Network (API_FOOD.md)
// ═══════════════════════════════════════════════════════
// How the branch works — settings, opening hours,
// delivery fee bands, closures and the accounts customers transfer to.
// docs/API_FOOD.md §4.3: /food/vendor/settings, /hours, /fee-bands, /closures,
// /payment-accounts (the API names an account's fields accountTitle and
// accountNumber; the app's PaymentAccount says title and number).

import { api, toApiError } from '../../network/apiHelpers';
import type { FeeBand, HoursRange, VendorSettingsInput } from '../../../models/food';
import type { PaymentAccountInput } from '../../../models/payments';

const enc = encodeURIComponent;

export const getVendorSettingsAPI = async (): Promise<unknown> => {
  try {
    const response = await api.get('/food/vendor/settings');
    return response.data;
  } catch (e) {
    throw toApiError(e);
  }
};

export const updateVendorSettingsAPI = async (input: VendorSettingsInput): Promise<unknown> => {
  try {
    const response = await api.patch('/food/vendor/settings', input);
    return response.data;
  } catch (e) {
    throw toApiError(e);
  }
};

export const getHoursAPI = async (): Promise<unknown> => {
  try {
    const response = await api.get('/food/vendor/hours');
    return response.data;
  } catch (e) {
    throw toApiError(e);
  }
};

/** Replaces the week. A range that closes before it opens runs past midnight. */
export const saveHoursAPI = async (ranges: Pick<HoursRange, 'weekday' | 'opensAt' | 'closesAt'>[]): Promise<unknown> => {
  try {
    const response = await api.put('/food/vendor/hours', ranges.map(r => ({ weekday: r.weekday, opensAt: r.opensAt, closesAt: r.closesAt })));
    return response.data;
  } catch (e) {
    throw toApiError(e);
  }
};

export const getFeeBandsAPI = async (): Promise<unknown> => {
  try {
    const response = await api.get('/food/vendor/fee-bands');
    return response.data;
  } catch (e) {
    throw toApiError(e);
  }
};

/** From 0 km, back to back, at most 6. */
export const saveFeeBandsAPI = async (bands: FeeBand[]): Promise<unknown> => {
  try {
    const response = await api.put('/food/vendor/fee-bands', bands);
    return response.data;
  } catch (e) {
    throw toApiError(e);
  }
};

export const getClosuresAPI = async (): Promise<unknown> => {
  try {
    const response = await api.get('/food/vendor/closures');
    return response.data;
  } catch (e) {
    throw toApiError(e);
  }
};

export const addClosureAPI = async (input: { startsAt: string; endsAt: string; reason: string | null }): Promise<unknown> => {
  try {
    const response = await api.post('/food/vendor/closures', input.reason ? input : { startsAt: input.startsAt, endsAt: input.endsAt });
    return response.data;
  } catch (e) {
    throw toApiError(e);
  }
};

export const removeClosureAPI = async (id: string): Promise<unknown> => {
  try {
    const response = await api.delete(`/food/vendor/closures/${enc(id)}`);
    return response.data;
  } catch (e) {
    throw toApiError(e);
  }
};

const accountOut = (input: Partial<PaymentAccountInput>, creating: boolean) =>
  creating
    ? { kind: input.kind, accountTitle: input.title, accountNumber: input.number, bankName: input.bankName ?? undefined, isActive: input.isActive }
    : // An account's kind and number can't change once saved (the API takes title, bank and on/off).
      { accountTitle: input.title, bankName: input.bankName ?? undefined, isActive: input.isActive };

export const getVendorPaymentAccountsAPI = async (): Promise<unknown> => {
  try {
    const response = await api.get('/food/vendor/payment-accounts');
    return response.data;
  } catch (e) {
    throw toApiError(e);
  }
};
export const createVendorPaymentAccountAPI = async (input: PaymentAccountInput): Promise<unknown> => {
  try {
    const response = await api.post('/food/vendor/payment-accounts', accountOut(input, true));
    return response.data;
  } catch (e) {
    throw toApiError(e);
  }
};
export const updateVendorPaymentAccountAPI = async (id: string, input: Partial<PaymentAccountInput>): Promise<unknown> => {
  try {
    const response = await api.patch(`/food/vendor/payment-accounts/${enc(id)}`, accountOut(input, false));
    return response.data;
  } catch (e) {
    throw toApiError(e);
  }
};
export const deleteVendorPaymentAccountAPI = async (id: string): Promise<unknown> => {
  try {
    const response = await api.delete(`/food/vendor/payment-accounts/${enc(id)}`);
    return response.data;
  } catch (e) {
    throw toApiError(e);
  }
};
