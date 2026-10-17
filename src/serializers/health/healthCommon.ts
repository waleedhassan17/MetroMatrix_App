// ═══════════════════════════════════════════════════════
// MetroMatrix — Shared readers for the Health serializers
// ═══════════════════════════════════════════════════════
// Every map between MetroMatrix-API docs/API_HEALTH.md and the app's own
// vocabulary (types/health.ts) lives here: instants, icon keys, statuses,
// payment states, timeline events, titles and record types.

import type { Gender } from '../../types/auth';
import type {
  AppointmentEventType,
  AppointmentPaymentMethod,
  AppointmentPaymentStatus,
  AppointmentStatus,
  Availability,
  ConsultKind,
  EmergencyNumber,
  RecordType,
  SpecialtyRef,
} from '../../types/health';
import { arr, isObject, num, oneOf, str, strOrNull } from '../serializerUtils';

export const KINDS: readonly ConsultKind[] = ['video', 'clinic'];
export const GENDERS: readonly Gender[] = ['male', 'female', 'other'];
export const DAY = /^\d{4}-\d{2}-\d{2}$/;

export const dayOrNull = (v: unknown): string | null => {
  const s = str(v).slice(0, 10);
  return DAY.test(s) ? s : null;
};

export const numOrNull = (v: unknown): number | null =>
  v === null || v === undefined || v === '' ? null : Number.isFinite(num(v, NaN)) ? num(v) : null;

/** 0–5 with one decimal, or null. */
export const rating = (v: unknown): number | null => {
  const n = numOrNull(v);
  return n === null ? null : Math.min(5, Math.max(0, Math.round(n * 10) / 10));
};

export const strings = (v: unknown): string[] => arr(v).map(x => str(x).trim()).filter(Boolean);

export const gender = (v: unknown): Gender | null => oneOf(v, GENDERS, null);

/**
 * An instant from the API (`2026-10-16T18:30:00.000+05:00`, or UTC) as UTC
 * ISO, the only form the app stores; healthTime shows it in the practice's
 * zone again. Null for anything that isn't a time.
 */
export const instant = (v: unknown): string | null => {
  const s = strOrNull(v);
  if (!s) return null;
  const t = Date.parse(s);
  return Number.isNaN(t) ? null : new Date(t).toISOString();
};

/** As instant(), with the epoch for a missing value (a row that must have one). */
export const instantOr = (v: unknown, fallback: string): string => instant(v) ?? fallback;

/** The practice timezone; Pakistan time when the API leaves it out. */
export const timezone = (v: unknown) => str(v) || 'Asia/Karachi';

// ─── Icons ────────────────────────────────────────────
/** The API's icon keys (specialties and conditions) → Ionicons glyphs. */
const ICON_GLYPHS: Record<string, string> = {
  stethoscope: 'medkit-outline',
  female: 'woman-outline',
  skin: 'body-outline',
  child: 'balloon-outline',
  brain: 'bulb-outline',
  chat: 'chatbubbles-outline',
  kidney: 'water-outline',
  stomach: 'nutrition-outline',
  heart: 'heart-outline',
  'heart-pulse': 'pulse-outline',
  ear: 'ear-outline',
  eye: 'eye-outline',
  bone: 'accessibility-outline',
  joint: 'body-outline',
  neuro: 'pulse-outline',
  tooth: 'happy-outline',
  apple: 'nutrition-outline',
  hormone: 'flask-outline',
  lungs: 'cloud-outline',
  ribbon: 'ribbon-outline',
  physio: 'walk-outline',
  scalpel: 'cut-outline',
  blood: 'water-outline',
  virus: 'bug-outline',
  sparkles: 'sparkles-outline',
  seedling: 'leaf-outline',
  allergy: 'flower-outline',
  drop: 'water-outline',
  liver: 'beaker-outline',
  vein: 'pulse-outline',
  speech: 'chatbox-ellipses-outline',
  clipboard: 'clipboard-outline',
  thermometer: 'thermometer-outline',
  flash: 'flash-outline',
  cloud: 'cloudy-outline',
  flame: 'flame-outline',
  snowflake: 'snow-outline',
  walk: 'walk-outline',
  calendar: 'calendar-outline',
  shield: 'shield-checkmark-outline',
  mic: 'mic-outline',
  restaurant: 'restaurant-outline',
  scale: 'scale-outline',
};

