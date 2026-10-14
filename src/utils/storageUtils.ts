// ═══════════════════════════════════════════════════════
// MetroMatrix — Session Storage Utils
// ═══════════════════════════════════════════════════════
// The ONLY place tokens are read or written. Networks and slices import these;
// screens never do, and nothing else may touch the underlying store.
//
// Native: expo-secure-store (Android Keystore / iOS Keychain). Tokens never
// reach AsyncStorage, so redux-persist and backups cannot leak them.
// Web:    localStorage behind the same async API — there is no secure enclave
//         in a browser, and an httpOnly cookie would need server support.
//
// Reads are cached in memory: the axios request interceptor asks for the
// access token on EVERY request, and a Keystore round-trip each time is slow.
// The cache is filled on first read and kept in step by every write/clear, so
// it can never disagree with storage within one process.

import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';

// ─── Storage Keys ───────────────────────────────────
// SecureStore keys may only contain alphanumerics, '.', '-' and '_'.
const ACCESS_TOKEN_KEY = 'metromatrix.accessToken';
const REFRESH_TOKEN_KEY = 'metromatrix.refreshToken';
// The Expo push token this install registered with the API, so sign-out can
// unregister exactly that device.
const PUSH_TOKEN_KEY = 'metromatrix.pushToken';

// ─── Backend (secure-store on native, localStorage on web) ───
const isWeb = Platform.OS === 'web';

const backend = {
  async get(key: string): Promise<string | null> {
    if (isWeb) {
      try {
        return globalThis.localStorage?.getItem(key) ?? null;
      } catch {
        return null;
      }
    }
    return SecureStore.getItemAsync(key);
  },
  async set(key: string, value: string): Promise<void> {
    if (isWeb) {
      try {
        globalThis.localStorage?.setItem(key, value);
      } catch {
        /* storage disabled (private mode) — the session lives in memory only */
      }
      return;
    }
    await SecureStore.setItemAsync(key, value);
  },
  async remove(key: string): Promise<void> {
    if (isWeb) {
      try {
        globalThis.localStorage?.removeItem(key);
      } catch {
        /* nothing to remove */
      }
      return;
    }
    await SecureStore.deleteItemAsync(key);
  },
};

// ─── In-memory cache ────────────────────────────────
// `undefined` = not read yet; `null` = read, and nothing is stored.
const cache: Record<string, string | null | undefined> = {
  [ACCESS_TOKEN_KEY]: undefined,
  [REFRESH_TOKEN_KEY]: undefined,
  [PUSH_TOKEN_KEY]: undefined,
};

const read = async (key: string): Promise<string | null> => {
  const cached = cache[key];
  if (cached !== undefined) return cached;
  const value = await backend.get(key);
  cache[key] = value;
  return value;
};

// ─── Token Helpers ──────────────────────────────────
export const setTokens = async (accessToken: string, refreshToken: string) => {
  cache[ACCESS_TOKEN_KEY] = accessToken;
  cache[REFRESH_TOKEN_KEY] = refreshToken;
  await Promise.all([
    backend.set(ACCESS_TOKEN_KEY, accessToken),
    backend.set(REFRESH_TOKEN_KEY, refreshToken),
  ]);
};

export const getAccessToken = async (): Promise<string | null> => read(ACCESS_TOKEN_KEY);

export const getRefreshToken = async (): Promise<string | null> => read(REFRESH_TOKEN_KEY);

export const clearTokens = async () => {
  cache[ACCESS_TOKEN_KEY] = null;
  cache[REFRESH_TOKEN_KEY] = null;
  await Promise.all([backend.remove(ACCESS_TOKEN_KEY), backend.remove(REFRESH_TOKEN_KEY)]);
};

// ─── Push Token Helpers ─────────────────────────────
export const setPushToken = async (token: string) => {
  cache[PUSH_TOKEN_KEY] = token;
  await backend.set(PUSH_TOKEN_KEY, token);
};

export const getPushToken = async (): Promise<string | null> => read(PUSH_TOKEN_KEY);

export const clearPushToken = async () => {
  cache[PUSH_TOKEN_KEY] = null;
  await backend.remove(PUSH_TOKEN_KEY);
};
