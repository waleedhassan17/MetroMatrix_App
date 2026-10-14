// ═══════════════════════════════════════════════════════
// MetroMatrix — Auth Validation Model
// ═══════════════════════════════════════════════════════
// Pure functions: data in, { field: message } out. No React, no Redux.
// The password policy must be IDENTICAL to the API's, so a password the form
// accepts is never refused by the server.
// TODO(API_AUTH): confirm PASSWORD_POLICY against MetroMatrix-API.

import { isValidPkMobile, normalizePkPhone, PK_MOBILE_MESSAGE } from '../utils/phone';

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

// ─── Sign Up ──────────────────────────────────────────
export interface SignUpData {
  name: string;
  email: string;
  /** National part only (the field shows +92). */
  phone: string;
  password: string;
  confirmPassword: string;
  acceptedTerms: boolean;
  /** Partners only. */
  acceptedPartnerTerms?: boolean;
}

export const validateSignUp = (
  data: SignUpData,
  options: { phoneRequired: boolean; partnerTerms: boolean } = { phoneRequired: false, partnerTerms: false },
): ValidationErrors => {
  const errors: ValidationErrors = {};

  if (!data.name.trim()) errors.name = 'Full name is required';
  else if (data.name.trim().length < 2) errors.name = 'Name must be at least 2 characters';

  const email = validateEmail(data.email);
  if (email) errors.email = email;

  const phone = validatePhone(data.phone, options.phoneRequired);
  if (phone) errors.phone = phone;

  const password = validatePassword(data.password);
  if (password) errors.password = password;

  if (!data.confirmPassword) errors.confirmPassword = 'Confirm your password';
  else if (data.password !== data.confirmPassword) errors.confirmPassword = 'Passwords do not match';

  if (!data.acceptedTerms) errors.acceptedTerms = 'Accept the Terms and Privacy Policy to continue';
  if (options.partnerTerms && !data.acceptedPartnerTerms) {
    errors.acceptedPartnerTerms = 'Accept the Partner Agreement to continue';
  }
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
