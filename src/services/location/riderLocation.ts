// ═══════════════════════════════════════════════════════
// MetroMatrix — the rider's live location
// ═══════════════════════════════════════════════════════
// Ported from FinMatrix's locationService. Tracking runs only while the
// rider is on duty or working a delivery: screens call start()/stop(), and
// the count of holders decides (the duty switch and an open delivery both
// hold it; the last stop() really stops — FinMatrix's ref-count fix).
//
// Where fixes go is plugged in by the rider app (setTransport): the live
// connection first, the REST batch when it is down. A fix that can't be
// sent waits in a bounded queue (riderLocationCore) and is flushed with the
// next one that gets through.
//
// How it runs, by platform:
//   build (dev or store)  OS task (TaskManager) with Android's foreground-
//                         service notification — keeps going when the app
//                         is backgrounded or the phone is locked
//   Expo Go, web          foreground watch only; the rider screen says so
// plus a 15 s heartbeat while the app is open, so a parked rider still
// reports in (the OS's 20 m distance filter sends nothing when still).
//
// Kill switch: TRACKING_ENABLED (ship a build with tracking off) and the
// server's flag (setServerAllowed) — either one off asks for no permission,
// starts nothing and sends nothing.

import { AppState, Platform } from 'react-native';
import Constants, { ExecutionEnvironment } from 'expo-constants';
import { SERVICE_PALETTES } from '@theme/services';
import { DISTANCE_FILTER_METERS, HEARTBEAT_MS, enqueue, fixFromPosition, shouldSend, type RiderFix } from './riderLocationCore';

export type { RiderFix } from './riderLocationCore';

export const RIDER_LOCATION_TASK = 'metromatrix-rider-location';

/** The build-time kill switch (FinMatrix's TRACKING_ENABLED). */
const TRACKING_ENABLED = true;

export interface RiderLocationTransport {
  /** The live path (the socket). Resolves true when the server took the fixes. */
  sendLive(fixes: RiderFix[]): Promise<boolean>;
  /** The fallback path (REST batch). Throws when it fails too. */
  sendBatch(fixes: RiderFix[]): Promise<void>;
}

export type TrackingMode = 'off' | 'disabled' | 'denied' | 'foreground' | 'background';

export interface RiderLocationState {
  mode: TrackingMode;
  lastFix: RiderFix | null;
  lastSentAt: string | null;
  queued: number;
}

export interface PermissionResult {
  foreground: boolean;
  background: boolean;
}

type ExpoLocation = typeof import('expo-location');

const location = (): ExpoLocation => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  return require('expo-location') as ExpoLocation;
};

/** Background tracking needs a build: not on web, not in Expo Go. */
export const supportsBackgroundTracking = (): boolean =>
  Platform.OS !== 'web' && Constants.executionEnvironment !== ExecutionEnvironment.StoreClient;

class RiderLocation {
  private holders = 0;
  private serverAllowed = true;
  private transport: RiderLocationTransport | null = null;
  private queue: RiderFix[] = [];
  private lastSent: RiderFix | null = null;
  private heartbeat: ReturnType<typeof setInterval> | null = null;
  private watch: { remove(): void } | null = null;
  private sending = false;
  private state: RiderLocationState = { mode: 'off', lastFix: null, lastSentAt: null, queued: 0 };
  private listeners = new Set<(s: RiderLocationState) => void>();

  get current(): RiderLocationState {
    return this.state;
  }

