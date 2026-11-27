import { dayProgress, greeting, listingNotice, needRows, nextStep, nextUp, queueIn, queueTabLabel } from '../health/doctorTodayModel';
import { withBreak } from '../health/availabilityModel';
import type { QueueItem, TodayCounts } from '../health';

const NO_ACTIONS = {
  canCheckIn: false,
  canStart: false,
  canComplete: false,
  canNoShow: false,
  canCancel: false,
  canConfirmPayment: false,
  canWritePrescription: false,
  canJoinVideo: false,
  canRefund: false,
  canRejectPayment: false,
  canMarkPaid: false,
};

const visit = (id: string, status: QueueItem['status'], actions: Partial<typeof NO_ACTIONS> = {}): QueueItem => ({
  id,
  code: id,
  startAt: '2026-11-27T10:00:00.000Z',
  timezone: 'Asia/Karachi',
  kind: 'clinic',
  status,
  patient: { name: `Patient ${id}`, age: 30, gender: 'female' },
  firstVisit: false,
  reason: null,
  checkedInAt: null,
  paymentMethod: 'pay_at_visit',
  paymentStatus: 'pay_at_visit',
  locationId: 'loc',
  locationName: 'Clinic',
  canJoinVideo: false,
  joinOpensAt: null,
  actions: { ...NO_ACTIONS, ...actions },
  source: 'app',
} as QueueItem);

describe('doctorTodayModel', () => {
  it('greets by the practice’s clock, not the phone’s', () => {
    // 04:00 UTC is 09:00 in Karachi; 12:30 UTC is 17:30.
    expect(greeting(Date.parse('2026-11-27T04:00:00Z'), 'Asia/Karachi')).toBe('Good morning');
    expect(greeting(Date.parse('2026-11-27T08:00:00Z'), 'Asia/Karachi')).toBe('Good afternoon');
    expect(greeting(Date.parse('2026-11-27T12:30:00Z'), 'Asia/Karachi')).toBe('Good evening');
  });

  it('puts each visit in one queue tab, and labels the tabs with the counts', () => {
    const q = [visit('a', 'in_progress'), visit('b', 'checked_in'), visit('c', 'confirmed'), visit('d', 'completed'), visit('e', 'no_show')];
    expect(queueIn(q, 'waiting').map(x => x.id)).toEqual(['a', 'b']);
    expect(queueIn(q, 'upcoming').map(x => x.id)).toEqual(['c']);
    expect(queueIn(q, 'done').map(x => x.id)).toEqual(['d', 'e']);
    const counts: TodayCounts = { total: 5, upcoming: 1, waiting: 1, withDoctor: 1, seen: 1, missed: 1 };
    expect(queueTabLabel('waiting', counts)).toBe('Here · 2');
    expect(queueTabLabel('done', counts)).toBe('Done · 2');
    expect(dayProgress(counts)).toBeCloseTo(0.4);
    expect(dayProgress({ ...counts, total: 0 })).toBe(0);
  });

  it('heroes the patient with you, else the one waiting, else the next booked', () => {
    expect(nextUp([visit('c', 'confirmed'), visit('b', 'checked_in'), visit('a', 'in_progress')])).toMatchObject({ mode: 'with', item: { id: 'a' } });
    expect(nextUp([visit('c', 'confirmed'), visit('b', 'checked_in')])).toMatchObject({ mode: 'waiting', item: { id: 'b' } });
    expect(nextUp([visit('d', 'completed'), visit('c', 'confirmed')])).toMatchObject({ mode: 'next', item: { id: 'c' } });
    expect(nextUp([visit('d', 'completed')])).toBeNull();
  });

  it('offers the one step the server allows, a video join first', () => {
    expect(nextStep(visit('a', 'in_progress', { canComplete: true, canJoinVideo: true }))).toBe('join');
    expect(nextStep(visit('a', 'in_progress', { canComplete: true }))).toBe('complete');
    expect(nextStep(visit('b', 'checked_in', { canStart: true }))).toBe('start');
    expect(nextStep(visit('c', 'confirmed', { canCheckIn: true }))).toBe('check-in');
    expect(nextStep(visit('d', 'completed'))).toBeNull();
  });

  it('lists only what needs the doctor, and nothing from a server without the counts', () => {
    expect(needRows(null)).toEqual([]);
    const rows = needRows({ transfersToConfirm: 2, feesToMark: 0, prescriptionsToWrite: 1, refundsDue: 0, reviewsToReply: 3 });
    expect(rows.map(r => [r.key, r.count])).toEqual([
      ['transfer', 2],
      ['prescription', 1],
      ['review', 3],
    ]);
  });

  it('says why patients can’t find the doctor: staff, a missing step, or their own choice', () => {
    expect(listingNotice({ isListed: true, hiddenByStaff: null }, [])).toBeNull();
    expect(listingNotice({ isListed: false, hiddenByStaff: 'PMDC lapsed' }, ['a photo'])).toEqual({ kind: 'staff', reason: 'PMDC lapsed' });
    expect(listingNotice({ isListed: false, hiddenByStaff: null }, ['profile photo'])).toEqual({ kind: 'incomplete', missing: ['profile photo'] });
    expect(listingNotice({ isListed: false, hiddenByStaff: null }, [])).toEqual({ kind: 'hidden_by_you' });
    expect(listingNotice(null, [])).toBeNull();
  });
});

describe('withBreak (Availability’s "Add a break")', () => {
  it('splits a long range around its middle with an hour off', () => {
    expect(withBreak([{ from: '09:00', to: '17:00' }])).toEqual([
      { from: '09:00', to: '13:00' },
      { from: '14:00', to: '17:00' },
    ]);
    expect(withBreak([{ from: '17:00', to: '23:59' }])).toEqual([
      { from: '17:00', to: '20:00' },
      { from: '21:00', to: '23:59' },
    ]);
  });

  it('adds a later range after a short one, and the evening to an empty day', () => {
    expect(withBreak([{ from: '09:00', to: '11:00' }])).toEqual([
      { from: '09:00', to: '11:00' },
      { from: '12:00', to: '15:00' },
    ]);
    expect(withBreak([])).toEqual([{ from: '17:00', to: '21:00' }]);
    // No room after the day's end: unchanged.
    expect(withBreak([{ from: '22:00', to: '23:59' }])).toEqual([{ from: '22:00', to: '23:59' }]);
  });
});
