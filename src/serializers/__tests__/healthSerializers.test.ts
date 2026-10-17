// Health serializers degrade, never crash: a renamed field, a null, a number
// sent as a string or an unknown enum becomes a sensible default.

import {
  conditionSerializer,
  daysSerializer,
  doctorCardSerializer,
  doctorProfileSerializer,
  doctorReviewSerializer,
  healthHomeSerializer,
  reviewSummarySerializer,
  slotDaySerializer,
  specialtySerializer,
  suggestionsSerializer,
} from '../health/discoverySerializer';
import { alternativesFrom, appointmentDetailSerializer, appointmentSummarySerializer } from '../health/appointmentSerializer';
import {
  familyMemberSerializer,
  healthRecordSerializer,
  prescriptionSerializer,
  symptomResultSerializer,
  videoJoinSerializer,
} from '../health/recordsSerializer';
import {
  completenessSerializer,
  conflictsFrom,
  doctorAppointmentSerializer,
  hoursSerializer,
  insightsSerializer,
  medicineSuggestionsSerializer,
  overlapsFrom,
  todaySerializer,
} from '../health/doctorSerializer';
import { adminDoctorSerializer, healthOverviewSerializer } from '../health/adminHealthSerializer';

const JUNK: unknown[] = [null, undefined, 42, 'x', [], true];

describe('health serializers on junk input', () => {
  it.each([
    ['specialty', specialtySerializer],
    ['condition', conditionSerializer],
    ['doctor card', doctorCardSerializer],
    ['doctor profile', doctorProfileSerializer],
    ['review', doctorReviewSerializer],
    ['home', healthHomeSerializer],
    ['slot day', slotDaySerializer],
    ['appointment summary', appointmentSummarySerializer],
    ['appointment detail', appointmentDetailSerializer],
    ['family member', familyMemberSerializer],
    ['record', healthRecordSerializer],
    ['prescription', prescriptionSerializer],
    ['video', videoJoinSerializer],
    ['symptoms', symptomResultSerializer],
    ['completeness', completenessSerializer],
    ['today', todaySerializer],
    ['doctor appointment', doctorAppointmentSerializer],
    ['insights', insightsSerializer],
    ['admin doctor', adminDoctorSerializer],
    ['overview', healthOverviewSerializer],
  ])('%s returns null for non-objects', (_name, fn) => {
    for (const j of JUNK) expect(fn(j as never)).toBeNull();
  });

  it('list readers return empty lists', () => {
    for (const j of JUNK) {
      expect(daysSerializer(j)).toEqual([]);
      expect(hoursSerializer(j).every(d => d.ranges.length === 0)).toBe(true);
      expect(medicineSuggestionsSerializer(j)).toEqual([]);
      expect(alternativesFrom(j as never)).toEqual([]);
      expect(overlapsFrom(j as never)).toEqual([]);
      expect(conflictsFrom(j as never)).toEqual([]);
    }
    expect(suggestionsSerializer(null)).toEqual({ doctors: [], specialties: [], conditions: [] });
    expect(reviewSummarySerializer(undefined).distribution).toEqual([0, 0, 0, 0, 0]);
  });
});

