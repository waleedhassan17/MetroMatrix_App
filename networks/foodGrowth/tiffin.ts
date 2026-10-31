// ═══════════════════════════════════════════════════════
// MetroMatrix — Food Growth Tiffin Network (API_KITCHEN_ASSUMED.md)
// ═══════════════════════════════════════════════════════
// Tiffin plans and subscriptions (the kitchen's and the customer's).
// docs/API_KITCHEN_ASSUMED.md §2.9, §3.9, §4.6 (TODO(API_KITCHEN): an assumed contract).

import { API, toApiError, clean } from '../network/network';
import type { TiffinPayMethod, TiffinPlanInput } from '../../models/kitchen';

const enc = encodeURIComponent;

// ── The kitchen ──
export const fetchMyTiffinPlans = async (): Promise<unknown> => {
  try {
    const response = await API.GET({ URL: '/food/vendor/tiffin/plans' });
    return response.data;
  } catch (e) {
    throw toApiError(e);
  }
};

export const fetchMyTiffinPlan = async (id: string): Promise<unknown> => {
  try {
    const response = await API.GET({ URL: `/food/vendor/tiffin/plans/${enc(id)}` });
    return response.data;
  } catch (e) {
    throw toApiError(e);
  }
};

export const createTiffinPlan = async (input: TiffinPlanInput): Promise<unknown> => {
  try {
    const response = await API.POST({ URL: '/food/vendor/tiffin/plans', data: input });
    return response.data;
  } catch (e) {
    throw toApiError(e);
  }
};

export const updateTiffinPlan = async (id: string, patch: Partial<TiffinPlanInput>): Promise<unknown> => {
  try {
    const response = await API.PATCH({ URL: `/food/vendor/tiffin/plans/${enc(id)}`, data: patch });
    return response.data;
  } catch (e) {
    throw toApiError(e);
  }
};

/** Removed outright, or (once it has had subscribers) taken off. */
export const deleteTiffinPlan = async (id: string): Promise<unknown> => {
  try {
    const response = await API.DELETE({ URL: `/food/vendor/tiffin/plans/${enc(id)}` });
    return response.data;
  } catch (e) {
    throw toApiError(e);
  }
};

export const fetchPlanSubscribers = async (planId: string): Promise<unknown> => {
  try {
    const response = await API.GET({ URL: `/food/vendor/tiffin/plans/${enc(planId)}/subscribers` });
    return response.data;
  } catch (e) {
    throw toApiError(e);
  }
};

export const fetchTiffinSubscriptions = async (status?: 'pending' | 'active' | 'paused' | 'ended'): Promise<unknown> => {
  try {
    const response = await API.GET({ URL: '/food/vendor/tiffin/subscriptions', params: clean({ status }) });
    return response.data;
  } catch (e) {
    throw toApiError(e);
  }
};

export type SubscriberMove = { kind: 'approve' } | { kind: 'decline'; reason: string } | { kind: 'pause'; until?: string | null } | { kind: 'resume' } | { kind: 'end'; reason?: string };

/** approve · decline · pause · resume · end: the move's kind is the path, its other fields the body. */
export const moveSubscriber = async (code: string, kind: SubscriberMove['kind'], body: Record<string, unknown>): Promise<unknown> => {
  try {
    const response = await API.POST({ URL: `/food/vendor/tiffin/subscriptions/${enc(code)}/${kind}`, data: clean(body) });
    return response.data;
  } catch (e) {
    throw toApiError(e);
  }
};

export const confirmTiffinPayment = async (periodId: string): Promise<unknown> => {
  try {
    const response = await API.POST({ URL: `/food/vendor/tiffin/periods/${enc(periodId)}/payment/confirm` });
    return response.data;
  } catch (e) {
    throw toApiError(e);
  }
};

export const rejectTiffinPayment = async (periodId: string, reason: string): Promise<unknown> => {
  try {
    const response = await API.POST({ URL: `/food/vendor/tiffin/periods/${enc(periodId)}/payment/reject`, data: { reason: reason.trim() } });
    return response.data;
  } catch (e) {
    throw toApiError(e);
  }
};

