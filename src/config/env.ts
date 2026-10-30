// ═══════════════════════════════════════════════════════
// MetroMatrix — Runtime environment
// ═══════════════════════════════════════════════════════
// The one module that reads process.env.
//
// ★ CONNECTING THE BACKEND ★
// Set EXPO_PUBLIC_API_URL (in .env.local, or per build profile in eas.json).
// Every network function then talks to it. A build with no URL does NOT fall
// back to anything: it shows the configuration-error screen and sends nothing.
//
// The dummy API in src/networks/network/mock/ runs only in a development
// build that asks for it with EXPO_PUBLIC_USE_MOCK_API=1 (see
// docs/API_CONTRACT_ASSUMED.md → "Mock mode"). A release build can never
// reach it: the `__DEV__ &&` folds to false there and Metro drops the mock.
//
// On a physical device use the machine's LAN address, not localhost, since
// localhost there resolves to the phone itself:
//
//   EXPO_PUBLIC_API_URL=http://192.168.1.10:3000/api/v1 npm start
//
// Expo inlines EXPO_PUBLIC_* at build time, so each value must stay a static
// read of process.env.EXPO_PUBLIC_<NAME> rather than a computed key.

/** The backend, e.g. 'https://api.metromatrix.app/api/v1'. Empty in a build with no URL. */
export const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL?.trim() || '';

/** Development only, and only when asked for: requests are answered by the dummy API. */
export const USE_MOCK_API = __DEV__ && process.env.EXPO_PUBLIC_USE_MOCK_API === '1';

/** Not the dummy API and no backend URL: the app cannot work and says so (ConfigErrorScreen). */
export const CONFIG_ERROR = !USE_MOCK_API && !API_BASE_URL;

/** axios needs a base URL even in mock mode. Nothing is ever sent here. */
export const MOCK_BASE_URL = 'https://mock.metromatrix.local/api/v1';

// Google OAuth *web* client ID. The native SDK needs it to mint the ID token
// the API verifies at POST /auth/google; the web button uses it directly.
// See docs/GOOGLE_SIGNIN.md.
export const GOOGLE_WEB_CLIENT_ID = process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID?.trim() || '';

/** Where people whose account is paused, or whose build is misconfigured, can reach a human. */
export const SUPPORT_EMAIL = process.env.EXPO_PUBLIC_SUPPORT_EMAIL?.trim() || 'support@metromatrix.app';
