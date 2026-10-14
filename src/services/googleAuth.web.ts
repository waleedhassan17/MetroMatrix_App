// ═══════════════════════════════════════════════════════
// MetroMatrix — Google ID token (web: Google Identity Services)
// ═══════════════════════════════════════════════════════
// The web build gets its credential from GIS's own rendered button / One Tap
// (components/auth/GoogleSignInButton.web.tsx), which hands back the ID
// token in a callback. This module only loads and initialises GIS.

import { GOOGLE_WEB_CLIENT_ID } from '../config/env';
import { AuthError } from '../networks/network/apiHelpers';

export const GOOGLE_UNAVAILABLE = 'GOOGLE_UNAVAILABLE';

interface GoogleIdApi {
  initialize: (config: {
    client_id: string;
    callback: (response: { credential?: string }) => void;
    auto_select?: boolean;
    cancel_on_tap_outside?: boolean;
  }) => void;
  renderButton: (parent: HTMLElement, options: Record<string, unknown>) => void;
  prompt: () => void;
  cancel: () => void;
}

declare global {
  interface Window {
    google?: { accounts: { id: GoogleIdApi } };
  }
}

const GIS_SRC = 'https://accounts.google.com/gsi/client';
let loading: Promise<GoogleIdApi> | null = null;

export const isGoogleSignInAvailable = (): boolean => !!GOOGLE_WEB_CLIENT_ID;

export const loadGoogleIdentity = (): Promise<GoogleIdApi> => {
  if (!GOOGLE_WEB_CLIENT_ID) {
    return Promise.reject(new AuthError('Google sign-in is not set up on this build yet.', GOOGLE_UNAVAILABLE));
  }
  if (window.google?.accounts?.id) return Promise.resolve(window.google.accounts.id);
  if (!loading) {
    loading = new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = GIS_SRC;
      script.async = true;
      script.defer = true;
      script.onload = () =>
        window.google?.accounts?.id
          ? resolve(window.google.accounts.id)
          : reject(new AuthError('Google sign-in failed to load.', GOOGLE_UNAVAILABLE));
      script.onerror = () => {
        loading = null;
        reject(new AuthError("Google sign-in couldn't load. Check your connection.", 'NETWORK_ERROR'));
      };
      document.head.appendChild(script);
    });
  }
  return loading;
};

export const getGoogleIdToken = async (): Promise<string | null> => {
  throw new AuthError('Use the Google button to continue.', GOOGLE_UNAVAILABLE);
};

export const GOOGLE_CLIENT_ID = GOOGLE_WEB_CLIENT_ID;
