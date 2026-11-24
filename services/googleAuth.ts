// ═══════════════════════════════════════════════════════
// MetroMatrix — Google ID token (native)
// ═══════════════════════════════════════════════════════
// Returns a Google ID token for POST /auth/google, or null when the user
// cancels. The web build resolves googleAuth.web.ts instead.
//
// The native module is NOT in Expo Go. It is required lazily — Metro runs a
// module's body on first require, not at bundle load — and only after the
// Expo Go and configuration checks, so an unconfigured build (no client id
// yet: the owner adds Google's credentials later) or Expo Go says so instead
// of crashing on the placeholder iOS URL scheme. Needs a dev build and the
// setup in docs/GOOGLE_SIGNIN.md.

import { Platform } from 'react-native';
import Constants, { ExecutionEnvironment } from 'expo-constants';
import { GOOGLE_IOS_CLIENT_ID, GOOGLE_WEB_CLIENT_ID } from '../config/env';
import { ApiError } from '../networks/network/network';

export const GOOGLE_UNAVAILABLE = 'GOOGLE_UNAVAILABLE';

/** What an unconfigured build says when Google is pressed (the button stays, as the owner asked). */
export const GOOGLE_COMING_SOON = 'Google sign-in is coming soon. Use your email for now.';

/** The build has Google's client ids: the web one everywhere, the iOS one on iOS. */
export const isGoogleConfigured = (): boolean => !!GOOGLE_WEB_CLIENT_ID && (Platform.OS !== 'ios' || !!GOOGLE_IOS_CLIENT_ID);

export const isGoogleSignInAvailable = (): boolean =>
  Constants.executionEnvironment !== ExecutionEnvironment.StoreClient && isGoogleConfigured();

let configured = false;

export const getGoogleIdToken = async (): Promise<string | null> => {
  if (Constants.executionEnvironment === ExecutionEnvironment.StoreClient) {
    throw new ApiError(
      'Google sign-in needs the MetroMatrix app build. Use your email for now.',
      GOOGLE_UNAVAILABLE,
    );
  }
  if (!isGoogleConfigured()) {
    throw new ApiError(GOOGLE_COMING_SOON, GOOGLE_UNAVAILABLE);
  }

  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const google = require('@react-native-google-signin/google-signin') as typeof import('@react-native-google-signin/google-signin');
  if (!configured) {
    google.GoogleSignin.configure({
      webClientId: GOOGLE_WEB_CLIENT_ID,
      ...(GOOGLE_IOS_CLIENT_ID ? { iosClientId: GOOGLE_IOS_CLIENT_ID } : null),
    });
    configured = true;
  }

  try {
    if (Platform.OS === 'android') await google.GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
    const response = await google.GoogleSignin.signIn();
    if (!google.isSuccessResponse(response)) return null; // cancelled
    const idToken = response.data.idToken;
    if (!idToken) throw new ApiError('Google did not return an ID token. Try again.', 'GOOGLE_NO_TOKEN');
    return idToken;
  } catch (e) {
    if (e instanceof ApiError) throw e;
    if (google.isErrorWithCode(e)) {
      if (e.code === google.statusCodes.IN_PROGRESS) return null;
      if (e.code === google.statusCodes.PLAY_SERVICES_NOT_AVAILABLE) {
        throw new ApiError('Google Play services is unavailable on this device.', GOOGLE_UNAVAILABLE);
      }
    }
    throw new ApiError('Google sign-in did not finish. Try again.', 'GOOGLE_FAILED');
  }
};

/**
 * Sign-out forgets the Google account too, so the next Google sign-in shows the
 * account picker instead of silently reusing the last account. Never throws.
 */
export const signOutOfGoogle = async (): Promise<void> => {
  if (!isGoogleSignInAvailable()) return;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const google = require('@react-native-google-signin/google-signin') as typeof import('@react-native-google-signin/google-signin');
    await google.GoogleSignin.signOut();
  } catch {
    /* nothing to forget */
  }
};
