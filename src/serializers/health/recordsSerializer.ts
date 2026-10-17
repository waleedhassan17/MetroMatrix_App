// ═══════════════════════════════════════════════════════
// MetroMatrix — Family, records, prescriptions, video and symptom serializers
// ═══════════════════════════════════════════════════════
// Shapes: MetroMatrix-API docs/API_HEALTH.md §2 (Prescription, HealthRecord)
// and §4.2; video: docs/VIDEO.md.

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
  SymptomResult,
  VideoJoin,
} from '../../types/health';
import { arr, bool, isObject, oneOf, str, strOrNull } from '../serializerUtils';
import { compact, count, iso } from '../shopping/common';
import {
  KINDS,
  dayOrNull,
  doctorName,
  emergencyNumbersSerializer,
  gender,
  instant,
  mimeFromUrl,
  numOrNull,
  recordTypeIn,
  specialtyRefSerializer,
} from './healthCommon';

const RELATIONS: readonly FamilyRelation[] = ['spouse', 'child', 'parent', 'sibling', 'other'];
const FORMS: readonly MedicineForm[] = ['tablet', 'capsule', 'syrup', 'injection', 'drops', 'cream', 'other'];
const TIMINGS: readonly MedicineTiming[] = ['before_meal', 'after_meal', 'with_meal', 'bedtime', 'as_needed'];

/** Before completion a prescription stays open; the API dates the 24-hour window from completion. */
const OPEN_ENDED = '9999-12-31T23:59:59.000Z';

export const familyMemberSerializer = (raw: unknown): FamilyMember | null => {
  if (!isObject(raw)) return null;
  const id = str(raw.id);
  if (!id) return null;
  return {
    id,
    name: str(raw.fullName) || str(raw.name, 'Family member'),
    relation: oneOf(raw.relation, RELATIONS, 'other'),
    gender: gender(raw.gender) ?? 'other',
    dateOfBirth: dayOrNull(raw.dateOfBirth) ?? '',
    phone: strOrNull(raw.phone),
  };
};

export const familySerializer = (raw: unknown): FamilyMember[] => compact(arr(raw).map(familyMemberSerializer));

/** A file: the owner's short-lived `downloadUrl` when there is one (private PHI), else its URL. */
const fileSerializer = (raw: unknown): RecordFile | null => {
  if (!isObject(raw)) return null;
  const url = str(raw.downloadUrl) || str(raw.url);
  return url ? { url, mime: str(raw.mime) || mimeFromUrl(str(raw.url) || url) } : null;
};

/**
 * A health record: the owner's full view, or the metadata a visit shows
 * (`sharedRecords`: no files until the doctor opens one). `memberName` is
 * added by the network from the family list.
 */
export const healthRecordSerializer = (raw: unknown): HealthRecord | null => {
  if (!isObject(raw)) return null;
  const id = str(raw.id);
  if (!id) return null;
  const created = instant(raw.createdAt) ?? instant(raw.sharedAt) ?? iso(null);
  const memberId = strOrNull(raw.familyMemberId ?? raw.memberId);
  return {
    id,
    title: str(raw.title, 'Record'),
    type: recordTypeIn(raw.type),
    recordedOn: dayOrNull(raw.recordDate ?? raw.recordedOn) ?? created.slice(0, 10),
    memberId,
    memberName: str(raw.memberName) || (memberId ? 'Family member' : 'Me'),
    files: compact(arr(raw.files).map(fileSerializer)),
    createdAt: created,
  };
};

export const medicineSerializer = (raw: unknown): Medicine | null => {
  if (!isObject(raw) || !str(raw.name)) return null;
  return {
    name: str(raw.name),
    strength: str(raw.strength),
    form: oneOf(raw.form, FORMS, 'tablet'),
    dose: str(raw.dosePattern) || str(raw.dose, '1+0+1'),
    timing: oneOf(raw.timing, TIMINGS, null),
    days: Math.max(1, count(raw.durationDays ?? raw.days) || 1),
    instructions: strOrNull(raw.instructions),
  };
};

