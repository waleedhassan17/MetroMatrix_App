// ═══════════════════════════════════════════════════════
// MetroMatrix — Runtime environment
// ═══════════════════════════════════════════════════════
// The app's other EXPO_PUBLIC_* settings. The API URL itself
// (EXPO_PUBLIC_API_URL) is read by the main network file,
// networks/network/network.ts (API_URL, CONFIG_ERROR); nothing else reads
// process.env.
//
// Set them in .env.local, or per build profile in eas.json. Expo inlines
// EXPO_PUBLIC_* at build time, so each value must stay a static read of
// process.env.EXPO_PUBLIC_<NAME> rather than a computed key.

// Google OAuth *web* client ID. The native SDK needs it to mint the ID token
// the API verifies at POST /auth/google; the web button uses it directly.
// See docs/GOOGLE_SIGNIN.md.
export const GOOGLE_WEB_CLIENT_ID = process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID?.trim() || '';

/** Where people whose account is paused, or whose build is misconfigured, can reach a human. */
export const SUPPORT_EMAIL = process.env.EXPO_PUBLIC_SUPPORT_EMAIL?.trim() || 'support@metromatrix.app';
