// ═══════════════════════════════════════════════════════
// MetroMatrix — Tiffin Network (docs/API_KITCHEN.md §19)
// ═══════════════════════════════════════════════════════
// The kitchen's plans and subscribers; a customer's plans, subscriptions,
// month and skips. Subscriptions go by id. The app's weekdays are ISO (1
// Monday … 7 Sunday); the API's are 0 Sunday … 6 Saturday.

import { API, toApiError, clean } from '../network/network';
import type { TiffinPayMethod, TiffinPlanInput } from '../../models/kitchen';

const enc = encodeURIComponent;

/** ISO weekday → the API's (Sunday is 0). */
export const apiWeekday = (d: number) => d % 7;

const PAY: Record<TiffinPayMethod, string> = { cash: 'cash_weekly', transfer: 'transfer_per_period' };

/** The app's statuses → the API's (a request not yet approved is `requested`). */
const STATUS: Record<string, string> = { pending: 'requested', active: 'active', paused: 'paused', ended: 'ended', cancelled: 'cancelled', declined: 'declined' };

/** The plan form → the API's whole plan (a PUT replaces it). */
const planBody = (input: TiffinPlanInput) => ({
  name: input.name.trim(),
  ...(input.description?.trim() ? { description: input.description.trim() } : {}),
  meal: input.meal,
  days: input.days.map(apiWeekday),
  period: input.period === 'month' ? 'monthly' : 'weekly',
  pricePerPeriod: input.price,
  deliveryMode: input.mode,
  deliveryWindowFrom: input.window.from,
  deliveryWindowTo: input.window.to,
  capacity: input.capacity,
  skipCutoffHour: input.skipCutoffHour,
  rotation: input.rotation.map(r => clean({ weekday: apiWeekday(r.weekday), menuItemIds: r.itemIds, note: r.note?.trim() })),
  ...(input.photoUrl !== undefined ? { photoUrl: input.photoUrl } : {}),
  ...(input.isActive !== undefined ? { isActive: input.isActive } : {}),
});

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
    const response = await API.POST({ URL: '/food/vendor/tiffin/plans', data: planBody(input) });
    return response.data;
  } catch (e) {
    throw toApiError(e);
  }
};

/** The whole plan (taking it off the shelf is `isActive: false`). */
export const updateTiffinPlan = async (id: string, input: TiffinPlanInput): Promise<unknown> => {
  try {
    const response = await API.PUT({ URL: `/food/vendor/tiffin/plans/${enc(id)}`, data: planBody(input) });
    return response.data;
  } catch (e) {
    throw toApiError(e);
  }
};

/** One plan's subscribers, or every subscription in a state. */
export const fetchTiffinSubscriptions = async (q: { status?: string; planId?: string } = {}): Promise<unknown> => {
  try {
    const response = await API.GET({ URL: '/food/vendor/tiffin/subscriptions', params: clean({ status: q.status ? STATUS[q.status] : undefined, planId: q.planId }) });
    return response.data;
  } catch (e) {
    throw toApiError(e);
  }
};

export type SubscriberMove = { kind: 'approve' } | { kind: 'decline'; reason: string } | { kind: 'pause'; until: string } | { kind: 'resume' } | { kind: 'end'; reason: string };

export const moveSubscriber = async (id: string, kind: SubscriberMove['kind'], body: Record<string, unknown>): Promise<unknown> => {
  try {
    const response = await API.POST({ URL: `/food/vendor/tiffin/subscriptions/${enc(id)}/${kind}`, data: clean(body) });
    return response.data;
  } catch (e) {
    throw toApiError(e);
  }
};

/** The current period's transfer reached the kitchen: paid. */
export const confirmTiffinPayment = async (subscriptionId: string): Promise<unknown> => {
  try {
    const response = await API.POST({ URL: `/food/vendor/tiffin/subscriptions/${enc(subscriptionId)}/payment/confirm` });
    return response.data;
  } catch (e) {
    throw toApiError(e);
  }
};

export const rejectTiffinPayment = async (subscriptionId: string, reason: string): Promise<unknown> => {
  try {
    const response = await API.POST({ URL: `/food/vendor/tiffin/subscriptions/${enc(subscriptionId)}/payment/reject`, data: { reason: reason.trim() } });
    return response.data;
  } catch (e) {
    throw toApiError(e);
  }
};

