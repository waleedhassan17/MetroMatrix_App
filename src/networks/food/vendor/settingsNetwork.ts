// MetroMatrix — Food vendor: how the branch works — settings, opening hours,
// delivery fee bands, closures and the accounts customers transfer to.
// docs/API_FOOD.md §4.3: /food/vendor/settings, /hours, /fee-bands, /closures,
// /payment-accounts (the API names an account's fields accountTitle and
// accountNumber; the app's PaymentAccount says title and number).

import { api } from '../../network/apiHelpers';
import { closuresSerializer, feeBandsSerializer, hoursSerializer, vendorPaymentAccountSerializer, vendorPaymentAccountsSerializer, vendorSettingsSerializer, closureResponseSerializer } from '../../../serializers/food/vendorSerializer';
import type { FeeBand, HoursRange, VendorSettingsInput } from '../../../types/food';
import type { PaymentAccountInput } from '../../../types/payments';
import { ack, request } from '../../shopping/http';

const enc = encodeURIComponent;

export const getVendorSettings = () => request(() => api.get('/food/vendor/settings'), vendorSettingsSerializer);

export const updateVendorSettings = (input: VendorSettingsInput) =>
  request(() => api.patch('/food/vendor/settings', input), vendorSettingsSerializer);

export const getHours = () => request(() => api.get('/food/vendor/hours'), hoursSerializer);

/** Replaces the week. A range that closes before it opens runs past midnight. */
export const saveHours = (ranges: Pick<HoursRange, 'weekday' | 'opensAt' | 'closesAt'>[]) =>
  request(
    () => api.put('/food/vendor/hours', ranges.map(r => ({ weekday: r.weekday, opensAt: r.opensAt, closesAt: r.closesAt }))),
    hoursSerializer,
  );

export const getFeeBands = () => request(() => api.get('/food/vendor/fee-bands'), feeBandsSerializer);

/** From 0 km, back to back, at most 6. */
export const saveFeeBands = (bands: FeeBand[]) => request(() => api.put('/food/vendor/fee-bands', bands), feeBandsSerializer);

export const getClosures = () => request(() => api.get('/food/vendor/closures'), closuresSerializer);

export const addClosure = (input: { startsAt: string; endsAt: string; reason: string | null }) =>
  request(
    () => api.post('/food/vendor/closures', input.reason ? input : { startsAt: input.startsAt, endsAt: input.endsAt }),
    closureResponseSerializer,
  );

export const removeClosure = (id: string) => request(() => api.delete(`/food/vendor/closures/${enc(id)}`), ack);

const accountOut = (input: Partial<PaymentAccountInput>, creating: boolean) =>
  creating
    ? { kind: input.kind, accountTitle: input.title, accountNumber: input.number, bankName: input.bankName ?? undefined, isActive: input.isActive }
    : // An account's kind and number can't change once saved (the API takes title, bank and on/off).
      { accountTitle: input.title, bankName: input.bankName ?? undefined, isActive: input.isActive };

export const listVendorPaymentAccounts = () => request(() => api.get('/food/vendor/payment-accounts'), vendorPaymentAccountsSerializer);
export const createVendorPaymentAccount = (input: PaymentAccountInput) =>
  request(() => api.post('/food/vendor/payment-accounts', accountOut(input, true)), vendorPaymentAccountSerializer);
export const updateVendorPaymentAccount = (id: string, input: Partial<PaymentAccountInput>) =>
  request(() => api.patch(`/food/vendor/payment-accounts/${enc(id)}`, accountOut(input, false)), vendorPaymentAccountSerializer);
export const deleteVendorPaymentAccount = (id: string) => request(() => api.delete(`/food/vendor/payment-accounts/${enc(id)}`), ack);
