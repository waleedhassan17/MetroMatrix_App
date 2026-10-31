// ═══════════════════════════════════════════════════════
// MetroMatrix — The doctor app's reads and writes, composed
// ═══════════════════════════════════════════════════════
// FinMatrix's flow, Network → Serializer, for what several doctor slices
// share: an action answers the appointment's core, so the whole of it
// (notes and prescription too) is read back; the location list is read from
// three routes (locations, each one's hours, the profile's prepay rule); the
// profile is edited in slugs and stored by id (referenceIndex).

import { required } from '../../networks/network/network';
import {
  actOnAppointment as actOnAppointmentRequest,
  cancelByDoctor as cancelByDoctorRequest,
  completeAppointment as completeAppointmentRequest,
  confirmPayment as confirmPaymentRequest,
  fetchAppointmentNotes,
  fetchAppointmentPrescription,
  fetchDoctorAppointment,
  fetchDoctorAppointments,
  fetchDoctorToday,
  rejectPayment as rejectPaymentRequest,
  saveNotes as saveNotesRequest,
  type DoctorAction,
} from '../../networks/health/doctor/doctorAppointments';
import {
  addTimeOff as addTimeOffRequest,
  createLocation as createLocationRequest,
  fetchDoctorLocations,
  fetchLocationSchedule,
  fetchTimeOff,
  saveHours as saveHoursRequest,
  updateLocation as updateLocationRequest,
} from '../../networks/health/doctor/practice';
import { fetchOwnProfile, publishProfile as publishProfileRequest, updateOwnProfile as updateOwnProfileRequest } from '../../networks/health/doctor/profile';
import { fetchDoctorPrescription, issuePrescription } from '../../networks/health/doctor/prescriptionWriter';
import { fetchMyBusiness } from '../../networks/businesses/business';
import { conditionIds, referenceIndex, specialtyIds } from '../../networks/health/referenceIndex';
import { businessSerializer } from '../../serializers/businessSerializer';
import {
  activeLocations,
  addedTimeOffSerializer,
  calendarSerializer,
  doctorAppointmentSerializer,
  doctorDaySerializer,
  locationTimezone,
  ownProfileSerializer,
  practiceLocationsSerializer,
  prescriptionAppointmentCodeSerializer,
  savedHoursSerializer,
  savedLocationSerializer,
  timeOffListSerializer,
} from '../../serializers/health/doctorSerializer';
import { prescriptionSerializer } from '../../serializers/health/recordsSerializer';
import { titleKey } from '../../serializers/health/healthCommon';
import { arr, bodiesOf, bodyOf, isObject, str } from '../../serializers/serializerUtils';
import type {
  DoctorLocationInput,
  DoctorOwnProfile,
  PrescriptionInput,
  TimeOffInput,
  WeekDayHours,
} from '../../models/health';

// ─── Appointments ────────────────────────────────────

/** The appointment with its history and shared records, its private notes and its prescription. */
export const getDoctorAppointment = async (id: string) => {
  const [appointment, notes, prescription] = await Promise.all([
    fetchDoctorAppointment(id),
    fetchAppointmentNotes(id),
    fetchAppointmentPrescription(id),
  ]);
  return required(doctorAppointmentSerializer(bodiesOf({ appointment, notes, prescription })));
};

export const actOnAppointment = async (id: string, action: DoctorAction) => {
  await actOnAppointmentRequest(id, action);
  return getDoctorAppointment(id);
};

export const completeAppointment = async (id: string, paymentCollected: boolean) => {
  await completeAppointmentRequest(id, paymentCollected);
  return getDoctorAppointment(id);
};

export const cancelByDoctor = async (id: string, reason: string) => {
  await cancelByDoctorRequest(id, reason);
  return getDoctorAppointment(id);
};

export const confirmPayment = async (id: string) => {
  await confirmPaymentRequest(id);
  return getDoctorAppointment(id);
};

export const rejectPayment = async (id: string, reason: string) => {
  await rejectPaymentRequest(id, reason);
  return getDoctorAppointment(id);
};

export const saveNotes = async (id: string, notes: { text: string; attachments: string[] }) => {
  await saveNotesRequest(id, notes);
  return getDoctorAppointment(id);
};

/** Today's queue (another day: that day's appointments), with the practice's locations. */
export const getToday = async (date: string | null, locationId: string | null) => {
  const [day, locations] = await Promise.all([
    date ? fetchDoctorAppointments({ date, pageSize: 100 }) : fetchDoctorToday(),
    fetchDoctorLocations(),
  ]);
  return required(doctorDaySerializer({ day, locations }, date, locationId));
};

/** The range's appointments (first 100), time off and locations. */
export const getCalendar = async (from: string, to: string) => {
  const [appointments, timeOff, locations] = await Promise.all([
    fetchDoctorAppointments({ from, to, pageSize: 100 }),
    fetchTimeOff(),
    fetchDoctorLocations(),
  ]);
  return calendarSerializer(bodiesOf({ appointments, timeOff, locations }));
};

// ─── Locations, hours and time off ───────────────────

/** The locations in use with their weekly hours, and the video prepay rule. */
export const listLocations = async () => {
  const [locations, profile] = await Promise.all([fetchDoctorLocations(), fetchOwnProfile()]);
  const schedules = Object.fromEntries(
    await Promise.all(activeLocations(locations).map(async l => [str(l.id), await fetchLocationSchedule(str(l.id))] as const)),
  );
  return practiceLocationsSerializer({ locations, schedules, profile });
};

