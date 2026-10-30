// ═══════════════════════════════════════════════════════
// MetroMatrix — Food Growth Tiffin Network (API_KITCHEN_ASSUMED.md)
// ═══════════════════════════════════════════════════════
// Tiffin plans and subscriptions (the kitchen's and the customer's).
// docs/API_KITCHEN_ASSUMED.md §2.9, §3.9, §4.6 (TODO(API_KITCHEN): an assumed contract).

import { api, toApiError, clean } from '../network/apiHelpers';
import { tiffinSubscriptionSerializer } from '../../serializers/kitchen/growthSerializer';
import type { TiffinPayMethod, TiffinPlanInput } from '../../types/kitchen';

const enc = encodeURIComponent;

// ── The kitchen ──
export const getMyTiffinPlansAPI = async (): Promise<unknown> => {
  try {
    const response = await api.get('/food/vendor/tiffin/plans');
    return response.data;
  } catch (e) {
    throw toApiError(e);
  }
};

export const getMyTiffinPlanAPI = async (id: string): Promise<unknown> => {
  try {
    const response = await api.get(`/food/vendor/tiffin/plans/${enc(id)}`);
    return response.data;
  } catch (e) {
    throw toApiError(e);
  }
};

export const createTiffinPlanAPI = async (input: TiffinPlanInput): Promise<unknown> => {
  try {
    const response = await api.post('/food/vendor/tiffin/plans', input);
    return response.data;
  } catch (e) {
    throw toApiError(e);
  }
};

export const updateTiffinPlanAPI = async (id: string, patch: Partial<TiffinPlanInput>): Promise<unknown> => {
  try {
    const response = await api.patch(`/food/vendor/tiffin/plans/${enc(id)}`, patch);
    return response.data;
  } catch (e) {
    throw toApiError(e);
  }
};

/** Removed outright, or (once it has had subscribers) taken off. */
export const deleteTiffinPlanAPI = async (id: string): Promise<unknown> => {
  try {
    const response = await api.delete(`/food/vendor/tiffin/plans/${enc(id)}`);
    return response.data;
  } catch (e) {
    throw toApiError(e);
  }
};

export const getPlanSubscribersAPI = async (planId: string): Promise<unknown> => {
  try {
    const response = await api.get(`/food/vendor/tiffin/plans/${enc(planId)}/subscribers`);
    return response.data;
  } catch (e) {
    throw toApiError(e);
  }
};

export const getTiffinSubscriptionsAPI = async (status?: 'pending' | 'active' | 'paused' | 'ended'): Promise<unknown> => {
  try {
    const response = await api.get('/food/vendor/tiffin/subscriptions', { params: clean({ status }) });
    return response.data;
  } catch (e) {
    throw toApiError(e);
  }
};

export type SubscriberMove = { kind: 'approve' } | { kind: 'decline'; reason: string } | { kind: 'pause'; until?: string | null } | { kind: 'resume' } | { kind: 'end'; reason?: string };

/** approve · decline · pause · resume · end: the move's kind is the path, its other fields the body. */
export const moveSubscriberAPI = async (code: string, kind: SubscriberMove['kind'], body: Record<string, unknown>): Promise<unknown> => {
  try {
    const response = await api.post(`/food/vendor/tiffin/subscriptions/${enc(code)}/${kind}`, clean(body));
    return response.data;
  } catch (e) {
    throw toApiError(e);
  }
};

export const confirmTiffinPaymentAPI = async (periodId: string): Promise<unknown> => {
  try {
    const response = await api.post(`/food/vendor/tiffin/periods/${enc(periodId)}/payment/confirm`);
    return response.data;
  } catch (e) {
    throw toApiError(e);
  }
};

export const rejectTiffinPaymentAPI = async (periodId: string, reason: string): Promise<unknown> => {
  try {
    const response = await api.post(`/food/vendor/tiffin/periods/${enc(periodId)}/payment/reject`, { reason: reason.trim() });
    return response.data;
  } catch (e) {
    throw toApiError(e);
  }
};

