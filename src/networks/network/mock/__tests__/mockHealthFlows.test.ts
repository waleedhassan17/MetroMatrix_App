// The dummy Health API, driven through the REAL health networks — the server
// rules QA relies on: search by condition and in Urdu, live slots per
// location, idempotent booking, SLOT_TAKEN alternatives, one reschedule,
// late cancellation, prepaid video, the doctor's queue, the 24-hour
// prescription lock, one review per visit, hours overlaps, time-off
// conflicts and the PMDC gate.

import { authAdminTotp, authSignin } from '../../../auth/authNetwork';
import { approveBusiness } from '../../../admin/adminBusinessNetwork';
import { verifyPmdc } from '../../../admin/adminHealthNetwork';
import { getDoctor, listDoctors, suggest } from '../../../health/discoveryNetwork';
import { listDays, listSlots } from '../../../health/availabilityNetwork';
import {
  bookAppointment,
  cancelAppointment,
  getAppointment,
  listAppointments,
  rescheduleAppointment,
  submitAppointmentPaymentProof,
} from '../../../health/appointmentsNetwork';
import { getPrescription } from '../../../health/prescriptionsNetwork';
import { reviewAppointment } from '../../../health/reviewsNetwork';
import { joinVideo } from '../../../health/videoNetwork';
import { checkSymptoms } from '../../../health/symptomNetwork';
import { getCompleteness, publishProfile } from '../../../health/doctor/profileNetwork';
import { addTimeOff, listLocations, saveHours } from '../../../health/doctor/practiceNetwork';
import {
  actOnAppointment,
  completeAppointment,
  confirmPayment,
  getDoctorAppointment,
  getToday,
} from '../../../health/doctor/doctorAppointmentsNetwork';
import { issuePrescription, updatePrescription } from '../../../health/doctor/prescriptionWriterNetwork';
import { listPatients } from '../../../health/doctor/patientsNetwork';
import { alternativesFrom } from '../../../../serializers/health/appointmentSerializer';
import { conflictsFrom, overlapsFrom } from '../../../../serializers/health/doctorSerializer';
import { baseQuery } from '../../../../models/health/filterModel';
import { AuthError } from '../../apiHelpers';
import { clearTokens } from '../../../../utils/storageUtils';
import { PKT, addDays, dateInZone, isoWeekday, todayInZone } from '../../../../utils/healthTime';
import type { BookingInput } from '../../../../types/health';
import { MOCK, SEED_PASSWORD, STAFF_PASSWORD } from '../mockConfig';
import { getDb, resetMockDb } from '../mockDb';

// Thursday 15 October 2026, 3 PM in Pakistan.
const T0 = new Date('2026-10-15T10:00:00Z').getTime();
const HOUR = 3_600_000;

const failure = async (p: Promise<unknown>): Promise<AuthError> => {
  try {
    await p;
  } catch (e) {
    return e as AuthError;
  }
  throw new Error('expected the call to fail');
};

const signIn = async (email: string, portal: 'customer' | 'partner' = 'customer') => {
  await clearTokens();
  await authSignin({ email, password: SEED_PASSWORD, portal });
};

const signInAdmin = async () => {
  await clearTokens();
  const outcome = await authSignin({ email: 'admin@metromatrix.app', password: STAFF_PASSWORD, portal: 'admin' });
  if (outcome.kind !== 'totp') throw new Error('expected a challenge');
  await authAdminTotp(outcome.challenge.challengeToken, { code: MOCK.TOTP_CODE });
};

/** The first free slot from tomorrow at a location (skipping Dr. Bilal's contested first slot). */
const firstSlot = async (doctorId: string, locationId: string, skip = 0) => {
  const days = await listDays(doctorId, locationId, addDays(todayInZone(PKT, T0), 1));
  const day = days.find(d => d.slotCount > skip)!;
  const slots = await listSlots(doctorId, locationId, day.date);
  return slots.slots[skip].startAt;
};

const booking = (over: Partial<BookingInput> & Pick<BookingInput, 'doctorId' | 'locationId' | 'startAt'>): BookingInput => ({
  familyMemberId: null,
  reasonTags: [],
  reason: null,
  recordIds: [],
  paymentMethod: 'pay_at_visit',
  ...over,
});

beforeAll(() => {
  jest.useFakeTimers({ doNotFake: ['setTimeout', 'setInterval', 'setImmediate', 'nextTick', 'queueMicrotask'] });
});
afterAll(() => jest.useRealTimers());

