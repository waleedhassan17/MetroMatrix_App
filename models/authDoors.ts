// Which sign-in door an account belongs to. The API's WRONG_PORTAL names the
// ACCOUNT (`details.accountType`) and the door that was used (`details.portal`);
// the right door follows from the account. Staff use the User sign-in, as in
// the FYP (signInAndOpen then retries them on the API's admin door).

import type { Portal } from './auth';

/** The door for an account type; riders have their own (RiderSignIn), named in WRONG_DOOR_MESSAGE. */
export const doorForAccount = (accountType: unknown): Portal | undefined => {
  switch (accountType) {
    case 'customer':
    case 'admin':
    case 'super_admin':
      return 'customer';
    case 'partner':
      return 'partner';
    default:
      return undefined;
  }
};

export const isStaffAccount = (accountType: unknown): boolean =>
  accountType === 'admin' || accountType === 'super_admin';

/** What to say, by the account the person tried to sign in to. */
export const WRONG_DOOR_MESSAGE: Record<string, string> = {
  customer: 'This is a user account. Sign in as a User instead.',
  partner: 'This is a service provider account. Sign in as a Service Provider instead.',
  admin: 'Staff accounts sign in from the User sign-in.',
  super_admin: 'Staff accounts sign in from the User sign-in.',
  // Riders use the partner portal, but by username on their own screen.
  rider: 'This is a rider account. Choose Rider on the first screen and sign in with your username.',
};
