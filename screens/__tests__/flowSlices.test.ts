// Reducer behaviour of the screen slices the QA matrix leans on: the email
// link check, resend countdowns, the three reset-password steps, the
// multi-step profile forms, DOCUMENTS_MISSING, the TOTP step and the
// approval queue.

import { emailVerificationSlice } from '../email-verification-screen/emailVerificationSlice';
import { forgotPasswordSlice } from '../forgot-password-screen/forgotPasswordSlice';
import { resetPasswordOtpSlice } from '../reset-password-otp-screen/resetPasswordOtpSlice';
import { resetPasswordSlice } from '../reset-password-screen/resetPasswordSlice';
import { completeProfileSlice } from '../complete-profile-screen/completeProfileSlice';
import { personalInfoSlice } from '../personal-info-screen/personalInfoSlice';
import { providerApprovalPendingSlice } from '../provider-approval-pending-screen/providerApprovalPendingSlice';
import { providerSelectionSlice } from '../provider-selection-screen/providerSelectionSlice';
import { adminTotpSlice } from '../admin-totp-screen/adminTotpSlice';
import { approvalQueueSlice } from '../approval-queue-screen/approvalQueueSlice';
import { resetAllState } from '../../store/resetAllState';
import type { Business, BusinessSummary } from '../../models/auth';
import { makeUser } from '../../__fixtures__/users';

const init = <S>(reducer: (s: S | undefined, a: { type: string }) => S) => reducer(undefined, { type: '@@init' });

describe('emailVerificationSlice (link based, as in the FYP)', () => {
  const { reducer, actions } = emailVerificationSlice;

  it('"I Verified My Email" before the link was opened says so', () => {
    const s = reducer(init(reducer), actions.checkVerifiedAsync.fulfilled(false, 'r', { silent: false }));
    expect(s.status).toBe('failed');
    expect(s.error.code).toBe('NOT_VERIFIED');
    expect(s.autoSignIn).toBe(false);
  });

  it('the silent re-check never shows "not yet"', () => {
    const s = reducer(init(reducer), actions.checkVerifiedAsync.fulfilled(false, 'r', { silent: true }));
    expect(s.error.message).toBe('');
    expect(s.checks).toBe(1);
  });

  it('a verified link switches to "signing you in automatically"', () => {
    const s = reducer(init(reducer), actions.checkVerifiedAsync.fulfilled(true, 'r', { silent: true }));
    expect(s).toMatchObject({ autoSignIn: true, status: 'succeeded' });
  });

  it('takes the resend countdown from the server (QA 6)', () => {
    const before = Date.now();
    const s = reducer(init(reducer), actions.resendAsync.fulfilled({ retryAfter: 45, alreadyVerified: false }, 'r', undefined));
    expect(s.resendAvailableAt).toBeGreaterThanOrEqual(before + 45_000);
    expect(s.resendAvailableAt).toBeLessThan(before + 46_000);
  });

  it('starts the first 60 s countdown only once', () => {
    const first = reducer(init(reducer), actions.startCooldownIfIdle());
    const again = reducer(first, actions.startCooldownIfIdle());
    expect(again.resendAvailableAt).toBe(first.resendAvailableAt);
  });
});

