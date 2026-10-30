// The dummy Health API answers in the real API's shapes: for each response
// captured from MetroMatrix-API (src/serializers/__tests__/fixtures/health),
// the dummy API's answer to the same request has the same keys, at the top
// and in the nested objects the app reads. A key only one side has fails
// here unless it is listed in KNOWN with the reason.

import real from '../../../../serializers/__tests__/fixtures/health/real.json';
import { api } from '../../apiHelpers';
import { clearTokens } from '../../../../utils/storageUtils';
import { getDb, resetMockDb } from '../mockDb';
import { signInAs, installDummyApi } from '../testing';

installDummyApi();

type Body = { success: boolean; data?: unknown; error?: { code: string; details?: unknown } };
const R = real as unknown as Record<string, { status: number; body: Body }>;

// Thursday 15 October 2026, 3 PM in Pakistan.
const T0 = new Date('2026-10-15T10:00:00Z').getTime();

const signIn = async (email: string, portal: 'customer' | 'partner' = 'customer') => {
  await clearTokens();
  await signInAs(email);
};

const signInAdmin = async () => {
  await clearTokens();
  await signInAs('admin@metromatrix.app');
};

/** The answer's `data`, or `{ error }` for a failure, as the fixtures keep them. */
const call = async (method: 'get' | 'post' | 'put' | 'patch', url: string, body?: unknown, headers?: Record<string, string>): Promise<Body> => {
  try {
    const res = method === 'get' ? await api.get(url) : await api[method](url, body, { headers });
    return res.data as Body;
  } catch (e) {
    return ((e as { response?: { data?: Body } }).response?.data ?? { success: false }) as Body;
  }
};

/** `a.b.0.c` into a value; null when any step is missing. */
const at = (v: unknown, path: string): unknown =>
  path
    ? path.split('.').reduce<unknown>((x, k) => (x && typeof x === 'object' ? (x as Record<string, unknown>)[k] : undefined), v)
    : v;

const keysOf = (v: unknown) => (v && typeof v === 'object' && !Array.isArray(v) ? Object.keys(v).sort() : null);

/** Keys one side has that the other doesn't, per path (`fixture:path +key` = only the dummy API has it). */
const diff = (name: string, realBody: Body, mockBody: Body, paths: string[]) => {
  const out: string[] = [];
  const realRoot = realBody.data ?? { error: realBody.error };
  const mockRoot = mockBody.data ?? { error: mockBody.error };
  for (const p of paths) {
    const rk = keysOf(at(realRoot, p));
    if (!rk) continue; // nothing captured there (an empty list, a null)
    const mv = at(mockRoot, p);
    const mk = keysOf(mv);
    if (!mk) {
      // An empty list or a null is the seed's data, not a shape: only a key that isn't there at all is.
      const parent = at(mockRoot, p.split('.').slice(0, -1).join('.'));
      if (mv === null || Array.isArray(parent)) continue;
      out.push(`${name}:${p || '.'} missing`);
      continue;
    }
    for (const k of rk) if (!mk.includes(k)) out.push(`${name}:${p || '.'} -${k}`);
    for (const k of mk) if (!rk.includes(k)) out.push(`${name}:${p || '.'} +${k}`);
  }
  return out;
};

/**
 * Differences the dummy API keeps on purpose. Each says why; anything new
 * fails the test.
 */
const KNOWN: Record<string, string> = {};

const CASES: { fixture: string; as: 'patient' | 'doctor' | 'admin'; run: () => Promise<Body>; paths: string[] }[] = [];
const add = (fixture: string, as: 'patient' | 'doctor' | 'admin', run: () => Promise<Body>, paths: string[]) => CASES.push({ fixture, as, run, paths });