export const getTiffinTomorrowAPI = async (): Promise<unknown> => {
  try {
    const response = await api.get('/food/vendor/tiffin/tomorrow');
    return response.data;
  } catch (e) {
    throw toApiError(e);
  }
};

// ── Customers ──
/** `vendor`: the kitchen's brand id or slug. */
export const getTiffinPlansAPI = async (vendor?: string): Promise<unknown> => {
  try {
    const response = await api.get('/food/tiffin/plans', { params: clean({ vendor }) });
    return response.data;
  } catch (e) {
    throw toApiError(e);
  }
};

/** Plans whose kitchen reaches the point, nearest first (the Food home's "Home-cooked tiffins"). */
export const getTiffinPlansNearAPI = async (point: { lat: number; lng: number }): Promise<unknown> => {
  try {
    const response = await api.get('/food/tiffin/plans', { params: point });
    return response.data;
  } catch (e) {
    throw toApiError(e);
  }
};

export const getTiffinPlanAPI = async (id: string): Promise<unknown> => {
  try {
    const response = await api.get(`/food/tiffin/plans/${enc(id)}`);
    return response.data;
  } catch (e) {
    throw toApiError(e);
  }
};

/** `idempotencyKey`: one per attempt, reused for its retries — a retry never subscribes twice. */
export const subscribeTiffinAPI = async (planId: string, input: { startDate: string; addressId?: string | null; paymentMethod: TiffinPayMethod }, idempotencyKey: string): Promise<unknown> => {
  try {
    const response = await api.post(`/food/tiffin/plans/${enc(planId)}/subscribe`, clean(input), { headers: { 'Idempotency-Key': idempotencyKey } });
    return response.data;
  } catch (e) {
    throw toApiError(e);
  }
};

export const getMyTiffinsAPI = async (): Promise<unknown> => {
  try {
    const response = await api.get('/food/tiffin/subscriptions');
    return response.data;
  } catch (e) {
    throw toApiError(e);
  }
};

export const getMyTiffinAPI = async (code: string): Promise<unknown> => {
  try {
    const response = await api.get(`/food/tiffin/subscriptions/${enc(code)}`);
    return response.data;
  } catch (e) {
    throw toApiError(e);
  }
};

export const getTiffinCalendarAPI = async (code: string, month: string): Promise<unknown> => {
  try {
    const response = await api.get(`/food/tiffin/subscriptions/${enc(code)}/calendar`, { params: { month } });
    return response.data;
  } catch (e) {
    throw toApiError(e);
  }
};

export const skipTiffinDayAPI = async (code: string, date: string, skip: boolean): Promise<unknown> => {
  try {
    const response = await api.post(`/food/tiffin/subscriptions/${enc(code)}/days/${enc(date)}/${skip ? 'skip' : 'unskip'}`);
    return response.data;
  } catch (e) {
    throw toApiError(e);
  }
};

export const pauseMyTiffinAPI = async (code: string, until: string | null): Promise<unknown> => {
  try {
    const response = await api.post(`/food/tiffin/subscriptions/${enc(code)}/pause`, { until });
    return response.data;
  } catch (e) {
    throw toApiError(e);
  }
};

export const resumeMyTiffinAPI = async (code: string): Promise<unknown> => {
  try {
    const response = await api.post(`/food/tiffin/subscriptions/${enc(code)}/resume`);
    return response.data;
  } catch (e) {
    throw toApiError(e);
  }
};

export const cancelMyTiffinAPI = async (code: string): Promise<unknown> => {
  try {
    const response = await api.post(`/food/tiffin/subscriptions/${enc(code)}/cancel`);
    return response.data;
  } catch (e) {
    throw toApiError(e);
  }
};

export const submitTiffinProofAPI = async (periodId: string, input: { transactionId: string; imageUrl: string | null }): Promise<unknown> => {
  try {
    const response = await api.post(`/food/tiffin/periods/${enc(periodId)}/payment-proof`, input);
    return response.data;
  } catch (e) {
    throw toApiError(e);
  }
};
