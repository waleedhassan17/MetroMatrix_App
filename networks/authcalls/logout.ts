// ═══════════════════════════════════════════════════════
// MetroMatrix — Auth calls: sign out (AUTH_CONTRACT.md)
// ═══════════════════════════════════════════════════════

import { API, AUTH_PATHS } from '../network/network';

/**
 * Best-effort server revocation. Takes the token explicitly because sign-out
 * clears storage FIRST (so the UI never waits on the network) — the
 * interceptor would otherwise post an anonymous request. No body: the API
 * revokes this device's whole session (refresh family included) from the
 * bearer, even an expired one. Never throws.
 */
export const logoutUser = async (accessToken: string | null): Promise<void> => {
  if (!accessToken) return;
  try {
    await API.POST({ URL: AUTH_PATHS.logout, timeout: 8000, headers: { Authorization: `Bearer ${accessToken}` } });
  } catch {
    // The session is already gone locally.
  }
};