// Discovery (signed in as the demo patient).
add('homeSignedIn', 'patient', () => call('get', '/health/home?city=Lahore'), [
  '',
  'specialties.0',
  'commonConditions.0',
  'commonConditions.0.specialties.0',
  'availableTodayNearby.0',
  'availableTodayNearby.0.specialty',
  'availableTodayNearby.0.nextAvailable',
  'featuredDoctors.0',
  'banners.0',
  'banners.0.target',
  'upcomingAppointment',
  'emergencyNumbers.0',
]);
add('specialties', 'patient', () => call('get', '/health/specialties'), ['0']);
add('conditions', 'patient', () => call('get', '/health/conditions'), ['0']);
add('suggest', 'patient', () => call('get', '/health/search/suggest?q=acne'), ['', 'doctors.0', 'specialties.0', 'conditions.0']);
add('doctors', 'patient', () => call('get', '/health/doctors?city=Lahore'), ['', 'items.0', 'items.0.badges']);
add('profile', 'patient', () => call('get', '/health/doctors/d_ayesha'), [
  '',
  'stats',
  'booking',
  'badges',
  'reviewSummary',
  'qualificationList.0',
  'experienceList.0',
  'locations.0',
  'locations.0.nextAvailable',
  'locations.0.timings.0',
  'locations.0.timings.0.ranges.0',
]);
add('similar', 'patient', () => call('get', '/health/doctors/d_ayesha/similar'), ['0']);
add('slots', 'patient', () => call('get', '/health/doctors/d_ayesha/locations/loc_ayesha_2/slots'), ['', 'location', 'days.0', 'days.0.slots.0']);
add('reviews', 'patient', () => call('get', '/health/doctors/d_ayesha/reviews'), ['', 'items.0', 'items.0.reply']);
add('family', 'patient', () => call('get', '/health/family-members'), ['0']);
add('appointments', 'patient', () => call('get', '/health/appointments'), ['', 'items.0', 'items.0.payment', 'items.0.can', 'items.0.doctor', 'items.0.location']);

const PATIENT_DETAIL = ['', 'patient', 'payment', 'can', 'doctor', 'location', 'events.0'];
add('appointment', 'patient', async () => {
  const db = await getDb();
  const a = db.health.appointments.find(x => x.userId === 'u_customer' && x.kind === 'clinic' && x.status === 'confirmed')!;
  return call('get', `/health/appointments/${a.code}`);
}, PATIENT_DETAIL);
add('bookVideo', 'patient', async () => {
  const db = await getDb();
  const a = db.health.appointments.find(x => x.userId === 'u_customer' && x.kind === 'video' && x.paymentMethod === 'transfer' && x.status === 'awaiting_payment')!;
  return call('get', `/health/appointments/${a.code}`);
}, [...PATIENT_DETAIL, 'payment.accounts.0']);
add('prescription', 'patient', () => call('get', '/health/prescriptions/rx_acne'), ['', 'doctor', 'location', 'patient', 'medicines.0', 'tests.0']);
add('symptomFallback', 'patient', () => call('post', '/health/symptom-checker', { text: 'Pimples on my face for two months' }), ['', 'specialty', 'areasToDiscuss.0']);
add('symptomEmergency', 'patient', () => call('post', '/health/symptom-checker', { text: 'Sudden chest pain and I am short of breath' }), ['', 'numbers.0']);
// /media/sign-upload is the real API's alone now (contract.test.ts checks the App's request).
add('notifications', 'patient', () => call('get', '/notifications'), ['', 'items.0']);
add('videoTooEarly', 'patient', async () => {
  const db = await getDb();
  const a = db.health.appointments.find(x => x.userId === 'u_customer' && x.kind === 'video' && x.doctorId === 'd_ayesha' && x.status !== 'cancelled')!;
  return call('post', `/health/appointments/${a.code}/video/join`, {});
}, ['', 'error', 'error.details']);

