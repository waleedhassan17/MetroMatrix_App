// MetroMatrix — Food Court: catering ("Plan a dawat"), for customers and the kitchen.
// docs/API_KITCHEN_ASSUMED.md §2.10, §3.10, §4.6 (TODO(API_KITCHEN): an assumed contract).

import { api } from '../network/apiHelpers';
import { clean, request } from '../shopping/http';
import {
  cateringCalendarSerializer,
  cateringInboxSerializer,
  cateringRequestSerializer,
  cateringRequestsSerializer,
  cateringSettingsSerializer,
  cateringVendorSerializer,
} from '../../serializers/kitchen/growthSerializer';
import type { CateringRequestInput, CateringSettings, QuoteInput } from '../../types/kitchen';

const enc = encodeURIComponent;

// ── Customers ──
/** What a kitchen takes, and its menu to choose from (by brand id or slug). */
export const getCateringVendor = (vendor: string) => request(() => api.get(`/food/catering/vendors/${enc(vendor)}`), cateringVendorSerializer);

export const requestCatering = (input: CateringRequestInput) => request(() => api.post('/food/catering/requests', clean({ ...input })), cateringRequestSerializer);

export const listMyCatering = () => request(() => api.get('/food/catering/requests'), cateringRequestsSerializer);

export const getMyCatering = (code: string) => request(() => api.get(`/food/catering/requests/${enc(code)}`), cateringRequestSerializer);

export const acceptQuote = (code: string, version: number) => request(() => api.post(`/food/catering/requests/${enc(code)}/quotes/${version}/accept`), cateringRequestSerializer);

export const submitAdvanceProof = (code: string, input: { transactionId: string; imageUrl: string | null }) =>
  request(() => api.post(`/food/catering/requests/${enc(code)}/advance-proof`, input), cateringRequestSerializer);

export const cancelMyCatering = (code: string, reason?: string) => request(() => api.post(`/food/catering/requests/${enc(code)}/cancel`, clean({ reason })), cateringRequestSerializer);

// ── The kitchen ──
export const getCateringSettings = () => request(() => api.get('/food/vendor/catering/settings'), cateringSettingsSerializer);

export const updateCateringSettings = (patch: Partial<CateringSettings>) => request(() => api.patch('/food/vendor/catering/settings', patch), cateringSettingsSerializer);

export const listCateringRequests = (status?: 'new' | 'quoted' | 'confirmed' | 'past') =>
  request(() => api.get('/food/vendor/catering/requests', { params: clean({ status }) }), cateringInboxSerializer);

export const getCateringRequest = (code: string) => request(() => api.get(`/food/vendor/catering/requests/${enc(code)}`), cateringRequestSerializer);

export const sendQuote = (code: string, input: QuoteInput) => request(() => api.post(`/food/vendor/catering/requests/${enc(code)}/quotes`, input), cateringRequestSerializer);

export const declineCatering = (code: string, reason: string) =>
  request(() => api.post(`/food/vendor/catering/requests/${enc(code)}/decline`, { reason: reason.trim() }), cateringRequestSerializer);

export const confirmAdvance = (code: string) => request(() => api.post(`/food/vendor/catering/requests/${enc(code)}/advance/confirm`), cateringRequestSerializer);

export const rejectAdvance = (code: string, reason: string) =>
  request(() => api.post(`/food/vendor/catering/requests/${enc(code)}/advance/reject`, { reason: reason.trim() }), cateringRequestSerializer);

export const getCateringCalendar = (month: string) => request(() => api.get('/food/vendor/catering/calendar', { params: { month } }), cateringCalendarSerializer);