beforeEach(async () => {
  jest.setSystemTime(T0);
  await resetMockDb();
  await signIn('customer@metromatrix.app');
});

describe('discovery', () => {
  it('finds the condition behind an everyday word, and dermatologists for it', async () => {
    const s = await suggest('pimples');
    expect(s.conditions.map(c => c.name)).toContain('Acne');
    expect(s.specialties.map(x => x.slug)).toContain('dermatologist');
    expect(s.doctors.length).toBeGreaterThan(0);
  });

  it('matches a specialty typed in Urdu', async () => {
    const s = await suggest('جلد');
    expect(s.specialties.map(x => x.slug)).toContain('dermatologist');
  });

  it("shows each of a doctor's locations with its own fee and next time, video first", async () => {
    const d = await getDoctor('d_bilal');
    expect(d.locations).toHaveLength(4);
    expect(d.locations[0].kind).toBe('video');
    expect(new Set(d.locations.map(l => l.fee)).size).toBe(4);
    for (const l of d.locations) expect(l.availability.label).toMatch(/^Available |^No times/);
  });

  it('filters by video and available today, server-side', async () => {
    const page = await listDoctors({ ...baseQuery('Lahore'), kind: 'video', availableToday: true }, 1);
    expect(page.items.length).toBeGreaterThan(0);
    for (const d of page.items) {
      expect(d.offersVideo).toBe(true);
      expect(d.availability.today).toBe(true);
      expect(d.availability.label).toMatch(/^Available today, /);
    }
  });

  it('sorts by earliest available', async () => {
    const page = await listDoctors({ ...baseQuery('Lahore'), sort: 'earliest' }, 1, 50);
    const times = page.items.map(d => d.availability.nextAt ?? '9');
    expect([...times].sort()).toEqual(times);
  });

  it('dims a closed day and points to the next one', async () => {
    // Gulberg is open Mon / Wed / Fri only.
    const days = await listDays('d_bilal', 'loc_bilal_2', todayInZone(PKT, T0), 14);
    const closed = days.find(d => [2, 4, 6, 7].includes(isoWeekday(d.date)))!;
    expect(closed.slotCount).toBe(0);
    const empty = await listSlots('d_bilal', 'loc_bilal_2', closed.date);
    expect(empty.slots).toHaveLength(0);
    expect(empty.nextAvailable).not.toBeNull();
  });
});

