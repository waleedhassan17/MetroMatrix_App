// ═══════════════════════════════════════════════════════
// MetroMatrix — the live connection
// ═══════════════════════════════════════════════════════
// One socket for the whole app (socket.io, namespace /food). Screens never
// touch it: they use the hooks in hooks/useRealtime.ts, which hold it
// (acquire/release), listen to events, join rooms and refetch on resync.
//
// Rules:
//   • connected only while someone holds it and a session exists; it lingers
//     a little after the last holder leaves, so moving between screens
//     doesn't drop and redial;
//   • the access token goes in the handshake (`auth.token`); a refusal for
//     an expired or revoked token refreshes it (the one refresh queue in
//     apiHelpers) and reconnects;
//   • reconnects back off 1, 2, 4, 8, then every 15 s;
//   • after every connect and reconnect, rooms are joined again and every
//     resync listener runs — REST is the truth, events are only hints;
//   • the status goes to realtimeSlice, which tells live screens when to
//     fall back to polling.
// The app's socket is the real API's; tests hand RealtimeClient the dummy
// API's in-process one (networks/network/mock/mockRealtime.ts).

import { io } from 'socket.io-client';
import { API_URL, getAccessToken, refreshTokens } from '../../networks/network/network';
import {
  REALTIME_AUTH_CODES,
  REALTIME_AUTH_EXPIRED,
  REALTIME_FATAL_CODES,
  REALTIME_JOIN,
  REALTIME_NAMESPACE,
  REALTIME_PATH,
} from './realtimeConfig';

export type RealtimeStatus = 'idle' | 'connecting' | 'connected' | 'reconnecting';

/** The surface the client needs: socket.io's Socket, or the dummy API's. */
export interface SocketLike {
  readonly connected: boolean;
  /** Whether the socket will retry by itself (socket.io stops after a refused handshake). */
  readonly active: boolean;
  connect(): void;
  disconnect(): void;
  on(event: string, fn: (...args: any[]) => void): void;
  off(event: string, fn: (...args: any[]) => void): void;
  emit(event: string, payload: unknown): void;
  emitWithAck(event: string, payload: unknown, timeoutMs: number): Promise<unknown>;
}

export interface RoomJoin {
  /** One room per key; joining the same key again replaces it. */
  key: string;
  payload: Record<string, unknown>;
  /** The server's answer to the join (`{ ok, code }`). */
  onResult?: (ok: boolean, code: string | null) => void;
}

/** Retry delays after a refused or dropped connection. */
export const BACKOFF_MS = [1000, 2000, 4000, 8000, 15000];
/** How long the socket stays up after its last holder leaves. */
export const LINGER_MS = 30_000;
const ACK_TIMEOUT_MS = 8000;

type Handler = (payload: any) => void;

const codeOf = (err: any): string => String(err?.data?.code ?? err?.message ?? '');

export class RealtimeClient {
  private socket: SocketLike | null = null;
  private holders = 0;
  private lingerTimer: ReturnType<typeof setTimeout> | null = null;
  private retryTimer: ReturnType<typeof setTimeout> | null = null;
  private attempts = 0;
  private handlers = new Map<string, Set<Handler>>();
  private dispatchers = new Map<string, Handler>();
  private rooms = new Map<string, RoomJoin>();
  private resyncListeners = new Set<() => void>();
  private statusListeners = new Set<(s: RealtimeStatus) => void>();
  private _status: RealtimeStatus = 'idle';

  constructor(
    private readonly createSocket: () => SocketLike,
    private readonly refresh: () => Promise<unknown>,
  ) {}

  get status(): RealtimeStatus {
    return this._status;
  }

  /** Hold the connection open; call the returned function to let go. */
  acquire(): () => void {
    this.holders += 1;
    if (this.lingerTimer) clearTimeout(this.lingerTimer);
    this.lingerTimer = null;
    this.ensureSocket();
    let released = false;
    return () => {
      if (released) return;
      released = true;
      this.holders = Math.max(0, this.holders - 1);
      if (this.holders === 0) this.lingerTimer = setTimeout(() => this.stop(), LINGER_MS);
    };
  }

  /** Close at once (sign-out): rooms and listeners stay registered for the next session. */
  stop() {
    if (this.lingerTimer) clearTimeout(this.lingerTimer);
    if (this.retryTimer) clearTimeout(this.retryTimer);
    this.lingerTimer = null;
    this.retryTimer = null;
    this.attempts = 0;
    const s = this.socket;
    this.socket = null;
    if (s) {
      this.detach(s);
      s.disconnect();
    }
    this.setStatus('idle');
  }

  on(event: string, handler: Handler): () => void {
    let set = this.handlers.get(event);
    if (!set) {
      set = new Set();
      this.handlers.set(event, set);
    }
    set.add(handler);
    if (this.socket) this.attachEvent(this.socket, event);
    return () => {
      set!.delete(handler);
    };
  }

  /** Join a room now if connected, and again after every reconnect, until the returned function runs. */
  joinRoom(room: RoomJoin): () => void {
    this.rooms.set(room.key, room);
    if (this.socket?.connected) void this.join(this.socket, room);
    return () => {
      if (this.rooms.get(room.key) !== room) return;
      this.rooms.delete(room.key);
      if (this.socket?.connected) this.socket.emit(REALTIME_JOIN.unsubscribe, room.payload);
    };
  }

