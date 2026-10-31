// The rider tracker's rules (ported from FinMatrix locationService):
// what is worth sending, and the bounded queue that keeps unsent fixes.

import {
  MIN_MOVE_METERS,
  QUEUE_MAX,
  enqueue,
  fixFromPosition,
  haversineMeters,
  shouldSend,
  type RiderFix,
} from '../location/riderLocationCore';

const fix = (lat: number, lng: number, at = '2026-10-17T10:00:00.000Z'): RiderFix => ({
  lat,
  lng,
  heading: null,
  speed: null,
  accuracy: 5,
  at,
});

describe('rider location rules', () => {
  it('measures distance on the earth (about 111 m per 0.001° of latitude)', () => {
    const d = haversineMeters(fix(31.52, 74.35), fix(31.521, 74.35));
    expect(d).toBeGreaterThan(110);
    expect(d).toBeLessThan(112);
  });

  it('sends the first fix, real movement, and anything forced — never jitter', () => {
    const start = fix(31.52, 74.35);
    expect(shouldSend(null, start, false)).toBe(true);
    const jitter = fix(31.52003, 74.35); // ~3 m
    expect(shouldSend(start, jitter, false)).toBe(false);
    expect(shouldSend(start, jitter, true)).toBe(true);
    const moved = fix(31.5202, 74.35); // ~22 m
    expect(haversineMeters(start, moved)).toBeGreaterThan(MIN_MOVE_METERS);
    expect(shouldSend(start, moved, false)).toBe(true);
  });

  it('keeps unsent fixes up to the cap, dropping the oldest', () => {
    let q: RiderFix[] = [];
    for (let i = 0; i < QUEUE_MAX + 5; i++) q = enqueue(q, fix(31.5 + i / 1000, 74.35));
    expect(q).toHaveLength(QUEUE_MAX);
    expect(q[0].lat).toBeCloseTo(31.505);
    expect(q[q.length - 1].lat).toBeCloseTo(31.5 + (QUEUE_MAX + 4) / 1000);
  });

  it("reads expo-location's shape: no negative heading or speed", () => {
    const f = fixFromPosition({
      coords: { latitude: 31.5, longitude: 74.3, heading: -1, speed: -0.2, accuracy: 8 },
      timestamp: Date.parse('2026-10-17T10:00:00Z'),
    });
    expect(f).toEqual({ lat: 31.5, lng: 74.3, heading: null, speed: 0, accuracy: 8, at: '2026-10-17T10:00:00.000Z' });
  });
});
