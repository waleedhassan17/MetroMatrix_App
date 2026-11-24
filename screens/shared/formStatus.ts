// Shared shapes for screen slices that submit a form to the API.

import type { RejectedApiError } from '../../networks/network/network';

export type FormStatus = 'idle' | 'loading' | 'failed' | 'succeeded';

export interface ServerError {
  message: string;
  code: string | null;
  details: Record<string, any> | null;
}

export const NO_ERROR: ServerError = { message: '', code: null, details: null };

/** Reads the rejectWithValue payload a thunk produced via toRejectedValue(). */
export const readRejection = (
  action: { payload?: unknown; error: { message?: string } },
  fallback: string,
): ServerError => {
  const p = action.payload as RejectedApiError | undefined;
  return {
    message: p?.message || action.error.message || fallback,
    code: p?.code ?? null,
    details: (p?.details as Record<string, any> | undefined) ?? null,
  };
};

/**
 * After a 429 RATE_LIMITED (sign-in allows 5 a minute) the button waits it
 * out: the time it may be pressed again, or 0. Pressing sooner only adds to
 * the count.
 */
export const lockedUntilAfter = (error: ServerError): number => {
  if (error.code !== 'RATE_LIMITED') return 0;
  const raw = (error.details as { retryAfter?: unknown } | null)?.retryAfter;
  const seconds = typeof raw === 'number' && raw > 0 ? Math.ceil(raw) : 60;
  return Date.now() + seconds * 1000;
};
