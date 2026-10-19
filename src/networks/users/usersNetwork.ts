// ═══════════════════════════════════════════════════════
// MetroMatrix — Users Network
// ═══════════════════════════════════════════════════════
// TODO(API_AUTH): paths per docs/API_CONTRACT_ASSUMED.md.

import { api, unwrap, toAuthError, forMock } from '../network/apiHelpers';
import { userSerializer } from '../../serializers/authSerializer';
import type { Gender, User } from '../../types/auth';

export interface UpdateMePayload {
  name?: string;
  /** Canonical +92…; null clears it. */
  phone?: string | null;
  avatarUrl?: string | null;
}

/** The API calls the name `displayName`; the dummy API still reads `name`. */
export const updateMe = async ({ name, ...rest }: UpdateMePayload): Promise<User> => {
  try {
    const named = name === undefined ? {} : forMock<object>({ displayName: name.trim() }, { name });
    const response = await api.patch('/users/me', { ...rest, ...named });
    const body = unwrap(response);
    return userSerializer(body?.user ?? body);
  } catch (e) {
    throw toAuthError(e);
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
    throw toAuthError(e);
  }
};

export const registerDevice = async (token: string, platform: 'android' | 'ios' | 'web'): Promise<void> => {
  try {
    await api.post('/users/me/devices', { token, platform });
  } catch (e) {
    throw toAuthError(e);
  }
};

/**
 * Best-effort, during sign-out: storage is already cleared, so the caller
 * passes the access token it captured. Never throws.
 */
export const unregisterDevice = async (token: string, accessToken: string | null): Promise<void> => {
  try {
    await api.delete(`/users/me/devices/${encodeURIComponent(token)}`, {
      timeout: 8000,
      headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : undefined,
    });
  } catch {
    // A stale device row only costs the server one undelivered push.
  }
};
