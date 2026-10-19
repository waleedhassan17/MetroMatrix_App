// MetroMatrix — Food vendor: the brand (name, tagline, logo, cover, cuisines,
// price level, colour) and the kitchen's live switches (pause, busy).
// docs/API_FOOD.md §4.3 Profile: GET/PATCH /food/vendor/profile; POST /food/vendor/pause,
// /resume, /busy — each answers with the profile.

import { api } from '../../network/apiHelpers';
import { foodCuisinesSerializer, vendorProfileSerializer } from '../../../serializers/food/vendorSerializer';
import type { VendorProfileInput } from '../../../types/food';
import type { PauseReason } from '../../../types/kitchen';
import { clean, request } from '../../shopping/http';

export const getVendorProfile = () => request(() => api.get('/food/vendor/profile'), vendorProfileSerializer);

export const updateVendorProfile = (input: VendorProfileInput) =>
  request(() => api.patch('/food/vendor/profile', input), vendorProfileSerializer);

/**
 * Hidden from lists while paused; the vendor's own link shows the message.
 * `reason` (never shown to customers) and `resumeAt` (the pause lifts by
 * itself) are Kitchen Intelligence's additions (docs/API_KITCHEN_ASSUMED.md §5;
 * TODO(API_KITCHEN)).
 */
export const pauseOrders = (message: string | null, more: { reason?: PauseReason | null; resumeAt?: string | null } = {}) =>
  request(() => api.post('/food/vendor/pause', clean({ message, reason: more.reason, resumeAt: more.resumeAt })), vendorProfileSerializer);

export const resumeOrders = () => request(() => api.post('/food/vendor/resume'), vendorProfileSerializer);

/** Adds `extraMinutes` to every ETA until `until` (0 clears it). */
export const setBusy = (extraMinutes: number, until: string | null) =>
  request(() => api.post('/food/vendor/busy', until ? { extraMinutes, until } : { extraMinutes }), vendorProfileSerializer);

/** The cuisines a vendor can pick from (public reference list). */
export const getCuisines = () => request(() => api.get('/food/cuisines'), foodCuisinesSerializer);
