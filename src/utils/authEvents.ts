// ═══════════════════════════════════════════════════════
// MetroMatrix — Auth Events (session bridges)
// ═══════════════════════════════════════════════════════
// The axios client (networks/network/apiHelpers.ts) cannot import the Redux
// store — the store imports slices, slices import networks, networks import
// the client, so the cycle would break module init. When the client learns
// something the UI must react to, it emits here; AppContainer registers the
// handlers that dispatch.

// ─── Session expired ─────────────────────────────────────────────────────
// When the 401-refresh flow exhausts its options it calls emitSessionExpired();
// AppContainer's handler resets the store so the UI actually returns to
// Welcome instead of sitting on dead screens whose every request 401s until
// the next cold start.

// Only a definitive failure ends a session (networks/network/sessionRefresh.ts);
// `reason` is the server's code (REFRESH_REUSED, ACCOUNT_DISABLED, …) so the
// handler can say why.

type SessionExpiredHandler = (reason: string) => void;

let handler: SessionExpiredHandler | null = null;

export const setSessionExpiredHandler = (h: SessionExpiredHandler | null) => {
  handler = h;
};

export const emitSessionExpired = (reason = 'SESSION_ENDED') => {
  if (isIntentionalSignOut()) return;
  handler?.(reason);
};

// ─── Intentional sign-out ────────────────────────────────────────────────
// Signing out revokes the access AND refresh tokens on the server. A request
// still in flight on the old token then 401s, its refresh fails, and the user
// who tapped "Sign out" would be told their "session expired". For a short
// window after an intentional sign-out such 401s are neither refreshed nor
// announced. Bounded, so a genuinely expired session later is still reported;
// a successful sign-in ends it at once.

const INTENTIONAL_SIGN_OUT_WINDOW_MS = 10_000;
let intentionalSignOutAt = 0;

export const markIntentionalSignOut = () => {
  intentionalSignOutAt = Date.now();
};

export const clearIntentionalSignOut = () => {
  intentionalSignOutAt = 0;
};

export const isIntentionalSignOut = (): boolean =>
  intentionalSignOutAt > 0 && Date.now() - intentionalSignOutAt < INTENTIONAL_SIGN_OUT_WINDOW_MS;

// ─── Business status stale (403 BUSINESS_SUSPENDED) ──────────────────────
// Fired when a partner's request is refused because their business was
// suspended mid-session. Redux only learns the business status at sign-in /
// cold start, so without this the partner would stay on dead screens. The
// handler (AppContainer) re-fetches /auth/me and BaseNavigator routes to the
// Suspended gate without waiting for an app restart.

type BusinessStatusStaleHandler = () => void;

let businessStatusStaleHandler: BusinessStatusStaleHandler | null = null;

export const setBusinessStatusStaleHandler = (h: BusinessStatusStaleHandler | null) => {
  businessStatusStaleHandler = h;
};

export const emitBusinessStatusStale = () => {
  businessStatusStaleHandler?.();
};
