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

// Google OAuth *iOS* client ID (the reversed form also goes in app.json's
// google-signin plugin `iosUrlScheme`). Without it Google stays "coming soon" on iOS.
export const GOOGLE_IOS_CLIENT_ID = process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID?.trim() || '';

// The policies the sign-up screen links to (the owner's website; change them here or per build).
export const TERMS_URL = process.env.EXPO_PUBLIC_TERMS_URL?.trim() || 'https://metromatrix-website.vercel.app/terms';
export const PRIVACY_URL = process.env.EXPO_PUBLIC_PRIVACY_URL?.trim() || 'https://metromatrix-website.vercel.app/privacy';

/** Where people whose account is paused, or whose build is misconfigured, can reach a human. */
export const SUPPORT_EMAIL = process.env.EXPO_PUBLIC_SUPPORT_EMAIL?.trim() || 'support@metromatrix.app';
