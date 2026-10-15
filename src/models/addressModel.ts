// ═══════════════════════════════════════════════════════
// MetroMatrix — Delivery addresses (Shopping now, Food later)
// ═══════════════════════════════════════════════════════

import type { Address, AddressInput, AddressLabel } from '../types/shopping';
import type { ValidationErrors } from './authModel';
import { isValidPkMobile, PK_MOBILE_MESSAGE } from '../utils/phone';

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
