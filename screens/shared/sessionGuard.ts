// A reply that lands after the person signed out must not bring the session
// back (a poll or a re-read still on the wire at sign-out: Email Verification,
// Approval Pending, Verify Success, Personal Info). Sign-out clears the tokens
// first, so a thunk applies a fresh session or business only while they are
// still stored.

import { getAccessToken, getRefreshToken } from '../../utils/storage_utils/storageUtils';

export const stillSignedIn = async (): Promise<boolean> => {
  const [access, refresh] = await Promise.all([getAccessToken(), getRefreshToken()]);
  return !!(access || refresh);
};
