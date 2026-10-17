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

/**
 * One screen's data that the API serves from several routes: the calls run
 * together, each is unwrapped, and the parts are serialized as one. Any
 * failure fails the whole read, as one request would.
 */
export async function requestAll<K extends string, T>(
  calls: Record<K, () => Promise<AxiosResponse>>,
  serialize: (parts: Record<K, unknown>) => T | null,
): Promise<T> {
  try {
    const keys = Object.keys(calls) as K[];
    const values = await Promise.all(keys.map(k => calls[k]().then(unwrap)));
    const value = serialize(Object.fromEntries(keys.map((k, i) => [k, values[i]])) as Record<K, unknown>);
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
