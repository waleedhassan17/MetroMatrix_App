// ═══════════════════════════════════════════════════════
// MetroMatrix — useSignOut (the ONLY sign-out implementation)
// ═══════════════════════════════════════════════════════
// One flow for every role and every gate screen:
//
//   markIntentionalSignOut()   in-flight requests on the old token must not
//                              be refreshed or reported as "session expired"
//   capture tokens             access, refresh and push token, BEFORE clearing
//   clearTokens()              local sign-out never depends on the network
//   RESET_ALL_STATE + signOut  synchronous — AppContainer swaps to Welcome on
//                              the same frame; back-navigation cannot re-enter
//   unregisterDevice → authLogout   fire-and-forget with the captured token:
//                              an offline or hung request must not hold the
//                              user on a spinner (FinMatrix's lesson)
//
// Idempotent: `inFlight` blocks a second tap; the network calls no-op
// without a token.

import { useCallback, useRef, useState } from 'react';
import { useAppDispatch } from './useReduxHooks';
import { signOut } from '../screens/Auth/authSlice';
import { resetAllState } from '../store/resetAllState';
import { authLogout } from '../networks/auth/authNetwork';
import { unregisterDevice } from '../networks/users/usersNetwork';
import {
  clearPushToken,
  clearTokens,
  getAccessToken,
  getPushToken,
  getRefreshToken,
} from '../utils/storageUtils';
import { markIntentionalSignOut } from '../utils/authEvents';
import { Alert } from '../utils/alert';

const CONFIRM_TITLE = 'Sign out';
const CONFIRM_MESSAGE = 'You can sign back in any time with the same account.';

export function useSignOut() {
  const dispatch = useAppDispatch();
  const [signingOut, setSigningOut] = useState(false);
  // Ref (not just state) so two taps in the same frame can't both pass.
  const inFlight = useRef(false);

  const signOutNow = useCallback(async () => {
    if (inFlight.current) return;
    inFlight.current = true;
    setSigningOut(true);

    markIntentionalSignOut();
    const [accessToken, refreshToken, pushToken] = await Promise.all([
      getAccessToken(),
      getRefreshToken(),
      getPushToken(),
    ]);
    await Promise.all([clearTokens(), clearPushToken()]);

    // Synchronous — this is what swaps the navigator to Welcome.
    dispatch(resetAllState());
    dispatch(signOut());

    // Best-effort, in the prompt's order, on the captured token.
    void (async () => {
      if (pushToken) await unregisterDevice(pushToken, accessToken);
      await authLogout(accessToken, refreshToken);
    })();

    inFlight.current = false;
    setSigningOut(false);
  }, [dispatch]);

  const confirmSignOut = useCallback(() => {
    if (inFlight.current) return;
    // The shim renders a real dialog on native and window.confirm on web.
    Alert.alert(CONFIRM_TITLE, CONFIRM_MESSAGE, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Sign out', style: 'destructive', onPress: () => void signOutNow() },
    ]);
  }, [signOutNow]);

  return { signingOut, confirmSignOut, signOutNow };
}