  /** Runs after every connect and reconnect: refetch over REST. */
  onResync(listener: () => void): () => void {
    this.resyncListeners.add(listener);
    return () => {
      this.resyncListeners.delete(listener);
    };
  }

  onStatus(listener: (s: RealtimeStatus) => void): () => void {
    this.statusListeners.add(listener);
    return () => {
      this.statusListeners.delete(listener);
    };
  }

  /** Send with the server's ack; false when not connected or not acknowledged in time. */
  async send(event: string, payload: unknown): Promise<unknown | false> {
    if (!this.socket?.connected) return false;
    try {
      return await this.socket.emitWithAck(event, payload, ACK_TIMEOUT_MS);
    } catch {
      return false;
    }
  }

  // ─── internals ─────────────────────────────────────

  private setStatus(s: RealtimeStatus) {
    if (this._status === s) return;
    this._status = s;
    this.statusListeners.forEach(l => l(s));
  }

  private ensureSocket() {
    if (this.socket) return;
    const s = this.createSocket();
    this.socket = s;
    s.on('connect', this.onConnect);
    s.on('disconnect', this.onDisconnect);
    s.on('connect_error', this.onConnectError);
    s.on(REALTIME_AUTH_EXPIRED, this.onAuthExpired);
    this.handlers.forEach((_set, event) => this.attachEvent(s, event));
    this.setStatus('connecting');
    s.connect();
  }

  private detach(s: SocketLike) {
    s.off('connect', this.onConnect);
    s.off('disconnect', this.onDisconnect);
    s.off('connect_error', this.onConnectError);
    s.off(REALTIME_AUTH_EXPIRED, this.onAuthExpired);
    this.dispatchers.forEach((fn, event) => s.off(event, fn));
    this.dispatchers.clear();
  }

  private attachEvent(s: SocketLike, event: string) {
    if (this.dispatchers.has(event)) return;
    const dispatch: Handler = payload => this.handlers.get(event)?.forEach(h => h(payload));
    this.dispatchers.set(event, dispatch);
    s.on(event, dispatch);
  }

  private async join(s: SocketLike, room: RoomJoin) {
    try {
      const res = (await s.emitWithAck(REALTIME_JOIN.subscribe, room.payload, ACK_TIMEOUT_MS)) as
        | { ok?: boolean; code?: string }
        | undefined;
      room.onResult?.(res?.ok !== false, res?.ok === false ? String(res.code ?? 'REFUSED') : null);
    } catch {
      room.onResult?.(false, 'TIMEOUT');
    }
  }

  private onConnect = () => {
    const s = this.socket;
    if (!s) return;
    this.attempts = 0;
    this.setStatus('connected');
    this.rooms.forEach(room => void this.join(s, room));
    this.resyncListeners.forEach(l => l());
  };

  private onDisconnect = () => {
    if (!this.socket) return;
    this.setStatus('reconnecting');
    if (!this.socket.active) this.scheduleRetry(false);
  };

  private onConnectError = (err: unknown) => {
    if (!this.socket) return;
    // The account is off: no retry can fix it (REST signs the user out).
    if (REALTIME_FATAL_CODES.includes(codeOf(err))) {
      this.stop();
      return;
    }
    this.setStatus('reconnecting');
    const auth = REALTIME_AUTH_CODES.includes(codeOf(err));
    if (auth || !this.socket.active) this.scheduleRetry(auth);
  };

  private onAuthExpired = () => {
    if (!this.socket) return;
    this.socket.disconnect();
    this.scheduleRetry(true);
  };

  private scheduleRetry(refreshFirst: boolean) {
    if (this.retryTimer) return;
    const delay = BACKOFF_MS[Math.min(this.attempts, BACKOFF_MS.length - 1)];
    this.attempts += 1;
    this.retryTimer = setTimeout(async () => {
      this.retryTimer = null;
      const s = this.socket;
      if (!s) return;
      if (refreshFirst) {
        try {
          await this.refresh();
        } catch {
          // Signed out (the refresh queue emits that) — stop trying.
          this.stop();
          return;
        }
      }
      if (this.socket === s && !s.connected) s.connect();
    }, delay);
  }
}

// ─── the app's client ──────────────────────────────

const originOf = (base: string) => /^(https?:\/\/[^/]+)/i.exec(base)?.[1] ?? base;

const socketIo = (): SocketLike => {
  const s = io(`${originOf(API_URL)}${REALTIME_NAMESPACE}`, {
    path: REALTIME_PATH,
    transports: ['websocket'],
    autoConnect: false,
    reconnection: true,
    reconnectionDelay: BACKOFF_MS[0],
    reconnectionDelayMax: BACKOFF_MS[BACKOFF_MS.length - 1],
    randomizationFactor: 0.3,
    auth: cb => {
      void getAccessToken().then(token => cb({ token: token ?? '' }));
    },
  });
  return {
    get connected() {
      return s.connected;
    },
    get active() {
      return s.active;
    },
    connect: () => void s.connect(),
    disconnect: () => void s.disconnect(),
    on: (event, fn) => void s.on(event, fn),
    off: (event, fn) => void s.off(event, fn),
    emit: (event, payload) => void s.emit(event, payload),
    emitWithAck: (event, payload, timeoutMs) => s.timeout(timeoutMs).emitWithAck(event, payload),
  };
};

export const realtime = new RealtimeClient(socketIo, refreshTokens);
