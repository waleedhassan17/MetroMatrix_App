// ═══════════════════════════════════════════════════════
// MetroMatrix — Google ID token (native)
// ═══════════════════════════════════════════════════════
// Returns a Google ID token for POST /auth/google, or null when the user
// cancels. The web build resolves googleAuth.web.ts instead.
//
// The native module is NOT in Expo Go. It is required lazily — Metro runs a
// module's body on first require, not at bundle load — and only after the
// Expo Go check, so the app runs in Expo Go with a clear message instead of
// a crash. Needs a dev build (expo run:android) and the SHA-1 setup in
// docs/GOOGLE_SIGNIN.md.

import Constants, { ExecutionEnvironment } from 'expo-constants';
import { GOOGLE_WEB_CLIENT_ID } from '../config/env';
import { ApiError } from '../networks/network/network';

export const GOOGLE_UNAVAILABLE = 'GOOGLE_UNAVAILABLE';

export const isGoogleSignInAvailable = (): boolean =>
  Constants.executionEnvironment !== ExecutionEnvironment.StoreClient && !!GOOGLE_WEB_CLIENT_ID;

let configured = false;

export const getGoogleIdToken = async (): Promise<string | null> => {
  if (Constants.executionEnvironment === ExecutionEnvironment.StoreClient) {
    throw new ApiError(
      'Google sign-in needs the MetroMatrix app build. Use your email for now.',
      GOOGLE_UNAVAILABLE,
    );
  }
  if (!GOOGLE_WEB_CLIENT_ID) {
    throw new ApiError('Google sign-in is not set up on this build yet.', GOOGLE_UNAVAILABLE);
  }

  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const google = require('@react-native-google-signin/google-signin') as typeof import('@react-native-google-signin/google-signin');
  if (!configured) {
    google.GoogleSignin.configure({ webClientId: GOOGLE_WEB_CLIENT_ID });
    configured = true;
  }

  try {
    await google.GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
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
