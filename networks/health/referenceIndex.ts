// ═══════════════════════════════════════════════════════
// MetroMatrix — Specialty and condition ids by slug
// ═══════════════════════════════════════════════════════
// The app works in slugs ("dermatologist", "acne"); a few API bodies take
// ids (a doctor's specialties and conditions, a condition's specialty).
// Loaded once from the public reference routes (the discovery network's
// thin calls) and kept for the session;
// staff edits to the taxonomy drop it (resetReferenceIndex).

import { getConditionsAPI, getSpecialtiesAPI } from './discoveryNetwork';
import { arr, bodyOf, isObject, str } from '../../serializers/serializerUtils';

export interface ReferenceIndex {
  specialtyId: Map<string, string>;
  specialtySlug: Map<string, string>;
  conditionId: Map<string, string>;
}

let loading: Promise<ReferenceIndex> | null = null;

const load = async (): Promise<ReferenceIndex> => {
  const [specialties, conditions] = await Promise.all([getSpecialtiesAPI(null), getConditionsAPI()]);
  const index: ReferenceIndex = { specialtyId: new Map(), specialtySlug: new Map(), conditionId: new Map() };
  for (const s of arr(bodyOf(specialties))) {
    if (!isObject(s) || !str(s.slug) || !str(s.id)) continue;
    index.specialtyId.set(str(s.slug), str(s.id));
    index.specialtySlug.set(str(s.id), str(s.slug));
  }
  for (const c of arr(bodyOf(conditions))) if (isObject(c) && str(c.slug) && str(c.id)) index.conditionId.set(str(c.slug), str(c.id));
  return index;
};

export const referenceIndex = (): Promise<ReferenceIndex> => {
  loading ??= load().catch(e => {
    loading = null;
    throw e;
  });
  return loading;
};

/** After staff change specialties or conditions (and between tests). */
export const resetReferenceIndex = () => {
  loading = null;
};

/** Slugs → ids; unknown slugs are left out. */
export const specialtyIds = async (slugs: (string | null | undefined)[]) => {
  const { specialtyId } = await referenceIndex();
  return slugs.map(s => (s ? specialtyId.get(s) : undefined)).filter((id): id is string => !!id);
};

export const conditionIds = async (slugs: string[]) => {
  const { conditionId } = await referenceIndex();
  return slugs.map(s => conditionId.get(s)).filter((id): id is string => !!id);
};
