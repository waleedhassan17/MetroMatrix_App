import {
  ageOn,
  getPasswordStrength,
  parseIsoDate,
  validateLocationStep,
  validatePersonalStep,
  nationalFromPkPhone,
  toPkPhone,
  validateChangePassword,
  validateNewPassword,
  validateOtp,
  validatePassword,
  validateProfile,
  validateSignIn,
  validateSignUp,
  type SignUpData,
} from '../authModel';

const valid: SignUpData = {
  name: 'Ayesha Khan',
  phone: '3124890176',
  email: 'ayesha@example.com',
  password: 'metro2026',
};

describe('validateSignIn', () => {
  it('accepts a well-formed pair, even an old short password', () => {
    expect(validateSignIn({ email: 'a@b.co', password: 'x' })).toEqual({});
  });
  it('requires email and password', () => {
    expect(validateSignIn({ email: '', password: '' })).toEqual({
      email: 'Email is required',
      password: 'Password is required',
    });
  });
  it.each(['plain', 'a@b', '@b.co', 'a b@c.co'])('rejects malformed email %p', email => {
    expect(validateSignIn({ email, password: 'x' }).email).toBe('Enter a valid email address');
  });
});

describe('validatePassword (policy identical to the API)', () => {
  it.each([
    ['', 'Password is required'],
    ['abc123', 'Use at least 8 characters'],
    ['a1'.repeat(37), 'Use 72 characters or fewer'],
    ['12345678', 'Add at least one letter'],
    ['abcdefgh', 'Add at least one number'],
  ])('%p → %p', (password, message) => {
    expect(validatePassword(password)).toBe(message);
  });
  it('accepts 8 characters with a letter and a number, and exactly 72', () => {
    expect(validatePassword('abcdefg1')).toBeUndefined();
    expect(validatePassword('a1'.repeat(36))).toBeUndefined();
  });
});

describe('validateSignUp (the FYP four fields)', () => {
  it('accepts a valid sign-up', () => {
    expect(validateSignUp(valid)).toEqual({});
  });

  it('requires a name of at least 2 characters (trimmed)', () => {
    expect(validateSignUp({ ...valid, name: '  ' }).name).toBe('Full name is required');
    expect(validateSignUp({ ...valid, name: ' A ' }).name).toBe('Name must be at least 2 characters');
  });

  it('requires a valid Pakistani mobile', () => {
    expect(validateSignUp({ ...valid, phone: '' }).phone).toBe('Mobile number is required');
    expect(validateSignUp({ ...valid, phone: '4235761234' }).phone).toMatch(/valid Pakistani mobile/);
    expect(validateSignUp({ ...valid, phone: '31248' }).phone).toMatch(/valid Pakistani mobile/);
  });

  it('validates the email and applies the password policy', () => {
    expect(validateSignUp({ ...valid, email: 'nope' }).email).toBe('Enter a valid email address');
    expect(validateSignUp({ ...valid, password: 'short1' }).password).toBe('Use at least 8 characters');
    expect(validateSignUp({ ...valid, password: 'lettersonly' }).password).toBe('Add at least one number');
  });
});

describe('CompleteProfile steps', () => {
  const today = new Date(2026, 9, 15);

  it('personal: needs a real past date of birth, at least 13 years ago, and a gender', () => {
    expect(validatePersonalStep({ dateOfBirth: '1995-04-12', gender: 'female' }, today)).toEqual({});
    expect(validatePersonalStep({ dateOfBirth: '', gender: null }, today)).toEqual({
      dateOfBirth: 'Select your date of birth',
      gender: 'Select your gender',
    });
    expect(validatePersonalStep({ dateOfBirth: '2026-02-30', gender: 'male' }, today).dateOfBirth).toBe('Enter a valid date');
    expect(validatePersonalStep({ dateOfBirth: '2027-01-01', gender: 'male' }, today).dateOfBirth).toMatch(/future/);
    expect(validatePersonalStep({ dateOfBirth: '2014-01-01', gender: 'other' }, today).dateOfBirth).toMatch(/at least 13/);
  });

  it('age counts birthdays correctly', () => {
    expect(ageOn(new Date(2013, 9, 16), today)).toBe(12);
    expect(ageOn(new Date(2013, 9, 15), today)).toBe(13);
    expect(parseIsoDate('2001-08-15')?.getDate()).toBe(15);
    expect(parseIsoDate('15/08/2001')).toBeNull();
  });

  it('location: street and city required, postal code optional but 5 digits', () => {
    expect(validateLocationStep({ streetAddress: '12 Main Boulevard', city: 'Lahore', postalCode: '' })).toEqual({});
    expect(validateLocationStep({ streetAddress: '', city: '', postalCode: '' })).toEqual({
      streetAddress: 'Street address is required',
      city: 'Select your city',
    });
    expect(validateLocationStep({ streetAddress: 'abc', city: 'Lahore', postalCode: '540' })).toEqual({
      streetAddress: 'Add your street and area',
      postalCode: 'Postal codes are 5 digits',
    });
  });
});

describe('validateOtp', () => {
  it.each([
    ['', 'Enter the 6-digit code'],
    ['12345', 'The code is 6 digits'],
    ['12345a', 'The code is 6 digits'],
    ['1234567', 'The code is 6 digits'],
  ])('%p → %p', (code, message) => {
    expect(validateOtp(code).code).toBe(message);
  });
  it('accepts six digits', () => {
    expect(validateOtp('004211')).toEqual({});
  });
});

describe('validateNewPassword / validateChangePassword', () => {
  it('applies policy and confirmation', () => {
    expect(validateNewPassword({ password: 'metro2026', confirmPassword: 'metro2026' })).toEqual({});
    expect(validateNewPassword({ password: 'metro', confirmPassword: 'metro' }).password).toBeDefined();
    expect(validateNewPassword({ password: 'metro2026', confirmPassword: 'x' }).confirmPassword).toBe(
      'Passwords do not match',
    );
  });

  it('requires the current password unless setting a first one (Google-only)', () => {
    const data = { currentPassword: '', password: 'metro2026', confirmPassword: 'metro2026' };
    expect(validateChangePassword(data, true).currentPassword).toBe('Current password is required');
    expect(validateChangePassword(data, false)).toEqual({});
  });

  it('refuses reusing the current password', () => {
    const data = { currentPassword: 'metro2026', password: 'metro2026', confirmPassword: 'metro2026' };
    expect(validateChangePassword(data, true).password).toBeDefined();
  });
});

describe('validateProfile', () => {
  it('checks name and an optional phone', () => {
    expect(validateProfile({ name: 'Ayesha', phone: '' })).toEqual({});
    expect(validateProfile({ name: 'A', phone: '' }).name).toBeDefined();
    expect(validateProfile({ name: 'Ayesha', phone: '12' }).phone).toBeDefined();
  });
});

describe('phone helpers', () => {
  it('composes and splits the +92 field', () => {
    expect(toPkPhone('3124890176')).toBe('+923124890176');
    expect(toPkPhone('  ')).toBeUndefined();
    expect(nationalFromPkPhone('+923124890176')).toBe('3124890176');
    expect(nationalFromPkPhone('03124890176')).toBe('3124890176');
    expect(nationalFromPkPhone(null)).toBe('');
  });
});

describe('getPasswordStrength', () => {
  it.each([
    ['', 'weak'],
    ['abcdefgh', 'weak'],
    ['abcdefg1', 'fair'],
    ['Abcdefg1', 'strong'],
    ['Abcdefgh123!', 'excellent'],
  ])('%p is %p', (password, level) => {
    expect(getPasswordStrength(password)).toBe(level);
  });
});