/** Meals per plan for a day (default tomorrow), the skips, what to cook, the cut-off. */
export const fetchTiffinTomorrow = async (date?: string): Promise<unknown> => {
  try {
    const response = await API.GET({ URL: '/food/vendor/tiffin/tomorrow', params: clean({ date }) });
    return response.data;
  } catch (e) {
    throw toApiError(e);
  }
};

// ── Customers ──
/** A kitchen's active plans (its id or slug). */
export const fetchTiffinPlans = async (vendor: string): Promise<unknown> => {
  try {
    const response = await API.GET({ URL: `/food/vendors/${enc(vendor)}/tiffin-plans` });
    return response.data;
  } catch (e) {
    throw toApiError(e);
  }
};

/** One plan's page, with its kitchen. */
export const fetchTiffinPlan = async (id: string): Promise<unknown> => {
  try {
    const response = await API.GET({ URL: `/food/tiffin/plans/${enc(id)}` });
    return response.data;
  } catch (e) {
    throw toApiError(e);
  }
};

/** With an address it is delivered; without one, picked up. */
export const subscribeTiffin = async (
  planId: string,
  input: { startDate: string; addressId?: string | null; paymentMethod: TiffinPayMethod },
  idempotencyKey: string,
): Promise<unknown> => {
  try {
    const data = clean({ planId, startsOn: input.startDate, paymentMethod: PAY[input.paymentMethod], fulfilment: input.addressId ? 'delivery' : 'pickup', addressId: input.addressId });
    const response = await API.POST({ URL: '/food/tiffin/subscribe', data, headers: { 'Idempotency-Key': idempotencyKey } });
    return response.data;
  } catch (e) {
    throw toApiError(e);
  }
};

/** Every subscription, each with its plan, kitchen and what can be done now. */
export const fetchMyTiffins = async (): Promise<unknown> => {
  try {
    const response = await API.GET({ URL: '/food/tiffin/subscriptions' });
    return response.data;
  } catch (e) {
    throw toApiError(e);
  }
};

/** `month` is YYYY-MM. */
export const fetchTiffinCalendar = async (id: string, month: string): Promise<unknown> => {
  try {
    const response = await API.GET({ URL: `/food/tiffin/subscriptions/${enc(id)}/calendar`, params: { month } });
    return response.data;
  } catch (e) {
    throw toApiError(e);
  }
};

/** Before the day's cut-off (409 TIFFIN_SKIP_CUTOFF_PASSED after it). */
export const skipTiffinDay = async (id: string, date: string, skip: boolean): Promise<unknown> => {
  try {
    const response = await API.POST({ URL: `/food/tiffin/subscriptions/${enc(id)}/${skip ? 'skip' : 'unskip'}`, data: { date } });
    return response.data;
  } catch (e) {
    throw toApiError(e);
  }
};

/** Every served day up to `until` whose cut-off is still open becomes a skip. */
export const pauseMyTiffin = async (id: string, until: string): Promise<unknown> => {
  try {
    const response = await API.POST({ URL: `/food/tiffin/subscriptions/${enc(id)}/pause`, data: { until } });
    return response.data;
  } catch (e) {
    throw toApiError(e);
  }
};

export const resumeMyTiffin = async (id: string): Promise<unknown> => {
  try {
    const response = await API.POST({ URL: `/food/tiffin/subscriptions/${enc(id)}/resume` });
    return response.data;
  } catch (e) {
    throw toApiError(e);
  }
};

export const cancelMyTiffin = async (id: string): Promise<unknown> => {
  try {
    const response = await API.POST({ URL: `/food/tiffin/subscriptions/${enc(id)}/cancel` });
    return response.data;
  } catch (e) {
    throw toApiError(e);
  }
};

/** The current period's transfer receipt (a payment_proof upload of yours). */
export const submitTiffinProof = async (subscriptionId: string, input: { transactionId: string; imageUrl: string | null; publicId?: string | null }): Promise<unknown> => {
  try {
    const data = clean({ proofUrl: input.imageUrl, publicId: input.publicId, ref: input.transactionId.trim() });
    const response = await API.POST({ URL: `/food/tiffin/subscriptions/${enc(subscriptionId)}/payment-proof`, data });
    return response.data;
  } catch (e) {
    throw toApiError(e);
  }
};
