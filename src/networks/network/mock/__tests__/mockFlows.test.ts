// The dummy API, driven through the REAL network functions — every flow a
// tester walks in the app, end to end, with no backend.

import {
  authAdminTotp,
  authForgotPassword,
  authMe,
  authResendVerification,
  authResetPassword,
  authSignin,
  authSignup,
  authVerifyEmail,
  authVerifyResetOtp,
} from '../../../auth/authNetwork';
import { completeProfile } from '../../../users/usersNetwork';
import {
  addDocument,
  createBusiness,
  getMyBusiness,
  getMyBusinessStatus,
  removeDocument,
  submitBusiness,
} from '../../../businesses/businessNetwork';
import {
  approveBusiness,
  getBusiness,
  listBusinesses,
  reinstateBusiness,
  rejectBusiness,
  suspendBusiness,
} from '../../../admin/adminBusinessNetwork';
import { api, AuthError, toAuthError } from '../../apiHelpers';
import { clearTokens } from '../../../../utils/storageUtils';
import { MOCK, SEED_PASSWORD, STAFF_PASSWORD } from '../mockConfig';
import { getDb, resetMockDb } from '../mockDb';
import { setBusinessStatusStaleHandler } from '../../../../utils/authEvents';
import { resolveGate } from '../../../../navigators/sessionGate';

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
      password: 'Metro2026',
      portal: 'customer',
    });
    expect(result.user).toMatchObject({ role: 'customer', isEmailVerified: false, profileComplete: false });

    // The link has not been opened yet: the account says so …
    expect((await authMe()).user.isEmailVerified).toBe(false);
    // … the dummy inbox opens it a few seconds after sending.
    at(MOCK.EMAIL_LINK_SECONDS + 1);
    expect((await authMe()).user.isEmailVerified).toBe(true);

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
      authSignup({ name: 'Xavier Khan', email: 'customer@metromatrix.app', phone: '+923124890176', password: 'Metro2026', portal: 'customer' }),
    );
    expect(err.code).toBe('EMAIL_EXISTS');
  });

  it('a verification deep link verifies too', async () => {
    const { user } = await authSignup({
      name: 'Deep Link',
      email: 'deep@example.com',
      phone: '+923124890176',
      password: 'Metro2026',
      portal: 'customer',
    });
    // Public: it works with no session at all.
    await clearTokens();
    expect((await authVerifyEmail(`mock-verify-${user.id}`)).user.isEmailVerified).toBe(true);
    expect((await failure(authVerifyEmail('nonsense'))).code).toBe('VERIFY_LINK_INVALID');
  });

  it('resend: cooldown is RESEND_COOLDOWN with retryAfter; once verified it sends nothing', async () => {
    await authSignup({ name: 'Resend', email: 'resend@example.com', phone: '', password: 'Metro2026', portal: 'customer' });
    const cooling = await failure(authResendVerification());
    expect(cooling.code).toBe('RESEND_COOLDOWN');
    expect(cooling.details.retryAfter).toBeGreaterThan(0);
    at(MOCK.RESEND_SECONDS + 1);
    expect(await authResendVerification()).toEqual({ retryAfter: MOCK.RESEND_SECONDS, alreadyVerified: false });
    at(MOCK.RESEND_SECONDS + MOCK.EMAIL_LINK_SECONDS + 2);
    await authMe();
    expect(await authResendVerification()).toEqual({ retryAfter: 0, alreadyVerified: true });
  });
});

