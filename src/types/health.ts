// ═══════════════════════════════════════════════════════
// MetroMatrix — Healthcare types (mirror docs/API_HEALTH_ASSUMED.md)
// ═══════════════════════════════════════════════════════
// TODO(API_HEALTH): reconcile with MetroMatrix-API docs/API_HEALTH.md.
// Money is INTEGER rupees (format with utils/money.formatPKR). Times are ISO
// UTC; show them only through utils/healthTime in the location's timezone.

import type { Gender } from './auth';
import type { PaymentInstructions, PaymentProof } from './payments';

export type ConsultKind = 'video' | 'clinic';
export type DoctorBadge = 'pmdc_verified' | 'top_booked';

// ─── Discovery ────────────────────────────────────────
export interface SpecialtyRef {
  slug: string;
  name: string;
  /** Urdu name, shown after the English one. */
  nameUr: string;
}

export interface Specialty extends SpecialtyRef {
  id: string;
  /** Ionicons glyph name chosen by the API. */
  icon: string;
  doctorCount: number;
}

export interface Condition {
  id: string;
  slug: string;
  name: string;
  nameUr: string | null;
  specialtySlug: string | null;
  isCommon: boolean;
}

export interface EmergencyNumber {
  label: string;
  number: string;
}

/** "Available today, 6:00 PM" — the server words it; `today` tints the chip. */
export interface Availability {
  label: string | null;
  today: boolean;
  nextAt: string | null;
}

export interface DoctorCardData {
  id: string;
  name: string;
  photoUrl: string | null;
  gender: Gender | null;
  specialty: SpecialtyRef;
  /** One line: "MBBS, FCPS (Dermatology)". */
  qualifications: string;
  yearsExperience: number;
  rating: number | null;
  reviewCount: number;
  /** Measured average wait, when the API has enough visits to say. */
  waitMinutes: number | null;
  badges: DoctorBadge[];
  offersVideo: boolean;
  offersClinic: boolean;
  fromFee: number;
  availability: Availability;
  city: string;
}

/** "Mon, Wed, Fri" · "5:00 PM – 9:00 PM" (server-worded weekly timings). */
export interface TimingRow {
  days: string;
  hours: string;
}

export interface PracticeLocation {
  id: string;
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
  availability: Availability;
  timings: TimingRow[];
  /** Video only: the doctor asks for a transfer before the consult. */
  requiresPrepay: boolean;
}

export interface DoctorStats {
  satisfactionPct: number | null;
  waitMinutes: number | null;
  timeWithPatientMinutes: number | null;
  reviewCount: number;
}

export interface Qualification {
  degree: string;
  institute: string;
  year: number | null;
}

export interface ExperienceRow {
  role: string;
  place: string;
  from: number | null;
  /** null = to date. */
  to: number | null;
}

export type ReviewDimension = 'diagnosis' | 'staff' | 'environment';

export interface DoctorReviewSummary {
  average: number | null;
  count: number;
  recommendPct: number | null;
  /** Count of reviews per star, index 0 = 1 star. */
  distribution: number[];
  dimensions: { key: ReviewDimension; label: string; score: number | null }[];
  tags: { label: string; count: number }[];
}

export interface DoctorReview {
  id: string;
  authorName: string;
  rating: number;
  kind: ConsultKind;
  tags: string[];
  text: string | null;
  recommend: boolean | null;
  createdAt: string;
  reply: { text: string; createdAt: string } | null;
  /** Staff and the doctor's own view only. */
  isHidden: boolean;
  /** Doctor's view: the reply can still be edited until then. */
  replyEditableUntil: string | null;
  /** Staff moderation: whose review it is. */
  doctorName: string | null;
}

export interface BookingRules {
  windowDays: number;
  minNoticeMinutes: number;
  cancelCutoffHours: number;
  videoPrepay: boolean;
}

export interface DoctorProfile extends DoctorCardData {
  title: string;
  about: string;
  languages: string[];
  services: string[];
  conditions: { slug: string; name: string }[];
  qualificationList: Qualification[];
  experienceList: ExperienceRow[];
  locations: PracticeLocation[];
  stats: DoctorStats;
  reviewSummary: DoctorReviewSummary;
  topReviews: DoctorReview[];
  similar: DoctorCardData[];
  bookingRules: BookingRules;
}

export interface DayAvailability {
  /** YYYY-MM-DD in the location's timezone. */
  date: string;
  slotCount: number;
}

export type SlotPeriod = 'morning' | 'afternoon' | 'evening' | 'night';

export interface Slot {
  startAt: string;
  period: SlotPeriod;
}

