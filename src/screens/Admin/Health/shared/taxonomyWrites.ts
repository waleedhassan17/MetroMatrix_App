// ═══════════════════════════════════════════════════════
// MetroMatrix — Staff edits to the Health taxonomy, composed
// ═══════════════════════════════════════════════════════
// FinMatrix's flow, Network → Serializer. Staff edits change what slugs mean,
// so each one drops the cached slug index (resetReferenceIndex); a condition
// keeps one specialty, set by id after it is saved.

import { required } from '@networks/network/apiHelpers';
import {
  createConditionAPI,
  createSpecialtyAPI,
  deleteConditionAPI,
  deleteSpecialtyAPI,
  getAdminDoctorByBusinessAPI,
  setConditionSpecialtiesAPI,
  updateConditionAPI,
  updateSpecialtyAPI,
  verifyPmdcAPI,
} from '@networks/admin/adminHealthNetwork';
import { resetReferenceIndex, specialtyIds } from '@networks/health/referenceIndex';
import {
  adminConditionSerializer,
  adminCreatedIdSerializer,
  adminDoctorIdSerializer,
  adminDoctorLookupSerializer,
  adminSpecialtySerializer,
} from '@serializers/health/adminHealthSerializer';
import type { AdminConditionInput, AdminSpecialtyInput } from '@/types/health';

/** Runs a taxonomy write, then drops the cached slug index whatever happened. */
const fresh = async <T>(write: () => Promise<T>): Promise<T> => {
  try {
    return await write();
  } finally {
    resetReferenceIndex();
  }
};

export const createSpecialty = (input: AdminSpecialtyInput) =>
  fresh(async () => required(adminSpecialtySerializer(await createSpecialtyAPI(input))));

export const updateSpecialty = (id: string, input: Partial<AdminSpecialtyInput>) =>
  fresh(async () => required(adminSpecialtySerializer(await updateSpecialtyAPI(id, input))));

export const deleteSpecialty = (id: string) =>
  fresh(async () => {
    await deleteSpecialtyAPI(id);
    return true as const;
  });

export const createCondition = (input: AdminConditionInput) =>
  fresh(async () => {
    const id = adminCreatedIdSerializer(await createConditionAPI(input));
    return required(adminConditionSerializer(await setConditionSpecialtiesAPI(id, await specialtyIds([input.specialtySlug]))));
  });

export const updateCondition = (id: string, input: Partial<AdminConditionInput>) =>
  fresh(async () => {
    const saved = await updateConditionAPI(id, input);
    const raw = input.specialtySlug !== undefined ? await setConditionSpecialtiesAPI(id, await specialtyIds([input.specialtySlug])) : saved;
    return required(adminConditionSerializer(raw));
  });

export const deleteCondition = (id: string) =>
  fresh(async () => {
    await deleteConditionAPI(id);
    return true as const;
  });

/** Records the PMDC check on the doctor behind a business: the doctor, now verified. */
export const verifyPmdc = async (businessId: string, note: string) => {
  const doctorId = adminDoctorIdSerializer(await getAdminDoctorByBusinessAPI(businessId));
  await verifyPmdcAPI(doctorId, note);
  return required(adminDoctorLookupSerializer(await getAdminDoctorByBusinessAPI(businessId)));
};
