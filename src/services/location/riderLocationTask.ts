// ═══════════════════════════════════════════════════════
// MetroMatrix — the rider's background location task
// ═══════════════════════════════════════════════════════
// Defined at module scope so the OS can run it after the app is relaunched
// in the background; index.js imports this file before anything else
// (FinMatrix's pattern). Only builds run it: on web, and in Expo Go, the
// rider tracks in the foreground (services/location/riderLocation.ts).
// TODO(API_FOOD): when the rider routes land, register the REST-batch
// transport here at module scope too, so a headless relaunch (no screen
// mounted) can still send; until then its fixes wait in the queue.

import { Platform } from 'react-native';
import { RIDER_LOCATION_TASK, riderLocation, supportsBackgroundTracking } from './riderLocation';
import { fixFromPosition } from './riderLocationCore';

type Fix = Parameters<typeof fixFromPosition>[0];

if (Platform.OS !== 'web' && supportsBackgroundTracking()) {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const TaskManager = require('expo-task-manager') as typeof import('expo-task-manager');
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
