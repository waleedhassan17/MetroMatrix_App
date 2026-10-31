// ═══════════════════════════════════════════════════════
// MetroMatrix — What the Health home shows from its payload
// ═══════════════════════════════════════════════════════

import type { Condition, Specialty } from '../health';

/**
 * The home's specialty grid: those with doctors in the city first (in the
 * API's order), so a patient's first tap finds someone; then the rest.
 */
export const homeSpecialties = (specialties: Specialty[], count = 8): Specialty[] =>
  [...specialties.filter(s => s.doctorCount > 0), ...specialties.filter(s => s.doctorCount <= 0)].slice(0, count);

/** A concern's chip icon: its own, else its specialty's, else a medical kit. */
export const concernIcon = (condition: Condition, specialties: Specialty[]): string =>
  condition.icon ?? specialties.find(s => s.slug === condition.specialtySlug)?.icon ?? 'medkit-outline';
