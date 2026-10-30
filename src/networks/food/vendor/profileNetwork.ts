// ═══════════════════════════════════════════════════════
// MetroMatrix — Food Vendor Profile Network (API_FOOD.md)
// ═══════════════════════════════════════════════════════
// The brand (name, tagline, logo, cover, cuisines,
// price level, colour) and the kitchen's live switches (pause, busy).
// docs/API_FOOD.md §4.3 Profile: GET/PATCH /food/vendor/profile; POST /food/vendor/pause,
// /resume, /busy — each answers with the profile.

import { api, toApiError, clean } from '../../network/apiHelpers';
import type { VendorProfileInput } from '../../../types/food';
import type { PauseReason } from '../../../types/kitchen';

export const getVendorProfileAPI = async (): Promise<unknown> => {
  try {
    const response = await api.get('/food/vendor/profile');
    return response.data;
  } catch (e) {
    throw toApiError(e);
  }
};

export const updateVendorProfileAPI = async (input: VendorProfileInput): Promise<unknown> => {
  try {
    const response = await api.patch('/food/vendor/profile', input);
    return response.data;
  } catch (e) {
    throw toApiError(e);
  }
};

/**
 * Hidden from lists while paused; the vendor's own link shows the message.
 * `reason` (never shown to customers) and `resumeAt` (the pause lifts by
 * itself) are Kitchen Intelligence's additions (docs/API_KITCHEN_ASSUMED.md §5;
 * TODO(API_KITCHEN)).
 */
export const pauseOrdersAPI = async (message: string | null, more: { reason?: PauseReason | null; resumeAt?: string | null } = {}): Promise<unknown> => {
  try {
    const response = await api.post('/food/vendor/pause', clean({ message, reason: more.reason, resumeAt: more.resumeAt }));
    return response.data;
  } catch (e) {
    throw toApiError(e);
  }
};

export const resumeOrdersAPI = async (): Promise<unknown> => {
  try {
    const response = await api.post('/food/vendor/resume');
    return response.data;
  } catch (e) {
    throw toApiError(e);
  }
};

/** Adds `extraMinutes` to every ETA until `until` (0 clears it). */
export const setBusyAPI = async (extraMinutes: number, until: string | null): Promise<unknown> => {
  try {
    const response = await api.post('/food/vendor/busy', until ? { extraMinutes, until } : { extraMinutes });
    return response.data;
  } catch (e) {
    throw toApiError(e);
  }
};

/** The cuisines a vendor can pick from (public reference list). */
export const getCuisinesAPI = async (): Promise<unknown> => {
  try {
    const response = await api.get('/food/cuisines');
    return response.data;
  } catch (e) {
    throw toApiError(e);
  }
};
