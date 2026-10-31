// ═══════════════════════════════════════════════════════
// MetroMatrix — Coupon form (store partner) and coupon wording
// ═══════════════════════════════════════════════════════

import type { Coupon, CouponInput, CouponStatus, CouponType } from '../shopping';
import type { ValidationErrors } from '../authModel';
import { formatPKR, parseRupees } from '../../utils/money/money';

export interface CouponForm {
  code: string;
  type: CouponType;
  value: string;
  minOrder: string;
  maxDiscount: string;
  /** Local YYYY-MM-DD */
  startsAt: string;
  endsAt: string;
  usageLimit: string;
  perCustomerLimit: string;
  isActive: boolean;
}

const today = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

export const emptyCouponForm = (): CouponForm => ({
  code: '',
  type: 'percent',
  value: '',
  minOrder: '',
  maxDiscount: '',
  startsAt: today(),
  endsAt: '',
  usageLimit: '',
  perCustomerLimit: '1',
  isActive: true,
});

/** Upper-case letters and digits only, 16 at most. */
export const normaliseCode = (raw: string): string => raw.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 16);

/** A readable random code (no 0/O/1/I to misread). */
export const generateCode = (prefix = ''): string => {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let out = '';
  for (let i = 0; i < 6; i++) out += alphabet[Math.floor(Math.random() * alphabet.length)];
  return normaliseCode(`${prefix}${out}`);
};

export const validateCouponForm = (f: CouponForm): ValidationErrors => {
  const errors: ValidationErrors = {};
  if (f.code.length < 4) errors.code = 'Use 4 to 16 letters or digits';
  const value = parseRupees(f.value);
  if (!value) errors.value = f.type === 'percent' ? 'Enter a percentage' : 'Enter an amount in rupees';
  else if (f.type === 'percent' && value > 90) errors.value = 'Up to 90% off';
  if (f.maxDiscount && f.type !== 'percent') errors.maxDiscount = 'Only percentage coupons have a cap';
  if (!f.startsAt) errors.startsAt = 'Choose a start date';
  if (f.endsAt && f.startsAt && f.endsAt < f.startsAt) errors.endsAt = 'The end date is before the start';
  if (f.usageLimit && !parseRupees(f.usageLimit)) errors.usageLimit = 'Enter a whole number, or leave it empty';
  if (f.perCustomerLimit && !parseRupees(f.perCustomerLimit)) errors.perCustomerLimit = 'Enter a whole number, or leave it empty';
  return errors;
};

const isoStart = (ymd: string) => new Date(`${ymd}T00:00:00`).toISOString();
const isoEnd = (ymd: string) => new Date(`${ymd}T23:59:59`).toISOString();
const ymd = (iso: string | null) => (iso ? iso.slice(0, 10) : '');

export const toCouponInput = (f: CouponForm): CouponInput => ({
  code: f.code,
  type: f.type,
  value: parseRupees(f.value) ?? 0,
  minOrder: parseRupees(f.minOrder),
  maxDiscount: f.type === 'percent' ? parseRupees(f.maxDiscount) : null,
  startsAt: isoStart(f.startsAt),
  endsAt: f.endsAt ? isoEnd(f.endsAt) : null,
  usageLimit: parseRupees(f.usageLimit),
  perCustomerLimit: parseRupees(f.perCustomerLimit),
  isActive: f.isActive,
});

export const fromCoupon = (c: Coupon): CouponForm => ({
  code: c.code,
  type: c.type,
  value: String(c.value),
  minOrder: c.minOrder ? String(c.minOrder) : '',
  maxDiscount: c.maxDiscount ? String(c.maxDiscount) : '',
  startsAt: ymd(c.startsAt),
  endsAt: ymd(c.endsAt),
  usageLimit: c.usageLimit ? String(c.usageLimit) : '',
  perCustomerLimit: c.perCustomerLimit ? String(c.perCustomerLimit) : '',
  isActive: c.isActive,
});

/** "20% off, up to Rs 500" / "Rs 300 off" */
export const couponValueLabel = (c: Pick<Coupon, 'type' | 'value' | 'maxDiscount'>): string =>
  c.type === 'percent'
    ? `${c.value}% off${c.maxDiscount ? `, up to ${formatPKR(c.maxDiscount)}` : ''}`
    : `${formatPKR(c.value)} off`;

export const COUPON_STATUS_LABEL: Record<CouponStatus, { label: string; tone: 'success' | 'accent' | 'neutral' | 'danger' }> = {
  active: { label: 'Active', tone: 'success' },
  scheduled: { label: 'Scheduled', tone: 'accent' },
  expired: { label: 'Expired', tone: 'neutral' },
  used_up: { label: 'Used up', tone: 'neutral' },
  inactive: { label: 'Off', tone: 'danger' },
};