export const fetchTiffinTomorrow = async (): Promise<unknown> => {
  try {
    const response = await API.GET({ URL: '/food/vendor/tiffin/tomorrow' });
    return response.data;
  } catch (e) {
    throw toApiError(e);
  }
};

// ── Customers ──
/** `vendor`: the kitchen's brand id or slug. */
export const fetchTiffinPlans = async (vendor?: string): Promise<unknown> => {
  try {
    const response = await API.GET({ URL: '/food/tiffin/plans', params: clean({ vendor }) });
    return response.data;
  } catch (e) {
    throw toApiError(e);
  }
};

/** Plans whose kitchen reaches the point, nearest first (the Food home's "Home-cooked tiffins"). */
export const fetchTiffinPlansNear = async (point: { lat: number; lng: number }): Promise<unknown> => {
  try {
    const response = await API.GET({ URL: '/food/tiffin/plans', params: point });
    return response.data;
  } catch (e) {
    throw toApiError(e);
  }
};

export const fetchTiffinPlan = async (id: string): Promise<unknown> => {
  try {
    const response = await API.GET({ URL: `/food/tiffin/plans/${enc(id)}` });
    return response.data;
  } catch (e) {
    throw toApiError(e);
  }
};

/** `idempotencyKey`: one per attempt, reused for its retries — a retry never subscribes twice. */
export const subscribeTiffin = async (planId: string, input: { startDate: string; addressId?: string | null; paymentMethod: TiffinPayMethod }, idempotencyKey: string): Promise<unknown> => {
  try {
    const response = await API.POST({ URL: `/food/tiffin/plans/${enc(planId)}/subscribe`, data: clean(input), headers: { 'Idempotency-Key': idempotencyKey } });
    return response.data;
  } catch (e) {
    throw toApiError(e);
  }
};

export const fetchMyTiffins = async (): Promise<unknown> => {
  try {
    const response = await API.GET({ URL: '/food/tiffin/subscriptions' });
    return response.data;
  } catch (e) {
    throw toApiError(e);
  }
};

export const fetchMyTiffin = async (code: string): Promise<unknown> => {
  try {
    const response = await API.GET({ URL: `/food/tiffin/subscriptions/${enc(code)}` });
    return response.data;
  } catch (e) {
    throw toApiError(e);
  }
};

export const fetchTiffinCalendar = async (code: string, month: string): Promise<unknown> => {
  try {
    const response = await API.GET({ URL: `/food/tiffin/subscriptions/${enc(code)}/calendar`, params: { month } });
    return response.data;
  } catch (e) {
    throw toApiError(e);
  }
};

export const skipTiffinDay = async (code: string, date: string, skip: boolean): Promise<unknown> => {
  try {
    const response = await API.POST({ URL: `/food/tiffin/subscriptions/${enc(code)}/days/${enc(date)}/${skip ? 'skip' : 'unskip'}` });
    return response.data;
  } catch (e) {
    throw toApiError(e);
  }
};

export const pauseMyTiffin = async (code: string, until: string | null): Promise<unknown> => {
  try {
    const response = await API.POST({ URL: `/food/tiffin/subscriptions/${enc(code)}/pause`, data: { until } });
    return response.data;
  } catch (e) {
    throw toApiError(e);
  }
};

export const resumeMyTiffin = async (code: string): Promise<unknown> => {
  try {
    const response = await API.POST({ URL: `/food/tiffin/subscriptions/${enc(code)}/resume` });
    return response.data;
  } catch (e) {
    throw toApiError(e);
  }
};

export const cancelMyTiffin = async (code: string): Promise<unknown> => {
  try {
    const response = await API.POST({ URL: `/food/tiffin/subscriptions/${enc(code)}/cancel` });
    return response.data;
  } catch (e) {
    throw toApiError(e);
  }
};

export const submitTiffinProof = async (periodId: string, input: { transactionId: string; imageUrl: string | null }): Promise<unknown> => {
  try {
    const response = await API.POST({ URL: `/food/tiffin/periods/${enc(periodId)}/payment-proof`, data: input });
    return response.data;
  } catch (e) {
    throw toApiError(e);
  }
};
