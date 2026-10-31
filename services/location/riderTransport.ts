// ═══════════════════════════════════════════════════════
// MetroMatrix — where the rider's fixes go
// ═══════════════════════════════════════════════════════
// The rider app plugs this into riderLocation: each fix over the live
// connection (`rider.location`, acked), and when that fails the REST batch
// (POST /food/rider/location). A fix that can't go either way waits in
// riderLocation's queue for the next one that gets through.

import { realtime } from '../realtime/socketClient';
import { REALTIME_SEND } from '../realtime/realtimeConfig';
import { sendLocationBatch } from '../../networks/food/rider/rider';
import type { RiderLocationTransport } from './riderLocation';
import type { RiderFix } from './riderLocationCore';

const point = (f: RiderFix) => ({
  lat: f.lat,
  lng: f.lng,
  ...(f.heading !== null ? { heading: f.heading } : null),
  ...(f.speed !== null ? { speed: f.speed } : null),
  ...(f.accuracy !== null ? { accuracy: f.accuracy } : null),
  at: f.at,
});

export const riderTransport: RiderLocationTransport = {
  async sendLive(fixes) {
    for (const f of fixes) {
      const ack = (await realtime.send(REALTIME_SEND.riderLocation, point(f))) as { ok?: boolean } | false;
      if (!ack || ack.ok === false) return false;
    }
    return true;
  },
  async sendBatch(fixes) {
    await sendLocationBatch(fixes);
  },
};