export interface SlotDay {
  date: string;
  timezone: string;
  slots: Slot[];
  /** When the day is empty: the next day with a free slot. */
  nextAvailable: { date: string; startAt: string } | null;
}

export interface HealthHome {
  city: string;
  cities: string[];
  specialties: Specialty[];
  commonConditions: Condition[];
  availableToday: DoctorCardData[];
  upcoming: AppointmentSummary | null;
  emergencyNumbers: EmergencyNumber[];
}

export interface HealthSuggestions {
  doctors: { id: string; name: string; specialtyName: string }[];
  specialties: Specialty[];
  conditions: Condition[];
}

export type DoctorSort = 'recommended' | 'earliest' | 'fee_low' | 'most_reviewed' | 'most_experienced';

export interface DoctorQuery {
  specialty?: string | null;
  condition?: string | null;
  q?: string | null;
  city: string;
  kind?: ConsultKind | null;
  availableToday?: boolean;
  gender?: 'female' | 'male' | null;
  maxFee?: number | null;
  minYears?: number | null;
  minRating?: number | null;
  language?: string | null;
  area?: string | null;
  sort: DoctorSort;
}

// ─── Appointments ─────────────────────────────────────
export type AppointmentStatus =
  | 'awaiting_payment'
  | 'confirmed'
  | 'checked_in'
  | 'in_progress'
  | 'completed'
  | 'cancelled'
  | 'no_show';

export type AppointmentPaymentMethod = 'pay_at_visit' | 'transfer';

export type AppointmentPaymentStatus =
  | 'pay_at_visit'
  | 'awaiting_transfer'
  | 'proof_submitted'
  | 'proof_rejected'
  | 'paid'
  | 'collected';

export type AppointmentSegment = 'upcoming' | 'past';
export type ReasonTag = 'follow_up' | 'new_problem' | 'reports_review';
export type CancelReason = 'feeling_better' | 'schedule_clash' | 'booked_by_mistake' | 'other_doctor' | 'other';

export type AppointmentEventType =
  | 'booked'
  | 'payment_proof_submitted'
  | 'payment_confirmed'
  | 'payment_rejected'
  | 'confirmed'
  | 'rescheduled'
  | 'checked_in'
  | 'in_progress'
  | 'completed'
  | 'cancelled'
  | 'no_show'
  | 'prescription_issued';

export interface AppointmentEvent {
  type: AppointmentEventType;
  note: string | null;
  createdAt: string;
}

export interface AppointmentDoctorRef {
  id: string;
  name: string;
  photoUrl: string | null;
  specialty: SpecialtyRef;
}

export interface AppointmentLocationRef {
  id: string;
  kind: ConsultKind;
  name: string;
  area: string;
  city: string;
  address: string | null;
  lat: number | null;
  lng: number | null;
  phone: string | null;
  instructions: string | null;
}

export interface AppointmentSummary {
  id: string;
  code: string;
  status: AppointmentStatus;
  kind: ConsultKind;
  startAt: string;
  endAt: string;
  timezone: string;
  doctor: AppointmentDoctorRef;
  location: AppointmentLocationRef;
  patientName: string;
  fee: number;
  paymentStatus: AppointmentPaymentStatus;
  canJoinVideo: boolean;
  canPay: boolean;
  canReview: boolean;
  joinOpensAt: string | null;
}

export interface AppointmentPatient {
  familyMemberId: string | null;
  name: string;
  relation: string | null;
  age: number | null;
  gender: Gender | null;
}

export interface AppointmentPayment {
  method: AppointmentPaymentMethod;
  status: AppointmentPaymentStatus;
  amount: number;
  instructions: PaymentInstructions | null;
  proof: PaymentProof | null;
}

export interface AppointmentFlags {
  canCancel: boolean;
  canReschedule: boolean;
  canJoinVideo: boolean;
  canReview: boolean;
  canPay: boolean;
  canAttachRecords: boolean;
}

export interface AppointmentDetail extends AppointmentSummary {
  patient: AppointmentPatient;
  reasonTags: ReasonTag[];
  reason: string | null;
  records: HealthRecord[];
  payment: AppointmentPayment;
  timeline: AppointmentEvent[];
  flags: AppointmentFlags;
  /** Cancelling now is inside the doctor's cutoff. */
  isLateCancel: boolean;
  lateCancelNote: string | null;
  cancelReason: string | null;
  rescheduleCount: number;
  prescriptionId: string | null;
  reviewed: boolean;
}

export interface BookingInput {
  doctorId: string;
  locationId: string;
  startAt: string;
  familyMemberId: string | null;
  reasonTags: ReasonTag[];
  reason: string | null;
  recordIds: string[];
  paymentMethod: AppointmentPaymentMethod;
}

