// ═══════════════════════════════════════════════════════
// MetroMatrix — Dummy Health database shapes
// ═══════════════════════════════════════════════════════
// Rows keep the app's own vocabulary; healthWire builds each response in
// the shape MetroMatrix-API docs/API_HEALTH.md describes.

import type {
  AppointmentEventType,
  AppointmentPaymentMethod,
  AppointmentPaymentStatus,
  AppointmentStatus,
  BookingRules,
  ConsultKind,
  ExperienceRow,
  FamilyRelation,
  Medicine,
  MedicineForm,
  Qualification,
  ReasonTag,
  RecordFile,
  RecordType,
  ReviewDimension,
  WeekDayHours,
} from '../../../../types/health';
import type { Gender } from '../../../../types/auth';
import type { PaymentAccount, PaymentInstructions, PaymentProof } from '../../../../types/payments';

export interface MockSpecialty {
  id: string;
  slug: string;
  name: string;
  nameUr: string;
  icon: string;
  sort: number;
  /** Staff retire a specialty instead of deleting it (absent = active). */
  isActive?: boolean;
}

export interface MockCondition {
  id: string;
  slug: string;
  name: string;
  nameUr: string | null;
  specialtySlug: string | null;
  isCommon: boolean;
  /** The API's icon key for the home's concern chips (the common ones). */
  icon: string | null;
  aliases: string[];
  /** Staff retire a condition instead of deleting it (absent = active). */
  isActive?: boolean;
}

export interface MockDoctor {
  id: string;
  /** The partner account and business behind it (null for catalogue-only seed doctors). */
  ownerId: string | null;
  businessId: string | null;
  title: string;
  name: string;
  gender: Gender;
  photoUrl: string | null;
  specialtySlug: string | null;
  secondarySpecialtySlug: string | null;
  practisingSince: number | null;
  languages: string[];
  about: string;
  qualifications: Qualification[];
  experience: ExperienceRow[];
  services: string[];
  conditionSlugs: string[];
  bookingRules: BookingRules;
  pmdcNumber: string;
  isListed: boolean;
  topBooked: boolean;
  city: string;
  /** Practice setup: the doctor has looked at the patient-view preview. */
  previewSeen: boolean;
  createdAt: string;
}

export interface MockLocation {
  id: string;
  doctorId: string;
  kind: ConsultKind;
  name: string;
  area: string;
  city: string;
  address: string | null;
  lat: number | null;
  lng: number | null;
  phone: string | null;
  fee: number;
  slotMinutes: number;
  instructions: string | null;
  timezone: string;
  requiresPrepay: boolean;
  hours: WeekDayHours[];
  isActive: boolean;
}

export interface MockTimeOff {
  id: string;
  doctorId: string;
  from: string;
  to: string;
  locationId: string | null;
  reason: string | null;
}

export interface MockEvent {
  type: AppointmentEventType;
  note: string | null;
  createdAt: string;
}

export interface MockAppointment {
  id: string;
  code: string;
  doctorId: string;
  locationId: string;
  /** The booking account (a seeded stand-in patient for some doctor-side rows). */
  userId: string;
  familyMemberId: string | null;
  patientName: string;
  patientDob: string | null;
  patientGender: Gender | null;
  patientPhone: string | null;
  kind: ConsultKind;
  startAt: string;
  endAt: string;
  status: AppointmentStatus;
  reasonTags: ReasonTag[];
  reason: string | null;
  recordIds: string[];
  paymentMethod: AppointmentPaymentMethod;
  paymentStatus: AppointmentPaymentStatus;
  fee: number;
  instructions: PaymentInstructions | null;
  proof: PaymentProof | null;
  events: MockEvent[];
  checkedInAt: string | null;
  startedAt: string | null;
  completedAt: string | null;
  cancelledBy: 'patient' | 'doctor' | 'system' | null;
  cancelReason: string | null;
  lateCancel: boolean;
  rescheduleCount: number;
  /** The appointment this one replaced (a reschedule books a new one). */
  rescheduledFromId?: string | null;
  notes: { text: string; attachments: string[]; updatedAt: string | null };
  prescriptionId: string | null;
  reviewId: string | null;
  roomSecret: string;
  createdAt: string;
}

export interface MockFamilyMember {
  id: string;
  userId: string;
  name: string;
  relation: FamilyRelation;
  gender: Gender;
  dateOfBirth: string;
  phone: string | null;
}

export interface MockRecord {
  id: string;
  userId: string;
  memberId: string | null;
  title: string;
  type: RecordType;
  recordedOn: string;
  files: RecordFile[];
  createdAt: string;
}

export interface MockPrescription {
  id: string;
  appointmentId: string;
  doctorId: string;
  issuedAt: string;
  diagnosis: string;
  medicines: Medicine[];
  tests: string[];
  advice: string | null;
  followUpInDays: number | null;
}

export interface MockDoctorReview {
  id: string;
  doctorId: string;
  appointmentId: string | null;
  userId: string | null;
  authorName: string;
  anonymous: boolean;
  rating: number;
  recommend: boolean;
  dimensions: Partial<Record<ReviewDimension, number>>;
  tags: string[];
  text: string | null;
  kind: ConsultKind;
  /** Measured from the visit (check-in → start), when there was one. */
  waitMinutes: number | null;
  createdAt: string;
  reply: { text: string; createdAt: string } | null;
  isHidden: boolean;
  hiddenReason: string | null;
}

export interface MockFormularyItem {
  name: string;
  strength: string;
  form: MedicineForm;
}

/** A Health home promotion. targetId is a specialty, condition or doctor id. */
export interface MockHealthBanner {
  id: string;
  imageUrl: string;
  title: string;
  subtitle: string | null;
  targetType: 'specialty' | 'condition' | 'doctor' | 'screen' | 'none';
  targetId: string | null;
  targetScreen: 'video_consultation' | 'symptom_checker' | 'emergency' | 'records' | 'available_today' | null;
  /** null: every city. */
  city: string | null;
  startsAt: string | null;
  endsAt: string | null;
  sort: number;
  isActive: boolean;
}

export interface MockHealth {
  specialties: MockSpecialty[];
  conditions: MockCondition[];
  doctors: MockDoctor[];
  locations: MockLocation[];
  timeOff: MockTimeOff[];
  appointments: MockAppointment[];
  family: MockFamilyMember[];
  records: MockRecord[];
  prescriptions: MockPrescription[];
  reviews: MockDoctorReview[];
  /** doctorId → the accounts patients transfer to. */
  paymentAccounts: Record<string, PaymentAccount[]>;
  /** businessId → staff's PMDC check. */
  pmdc: Record<string, { verified: boolean; note: string | null; at: string | null }>;
  /** doctorId → their favourite medicines (first in suggestions). */
  favourites: Record<string, MockFormularyItem[]>;
  formulary: MockFormularyItem[];
  /** user|key → the first response to that booking. */
  idempotency: Record<string, { status: number; payload: unknown }>;
  /** Clinic days (locationId|date) where the dummy API already let another patient take the first time. */
  contested: string[];
  banners: MockHealthBanner[];
  seq: number;
}