/** An icon key → its glyph; a glyph name passes through; anything else is a medical kit. */
export const iconGlyph = (v: unknown, fallback = 'medkit-outline'): string => {
  const key = str(v).trim();
  if (!key) return fallback;
  return ICON_GLYPHS[key] ?? (key.endsWith('-outline') ? key : fallback);
};

export const iconGlyphOrNull = (v: unknown): string | null => (str(v).trim() ? iconGlyph(v) : null);

/** The other way, for staff saving a specialty: a glyph → its key (a glyph with no key is stored as itself). */
export const iconKeyForGlyph = (glyph: string): string => Object.entries(ICON_GLYPHS).find(([, g]) => g === glyph)?.[0] ?? glyph;

// ─── Small shared shapes ──────────────────────────────
export const specialtyRefSerializer = (raw: unknown): SpecialtyRef => {
  if (typeof raw === 'string') return { slug: '', name: raw || 'General physician' };
  const r = isObject(raw) ? raw : {};
  return { slug: str(r.slug), name: str(r.name, 'General physician'), nameUr: str(r.nameUr) };
};

/** `nextAvailable: { at, label }` → the chip: its words, whether it's today, when. */
export const availabilitySerializer = (raw: unknown): Availability => {
  const r = isObject(raw) ? raw : {};
  const label = strOrNull(r.label);
  return { label, today: !!label && /^Available today/i.test(label), nextAt: instant(r.at) };
};

export const emergencyNumbersSerializer = (raw: unknown): EmergencyNumber[] =>
  arr(raw)
    .map(n => (isObject(n) && str(n.number) ? { label: str(n.label, 'Emergency'), number: str(n.number) } : null))
    .filter((n): n is EmergencyNumber => n !== null);

/** "dr" → "Dr." (what a name is prefixed with). */
export const TITLE_PREFIX: Record<string, string> = {
  dr: 'Dr.',
  prof: 'Prof. Dr.',
  assoc_prof: 'Assoc. Prof. Dr.',
  asst_prof: 'Asst. Prof. Dr.',
};

/** The other way round, for the doctor's own profile form ("Prof. Dr." → "prof"). */
export const titleKey = (label: string): string =>
  Object.entries(TITLE_PREFIX).find(([, l]) => l === label.trim())?.[0] ?? (label in TITLE_PREFIX ? label : 'dr');

/** "Dr. Sana Iqbal": the API's displayName, or built from title + fullName. */
export const doctorName = (r: Record<string, unknown>, fallback = 'Doctor'): string =>
  str(r.displayName) || (str(r.fullName) ? `${TITLE_PREFIX[str(r.title)] ?? 'Dr.'} ${str(r.fullName)}` : str(r.name, fallback));

// ─── Appointment and payment states ───────────────────
/** API statuses → the app's. `booked` with a transfer still owed before the visit reads "payment needed". */
export const appointmentStatus = (raw: unknown, payment: Record<string, unknown> = {}): AppointmentStatus => {
  switch (str(raw)) {
    case 'booked':
      return payment.payBy && ['awaiting_transfer', 'proof_submitted'].includes(str(payment.status)) ? 'awaiting_payment' : 'confirmed';
    case 'checked_in':
      return 'checked_in';
    case 'in_consultation':
      return 'in_progress';
    case 'completed':
      return 'completed';
    case 'cancelled':
      return 'cancelled';
    case 'no_show':
      return 'no_show';
    default:
      return 'confirmed';
  }
};

export const paymentMethod = (raw: unknown): AppointmentPaymentMethod => (str(raw) === 'transfer' ? 'transfer' : 'pay_at_visit');

