// ═══════════════════════════════════════════════════════
// Live integration run against a real MetroMatrix API (AUTH_PLAN D5)
// ═══════════════════════════════════════════════════════
// Skipped unless LIVE_API_URL is set:
//   LIVE_API_URL=http://localhost:3000/api/v1 LIVE_MAIL_LOG=<the API's console log> npx jest src/__live__
// The API must run with the console mail transport (MAIL_HOST empty): links
// and codes are read from LIVE_MAIL_LOG. Everything goes through the App's
// own networks, token storage, error mapping and session gate; only the file
// transfer to Cloudinary is skipped (the URL Cloudinary would return is built
// from the signed folder). Steps (letters as in the progress file):
//   a customer sign-up → link → verified          (signed out, as from email)
//   c complete profile → customer; wrong door      d refresh rotation + reuse detection
//   e forgot password → code → reset               f change password
//   g a second device's session ends               i partner onboarding → submit
//   j staff TOTP enrol → reject (note) → resubmit → approve
//   k suspended mid-session → Suspended; reinstate l sign-out revokes; delete account
//   b (in-app deep link) is run by hand on the emulator; h (rider) is BLOCKED.

jest.mock('../config/env', () => ({
  ...jest.requireActual('../config/env'),
  API_BASE_URL: process.env.LIVE_API_URL ?? 'http://live.invalid/api/v1',
  CONFIG_ERROR: false,
}));

import { createHmac } from 'crypto';
import { readFileSync } from 'fs';
import { api, refreshClient, refreshTokens, toApiError, unwrap } from '../networks/network/apiHelpers';
import { clearTokens, getAccessToken, getRefreshToken, setTokens } from '../utils/storageUtils';
import { setBusinessStatusStaleHandler } from '../utils/authEvents';
import * as auth from '../networks/auth/authNetwork';
import * as users from '../networks/users/usersNetwork';
import * as media from '../networks/media/mediaNetwork';
import * as biz from '../networks/businesses/businessNetwork';
import * as admin from '../networks/admin/adminBusinessNetwork';
import { resolveGate, partnerAppFor } from '../navigators/sessionGate';
import { doorForAccount } from '../models/authDoors';
import { documentSlots } from '../models/businessModel';
import type { ApiError } from '../networks/network/apiHelpers';
import type { DocumentKind } from '../types/auth';

const LIVE = process.env.LIVE_API_URL;
const MAIL_LOG = process.env.LIVE_MAIL_LOG ?? '';
const live = LIVE ? describe : describe.skip;

jest.setTimeout(300_000);

// ─── Helpers ─────────────────────────────────────────
const run = Date.now().toString(36);
const email = (who: string) => `live.${run}.${who}@example.com`;
const PASSWORD = 'Metro2026Live';
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

interface Session {
  access: string;
  refresh: string;
}
/** Make `s` the stored session (the App's storage), as one device would hold it. */
const use = async (s: Session) => setTokens(s.access, s.refresh);
/** Read the stored session back (calls may have rotated it). */
const stored = async (): Promise<Session> => ({ access: (await getAccessToken())!, refresh: (await getRefreshToken())! });

/**
 * Sign-in is limited to 5 a minute per IP and this run signs in more often:
 * on RATE_LIMITED, wait as long as the API says (as a person would) and try
 * again, up to 3 times (the window rolls, so one wait may not be enough).
 */
const signin = async (...args: Parameters<typeof auth.authSignin>) => {
  for (let attempt = 1; ; attempt++) {
    try {
      return await auth.authSignin(...args);
    } catch (e) {
      const err = e as ApiError;
      if (err.code !== 'RATE_LIMITED' || attempt > 3) throw e;
      await sleep((Number(err.details?.retryAfter) || 60) * 1000 + 1000);
    }
  }
};

const failure = async (p: Promise<unknown>): Promise<ApiError> => {
  try {
    await p;
  } catch (e) {
    return e as ApiError;
  }
  throw new Error('expected the call to fail');
};

