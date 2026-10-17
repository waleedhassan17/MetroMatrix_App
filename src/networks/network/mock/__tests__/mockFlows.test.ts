// The dummy API, driven through the REAL network functions — every flow a
// tester walks in the app, end to end, with no backend.

import type { Dispatch } from '@reduxjs/toolkit';
import { signInAndOpen } from '../../../../screens/Auth/shared/authThunks';
import { setPendingTotp } from '../../../../screens/Auth/authSlice';
import {
  authAdminTotp,
  authForgotPassword,
  authMe,
  authResetPassword,
  authSignin,
  authSignup,
  authVerificationStatus,
  authVerifyEmail,
  authVerifyResetOtp,
} from '../../../auth/authNetwork';
import { completeProfile } from '../../../users/usersNetwork';
import {
  addDocument,
  createBusiness,
  getMyBusiness,
  getMyBusinessStatus,
  submitBusiness,
} from '../../../businesses/businessNetwork';
import { approveBusiness, listBusinesses, suspendBusiness } from '../../../admin/adminBusinessNetwork';
import { AuthError } from '../../apiHelpers';
import { clearTokens } from '../../../../utils/storageUtils';
import { MOCK, SEED_PASSWORD, STAFF_PASSWORD } from '../mockConfig';
import { resetMockDb } from '../mockDb';

const T0 = new Date('2026-10-15T10:00:00Z').getTime();
const at = (seconds: number) => jest.setSystemTime(T0 + seconds * 1000);

const failure = async (p: Promise<unknown>): Promise<AuthError> => {
  try {
    await p;
  } catch (e) {
    return e as AuthError;
  }
  throw new Error('expected the call to fail');
};

beforeAll(() => {
  // Only the clock is faked: the adapter and AsyncStorage still run for real.
  jest.useFakeTimers({ doNotFake: ['setTimeout', 'setInterval', 'setImmediate', 'nextTick', 'queueMicrotask'] });
});
afterAll(() => jest.useRealTimers());

beforeEach(async () => {
  at(0);
  await resetMockDb();
  await clearTokens();
});

describe('customer: sign up → verify (link) → complete profile', () => {
  it('walks the whole FYP user flow', async () => {
    const result = await authSignup({
      name: 'Hina Raza',
      email: 'hina@example.com',
      phone: '+923124890176',
      password: 'metro2026',
      portal: 'customer',
    });
    expect(result.user).toMatchObject({ role: 'customer', isEmailVerified: false, profileComplete: false });

    // The link has not been opened yet …
    expect(await authVerificationStatus()).toBe(false);
    // … the dummy inbox opens it a few seconds after sending.
    at(MOCK.EMAIL_LINK_SECONDS + 1);
    expect(await authVerificationStatus()).toBe(true);

    const me = await authMe();
    expect(me.user.isEmailVerified).toBe(true);

    const done = await completeProfile({
      dateOfBirth: '1998-02-14',
      gender: 'female',
      streetAddress: '7 Canal View',
      city: 'Lahore',
      postalCode: '54000',
    });
    expect(done).toMatchObject({ profileComplete: true, city: 'Lahore', gender: 'female' });
  });

  it('refuses a second account on the same email', async () => {
    const err = await failure(
      authSignup({ name: 'X', email: 'customer@metromatrix.app', phone: '+923124890176', password: 'metro2026', portal: 'customer' }),
    );
    expect(err.code).toBe('EMAIL_TAKEN');
  });

  it('a verification deep link verifies too', async () => {
    const { user } = await authSignup({
      name: 'Deep Link',
      email: 'deep@example.com',
      phone: '+923124890176',
      password: 'metro2026',
      portal: 'customer',
    });
    expect((await authVerifyEmail(`mock-verify-${user.id}`)).isEmailVerified).toBe(true);
    expect((await failure(authVerifyEmail('nonsense'))).code).toBe('VERIFY_TOKEN_INVALID');
  });
});

describe('provider: sign up → personal info → documents → submit → approval', () => {
  it('walks the whole FYP provider flow', async () => {
    const { user } = await authSignup({
      name: 'Sara Kitchen',
      email: 'sara@example.com',
      phone: '+923124890176',
      password: 'metro2026',
      portal: 'partner',
      subType: 'home_kitchen',
    });
    expect(user).toMatchObject({ role: 'partner', providerServiceType: 'food', providerSubType: 'home_kitchen' });
    expect(await getMyBusiness()).toBeNull();

    const draft = await createBusiness({
      serviceType: 'food',
      subType: 'home_kitchen',
      name: "Sara's Kitchen",
      phone: '+923124890176',
      city: 'Lahore',
      address: '9 Garden Town',
      location: null,
      details: { cuisine: 'Desi Home Food', dailyCapacity: '15' },
    });
    expect(draft).toMatchObject({ status: 'draft', missingDocuments: ['cnic', 'kitchen_photo'] });

    const missing = await failure(submitBusiness());
    expect(missing.code).toBe('DOCUMENTS_MISSING');
    expect(missing.details).toEqual({ missing: ['cnic', 'kitchen_photo'] });

    await addDocument({ kind: 'cnic', url: 'file://cnic.jpg', publicId: 'p1', mimeType: 'image/jpeg' });
    await addDocument({ kind: 'kitchen_photo', url: 'file://k.jpg', publicId: 'p2', mimeType: 'image/jpeg' });
    expect((await submitBusiness()).status).toBe('pending_approval');

    expect((await getMyBusinessStatus()).status).toBe('pending_approval');
    at(MOCK.AUTO_APPROVE_SECONDS + 1);
    expect((await getMyBusinessStatus()).status).toBe('approved');
  });
});

