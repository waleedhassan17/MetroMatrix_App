// ═══════════════════════════════════════════════════════
// MetroMatrix — the rider's background location task
// ═══════════════════════════════════════════════════════
// Defined at module scope so the OS can run it after the app is relaunched
// in the background; index.js imports this file before anything else
// (FinMatrix's pattern). Only builds run it: on web, and in Expo Go, the
// rider tracks in the foreground (services/location/riderLocation.ts).
// The transport is registered here too, so a headless relaunch (no screen
// mounted, no live connection) still sends: each fix tries the socket, then
// the REST batch (POST /food/rider/location, docs/API_FOOD.md §4.4).

import { Platform } from 'react-native';
import { RIDER_LOCATION_TASK, riderLocation, supportsBackgroundTracking } from './riderLocation';
import { fixFromPosition } from './riderLocationCore';
import { riderTransport } from './riderTransport';

type Fix = Parameters<typeof fixFromPosition>[0];

if (Platform.OS !== 'web' && supportsBackgroundTracking()) {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const TaskManager = require('expo-task-manager') as typeof import('expo-task-manager');
    riderLocation.setTransport(riderTransport);
    TaskManager.defineTask(RIDER_LOCATION_TASK, async ({ data, error }) => {
      if (error) return;
      const locations = (data as { locations?: Fix[] } | undefined)?.locations;
      if (!locations?.length) return;
      // The freshest fix of the batch, as FinMatrix does.
      await riderLocation.ingest(fixFromPosition(locations[locations.length - 1]), false, true);
    });
  } catch {
    /* task manager unavailable — foreground tracking still works */
  }
}