// ─── Family, records, prescriptions ───────────────────
export type FamilyRelation = 'spouse' | 'child' | 'parent' | 'sibling' | 'other';

export interface FamilyMember {
  id: string;
  name: string;
  relation: FamilyRelation;
  gender: Gender;
  dateOfBirth: string;
  phone: string | null;
}

export type FamilyMemberInput = Omit<FamilyMember, 'id'>;

export type RecordType = 'lab_report' | 'prescription' | 'imaging' | 'discharge' | 'other';

export interface RecordFile {
  url: string;
  mime: string;
}

export interface HealthRecord {
  id: string;
  title: string;
  type: RecordType;
  recordedOn: string;
  memberId: string | null;
  memberName: string;
  files: RecordFile[];
  createdAt: string;
}

export interface RecordInput {
  title: string;
  type: RecordType;
  recordedOn: string;
  memberId: string | null;
  files: RecordFile[];
}

export type MedicineForm = 'tablet' | 'capsule' | 'syrup' | 'injection' | 'drops' | 'cream' | 'inhaler' | 'other';
export type MedicineTiming = 'before_meal' | 'after_meal' | 'with_meal' | 'bedtime' | 'as_needed';

export interface Medicine {
  name: string;
  strength: string;
  form: MedicineForm;
  /** Morning + afternoon + night, e.g. "1+0+1". */
  dose: string;
  timing: MedicineTiming | null;
  days: number;
  instructions: string | null;
}

export interface Prescription {
  id: string;
  appointmentCode: string;
  doctorId: string;
  locationId: string;
  kind: ConsultKind;
  doctor: {
    name: string;
    specialtyName: string;
    qualifications: string;
    pmdcNumber: string;
    place: string;
    phone: string | null;
  };
  patient: { name: string; age: number | null; gender: Gender | null };
  issuedAt: string;
  diagnosis: string;
  medicines: Medicine[];
  tests: string[];
  advice: string | null;
  followUpInDays: number | null;
  /** The doctor can change it until then. */
  editableUntil: string;
}

export interface PrescriptionSummary {
  id: string;
  appointmentCode: string;
  doctorName: string;
  specialtyName: string;
  diagnosis: string;
  issuedAt: string;
  patientName: string;
}

export interface PrescriptionInput {
  diagnosis: string;
  medicines: Medicine[];
  tests: string[];
  advice: string | null;
  followUpInDays: number | null;
}

// ─── Reviews, video, symptoms ─────────────────────────
export interface DoctorReviewInput {
  rating: number;
  recommend: boolean;
  dimensions: Partial<Record<ReviewDimension, number>>;
  tags: string[];
  text: string | null;
  anonymous: boolean;
}

export interface VideoJoin {
  provider: 'jitsi' | 'jaas';
  roomUrl: string;
  jwt: string | null;
  displayName: string;
  closesAt: string;
}

export interface SymptomResult {
  emergency: boolean;
  emergencyNumbers: EmergencyNumber[];
  areas: { title: string; body: string }[];
  specialty: SpecialtyRef | null;
  disclaimer: string;
}

// ─── Doctor partner ───────────────────────────────────
export interface DoctorOwnProfile {
  title: string;
  name: string;
  gender: Gender | null;
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
}

export type CompletenessKey = 'photo' | 'about' | 'qualifications' | 'services' | 'location' | 'hours' | 'preview';

export interface Completeness {
  items: { key: CompletenessKey; label: string; done: boolean }[];
  percent: number;
  isListed: boolean;
  canPublish: boolean;
}

export interface TimeRange {
  /** "HH:mm", 24-hour, in the location's timezone. */
  from: string;
  to: string;
}

export interface WeekDayHours {
  /** 1 = Monday … 7 = Sunday. */
  day: number;
  ranges: TimeRange[];
}

export interface DoctorLocation extends PracticeLocation {
  hours: WeekDayHours[];
}

export type DoctorLocationInput = Pick<
  DoctorLocation,
  'kind' | 'name' | 'area' | 'city' | 'address' | 'lat' | 'lng' | 'phone' | 'fee' | 'slotMinutes' | 'instructions' | 'requiresPrepay'
>;

export interface HoursOverlap {
  day: number;
  otherLocationName: string;
}

export interface AvailabilityPreview {
  locations: { id: string; name: string; kind: ConsultKind; timezone: string; days: { date: string; slots: string[] }[] }[];
}

export interface TimeOff {
  id: string;
  from: string;
  to: string;
  locationId: string | null;
  locationName: string | null;
  reason: string | null;
}

export interface TimeOffInput {
  from: string;
  to: string;
  locationId: string | null;
  reason: string | null;
}

export interface ConflictingAppointment {
  id: string;
  code: string;
  startAt: string;
  timezone: string;
  patientName: string;
}

