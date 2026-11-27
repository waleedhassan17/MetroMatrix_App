// The doctor's practice tools, read from real MetroMatrix-API answers
// (fixtures/health/practice.json: captured on 26 Nov 2026 from a local backend
// on the demo seed with scripts/capture-health-fixtures.js, then scrubbed):
// day statuses and the doctor's own slots, the schedule check, a day's own
// hours, a walk-in, mark paid, the doctor's move and a follow-up.

import practice from './fixtures/health/practice.json';
import { daysSerializer, doctorCardSerializer, locationSerializer, slotsMetaSerializer } from '../health/discoverySerializer';
import { appointmentDetailSerializer } from '../health/appointmentSerializer';
import {
  createdAppointmentSerializer,
  dayHoursListSerializer,
  doctorAppointmentSerializer,
  doctorFeaturesSerializer,
  hoursReportSerializer,
  listingSerializer,
  ownProfileSerializer,
  placesSerializer,
  previewSerializer,
  queuePageSerializer,
  todaySerializer,
} from '../health/doctorSerializer';
import { businessSerializer } from '../businessSerializer';

type Captured = Record<string, { status: number; body: { success: boolean; data?: any; error?: any } }>;
const R = practice as unknown as Captured;
const body = (k: string) => R[k].body;
const data = (k: string) => R[k].body.data;

describe("the doctor's practice tools, from real answers", () => {
  it('reads what the server offers, the pause switch and the listing', () => {
    expect(doctorFeaturesSerializer(body('doctorProfile'))).toEqual({
      features: expect.arrayContaining(['walk_in', 'overrides', 'doctor_reschedule', 'follow_up_booking', 'mark_paid_later', 'buffer', 'pause']),
      isAccepting: true,
      // Who Today greets, and whether patients can find them.
      me: expect.objectContaining({ name: 'Dr. Sana Iqbal', firstName: 'Sana', specialtyName: 'Dermatologist', isListed: true, wasListed: true, hiddenByStaff: null }),
    });
    expect(ownProfileSerializer(data('doctorProfile'))).toMatchObject({ isAccepting: true, hiddenByStaff: null });
    expect(listingSerializer(body('doctorProfile'))).toMatchObject({ isListed: true, hiddenByStaff: null });
    expect(businessSerializer(data('doctorBusiness'))).toMatchObject({ isListed: true, wasListed: true });
  });

  it('reads why each day has its slots, and whether bookings are on', () => {
    const days = daysSerializer(body('slots'));
    expect(days.length).toBeGreaterThan(1);
    for (const d of days) expect(['open', 'full', 'closed', 'time_off', 'paused', 'beyond_window']).toContain(d.status);
    // A day with no free times says why; one with free times is open.
    expect(days.filter(d => d.slotCount > 0).every(d => d.status === 'open')).toBe(true);
    expect(slotsMetaSerializer(body('slots'))).toEqual({ accepting: true, windowDays: 14 });
    // The doctor's own slots read the same way (no notice, the long window).
    expect(daysSerializer(body('ownSlots')).length).toBe(3);
    expect(slotsMetaSerializer(body('ownSlots'))?.windowDays).toBe(120);
  });

  it("reads each location's break after each patient, and the active places", () => {
    const locations = data('locations') as unknown[];
    const clinic = locations.map(l => locationSerializer(l)).find(l => l?.name.startsWith('Model Town'));
    expect(clinic).toMatchObject({ kind: 'clinic', bufferMinutes: 5 });
    const places = placesSerializer(body('locations'));
    expect(places.map(p => p.kind)).toEqual(expect.arrayContaining(['clinic', 'video']));
    expect(previewSerializer(body('preview')).paused).toBe(false);
  });

  it('reads the schedule check: hours shared with video, visits left outside, the week', () => {
    const report = hoursReportSerializer(body('scheduleDryRun'))!;
    expect(report.slots).toBe(72);
    expect(report.outsideHours).toEqual([]);
    expect(report.sharedWith.length).toBeGreaterThan(0);
    expect(report.sharedWith[0]).toMatchObject({ kind: 'video', locationName: 'Video consultation', date: null });
    expect(report.sharedWith[0].day).toBeGreaterThanOrEqual(1);
  });

  it("reads a day's own hours, saved and listed (the demo's closed day too)", () => {
    expect(hoursReportSerializer(body('overridePut'))).toMatchObject({ slots: 3, sharedWith: [], outsideHours: [] });
    const days = dayHoursListSerializer(body('overrides'));
    expect(days.find(d => !d.closed)).toMatchObject({ ranges: [{ from: '14:00', to: '15:00' }], note: 'Capture: extra hour' });
    expect(days.find(d => d.closed)).toMatchObject({ ranges: [], note: 'Demo: clinic closed for a medical seminar' });
    expect(hoursReportSerializer(body('overrideRemove'))?.outsideHours).toEqual([]);
  });

  it('reads a walk-in: checked in, paying at the clinic, then marked paid', () => {
    expect(createdAppointmentSerializer(body('walkIn'))?.code).toMatch(/^HC-/);
    const walkIn = doctorAppointmentSerializer({ appointment: data('walkIn'), notes: {}, prescription: {} })!;
    expect(walkIn).toMatchObject({ source: 'walk_in', status: 'checked_in', patient: { name: 'Capture Walk-in', age: 40 } });
    const paid = doctorAppointmentSerializer({ appointment: data('markPaid'), notes: {}, prescription: {} })!;
    expect(paid.payment.status).toBe('collected');
  });

  it("reads the doctor's move and the follow-up, and the patient may still reschedule a moved visit", () => {
    const moved = doctorAppointmentSerializer({ appointment: data('doctorReschedule'), notes: {}, prescription: {} })!;
    expect(moved.rescheduledFromId).toBeTruthy();
    const follow = doctorAppointmentSerializer({ appointment: data('followUp'), notes: {}, prescription: {} })!;
    expect(follow.followUpOfId).toBeTruthy();
    expect(follow.reason).toBe('Follow-up');
    expect(appointmentDetailSerializer(body('appointmentMoved'))?.flags.canReschedule).toBe(true);
  });
  it('reads today as the dashboard does: the day in numbers, what needs the doctor, and its lists', () => {
    const day = todaySerializer({ today: data('today'), locations: data('locations') })!;
    expect(day.counts.total).toBe(day.counts.upcoming + day.counts.waiting + day.counts.withDoctor + day.counts.seen + day.counts.missed);
    expect(day.attention).toEqual(
      expect.objectContaining({ transfersToConfirm: expect.any(Number), feesToMark: expect.any(Number), prescriptionsToWrite: expect.any(Number), refundsDue: expect.any(Number), reviewsToReply: expect.any(Number) }),
    );
    // Only locations in use are offered as chips.
    expect(day.locations.every(l => l.id)).toBe(true);
    const needs = queuePageSerializer(body('needsPrescription'))!;
    expect(needs.items.length).toBe(day.attention!.prescriptionsToWrite > 0 ? Math.min(5, day.attention!.prescriptionsToWrite) : 0);
    expect(needs.items[0]?.status).toBe('completed');
  });

  it('reads a doctor card with the proof and the booking state', () => {
    const card = doctorCardSerializer(data('doctors').items[0])!;
    expect(card).toEqual(expect.objectContaining({ isAccepting: expect.any(Boolean) }));
    expect(card).toHaveProperty('clinicArea');
    expect(card).toHaveProperty('satisfactionPct');
  });
});