describe('sign-in rules', () => {
  it('a provider on the User sign-in is pointed to the provider sign-in', async () => {
    const err = await failure(authSignin({ email: 'doctor@metromatrix.app', password: SEED_PASSWORD, portal: 'customer' }));
    expect(err.code).toBe('WRONG_PORTAL');
    expect(err.details).toEqual({ accountType: 'partner', portal: 'customer' });
  });

  it('a wrong password is refused', async () => {
    expect((await failure(authSignin({ email: 'customer@metromatrix.app', password: 'nope1234', portal: 'customer' }))).code).toBe(
      'INVALID_CREDENTIALS',
    );
  });

  it('staff are told the admin portal is theirs, and get a TOTP step there, no tokens', async () => {
    const wrong = await failure(authSignin({ email: 'admin@metromatrix.app', password: STAFF_PASSWORD, portal: 'customer' }));
    expect(wrong).toMatchObject({ code: 'WRONG_PORTAL', details: { accountType: 'super_admin', portal: 'customer' } });
    const outcome = await authSignin({ email: 'admin@metromatrix.app', password: STAFF_PASSWORD, portal: 'admin' });
    if (outcome.kind !== 'totp') throw new Error('expected a challenge');
    expect(outcome.challenge.totpEnrolled).toBe(true);

    expect((await failure(authAdminTotp(outcome.challenge.challengeToken, { code: '000000' }))).code).toBe('TOTP_INVALID');
    const session = await authAdminTotp(outcome.challenge.challengeToken, { code: MOCK.TOTP_CODE });
    expect(session.user.role).toBe('super_admin');
  });

  it('the User sign-in takes staff on to the admin portal, as in the FYP (TOTP next)', async () => {
    const actions: { type: string; payload?: unknown }[] = [];
    const dispatch = ((action: { type: string; payload?: unknown }) => {
      actions.push(action);
      return action;
    }) as unknown as Dispatch;
    expect(await signInAndOpen(dispatch, 'customer', 'admin@metromatrix.app', STAFF_PASSWORD)).toBe('totp');
    expect(actions.find(x => x.type === setPendingTotp.type)?.payload).toMatchObject({ enrolled: true, email: 'admin@metromatrix.app' });
    // Anyone else on the wrong sign-in is still told where to go.
    expect((await failure(signInAndOpen(dispatch, 'customer', 'doctor@metromatrix.app', SEED_PASSWORD))).code).toBe('WRONG_PORTAL');
  });

  it('a recovery code works once', async () => {
    const first = await authSignin({ email: 'admin@metromatrix.app', password: STAFF_PASSWORD, portal: 'admin' });
    if (first.kind !== 'totp') throw new Error('expected a challenge');
    await authAdminTotp(first.challenge.challengeToken, { recoveryCode: 'MM7K-Q2PX' });
    const second = await authSignin({ email: 'admin@metromatrix.app', password: STAFF_PASSWORD, portal: 'admin' });
    if (second.kind !== 'totp') throw new Error('expected a challenge');
    expect((await failure(authAdminTotp(second.challenge.challengeToken, { recoveryCode: 'MM7K-Q2PX' }))).code).toBe(
      'RECOVERY_CODE_USED',
    );
  });
});

describe('password reset', () => {
  it('email → code (with attempts) → new password → sign in', async () => {
    await authForgotPassword('customer@metromatrix.app');
    const wrong = await failure(authVerifyResetOtp('customer@metromatrix.app', '000000'));
    expect(wrong).toMatchObject({ code: 'INVALID_OTP', details: { attemptsLeft: MOCK.OTP_ATTEMPTS - 1 } });

    const token = await authVerifyResetOtp('customer@metromatrix.app', MOCK.RESET_OTP);
    await authResetPassword(token, 'newpass2026');
    const outcome = await authSignin({ email: 'customer@metromatrix.app', password: 'newpass2026', portal: 'customer' });
    expect(outcome.kind).toBe('session');
  });
});

describe('sessions and admin decisions', () => {
  it('an expired access token is refreshed silently', async () => {
    await authSignin({ email: 'customer@metromatrix.app', password: SEED_PASSWORD, portal: 'customer' });
    at(MOCK.ACCESS_TTL_MS / 1000 + 60);
    expect((await authMe()).user.email).toBe('customer@metromatrix.app');
  });

  it('an admin approves the pending kitchen and suspends the doctor', async () => {
    const outcome = await authSignin({ email: 'admin@metromatrix.app', password: STAFF_PASSWORD, portal: 'admin' });
    if (outcome.kind !== 'totp') throw new Error('expected a challenge');
    await authAdminTotp(outcome.challenge.challengeToken, { code: MOCK.TOTP_CODE });

    const queue = await listBusinesses({ status: 'pending_approval' });
    expect(queue.items.map(b => b.id)).toContain('b_kitchen');
    expect((await approveBusiness('b_kitchen')).status).toBe('approved');
    expect((await suspendBusiness('b_doctor', 'Repeated complaints from patients.')).status).toBe('suspended');

    await clearTokens();
    await authSignin({ email: 'doctor@metromatrix.app', password: SEED_PASSWORD, portal: 'partner' });
    expect((await failure(getMyBusiness())).code).toBe('BUSINESS_SUSPENDED');
  });
});