describe('password reset — three screens, three slices (QA 11)', () => {
  it("Forgot Password starts the client's own 60 s resend countdown the OTP screen reads", () => {
    const { reducer, actions } = forgotPasswordSlice;
    const before = Date.now();
    const s = reducer(init(reducer), actions.requestCodeAsync.fulfilled(true, 'r', 'a@x.com'));
    expect(s.status).toBe('succeeded');
    expect(s.resendAvailableAt).toBeGreaterThanOrEqual(before + 60_000);
    expect(s.resendAvailableAt).toBeLessThan(before + 61_000);
  });

  it('a throttled request (429 RATE_LIMITED) restarts the countdown from retryAfter', () => {
    const { reducer, actions } = forgotPasswordSlice;
    const before = Date.now();
    const s = reducer(
      init(reducer),
      actions.requestCodeAsync.rejected(null, 'r', 'a@x.com', { message: 'Slow down', code: 'RATE_LIMITED', details: { retryAfter: 300 } }),
    );
    expect(s.resendAvailableAt).toBeGreaterThanOrEqual(before + 300_000);
  });

  it('OTP_INVALID counts down attempts, shows them and clears the input', () => {
    const { reducer, actions } = resetPasswordOtpSlice;
    let s = reducer(init(reducer), actions.setCode('111111'));
    s = reducer(
      s,
      actions.verifyCodeAsync.rejected(null, 'r', { email: 'a@x.com', code: '111111' }, {
        message: 'Wrong code',
        code: 'OTP_INVALID',
        details: { attemptsLeft: 3 },
      }),
    );
    expect(s).toMatchObject({ attemptsLeft: 3, code: '', needsNewCode: false });
    expect(s.error.message).toBe("That code isn't right.");
  });

  it.each([
    ['OTP_LOCKED', 'Too many attempts'],
    ['OTP_EXPIRED', 'expired'],
  ])('%s ends this code: only a new one (Resend) helps', (code, copy) => {
    const { reducer, actions } = resetPasswordOtpSlice;
    const s = reducer(
      init(reducer),
      actions.verifyCodeAsync.rejected(null, 'r', { email: 'a@x.com', code: '111111' }, { message: 'x', code }),
    );
    expect(s.needsNewCode).toBe(true);
    expect(s.error.message).toContain(copy);
    // Typing again doesn't hide why the code can't work.
    expect(reducer(s, actions.setCode('1')).error.code).toBe(code);
  });

  it('an accepted code keeps the reset token in the slice, not a route param', () => {
    const { reducer, actions } = resetPasswordOtpSlice;
    const s = reducer(init(reducer), actions.verifyCodeAsync.fulfilled('reset-token', 'r', { email: 'a@x.com', code: '123456' }));
    expect(s.resetToken).toBe('reset-token');
  });

  it('a successful reset clears the new password', () => {
    const { reducer, actions } = resetPasswordSlice;
    let s = reducer(init(reducer), actions.setField({ field: 'password', value: 'Metro2026' }));
    s = reducer(s, actions.resetPasswordAsync.fulfilled(true, 'r', { resetToken: 't', password: 'Metro2026' }));
    expect(s).toMatchObject({ status: 'succeeded', password: '', confirmPassword: '' });
  });
});

describe('completeProfileSlice (3 steps)', () => {
  const { reducer, actions } = completeProfileSlice;

  it('touching a step marks only that step\'s fields', () => {
    const s = reducer(init(reducer), actions.touchStep());
    expect(s.touched).toEqual({ dateOfBirth: true, gender: true });
  });

  it('server field errors send the user back to the step that owns them', () => {
    const s = reducer(
      { ...init(reducer), step: 3 as const },
      actions.submitProfileAsync.rejected(null, 'r', {} as never, {
        message: 'Invalid',
        code: 'VALIDATION_ERROR',
        details: { fields: { city: 'Unknown city' } },
      }),
    );
    expect(s.step).toBe(2);
  });

  it('a photo upload keeps its preview and resolves to the stored url', () => {
    const file = { uri: 'file:///me.jpg', name: 'me.jpg', mimeType: 'image/jpeg' };
    let s = reducer(init(reducer), actions.uploadPhotoAsync.pending('r', file));
    expect(s.photo).toMatchObject({ status: 'uploading', previewUri: 'file:///me.jpg' });
    s = reducer(s, actions.uploadPhotoAsync.fulfilled('https://cdn/me.jpg', 'r', file));
    expect(s.photo).toMatchObject({ status: 'uploaded', url: 'https://cdn/me.jpg' });
  });
});

describe('personalInfoSlice (providers, 3 steps)', () => {
  const { reducer, actions } = personalInfoSlice;
  const provider = makeUser({ role: 'partner', name: 'Ayesha Khan', phone: '+923001234567', providerSubType: 'doctor' });

  it('prefills from the account and resumes a saved draft at the documents step (QA 15)', () => {
    const draft = { id: 'b1', name: 'Clinic', city: 'Lahore', address: 'Main Boulevard', details: {}, location: null } as unknown as Business;
    const fresh = reducer(init(reducer), actions.initialise({ user: provider, business: null }));
    expect(fresh).toMatchObject({ step: 1, fullName: 'Ayesha Khan', phone: '3001234567' });
    const resumed = reducer(init(reducer), actions.initialise({ user: provider, business: draft }));
    expect(resumed.step).toBe(3);
  });

  it('DOCUMENTS_MISSING highlights the tiles the server named (QA 17)', () => {
    const s = reducer(
      init(reducer),
      actions.submitApplicationAsync.rejected(null, 'r', undefined, {
        message: 'Missing documents',
        code: 'DOCUMENTS_MISSING',
        details: { missing: ['pmdc_certificate', 'ntn_certificate|shop_photo'] },
      }),
    );
    expect(s).toMatchObject({ step: 3, highlight: ['pmdc_certificate', 'ntn_certificate|shop_photo'] });
  });
});

