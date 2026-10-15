// ═══════════════════════════════════════════════════════
// MetroMatrix — Shopping request helper
// ═══════════════════════════════════════════════════════
// Every shopping network function is one line through `request`: run the
// call on the shared `api` client, unwrap the envelope, serialize, and turn
// any failure into an AuthError carrying the API's code and details.

import type { AxiosResponse } from 'axios';
import { AuthError, toAuthError, unwrap } from '../network/apiHelpers';

export async function request<T>(call: () => Promise<AxiosResponse>, serialize: (raw: unknown) => T | null): Promise<T> {
  try {
    const value = serialize(unwrap(await call()));
    if (value === null) throw new AuthError('The server sent something unexpected. Try again.', 'BAD_RESPONSE');
    return value;
  } catch (e) {
    throw toAuthError(e);
  }
}

/** For calls whose body we don't need (acks like `{ removed: true }`). */
export const ack = (): true => true;

/** `?page=&pageSize=` for list endpoints. */
export const pageParams = (page: number, pageSize: number) => ({ page, pageSize });

/** Drop undefined / null / '' / false so the query string stays clean. */
export const clean = (params: Record<string, unknown>) =>
  Object.fromEntries(Object.entries(params).filter(([, v]) => v !== undefined && v !== null && v !== '' && v !== false));
