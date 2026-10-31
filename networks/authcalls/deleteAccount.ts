// ═══════════════════════════════════════════════════════
// MetroMatrix — Auth calls: delete the account (AUTH_CONTRACT.md)
// ═══════════════════════════════════════════════════════

import { API, clearTokens, toApiError } from '../network/network';

/**
 * Deletes the account server-side, then clears the local tokens.
 * `{ password }`, or for a Google-only account `{ idToken }` (a fresh one).
 */
export const deleteAccount = async (confirmation: { password: string } | { idToken: string }): Promise<void> => {
  try {
    await API.DELETE({ URL: '/auth/account', data: confirmation });
    await clearTokens();
  } catch (e) {
    throw toApiError(e);
  }
};
