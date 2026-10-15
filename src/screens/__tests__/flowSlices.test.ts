// Reducer behaviour of the screen slices the QA matrix leans on: the email
// link check, resend countdowns, the three reset-password steps, the
// multi-step profile forms, DOCUMENTS_MISSING, the TOTP step and the
// approval queue.

import { emailVerificationSlice } from '../Auth/EmailVerification/emailVerificationSlice';
import { forgotPasswordSlice } from '../Auth/ForgotPassword/forgotPasswordSlice';
import { resetPasswordOtpSlice } from '../Auth/ResetPasswordOTP/resetPasswordOtpSlice';
import { resetPasswordSlice } from '../Auth/ResetPassword/resetPasswordSlice';
import { completeProfileSlice } from '../Auth/CompleteProfile/completeProfileSlice';
import { personalInfoSlice } from '../Partner/PersonalInfo/personalInfoSlice';
import { providerApprovalPendingSlice } from '../Partner/ProviderApprovalPending/providerApprovalPendingSlice';
import { providerSelectionSlice } from '../ProviderSelection/providerSelectionSlice';
import { adminTotpSlice } from '../Admin/AdminTotp/adminTotpSlice';
import { approvalQueueSlice } from '../Admin/ApprovalQueue/approvalQueueSlice';
import type { Business, BusinessSummary } from '../../types/auth';
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
    const s = reducer(init(reducer), actions.resendAsync.fulfilled(45, 'r', undefined));
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
  it('Forgot Password starts the resend countdown the OTP screen reads', () => {
    const { reducer, actions } = forgotPasswordSlice;
    const before = Date.now();
    const s = reducer(init(reducer), actions.requestCodeAsync.fulfilled(60, 'r', 'a@x.com'));
    expect(s.status).toBe('succeeded');
    expect(s.resendAvailableAt).toBeGreaterThanOrEqual(before + 60_000);
  });

  it('a wrong code counts down attempts and clears the input', () => {
    const { reducer, actions } = resetPasswordOtpSlice;
    let s = reducer(init(reducer), actions.setCode('111111'));
    s = reducer(
      s,
      actions.verifyCodeAsync.rejected(null, 'r', { email: 'a@x.com', code: '111111' }, {
        message: 'Wrong code',
        code: 'INVALID_OTP',
        details: { attemptsLeft: 3 },
      }),
    );
    expect(s).toMatchObject({ attemptsLeft: 3, code: '' });
  });

  it('OTP_LOCKED ends the attempt', () => {
    const { reducer, actions } = resetPasswordOtpSlice;
    const s = reducer(
      init(reducer),
      actions.verifyCodeAsync.rejected(null, 'r', { email: 'a@x.com', code: '111111' }, { message: 'Locked', code: 'OTP_LOCKED' }),
    );
    expect(s.attemptsLeft).toBe(0);
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
        details: { missing: ['medical_license'] },
      }),
    );
    expect(s).toMatchObject({ step: 3, highlight: ['medical_license'] });
  });
});

describe('providerApprovalPendingSlice', () => {
  const { reducer, actions } = providerApprovalPendingSlice;
  it('counts checks and schedules the next one 30 s out', () => {
    const before = Date.now();
    const s = reducer(init(reducer), actions.checkStatusAsync.fulfilled('pending_approval', 'r', { manual: false }));
    expect(s.checks).toBe(1);
    expect(s.nextCheckAt).toBeGreaterThanOrEqual(before + 30_000);
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
});

describe('adminTotpSlice (QA 20, 23)', () => {
  const { reducer, actions } = adminTotpSlice;

  it('explains a reused recovery code', () => {
    const s = reducer(
      { ...init(reducer), useRecovery: true },
      actions.verifyTotpAsync.rejected(null, 'r', { challengeToken: 'c', recoveryCode: 'AAAA' }, {
        message: 'Used',
        code: 'RECOVERY_CODE_USED',
      }),
    );
    expect(s.error.message).toMatch(/already been used/);
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
