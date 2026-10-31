// The sign-in / sign-up bodies the four auth slices share. Each slice's thunk
// calls one of these inside its own try/catch, so the screen-slice-network
// path stays intact while the session rules live in one place:
//   • a session resets the store (nothing from a previous account survives)
//     and opens; AppContainer's gate then routes;
//   • a staff account gets the TOTP challenge instead (no tokens yet).
//     Staff sign in on the User sign-in, as in the FYP; the API keeps them
//     on the admin portal (403 WRONG_PORTAL, MetroMatrix-API API_AUTH.md),
//     so the same credentials are sent there.

import type { Dispatch } from '@reduxjs/toolkit';
import { resetAllState } from '../../store/resetAllState';
import { authGoogle, authSignin, authSignup, type SignupPayload } from '../../networks/auth/authNetwork';
import { ApiError, ERROR_CODES } from '../../networks/network/apiHelpers';
import { isStaffAccount } from '../../models/authDoors';
import type { AuthResult, Portal } from '../../models/auth';
import { setPendingTotp, setSession } from '../../store/authSlice';

const open = (dispatch: Dispatch, result: AuthResult) => {
  dispatch(resetAllState());
  dispatch(setSession({ user: result.user, business: result.business }));
};

/**
 * Staff sign in on the ordinary User sign-in, as in the FYP. The API keeps
 * them on its admin door, so a User-door sign-in it answers with
 * WRONG_PORTAL for a staff account is retried there: that returns the TOTP
 * challenge (no tokens). From the provider door they are pointed to the User
 * sign-in instead (AuthErrorNotice).
 */
const signinOnTheirDoor = async (portal: Extract<Portal, 'customer' | 'partner'>, email: string, password: string) => {
  try {
    return await authSignin({ email, password, portal });
  } catch (e) {
    if (portal === 'customer' && e instanceof ApiError && e.code === ERROR_CODES.WRONG_PORTAL && isStaffAccount(e.details?.accountType)) {
      return authSignin({ email, password, portal: 'admin' });
    }
    throw e;
  }
};

export const signInAndOpen = async (
  dispatch: Dispatch,
  portal: Extract<Portal, 'customer' | 'partner'>,
  email: string,
  password: string,
): Promise<'session' | 'totp'> => {
  const outcome = await signinOnTheirDoor(portal, email, password);
  if (outcome.kind === 'totp') {
    if (portal === 'partner') {
      throw new ApiError('Staff accounts sign in from the User sign-in.', ERROR_CODES.WRONG_PORTAL, 403, {
        accountType: 'admin',
        portal: 'partner',
      });
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

/**
 * Riders sign in on the partner portal with the username their vendor issued
 * (`identifier`). A partner who types their email here simply gets their own
 * app (same portal); staff are pointed to the User sign-in.
 */
export const riderSignInAndOpen = async (dispatch: Dispatch, username: string, password: string): Promise<'session'> => {
  const outcome = await authSignin({ username, password, portal: 'partner' });
  if (outcome.kind !== 'session') {
    throw new ApiError('This is a staff account. Sign in as a User.', ERROR_CODES.WRONG_PORTAL, 403, { accountType: 'admin', portal: 'partner' });
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