/** The newest console email to `to` whose text matches `re`, waiting for it (some go out after the response). */
const mailMatch = async (to: string, re: RegExp): Promise<RegExpMatchArray> => {
  for (let i = 0; i < 40; i++) {
    const blocks = readFileSync(MAIL_LOG, 'utf8').split('[DEV EMAIL]').filter(b => b.includes(`To: ${to}`));
    for (const b of blocks.reverse()) {
      const m = b.match(re);
      if (m) return m;
    }
    await sleep(250);
  }
  throw new Error(`no email to ${to} matching ${re}`);
};
const linkToken = (to: string) => mailMatch(to, /verify-email\?token=([A-Za-z0-9_-]+)/).then(m => m[1]);
const resetCode = (to: string) => mailMatch(to, /reset code is: (\d{6})/).then(m => m[1]);

/** RFC 6238 TOTP (SHA-1, 30 s, 6 digits), as an authenticator app computes it. */
const totp = (base32: string, at = Date.now()): string => {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  let bits = '';
  for (const c of base32.replace(/=+$/, '').toUpperCase()) bits += alphabet.indexOf(c).toString(2).padStart(5, '0');
  const key = Buffer.from(bits.match(/.{8}/g)!.map(b => parseInt(b, 2)));
  const counter = Buffer.alloc(8);
  counter.writeBigUInt64BE(BigInt(Math.floor(at / 30_000)));
  const h = createHmac('sha1', key).update(counter).digest();
  const o = h[h.length - 1] & 0xf;
  return String((h.readUInt32BE(o) & 0x7fffffff) % 1_000_000).padStart(6, '0');
};

/** What Cloudinary would answer for an upload signed into `folder` (the transfer itself is BLOCKED locally). */
const fakeUpload = (signed: { cloudName: string; folder: string }, name: string) => ({
  url: `https://res.cloudinary.com/${signed.cloudName}/image/upload/v1/${signed.folder}/${name}.jpg`,
  publicId: `${signed.folder}/${name}`,
});

const gateOf = (s: { user: Parameters<typeof resolveGate>[0]['user']; business: Parameters<typeof resolveGate>[0]['business'] }) =>
  resolveGate({ isAuthenticated: true, pendingTotp: null, ...s });

