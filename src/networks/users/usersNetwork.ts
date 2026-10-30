// ═══════════════════════════════════════════════════════
// MetroMatrix — Users Network
// ═══════════════════════════════════════════════════════
// Paths and bodies per MetroMatrix_Backend users.controller.ts / docs/API_AUTH.md §4.2.

import { api, unwrap, toApiError } from '../network/apiHelpers';
import { userSerializer } from '../../serializers/authSerializer';
import type { Gender, User } from '../../types/auth';

export interface UpdateMePayload {
  name?: string;
  /** Canonical +92…; null clears it. */
  phone?: string | null;
  avatarUrl?: string | null;
}

/** PATCH /users/me: the API calls the name `displayName`; answers the user. */
export const updateMe = async ({ name, ...rest }: UpdateMePayload): Promise<User> => {
  try {
    const named = name === undefined ? {} : { displayName: name.trim() };
    const response = await api.patch('/users/me', { ...rest, ...named });
    const body = unwrap(response);
    return userSerializer(body?.user ?? body);
  } catch (e) {
    throw toApiError(e);
  }
};

export interface CompleteProfilePayload {
  /** ISO date, YYYY-MM-DD. */
  dateOfBirth: string;
  gender: Gender;
  streetAddress: string;
  city: string;
  postalCode?: string;
  avatarUrl?: string | null;
}

/** CompleteProfile's three steps in one save; marks the profile complete. */
export const completeProfile = async (payload: CompleteProfilePayload): Promise<User> => {
  try {
    const response = await api.patch('/users/me/profile', payload);
    const body = unwrap(response);
    return userSerializer(body?.user ?? body);
  } catch (e) {
    throw toApiError(e);
  }
};

/** PUT /users/me/devices: register (or refresh) this install's Expo push token. */
export const registerDevice = async (token: string, platform: 'android' | 'ios' | 'web'): Promise<void> => {
  try {
    await api.put('/users/me/devices', { expoPushToken: token, platform });
  } catch (e) {
    throw toApiError(e);
  }
};

/**
 * DELETE /users/me/devices/:token → `{ removed }` (false when it was already
 * gone). Best-effort, during sign-out: storage is already cleared, so the
 * caller passes the access token it captured. Never throws.
 */
export const unregisterDevice = async (token: string, accessToken: string | null): Promise<boolean> => {
  try {
    const response = await api.delete(`/users/me/devices/${encodeURIComponent(token)}`, {
      timeout: 8000,
      headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : undefined,
    });
    return unwrap(response)?.removed === true;
  } catch {
    // A stale device row only costs the server one undelivered push.
    return false;
  }
};
