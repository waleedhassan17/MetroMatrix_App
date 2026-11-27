// ═══════════════════════════════════════════════════════
// MetroMatrix — Healthcare types (the app's vocabulary)
// ═══════════════════════════════════════════════════════
// The serializers map MetroMatrix-API docs/API_HEALTH.md (copy in docs/)
// into these; screens and slices only ever see these.
// Money is INTEGER rupees (format with utils/money/money.formatPKR). Times are ISO
// UTC; show them only through utils/health-time/healthTime in the location's timezone.

import type { Gender } from './auth';
import type { PaymentInstructions, PaymentProof } from './payments';

export type ConsultKind = 'video' | 'clinic';
export type DoctorBadge = 'pmdc_verified' | 'top_booked';

// ─── Discovery ────────────────────────────────────────
export interface SpecialtyRef {
  slug: string;
  name: string;
  /** The API may send an Urdu name; the app is in English and doesn't show it. */
  nameUr?: string;
}

export interface Specialty extends SpecialtyRef {
  id: string;
  /** Ionicons glyph (the API's icon key, mapped in healthCommon.iconGlyph). */
  icon: string;
  doctorCount: number;
}

export interface Condition {
  id: string;
  slug: string;
  name: string;
  /** Sent by the API, not shown (the app is in English). */
  nameUr?: string | null;
  specialtySlug: string | null;
  isCommon: boolean;
  /** Ionicons glyph from the API's icon key (the common ones have one); else its specialty's. */
  icon: string | null;
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
  /** A break after each patient (0 = back to back). */
  bufferMinutes: number;
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

/**
 * Why a day has the slots it has (the API's `status`; null from an older
 * server): open, full (all booked or past), closed (no hours, or today's are
 * over), time off, paused (not taking bookings), beyond the booking window.
 */
export type DayStatus = 'open' | 'full' | 'closed' | 'time_off' | 'paused' | 'beyond_window';

export interface DayAvailability {
  /** YYYY-MM-DD in the location's timezone. */
  date: string;
  slotCount: number;
  /** Health's days say why (Food's date strips leave it out). */
  status?: DayStatus | null;
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

/** The Health screens a banner can open. */
export type HealthBannerScreen = 'video_consultation' | 'symptom_checker' | 'emergency' | 'records' | 'available_today';

export type HealthBannerTarget =
  | { kind: 'specialty'; slug: string; name: string }
  | { kind: 'condition'; slug: string; name: string }
  | { kind: 'doctor'; id: string; name: string }
  | { kind: 'screen'; screen: HealthBannerScreen }
  | { kind: 'none' };

/** A Health home promotion, chosen by staff (photo, words, where it leads). */
export interface HealthBanner {
  id: string;
  imageUrl: string;
  headline: string;
  subhead: string | null;
  target: HealthBannerTarget;
}

export interface HealthHome {
  city: string;
  cities: string[];
  specialties: Specialty[];
  commonConditions: Condition[];
  availableToday: DoctorCardData[];
  /** Top doctors in the city (the spotlight rail). */
  featuredDoctors: DoctorCardData[];
  /** `nationwide` when nobody practises in the city yet (the rail's title says so). */
  featuredScope: 'city' | 'nationwide';
  banners: HealthBanner[];
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
  | 'collected'
  /** Nothing is owed any more (a cancelled or missed visit that wasn't paid). */
  | 'void'
  /** Paid, then cancelled: the doctor owes it back. */
  | 'refund_due'
  | 'refunded';

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
  | 'prescription_issued'
  | 'refund_due'
  | 'refunded'
  | 'note';

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
  /** Who cancelled (a move is a cancel with the reason `rescheduled`). */
  cancelledBy: 'patient' | 'doctor' | 'system' | null;
  /** This visit replaced an earlier one (a move), or follows up an earlier one (booked by the doctor). */
  rescheduledFromId: string | null;
  followUpOfId: string | null;
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

export type MedicineForm = 'tablet' | 'capsule' | 'syrup' | 'injection' | 'drops' | 'cream' | 'other';
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

export type SymptomUrgency = 'routine' | 'soon' | 'urgent';

export interface SymptomResult {
  emergency: boolean;
  emergencyNumbers: EmergencyNumber[];
  areas: { title: string; body: string }[];
  specialty: SpecialtyRef | null;
  /** How soon to be seen, and the checker's own advice (not a diagnosis). */
  urgency: SymptomUrgency | null;
  advice: string | null;
  /** Other specialties that could also help. */
  alternatives: SpecialtyRef[];
  disclaimer: string;
}

// ─── Doctor partner ───────────────────────────────────
export interface DoctorOwnProfile {
  /** The doctor's id: their public page is /health/doctor/:id. */
  id: string;
  title: string;
  name: string;
  gender: Gender | null;
  photoUrl: string | null;
  specialtySlug: string | null;
  /** The specialty's name, as patients see it (read-only). */
  specialtyName: string;
  /** Up to five more specialties (the API's limit), by slug. */
  secondarySpecialtySlugs: string[];
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
  /** Taking new bookings (the doctor's pause switch). */
  isAccepting: boolean;
  /** Staff took the profile off the directory, and why; only support can put it back. */
  hiddenByStaff: string | null;
}

export type CompletenessKey = 'pmdc' | 'photo' | 'about' | 'qualifications' | 'location' | 'hours' | 'preview';

export interface Completeness {
  /** `detail`: what exactly is missing in that step ("Add: gender, languages"). */
  items: { key: CompletenessKey; label: string; done: boolean; detail: string | null }[];
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
  'kind' | 'name' | 'area' | 'city' | 'address' | 'lat' | 'lng' | 'phone' | 'fee' | 'slotMinutes' | 'bufferMinutes' | 'instructions' | 'requiresPrepay'
>;

/**
 * What the doctor's server offers beyond the first release (the profile's
 * `features`): a control shows only when its server can do it, so the app
 * works before and after a backend redeploy.
 */
export type DoctorFeature =
  | 'cross_kind_hours'
  | 'buffer'
  | 'schedule_dry_run'
  | 'day_status'
  | 'pause'
  | 'mark_paid_later'
  | 'listing_notice'
  | 'overrides'
  | 'walk_in'
  | 'doctor_reschedule'
  | 'follow_up_booking'
  | 'doctor_slots'
  | 'follow_up_reminder';

/** Hours another location of the other kind also offers: booking either closes the other. */
export interface SharedHours {
  locationName: string;
  kind: ConsultKind;
  /** 1 = Monday … 7 = Sunday (the app's weekdays). */
  day: number;
  /** Only for a day's own hours. */
  date: string | null;
  from: string;
  to: string;
}

/** What saving (or checking) hours answered. */
export interface HoursReport {
  sharedWith: SharedHours[];
  /** Booked visits the new hours leave out: they stay booked. */
  outsideHours: ConflictingAppointment[];
  /** Slots the hours make (a week's, or the day's). */
  slots: number | null;
}

/** A date's own hours at a location (extra, shorter, or closed), replacing its weekly hours. */
export interface DayHours {
  date: string;
  closed: boolean;
  ranges: TimeRange[];
  note: string | null;
}

export interface WalkInInput {
  locationId: string;
  /** A free slot today; null = the one running now (or the next free today). */
  startAt: string | null;
  name: string;
  phone: string;
  gender: Gender | null;
  age: number | null;
  reason: string;
}

export interface HoursOverlap {
  day: number;
  otherLocationName: string;
}

export interface AvailabilityPreview {
  /** Not taking new bookings: patients see none of these times. */
  paused: boolean;
  locations: { id: string; name: string; kind: ConsultKind; timezone: string; days: { date: string; slots: string[] }[] }[];
}

export interface TimeOff {
  id: string;
  from: string;
  to: string;
  /** Some hours of one day (wall times), not whole days. */
  hours: TimeRange | null;
  locationId: string | null;
  locationName: string | null;
  reason: string | null;
}

export interface TimeOffInput {
  from: string;
  to: string;
  /** Some hours of the first day only (`to` is ignored); null = whole days. */
  hours: TimeRange | null;
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
  source: AppointmentSource;
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
  /** A paid fee is owed back (the visit was cancelled): record the refund. */
  canRefund: boolean;
  /** A transfer proof was sent: it can be turned down. */
  canRejectPayment: boolean;
  /** A clinic fee not yet taken: mark it paid (at the desk or after the visit). */
  canMarkPaid: boolean;
}

/** `app`: booked in the app. `walk_in`: the doctor added them at the clinic desk (no account). */
export type AppointmentSource = 'app' | 'walk_in';

/** Who cancelled a visit, why, and whether it was inside the cutoff. */
export interface AppointmentCancellation {
  by: 'patient' | 'doctor' | 'system' | null;
  reason: string | null;
  late: boolean;
}

/** The day in numbers: every visit today that isn't cancelled, and where each one stands. */
export interface TodayCounts {
  total: number;
  /** Booked, still to come. */
  upcoming: number;
  /** Checked in, not yet with the doctor. */
  waiting: number;
  /** With the doctor now. */
  withDoctor: number;
  seen: number;
  missed: number;
}

/** What still needs the doctor, any date (`attention`; feature `attention`). */
export type DoctorNeed = 'transfer' | 'fee' | 'prescription' | 'refund';
export interface DoctorAttention {
  transfersToConfirm: number;
  feesToMark: number;
  prescriptionsToWrite: number;
  refundsDue: number;
  reviewsToReply: number;
}

export interface TodaySummary {
  date: string;
  timezone: string;
  /** The locations in use (a deleted one still names its old visits, but is never offered). */
  locations: { id: string; name: string; kind: ConsultKind }[];
  counts: TodayCounts;
  /** null from a server without the feature. */
  attention: DoctorAttention | null;
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
  /** The locations in use, with their slot length (a day's own hours are checked against it). */
  locations: { id: string; name: string; kind: ConsultKind; slotMinutes: number }[];
}

export interface PreviousVisit {
  /** The doctor's own appointment id (opens DoctorAppointment). */
  appointmentId: string;
  code: string;
  startAt: string;
  kind: ConsultKind;
  /** Booked, completed, cancelled or missed: only completed visits count as seen. */
  status: AppointmentStatus;
  /** Why they booked (the patient's own words), when they said. */
  reason: string | null;
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
  /** Video: when the room opens (10 minutes before). */
  joinOpensAt: string | null;
  actions: DoctorActions;
  prescription: Prescription | null;
  timeline: AppointmentEvent[];
  /** Cancelled visits: who, why, and whether late. */
  cancellation: AppointmentCancellation | null;
  source: AppointmentSource;
  /** Moved from another visit (by the patient or the doctor). */
  rescheduledFromId: string | null;
  /** The visit this one follows up. */
  followUpOfId: string | null;
}

export interface MedicineSuggestion {
  name: string;
  strength: string;
  form: MedicineForm;
  isFavourite: boolean;
  /** A favourite's usual dose and timing (what you wrote last time), when the API knows it. */
  dose: string | null;
  timing: MedicineTiming | null;
}

export interface PatientRow {
  id: string;
  name: string;
  age: number | null;
  gender: Gender | null;
  /** Their latest booking with you (it may still be ahead, or cancelled). */
  lastVisitAt: string;
  /** Completed visits only: cancelled and missed ones aren't visits. */
  visits: number;
  /** Every booking, whatever became of it. */
  bookings: number;
}

export interface PatientHistory {
  patient: QueuePatient & { id: string };
  visits: PreviousVisit[];
}

export type DoctorInsightsRange = '7d' | '30d' | '90d';

export interface DoctorInsights {
  range: DoctorInsightsRange;
  /** Booked visits per day, cancelled ones left out. */
  perDay: { date: string; video: number; clinic: number }[];
  outcomes: { completed: number; cancelled: number; noShow: number; upcoming: number; lateCancelled: number; cancelledByDoctor: number };
  /** Shares of the visits that ended (0–1); null before any did. */
  rates: { completion: number | null; cancellation: number | null; noShow: number | null };
  avgWaitMinutes: number | null;
  waitSamples: number;
  avgConsultMinutes: number | null;
  consultSamples: number;
  /** People seen in the range: first time with you, or back again. */
  patients: { new: number; returning: number };
  ratingTrend: { date: string; rating: number }[];
  /** Fees you recorded as paid (MetroMatrix never holds them), and how. */
  recordedFees: number;
  fees: { atClinic: number; byTransfer: number; refundDue: number; refunded: number };
  /** Every booking in the range, cancelled ones included. */
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

export type AdminSpecialtyInput = Pick<AdminSpecialty, 'name' | 'icon' | 'sort'>;

export interface AdminCondition extends Condition {
  aliases: string[];
}

export type AdminConditionInput = Pick<AdminCondition, 'name' | 'specialtySlug' | 'isCommon' | 'aliases'>;

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
