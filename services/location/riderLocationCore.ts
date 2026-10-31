// ═══════════════════════════════════════════════════════
// MetroMatrix — rider location: the pure rules
// ═══════════════════════════════════════════════════════
// What the tracker decides, without the OS: whether a fix is worth sending,
// and the bounded queue of fixes waiting for a connection. Ported from
// FinMatrix's locationService (src/services/locationService.ts), whose
// constants these are, with its gap closed: FinMatrix dropped a fix it
// couldn't send; here it waits in the queue (oldest dropped past the cap).

export interface RiderFix {
  lat: number;
  lng: number;
  heading: number | null;
  speed: number | null;
  accuracy: number | null;
  /** When the phone took the fix (ISO). */
  at: string;
}

/** Below this movement a fix isn't sent unless forced (the heartbeat forces). */
export const MIN_MOVE_METERS = 10;
/** The OS delivers a fix only after this much movement (distanceInterval). */
export const DISTANCE_FILTER_METERS = 20;
/** The OS's fix interval, and the foreground heartbeat (the brief's 15 s). */
export const HEARTBEAT_MS = 15_000;
/** Fixes kept while the connection is down; the oldest go first. */
export const QUEUE_MAX = 50;

const EARTH_M = 6371e3;
const rad = (deg: number) => (deg * Math.PI) / 180;

export const haversineMeters = (a: Pick<RiderFix, 'lat' | 'lng'>, b: Pick<RiderFix, 'lat' | 'lng'>): number => {
  const dLat = rad(b.lat - a.lat);
  const dLng = rad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return EARTH_M * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
};

/** Send when forced (heartbeat, a status change), when nothing was sent yet, or after real movement. */
export const shouldSend = (lastSent: RiderFix | null, next: RiderFix, force: boolean): boolean =>
  force || !lastSent || haversineMeters(lastSent, next) >= MIN_MOVE_METERS;

/** Append to the waiting queue, keeping the newest QUEUE_MAX. */
export const enqueue = (queue: RiderFix[], fix: RiderFix): RiderFix[] => [...queue, fix].slice(-QUEUE_MAX);

/** A fix from expo-location's shape. */
export const fixFromPosition = (pos: {
  coords: { latitude: number; longitude: number; heading?: number | null; speed?: number | null; accuracy?: number | null };
  timestamp: number;
}): RiderFix => ({
  lat: pos.coords.latitude,
  lng: pos.coords.longitude,
  heading: pos.coords.heading != null && pos.coords.heading >= 0 ? pos.coords.heading : null,
  speed: pos.coords.speed != null ? Math.max(0, pos.coords.speed) : null,
  accuracy: pos.coords.accuracy ?? null,
  at: new Date(pos.timestamp).toISOString(),
});
