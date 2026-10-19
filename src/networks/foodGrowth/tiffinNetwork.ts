// MetroMatrix — Food Court: tiffin plans and subscriptions (the kitchen's and the customer's).
// docs/API_KITCHEN_ASSUMED.md §2.9, §3.9, §4.6 (TODO(API_KITCHEN): an assumed contract).

import { api } from '../network/apiHelpers';
import { clean, request } from '../shopping/http';
import {
  tiffinCalendarSerializer,
  tiffinDaySerializer,
  tiffinInboxSerializer,
  tiffinPlanSerializer,
  tiffinPlansSerializer,
  tiffinSubscriptionSerializer,
  tiffinSubscriptionsSerializer,
  tiffinTomorrowSerializer,
} from '../../serializers/kitchen/growthSerializer';
import type { TiffinPayMethod, TiffinPlanInput } from '../../types/kitchen';

const enc = encodeURIComponent;

// ── The kitchen ──
export const listMyTiffinPlans = () => request(() => api.get('/food/vendor/tiffin/plans'), tiffinPlansSerializer);

export const getMyTiffinPlan = (id: string) => request(() => api.get(`/food/vendor/tiffin/plans/${enc(id)}`), tiffinPlanSerializer);

export const createTiffinPlan = (input: TiffinPlanInput) => request(() => api.post('/food/vendor/tiffin/plans', input), tiffinPlanSerializer);

export const updateTiffinPlan = (id: string, patch: Partial<TiffinPlanInput>) => request(() => api.patch(`/food/vendor/tiffin/plans/${enc(id)}`, patch), tiffinPlanSerializer);

/** Removed outright, or (once it has had subscribers) taken off. */
export const deleteTiffinPlan = (id: string) =>
  request(() => api.delete(`/food/vendor/tiffin/plans/${enc(id)}`), raw => ({ removed: !!(raw as { removed?: boolean })?.removed }));

export const listPlanSubscribers = (planId: string) => request(() => api.get(`/food/vendor/tiffin/plans/${enc(planId)}/subscribers`), tiffinInboxSerializer);

export const listTiffinSubscriptions = (status?: 'pending' | 'active' | 'paused' | 'ended') =>
  request(() => api.get('/food/vendor/tiffin/subscriptions', { params: clean({ status }) }), tiffinInboxSerializer);

export type SubscriberMove = { kind: 'approve' } | { kind: 'decline'; reason: string } | { kind: 'pause'; until?: string | null } | { kind: 'resume' } | { kind: 'end'; reason?: string };

export const moveSubscriber = (code: string, m: SubscriberMove) => {
  const { kind, ...body } = m;
  return request(() => api.post(`/food/vendor/tiffin/subscriptions/${enc(code)}/${kind}`, clean(body)), tiffinSubscriptionSerializer);
};

export const confirmTiffinPayment = (periodId: string) => request(() => api.post(`/food/vendor/tiffin/periods/${enc(periodId)}/payment/confirm`), tiffinSubscriptionSerializer);

export const rejectTiffinPayment = (periodId: string, reason: string) =>
  request(() => api.post(`/food/vendor/tiffin/periods/${enc(periodId)}/payment/reject`, { reason: reason.trim() }), tiffinSubscriptionSerializer);

export const getTiffinTomorrow = () => request(() => api.get('/food/vendor/tiffin/tomorrow'), tiffinTomorrowSerializer);

// ── Customers ──
/** `vendor`: the kitchen's brand id or slug. */
export const listTiffinPlans = (vendor?: string) => request(() => api.get('/food/tiffin/plans', { params: clean({ vendor }) }), tiffinPlansSerializer);

export const getTiffinPlan = (id: string) => request(() => api.get(`/food/tiffin/plans/${enc(id)}`), tiffinPlanSerializer);

/** `idempotencyKey`: one per attempt, reused for its retries — a retry never subscribes twice. */
export const subscribeTiffin = (planId: string, input: { startDate: string; addressId?: string | null; paymentMethod: TiffinPayMethod }, idempotencyKey: string) =>
  request(() => api.post(`/food/tiffin/plans/${enc(planId)}/subscribe`, clean(input), { headers: { 'Idempotency-Key': idempotencyKey } }), tiffinSubscriptionSerializer);

export const listMyTiffins = () => request(() => api.get('/food/tiffin/subscriptions'), tiffinSubscriptionsSerializer);

export const getMyTiffin = (code: string) => request(() => api.get(`/food/tiffin/subscriptions/${enc(code)}`), tiffinSubscriptionSerializer);

export const getTiffinCalendar = (code: string, month: string) =>
  request(() => api.get(`/food/tiffin/subscriptions/${enc(code)}/calendar`, { params: { month } }), tiffinCalendarSerializer);

export const skipTiffinDay = (code: string, date: string, skip: boolean) =>
  request(() => api.post(`/food/tiffin/subscriptions/${enc(code)}/days/${enc(date)}/${skip ? 'skip' : 'unskip'}`), tiffinDaySerializer);

export const pauseMyTiffin = (code: string, until: string | null) => request(() => api.post(`/food/tiffin/subscriptions/${enc(code)}/pause`, { until }), tiffinSubscriptionSerializer);

export const resumeMyTiffin = (code: string) => request(() => api.post(`/food/tiffin/subscriptions/${enc(code)}/resume`), tiffinSubscriptionSerializer);

export const cancelMyTiffin = (code: string) => request(() => api.post(`/food/tiffin/subscriptions/${enc(code)}/cancel`), tiffinSubscriptionSerializer);

export const submitTiffinProof = (periodId: string, input: { transactionId: string; imageUrl: string | null }) =>
  request(() => api.post(`/food/tiffin/periods/${enc(periodId)}/payment-proof`, input), tiffinSubscriptionSerializer);
