// What a staff sign-in step does when the API answers with an error, shared
// by the code step (AdminTotp) and first-time enrolment (AdminTwoFactorEnrol).
//
//   401 UNAUTHORIZED   the challenge expired (5 min) or was spent: sign in again
//   429 RATE_LIMITED   5 wrong codes: the API retired the challenge too
//   403 TOTP_REQUIRED  the other step is the right one: at the code step the
//                      admin isn't enrolled yet; at enrolment they already are

import type { Dispatch } from '@reduxjs/toolkit';
import type { RejectedApiError } from '../../networks/network/network';
import { endPendingTotp, setPendingTotp, type PendingTotp } from '../../store/authSlice';
import { showError } from '../sign-in-screen/signInSlice';
import { ERROR_CODES } from '../../networks/network/network';

/** Codes that mean the challenge itself is gone. */
export const CHALLENGE_DEAD: readonly string[] = [ERROR_CODES.UNAUTHORIZED, ERROR_CODES.RATE_LIMITED];

const DEAD_COPY: Record<string, string> = {
  [ERROR_CODES.UNAUTHORIZED]: 'Your sign-in timed out. Enter your email and password again.',
  [ERROR_CODES.RATE_LIMITED]: 'Too many incorrect codes. Wait a few minutes, then sign in again.',
};

/**
 * Apply the rule. Returns true when it moved the admin elsewhere (the
 * screen's own error then doesn't matter).
 */
export const handleChallengeError = (
  dispatch: Dispatch,
  rejected: RejectedApiError,
  pending: PendingTotp | null,
  step: 'code' | 'enrol',
): boolean => {
  if (rejected.code && CHALLENGE_DEAD.includes(rejected.code)) {
    // Shown on Sign In, where the gate now lands.
    dispatch(showError(DEAD_COPY[rejected.code] ?? rejected.message));
    dispatch(endPendingTotp());
    return true;
  }
  if (rejected.code === ERROR_CODES.TOTP_REQUIRED && pending) {
    dispatch(setPendingTotp({ ...pending, enrolled: step === 'enrol' }));
    return true;
  }
  return false;
};
