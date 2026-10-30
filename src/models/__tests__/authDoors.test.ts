// C5: every account type that can hit the wrong door gets a message, and a
// button to the right one when this app has a door for it.

import { doorForAccount, isStaffAccount, WRONG_DOOR_MESSAGE } from '../authDoors';
import { errorCopy, ERROR_CODES } from '../../networks/network/errorCodes';

describe('wrong door (WRONG_PORTAL details.accountType)', () => {
  it.each([
    ['customer', 'customer', /user account/],
    ['partner', 'partner', /service provider account/],
    ['admin', 'customer', /Staff accounts sign in from the User sign-in/],
    ['super_admin', 'customer', /Staff accounts sign in from the User sign-in/],
  ])('a %s account is sent to the %s door with its own message', (accountType, door, message) => {
    expect(doorForAccount(accountType)).toBe(door);
    expect(WRONG_DOOR_MESSAGE[accountType]).toMatch(message);
  });

  it('a rider has no door in this app: told about the Rider app, and offered no button', () => {
    expect(doorForAccount('rider')).toBeUndefined();
    expect(WRONG_DOOR_MESSAGE.rider).toBe(errorCopy(ERROR_CODES.WRONG_APP));
  });

  it('an unknown account type gets no button (the server message is shown)', () => {
    expect(doorForAccount('robot')).toBeUndefined();
    expect(doorForAccount(undefined)).toBeUndefined();
    expect(WRONG_DOOR_MESSAGE.robot).toBeUndefined();
  });

  it('only admin roles count as staff (retried on the admin door)', () => {
    expect(isStaffAccount('admin')).toBe(true);
    expect(isStaffAccount('super_admin')).toBe(true);
    for (const role of ['customer', 'partner', 'rider', undefined]) expect(isStaffAccount(role)).toBe(false);
  });

  it('a taken email at sign-up says to sign in instead', () => {
    expect(errorCopy(ERROR_CODES.EMAIL_EXISTS)).toMatch(/Sign in instead/);
  });
});
