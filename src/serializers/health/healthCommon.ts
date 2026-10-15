// MetroMatrix — Shared readers for the Health serializers.
// TODO(API_HEALTH): shapes from docs/API_HEALTH_ASSUMED.md.

import type { Gender } from '../../types/auth';
import type { Availability, ConsultKind, EmergencyNumber, SpecialtyRef } from '../../types/health';
import { arr, bool, isObject, num, oneOf, str, strOrNull } from '../serializerUtils';
import { isoOrNull } from '../shopping/common';

export const KINDS: readonly ConsultKind[] = ['video', 'clinic'];
export const GENDERS: readonly Gender[] = ['male', 'female', 'other'];
export const DAY = /^\d{4}-\d{2}-\d{2}$/;

export const dayOrNull = (v: unknown): string | null => {
  const s = str(v).slice(0, 10);
  return DAY.test(s) ? s : null;
};

export const numOrNull = (v: unknown): number | null =>
  v === null || v === undefined || v === '' ? null : Number.isFinite(num(v, NaN)) ? num(v) : null;

/** 0–5 with one decimal, or null. */
export const rating = (v: unknown): number | null => {
  const n = numOrNull(v);
  return n === null ? null : Math.min(5, Math.max(0, Math.round(n * 10) / 10));
};

export const strings = (v: unknown): string[] => arr(v).map(x => str(x).trim()).filter(Boolean);

export const gender = (v: unknown): Gender | null => oneOf(v, GENDERS, null);

export const specialtyRefSerializer = (raw: unknown): SpecialtyRef => {
  const r = isObject(raw) ? raw : {};
  return { slug: str(r.slug), name: str(r.name, 'General physician'), nameUr: str(r.nameUr) };
};

export const availabilitySerializer = (raw: unknown): Availability => {
  const r = isObject(raw) ? raw : {};
  return { label: strOrNull(r.label), today: bool(r.today), nextAt: isoOrNull(r.nextAt) };
};

export const emergencyNumbersSerializer = (raw: unknown): EmergencyNumber[] =>
  arr(raw)
    .map(n => (isObject(n) && str(n.number) ? { label: str(n.label, 'Emergency'), number: str(n.number) } : null))
    .filter((n): n is EmergencyNumber => n !== null);

/** The practice timezone; Pakistan time when the API leaves it out. */
export const timezone = (v: unknown) => str(v) || 'Asia/Karachi';
