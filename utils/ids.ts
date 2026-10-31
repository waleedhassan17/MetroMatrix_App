// MetroMatrix — A fresh UUID (the checkout's Idempotency-Key).
// expo-crypto's randomUUID where the platform gives one; otherwise a v4 UUID
// from Math.random — unique enough for a retry key, never empty.

import * as Crypto from 'expo-crypto';

const fallbackUuid = () =>
  'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
    const r = (Math.random() * 16) | 0;
    return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
  });

export const newUuid = (): string => {
  try {
    const id = Crypto.randomUUID();
    if (typeof id === 'string' && id.length >= 32) return id;
  } catch {
    /* no native crypto (tests, some web hosts) */
  }
  return fallbackUuid();
};
