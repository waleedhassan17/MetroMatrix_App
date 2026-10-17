// ═══════════════════════════════════════════════════════
// MetroMatrix — Auth Validation Model
// ═══════════════════════════════════════════════════════
// Pure functions: data in, { field: message } out. No React, no Redux.
// The password policy must be IDENTICAL to the API's, so a password the form
// accepts is never refused by the server.
// TODO(API_AUTH): confirm PASSWORD_POLICY against MetroMatrix-API.

import { isValidPkMobile, normalizePkPhone, PK_MOBILE_MESSAGE } from '../utils/phone';
import type { Gender } from '../types/auth';

export interface ValidationErrors {
  [field: string]: string;
}

export const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const PASSWORD_POLICY = {
  minLength: 8,
  maxLength: 72,
  requiresLetter: true,
  requiresNumber: true,
} as const;

export const OTP_LENGTH = 6;

// ─── Phone (+92 field holds the national part) ───────
/** "3124890176" → "+923124890176"; blank → undefined (omit the field). */
export const toPkPhone = (national: string): string | undefined => {
  const digits = national.replace(/\D/g, '');
  if (!digits) return undefined;
  return normalizePkPhone(`+92${digits}`);
};

/** "+923124890176" → "3124890176" for the +92 field. */
export const nationalFromPkPhone = (canonical: string | null | undefined): string => {
  const n = normalizePkPhone(canonical ?? '');
  if (!n) return '';
  return n.startsWith('+92') ? n.slice(3) : n.replace(/\D/g, '');
};

// ─── Field rules ──────────────────────────────────────
export const validateEmail = (email: string): string | undefined => {
  if (!email.trim()) return 'Email is required';
  if (!EMAIL_REGEX.test(email.trim())) return 'Enter a valid email address';
  return undefined;
};

export const validatePassword = (password: string): string | undefined => {
  if (!password) return 'Password is required';
  if (password.length < PASSWORD_POLICY.minLength) {
    return `Use at least ${PASSWORD_POLICY.minLength} characters`;
  }
  if (password.length > PASSWORD_POLICY.maxLength) {
    return `Use ${PASSWORD_POLICY.maxLength} characters or fewer`;
  }
  if (PASSWORD_POLICY.requiresLetter && !/[A-Za-z]/.test(password)) return 'Add at least one letter';
  if (PASSWORD_POLICY.requiresNumber && !/[0-9]/.test(password)) return 'Add at least one number';
  return undefined;
};

const validatePhone = (national: string, required: boolean): string | undefined => {
  const canonical = toPkPhone(national);
  if (!canonical) return required ? 'Mobile number is required' : undefined;
  return isValidPkMobile(canonical) ? undefined : PK_MOBILE_MESSAGE;
};

// ─── Sign In ──────────────────────────────────────────
export interface SignInData {
  email: string;
  password: string;
}

// Sign-in checks presence and shape only: an account created under an older
// policy must still be able to sign in.
export const validateSignIn = (data: SignInData): ValidationErrors => {
  const errors: ValidationErrors = {};
  const email = validateEmail(data.email);
  if (email) errors.email = email;
  if (!data.password) errors.password = 'Password is required';
  return errors;
};

// ─── Rider sign in (a vendor-issued username) ────────
/** The API's usernames: lower-case letters, digits, dots, dashes and underscores. */
export const RIDER_USERNAME_REGEX = /^[a-z0-9._-]{3,60}$/;

export interface RiderSignInData {
  username: string;
  password: string;
}

export const validateRiderSignIn = (data: RiderSignInData): ValidationErrors => {
  const errors: ValidationErrors = {};
  const username = data.username.trim().toLowerCase();
  if (!username) errors.username = 'Enter the username your vendor gave you';
  else if (!RIDER_USERNAME_REGEX.test(username)) errors.username = 'Usernames use letters, numbers, dots and dashes';
  if (!data.password) errors.password = 'Password is required';
  return errors;
};

// ─── Sign Up (the FYP's four fields) ─────────────────
export interface SignUpData {
  name: string;
  /** National part only (the field shows +92). */
  phone: string;
  email: string;
  password: string;
}

export const validateSignUp = (data: SignUpData): ValidationErrors => {
  const errors: ValidationErrors = {};

  if (!data.name.trim()) errors.name = 'Full name is required';
  else if (data.name.trim().length < 2) errors.name = 'Name must be at least 2 characters';

  const phone = validatePhone(data.phone, true);
  if (phone) errors.phone = phone;

  const email = validateEmail(data.email);
  if (email) errors.email = email;

  const password = validatePassword(data.password);
  if (password) errors.password = password;

  return errors;
};

// ─── OTP ──────────────────────────────────────────────
export const validateOtp = (code: string): ValidationErrors => {
  const errors: ValidationErrors = {};
  if (!code) errors.code = 'Enter the 6-digit code';
  else if (!new RegExp(`^\\d{${OTP_LENGTH}}$`).test(code)) errors.code = 'The code is 6 digits';
  return errors;
};

// ─── New password (reset, first password) ─────────────
export interface NewPasswordData {
  password: string;
  confirmPassword: string;
}

