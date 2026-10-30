// B12: one list of codes, the copy people read, field errors, and a 429's wait.

import { AxiosError } from 'axios';
import { ERROR_CODES, errorCopy, fieldErrors, retryAfterOf, toApiError } from '../apiHelpers';
import { authErrorMessage } from '../../../components/auth/authErrorMessage';

const http = (status: number, data: unknown, headers: Record<string, string> = {}) =>
  new AxiosError(`HTTP ${status}`, 'ERR_BAD_RESPONSE', {} as never, null, {
    data,
    status,
    statusText: String(status),
    headers,
    config: {} as never,
  });

describe('ERROR_CODES', () => {
  it("uses the API's names, never the old app-only ones", () => {
    expect(ERROR_CODES.EMAIL_EXISTS).toBe('EMAIL_EXISTS');
    expect(ERROR_CODES.OTP_INVALID).toBe('OTP_INVALID');
    expect(ERROR_CODES.RESEND_COOLDOWN).toBe('RESEND_COOLDOWN');
    const all = Object.values(ERROR_CODES) as string[];
    for (const old of ['EMAIL_TAKEN', 'INVALID_OTP', 'RESEND_TOO_SOON', 'CHALLENGE_EXPIRED', 'RESET_TOKEN_INVALID']) {
      expect(all).not.toContain(old);
    }
  });
});

describe('errorCopy', () => {
  it.each([
    'REFRESH_REUSED',
    'RESEND_COOLDOWN',
    'VERIFY_LINK_INVALID',
    'TOTP_INVALID',
    'TOTP_REQUIRED',
    'RATE_LIMITED',
    'ACCOUNT_DISABLED',
    'EMAIL_NOT_VERIFIED',
    'BUSINESS_SUSPENDED',
    'NETWORK_ERROR',
    'CONFIG_ERROR',
  ])('has copy for %s', code => {
    expect(errorCopy(code)).toEqual(expect.any(String));
  });

  it('says how long to wait when it knows', () => {
    expect(errorCopy('RATE_LIMITED', { retryAfter: 45 })).toBe('Too many attempts. Try again in 45 seconds.');
    expect(errorCopy('RATE_LIMITED', { retryAfter: 600 })).toBe('Too many attempts. Try again in 10 minutes.');
    expect(errorCopy('RESEND_COOLDOWN', { retryAfter: 1 })).toMatch(/1 second\./);
  });

  it('keeps the server message for codes it has nothing better for', () => {
    expect(errorCopy('INVALID_CREDENTIALS')).toBeNull();
    expect(errorCopy(undefined)).toBeNull();
  });
});

describe('fieldErrors', () => {
  it("maps VALIDATION_FAILED's details.fields to one message per field", () => {
    expect(
      fieldErrors({ fields: { password: ['Use an upper-case letter', 'Too short'], email: 'Enter a valid email address' } }),
    ).toEqual({ password: 'Use an upper-case letter', email: 'Enter a valid email address' });
    expect(fieldErrors(null)).toEqual({});
    expect(fieldErrors({ fields: 'nope' })).toEqual({});
  });

  it('the notice lists the fields that failed', () => {
    expect(
      authErrorMessage({
        message: 'Validation failed',
        code: 'VALIDATION_FAILED',
        details: { fields: { password: ['Use an upper-case letter'] } },
      }),
    ).toBe('Use an upper-case letter');
  });
});

describe("a 429's wait", () => {
  it('comes from the body when the API gives one', () => {
    const e = toApiError(http(429, { error: { code: 'RESEND_COOLDOWN', message: 'Wait', details: { retryAfter: 42 } } }, { 'retry-after': '60' }));
    expect(retryAfterOf(e.details)).toBe(42);
  });

  it("else from the throttler's Retry-After header", () => {
    const e = toApiError(http(429, { error: { code: 'RATE_LIMITED', message: 'Slow down' } }, { 'retry-after': '37' }));
    expect(e).toMatchObject({ code: 'RATE_LIMITED', status: 429, details: { retryAfter: 37 } });
  });

  it('only for a 429', () => {
    const e = toApiError(http(503, { error: { code: 'SERVICE_UNAVAILABLE', message: 'Down' } }, { 'retry-after': '30' }));
    expect(e.details).toBeUndefined();
  });
});
