// Google stays in the UI while the owner gathers its credentials: an
// unconfigured build says "coming soon" and never loads the native SDK (whose
// placeholder iOS URL scheme would throw).

jest.mock('expo-constants', () => ({
  __esModule: true,
  default: { executionEnvironment: 'bare' },
  ExecutionEnvironment: { Bare: 'bare', Standalone: 'standalone', StoreClient: 'storeClient' },
}));
const mockNativeRequired = jest.fn();
jest.mock('@react-native-google-signin/google-signin', () => {
  mockNativeRequired();
  return { GoogleSignin: { configure: jest.fn(), signIn: jest.fn(), signOut: jest.fn(), hasPlayServices: jest.fn() } };
});

import { GOOGLE_COMING_SOON, GOOGLE_UNAVAILABLE, getGoogleIdToken, isGoogleConfigured, signOutOfGoogle } from '../googleAuth';

describe('Google without credentials', () => {
  it('is not configured, says it is coming soon, and never loads the native SDK', async () => {
    expect(isGoogleConfigured()).toBe(false);
    await expect(getGoogleIdToken()).rejects.toMatchObject({ code: GOOGLE_UNAVAILABLE, message: GOOGLE_COMING_SOON });
    await expect(signOutOfGoogle()).resolves.toBeUndefined();
    expect(mockNativeRequired).not.toHaveBeenCalled();
  });
});
