// ═══════════════════════════════════════════════════════
// MetroMatrix — Users Network (AUTH_CONTRACT.md)
// ═══════════════════════════════════════════════════════
// Paths and bodies per MetroMatrix_Backend users.controller.ts / docs/API_AUTH.md §4.2.

import { API, toApiError } from '../network/network';
import type { Gender } from '../../models/auth';

/** PATCH /users/me: the API's UpdateMeDto (models/authModel `updateMeBody` builds it). */
export interface UpdateMeBody {
  displayName?: string;
  /** Canonical +92…; null clears it. */
  phone?: string | null;
  avatarUrl?: string | null;
}

/** PATCH /users/me/profile: Complete Profile's three steps in one save. */
export interface CompleteProfileBody {
  /** ISO date, YYYY-MM-DD. */
  dateOfBirth: string;
  gender: Gender;
  streetAddress: string;
  city: string;
  postalCode?: string;
  avatarUrl?: string | null;
}

export type DevicePlatform = 'android' | 'ios' | 'web';

/** Answers the user. */
export const updateMe = async (body: UpdateMeBody): Promise<unknown> => {
  try {
    const response = await API.PATCH({ URL: '/users/me', data: body });
    return response.data;
  } catch (e) {
    throw toApiError(e);
  }
};

/** Marks the profile complete; answers `{ user }`. */
export const completeProfile = async (body: CompleteProfileBody): Promise<unknown> => {
  try {
    const response = await API.PATCH({ URL: '/users/me/profile', data: body });
    return response.data;
  } catch (e) {
    throw toApiError(e);
  }
};

/** Registers (or refreshes) this install's Expo push token. */
export const registerDevice = async (token: string, platform: DevicePlatform): Promise<unknown> => {
  try {
    const response = await API.PUT({ URL: '/users/me/devices', data: { expoPushToken: token, platform } });
    return response.data;
  } catch (e) {
    throw toApiError(e);
  }
};

/**
 * Answers `{ removed }` (false when it was already gone). Called during
 * sign-out, after storage is cleared, so the caller passes the access token
 * it captured.
 */
export const unregisterDevice = async (token: string, accessToken: string | null): Promise<unknown> => {
  try {
    const response = await API.DELETE({ URL: `/users/me/devices/${encodeURIComponent(token)}`, timeout: 8000, headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : undefined });
    return response.data;
  } catch (e) {
    throw toApiError(e);
  }
};
