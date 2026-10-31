// MetroMatrix — Admin Health console: specialty and condition forms, the
// PMDC check note and the reason for hiding a review.

import type { AdminCondition, AdminConditionInput, AdminSpecialty, AdminSpecialtyInput } from '../health';
import type { ValidationErrors } from '../authModel';

/** Line icons a specialty can wear (Ionicons outline glyphs). */
export const SPECIALTY_ICONS = [
  'medkit-outline', 'body-outline', 'woman-outline', 'happy-outline', 'heart-outline', 'accessibility-outline',
  'ear-outline', 'eye-outline', 'pulse-outline', 'chatbubbles-outline', 'nutrition-outline', 'water-outline',
  'flask-outline', 'cloud-outline', 'leaf-outline', 'bandage-outline', 'fitness-outline', 'thermometer-outline',
] as const;

export const MAX_ALIASES = 12;

export interface SpecialtyForm {
  /** '' for a new one. */
  id: string;
  name: string;
  icon: string;
  sort: string;
}

export interface ConditionForm {
  id: string;
  name: string;
  specialtySlug: string | null;
  isCommon: boolean;
  /** Comma-separated, as typed. */
  aliases: string;
}

export const specialtyForm = (s: AdminSpecialty | null, nextSort: number): SpecialtyForm =>
  s
    ? { id: s.id, name: s.name, icon: s.icon, sort: String(s.sort) }
    : { id: '', name: '', icon: SPECIALTY_ICONS[0], sort: String(nextSort) };

export const conditionForm = (c: AdminCondition | null): ConditionForm =>
  c
    ? { id: c.id, name: c.name, specialtySlug: c.specialtySlug, isCommon: c.isCommon, aliases: c.aliases.join(', ') }
    : { id: '', name: '', specialtySlug: null, isCommon: false, aliases: '' };

/** "pimples, Breakouts ,, zits" → ['pimples', 'breakouts', 'zits'] (deduped, lower-cased, at most 12). */
export const parseAliases = (raw: string): string[] => {
  const out: string[] = [];
  for (const part of raw.split(/[,\n]/)) {
    const a = part.trim().replace(/\s+/g, ' ').toLowerCase();
    if (a && !out.includes(a)) out.push(a);
  }
  return out.slice(0, MAX_ALIASES);
};

export const validateSpecialty = (f: SpecialtyForm): ValidationErrors => {
  const errors: ValidationErrors = {};
  if (f.name.trim().length < 3) errors.name = 'Enter the name';
  if (!f.icon) errors.icon = 'Choose an icon';
  const sort = Number(f.sort);
  if (!/^\d{1,3}$/.test(f.sort.trim()) || !Number.isInteger(sort)) errors.sort = 'A whole number, 0 to 999';
  return errors;
};

export const specialtyInput = (f: SpecialtyForm): AdminSpecialtyInput => ({
  name: f.name.trim(),
  icon: f.icon,
  sort: Number(f.sort.trim()),
});

export const validateCondition = (f: ConditionForm): ValidationErrors => {
  const errors: ValidationErrors = {};
  if (f.name.trim().length < 2) errors.name = 'Enter the condition';
  if (f.aliases.split(/[,\n]/).filter(a => a.trim()).length > MAX_ALIASES) errors.aliases = `At most ${MAX_ALIASES} other names`;
  return errors;
};

export const conditionInput = (f: ConditionForm): AdminConditionInput => ({
  name: f.name.trim(),
  specialtySlug: f.specialtySlug,
  isCommon: f.isCommon,
  aliases: parseAliases(f.aliases),
});

export const validatePmdcNote = (note: string): ValidationErrors =>
  note.trim().length < 3 ? { note: 'Say how you checked it, for example "Matched on the PMDC register"' } : {};

export const validateHideReason = (reason: string): ValidationErrors =>
  reason.trim().length < 3 ? { reason: 'Give a reason' } : {};
