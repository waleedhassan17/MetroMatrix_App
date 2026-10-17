import {
  authResultSerializer,
  recoveryCodesSerializer,
  retryAfterSerializer,
  sessionSerializer,
  tokensSerializer,
  totpChallengeSerializer,
  totpEnrolmentSerializer,
  userSerializer,
} from '../authSerializer';

const fullUser = {
  id: 'u1',
  email: 'ayesha@example.com',
  name: 'Ayesha Khan',
  phone: '+923124890176',
  role: 'partner',
  avatarUrl: 'https://cdn/x.jpg',
  isEmailVerified: false,
  hasPassword: true,
  providers: ['password'],
  createdAt: '2026-10-01T00:00:00Z',
  profileComplete: false,
  dateOfBirth: '1995-04-12',
  gender: 'female',
  streetAddress: '12 Main Boulevard',
  city: 'Lahore',
  postalCode: '54000',
  providerServiceType: 'food',
  providerSubType: 'home_kitchen',
};

describe('userSerializer', () => {
  it('maps a complete user', () => {
    expect(userSerializer(fullUser)).toEqual({
      id: 'u1',
      email: 'ayesha@example.com',
      name: 'Ayesha Khan',
      phone: '+923124890176',
      role: 'partner',
      avatarUrl: 'https://cdn/x.jpg',
      isEmailVerified: false,
      hasPassword: true,
      providers: ['password'],
      createdAt: '2026-10-01T00:00:00Z',
      profileComplete: false,
      dateOfBirth: '1995-04-12',
      gender: 'female',
      streetAddress: '12 Main Boulevard',
      city: 'Lahore',
      postalCode: '54000',
      providerServiceType: 'food',
      providerSubType: 'home_kitchen',
    });
  });

  it.each([null, undefined, 42, 'user', []])('never throws on %p', raw => {
    const user = userSerializer(raw);
    expect(user.id).toBe('');
    expect(user.role).toBe('customer');
  });

  it('falls back to the least-privileged role for an unknown role', () => {
    expect(userSerializer({ ...fullUser, role: 'root' }).role).toBe('customer');
    expect(userSerializer({ ...fullUser, role: 7 }).role).toBe('customer');
  });

  it('reads legacy field names', () => {
    const u = userSerializer({ _id: 'x', displayName: 'Bilal', photoURL: 'p', emailVerified: true });
    expect(u).toMatchObject({ id: 'x', name: 'Bilal', avatarUrl: 'p', isEmailVerified: true });
  });

  it('treats a missing verification flag as verified, but honours an explicit false', () => {
    expect(userSerializer({ id: 'a' }).isEmailVerified).toBe(true);
    expect(userSerializer({ id: 'a', isEmailVerified: false }).isEmailVerified).toBe(false);
  });

  it('marks Google-only accounts as having no password', () => {
    const u = userSerializer({ id: 'g', providers: ['google'] });
    expect(u.hasPassword).toBe(false);
    expect(u.providers).toEqual(['google']);
  });

  it('defaults missing profile fields safely', () => {
    const u = userSerializer({ id: 'a', gender: 'robot', providerSubType: 'spaceship' });
    expect(u.profileComplete).toBe(true);
    expect(u.gender).toBeNull();
    expect(u.providerSubType).toBeNull();
    expect(userSerializer({ id: 'a', subType: 'doctor', serviceType: 'healthcare' })).toMatchObject({
      providerSubType: 'doctor',
      providerServiceType: 'healthcare',
    });
  });

  it('drops unknown providers and coerces empty strings to null', () => {
    const u = userSerializer({ id: 'a', providers: ['google', 'facebook', 'google'], phone: '', avatarUrl: '' });
    expect(u.providers).toEqual(['google']);
    expect(u.phone).toBeNull();
    expect(u.avatarUrl).toBeNull();
  });
});

describe('tokensSerializer', () => {
  it('reads a top-level pair and a nested pair', () => {
    expect(tokensSerializer({ accessToken: 'a', refreshToken: 'r' })).toEqual({ accessToken: 'a', refreshToken: 'r' });
    expect(tokensSerializer({ tokens: { accessToken: 'a', refreshToken: 'r' } })).toEqual({
      accessToken: 'a',
      refreshToken: 'r',
    });
  });

  it.each([null, {}, { accessToken: 'a' }, { tokens: { refreshToken: 'r' } }, { accessToken: 1, refreshToken: 2 }])(
    'returns null for %p',
    raw => {
      expect(tokensSerializer(raw)).toBeNull();
    },
  );
});

describe('authResultSerializer / sessionSerializer', () => {
  const tokens = { accessToken: 'a', refreshToken: 'r' };

  it('builds a session with a null business for customers', () => {
    const result = authResultSerializer({ user: fullUser, business: null, tokens });
    expect(result?.user.id).toBe('u1');
    expect(result?.business).toBeNull();
    expect(result?.tokens).toEqual(tokens);
  });

  it('returns null without a user or without tokens', () => {
    expect(authResultSerializer({ tokens })).toBeNull();
    expect(authResultSerializer({ user: fullUser })).toBeNull();
    expect(authResultSerializer('nope')).toBeNull();
  });

  it('drops a malformed business instead of failing the session', () => {
    const session = sessionSerializer({ user: fullUser, business: { subType: 'spaceship' } });
    expect(session?.business).toBeNull();
  });
});

describe('TOTP serializers', () => {
  it('reads a challenge; defaults enrolled to true', () => {
    expect(totpChallengeSerializer({ challengeToken: 'c' })).toEqual({ challengeToken: 'c', totpEnrolled: true });
    expect(totpChallengeSerializer({ challengeToken: 'c', totpEnrolled: false })?.totpEnrolled).toBe(false);
    // The API's own words: an authenticator still to be set up.
    expect(totpChallengeSerializer({ totpRequired: true, enrolmentRequired: true, challengeToken: 'c' })?.totpEnrolled).toBe(false);
    expect(totpChallengeSerializer({ totpRequired: true, enrolmentRequired: false, challengeToken: 'c' })?.totpEnrolled).toBe(true);
    expect(totpChallengeSerializer({ user: fullUser })).toBeNull();
  });

  it('reads enrolment material only when both parts are present', () => {
    expect(totpEnrolmentSerializer({ secret: 'S', otpauthUrl: 'otpauth://x' })).toEqual({
      secret: 'S',
      otpauthUrl: 'otpauth://x',
    });
    expect(totpEnrolmentSerializer({ secret: 'S' })).toBeNull();
  });

  it('keeps only non-empty recovery codes', () => {
    expect(recoveryCodesSerializer({ recoveryCodes: ['a1', '', 3, null] })).toEqual(['a1', '3']);
    expect(recoveryCodesSerializer({})).toEqual([]);
  });
});

describe('retryAfterSerializer', () => {
  it.each([
    [{ retryAfter: 42 }, 42],
    [{ retryAfter: '30' }, 30],
    [{ retryAfterSeconds: 9.2 }, 10],
    [{}, 60],
    [{ retryAfter: -5 }, 60],
    [null, 60],
  ])('%p → %p', (raw, expected) => {
    expect(retryAfterSerializer(raw)).toBe(expected);
  });
});
