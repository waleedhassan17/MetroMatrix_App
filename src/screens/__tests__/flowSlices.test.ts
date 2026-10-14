// Reducer behaviour of the screen slices the QA matrix leans on: OTP
// attempts and lock-out, resend countdowns, the reset-password steps,
// DOCUMENTS_MISSING, the TOTP step and the approval queue.

import { emailVerificationSlice } from '../Auth/EmailVerification/emailVerificationSlice';
import { forgotPasswordSlice } from '../Auth/ForgotPassword/forgotPasswordSlice';
import { reviewSubmitSlice } from '../Partner/ReviewSubmit/reviewSubmitSlice';
import { adminSignInSlice } from '../Admin/AdminSignIn/adminSignInSlice';
import { approvalQueueSlice } from '../Admin/ApprovalQueue/approvalQueueSlice';
import type { BusinessSummary } from '../../types/auth';

const init = <S>(reducer: (s: S | undefined, a: { type: string }) => S) => reducer(undefined, { type: '@@init' });

describe('emailVerificationSlice', () => {
  const { reducer, actions } = emailVerificationSlice;

  it('reports attempts left and clears the code after a wrong code (QA 5)', () => {
    const typed = reducer(init(reducer), actions.setCode('111111'));
    const state = reducer(
      typed,
      actions.verifyEmailAsync.rejected(null, 'r', '111111', {
        message: 'Wrong code',
        code: 'INVALID_OTP',
        details: { attemptsLeft: 3 },
      }),
    );
    expect(state.attemptsLeft).toBe(3);
    expect(state.locked).toBe(false);
    expect(state.code).toBe('');
    expect(state.error.message).toBe('Wrong code');
  });

  it('locks on the fifth miss and points to resend', () => {
    const state = reducer(
      init(reducer),
      actions.verifyEmailAsync.rejected(null, 'r', '111111', {
        message: 'Too many attempts',
        code: 'OTP_LOCKED',
        details: { retryAfter: 0 },
      }),
    );
    expect(state.locked).toBe(true);
    expect(state.attemptsLeft).toBe(0);
  });

  it('takes the resend countdown from the server and lifts the lock (QA 6)', () => {
    const locked = { ...init(reducer), locked: true, attemptsLeft: 0 };
    const before = Date.now();
    const state = reducer(locked, actions.resendCodeAsync.fulfilled(45, 'r', undefined));
    expect(state.locked).toBe(false);
    expect(state.attemptsLeft).toBeNull();
    expect(state.resendAvailableAt).toBeGreaterThanOrEqual(before + 45_000);
    expect(state.resendAvailableAt).toBeLessThan(before + 46_000);
  });

  it('starts the first 60 s countdown only once', () => {
    const first = reducer(init(reducer), actions.startCooldownIfIdle());
    const again = reducer(first, actions.startCooldownIfIdle());
    expect(again.resendAvailableAt).toBe(first.resendAvailableAt);
  });
});

describe('forgotPasswordSlice (QA 11)', () => {
  const { reducer, actions } = forgotPasswordSlice;

  it('walks email → otp → reset → done', () => {
    let s = reducer(init(reducer), actions.setEmail('a@x.com'));
    s = reducer(s, actions.requestCodeAsync.fulfilled(60, 'r', 'a@x.com'));
    expect(s.step).toBe('otp');
    s = reducer(s, actions.verifyCodeAsync.fulfilled('reset-token', 'r', { email: 'a@x.com', code: '123456' }));
    expect(s).toMatchObject({ step: 'reset', resetToken: 'reset-token' });
    s = reducer(s, actions.resetPasswordAsync.fulfilled(true, 'r', { resetToken: 'reset-token', password: 'metro2026' }));
    expect(s).toMatchObject({ step: 'done', resetToken: '', password: '' });
  });

  it('a spent reset token sends the user back to the code step', () => {
    const s = reducer(
      { ...init(reducer), step: 'reset' as const, resetToken: 't' },
      actions.resetPasswordAsync.rejected(null, 'r', { resetToken: 't', password: 'x' }, {
        message: 'Expired',
        code: 'RESET_TOKEN_INVALID',
      }),
    );
    expect(s.step).toBe('otp');
  });

  it('a reset link with email and code opens on the code step', () => {
    const s = reducer(init(reducer), actions.prefillFromLink({ email: 'a@x.com', code: '123456' }));
    expect(s).toMatchObject({ step: 'otp', email: 'a@x.com', code: '123456' });
  });
});

describe('reviewSubmitSlice (QA 17)', () => {
  const { reducer, actions } = reviewSubmitSlice;
  it('keeps the missing documents the server named', () => {
    const s = reducer(
      init(reducer),
      actions.submitAsync.rejected(null, 'r', undefined, {
        message: 'Missing documents',
        code: 'DOCUMENTS_MISSING',
        details: { missing: ['pmdc_certificate'] },
      }),
    );
    expect(s.missing).toEqual(['pmdc_certificate']);
    expect(s.error.code).toBe('DOCUMENTS_MISSING');
  });
});

describe('adminSignInSlice (QA 20, 23)', () => {
  const { reducer, actions } = adminSignInSlice;

  it('clears the password once the challenge arrives (no session yet)', () => {
    let s = reducer(init(reducer), actions.setPassword('secret'));
    s = reducer(s, actions.signInAsync.fulfilled('totp', 'r', { email: 'a@x.com', password: 'secret' }));
    expect(s.password).toBe('');
    expect(s.status).toBe('idle');
  });

  it('explains a reused recovery code', () => {
    const s = reducer(
      { ...init(reducer), useRecovery: true },
      actions.verifyTotpAsync.rejected(null, 'r', { challengeToken: 'c', recoveryCode: 'AAAA' }, {
        message: 'Used',
        code: 'RECOVERY_CODE_USED',
      }),
    );
    expect(s.totpError.message).toMatch(/already been used/);
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
