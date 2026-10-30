// ═══════════════════════════════════════════════════════
// MetroMatrix — When does a session end?
// ═══════════════════════════════════════════════════════
// Only when the server says so. A refresh that fails because the phone is
// offline, the API is restarting (5xx) or throttling (429) must not wipe a
// perfectly good session: the request fails, the tokens stay, and the next
// request tries again. FinMatrix's lesson: signing people out on a blip
// teaches them the app "forgets" them.
//
// Pure (no axios instance, no storage), so apiHelpers and the bootstrap
// share one rule and it is unit-tested on its own.

import axios from 'axios';
import { ERROR_CODES } from './errorCodes';

/** Set by refreshTokens when there is nothing to refresh with. */
export const NO_REFRESH_TOKEN = ERROR_CODES.NO_REFRESH_TOKEN;

/** 401 codes meaning "this session is over" (MetroMatrix_Backend docs/API_AUTH.md §3). */
const DEAD_SESSION_401 = new Set<string>([
  ERROR_CODES.REFRESH_INVALID,
  ERROR_CODES.REFRESH_REUSED,
  ERROR_CODES.TOKEN_REVOKED,
]);

const statusOf = (err: unknown): number | undefined => {
  if (axios.isAxiosError(err)) return err.response?.status;
  const s = (err as { status?: unknown } | null)?.status;
  return typeof s === 'number' ? s : undefined;
};

const codeOf = (err: unknown): string | undefined => {
  if (axios.isAxiosError(err)) {
    if (!err.response) return ERROR_CODES.NETWORK_ERROR;
    const data = err.response.data as { error?: { code?: string }; code?: string } | undefined;
    return data?.error?.code ?? data?.code;
  }
  const c = (err as { code?: unknown } | null)?.code;
  return typeof c === 'string' ? c : undefined;
};

/**
 * The failure ends the session (clear tokens, back to sign-in):
 *  - 401 REFRESH_INVALID, REFRESH_REUSED or TOKEN_REVOKED
 *  - 403 ACCOUNT_DISABLED
 *  - no refresh token stored
 */
export const isDefinitiveSessionFailure = (err: unknown): boolean => {
  const code = codeOf(err);
  if (code === NO_REFRESH_TOKEN) return true;
  const status = statusOf(err);
  if (status === 401 && code !== undefined && DEAD_SESSION_401.has(code)) return true;
  return status === 403 && code === ERROR_CODES.ACCOUNT_DISABLED;
};

/** Worth retrying later: offline, timed out, the server failing (5xx) or throttling (429). */
export const isTransient = (err: unknown): boolean => {
  if (codeOf(err) === ERROR_CODES.NETWORK_ERROR) return true;
  const status = statusOf(err);
  return status === 429 || (status !== undefined && status >= 500);
};

/** The code to tell the user why they were signed out (AppContainer's toast). */
export const sessionEndReason = (err: unknown): string => codeOf(err) ?? 'SESSION_ENDED';
