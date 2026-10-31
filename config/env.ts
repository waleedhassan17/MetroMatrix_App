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
// As in FinMatrix, the app always talks to the real MetroMatrix API. The
// dummy API in networks/network/mock/ is test fixtures only: no build can
// reach it.
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

/** No backend URL: the app cannot work and says so (ConfigErrorScreen). */
export const CONFIG_ERROR = !API_BASE_URL;

// Google OAuth *web* client ID. The native SDK needs it to mint the ID token
// the API verifies at POST /auth/google; the web button uses it directly.
// See docs/GOOGLE_SIGNIN.md.
export const GOOGLE_WEB_CLIENT_ID = process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID?.trim() || '';

/** Where people whose account is paused, or whose build is misconfigured, can reach a human. */
export const SUPPORT_EMAIL = process.env.EXPO_PUBLIC_SUPPORT_EMAIL?.trim() || 'support@metromatrix.app';
