// ═══════════════════════════════════════════════════════
// MetroMatrix — Admin Health serializers
// ═══════════════════════════════════════════════════════
// Shapes: MetroMatrix-API docs/API_HEALTH.md §4.4.

import type { AdminAppointment, AdminCondition, AdminDoctor, AdminSpecialty, HealthOverview } from '../../types/health';
import { arr, isObject, num, oneOf, str, fromResponse } from '../serializerUtils';
import { compact, count, isoOrNull } from '../shopping/common';
import { conditionSerializer, specialtySerializer } from './discoverySerializer';
import { appointmentDetailSerializer } from './appointmentSerializer';
import { TITLE_PREFIX, mimeFromUrl, strings } from './healthCommon';

/** `{ doctors: { listed, awaitingPmdc }, listedBySpecialty, today: { newBookings, cancellations, noShows } }`. */
export const healthOverviewSerializer = fromResponse((raw: unknown): HealthOverview | null => {
  if (!isObject(raw)) return null;
  const d = isObject(raw.doctors) ? raw.doctors : {};
  const t = isObject(raw.today) ? raw.today : {};
  return {
    listedDoctors: count(d.listed),
    bySpecialty: compact(
      arr(raw.listedBySpecialty).map(s => (isObject(s) && str(s.name) ? { name: str(s.name), count: count(s.doctors ?? s.count) } : null)),
    ),
    bookingsToday: count(t.newBookings),
    cancelledToday: count(t.cancellations),
    noShowsToday: count(t.noShows),
    pendingVerification: count(d.awaitingPmdc),
  };
});

/** Staff specialties carry `sort`, `isActive` and `doctors`; a deactivated one is gone from the app's list. */
export const adminSpecialtySerializer = fromResponse((raw: unknown): AdminSpecialty | null => {
  if (!isObject(raw) || raw.isActive === false) return null;
  const s = specialtySerializer(raw);
  return s ? { ...s, sort: Math.round(num(raw.sort)) } : null;
});

export const adminConditionSerializer = fromResponse((raw: unknown): AdminCondition | null => {
  if (!isObject(raw) || raw.isActive === false) return null;
  const c = conditionSerializer(raw);
  return c ? { ...c, aliases: strings(raw.aliases) } : null;
});

const BUSINESS_STATUSES = ['draft', 'pending_approval', 'approved', 'rejected', 'suspended'] as const;

/**
 * A row of `GET /admin/health/doctors`: the doctor, their specialty and
 * documents, and the business behind them (the app keys rows by business).
 */
export const adminDoctorSerializer = (raw: unknown): AdminDoctor | null => {
  if (!isObject(raw)) return null;
  const b = isObject(raw.business) ? raw.business : {};
  const businessId = str(b.id) || str(raw.businessId);
  if (!businessId) return null;
  const specialty = isObject(raw.specialty) ? str(raw.specialty.name) : str(raw.specialty);
  const pmdc = str(raw.pmdcNumber);
  const verifiedAt = isoOrNull(raw.pmdcVerifiedAt);
  return {
    businessId,
    name: str(raw.fullName) ? `${TITLE_PREFIX[str(raw.title)] ?? 'Dr.'} ${str(raw.fullName)}` : str(b.name, 'Doctor'),
    specialty,
    city: str(b.city),
    pmdcNumber: pmdc.startsWith('UNSET-') ? '' : pmdc,
    pmdcVerified: !!verifiedAt,
    pmdcNote: null,
    pmdcVerifiedAt: verifiedAt,
    status: oneOf(b.status, BUSINESS_STATUSES, 'pending_approval'),
    submittedAt: isoOrNull(b.submittedAt),
    documents: compact(
      arr(raw.documents).map(d =>
        isObject(d) && str(d.url) ? { id: str(d.id, str(d.url)), kind: str(d.kind), url: str(d.url), mimeType: mimeFromUrl(str(d.url)) } : null,
      ),
    ),
  };
};

/**
 * A staff appointment: booking facts and the payment trail. Staff learn only
 * whether a prescription was written (`hasPrescription`), never what it says.
 */
export const adminAppointmentSerializer = fromResponse((raw: unknown): AdminAppointment | null => {
  const a = appointmentDetailSerializer(raw);
  if (!a || !isObject(raw)) return null;
  const doctor = isObject(raw.doctor) ? raw.doctor : {};
  return {
    ...a,
    doctorBusinessId: str(doctor.businessId),
    prescriptionId: raw.hasPrescription === true ? 'written' : null,
  };
});

/** A list of adminSpecialtys, as the API answers it. */
export const adminSpecialtyListSerializer = fromResponse(raw => compact(arr(raw).map(adminSpecialtySerializer)));

/** The conditions list (an array, or `{ items }`). */
export const adminConditionListSerializer = fromResponse(raw =>
    compact(arr(isObject(raw) ? raw.items : raw).map(adminConditionSerializer)));

/** Doctors to verify (an array, or `{ items }`). */
export const adminDoctorListSerializer = fromResponse(raw =>
    compact(arr(isObject(raw) ? raw.items : raw).map(adminDoctorSerializer)));

/** The one doctor a lookup found, or null. */
export const adminDoctorLookupSerializer = fromResponse(raw => adminDoctorSerializer(arr(isObject(raw) ? raw.items : []).find(isObject)));

/** A created row's id (a condition before its specialty is set). */
export const adminCreatedIdSerializer = fromResponse(raw => (isObject(raw) ? str(raw.id) : ''));

/** The doctor behind a business (a one-row page): their id, for the PMDC check. */
export const adminDoctorIdSerializer = fromResponse(raw => {
  const row = arr(isObject(raw) ? raw.items : []).find(isObject);
  return isObject(row) ? str(row.id) : '';
});