// The doctor app (Dr. Ayesha, the dermatologist).
add('doctorProfile', 'doctor', () => call('get', '/health/doctor/profile'), ['', 'primarySpecialty', 'qualifications.0', 'experiences.0']);
add('completeness', 'doctor', () => call('get', '/health/doctor/profile/completeness'), ['']);
add('locations', 'doctor', () => call('get', '/health/doctor/locations'), ['0']);
add('schedule', 'doctor', () => call('get', '/health/doctor/locations/loc_ayesha_2/schedule'), ['', 'ranges.0']);
add('preview', 'doctor', () => call('get', '/health/doctor/availability/preview'), ['', 'locations.0', 'locations.0.location', 'locations.0.days.0', 'locations.0.days.0.slots.0']);
add('paymentAccounts', 'doctor', () => call('get', '/health/doctor/payment-accounts'), ['0']);
add('today', 'doctor', () => call('get', '/health/doctor/today'), ['', 'counts', 'queue.0', 'queue.0.can', 'queue.0.flags', 'queue.0.location', 'queue.0.payment', 'queue.0.patient']);
add('doctorAppointment', 'doctor', async () => {
  const db = await getDb();
  const a = db.health.appointments.find(x => x.doctorId === 'd_ayesha' && x.status === 'confirmed')!;
  return call('get', `/health/doctor/appointments/${a.code}`);
}, ['', 'can', 'flags', 'location', 'payment', 'patient', 'events.0']);
add('notes', 'doctor', async () => {
  const db = await getDb();
  const a = db.health.appointments.find(x => x.doctorId === 'd_ayesha' && x.status === 'completed')!;
  return call('get', `/health/doctor/appointments/${a.code}/notes`);
}, ['']);
add('prescriptionCurrent', 'doctor', async () => {
  const db = await getDb();
  const a = db.health.appointments.find(x => x.prescriptionId === 'rx_acne')!;
  return call('get', `/health/doctor/appointments/${a.code}/prescription`);
}, ['', 'prescription', 'prescription.doctor', 'prescription.medicines.0']);
add('patients', 'doctor', () => call('get', '/health/doctor/patients'), ['', 'items.0']);
add('patientHistory', 'doctor', async () => {
  const rows = (await call('get', '/health/doctor/patients')).data as { items: { patientKey: string }[] };
  return call('get', `/health/doctor/patients/${encodeURIComponent(rows.items[0].patientKey)}`);
}, ['', 'previousAppointments.0', 'prescriptions.0']);
add('insights', 'doctor', () => call('get', '/health/doctor/insights?range=7d'), ['', 'perDay.0', 'totals', 'rates', 'times', 'patients', 'fees']);
add('doctorReviews', 'doctor', () => call('get', '/health/doctor/reviews'), ['', 'items.0']);
add('doctorReviewSummary', 'doctor', () => call('get', '/health/doctor/reviews/summary'), ['', 'averages', 'topTags.0', 'latest.0']);
add('medicines', 'doctor', () => call('get', '/health/doctor/medicines/suggest?q=para'), ['', 'medicines.0']);
add('doctorNotifications', 'doctor', () => call('get', '/notifications'), ['', 'items.0']);
add('scheduleOverlap', 'doctor', async () => {
  const db = await getDb();
  const video = db.health.locations.find(l => l.doctorId === 'd_ayesha' && l.kind === 'video')!;
  const clinic = db.health.locations.find(l => l.doctorId === 'd_ayesha' && l.kind === 'clinic')!;
  const r = video.hours.find(d => d.ranges.length)!;
  return call('put', `/health/doctor/locations/${clinic.id}/schedule`, [{ weekday: r.day === 7 ? 0 : r.day, start: r.ranges[0].from, end: r.ranges[0].to }]);
}, ['', 'error', 'error.details', 'error.details.range', 'error.details.conflict']);
add('timeOffConflict', 'doctor', async () => {
  const db = await getDb();
  const a = db.health.appointments.find(x => x.doctorId === 'd_ayesha' && x.status === 'awaiting_payment' && Date.parse(x.startAt) > T0)!;
  const start = new Date(Date.parse(a.startAt) - 3_600_000).toISOString();
  const end = new Date(Date.parse(a.startAt) + 3_600_000).toISOString();
  return call('post', '/health/doctor/time-off', { startsAt: start, endsAt: end, reason: 'Conference' });
}, ['', 'error', 'error.details', 'error.details.appointments.0']);

// The staff console.
add('adminOverview', 'admin', () => call('get', '/admin/health/overview'), ['', 'doctors', 'listedBySpecialty.0', 'today', 'reviews', 'symptomChecks']);
add('adminSpecialties', 'admin', () => call('get', '/admin/health/specialties'), ['0']);
add('adminConditions', 'admin', () => call('get', '/admin/health/conditions'), ['', 'items.0', 'items.0.specialties.0']);
add('adminDoctors', 'admin', () => call('get', '/admin/health/doctors'), ['', 'items.0', 'items.0.specialty', 'items.0.business']);
add('adminReviews', 'admin', () => call('get', '/admin/health/reviews'), ['', 'items.0']);
add('adminAppointment', 'admin', async () => {
  const db = await getDb();
  const a = db.health.appointments.find(x => x.prescriptionId === 'rx_acne')!;
  return call('get', `/admin/health/appointments/${a.code}`);
}, ['', 'doctor', 'location', 'payment', 'patient', 'events.0']);

beforeAll(() => {
  jest.useFakeTimers({ doNotFake: ['setTimeout', 'setInterval', 'setImmediate', 'nextTick', 'queueMicrotask'] });
});
afterAll(() => jest.useRealTimers());

it('answers every captured request with the real keys', async () => {
  jest.setSystemTime(T0);
  await resetMockDb();
  const found: string[] = [];
  let who: string | null = null;
  for (const c of CASES) {
    if (c.as !== who) {
      if (c.as === 'patient') await signIn('customer@metromatrix.app');
      else if (c.as === 'doctor') await signIn('derm@metromatrix.app', 'partner');
      else await signInAdmin();
      who = c.as;
    }
    found.push(...diff(c.fixture, R[c.fixture].body, await c.run(), c.paths));
  }
  const unexpected = found.filter(f => !KNOWN[f]);
  const stale = Object.keys(KNOWN).filter(k => !found.includes(k));
  expect({ unexpected, stale }).toEqual({ unexpected: [], stale: [] });
});