describe('provider: sign up → personal info → documents → submit → approval', () => {
  it('walks the whole FYP provider flow', async () => {
    const { user } = await authSignup({
      name: 'Sara Kitchen',
      email: 'sara@example.com',
      phone: '+923124890176',
      password: 'Metro2026',
      portal: 'partner',
    });
    // As on the API, the account has no type until the business is created.
    expect(user).toMatchObject({ role: 'partner', providerServiceType: null, providerSubType: null });
    expect(await getMyBusiness()).toBeNull();

    const draft = await createBusiness({
      serviceType: 'food',
      subType: 'home_kitchen',
      name: "Sara's Kitchen",
      phone: '+923124890176',
      city: 'Lahore',
      addressLine: '9 Garden Town',
    });
    expect(draft).toMatchObject({
      status: 'draft',
      address: '9 Garden Town',
      missingDocuments: ['cnic_front', 'cnic_back', 'kitchen_photo'],
    });

    const missing = await failure(submitBusiness());
    expect(missing.code).toBe('DOCUMENTS_MISSING');
    expect(missing.details.missing).toEqual(['cnic_front', 'cnic_back', 'kitchen_photo']);

    // A kind the sub-type doesn't need is refused, as on the API.
    expect((await failure(addDocument({ kind: 'pmdc_certificate', url: 'file://p.jpg', publicId: 'p0' }))).code).toBe('VALIDATION_FAILED');

    await addDocument({ kind: 'cnic_front', url: 'file://f.jpg', publicId: 'p1' });
    await addDocument({ kind: 'cnic_back', url: 'file://b.jpg', publicId: 'p2' });
    // Kitchen photos add up; the requirement is two.
    const one = await addDocument({ kind: 'kitchen_photo', url: 'file://k1.jpg', publicId: 'p3' });
    expect(one.missingDocuments).toEqual(['kitchen_photo']);
    expect(one.requiredDocuments[2]).toEqual({ kind: 'kitchen_photo', min: 2, have: 1, satisfied: false });
    const two = await addDocument({ kind: 'kitchen_photo', url: 'file://k2.jpg', publicId: 'p4' });
    expect(two.documents.filter(d => d.kind === 'kitchen_photo')).toHaveLength(2);
    expect(two.missingDocuments).toEqual([]);
    // A single-copy kind replaces the earlier one.
    const again = await addDocument({ kind: 'cnic_front', url: 'file://f2.jpg', publicId: 'p5' });
    expect(again.documents.filter(d => d.kind === 'cnic_front').map(d => d.url)).toEqual(['file://f2.jpg']);

    expect((await submitBusiness()).status).toBe('pending_approval');
    // The session carries only the API's BusinessSummary; authMe reads the
    // full business so setup, Rejected and the partner home have its details.
    const session = await authMe();
    expect(session.business).toMatchObject({ status: 'pending_approval', address: '9 Garden Town' });
    // CNIC front and back, two kitchen photos (the second CNIC front replaced the first).
    expect(session.business!.documents).toHaveLength(4);
    // With the team: no more edits.
    expect((await failure(removeDocument(again.documents[0].id))).code).toBe('BUSINESS_NOT_EDITABLE');

    expect((await getMyBusinessStatus()).status).toBe('pending_approval');
    at(MOCK.AUTO_APPROVE_SECONDS + 1);
    expect((await getMyBusinessStatus()).status).toBe('approved');
  });
});

describe('sign-in rules', () => {
  it('a provider on the User sign-in is told which account it is (the app picks the door)', async () => {
    const err = await failure(authSignin({ email: 'doctor@metromatrix.app', password: SEED_PASSWORD, portal: 'customer' }));
    expect(err.code).toBe('WRONG_PORTAL');
    expect(err.details).toEqual({ accountType: 'partner', portal: 'customer' });
  });

  it('staff on the User door: WRONG_PORTAL naming the staff account (signInAndOpen retries on the admin door)', async () => {
    const err = await failure(authSignin({ email: 'admin@metromatrix.app', password: STAFF_PASSWORD, portal: 'customer' }));
    expect(err).toMatchObject({ code: 'WRONG_PORTAL', details: { accountType: 'super_admin', portal: 'customer' } });
  });

  it('a wrong password is refused', async () => {
    expect((await failure(authSignin({ email: 'customer@metromatrix.app', password: 'nope1234', portal: 'customer' }))).code).toBe(
      'INVALID_CREDENTIALS',
    );
  });

  it('staff on the admin door get a TOTP step, no tokens', async () => {
    const outcome = await authSignin({ email: 'admin@metromatrix.app', password: STAFF_PASSWORD, portal: 'admin' });
    if (outcome.kind !== 'totp') throw new Error('expected a challenge');
    expect(outcome.challenge.totpEnrolled).toBe(true);

    expect((await failure(authAdminTotp(outcome.challenge.challengeToken, { code: '000000' }))).code).toBe('TOTP_INVALID');
    const session = await authAdminTotp(outcome.challenge.challengeToken, { code: MOCK.TOTP_CODE });
    expect(session.user.role).toBe('super_admin');
  });

  it('a recovery code works once', async () => {
    const first = await authSignin({ email: 'admin@metromatrix.app', password: STAFF_PASSWORD, portal: 'admin' });
    if (first.kind !== 'totp') throw new Error('expected a challenge');
    await authAdminTotp(first.challenge.challengeToken, { recoveryCode: 'MM7K-Q2PX' });
    const second = await authSignin({ email: 'admin@metromatrix.app', password: STAFF_PASSWORD, portal: 'admin' });
    if (second.kind !== 'totp') throw new Error('expected a challenge');
    // As on the API: a spent recovery code is just TOTP_INVALID.
    expect((await failure(authAdminTotp(second.challenge.challengeToken, { recoveryCode: 'MM7K-Q2PX' }))).code).toBe(
      'TOTP_INVALID',
    );
  });
});

