// ═══════════════════════════════════════════════════════
// MetroMatrix — Store profile, settings and payment accounts
// ═══════════════════════════════════════════════════════

import type { PaymentAccountInput, PaymentAccountKind, StoreSettings } from '../shopping';
import type { ValidationErrors } from '../authModel';
import { contrastRatio, AA_BODY } from '../../theme/contrast';

export const HEX = /^#[0-9A-Fa-f]{6}$/;

/** The brand colour test the API also runs: text on the button must read (AA 4.5:1). */
export const brandContrast = (brand: string, onBrand: string): { ratio: number; passes: boolean } => {
  if (!HEX.test(brand) || !HEX.test(onBrand)) return { ratio: 0, passes: false };
  const ratio = contrastRatio(brand, onBrand);
  return { ratio: Math.round(ratio * 10) / 10, passes: ratio >= AA_BODY };
};

export const validateStoreProfile = (p: { tagline: string; about: string; brandColor: string; onBrandColor: string }): ValidationErrors => {
  const errors: ValidationErrors = {};
  if (p.tagline.trim().length > 80) errors.tagline = 'Keep the tagline under 80 characters';
  if (p.about.trim().length > 1200) errors.about = 'Keep it under 1,200 characters';
  if (!HEX.test(p.brandColor)) errors.brandColor = 'Use a colour like #7A1F3D';
  else if (!brandContrast(p.brandColor, p.onBrandColor).passes) {
    errors.brandColor = 'Text on this colour is hard to read. Pick a darker or lighter shade.';
  }
  return errors;
};

export const validateStoreSettings = (s: StoreSettings, opts: { hasActiveAccount: boolean }): ValidationErrors => {
  const errors: ValidationErrors = {};
  if (s.shippingFee < 0) errors.shippingFee = 'Shipping cannot be negative';
  if (s.freeShippingOver !== null && s.freeShippingOver <= 0) errors.freeShippingOver = 'Enter an amount, or turn it off';
  if (!s.nationwide && !s.deliveryCities.length) errors.deliveryCities = 'Choose at least one city, or deliver nationwide';
  if (s.dispatchMinDays < 0 || s.dispatchMaxDays < s.dispatchMinDays) errors.dispatch = 'The longest must be at least the shortest';
  if (s.returnWindowDays < 0 || s.returnWindowDays > 30) errors.returnWindowDays = 'Between 0 and 30 days';
  if (s.codEnabled && s.codLimit !== null && s.codLimit < 500) errors.codLimit = 'Set at least Rs 500, or remove the limit';
  if (!s.codEnabled && !opts.hasActiveAccount) errors.codEnabled = 'Add a payment account before turning cash on delivery off';
  if (s.isPaused && !(s.pauseMessage ?? '').trim()) errors.pauseMessage = 'Tell customers when you will be back';
  return errors;
};

export const PAYMENT_ACCOUNT_KINDS: { key: PaymentAccountKind; label: string; numberLabel: string; placeholder: string }[] = [
  { key: 'raast', label: 'Raast', numberLabel: 'Raast ID (mobile number)', placeholder: '03001234567' },
  { key: 'jazzcash', label: 'JazzCash', numberLabel: 'JazzCash number', placeholder: '03001234567' },
  { key: 'easypaisa', label: 'Easypaisa', numberLabel: 'Easypaisa number', placeholder: '03451234567' },
  { key: 'bank', label: 'Bank account', numberLabel: 'IBAN', placeholder: 'PK36SCBL0000001123456702' },
];

export const accountKindLabel = (k: PaymentAccountKind) => PAYMENT_ACCOUNT_KINDS.find(x => x.key === k)?.label ?? 'Account';

const MOBILE = /^03\d{9}$/;
const IBAN = /^PK\d{2}[A-Z]{4}[A-Z0-9]{16}$/;

export const normaliseAccountNumber = (kind: PaymentAccountKind, raw: string) =>
  kind === 'bank' ? raw.toUpperCase().replace(/\s+/g, '') : raw.replace(/\D/g, '');

export const validatePaymentAccount = (a: PaymentAccountInput): ValidationErrors => {
  const errors: ValidationErrors = {};
  if (a.title.trim().length < 3) errors.title = 'Enter the account title exactly as the bank shows it';
  const n = normaliseAccountNumber(a.kind, a.number);
  if (a.kind === 'bank') {
    if (!IBAN.test(n)) errors.number = 'Enter a 24-character Pakistani IBAN (PK…)';
    if (!(a.bankName ?? '').trim()) errors.bankName = 'Enter the bank name';
  } else if (!MOBILE.test(n)) {
    errors.number = 'Enter an 11-digit mobile number starting 03';
  }
  return errors;
};

/** Brand colours a store can start from (any hex works). */
export const BRAND_PRESETS = ['#7A1F3D', '#111827', '#0F766E', '#1E3A8A', '#9A3412', '#065F46', '#6B21A8', '#B91C1C', '#C25100', '#334155'];

/** The text colour on the brand: white, or the app's ink. */
export const ON_BRAND_CHOICES: { value: string; label: string }[] = [
  { value: '#FFFFFF', label: 'White text' },
  { value: '#0F172A', label: 'Dark text' },
];

/** "7a1f3d" / "#7A1F3D" → "#7A1F3D" while typing (never more than 6 digits). */
export const normaliseHex = (raw: string) => `#${raw.replace(/[^0-9a-fA-F]/g, '').slice(0, 6).toUpperCase()}`;