describe('booking', () => {
  it('books once for a retried Confirm (Idempotency-Key)', async () => {
    const startAt = await firstSlot('d_imran', 'loc_imran_2');
    const input = booking({ doctorId: 'd_imran', locationId: 'loc_imran_2', startAt });
    const first = await bookAppointment(input, 'k-1');
    const again = await bookAppointment(input, 'k-1');
    expect(again.code).toBe(first.code);
    expect(first.status).toBe('confirmed');
    const db = await getDb();
    expect(db.health.appointments.filter(a => a.startAt === startAt && a.doctorId === 'd_imran')).toHaveLength(1);
  });

  it('offers alternatives when the time is taken', async () => {
    const startAt = await firstSlot('d_imran', 'loc_imran_2');
    const input = booking({ doctorId: 'd_imran', locationId: 'loc_imran_2', startAt });
    await bookAppointment(input, 'k-1');
    const e = await failure(bookAppointment(input, 'k-2'));
    expect(e.code).toBe('SLOT_TAKEN');
    const alternatives = alternativesFrom(e.details);
    expect(alternatives).toHaveLength(3);
    expect(alternatives.every(a => a > startAt)).toBe(true);
    const picked = await bookAppointment({ ...input, startAt: alternatives[0] }, 'k-3');
    expect(picked.startAt).toBe(alternatives[0]);
  });

  it("simulates another patient taking Dr. Bilal's first Gulberg time (mock mode)", async () => {
    const startAt = await firstSlot('d_bilal', 'loc_bilal_2');
    const e = await failure(bookAppointment(booking({ doctorId: 'd_bilal', locationId: 'loc_bilal_2', startAt }), 'k-1'));
    expect(e.code).toBe('SLOT_TAKEN');
    const day = await listSlots('d_bilal', 'loc_bilal_2', dateInZone(startAt, PKT));
    expect(day.slots.map(s => s.startAt)).not.toContain(startAt);
  });

  it('books for a family member and reschedules only once', async () => {
    const startAt = await firstSlot('d_usman', 'loc_usman_1');
    const a = await bookAppointment(booking({ doctorId: 'd_usman', locationId: 'loc_usman_1', startAt, familyMemberId: 'fm_zara' }), 'k-1');
    expect(a.patient.name).toBe('Zara Khan');
    expect(a.flags.canReschedule).toBe(true);
    const later = await firstSlot('d_usman', 'loc_usman_1', 2);
    const moved = await rescheduleAppointment(a.code, later);
    expect(moved.startAt).toBe(later);
    expect(moved.flags.canReschedule).toBe(false);
    expect((await failure(rescheduleAppointment(a.code, startAt))).code).toBe('INVALID_TRANSITION');
  });

  it('marks a cancellation inside the cutoff as late, before confirming', async () => {
    const db = await getDb();
    const soon = db.health.appointments.find(a => a.userId === 'u_customer' && a.status === 'confirmed' && a.doctorId === 'd_bilal' && a.kind === 'clinic')!;
    jest.setSystemTime(Date.parse(soon.startAt) - 2 * HOUR);
    const detail = await getAppointment(soon.code);
    expect(detail.isLateCancel).toBe(true);
    expect(detail.lateCancelNote).toMatch(/late cancellation/);
    const cancelled = await cancelAppointment(soon.code, 'schedule_clash', null);
    expect(cancelled.status).toBe('cancelled');
  });

  it('takes a prepaid video consult through transfer, proof and the doctor confirming', async () => {
    const startAt = await firstSlot('d_ayesha', 'loc_ayesha_1');
    const e = await failure(bookAppointment(booking({ doctorId: 'd_ayesha', locationId: 'loc_ayesha_1', startAt }), 'k-0'));
    expect(e.code).toBe('VALIDATION_FAILED');
    const a = await bookAppointment(booking({ doctorId: 'd_ayesha', locationId: 'loc_ayesha_1', startAt, paymentMethod: 'transfer' }), 'k-1');
    expect(a.status).toBe('awaiting_payment');
    expect(a.payment.instructions?.amount).toBe(2000);
    expect(a.flags.canPay).toBe(true);
    const paid = await submitAppointmentPaymentProof(a.code, { transactionId: 'jc 1234 5678', imageUrl: null });
    expect(paid.payment.status).toBe('proof_submitted');

    await signIn('derm@metromatrix.app', 'partner');
    const confirmed = await confirmPayment(a.id);
    expect(confirmed.status).toBe('confirmed');
    expect(confirmed.payment.status).toBe('paid');
  });
});