export interface QueuePatient {
  name: string;
  age: number | null;
  gender: Gender | null;
}

export interface QueueItem {
  id: string;
  code: string;
  startAt: string;
  timezone: string;
  kind: ConsultKind;
  status: AppointmentStatus;
  patient: QueuePatient;
  firstVisit: boolean;
  reason: string | null;
  checkedInAt: string | null;
  paymentMethod: AppointmentPaymentMethod;
  paymentStatus: AppointmentPaymentStatus;
  locationId: string;
  locationName: string;
  canJoinVideo: boolean;
  joinOpensAt: string | null;
  actions: DoctorActions;
}

export interface DoctorActions {
  canCheckIn: boolean;
  canStart: boolean;
  canComplete: boolean;
  canNoShow: boolean;
  canCancel: boolean;
  canConfirmPayment: boolean;
  canWritePrescription: boolean;
  canJoinVideo: boolean;
}

export interface TodaySummary {
  date: string;
  timezone: string;
  locations: { id: string; name: string; kind: ConsultKind }[];
  counts: { booked: number; checkedIn: number; done: number; noShow: number };
  queue: QueueItem[];
}

export interface CalendarItem {
  id: string;
  startAt: string;
  endAt: string;
  timezone: string;
  kind: ConsultKind;
  locationId: string;
  locationName: string;
  patientName: string;
  status: AppointmentStatus;
}

export interface CalendarRange {
  appointments: CalendarItem[];
  timeOff: TimeOff[];
  locations: { id: string; name: string; kind: ConsultKind }[];
}

export interface PreviousVisit {
  /** The doctor's own appointment id (opens DoctorAppointment). */
  appointmentId: string;
  code: string;
  startAt: string;
  kind: ConsultKind;
  diagnosis: string | null;
  prescriptionId: string | null;
  notes: string | null;
}

export interface DoctorAppointmentDetail {
  id: string;
  code: string;
  status: AppointmentStatus;
  kind: ConsultKind;
  startAt: string;
  endAt: string;
  timezone: string;
  location: AppointmentLocationRef;
  patient: QueuePatient & {
    id: string;
    phone: string | null;
    visitsWithYou: number;
    noShows: number;
    lateCancels: number;
  };
  reasonTags: ReasonTag[];
  reason: string | null;
  records: HealthRecord[];
  previousVisits: PreviousVisit[];
  notes: { text: string; attachments: string[]; updatedAt: string | null };
  payment: AppointmentPayment;
  checkedInAt: string | null;
  actions: DoctorActions;
  prescription: Prescription | null;
  timeline: AppointmentEvent[];
}

export interface MedicineSuggestion {
  name: string;
  strength: string;
  form: MedicineForm;
  isFavourite: boolean;
}

export interface PatientRow {
  id: string;
  name: string;
  age: number | null;
  gender: Gender | null;
  lastVisitAt: string;
  visits: number;
}

export interface PatientHistory {
  patient: QueuePatient & { id: string };
  visits: PreviousVisit[];
}

export type DoctorInsightsRange = '7d' | '30d' | '90d';

export interface DoctorInsights {
  range: DoctorInsightsRange;
  perDay: { date: string; video: number; clinic: number }[];
  outcomes: { completed: number; cancelled: number; noShow: number };
  avgWaitMinutes: number | null;
  ratingTrend: { date: string; rating: number }[];
  recordedFees: number;
  appointments: number;
}

// ─── Admin ────────────────────────────────────────────
export interface HealthOverview {
  listedDoctors: number;
  bySpecialty: { name: string; count: number }[];
  bookingsToday: number;
  cancelledToday: number;
  noShowsToday: number;
  pendingVerification: number;
}

export interface AdminSpecialty extends Specialty {
  sort: number;
}

export type AdminSpecialtyInput = Pick<AdminSpecialty, 'name' | 'nameUr' | 'icon' | 'sort'>;

export interface AdminCondition extends Condition {
  aliases: string[];
}

export type AdminConditionInput = Pick<AdminCondition, 'name' | 'nameUr' | 'specialtySlug' | 'isCommon' | 'aliases'>;

export interface AdminDoctor {
  businessId: string;
  name: string;
  specialty: string;
  city: string;
  pmdcNumber: string;
  pmdcVerified: boolean;
  pmdcNote: string | null;
  pmdcVerifiedAt: string | null;
  status: 'draft' | 'pending_approval' | 'approved' | 'rejected' | 'suspended';
  submittedAt: string | null;
  documents: { id: string; kind: string; url: string; mimeType: string }[];
}

export interface AdminAppointment extends AppointmentDetail {
  doctorBusinessId: string;
}
