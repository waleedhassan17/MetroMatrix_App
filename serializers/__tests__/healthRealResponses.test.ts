// Real MetroMatrix-API responses (captured from a local backend against the
// demo seed, then scrubbed and shortened) through the Health serializers:
// the app reads the shapes docs/API_HEALTH.md promises, not only the dummy API's.

import real from './fixtures/health/real.json';
import {
  daysSerializer,
  doctorCardSerializer,
  doctorProfileSerializer,
  doctorReviewSerializer,
  healthHomeSerializer,
  reviewSummarySerializer,
  slotDaySerializer,
  suggestionsSerializer,
} from '../health/discoverySerializer';
import { alternativesFrom, appointmentDetailSerializer, appointmentSummarySerializer } from '../health/appointmentSerializer';
import { familySerializer, prescriptionSerializer, symptomResultSerializer } from '../health/recordsSerializer';
import {
  completenessSerializer,
  conflictsFrom,
  doctorAppointmentSerializer,
  doctorLocationsSerializer,
  hoursSerializer,
  insightsSerializer,
  medicineSuggestionsSerializer,
  overlapsFrom,
  ownProfileSerializer,
  patientHistorySerializer,
  previewSerializer,
  todaySerializer,
} from '../health/doctorSerializer';
import {
  adminAppointmentSerializer,
  adminConditionSerializer,
  adminDoctorSerializer,
  adminSpecialtySerializer,
  healthOverviewSerializer,
} from '../health/adminHealthSerializer';
import { notificationSerializer } from '../notificationSerializer';

type Captured = Record<string, { status: number; body: { success: boolean; data?: any; error?: any } }>;
const R = real as unknown as Captured;
const data = (k: string) => R[k].body.data;
const error = (k: string) => R[k].body.error;

/** The capture ran on 17 Oct 2026 (Pakistan time); "now" sits before the visits it booked. */
const NOW = Date.parse('2026-10-17T00:00:00Z');

