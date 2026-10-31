// ═══════════════════════════════════════════════════════
// useRealtime — live screens' access to the one connection
// ═══════════════════════════════════════════════════════
// Screens never touch the socket. They:
//   • listen   useRealtimeEvent(event, handler)
//   • join     useRealtimeRoom(key, payload) — joined again after reconnects
//   • resync   useRealtimeResync(refetch) — REST is the truth; this runs
//              after every connect and reconnect
//   • fall back useLiveFallback(refetch, intervalMs) — polls while the
//              connection has been down longer than motion.socketGrace
// Each hook holds the connection while mounted (the client counts holders),
// so it opens with the first live screen and closes after the last.
// The Food hooks (useOrderChannel, useVendorBoard, useRiderChannel) are
// built from these.

import { useEffect, useRef, useState } from 'react';
import { motion } from '../theme/tokens';
import { realtime } from '../services/realtime/socketClient';
import { selectRealtimeDownSince, selectRealtimeStatus } from '../store/realtimeSlice';
import { useAppSelector } from './useReduxHooks';

/** The latest value of a callback, for long-lived listeners (written after render). */
const useLatest = <T,>(value: T) => {
  const ref = useRef(value);
  useEffect(() => {
    ref.current = value;
  });
  return ref;
};

/** Keep the connection open while mounted (a screen that only needs it up). */
export const useRealtimeConnection = (enabled = true) => {
  useEffect(() => (enabled ? realtime.acquire() : undefined), [enabled]);
};

export const useRealtimeEvent = <T = unknown>(event: string, handler: (payload: T) => void, enabled = true) => {
  const latest = useLatest(handler);
  useEffect(() => {
    if (!enabled) return;
    const release = realtime.acquire();
    const off = realtime.on(event, payload => latest.current(payload as T));
    return () => {
      off();
      release();
    };
  }, [event, enabled]);
};

export interface RoomState {
  joined: boolean;
  /** The server's refusal (`NOT_FOUND` for another person's order), or `TIMEOUT`. */
  code: string | null;
}

/** Join `key`'s room with `payload`; null key = not now. */
export const useRealtimeRoom = (key: string | null, payload: Record<string, unknown> | null): RoomState => {
  const [state, setState] = useState<RoomState>({ joined: false, code: null });
  const payloadJson = JSON.stringify(payload);
  useEffect(() => {
    if (!key || !payload) return;
    let live = true;
    const release = realtime.acquire();
    const leave = realtime.joinRoom({ key, payload, onResult: (ok, code) => live && setState({ joined: ok, code }) });
    return () => {
      live = false;
      leave();
      release();
      setState({ joined: false, code: null });
    };
    // payload is compared by value (payloadJson).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, payloadJson]);
  return state;
};

/** Run `refetch` after every connect and reconnect. */
export const useRealtimeResync = (refetch: () => void, enabled = true) => {
  const latest = useLatest(refetch);
  useEffect(() => {
    if (!enabled) return;
    const release = realtime.acquire();
    const off = realtime.onResync(() => latest.current());
    return () => {
      off();
      release();
    };
  }, [enabled]);
};

/** Poll `refetch` every `intervalMs` while the connection is down (after motion.socketGrace). */
export const useLiveFallback = (refetch: () => void, intervalMs: number, enabled = true) => {
  const status = useAppSelector(selectRealtimeStatus);
  const downSince = useAppSelector(selectRealtimeDownSince);
  const latest = useLatest(refetch);
  useEffect(() => {
    if (!enabled || status === 'connected') return;
    let poll: ReturnType<typeof setInterval> | null = null;
    const elapsed = downSince ? Date.now() - Date.parse(downSince) : 0;
    const wait = setTimeout(
      () => {
        latest.current();
        poll = setInterval(() => latest.current(), intervalMs);
      },
      Math.max(0, motion.socketGrace - elapsed),
    );
    return () => {
      clearTimeout(wait);
      if (poll) clearInterval(poll);
    };
  }, [enabled, status, downSince, intervalMs]);
};

/** The connection's state for a quiet "Reconnecting…" line. */
export const useRealtimeStatus = () => useAppSelector(selectRealtimeStatus);