/** Prepay is the doctor's rule for video; set it when a video location asks for it (needs a payment account). */
const syncPrepay = async (input: Partial<DoctorLocationInput>) => {
  if (input.kind === 'video' && input.requiresPrepay !== undefined) {
    await updateOwnProfileRequest({ videoPrepayRequired: input.requiresPrepay });
  }
};

export const createLocation = async (input: DoctorLocationInput) => {
  const raw = await createLocationRequest(input);
  await syncPrepay(input);
  return required(savedLocationSerializer(raw, !!input.requiresPrepay));
};

export const updateLocation = async (id: string, input: Partial<DoctorLocationInput>) => {
  const raw = await updateLocationRequest(id, input);
  await syncPrepay(input);
  return required(savedLocationSerializer(raw, !!input.requiresPrepay));
};

/**
 * Replaces the week. A clash with another location answers 409
 * SCHEDULE_OVERLAP with details.conflict (overlapsFrom()).
 */
export const saveHours = async (id: string, hours: WeekDayHours[]) => {
  const [schedule, locations] = await Promise.all([saveHoursRequest(id, hours), fetchDoctorLocations()]);
  return required(savedHoursSerializer({ schedule, locations }, id));
};

export const listTimeOff = async () => {
  const [timeOff, locations] = await Promise.all([fetchTimeOff(), fetchDoctorLocations()]);
  return timeOffListSerializer(bodiesOf({ timeOff, locations }));
};

/**
 * Whole days in the location's zone. Over booked visits this answers 409
 * TIME_OFF_CONFLICTS (conflictsFrom()) unless `cancelConflicts`.
 */
export const addTimeOff = async (input: TimeOffInput, cancelConflicts = false) => {
  const locations = await fetchDoctorLocations();
  const created = await addTimeOffRequest(input, locationTimezone(locations, input.locationId ?? null), cancelConflicts);
  return required(addedTimeOffSerializer({ created, locations }));
};

// ─── Profile ─────────────────────────────────────────

/** The profile as the app reads it: its second specialty named by slug. */
const readProfile = async (raw: unknown): Promise<DoctorOwnProfile> => {
  const { specialtySlug } = await referenceIndex();
  const body = bodyOf(raw);
  const second = isObject(body) ? str(arr(body.secondarySpecialtyIds)[0]) : '';
  return required(ownProfileSerializer(isObject(body) ? { ...body, secondarySpecialtySlug: specialtySlug.get(second) ?? null } : null));
};

export const getOwnProfile = async () => readProfile(await fetchOwnProfile());

/** The fields the form changed, as the API names them (lists replace what's stored). */
const ownProfileBody = async (p: Partial<DoctorOwnProfile>) => {
  const out: Record<string, unknown> = {};
  if (p.title !== undefined) out.title = titleKey(p.title);
  if (p.name !== undefined) out.fullName = p.name;
  if (p.gender !== undefined) out.gender = p.gender;
  if (p.photoUrl !== undefined) out.photoUrl = p.photoUrl;
  if (p.specialtySlug !== undefined) out.primarySpecialtyId = (await specialtyIds([p.specialtySlug]))[0];
  if (p.secondarySpecialtySlug !== undefined) out.secondarySpecialtyIds = await specialtyIds([p.secondarySpecialtySlug]);
  if (p.practisingSince !== undefined) out.practicingSince = p.practisingSince ?? undefined;
  if (p.languages !== undefined) out.languages = p.languages;
  if (p.about !== undefined) out.about = p.about;
  if (p.qualifications !== undefined) out.qualifications = p.qualifications.map(q => ({ degree: q.degree, institute: q.institute, year: q.year ?? undefined }));
  if (p.experience !== undefined)
    out.experiences = p.experience.map(e => ({ designation: e.role, institute: e.place, fromYear: e.from ?? undefined, toYear: e.to ?? undefined }));
  if (p.services !== undefined) out.services = p.services;
  if (p.conditionSlugs !== undefined) out.conditionIds = await conditionIds(p.conditionSlugs);
  if (p.bookingRules !== undefined) {
    out.bookingWindowDays = p.bookingRules.windowDays;
    out.minNoticeMinutes = p.bookingRules.minNoticeMinutes;
    out.cancelCutoffMinutes = Math.round(p.bookingRules.cancelCutoffHours * 60);
    out.videoPrepayRequired = p.bookingRules.videoPrepay;
  }
  return out;
};

export const updateOwnProfile = async (patch: Partial<DoctorOwnProfile>) =>
  readProfile(await updateOwnProfileRequest(await ownProfileBody(patch)));

/** Lists the doctor (`422 PROFILE_INCOMPLETE` until the checklist is done): the business, now listed. */
export const publishProfile = async () => {
  await publishProfileRequest();
  return required(businessSerializer(await fetchMyBusiness()));
};

// ─── Prescriptions ───────────────────────────────────

/** `409 PRESCRIPTION_LOCKED` once the 24-hour edit window has passed: re-issued on its appointment. */
export const updatePrescription = async (id: string, input: PrescriptionInput) => {
  const code = prescriptionAppointmentCodeSerializer(await fetchDoctorPrescription(id));
  return required(prescriptionSerializer(await issuePrescription(code, input)));
};
