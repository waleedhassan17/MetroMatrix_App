// MetroMatrix — Family members a patient books for.

import type { FamilyMemberInput, FamilyRelation } from '../../types/health';
import type { ValidationErrors } from '../authModel';
import { isValidPkMobile } from '../../utils/phone';

export const RELATIONS: { key: FamilyRelation; label: string }[] = [
  { key: 'spouse', label: 'Spouse' },
  { key: 'child', label: 'Child' },
  { key: 'parent', label: 'Parent' },
  { key: 'sibling', label: 'Sibling' },
  { key: 'other', label: 'Other' },
];

export const relationLabel = (r: FamilyRelation) => RELATIONS.find(x => x.key === r)?.label ?? 'Family';

export const MAX_FAMILY = 10;

export const emptyFamilyMember = (): FamilyMemberInput => ({
  name: '',
  relation: 'child',
  gender: 'female',
  dateOfBirth: '',
  phone: null,
});

export const validateFamilyMember = (m: FamilyMemberInput, today: string): ValidationErrors => {
  const errors: ValidationErrors = {};
  const name = m.name.trim();
  if (name.length < 2) errors.name = 'Enter their full name';
  else if (name.length > 60) errors.name = 'Keep it under 60 characters';
  if (!/^\d{4}-\d{2}-\d{2}$/.test(m.dateOfBirth)) errors.dateOfBirth = 'Choose their date of birth';
  else if (m.dateOfBirth > today) errors.dateOfBirth = 'The date of birth is in the future';
  else if (m.dateOfBirth < '1900-01-01') errors.dateOfBirth = 'Check the year';
  if (m.phone && !isValidPkMobile(m.phone)) errors.phone = 'Enter a Pakistani mobile number';
  return errors;
};

/** "Female", "Male", "Other" (null stays null). */
export const genderLabel = (g: string | null | undefined) => (g ? g[0].toUpperCase() + g.slice(1) : null);
