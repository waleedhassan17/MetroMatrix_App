// ═══════════════════════════════════════════════════════
// MetroMatrix — Delivery addresses (Shopping now, Food later)
// ═══════════════════════════════════════════════════════

import type { Address, AddressInput, AddressLabel } from './shopping';
import type { ValidationErrors } from './authModel';
import { isValidPkMobile, PK_MOBILE_MESSAGE } from '../utils/phone/phone';

export const ADDRESS_LABELS: { key: AddressLabel; label: string; icon: 'home-outline' | 'briefcase-outline' | 'location-outline' }[] = [
  { key: 'home', label: 'Home', icon: 'home-outline' },
  { key: 'work', label: 'Work', icon: 'briefcase-outline' },
  { key: 'other', label: 'Other', icon: 'location-outline' },
];

export const addressLabelText = (l: AddressLabel) => ADDRESS_LABELS.find(x => x.key === l)?.label ?? 'Address';

export const validateAddress = (a: AddressInput): ValidationErrors => {
  const errors: ValidationErrors = {};
  if (a.fullName.trim().length < 2) errors.fullName = 'Enter the name of who receives it';
  if (!isValidPkMobile(a.phone)) errors.phone = PK_MOBILE_MESSAGE;
  if (!a.city) errors.city = 'Choose a city';
  if (a.area.trim().length < 2) errors.area = 'Enter the area or block';
  if (a.line1.trim().length < 5) errors.line1 = 'Enter the house, street and block';
  return errors;
};

/** "House 12, Street 4 · Gulberg III, Lahore" */
export const formatAddress = (a: Pick<Address, 'line1' | 'area' | 'city'>): string => `${a.line1} · ${a.area}, ${a.city}`;

// ─── The form ─────────────────────────────────────────
/** The phone is typed as the 10 national digits (TextField's phone mode). */
export interface AddressForm {
  label: AddressLabel;
  fullName: string;
  phone: string;
  city: string;
  area: string;
  line1: string;
  landmark: string;
  lat: number | null;
  lng: number | null;
  isDefault: boolean;
}

export const emptyAddressForm = (prefill: { name?: string | null; phone?: string | null; city?: string | null } = {}): AddressForm => ({
  label: 'home',
  fullName: prefill.name ?? '',
  phone: prefill.phone ? prefill.phone.replace(/^\+92/, '') : '',
  city: prefill.city ?? '',
  area: '',
  line1: '',
  landmark: '',
  lat: null,
  lng: null,
  isDefault: false,
});

export const fromAddress = (a: Address): AddressForm => ({
  label: a.label,
  fullName: a.fullName,
  phone: a.phone.replace(/^\+92/, ''),
  city: a.city,
  area: a.area,
  line1: a.line1,
  landmark: a.landmark ?? '',
  lat: a.lat,
  lng: a.lng,
  isDefault: a.isDefault,
});

export const toAddressInput = (f: AddressForm): AddressInput => ({
  label: f.label,
  fullName: f.fullName.trim(),
  phone: `+92${f.phone.replace(/\D/g, '')}`,
  city: f.city,
  area: f.area.trim(),
  line1: f.line1.trim(),
  landmark: f.landmark.trim() || null,
  lat: f.lat,
  lng: f.lng,
  isDefault: f.isDefault,
});

export const validateAddressForm = (f: AddressForm): ValidationErrors => validateAddress(toAddressInput(f));
