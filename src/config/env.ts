// ═══════════════════════════════════════════════════════
// MetroMatrix — Runtime environment
// ═══════════════════════════════════════════════════════
// The one module that reads process.env, and THE ONE FILE TO EDIT when the
// backend is ready.
//
// ★ CONNECTING THE REAL BACKEND ★
// Put its base URL in BACKEND_URL below (or set EXPO_PUBLIC_API_URL in
// .env.local). That is the whole switch: every network function then talks
// to it. While both are empty the app runs on the dummy API in
// src/networks/network/mock/ — same endpoints, same responses, same errors
// (see docs/API_CONTRACT_ASSUMED.md → "Mock mode").
//
// On a physical device use the machine's LAN address, not localhost, since
// localhost there resolves to the phone itself:
//
//   EXPO_PUBLIC_API_URL=http://192.168.1.10:3000/api/v1 npm start
//
// Expo inlines EXPO_PUBLIC_* at build time, so each value must stay a static
// read of process.env.EXPO_PUBLIC_<NAME> rather than a computed key.

/** ← Your backend, e.g. 'https://metromatrix-api.herokuapp.com/api/v1'. Empty = dummy API. */
const BACKEND_URL = '';

export const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL?.trim() || BACKEND_URL;

/** True while no backend is configured: requests are answered by the dummy API. */
export const USE_MOCK_API = !API_BASE_URL;

/** axios needs a base URL even in mock mode. Nothing is ever sent here. */
export const MOCK_BASE_URL = 'https://mock.metromatrix.local/api/v1';

// Google OAuth *web* client ID. The native SDK needs it to mint the ID token
// the API verifies at POST /auth/google; the web button uses it directly.
// See docs/GOOGLE_SIGNIN.md.
export const GOOGLE_WEB_CLIENT_ID = process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID?.trim() || '';

// Where providers whose account is paused can reach a human.
// TODO: confirm the real support address before release.
export const SUPPORT_EMAIL = 'support@metromatrix.app';