// ─── The run ─────────────────────────────────────────
live('live run against the local API', () => {
  const sessions: Record<string, Session> = {};
  let partnerBusinessId = '';
  let adminSecret = '';

  beforeAll(() => {
    // Jest loads axios's browser build (no Node http adapter) and RN's
    // environment has no real XHR; Node's own fetch does the network.
    api.defaults.adapter = 'fetch';
    refreshClient.defaults.adapter = 'fetch';
  });
  beforeEach(() => clearTokens());

  it('a. customer sign-up → verification link (opened signed out) → verified; the gate asks for the profile', async () => {
    const signedUp = await auth.authSignup({ name: 'Live Customer', email: email('cust'), phone: '+923124890176', password: PASSWORD, portal: 'customer' });
    expect(signedUp.user).toMatchObject({ role: 'customer', isEmailVerified: false });
    expect(gateOf(signedUp)).toBe('verify');
    sessions.cust = await stored();

    const token = await linkToken(email('cust'));
    await clearTokens(); // the link is opened on another device / signed out
    const verified = await auth.authVerifyEmail(token);
    expect(verified.user.isEmailVerified).toBe(true);
    // The same link again: still fine for a verified owner.
    expect((await auth.authVerifyEmail(token)).user.isEmailVerified).toBe(true);

    await use(sessions.cust);
    const me = await auth.authMe();
    expect(gateOf(me)).toBe('completeProfile');
  });

  it('c. complete profile → customer app; a customer on the provider door is sent to the User door', async () => {
    await use(sessions.cust);
    const user = await users.completeProfile({ dateOfBirth: '1998-02-14', gender: 'female', streetAddress: '7 Canal View, Johar Town', city: 'Lahore', postalCode: '54000' });
    expect(user.profileComplete).toBe(true);
    expect(gateOf(await auth.authMe())).toBe('customer');

    const wrong = await failure(signin({ email: email('cust'), password: PASSWORD, portal: 'partner' }));
    expect(wrong.code).toBe('WRONG_PORTAL');
    expect(doorForAccount(wrong.details?.accountType)).toBe('customer');
  });

  it('d. refresh rotates the pair; replaying the old refresh token is REFRESH_REUSED and ends the family', async () => {
    await use(sessions.cust);
    const before = await stored();
    await refreshTokens();
    const after = await stored();
    expect(after.refresh).not.toBe(before.refresh);

    await sleep(11_000); // past the API's 10 s reuse grace
    const replay = await refreshClient.post('/auth/refresh-token', { refreshToken: before.refresh }).catch(e => toApiError(e));
    expect((replay as ApiError).code).toBe('REFRESH_REUSED');
    // The whole family is gone, the newest token included.
    const next = await refreshClient.post('/auth/refresh-token', { refreshToken: after.refresh }).catch(e => toApiError(e));
    expect(['REFRESH_INVALID', 'TOKEN_REVOKED', 'REFRESH_REUSED']).toContain((next as ApiError).code);
  });

  it('e. forgot password → emailed code → reset; the old password and old sessions stop working', async () => {
    const outcome = await signin({ email: email('cust'), password: PASSWORD, portal: 'customer' });
    if (outcome.kind !== 'session') throw new Error('expected a session');
    const oldSession = await stored();

    await clearTokens();
    await auth.authForgotPassword(email('cust'));
    const code = await resetCode(email('cust'));
    expect((await failure(auth.authVerifyResetOtp(email('cust'), code === '000000' ? '111111' : '000000'))).code).toBe('OTP_INVALID');
    const resetToken = await auth.authVerifyResetOtp(email('cust'), code);
    await auth.authResetPassword(resetToken, 'Metro2026Reset');

    expect((await failure(signin({ email: email('cust'), password: PASSWORD, portal: 'customer' }))).code).toBe('INVALID_CREDENTIALS');
    const dead = await refreshClient.post('/auth/refresh-token', { refreshToken: oldSession.refresh }).catch(e => toApiError(e));
    // A token revoked without rotation (sign-out, reset) is answered REFRESH_REUSED today: see the
    // finding in AUTH_PROGRESS.md. Either way the App ends the session.
    expect((dead as ApiError).code).toMatch(/REFRESH_INVALID|TOKEN_REVOKED|REFRESH_REUSED/);
    const ok = await signin({ email: email('cust'), password: 'Metro2026Reset', portal: 'customer' });
    expect(ok.kind).toBe('session');
    sessions.cust = await stored();
  });

  it('f + g. change password on device A: A keeps a fresh session, device B is signed out', async () => {
    // Device B signs in first.
    await signin({ email: email('cust'), password: 'Metro2026Reset', portal: 'customer' });
    const deviceB = await stored();

    await use(sessions.cust); // device A
    const me = await auth.authChangePassword({ currentPassword: 'Metro2026Reset', newPassword: 'Metro2026Changed' });
    expect(me.user.email).toBe(email('cust'));
    sessions.cust = await stored();
    expect((await auth.authMe()).user.role).toBe('customer'); // A's new pair works

    const b = await refreshClient.post('/auth/refresh-token', { refreshToken: deviceB.refresh }).catch(e => toApiError(e));
    expect((b as ApiError).code).toMatch(/REFRESH_INVALID|TOKEN_REVOKED|REFRESH_REUSED/);
    await use(deviceB);
    expect((await failure(api.get('/auth/me').then(unwrap))).toString()).toBeTruthy();
  });

  it('i. partner: sign-up → verify → business → documents (signed upload) → submit; the gate shows Approval Pending', async () => {
    const signedUp = await auth.authSignup({ name: 'Live Kitchen', email: email('kitchen'), phone: '', password: PASSWORD, portal: 'partner' });
    sessions.kitchen = await stored();
    await auth.authVerifyEmail(await linkToken(email('kitchen')));
    expect(signedUp.user.role).toBe('partner');

    await use(sessions.kitchen);
    expect(gateOf(await auth.authMe())).toBe('partnerSetup');
    await users.updateMe({ name: 'Live Kitchen', phone: '+923001112233' });
    const draft = await biz.createBusiness({ serviceType: 'food', subType: 'home_kitchen', name: `Live Kitchen ${run}`, phone: '+923001112233', city: 'Lahore', addressLine: '9 Garden Town, Lahore', lat: 31.5204, lng: 74.3587 });
    partnerBusinessId = draft.id;
    expect(draft).toMatchObject({ status: 'draft', address: '9 Garden Town, Lahore', location: { lat: 31.5204, lng: 74.3587 } });
    expect(draft.missingDocuments).toEqual(['cnic_front', 'cnic_back', 'kitchen_photo']);

    const missing = await failure(biz.submitBusiness());
    expect(missing.code).toBe('DOCUMENTS_MISSING');
    expect(missing.details?.missing).toEqual(['cnic_front', 'cnic_back', 'kitchen_photo']);

    const signed = await media.signUpload('business_document');
    expect(signed).toMatchObject({ cloudName: expect.any(String), maxBytes: 10_000_000 });
    expect(signed.allowedFormats).toContain('pdf');
    // A kind the sub-type doesn't need is refused.
    expect((await failure(biz.addDocument({ kind: 'pmdc_certificate', ...fakeUpload(signed, 'pmdc') }))).code).toBe('VALIDATION_FAILED');
    // A URL outside this user's folder is refused.
    expect((await failure(biz.addDocument({ kind: 'cnic_front', url: 'https://res.cloudinary.com/mm-live-local/image/upload/v1/elsewhere/x.jpg', publicId: 'elsewhere/x' }))).code).toBe('VALIDATION_FAILED');

    let business = draft;
    for (const [kind, name] of [['cnic_front', 'front'], ['cnic_back', 'back'], ['kitchen_photo', 'k1'], ['kitchen_photo', 'k2']] as [DocumentKind, string][]) {
      business = await biz.addDocument({ kind, ...fakeUpload(signed, `${name}-${run}`) });
    }
    expect(business.missingDocuments).toEqual([]);
    expect(documentSlots('home_kitchen', business.documents).every(s => s.doc)).toBe(true);

    const submitted = await biz.submitBusiness();
    expect(submitted.status).toBe('pending_approval');
    expect((await biz.getMyBusinessStatus()).status).toBe('pending_approval');
    expect(gateOf(await auth.authMe())).toBe('pending');
  });

  it('j. staff: TOTP enrolment on first sign-in → reject with a document note → partner resubmits → approve → kitchen app', async () => {
    const first = await signin({ email: 'live-admin@metromatrix.local', password: 'LiveAdmin2026!', portal: 'admin' });
    if (first.kind !== 'totp') throw new Error('expected a TOTP challenge');
    expect(first.challenge.totpEnrolled).toBe(false);
    const enrolment = await admin.adminTotpEnrol(first.challenge.challengeToken);
    adminSecret = enrolment.secret;
    expect(enrolment.otpauthUrl).toMatch(/^otpauth:\/\/totp\//);
    const { result, recoveryCodes } = await admin.adminTotpConfirm(first.challenge.challengeToken, totp(adminSecret));
    expect(recoveryCodes).toHaveLength(10);
    expect(gateOf(result)).toBe('admin');
    sessions.admin = await stored();

    const queue = await admin.listBusinesses({ status: 'pending_approval', q: run });
    expect(queue.items.map(b => b.id)).toContain(partnerBusinessId);
    const detail = await admin.getBusiness(partnerBusinessId);
    expect(detail.owner.email).toBe(email('kitchen'));
    const photo = detail.documents.find(d => d.kind === 'kitchen_photo')!;
    const rejected = await admin.rejectBusiness(partnerBusinessId, {
      reason: 'One kitchen photo is too dark to see the cooking area.',
      documentNotes: [{ documentId: photo.id, note: 'Retake it in daylight.' }],
    });
    expect(rejected.status).toBe('rejected');
    await mailMatch(email('kitchen'), /Open MetroMatrix: metromatrix:\/\//);

    // The partner sees why, fixes that photo and resubmits.
    await use(sessions.kitchen);
    const me = await auth.authMe();
    expect(gateOf(me)).toBe('rejected');
    const mine = await biz.getMyBusiness();
    expect(mine!.documents.find(d => d.id === photo.id)).toMatchObject({ status: 'rejected', reviewerNote: 'Retake it in daylight.' });
    expect(mine!.missingDocuments).toEqual(['kitchen_photo']);
    const signed = await media.signUpload('business_document');
    await biz.addDocument({ kind: 'kitchen_photo', ...fakeUpload(signed, `k3-${run}`) });
    const fixed = await biz.removeDocument(photo.id);
    expect(fixed.missingDocuments).toEqual([]);
    expect((await biz.submitBusiness()).status).toBe('pending_approval');

    await use(sessions.admin);
    expect((await admin.approveBusiness(partnerBusinessId)).status).toBe('approved');

    await use(sessions.kitchen);
    const approved = await auth.authMe();
    expect(gateOf(approved)).toBe('partner');
    expect(partnerAppFor(approved.business)).toBe('kitchen');
  });

  it('k. suspended: a kitchen sees it on the next /auth/me; a store mid-session gets 403 on a service route → Suspended; reinstate needs a reason', async () => {
    // Kitchen (no Food routes exist): /businesses/me stays readable, the session read shows Suspended.
    await use(sessions.admin);
    expect((await admin.suspendBusiness(partnerBusinessId, 'Repeated late deliveries this week.')).status).toBe('suspended');
    await use(sessions.kitchen);
    expect((await biz.getMyBusiness())!.status).toBe('suspended');
    expect(gateOf(await auth.authMe())).toBe('suspended');
    await use(sessions.admin);
    expect((await failure(admin.reinstateBusiness(partnerBusinessId, ''))).code).toBe('VALIDATION_FAILED');
    expect((await admin.reinstateBusiness(partnerBusinessId, 'Deliveries are back on time.')).status).toBe('approved');
    await use(sessions.kitchen);
    expect(gateOf(await auth.authMe())).toBe('partner');

    // Store: onboard and approve, then suspend while it is using a guarded shopping route.
    await auth.authSignup({ name: 'Live Store', email: email('store'), phone: '', password: PASSWORD, portal: 'partner' });
    sessions.store = await stored();
    await auth.authVerifyEmail(await linkToken(email('store')));
    await use(sessions.store);
    const store = await biz.createBusiness({ serviceType: 'shopping', subType: 'store', name: `Live Store ${run}`, phone: '+923001112244', city: 'Lahore', addressLine: '21 Liberty Market, Gulberg' });
    const signed = await media.signUpload('business_document');
    for (const [kind, name] of [['cnic_front', 'sf'], ['cnic_back', 'sb'], ['shop_photo', 'shop']] as [DocumentKind, string][]) {
      await biz.addDocument({ kind, ...fakeUpload(signed, `${name}-${run}`) });
    }
    await biz.submitBusiness();
    await use(sessions.admin);
    await admin.approveBusiness(store.id);
    await use(sessions.store);
    const approved = await auth.authMe();
    expect(partnerAppFor(approved.business)).toBe('store');
    const couponsBefore = await api.get('/shop/partner/coupons').catch(e => toApiError(e));
    expect((couponsBefore as ApiError).code).not.toBe('BUSINESS_SUSPENDED');

    await use(sessions.admin);
    await admin.suspendBusiness(store.id, 'Counterfeit goods reported by customers.');
    await use(sessions.store);
    let reread: Awaited<ReturnType<typeof auth.authMe>> | null = null;
    setBusinessStatusStaleHandler(() => void auth.authMe().then(s => (reread = s)));
    try {
      const coupons = await api.get('/shop/partner/coupons').catch(e => toApiError(e));
      expect((coupons as ApiError).code).toBe('BUSINESS_SUSPENDED');
      for (let i = 0; i < 30 && !reread; i++) await sleep(100);
      expect(gateOf(reread!)).toBe('suspended');
    } finally {
      setBusinessStatusStaleHandler(null);
    }
  });

  it('l. sign-out revokes the session (no body); deleting the account stops sign-in', async () => {
    await use(sessions.kitchen);
    const s = await stored();
    await auth.authLogout(s.access);
    const after = await refreshClient.post('/auth/refresh-token', { refreshToken: s.refresh }).catch(e => toApiError(e));
    expect((after as ApiError).code).toMatch(/REFRESH_INVALID|TOKEN_REVOKED|REFRESH_REUSED/);

    await use(sessions.cust);
    await auth.authDeleteAccount({ password: 'Metro2026Changed' });
    expect((await failure(signin({ email: email('cust'), password: 'Metro2026Changed', portal: 'customer' }))).code).toBe('INVALID_CREDENTIALS');
  });
});
