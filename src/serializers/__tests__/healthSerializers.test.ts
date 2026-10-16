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
      expect(hoursSerializer(j)).toEqual([]);
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

  it('a doctor card with strings for numbers and an unknown badge', () => {
    const d = doctorCardSerializer({ id: 'd1', name: 'Dr. A', rating: '4.86', reviewCount: '12', fromFee: '1499.6', badges: ['pmdc_verified', 'famous'], yearsExperience: -3 })!;
    expect(d.rating).toBe(4.9);
    expect(d.reviewCount).toBe(12);
    expect(d.fromFee).toBe(1500);
    expect(d.badges).toEqual(['pmdc_verified']);
    expect(d.yearsExperience).toBe(0);
    expect(d.waitMinutes).toBeNull();
    expect(d.specialty.name).toBe('General physician');
    expect(d.availability).toEqual({ label: null, today: false, nextAt: null });
  });

  it('a profile puts video first and drops broken rows', () => {
    const p = doctorProfileSerializer({
      id: 'd1',
      locations: [{ id: 'c1', kind: 'clinic', fee: 2000 }, { id: 'v1', kind: 'video', fee: 1000, requiresPrepay: true }, { kind: 'clinic' }],
      qualificationList: [{ degree: 'MBBS', institute: 'KEMU', year: '2010' }, { institute: 'no degree' }],
    })!;
    expect(p.locations.map(l => l.id)).toEqual(['v1', 'c1']);
    expect(p.locations[0].requiresPrepay).toBe(true);
    expect(p.locations[0].timezone).toBe('Asia/Karachi');
    expect(p.qualificationList).toEqual([{ degree: 'MBBS', institute: 'KEMU', year: 2010 }]);
  });

  it('an appointment needs id, code and a start; video-only fields stay off clinic visits', () => {
    expect(appointmentSummarySerializer({ id: 'a', code: 'HC-1' })).toBeNull();
    const a = appointmentDetailSerializer({
      id: 'a',
      code: 'HC-1',
      startAt: '2026-10-15T13:15:00Z',
      kind: 'clinic',
      status: 'teleported',
      canJoinVideo: true,
      joinOpensAt: '2026-10-15T13:05:00Z',
      flags: { canCancel: 'true', canJoinVideo: true },
      payment: { method: 'bitcoin', status: 'paid', amount: '1000' },
    })!;
    expect(a.status).toBe('confirmed');
    expect(a.canJoinVideo).toBe(false);
    expect(a.joinOpensAt).toBeNull();
    expect(a.flags.canCancel).toBe(true);
    expect(a.flags.canJoinVideo).toBe(false);
    expect(a.payment).toEqual({ method: 'pay_at_visit', status: 'paid', amount: 1000, instructions: null, proof: null });
    expect(a.endAt).toBe('2026-10-15T13:30:00.000Z');
  });

  it('a symptom result always carries a disclaimer and at most three areas', () => {
    const r = symptomResultSerializer({ emergency: 'yes', areas: [1, { title: 'a' }, { title: 'b' }, { title: 'c' }, { title: 'd' }] })!;
    expect(r.emergency).toBe(false);
    expect(r.areas).toHaveLength(3);
    expect(r.disclaimer).toMatch(/not a diagnosis/);
  });

  it('a video room must be https', () => {
    expect(videoJoinSerializer({ roomUrl: 'http://meet.jit.si/x' })).toBeNull();
    expect(videoJoinSerializer({ roomUrl: 'https://meet.jit.si/x' })?.provider).toBe('jitsi');
  });

  it('completeness only allows publishing at 100%', () => {
    const c = completenessSerializer({ items: [{ key: 'photo', done: true }, { key: 'about', done: false }, { key: 'mystery', done: true }], canPublish: true })!;
    expect(c.items).toHaveLength(2);
    expect(c.percent).toBe(50);
    expect(c.canPublish).toBe(false);
  });

  it('hours drop bad days and times', () => {
    expect(hoursSerializer([{ day: 1, ranges: [{ from: '17:00', to: '21:00' }, { from: '25:00', to: '26:00' }] }, { day: 9, ranges: [] }])).toEqual([
      { day: 1, ranges: [{ from: '17:00', to: '21:00' }] },
    ]);
  });

  it('error details become alternatives, overlaps and conflicts', () => {
    expect(alternativesFrom({ alternatives: [{ startAt: '2026-10-15T13:30:00Z' }, 'nope', '2026-10-15T13:45:00Z'] })).toEqual([
      '2026-10-15T13:30:00Z',
      '2026-10-15T13:45:00Z',
    ]);
    expect(overlapsFrom({ overlaps: [{ day: '4', otherLocationName: 'Gulberg' }, { day: 1 }] })).toEqual([{ day: 4, otherLocationName: 'Gulberg' }]);
    expect(conflictsFrom({ appointments: [{ id: 'a', code: 'HC-1', startAt: '2026-10-15T13:15:00Z' }] })[0].patientName).toBe('Patient');
  });

  it('prescriptions keep only named medicines; families default unknown relations', () => {
    const p = prescriptionSerializer({ id: 'rx', medicines: [{ name: 'Paracetamol', days: '5' }, { dose: '1+0+1' }], followUpInDays: 0 })!;
    expect(p.medicines).toHaveLength(1);
    expect(p.medicines[0].days).toBe(5);
    expect(p.followUpInDays).toBeNull();
    expect(familyMemberSerializer({ id: 'f', relation: 'cousin', gender: 'x' })).toMatchObject({ relation: 'other', gender: 'other', dateOfBirth: '' });
    expect(healthRecordSerializer({ id: 'r', files: [{ url: 'a' }, { mime: 'x' }], createdAt: '2026-01-02T00:00:00Z' })).toMatchObject({
      memberName: 'Me',
      recordedOn: '2026-01-02',
      files: [{ url: 'a', mime: 'image/jpeg' }],
    });
  });

  it('medicine suggestions put favourites first', () => {
    expect(medicineSuggestionsSerializer([{ name: 'B' }, { name: 'A', isFavourite: true }]).map(m => m.name)).toEqual(['A', 'B']);
  });
});
