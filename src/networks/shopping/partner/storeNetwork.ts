// MetroMatrix — Store partner: Today summary, profile, settings, pause, payment accounts.
// TODO(API_SHOPPING): paths per docs/API_SHOPPING_ASSUMED.md.

import { api } from '../../network/apiHelpers';
import { compact } from '../../../serializers/shopping/common';
import {
  partnerSummarySerializer,
  paymentAccountSerializer,
  storeProfileSerializer,
  storeSettingsSerializer,
} from '../../../serializers/shopping/partnerSerializer';
import { arr } from '../../../serializers/serializerUtils';
import type { PaymentAccountInput, StoreProfileInput, StoreSettings } from '../../../types/shopping';
import { ack, request } from '../http';

const BASE = '/partner/shop';

export const getPartnerSummary = () => request(() => api.get(`${BASE}/summary`), partnerSummarySerializer);

export const getStoreProfile = () => request(() => api.get(`${BASE}/store`), storeProfileSerializer);
export const updateStoreProfile = (input: StoreProfileInput) =>
  request(() => api.patch(`${BASE}/store`, input), storeProfileSerializer);

export const getStoreSettings = () => request(() => api.get(`${BASE}/store/settings`), storeSettingsSerializer);
export const updateStoreSettings = (input: StoreSettings) =>
  request(() => api.patch(`${BASE}/store/settings`, input), storeSettingsSerializer);

export const pauseStore = (message: string) =>
  request(() => api.post(`${BASE}/store/pause`, { message }), storeSettingsSerializer);
export const resumeStore = () => request(() => api.post(`${BASE}/store/resume`), storeSettingsSerializer);

export const listPaymentAccounts = () =>
  request(() => api.get(`${BASE}/payment-accounts`), raw => compact(arr(raw).map(paymentAccountSerializer)));
export const createPaymentAccount = (input: PaymentAccountInput) =>
  request(() => api.post(`${BASE}/payment-accounts`, input), paymentAccountSerializer);
export const updatePaymentAccount = (id: string, input: PaymentAccountInput) =>
  request(() => api.patch(`${BASE}/payment-accounts/${encodeURIComponent(id)}`, input), paymentAccountSerializer);
export const deletePaymentAccount = (id: string) =>
  request(() => api.delete(`${BASE}/payment-accounts/${encodeURIComponent(id)}`), ack);