describe('the doctor app', () => {
  it('runs the queue: check in, start, complete with payment, then a prescription the patient sees', async () => {
    await signIn('derm@metromatrix.app', 'partner');
    const today = await getToday(null, null);
    expect(today.queue.length).toBeGreaterThan(0);
    const waiting = today.queue.find(q => q.status === 'checked_in')!;
    expect(waiting.checkedInAt).not.toBeNull();
    const started = await actOnAppointment(waiting.id, 'start');
    expect(started.status).toBe('in_progress');
    const done = await completeAppointment(waiting.id, true);
    expect(done.status).toBe('completed');
    expect(done.payment.status).toBe('collected');
    const rx = await issuePrescription(waiting.id, {
      diagnosis: 'Contact dermatitis',
      medicines: [{ name: 'Cetirizine', strength: '10 mg', form: 'tablet', dose: '0+0+1', timing: 'bedtime', days: 5, instructions: null }],
      tests: [],
      advice: null,
      followUpInDays: 14,
    });
    expect(rx.followUpInDays).toBe(14);
    expect((await getDoctorAppointment(waiting.id)).actions.canWritePrescription).toBe(false);

    jest.setSystemTime(T0 + 25 * HOUR);
    const locked = await failure(updatePrescription(rx.id, { diagnosis: 'Changed', medicines: [], tests: [], advice: 'Rest', followUpInDays: null }));
    expect(locked.code).toBe('PRESCRIPTION_LOCKED');
  });

  it("lets the patient read their prescription, rate the visit once, and lists only the doctor's own patients", async () => {
    const rx = await getPrescription('rx_acne');
    expect(rx.medicines).toHaveLength(3);
    const db = await getDb();
    const acne = db.health.appointments.find(a => a.prescriptionId === 'rx_acne')!;
    const rated = await reviewAppointment(acne.code, { rating: 5, recommend: true, dimensions: { diagnosis: 5, staff: 5, environment: 4 }, tags: ['Explained clearly'], text: null, anonymous: true });
    expect(rated.reviewed).toBe(true);
    const again = await failure(reviewAppointment(acne.code, { rating: 4, recommend: true, dimensions: {}, tags: [], text: null, anonymous: true }));
    expect(again.code).toBe('ALREADY_REVIEWED');

    await signIn('derm@metromatrix.app', 'partner');
    const patients = await listPatients('', 1);
    const theirs = new Set(db.health.appointments.filter(a => a.doctorId === 'd_ayesha').map(a => a.patientName));
    expect(patients.items.every(p => theirs.has(p.name))).toBe(true);
  });

  it('names the other clinic when weekly hours overlap', async () => {
    await signIn('derm@metromatrix.app', 'partner');
    const clinic = (await listLocations()).find(l => l.kind === 'clinic')!;
    // The video hours run 08:00–12:00 every day.
    const e = await failure(saveHours(clinic.id, [{ day: 1, ranges: [{ from: '11:00', to: '13:00' }] }]));
    expect(e.code).toBe('VALIDATION_FAILED');
    expect(overlapsFrom(e.details)).toEqual([{ day: 1, otherLocationName: 'Video consultation' }]);
  });

  it('warns about booked visits before time off, and cancels them on request', async () => {
    await signIn('derm@metromatrix.app', 'partner');
    const db = await getDb();
    const booked = db.health.appointments.find(a => a.doctorId === 'd_ayesha' && a.status === 'awaiting_payment' && Date.parse(a.startAt) > T0)!;
    const day = dateInZone(booked.startAt, PKT);
    const e = await failure(addTimeOff({ from: day, to: day, locationId: null, reason: 'Conference' }));
    expect(e.code).toBe('TIME_OFF_CONFLICT');
    expect(conflictsFrom(e.details).map(c => c.code)).toContain(booked.code);
    await addTimeOff({ from: day, to: day, locationId: null, reason: 'Conference' }, true);
    expect(db.health.appointments.find(a => a.id === booked.id)!.status).toBe('cancelled');
    expect(db.shop.notifications.some(n => n.userId === 'u_customer' && n.data.appointmentCode === booked.code)).toBe(true);
  });

  it('keeps a new doctor on Practice setup until the checklist is complete', async () => {
    await signIn('newdoctor@metromatrix.app', 'partner');
    const c = await getCompleteness();
    expect(c.percent).toBeLessThan(100);
    expect(c.canPublish).toBe(false);
    expect((await failure(publishProfile())).code).toBe('PROFILE_INCOMPLETE');
  });
});

describe('video, symptoms and staff', () => {
  it('opens the room only inside the join window', async () => {
    const upcoming = await listAppointments('upcoming', 1);
    const demo = upcoming.items.find(a => a.kind === 'video' && a.doctor.id === 'd_bilal')!;
    expect(demo.canJoinVideo).toBe(true);
    const room = await joinVideo(demo.code);
    expect(room.roomUrl).toMatch(/^https:\/\/meet\.jit\.si\/MetroMatrix-/);
    const later = upcoming.items.find(a => a.kind === 'video' && a.doctor.id === 'd_ayesha')!;
    expect((await failure(joinVideo(later.code))).code).toMatch(/VIDEO_NOT_OPEN|INVALID_TRANSITION/);
  });

  it('sends red flags to Emergency and everything else to a specialty, always with the disclaimer', async () => {
    const red = await checkSymptoms({ text: 'Sudden chest pain and short of breath', age: 54, gender: 'male' });
    expect(red.emergency).toBe(true);
    expect(red.areas).toHaveLength(0);
    const skin = await checkSymptoms({ text: 'Pimples on my face for two months', age: 22, gender: 'female' });
    expect(skin.emergency).toBe(false);
    expect(skin.specialty?.slug).toBe('dermatologist');
    expect(skin.disclaimer).toMatch(/not a diagnosis/);
  });

  it('approves a doctor only after the PMDC check', async () => {
    await signInAdmin();
    expect((await failure(approveBusiness('b_pmdc'))).code).toBe('PMDC_NOT_VERIFIED');
    const v = await verifyPmdc('b_pmdc', 'Matched on the PMDC register');
    expect(v.pmdcVerified).toBe(true);
    const b = await approveBusiness('b_pmdc');
    expect(b.status).toBe('approved');
  });
});