/**
 * API payment status (+ method and the rejection reason) → the app's: a
 * clinic fee is "pay at visit" until collected; a transfer the doctor
 * couldn't find is "proof rejected" while the patient may send it again.
 */
export const paymentStatus = (raw: Record<string, unknown>): AppointmentPaymentStatus => {
  const clinic = paymentMethod(raw.method) === 'pay_at_visit';
  switch (str(raw.status)) {
    case 'unpaid':
      return 'pay_at_visit';
    case 'awaiting_transfer':
      return strOrNull(raw.rejectedReason) ? 'proof_rejected' : 'awaiting_transfer';
    case 'proof_submitted':
      return 'proof_submitted';
    case 'paid':
      return clinic ? 'collected' : 'paid';
    case 'void':
      return 'void';
    case 'refund_due':
      return 'refund_due';
    case 'refunded':
      return 'refunded';
    default:
      return clinic ? 'pay_at_visit' : 'awaiting_transfer';
  }
};

const STATUS_EVENT: Record<string, AppointmentEventType> = {
  booked: 'booked',
  checked_in: 'checked_in',
  in_consultation: 'in_progress',
  completed: 'completed',
  cancelled: 'cancelled',
  no_show: 'no_show',
};

/** A timeline row `{ kind, from, to, note, at }` → the app's event (a reschedule is a `booked` row noted "Rescheduled"). */
export const eventType = (raw: Record<string, unknown>): AppointmentEventType | null => {
  const kind = str(raw.kind);
  const to = str(raw.to);
  if (kind === 'note') return 'note';
  if (kind === 'status') {
    if (to === 'booked' && /reschedul/i.test(str(raw.note))) return 'rescheduled';
    return STATUS_EVENT[to] ?? null;
  }
  if (kind === 'payment') {
    if (to === 'proof_submitted') return 'payment_proof_submitted';
    if (to === 'paid') return 'payment_confirmed';
    if (to === 'awaiting_transfer' && str(raw.from) === 'proof_submitted') return 'payment_rejected';
    if (to === 'refund_due') return 'refund_due';
    if (to === 'refunded') return 'refunded';
  }
  return null;
};

// ─── Records ──────────────────────────────────────────
const RECORD_TYPE_IN: Record<string, RecordType> = {
  lab_report: 'lab_report',
  prescription: 'prescription',
  scan: 'imaging',
  discharge_summary: 'discharge',
  other: 'other',
};
const RECORD_TYPE_OUT: Record<RecordType, string> = {
  lab_report: 'lab_report',
  prescription: 'prescription',
  imaging: 'scan',
  discharge: 'discharge_summary',
  other: 'other',
};
export const recordTypeIn = (v: unknown): RecordType => RECORD_TYPE_IN[str(v)] ?? 'other';
export const recordTypeOut = (t: RecordType): string => RECORD_TYPE_OUT[t] ?? 'other';

/**
 * A Cloudinary delivery URL → its public id (`…/upload/v123/<folder>/<name>.jpg`
 * → `<folder>/<name>`), which the API checks against the signed folder.
 */
export const publicIdFromCloudinaryUrl = (url: string): string => {
  const m = /\/(?:upload|authenticated|private)\/(?:s--[^/]+--\/)?(?:[^/]*,[^/]*\/)*(?:v\d+\/)?(.+?)(?:\.[a-z0-9]+)?$/i.exec(url.split('?')[0]);
  return m ? decodeURIComponent(m[1]) : url;
};

/** A file's type from its name, for the records and documents the API names without one. */
export const mimeFromUrl = (url: string): string => {
  const ext = /\.([a-z0-9]+)(?:\?|$)/i.exec(url)?.[1]?.toLowerCase();
  return ext === 'pdf' ? 'application/pdf' : ext === 'png' ? 'image/png' : ext === 'webp' ? 'image/webp' : 'image/jpeg';
};