/** `Prescription` → what the patient reads and the PDF prints; the header comes from the doctor and the place. */
export const prescriptionSerializer = (raw: unknown): Prescription | null => {
  if (!isObject(raw)) return null;
  const id = str(raw.id);
  if (!id) return null;
  const d = isObject(raw.doctor) ? raw.doctor : {};
  const l = isObject(raw.location) ? raw.location : {};
  const p = isObject(raw.patient) ? raw.patient : {};
  const follow = numOrNull(raw.followUpInDays);
  const place = [str(l.name), str(l.area), str(l.city)].filter(Boolean).join(', ');
  return {
    id,
    appointmentCode: str(raw.appointmentCode),
    doctorId: str(d.id),
    locationId: str(l.id),
    kind: oneOf(raw.appointmentKind ?? l.kind, KINDS, 'clinic'),
    doctor: {
      name: doctorName(d),
      specialtyName: specialtyRefSerializer(d.specialty).name,
      qualifications: str(d.qualifications),
      pmdcNumber: str(d.pmdcNumber),
      place: place || 'Video consultation',
      phone: strOrNull(l.phone),
    },
    patient: { name: str(p.name, 'Patient'), age: numOrNull(p.age), gender: gender(p.gender) },
    issuedAt: iso(instant(raw.issuedAt)),
    diagnosis: str(raw.diagnosis),
    medicines: compact(arr(raw.medicines).map(medicineSerializer)),
    tests: compact(arr(raw.tests).map(t => (isObject(t) ? strOrNull(t.name) : strOrNull(t)))),
    advice: strOrNull(raw.advice),
    followUpInDays: follow && follow > 0 ? Math.round(follow) : null,
    editableUntil: instant(raw.editableUntil) ?? (bool(raw.locked) ? iso(null) : OPEN_ENDED),
  };
};

export const prescriptionSummarySerializer = (raw: unknown): PrescriptionSummary | null => {
  if (!isObject(raw)) return null;
  const id = str(raw.id);
  if (!id) return null;
  const d = isObject(raw.doctor) ? raw.doctor : {};
  const p = isObject(raw.patient) ? raw.patient : {};
  return {
    id,
    appointmentCode: str(raw.appointmentCode),
    doctorName: doctorName(d),
    specialtyName: specialtyRefSerializer(d.specialty).name,
    diagnosis: str(raw.diagnosis),
    issuedAt: iso(instant(raw.issuedAt)),
    patientName: str(p.name),
  };
};

/** `{ provider: jaas|public_jitsi, roomUrl, jwt, displayName, window: { closesAt } }`. */
export const videoJoinSerializer = (raw: unknown): VideoJoin | null => {
  if (!isObject(raw)) return null;
  const roomUrl = str(raw.roomUrl);
  if (!/^https:\/\//.test(roomUrl)) return null;
  const w = isObject(raw.window) ? raw.window : {};
  return {
    provider: str(raw.provider) === 'jaas' ? 'jaas' : 'jitsi',
    roomUrl,
    jwt: strOrNull(raw.jwt),
    displayName: str(raw.displayName, 'Patient'),
    closesAt: iso(instant(w.closesAt) ?? instant(raw.expiresAt)),
  };
};

const DISCLAIMER =
  'This is general information, not a diagnosis. Only a doctor who examines you can diagnose and treat you. If symptoms are severe or getting worse, call 1122.';

/**
 * Red flags `{ emergency: true, numbers, message }` or a suggestion
 * `{ areasToDiscuss: [{ title, explanation }], specialty }`; never without a disclaimer.
 */
export const symptomResultSerializer = (raw: unknown): SymptomResult | null => {
  if (!isObject(raw)) return null;
  const emergency = raw.emergency === true;
  return {
    emergency,
    emergencyNumbers: emergencyNumbersSerializer(raw.numbers ?? raw.emergencyNumbers),
    areas: emergency
      ? []
      : compact(
          arr(raw.areasToDiscuss).map(a =>
            isObject(a) && str(a.title) ? { title: str(a.title), body: str(a.explanation) || str(a.body) } : null,
          ),
        ).slice(0, 3),
    specialty: !emergency && isObject(raw.specialty) && str(raw.specialty.slug) ? specialtyRefSerializer(raw.specialty) : null,
    // Never shown without one: the API's own words, or ours.
    disclaimer: str(raw.disclaimer) || DISCLAIMER,
  };
};

/** Minutes between two instants, defensive. */
export const minutesBetween = (from: unknown, to: unknown) => {
  const a = Date.parse(str(from));
  const b = Date.parse(str(to));
  return Number.isFinite(a) && Number.isFinite(b) ? Math.max(0, Math.round((b - a) / 60_000)) : 0;
};