  subscribe(listener: (s: RiderLocationState) => void): () => void {
    this.listeners.add(listener);
    listener(this.state);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private set(next: Partial<RiderLocationState>) {
    this.state = { ...this.state, ...next };
    this.listeners.forEach(l => l(this.state));
  }

  private get enabled() {
    return TRACKING_ENABLED && this.serverAllowed;
  }

  setTransport(transport: RiderLocationTransport | null) {
    this.transport = transport;
    if (transport) void this.flush();
  }

  /** The server's kill switch (GET /food/rider/me). Off stops tracking at once. */
  setServerAllowed(allowed: boolean) {
    this.serverAllowed = allowed;
    if (!allowed) void this.halt('disabled');
  }

  /** What the rider has granted, without asking. */
  async permissions(): Promise<PermissionResult> {
    if (Platform.OS === 'web') return { foreground: true, background: false };
    try {
      const L = location();
      const fg = await L.getForegroundPermissionsAsync();
      const bg = supportsBackgroundTracking() ? await L.getBackgroundPermissionsAsync() : { status: 'denied' };
      return { foreground: fg.status === 'granted', background: bg.status === 'granted' };
    } catch {
      return { foreground: false, background: false };
    }
  }

  /**
   * Ask, after the app's own explanation (the rider screen shows it first —
   * Google Play requires a prominent disclosure before the background ask).
   */
  async requestPermissions(): Promise<PermissionResult> {
    if (!this.enabled) return { foreground: false, background: false };
    if (Platform.OS === 'web') return { foreground: true, background: false };
    try {
      const L = location();
      const fg = await L.requestForegroundPermissionsAsync();
      if (fg.status !== 'granted') return { foreground: false, background: false };
      if (!supportsBackgroundTracking()) return { foreground: true, background: false };
      const bg = await L.requestBackgroundPermissionsAsync().catch(() => ({ status: 'denied' }));
      return { foreground: true, background: bg.status === 'granted' };
    } catch {
      return { foreground: false, background: false };
    }
  }

  /** Start (or join) tracking. Returns the mode it runs in. */
  async start(): Promise<TrackingMode> {
    this.holders += 1;
    if (!this.enabled) {
      this.set({ mode: 'disabled' });
      return 'disabled';
    }
    if (this.state.mode === 'foreground' || this.state.mode === 'background') return this.state.mode;

    const perms = await this.permissions();
    if (!perms.foreground) {
      this.set({ mode: 'denied' });
      return 'denied';
    }
    const mode: TrackingMode = perms.background && (await this.startOsTask()) ? 'background' : 'foreground';
    if (mode === 'foreground') await this.startWatch();
    this.set({ mode });

    void this.sendNow();
    this.heartbeat ??= setInterval(() => {
      if (AppState.currentState === 'active') void this.sendNow();
    }, HEARTBEAT_MS);
    return mode;
  }

  /** Leave tracking; the last holder stops it. */
  async stop(): Promise<void> {
    this.holders = Math.max(0, this.holders - 1);
    if (this.holders > 0) return;
    await this.halt('off');
  }

  private async halt(mode: TrackingMode) {
    if (this.heartbeat) clearInterval(this.heartbeat);
    this.heartbeat = null;
    try {
      this.watch?.remove();
    } catch {
      /* already gone */
    }
    this.watch = null;
    if (supportsBackgroundTracking()) {
      try {
        const L = location();
        if (await L.hasStartedLocationUpdatesAsync(RIDER_LOCATION_TASK).catch(() => false)) {
          await L.stopLocationUpdatesAsync(RIDER_LOCATION_TASK);
        }
      } catch {
        /* the task is already gone */
      }
    }
    this.set({ mode });
  }

  private async startOsTask(): Promise<boolean> {
    try {
      const L = location();
      if (!(await L.hasStartedLocationUpdatesAsync(RIDER_LOCATION_TASK).catch(() => false))) {
        await L.startLocationUpdatesAsync(RIDER_LOCATION_TASK, {
          accuracy: L.Accuracy.High,
          timeInterval: HEARTBEAT_MS,
          distanceInterval: DISTANCE_FILTER_METERS,
          pausesUpdatesAutomatically: false,
          showsBackgroundLocationIndicator: true,
          activityType: L.ActivityType.AutomotiveNavigation,
          foregroundService: {
            notificationTitle: 'MetroMatrix — on duty',
            notificationBody: 'Sharing your location with your vendor while you deliver.',
            notificationColor: SERVICE_PALETTES.light.food.accent,
          },
        });
      }
      return true;
    } catch {
      return false;
    }
  }

  private async startWatch() {
    if (this.watch) return;
    if (Platform.OS === 'web') {
      // The browser's own watch: expo-location's web subscription can't be
      // removed in SDK 54 (LocationEventEmitter.removeSubscription is missing).
      const geo = typeof navigator !== 'undefined' ? navigator.geolocation : undefined;
      if (!geo) return;
      const id = geo.watchPosition(
        pos => void this.ingest(fixFromPosition({ coords: pos.coords, timestamp: pos.timestamp })),
        () => undefined,
        { enableHighAccuracy: true, maximumAge: HEARTBEAT_MS },
      );
      this.watch = { remove: () => geo.clearWatch(id) };
      return;
    }
    try {
      const L = location();
      this.watch = await L.watchPositionAsync(
        { accuracy: L.Accuracy.High, timeInterval: HEARTBEAT_MS, distanceInterval: DISTANCE_FILTER_METERS },
        pos => void this.ingest(fixFromPosition(pos)),
      );
    } catch {
      this.watch = null;
    }
  }

  /** One fix now, sent past the distance gate (the heartbeat, a status change). */
  async sendNow(): Promise<RiderFix | null> {
    if (!this.enabled || this.state.mode === 'off' || this.state.mode === 'denied') return null;
    try {
      const pos = await location().getCurrentPositionAsync({ accuracy: location().Accuracy.High });
      const fix = fixFromPosition(pos);
      await this.ingest(fix, true);
      return fix;
    } catch {
      return null;
    }
  }

  /**
   * A fix from the OS (the watch, sendNow) — ignored once tracking is off.
   * `fromTask`: the background task, which also runs after the OS relaunches
   * the app with this service fresh (mode 'off') and must still send.
   */
  async ingest(fix: RiderFix, force = false, fromTask = false): Promise<void> {
    const tracking = this.state.mode === 'foreground' || this.state.mode === 'background';
    if (!tracking && !fromTask) return;
    this.set({ lastFix: fix });
    if (!this.enabled || !shouldSend(this.lastSent, fix, force)) return;
    this.queue = enqueue(this.queue, fix);
    this.set({ queued: this.queue.length });
    await this.flush();
  }

  /** Send everything waiting: live first, then the REST batch; keep it if both fail. */
  private async flush() {
    if (this.sending || !this.transport || this.queue.length === 0) return;
    this.sending = true;
    const batch = this.queue;
    try {
      let sent = await this.transport.sendLive(batch).catch(() => false);
      if (!sent) {
        sent = await this.transport
          .sendBatch(batch)
          .then(() => true)
          .catch(() => false);
      }
      if (sent) {
        this.queue = this.queue.slice(batch.length);
        this.lastSent = batch[batch.length - 1];
        this.set({ lastSentAt: new Date().toISOString(), queued: this.queue.length });
      }
    } finally {
      this.sending = false;
    }
  }
}

export const riderLocation = new RiderLocation();
