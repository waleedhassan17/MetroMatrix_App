// ═══════════════════════════════════════════════════════
// MetroMatrix — Auth Validation Model
// ═══════════════════════════════════════════════════════
// Pure functions: data in, { field: message } out. No React, no Redux.

// ─── Password Strength ───────────────────────────────
// A meter, not the policy: it grades what the policy already accepts. The
// UI maps each level to a token (PasswordStrength component) — no colours
// live in a model.
export type PasswordStrengthLevel = 'weak' | 'fair' | 'strong' | 'excellent';

export const getPasswordStrength = (password: string): PasswordStrengthLevel => {
  if (password.length < 8) return 'weak';
  const hasUpper = /[A-Z]/.test(password);
  const hasLower = /[a-z]/.test(password);
  const hasNumber = /[0-9]/.test(password);
  const hasSpecial = /[^A-Za-z0-9]/.test(password);
  const mixedCase = hasUpper && hasLower;

  if (password.length >= 12 && mixedCase && hasNumber && hasSpecial) return 'excellent';
  if (mixedCase && hasNumber) return 'strong';
  return 'fair';
};
