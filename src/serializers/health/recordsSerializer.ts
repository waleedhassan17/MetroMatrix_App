// MetroMatrix — Family, records, prescriptions, video and symptom serializers.
// TODO(API_HEALTH): shapes from docs/API_HEALTH_ASSUMED.md.

import type {
  FamilyMember,
  FamilyRelation,
  HealthRecord,
  Medicine,
  MedicineForm,
  MedicineTiming,
  Prescription,
  PrescriptionSummary,
  RecordFile,
  RecordType,
  SymptomResult,
  VideoJoin,
} from '../../types/health';
import { arr, isObject, oneOf, str, strOrNull } from '../serializerUtils';
import { compact, count, iso } from '../shopping/common';
import { KINDS, dayOrNull, emergencyNumbersSerializer, gender, numOrNull, specialtyRefSerializer, strings } from './healthCommon';

const RELATIONS: readonly FamilyRelation[] = ['spouse', 'child', 'parent', 'sibling', 'other'];
const RECORD_TYPES: readonly RecordType[] = ['lab_report', 'prescription', 'imaging', 'discharge', 'other'];
const FORMS: readonly MedicineForm[] = ['tablet', 'capsule', 'syrup', 'injection', 'drops', 'cream', 'inhaler', 'other'];
const TIMINGS: readonly MedicineTiming[] = ['before_meal', 'after_meal', 'with_meal', 'bedtime', 'as_needed'];

export const familyMemberSerializer = (raw: unknown): FamilyMember | null => {
  if (!isObject(raw)) return null;
  const id = str(raw.id);
  if (!id) return null;
  return {
    id,
    name: str(raw.name, 'Family member'),
    relation: oneOf(raw.relation, RELATIONS, 'other'),
    gender: gender(raw.gender) ?? 'other',
    dateOfBirth: dayOrNull(raw.dateOfBirth) ?? '',
    phone: strOrNull(raw.phone),
  };
};

export const familySerializer = (raw: unknown): FamilyMember[] => compact(arr(raw).map(familyMemberSerializer));

const fileSerializer = (raw: unknown): RecordFile | null =>
  isObject(raw) && str(raw.url) ? { url: str(raw.url), mime: str(raw.mime, 'image/jpeg') } : null;

export const healthRecordSerializer = (raw: unknown): HealthRecord | null => {
  if (!isObject(raw)) return null;
  const id = str(raw.id);
  if (!id) return null;
  return {
    id,
    title: str(raw.title, 'Record'),
    type: oneOf(raw.type, RECORD_TYPES, 'other'),
    recordedOn: dayOrNull(raw.recordedOn) ?? iso(raw.createdAt).slice(0, 10),
    memberId: strOrNull(raw.memberId),
    memberName: str(raw.memberName, 'Me'),
    files: compact(arr(raw.files).map(fileSerializer)),
    createdAt: iso(raw.createdAt),
  };
};

export const medicineSerializer = (raw: unknown): Medicine | null => {
  if (!isObject(raw) || !str(raw.name)) return null;
  return {
    name: str(raw.name),
    strength: str(raw.strength),
    form: oneOf(raw.form, FORMS, 'tablet'),
    dose: str(raw.dose, '1+0+1'),
    timing: oneOf(raw.timing, TIMINGS, null),
    days: Math.max(1, count(raw.days) || 1),
    instructions: strOrNull(raw.instructions),
  };
};

export const prescriptionSerializer = (raw: unknown): Prescription | null => {
  if (!isObject(raw)) return null;
  const id = str(raw.id);
  if (!id) return null;
  const d = isObject(raw.doctor) ? raw.doctor : {};
  const p = isObject(raw.patient) ? raw.patient : {};
  const follow = numOrNull(raw.followUpInDays);
  return {
    id,
    appointmentCode: str(raw.appointmentCode),
    doctorId: str(raw.doctorId),
    locationId: str(raw.locationId),
    kind: oneOf(raw.kind, KINDS, 'clinic'),
    doctor: {
      name: str(d.name, 'Doctor'),
      specialtyName: str(d.specialtyName),
      qualifications: str(d.qualifications),
      pmdcNumber: str(d.pmdcNumber),
      place: str(d.place),
      phone: strOrNull(d.phone),
    },
    patient: { name: str(p.name, 'Patient'), age: numOrNull(p.age), gender: gender(p.gender) },
    issuedAt: iso(raw.issuedAt),
    diagnosis: str(raw.diagnosis),
    medicines: compact(arr(raw.medicines).map(medicineSerializer)),
    tests: strings(raw.tests),
    advice: strOrNull(raw.advice),
    followUpInDays: follow && follow > 0 ? Math.round(follow) : null,
    editableUntil: iso(raw.editableUntil),
  };
};

export const prescriptionSummarySerializer = (raw: unknown): PrescriptionSummary | null => {
  if (!isObject(raw)) return null;
  const id = str(raw.id);
  if (!id) return null;
  return {
    id,
    appointmentCode: str(raw.appointmentCode),
    doctorName: str(raw.doctorName, 'Doctor'),
    specialtyName: str(raw.specialtyName),
    diagnosis: str(raw.diagnosis),
    issuedAt: iso(raw.issuedAt),
    patientName: str(raw.patientName),
  };
};

export const videoJoinSerializer = (raw: unknown): VideoJoin | null => {
  if (!isObject(raw)) return null;
  const roomUrl = str(raw.roomUrl);
  if (!/^https:\/\//.test(roomUrl)) return null;
  return {
    provider: oneOf(raw.provider, ['jitsi', 'jaas'] as const, 'jitsi'),
    roomUrl,
    jwt: strOrNull(raw.jwt),
    displayName: str(raw.displayName, 'Patient'),
    closesAt: iso(raw.closesAt),
  };
};

const DISCLAIMER =
  'This is general information, not a diagnosis. Only a doctor who examines you can diagnose and treat you. If symptoms are severe or getting worse, call 1122.';

export const symptomResultSerializer = (raw: unknown): SymptomResult | null => {
  if (!isObject(raw)) return null;
  return {
    emergency: raw.emergency === true,
    emergencyNumbers: emergencyNumbersSerializer(raw.emergencyNumbers),
    areas: compact(arr(raw.areas).map(a => (isObject(a) && str(a.title) ? { title: str(a.title), body: str(a.body) } : null))).slice(0, 3),
    specialty: isObject(raw.specialty) && str(raw.specialty.slug) ? specialtyRefSerializer(raw.specialty) : null,
    // Never shown without one: the API's own words, or ours.
    disclaimer: str(raw.disclaimer) || DISCLAIMER,
  };
};