describe('providerApprovalPendingSlice', () => {
  const { reducer, actions } = providerApprovalPendingSlice;
  it('counts checks and schedules the next one 10 s out (the planned poll interval)', () => {
    const before = Date.now();
    const s = reducer(init(reducer), actions.checkStatusAsync.fulfilled('pending_approval', 'r', { manual: false }));
    expect(s.checks).toBe(1);
    expect(s.nextCheckAt).toBeGreaterThanOrEqual(before + 10_000);
  });
  it('a failed silent poll stays quiet; a failed Check Now says so', () => {
    const quiet = reducer(
      reducer(init(reducer), actions.checkStatusAsync.pending('r', { manual: false })),
      actions.checkStatusAsync.rejected(null, 'r', { manual: false }, { message: 'Offline' }),
    );
    expect(quiet.error.message).toBe('');
    const loud = reducer(
      reducer(init(reducer), actions.checkStatusAsync.pending('r', { manual: true })),
      actions.checkStatusAsync.rejected(null, 'r', { manual: true }, { message: 'Offline' }),
    );
    expect(loud.error.message).toBe('Offline');
  });
});

describe('providerSelectionSlice', () => {
  const { reducer, actions } = providerSelectionSlice;
  it('Food needs a kitchen type before it can continue', () => {
    let s = reducer(init(reducer), actions.chooseService('food'));
    expect(s.subType).toBeNull();
    s = reducer(s, actions.chooseKitchen('home_kitchen'));
    expect(s).toMatchObject({ serviceType: 'food', subType: 'home_kitchen' });
  });
  it('Doctor and Vendor carry their one sub-type', () => {
    expect(reducer(init(reducer), actions.chooseService('healthcare')).subType).toBe('doctor');
    expect(reducer(init(reducer), actions.chooseService('shopping')).subType).toBe('store');
  });
  it('keeps the signed-up pick as pending until the account is reset', () => {
    let s = reducer(init(reducer), actions.rememberPendingPick({ serviceType: 'food', subType: 'cloud_kitchen' }));
    expect(s.pending).toEqual({ serviceType: 'food', subType: 'cloud_kitchen' });
    s = reducer(s, resetAllState());
    expect(s.pending).toBeNull();
  });
});

describe('adminTotpSlice (QA 20, 23)', () => {
  const { reducer, actions } = adminTotpSlice;

  it('explains a wrong or reused recovery code (the API says TOTP_INVALID for both)', () => {
    const s = reducer(
      { ...init(reducer), useRecovery: true },
      actions.verifyTotpAsync.rejected(null, 'r', { challengeToken: 'c', recoveryCode: 'AAAA' }, {
        message: 'That code is not right.',
        code: 'TOTP_INVALID',
      }),
    );
    expect(s.error.message).toMatch(/already been used/);
  });

  it('a wrong or replayed TOTP code says to wait for the next one', () => {
    const s = reducer(
      init(reducer),
      actions.verifyTotpAsync.rejected(null, 'r', { challengeToken: 'c', code: '123456' }, {
        message: 'That code is not right.',
        code: 'TOTP_INVALID',
      }),
    );
    expect(s.error.message).toMatch(/next code/);
  });

  it('toggling recovery mode clears both inputs', () => {
    let s = reducer(init(reducer), actions.setCode('123'));
    s = reducer(s, actions.toggleRecovery());
    expect(s).toMatchObject({ useRecovery: true, code: '', recoveryCode: '' });
  });
});

describe('approvalQueueSlice', () => {
  const { reducer, actions } = approvalQueueSlice;
  const row = (id: string) => ({ id }) as BusinessSummary;

  it('pages per tab and drops a decided row from every tab', () => {
    let s = reducer(
      init(reducer),
      actions.loadQueueAsync.fulfilled({ items: [row('a'), row('b')], nextCursor: 'c2' }, 'r', {
        tab: 'all',
        mode: 'initial',
      }),
    );
    s = reducer(
      s,
      actions.loadQueueAsync.fulfilled({ items: [row('c')], nextCursor: null }, 'r', {
        tab: 'all',
        mode: 'more',
        cursor: 'c2',
      }),
    );
    expect(s.lists.all.items.map(b => b.id)).toEqual(['a', 'b', 'c']);
    expect(s.lists.all.nextCursor).toBeNull();
    s = reducer(s, actions.removeFromQueue('b'));
    expect(s.lists.all.items.map(b => b.id)).toEqual(['a', 'c']);
  });
});