describe('discovery', () => {
  it('reads the home: city, icon keys as glyphs, rails and emergency numbers', () => {
    const home = healthHomeSerializer(data('homeSignedIn'))!;
    expect(home.city).toBe('Lahore');
    expect(home.cities).toContain('Karachi');
    expect(home.specialties[0]).toMatchObject({ slug: 'dermatologist', icon: 'body-outline', doctorCount: 1 });
    expect(home.commonConditions.find(c => c.slug === 'acne')).toMatchObject({ icon: 'sparkles-outline', specialtySlug: 'dermatologist' });
    expect(home.availableToday.length).toBeGreaterThan(0);
    expect(home.featuredDoctors.length).toBeGreaterThan(0);
    expect(home.emergencyNumbers.map(n => n.number)).toEqual(expect.arrayContaining(['1122']));
    for (const b of home.banners) expect(b.imageUrl).toMatch(/^https:\/\//);
  });

  it('reads a doctor card: display name, rating, fee and an offset time as UTC', () => {
    const card = doctorCardSerializer(data('doctors').items[0])!;
    expect(card).toMatchObject({
      name: 'Dr. Sana Iqbal',
      specialty: { slug: 'dermatologist', name: 'Dermatologist' },
      rating: 4.2,
      reviewCount: 41,
      fromFee: 2000,
      offersVideo: true,
      offersClinic: true,
      badges: ['pmdc_verified'],
    });
    // "2026-10-17T10:00:00.000+05:00" is 05:00 UTC.
    expect(card.availability).toEqual({ label: 'Available today, 10:00 AM', today: true, nextAt: '2026-10-17T05:00:00.000Z' });
  });

  it('reads a profile with its similar doctors, video first', () => {
    const p = doctorProfileSerializer({ ...data('profile'), similar: data('similar') })!;
    expect(p.name).toBe('Dr. Sana Iqbal');
    expect(p.about).toMatch(/Demo profile/);
    expect(p.locations[0].kind).toBe('video');
    expect(p.locations.filter(l => l.kind === 'clinic').length).toBeGreaterThan(0);
    expect(p.similar.length).toBeGreaterThan(0);
    expect(p.similar.every(s => s.id !== p.id)).toBe(true);
  });

  it('reads the slots response as the date strip and the first day', () => {
    expect(daysSerializer(data('slots')).map(d => d.date).slice(0, 2)).toEqual(['2026-10-17', '2026-10-18']);
    const day = slotDaySerializer(data('slots'))!;
    expect(day.date).toBe('2026-10-17');
    expect(day.timezone).toBe('Asia/Karachi');
    expect(day.slots[0]).toEqual({ startAt: '2026-10-17T12:00:00.000Z', period: 'evening' });
  });

  it('reads reviews (tag codes as words) and the summary', () => {
    const r = doctorReviewSerializer(data('reviews').items[0])!;
    expect(r).toMatchObject({ authorName: 'Postman P.', rating: 5, tags: ['Explained clearly', 'On time'] });
    expect(r.reply?.text).toBeTruthy();
    const s = reviewSummarySerializer(data('doctorReviewSummary'))!;
    expect(s).toMatchObject({ average: 4.2, count: 41, recommendPct: 78, distribution: [0, 2, 7, 11, 21] });
    expect(s.tags[0]).toEqual({ label: 'On time', count: 13 });
    expect(s.dimensions.map(d => d.key)).toEqual(['diagnosis', 'staff', 'environment']);
  });

  it('reads search suggestions', () => {
    const s = suggestionsSerializer(data('suggest'));
    expect(s.doctors[0]).toMatchObject({ name: 'Dr. Sana Iqbal', specialtyName: 'Dermatologist' });
    expect(s.specialties[0].slug).toBe('dermatologist');
  });
});

describe('appointments', () => {
  it('a clinic booking is confirmed and paid at the clinic', () => {
    const a = appointmentDetailSerializer(data('book'), NOW)!;
    expect(a).toMatchObject({ code: 'HC-M5UWSH', status: 'confirmed', kind: 'clinic', paymentStatus: 'pay_at_visit', startAt: '2026-10-17T12:30:00.000Z' });
    expect(a.location).toMatchObject({ address: '13-A Main Boulevard', lat: 31.487 });
    expect(a.payment.method).toBe('pay_at_visit');
  });

  it('a video booking owes a transfer, with the doctor’s account and a join time', () => {
    const a = appointmentDetailSerializer(data('bookVideo'), NOW)!;
    expect(a).toMatchObject({ status: 'confirmed', kind: 'video', paymentStatus: 'awaiting_transfer', canPay: true, joinOpensAt: '2026-10-19T17:20:00.000Z' });
    expect(a.payment.instructions).toMatchObject({ kind: 'bank', accountTitle: 'Dr. Sana Iqbal', bankName: 'Meezan Bank (demo)', amount: 2000 });
    // No prepayment asked: the transfer is due by the visit itself.
    expect(a.payment.instructions?.payBy).toBe(a.startAt);
  });

  it('a cancel voids the unpaid fee; a reschedule is a new booking', () => {
    expect(appointmentDetailSerializer(data('cancel'), NOW)).toMatchObject({ status: 'cancelled', paymentStatus: 'void' });
    const moved = appointmentDetailSerializer(data('reschedule'), NOW)!;
    expect(moved.status).toBe('confirmed');
    expect(moved.rescheduleCount).toBe(1);
  });

  it('a completed clinic visit reads "collected"; the timeline maps status rows', () => {
    const a = appointmentDetailSerializer(data('appointmentDone'), NOW)!;
    expect(a).toMatchObject({ status: 'completed', paymentStatus: 'collected' });
    expect(a.timeline.map(e => e.type)).toEqual(expect.arrayContaining(['booked', 'checked_in', 'in_progress', 'completed']));
  });

  it('list rows are summaries', () => {
    expect(appointmentSummarySerializer(data('appointments').items[0])).toMatchObject({ code: 'HC-JSUCYS', doctor: { name: 'Dr. Sana Iqbal' } });
  });

  it('SLOT_TAKEN offers the nearest free times', () => {
    expect(error('slotTaken').code).toBe('SLOT_TAKEN');
    expect(alternativesFrom(error('slotTaken').details)).toEqual(['2026-10-17T12:00:00.000Z', '2026-10-17T13:15:00.000Z', '2026-10-17T13:30:00.000Z']);
  });
});

describe('records, prescriptions and the symptom checker', () => {
  it('reads family members', () => {
    expect(familySerializer(data('family'))[0]).toMatchObject({ name: 'Zara Raza', relation: 'child', dateOfBirth: '2019-04-12' });
  });

  it('reads a prescription: dose patterns, days, tests by name, where it was written', () => {
    const p = prescriptionSerializer(data('prescription'))!;
    expect(p).toMatchObject({ appointmentCode: 'HC-UVSAE3', diagnosis: 'Acne vulgaris (mild)', tests: ['CBC'], followUpInDays: 30 });
    expect(p.medicines[0]).toMatchObject({ name: 'Doxycycline', dose: '1+0+0', days: 30, timing: 'after_meal' });
    expect(p.doctor.place).toBe('Model Town Clinic (demo), Model Town, Lahore');
  });

  it('reads both symptom answers, never a diagnosis', () => {
    const routine = symptomResultSerializer(data('symptomFallback'))!;
    expect(routine).toMatchObject({ emergency: false, specialty: { slug: 'dermatologist' } });
    expect(routine.areas[0].title).toBe('Acne');
    const urgent = symptomResultSerializer(data('symptomEmergency'))!;
    expect(urgent.emergency).toBe(true);
    expect(urgent.emergencyNumbers.map(n => n.number)).toEqual(['1122', '115']);
    expect(urgent.disclaimer).toMatch(/not a diagnosis/);
  });
});

describe('the doctor app', () => {
  it('reads the own profile, completeness and the weekly schedule (Sunday 0 → day 7)', () => {
    expect(ownProfileSerializer(data('doctorProfile'))).toMatchObject({ title: 'Dr.', name: 'Sana Iqbal', specialtySlug: 'dermatologist', practisingSince: 2011 });
    expect(completenessSerializer(data('completeness'))).toMatchObject({ percent: 100, isListed: true, canPublish: false });
    const hours = hoursSerializer(data('schedule'));
    expect(hours).toHaveLength(7);
    expect(hours[0]).toEqual({ day: 1, ranges: [{ from: '17:00', to: '21:00' }] });
    expect(hours[6]).toEqual({ day: 7, ranges: [] });
  });

  it('joins locations with their schedules', () => {
    const schedule = data('schedule');
    const list = doctorLocationsSerializer({ locations: data('locations'), schedules: { [schedule.locationId]: schedule }, videoPrepay: false });
    const withHours = list.find(l => l.id === schedule.locationId)!;
    expect(withHours.hours.some(d => d.ranges.length)).toBe(true);
    expect(withHours.timings[0].hours).toBe('5:00 PM – 9:00 PM');
    expect(list.find(l => l.kind === 'video')).toBeTruthy();
  });

  it('reads overlap and time-off conflicts from the error details', () => {
    expect(error('scheduleOverlap').code).toBe('SCHEDULE_OVERLAP');
    expect(overlapsFrom(error('scheduleOverlap').details)).toEqual([{ day: 1, otherLocationName: 'Model Town Clinic (demo)' }]);
    expect(error('timeOffConflict').code).toBe('TIME_OFF_CONFLICTS');
    expect(conflictsFrom(error('timeOffConflict').details)[0]).toMatchObject({ code: 'HC-JSUCYS', patientName: 'Ali Raza', startAt: '2026-10-17T12:15:00.000Z' });
  });

  it('reads the preview and the day (rows keyed by code, server flags as actions)', () => {
    expect(previewSerializer(data('preview')).locations[0].days[0].slots.length).toBeGreaterThan(0);
    const day = todaySerializer({ today: data('today'), locations: data('locations') })!;
    expect(day.counts).toEqual({ booked: 4, checkedIn: 0, done: 2, noShow: 0 });
    expect(day.queue[0]).toMatchObject({ id: 'HC-JSUCYS', code: 'HC-JSUCYS', status: 'confirmed', actions: { canCheckIn: true, canStart: false } });
  });

  it('reads one appointment with its notes and prescription', () => {
    const a = doctorAppointmentSerializer({ appointment: data('doctorAppointmentDone'), notes: data('notes'), prescription: data('prescriptionCurrent') })!;
    expect(a).toMatchObject({ id: 'HC-UVSAE3', status: 'completed', notes: { text: 'Mild acne; no scarring.' } });
    expect(a.prescription?.diagnosis).toBe('Acne vulgaris (mild)');
  });

  it('reads medicine suggestions, patients and insights', () => {
    expect(medicineSuggestionsSerializer(data('medicines'))[0]).toMatchObject({ name: 'Paracetamol', form: 'syrup', isFavourite: false });
    const h = patientHistorySerializer(data('patientHistory'))!;
    expect(h.patient.name).toBe('Ali Raza');
    expect(h.visits[0]).toMatchObject({ code: 'HC-UVSAE3', diagnosis: 'Acne vulgaris (mild)' });
    const i = insightsSerializer(data('insights'))!;
    expect(i.perDay).toHaveLength(7);
    expect(i).toMatchObject({ recordedFees: 12000, outcomes: { completed: 5, cancelled: 6, noShow: 0 } });
  });
});

describe('the staff console', () => {
  it('reads the overview, catalogue rows, doctors and an appointment', () => {
    expect(healthOverviewSerializer(data('adminOverview'))).toMatchObject({ listedDoctors: 30, pendingVerification: 0 });
    expect(adminSpecialtySerializer(data('adminSpecialties')[0])).toMatchObject({ slug: 'general-physician', icon: 'medkit-outline' });
    expect(adminConditionSerializer(data('adminConditions').items[0])).toMatchObject({ slug: 'acne', aliases: expect.arrayContaining(['pimples', 'pimple']) });
    const d = adminDoctorSerializer(data('adminDoctors').items[0])!;
    expect(d).toMatchObject({ name: 'Dr. Faisal Raza', specialty: 'Psychiatrist', pmdcVerified: true, status: 'approved' });
    expect(d.businessId).toBe(data('adminDoctors').items[0].business.id);
    const a = adminAppointmentSerializer(data('adminAppointment'))!;
    expect(a).toMatchObject({ code: 'HC-UVSAE3', prescriptionId: 'written' });
    expect(a.doctorBusinessId).toBeTruthy();
  });
});

describe('notifications', () => {
  it('reads Health notices: dotted types, readAt, and the appointment code for the doctor app', () => {
    const [rx, booked] = data('notifications').items.map((n: unknown) => notificationSerializer(n)!);
    expect(rx).toMatchObject({ type: 'prescription_ready', isRead: false, data: { prescriptionId: data('prescription').id, appointmentCode: 'HC-UVSAE3' } });
    expect(booked.type).toBe('appointment_update');
    const [review, fresh, cancelled] = data('doctorNotifications').items.map((n: unknown) => notificationSerializer(n)!);
    expect(review.type).toBe('review_new');
    expect(fresh).toMatchObject({ type: 'appointment_new', data: { appointmentId: 'HC-UVSAE3' } });
    expect(cancelled.type).toBe('appointment_update');
    expect(notificationSerializer({ id: 'n', type: 'health.appointment.booked', readAt: '2026-10-17T00:00:00Z' })!.isRead).toBe(true);
  });
});
