// What the "you were signed out" toast says, by the server's reason
// (authEvents.emitSessionExpired). Only definitive failures reach it.

import { ERROR_CODES, errorCopy } from '../../networks/network/apiHelpers';

export const sessionEndedCopy = (reason: string): { text1: string; text2: string } => {
  switch (reason) {
    case ERROR_CODES.REFRESH_REUSED:
      return { text1: 'Signed out', text2: errorCopy(reason) as string };
    case ERROR_CODES.ACCOUNT_DISABLED:
      return { text1: 'Account disabled', text2: errorCopy(reason) as string };
    case ERROR_CODES.TOKEN_REVOKED:
      return { text1: 'Signed out', text2: 'Your password changed or you signed out elsewhere. Please sign in again.' };
    default:
      return { text1: 'Session expired', text2: 'Please sign in again.' };
  }
};