export const validateNewPassword = (data: NewPasswordData): ValidationErrors => {
  const errors: ValidationErrors = {};
  const password = validatePassword(data.password);
  if (password) errors.password = password;
  if (!data.confirmPassword) errors.confirmPassword = 'Confirm your password';
  else if (data.password !== data.confirmPassword) errors.confirmPassword = 'Passwords do not match';
  return errors;
};

// ─── Change password ──────────────────────────────────
export interface ChangePasswordData extends NewPasswordData {
  currentPassword: string;
}

export const validateChangePassword = (
  data: ChangePasswordData,
  requireCurrent: boolean,
): ValidationErrors => {
  const errors = validateNewPassword(data);
  if (requireCurrent && !data.currentPassword) errors.currentPassword = 'Current password is required';
  if (requireCurrent && data.currentPassword && data.currentPassword === data.password) {
    errors.password = 'Choose a password you have not used here';
  }
  return errors;
};

// ─── Complete profile (customers, 3 steps) ────────────
export const MIN_AGE = 13;

/** "2001-08-15" → Date at local midnight, or null if not a real calendar date. */
export const parseIsoDate = (iso: string): Date | null => {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!m) return null;
  const date = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  return date.getFullYear() === Number(m[1]) && date.getMonth() === Number(m[2]) - 1 && date.getDate() === Number(m[3])
    ? date
    : null;
};

export const ageOn = (birth: Date, today: Date): number => {
  let age = today.getFullYear() - birth.getFullYear();
  const beforeBirthday =
    today.getMonth() < birth.getMonth() || (today.getMonth() === birth.getMonth() && today.getDate() < birth.getDate());
  if (beforeBirthday) age -= 1;
  return age;
};

export interface PersonalStepData {
  /** ISO date, YYYY-MM-DD. */
  dateOfBirth: string;
  gender: Gender | null;
}

export const validatePersonalStep = (data: PersonalStepData, today: Date = new Date()): ValidationErrors => {
  const errors: ValidationErrors = {};
  if (!data.dateOfBirth) errors.dateOfBirth = 'Select your date of birth';
  else {
    const birth = parseIsoDate(data.dateOfBirth);
    if (!birth) errors.dateOfBirth = 'Enter a valid date';
    else if (birth > today) errors.dateOfBirth = 'Date of birth cannot be in the future';
    else if (ageOn(birth, today) < MIN_AGE) errors.dateOfBirth = `You must be at least ${MIN_AGE} to use MetroMatrix`;
    else if (ageOn(birth, today) > 120) errors.dateOfBirth = 'Enter a valid date';
  }
  if (!data.gender) errors.gender = 'Select your gender';
  return errors;
};

export interface LocationStepData {
  streetAddress: string;
  city: string;
  postalCode: string;
}

export const validateLocationStep = (data: LocationStepData): ValidationErrors => {
  const errors: ValidationErrors = {};
  if (!data.streetAddress.trim()) errors.streetAddress = 'Street address is required';
  else if (data.streetAddress.trim().length < 5) errors.streetAddress = 'Add your street and area';
  if (!data.city) errors.city = 'Select your city';
  if (data.postalCode && !/^\d{5}$/.test(data.postalCode.trim())) errors.postalCode = 'Postal codes are 5 digits';
  return errors;
};

// ─── Profile ──────────────────────────────────────────
export interface ProfileData {
  name: string;
  phone: string;
}

export const validateProfile = (data: ProfileData): ValidationErrors => {
  const errors: ValidationErrors = {};
  if (!data.name.trim()) errors.name = 'Full name is required';
  else if (data.name.trim().length < 2) errors.name = 'Name must be at least 2 characters';
  const phone = validatePhone(data.phone, false);
  if (phone) errors.phone = phone;
  return errors;
};

/** Provider Personal Info, step 1: the phone is required — customers call it. */
export const validateProviderBasics = (data: ProfileData): ValidationErrors => {
  const errors = validateProfile(data);
  if (!errors.phone && !data.phone.trim()) errors.phone = 'Phone number is required';
  return errors;
};

// ─── Password Strength ───────────────────────────────
// A meter, not the policy: it grades what the policy already accepts. The
// UI maps each level to a token (PasswordStrength component) — no colours
// live in a model.
export type PasswordStrengthLevel = 'weak' | 'fair' | 'strong' | 'excellent';

export const getPasswordStrength = (password: string): PasswordStrengthLevel => {
  if (validatePassword(password)) return 'weak';
  const hasUpper = /[A-Z]/.test(password);
  const hasLower = /[a-z]/.test(password);
  const hasNumber = /[0-9]/.test(password);
  const hasSpecial = /[^A-Za-z0-9]/.test(password);
  const mixedCase = hasUpper && hasLower;

  if (password.length >= 12 && mixedCase && hasNumber && hasSpecial) return 'excellent';
  if (mixedCase && hasNumber) return 'strong';
  return 'fair';
};

export const hasErrors = (errors: ValidationErrors): boolean => Object.keys(errors).length > 0;
