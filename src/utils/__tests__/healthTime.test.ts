// Appointment times read the same whatever the phone's own timezone is: the
// suite runs with the device in New York (jest.globalSetup.js — UTC−4 in
// October), the clinic in Lahore (UTC+5).

import {
  addDays,
  ageFrom,
  dateBlock,
  dateInZone,
  elapsed,
  formatDayChip,
  formatSlot,
  formatWhen,
  isoWeekday,
  relativeStart,
  slotA11yLabel,
  todayInZone,
  weekStart,
  zoneOffsetMinutes,
  zonedToIso,
} from '../healthTime';

const PKT = 'Asia/Karachi';
// 6:15 PM in Lahore on Thursday 15 October 2026.
const SLOT = '2026-10-15T13:15:00.000Z';

describe('healthTime (device in New York, clinic in Lahore)', () => {
  it('the device really is elsewhere', () => {
    expect(new Date(SLOT).getHours()).toBe(9);
  });

  it('formats in the practice zone, never the device one', () => {
    expect(formatSlot(SLOT, PKT)).toBe('6:15 PM');
    expect(formatWhen(SLOT, PKT)).toBe('Thu 15 Oct, 6:15 PM');
    expect(slotA11yLabel(SLOT, PKT)).toBe('Thursday 15 October, 6:15 PM, available');
    expect(dateBlock(SLOT, PKT)).toEqual({ day: '15', month: 'Oct', weekday: 'Thu' });
  });

  it('turns a wall time at the clinic into the right instant', () => {
    expect(zonedToIso('2026-10-15', '18:15', PKT)).toBe(SLOT);
    expect(zoneOffsetMinutes(PKT, Date.parse(SLOT))).toBe(300);
  });

  it('knows which clinic day an instant falls on', () => {
    // 8 PM UTC is already 1 AM the next day in Lahore.
    expect(dateInZone('2026-10-15T20:00:00Z', PKT)).toBe('2026-10-16');
    expect(todayInZone(PKT, Date.parse('2026-10-15T20:00:00Z'))).toBe('2026-10-16');
  });

  it('works with zone-free days', () => {
    expect(addDays('2026-10-31', 1)).toBe('2026-11-01');
    expect(isoWeekday('2026-10-15')).toBe(4);
    expect(isoWeekday('2026-10-18')).toBe(7);
    expect(weekStart('2026-10-18')).toBe('2026-10-12');
    expect(formatDayChip('2026-10-16')).toEqual({ weekday: 'Fri', day: '16', month: 'Oct', long: 'Friday 16 October' });
  });

  it('says how soon an appointment starts', () => {
    const start = Date.parse(SLOT);
    expect(relativeStart(SLOT, start - (2 * 60 + 15) * 60_000)).toBe('in 2 h 15 min');
    expect(relativeStart(SLOT, start - 45 * 60_000)).toBe('in 45 min');
    expect(relativeStart(SLOT, start - 30_000)).toBe('Starts now');
    expect(relativeStart(SLOT, start + 5 * 60_000, '2026-10-15T13:30:00.000Z')).toBe('Starts now');
    expect(relativeStart(SLOT, start + 20 * 60_000, '2026-10-15T13:30:00.000Z')).toBeNull();
    expect(relativeStart(SLOT, start - 26 * 3_600_000)).toBe('Tomorrow');
    expect(relativeStart(SLOT, start - 3 * 86_400_000)).toBe('in 3 days');
  });

  it('times the wait and works out ages', () => {
    expect(elapsed('2026-10-15T13:00:00Z', Date.parse('2026-10-15T13:12:30Z'))).toBe('12 min');
    expect(elapsed('2026-10-15T12:00:00Z', Date.parse('2026-10-15T13:05:00Z'))).toBe('1 h 5 min');
    expect(ageFrom('2019-03-14', Date.parse(SLOT))).toBe(7);
    expect(ageFrom(null)).toBeNull();
    expect(ageFrom('not a date')).toBeNull();
  });
});
