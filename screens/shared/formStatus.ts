// Shared shapes for screen slices that submit a form to the API.

import type { RejectedApiError } from '../../networks/network/apiHelpers';

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
