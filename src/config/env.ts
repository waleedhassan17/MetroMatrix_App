// ═══════════════════════════════════════════════════════
// MetroMatrix — Runtime environment
// ═══════════════════════════════════════════════════════
// The one module that reads process.env. Everything else imports from here.
//
// Expo inlines EXPO_PUBLIC_* at build time, so each value must stay a static
// read of process.env.EXPO_PUBLIC_<NAME> rather than a computed key.

// ★ BACKEND BASE URL ★
// Production by default, so a normal build is unchanged. Override to run
// against a backend you are still working on — otherwise every request goes
// to Heroku and a server-side change cannot be tested before it ships:
//
//   EXPO_PUBLIC_API_URL=http://localhost:3000/api/v1 npm run web
//
// On a physical device use the machine's LAN address, not localhost, since
// localhost there resolves to the phone itself.
//
// TODO(API_AUTH): replace the default with the deployed Heroku URL from
// MetroMatrix-API docs/API_AUTH.md. Until then set EXPO_PUBLIC_API_URL.
const DEFAULT_API_URL = 'https://metromatrix-api.herokuapp.com/api/v1';

export const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL?.trim() || DEFAULT_API_URL;

// Google OAuth *web* client ID. The native SDK needs it to mint the ID token
// the API verifies at POST /auth/google; the web button uses it directly.
// See docs/GOOGLE_SIGNIN.md.
export const GOOGLE_WEB_CLIENT_ID = process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID?.trim() || '';

// Where partners whose account is paused can reach a human.
// TODO: confirm the real support address before release.
export const SUPPORT_EMAIL = 'support@metromatrix.app';
