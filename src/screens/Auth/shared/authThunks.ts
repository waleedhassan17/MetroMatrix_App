// The sign-in / sign-up bodies the four auth slices share. Each slice's thunk
// calls one of these inside its own try/catch, so the screen-slice-network
// path stays intact while the session rules live in one place:
//   • a session resets the store (nothing from a previous account survives)
//     and opens; AppContainer's gate then routes;
//   • a staff account gets the TOTP challenge instead (no tokens yet).

import type { Dispatch } from '@reduxjs/toolkit';
import { resetAllState } from '../../../store/resetAllState';
import { authGoogle, authSignin, authSignup, type SignupPayload } from '../../../networks/auth/authNetwork';
import { AuthError } from '../../../networks/network/apiHelpers';
import type { AuthResult, Portal } from '../../../types/auth';
import { setPendingTotp, setSession } from '../authSlice';

const open = (dispatch: Dispatch, result: AuthResult) => {
  dispatch(resetAllState());
  dispatch(setSession({ user: result.user, business: result.business }));
};

export const signInAndOpen = async (
  dispatch: Dispatch,
  portal: Extract<Portal, 'customer' | 'partner'>,
  email: string,
  password: string,
): Promise<'session' | 'totp'> => {
  const outcome = await authSignin({ email, password, portal });
  if (outcome.kind === 'totp') {
    if (portal === 'partner') {
      throw new AuthError('Staff accounts sign in from the User sign-in.', 'WRONG_PORTAL', 403, { portal: 'customer' });
    }
    dispatch(
      setPendingTotp({
        challengeToken: outcome.challenge.challengeToken,
        enrolled: outcome.challenge.totpEnrolled,
        email: email.trim().toLowerCase(),
      }),
    );
    return 'totp';
  }
  open(dispatch, outcome.result);
  return 'session';
};

export const signUpAndOpen = async (dispatch: Dispatch, payload: SignupPayload): Promise<void> => {
  open(dispatch, await authSignup(payload));
};

export const googleAndOpen = async (dispatch: Dispatch, idToken: string): Promise<void> => {
  open(dispatch, await authGoogle(idToken));
};
