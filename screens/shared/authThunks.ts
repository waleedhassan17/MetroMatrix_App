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
import { authGoogle } from '../../networks/authcalls/google';
import { authLogin } from '../../networks/authcalls/signin';
import { authSignup, type SignupPayload } from '../../networks/authcalls/signup';
import { ApiError, ERROR_CODES, noResponseReasonOf } from '../../networks/network/network';
import { startCooldownIfIdle } from '../email-verification-screen/emailVerificationSlice';
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
    return await authLogin({ email, password, portal });
  } catch (e) {
    if (portal === 'customer' && e instanceof ApiError && e.code === ERROR_CODES.WRONG_PORTAL && isStaffAccount(e.details?.accountType)) {
      return authLogin({ email, password, portal: 'admin' });
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
 * (`identifier`; the screen accepts a username only, RIDER_USERNAME_REGEX).
 * Staff are pointed to the User sign-in.
 */
export const riderSignInAndOpen = async (dispatch: Dispatch, username: string, password: string): Promise<'session'> => {
  const outcome = await authLogin({ username, password, portal: 'partner' });
  if (outcome.kind !== 'session') {
    throw new ApiError('This is a staff account. Sign in as a User.', ERROR_CODES.WRONG_PORTAL, 403, { accountType: 'admin', portal: 'partner' });
  }
  open(dispatch, outcome.result);
  return 'session';
};

/** A timed-out sign-up gives the API this long to finish saving before we look. */
const SIGNUP_SETTLE_MS = 1500;

/**
 * A sign-up whose account may exist anyway: it timed out or never answered
 * (the API saves the account before anything slow), or a second tap was told
 * EMAIL_EXISTS. Offline means it never left the phone.
 */
const signupMayHaveWorked = (e: unknown): boolean =>
  e instanceof ApiError &&
  (e.code === ERROR_CODES.EMAIL_EXISTS || (e.code === ERROR_CODES.NETWORK_ERROR && noResponseReasonOf(e) !== 'offline'));

/**
 * Sign-up, safe to retry. When it may have worked, the same email and password
 * sign in on the sign-up's own door: the person proved the password, so it is
 * their account and they carry on (to Email Verification, or wherever their
 * account stands). Anything else keeps the original error — EMAIL_EXISTS still
 * offers "Sign in instead", a timeout still says MetroMatrix is slow.
 */
export const signUpAndOpen = async (dispatch: Dispatch, payload: SignupPayload): Promise<void> => {
  try {
    open(dispatch, await authSignup(payload));
    // The verification email just went out: Resend waits the usual minute.
    dispatch(startCooldownIfIdle());
  } catch (e) {
    if (!signupMayHaveWorked(e)) throw e;
    if ((e as ApiError).code === ERROR_CODES.NETWORK_ERROR) {
      await new Promise(resolve => setTimeout(resolve, SIGNUP_SETTLE_MS));
    }
    let outcome: Awaited<ReturnType<typeof authLogin>>;
    try {
      outcome = await authLogin({ email: payload.email, password: payload.password, portal: payload.portal });
    } catch {
      throw e;
    }
    if (outcome.kind !== 'session') throw e;
    open(dispatch, outcome.result);
    dispatch(startCooldownIfIdle());
  }
};

export { stillSignedIn } from './sessionGuard';

export const googleAndOpen = async (dispatch: Dispatch, idToken: string): Promise<void> => {
  open(dispatch, await authGoogle(idToken));
};