describe('password reset', () => {
  it('email → code (with attempts) → new password → sign in', async () => {
    await authForgotPassword('customer@metromatrix.app');
    const wrong = await failure(authVerifyResetOtp('customer@metromatrix.app', '000000'));
    expect(wrong).toMatchObject({ code: 'OTP_INVALID', details: { attemptsLeft: MOCK.OTP_ATTEMPTS - 1 } });

    const token = await authVerifyResetOtp('customer@metromatrix.app', MOCK.RESET_OTP);
    await authResetPassword(token, 'Newpass2026');
    const outcome = await authSignin({ email: 'customer@metromatrix.app', password: 'Newpass2026', portal: 'customer' });
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

    // Reinstate needs a reason, as the API's ReasonDto.
    expect((await failure(reinstateBusiness('b_doctor', ''))).code).toBe('VALIDATION_FAILED');

    await clearTokens();
    await authSignin({ email: 'doctor@metromatrix.app', password: SEED_PASSWORD, portal: 'partner' });
    // As on the API: the partner still sees their own business; service routes answer 403.
    expect((await getMyBusiness())?.status).toBe('suspended');
    expect((await failure(doctorRoute())).code).toBe('BUSINESS_SUSPENDED');
  });

  /** A doctor-only route; like the API's service routes it answers 403 while the business is suspended. */
  const doctorRoute = () =>
    api.get('/healthcare/doctor/profile').catch(e => {
      throw toAuthError(e);
    });

  it('suspended mid-session: the 403 fires the stale bridge, /auth/me is re-read, and the gate shows Suspended', async () => {
    const outcome = await authSignin({ email: 'doctor@metromatrix.app', password: SEED_PASSWORD, portal: 'partner' });
    if (outcome.kind !== 'session') throw new Error('expected a session');
    const signedIn = { isAuthenticated: true, pendingTotp: null, ...outcome.result };
    expect(resolveGate(signedIn)).toBe('partner');

    // Staff suspend the business while the partner is using the app.
    const db = await getDb();
    db.businesses.find(b => b.ownerId === outcome.result.user.id)!.status = 'suspended';

    // AppContainer's bridge, as wired there: re-read the session.
    let reread: Awaited<ReturnType<typeof authMe>> | null = null;
    const bridge = jest.fn(async () => {
      reread = await authMe();
    });
    setBusinessStatusStaleHandler(() => void bridge());
    try {
      expect((await failure(doctorRoute())).code).toBe('BUSINESS_SUSPENDED');
      expect(bridge).toHaveBeenCalledTimes(1);
      await bridge.mock.results[0].value;
      expect(reread!.business?.status).toBe('suspended');
      expect(resolveGate({ isAuthenticated: true, pendingTotp: null, ...reread! })).toBe('suspended');
    } finally {
      setBusinessStatusStaleHandler(null);
    }
  });

  it("rejects with per-document notes ([{ documentId, note }]); pages as the API's Paged list", async () => {
    const outcome = await authSignin({ email: 'admin@metromatrix.app', password: STAFF_PASSWORD, portal: 'admin' });
    if (outcome.kind !== 'totp') throw new Error('expected a challenge');
    await authAdminTotp(outcome.challenge.challengeToken, { code: MOCK.TOTP_CODE });

    const kitchen = await getBusiness('b_kitchen');
    expect(kitchen.owner.name).toBeTruthy();
    const cnic = kitchen.documents.find(d => d.kind === 'cnic_front')!;
    const rejected = await rejectBusiness('b_kitchen', {
      reason: 'The CNIC photo is too blurry to read.',
      documentNotes: [{ documentId: cnic.id, note: 'Retake in daylight.' }],
    });
    expect(rejected.status).toBe('rejected');
    expect(rejected.documents.find(d => d.id === cnic.id)).toMatchObject({ status: 'rejected', reviewerNote: 'Retake in daylight.' });
    expect(rejected.missingDocuments).toEqual(['cnic_front']);

    const approved = await listBusinesses({ status: 'approved' });
    expect(approved.items.length).toBeGreaterThan(0);
    expect(approved.items.every(b => b.status === 'approved')).toBe(true);
  });
});