describe('health serializers on partial input', () => {
  it('home banners need a photo, words and somewhere to go; concerns keep their icon', () => {
    const h = healthHomeSerializer({
      city: 'Lahore',
      banners: [
        { id: 'b1', imageUrl: 'https://x/1.jpg', title: 'Skin', subtitle: 'Derm', targetType: 'specialty', target: { id: 's', slug: 'dermatologist', name: 'Dermatologist' } },
        { id: 'b2', imageUrl: 'https://x/2.jpg', title: 'Video', targetType: 'screen', targetScreen: 'video_consultation' },
        { id: 'b3', imageUrl: 'https://x/3.jpg', title: 'Unknown screen', targetType: 'screen', targetScreen: 'teleport' },
        { id: 'b4', title: 'No photo', targetType: 'screen', targetScreen: 'records' },
        { id: 'b5', imageUrl: 'https://x/5.jpg', title: 'Doctor gone', targetType: 'doctor', target: null },
        { id: 'b6', imageUrl: 'https://x/6.jpg', title: 'Doctor', targetType: 'doctor', target: { id: 'd1' } },
      ],
      featuredDoctors: [{ id: 'd1', name: 'Dr. A' }, null, { name: 'no id' }],
      commonConditions: [{ slug: 'fever', name: 'Fever', icon: 'thermometer-outline' }, { slug: 'acne', name: 'Acne' }],
    })!;
    expect(h.banners.map(b => b.id)).toEqual(['b1', 'b2', 'b6']);
    expect(h.banners[0]).toEqual({ id: 'b1', imageUrl: 'https://x/1.jpg', headline: 'Skin', subhead: 'Derm', target: { kind: 'specialty', slug: 'dermatologist', name: 'Dermatologist' } });
    expect(h.banners[1]).toMatchObject({ subhead: null, target: { kind: 'screen', screen: 'video_consultation' } });
    expect(h.banners[2].target).toEqual({ kind: 'doctor', id: 'd1', name: 'Doctor' });
    expect(h.featuredDoctors.map(d => d.id)).toEqual(['d1']);
    expect(h.commonConditions.map(c => c.icon)).toEqual(['thermometer-outline', null]);
  });

  it('a doctor card with strings for numbers and unknown badges', () => {
    const d = doctorCardSerializer({
      id: 'd1',
      title: 'prof',
      fullName: 'A Khan',
      ratingAvg: '4.86',
      ratingCount: '12',
      minFee: '1499.6',
      badges: { pmdcVerified: true, famous: true },
      yearsExperience: -3,
    })!;
    expect(d.name).toBe('Prof. Dr. A Khan');
    expect(d.rating).toBe(4.9);
    expect(d.reviewCount).toBe(12);
    expect(d.fromFee).toBe(1500);
    expect(d.badges).toEqual(['pmdc_verified']);
    expect(d.yearsExperience).toBe(0);
    expect(d.waitMinutes).toBeNull();
    expect(d.specialty.name).toBe('General physician');
    expect(d.availability).toEqual({ label: null, today: false, nextAt: null });
    // An average over no reviews is no rating.
    expect(doctorCardSerializer({ id: 'd2', ratingAvg: 4, ratingCount: 0 })!.rating).toBeNull();
  });

  it('a profile puts video first and drops broken rows', () => {
    const p = doctorProfileSerializer({
      id: 'd1',
      booking: { videoPrepayRequired: true },
      locations: [{ id: 'c1', kind: 'clinic', fee: 2000 }, { id: 'v1', kind: 'video', fee: 1000 }, { kind: 'clinic' }],
      qualificationList: [{ degree: 'MBBS', institute: 'KEMU', year: '2010' }, { institute: 'no degree' }],
    })!;
    expect(p.locations.map(l => l.id)).toEqual(['v1', 'c1']);
    expect(p.locations[0].requiresPrepay).toBe(true);
    expect(p.locations[1].requiresPrepay).toBe(false);
    expect(p.locations[0].timezone).toBe('Asia/Karachi');
    expect(p.qualificationList).toEqual([{ degree: 'MBBS', institute: 'KEMU', year: 2010 }]);
  });

  it('an appointment needs a code and a start; video-only fields stay off clinic visits', () => {
    expect(appointmentSummarySerializer({ id: 'a', code: 'HC-1' })).toBeNull();
    const a = appointmentDetailSerializer({
      id: 'a',
      code: 'HC-1',
      startsAt: '2026-10-15T18:15:00+05:00',
      kind: 'clinic',
      status: 'teleported',
      can: { cancel: 'true', joinVideo: true },
      payment: { method: 'bitcoin', status: 'paid' },
      fee: '1000',
    })!;
    expect(a.startAt).toBe('2026-10-15T13:15:00.000Z');
    expect(a.status).toBe('confirmed');
    expect(a.canJoinVideo).toBe(false);
    expect(a.joinOpensAt).toBeNull();
    expect(a.flags.canCancel).toBe(true);
    expect(a.flags.canJoinVideo).toBe(false);
    // An unknown method is a clinic fee; "paid" at the clinic reads "collected".
    expect(a.payment).toMatchObject({ method: 'pay_at_visit', status: 'collected', amount: 1000, instructions: null, proof: null });
    expect(a.endAt).toBe('2026-10-15T13:30:00.000Z');
  });

  it('maps the API’s statuses and payment states', () => {
    const at = (status: string, payment: Record<string, unknown>) =>
      appointmentDetailSerializer({ code: 'HC-1', startsAt: '2026-10-15T13:15:00Z', kind: 'video', status, payment })!;
    expect(at('booked', { method: 'transfer', status: 'awaiting_transfer', payBy: '2026-10-15T12:00:00Z' })).toMatchObject({ status: 'awaiting_payment', paymentStatus: 'awaiting_transfer' });
    expect(at('booked', { method: 'transfer', status: 'awaiting_transfer', payBy: null })).toMatchObject({ status: 'confirmed', paymentStatus: 'awaiting_transfer' });
    expect(at('booked', { method: 'transfer', status: 'awaiting_transfer', rejectedReason: 'Not received' }).paymentStatus).toBe('proof_rejected');
    expect(at('in_consultation', { method: 'transfer', status: 'paid' })).toMatchObject({ status: 'in_progress', paymentStatus: 'paid' });
    expect(at('cancelled', { method: 'transfer', status: 'refund_due' }).paymentStatus).toBe('refund_due');
    expect(at('cancelled', { method: 'pay_at_clinic', status: 'void' }).paymentStatus).toBe('void');
  });

  it('a symptom result always carries a disclaimer and at most three areas', () => {
    const r = symptomResultSerializer({ emergency: 'yes', areasToDiscuss: [1, { title: 'a' }, { title: 'b', explanation: 'why' }, { title: 'c' }, { title: 'd' }] })!;
    expect(r.emergency).toBe(false);
    expect(r.areas).toHaveLength(3);
    expect(r.areas[1]).toEqual({ title: 'b', body: 'why' });
    expect(r.disclaimer).toMatch(/not a diagnosis/);
  });

  it('a video room must be https', () => {
    expect(videoJoinSerializer({ roomUrl: 'http://meet.jit.si/x' })).toBeNull();
    const v = videoJoinSerializer({ provider: 'jitsi', roomUrl: 'https://meet.jit.si/x', window: { closesAt: '2026-10-15T19:00:00+05:00' } })!;
    expect(v).toMatchObject({ provider: 'jitsi', closesAt: '2026-10-15T14:00:00.000Z' });
  });

  it('completeness follows the server’s percent and missing keys', () => {
    const c = completenessSerializer({ percent: '50', missing: ['about', 'mystery'], isListed: false })!;
    expect(c.items.find(i => i.key === 'about')?.done).toBe(false);
    expect(c.items.find(i => i.key === 'photo')?.done).toBe(true);
    expect(c.percent).toBe(50);
    expect(c.canPublish).toBe(false);
  });

  it('hours are the whole week and drop bad days and times', () => {
    const week = hoursSerializer({
      ranges: [
        { weekday: 1, start: '17:00', end: '21:00' },
        { weekday: 1, start: '25:00', end: '26:00' },
        { weekday: 9, start: '09:00', end: '10:00' },
        { weekday: 0, start: '20:00', end: '24:00' },
      ],
    });
    expect(week).toHaveLength(7);
    expect(week[0]).toEqual({ day: 1, ranges: [{ from: '17:00', to: '21:00' }] });
    expect(week[6]).toEqual({ day: 7, ranges: [{ from: '20:00', to: '23:59' }] });
    expect(week.slice(1, 6).every(d => d.ranges.length === 0)).toBe(true);
  });

  it('error details become alternatives, overlaps and conflicts', () => {
    expect(alternativesFrom({ alternatives: [{ startsAt: '2026-10-15T18:30:00+05:00' }, 'nope', '2026-10-15T13:45:00Z'] })).toEqual([
      '2026-10-15T13:30:00.000Z',
      '2026-10-15T13:45:00.000Z',
    ]);
    expect(overlapsFrom({ conflict: { weekday: 0, locationName: 'Gulberg' } })).toEqual([{ day: 7, otherLocationName: 'Gulberg' }]);
    expect(overlapsFrom({ conflict: { weekday: 9, locationName: 'Gulberg' } })).toEqual([]);
    expect(conflictsFrom({ appointments: [{ code: 'HC-1', startsAt: '2026-10-15T13:15:00Z' }] })[0]).toMatchObject({ id: 'HC-1', patientName: 'Patient' });
  });

  it('prescriptions keep only named medicines; families default unknown relations', () => {
    const p = prescriptionSerializer({ id: 'rx', medicines: [{ name: 'Paracetamol', durationDays: '5', dosePattern: '1+0+1' }, { dosePattern: '1+0+1' }], tests: [{ name: 'CBC' }, 'LFT', {}], followUpInDays: 0 })!;
    expect(p.medicines).toHaveLength(1);
    expect(p.medicines[0]).toMatchObject({ dose: '1+0+1', days: 5 });
    expect(p.tests).toEqual(['CBC', 'LFT']);
    expect(p.followUpInDays).toBeNull();
    expect(familyMemberSerializer({ id: 'f', fullName: 'Zara', relation: 'cousin', gender: 'x' })).toMatchObject({ name: 'Zara', relation: 'other', gender: 'other', dateOfBirth: '' });
    expect(healthRecordSerializer({ id: 'r', type: 'scan', files: [{ url: 'a.pdf' }, { mime: 'x' }], createdAt: '2026-01-02T00:00:00Z' })).toMatchObject({
      type: 'imaging',
      memberName: 'Me',
      recordedOn: '2026-01-02',
      files: [{ url: 'a.pdf', mime: 'application/pdf' }],
    });
    // A private file opens through its short-lived link.
    expect(healthRecordSerializer({ id: 'r', files: [{ url: 'https://x/a.jpg', downloadUrl: 'https://x/signed' }] })!.files[0].url).toBe('https://x/signed');
  });

  it('medicine suggestions put favourites first', () => {
    expect(medicineSuggestionsSerializer({ medicines: [{ name: 'B', source: 'reference' }, { name: 'A', source: 'favourite' }] }).map(m => m.name)).toEqual(['A', 'B']);
  });
});
