// ═══════════════════════════════════════════════════════
// AuthErrorNotice — a server error, phrased for the person reading it
// ═══════════════════════════════════════════════════════
// WRONG_PORTAL shows a message plus a button to the door the account belongs
// to (QA 10); a rider account is sent to the Rider sign-in. EMAIL_EXISTS
// on a sign-up screen offers "Sign in instead". The API names the ACCOUNT (`details.accountType`) and the door
// that was used (`details.portal`); the right door follows from the account.
// Staff use the User sign-in, as in the FYP. Offline gets its own tone
// (QA 27); retrying is simply submitting again. Every other code reads from
// errorCopy (networks/network/errorCodes.ts), or the server's own message
// when there is none; VALIDATION_FAILED lists its fields. SIGNUPS_PAUSED
// (the platform switch) is information: SignupsPausedNotice says it too.

import React, { useEffect } from 'react';
import { AccessibilityInfo } from 'react-native';
import { useAuthScrollToTop } from './AuthChrome';
import { InlineNotice } from '../../Custom-Components/InlineNotice';
import { doorForAccount, WRONG_DOOR_MESSAGE } from '../../models/authDoors';
import { ERROR_CODES } from '../../networks/network/network';
import type { Portal } from '../../models/auth';
import type { ServerError } from '../../screens/shared/formStatus';
import { authErrorMessage } from './authErrorMessage';

const PORTAL_LABEL: Record<Portal, string> = {
  customer: 'Sign in as a User',
  partner: 'Sign in as a Service Provider',
  admin: 'Sign in as a User',
};

/** Codes that are an instruction, not a failure. */
const INFO_CODES = new Set<string>([
  ERROR_CODES.WRONG_PORTAL,
  ERROR_CODES.RESEND_COOLDOWN,
  ERROR_CODES.EMAIL_NOT_VERIFIED,
  ERROR_CODES.TOTP_REQUIRED,
  ERROR_CODES.SIGNUPS_PAUSED,
  // Google not set up on this build yet ("coming soon"), or Expo Go.
  'GOOGLE_UNAVAILABLE',
]);

export const AuthErrorNotice: React.FC<{
  error: ServerError;
  fallbackTitle?: string;
  onGoToPortal?: (portal: Portal) => void;
  /** Sign-up screens: EMAIL_EXISTS offers this side's sign-in (the API doesn't say which kind of account it is). */
  onSignInInstead?: () => void;
  /** The door this screen is: its own "Sign in as…" action would do nothing, so it isn't offered. */
  currentPortal?: Portal;
  /** A rider account at a User or provider door: "Sign in as a Rider" (riders use their own screen). */
  onGoToRider?: () => void;
  /** After a few wrong passwords: "Forgot your password?" sits on the notice. */
  onForgotPassword?: () => void;
}> = ({ error, fallbackTitle, onGoToPortal, onSignInInstead, currentPortal, onGoToRider, onForgotPassword }) => {
  // A new error is brought into view (it shows above the fields, which the
  // keyboard may have scrolled away) and read out — VoiceOver ignores live
  // regions, so it is announced on iOS too.
  const scrollToTop = useAuthScrollToTop();
  const spoken = error.message ? authErrorMessage(error) : '';
  useEffect(() => {
    if (!spoken) return;
    scrollToTop();
    AccessibilityInfo.announceForAccessibility(spoken);
  }, [spoken, scrollToTop]);

  if (!error.message) return null;
  if (error.code === ERROR_CODES.NETWORK_ERROR) {
    return <InlineNotice tone="warning" message={authErrorMessage(error)} />;
  }
  if (error.code === ERROR_CODES.WRONG_PORTAL) {
    const accountType = error.details?.accountType;
    const portal = doorForAccount(accountType);
    const message = (typeof accountType === 'string' && WRONG_DOOR_MESSAGE[accountType]) || error.message;
    const action =
      accountType === 'rider' && onGoToRider
        ? { label: 'Sign in as a Rider', onPress: onGoToRider }
        : portal && onGoToPortal && portal !== currentPortal
          ? { label: PORTAL_LABEL[portal], onPress: () => onGoToPortal(portal) }
          : undefined;
    return <InlineNotice tone="info" message={message} action={action} />;
  }
  if (error.code === ERROR_CODES.EMAIL_EXISTS && onSignInInstead) {
    return (
      <InlineNotice tone="info" message={authErrorMessage(error)} action={{ label: 'Sign in instead', onPress: onSignInInstead }} />
    );
  }
  if (error.code === ERROR_CODES.INVALID_CREDENTIALS && onForgotPassword) {
    return <InlineNotice tone="error" message={authErrorMessage(error)} action={{ label: 'Forgot your password?', onPress: onForgotPassword }} />;
  }
  const tone = error.code && INFO_CODES.has(error.code) ? 'info' : 'error';
  return <InlineNotice tone={tone} title={tone === 'error' ? fallbackTitle : undefined} message={authErrorMessage(error)} />;
};

export default AuthErrorNotice;
