// ═══════════════════════════════════════════════════════
// MetroMatrix — Food Vendor Settings Network (API_FOOD.md)
// ═══════════════════════════════════════════════════════
// How the branch works — settings, opening hours,
// delivery fee bands, closures and the accounts customers transfer to.
// docs/API_FOOD.md §4.3: /food/vendor/settings, /hours, /fee-bands, /closures,
// /payment-accounts (the API names an account's fields accountTitle and
// accountNumber; the app's PaymentAccount says title and number).

import { API, toApiError } from '../../network/network';
import type { FeeBand, HoursRange, VendorSettingsInput } from '../../../models/food';
import type { PaymentAccountInput } from '../../../models/payments';

const enc = encodeURIComponent;

export const fetchVendorSettings = async (): Promise<unknown> => {
  try {
    const response = await API.GET({ URL: '/food/vendor/settings' });
    return response.data;
  } catch (e) {
    throw toApiError(e);
  }
};

export const updateVendorSettings = async (input: VendorSettingsInput): Promise<unknown> => {
  try {
    const response = await API.PATCH({ URL: '/food/vendor/settings', data: input });
    return response.data;
  } catch (e) {
    throw toApiError(e);
  }
};

export const fetchHours = async (): Promise<unknown> => {
  try {
    const response = await API.GET({ URL: '/food/vendor/hours' });
    return response.data;
  } catch (e) {
    throw toApiError(e);
  }
};

/** Replaces the week. A range that closes before it opens runs past midnight. */
export const saveHours = async (ranges: Pick<HoursRange, 'weekday' | 'opensAt' | 'closesAt'>[]): Promise<unknown> => {
  try {
    const response = await API.PUT({ URL: '/food/vendor/hours', data: ranges.map(r => ({ weekday: r.weekday, opensAt: r.opensAt, closesAt: r.closesAt })) });
    return response.data;
  } catch (e) {
    throw toApiError(e);
  }
};

export const fetchFeeBands = async (): Promise<unknown> => {
  try {
    const response = await API.GET({ URL: '/food/vendor/fee-bands' });
    return response.data;
  } catch (e) {
    throw toApiError(e);
  }
};

/** From 0 km, back to back, at most 6. */
export const saveFeeBands = async (bands: FeeBand[]): Promise<unknown> => {
  try {
    const response = await API.PUT({ URL: '/food/vendor/fee-bands', data: bands });
    return response.data;
  } catch (e) {
    throw toApiError(e);
  }
};

export const fetchClosures = async (): Promise<unknown> => {
  try {
    const response = await API.GET({ URL: '/food/vendor/closures' });
    return response.data;
  } catch (e) {
    throw toApiError(e);
  }
};

export const addClosure = async (input: { startsAt: string; endsAt: string; reason: string | null }): Promise<unknown> => {
  try {
    const response = await API.POST({ URL: '/food/vendor/closures', data: input.reason ? input : { startsAt: input.startsAt, endsAt: input.endsAt } });
    return response.data;
  } catch (e) {
    throw toApiError(e);
  }
};

export const removeClosure = async (id: string): Promise<unknown> => {
  try {
    const response = await API.DELETE({ URL: `/food/vendor/closures/${enc(id)}` });
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

export const fetchVendorPaymentAccounts = async (): Promise<unknown> => {
  try {
    const response = await API.GET({ URL: '/food/vendor/payment-accounts' });
    return response.data;
  } catch (e) {
    throw toApiError(e);
  }
};
export const createVendorPaymentAccount = async (input: PaymentAccountInput): Promise<unknown> => {
  try {
    const response = await API.POST({ URL: '/food/vendor/payment-accounts', data: accountOut(input, true) });
    return response.data;
  } catch (e) {
    throw toApiError(e);
  }
};
export const updateVendorPaymentAccount = async (id: string, input: Partial<PaymentAccountInput>): Promise<unknown> => {
  try {
    const response = await API.PATCH({ URL: `/food/vendor/payment-accounts/${enc(id)}`, data: accountOut(input, false) });
    return response.data;
  } catch (e) {
    throw toApiError(e);
  }
};
export const deleteVendorPaymentAccount = async (id: string): Promise<unknown> => {
  try {
    const response = await API.DELETE({ URL: `/food/vendor/payment-accounts/${enc(id)}` });
    return response.data;
  } catch (e) {
    throw toApiError(e);
  }
};
