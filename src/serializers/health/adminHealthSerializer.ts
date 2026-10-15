// MetroMatrix — Admin Health serializers.
// TODO(API_HEALTH): shapes from docs/API_HEALTH_ASSUMED.md.

import type { AdminAppointment, AdminCondition, AdminDoctor, AdminSpecialty, HealthOverview } from '../../types/health';
import { arr, bool, isObject, num, oneOf, str, strOrNull } from '../serializerUtils';
import { compact, count, isoOrNull } from '../shopping/common';
import { conditionSerializer, specialtySerializer } from './discoverySerializer';
import { appointmentDetailSerializer } from './appointmentSerializer';
import { strings } from './healthCommon';

export const healthOverviewSerializer = (raw: unknown): HealthOverview | null => {
  if (!isObject(raw)) return null;
  return {
    listedDoctors: count(raw.listedDoctors),
    bySpecialty: compact(arr(raw.bySpecialty).map(s => (isObject(s) && str(s.name) ? { name: str(s.name), count: count(s.count) } : null))),
    bookingsToday: count(raw.bookingsToday),
    cancelledToday: count(raw.cancelledToday),
    noShowsToday: count(raw.noShowsToday),
    pendingVerification: count(raw.pendingVerification),
  };
};

export const adminSpecialtySerializer = (raw: unknown): AdminSpecialty | null => {
  const s = specialtySerializer(raw);
  return s && isObject(raw) ? { ...s, sort: Math.round(num(raw.sort)) } : null;
};

export const adminConditionSerializer = (raw: unknown): AdminCondition | null => {
  const c = conditionSerializer(raw);
  return c && isObject(raw) ? { ...c, aliases: strings(raw.aliases) } : null;
};

const STATUSES = ['draft', 'pending_approval', 'approved', 'rejected', 'suspended'] as const;

export const adminDoctorSerializer = (raw: unknown): AdminDoctor | null => {
  if (!isObject(raw)) return null;
  const businessId = str(raw.businessId);
  if (!businessId) return null;
  return {
    businessId,
    name: str(raw.name, 'Doctor'),
    specialty: str(raw.specialty),
    city: str(raw.city),
    pmdcNumber: str(raw.pmdcNumber),
    pmdcVerified: bool(raw.pmdcVerified),
    pmdcNote: strOrNull(raw.pmdcNote),
    pmdcVerifiedAt: isoOrNull(raw.pmdcVerifiedAt),
    status: oneOf(raw.status, STATUSES, 'pending_approval'),
    submittedAt: isoOrNull(raw.submittedAt),
    documents: compact(
      arr(raw.documents).map(d =>
        isObject(d) && str(d.url) ? { id: str(d.id, str(d.url)), kind: str(d.kind), url: str(d.url), mimeType: str(d.mimeType, 'image/png') } : null,
      ),
    ),
  };
};

export const adminAppointmentSerializer = (raw: unknown): AdminAppointment | null => {
  const a = appointmentDetailSerializer(raw);
  return a && isObject(raw) ? { ...a, doctorBusinessId: str(raw.doctorBusinessId) } : null;
};
