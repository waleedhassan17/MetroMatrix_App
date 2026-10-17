// ═══════════════════════════════════════════════════════
// MetroMatrix — the dummy API's live connection
// ═══════════════════════════════════════════════════════
// An in-process stand-in for the API's socket.io server, used while no
// backend URL is set (services/realtime/socketClient.ts picks it). It speaks
// the same surface (SocketLike) and checks the same session tokens as the
// dummy REST API, so live screens run unchanged in Expo Go and on the web.
//
// The dummy Food API registers what the server does with a client's events
// (`mockRealtime.handle('subscribe', …)` checks who may join an order's
// room) and pushes events with `mockRealtime.emitToRoom(room, event, data)`
// after a write. Every socket joins `user:<id>` on connect.

import type { SocketLike } from '../../../services/realtime/socketClient';
import { getAccessToken } from '../../../utils/storageUtils';
import { getDb, type MockDb, type MockUser } from './mockDb';

export interface MockSocketCtx {
  db: MockDb;
  user: MockUser;
  join(room: string): void;
  leave(room: string): void;
}

/** What the server does with a client event; the return value is the ack. */
export type MockSocketHandler = (ctx: MockSocketCtx, payload: any) => unknown | Promise<unknown>;

type Listener = (...args: any[]) => void;

/** Lets the event loop turn, as a network would. */
const tick = () => new Promise<void>(resolve => setTimeout(resolve, 0));

class MockSocket implements SocketLike {
  connected = false;
  active = false;
  user: MockUser | null = null;
  readonly rooms = new Set<string>();
  private listeners = new Map<string, Set<Listener>>();

  constructor(private readonly server: MockRealtimeServer) {}

  on(event: string, fn: Listener) {
    let set = this.listeners.get(event);
    if (!set) {
      set = new Set();
      this.listeners.set(event, set);
    }
    set.add(fn);
  }

  off(event: string, fn: Listener) {
    this.listeners.get(event)?.delete(fn);
  }

  fire(event: string, ...args: unknown[]) {
    this.listeners.get(event)?.forEach(fn => fn(...args));
  }

  connect() {
    if (this.connected) return;
    this.active = true;
    void (async () => {
      await tick();
      const [token, db] = await Promise.all([getAccessToken(), getDb()]);
      const session = token ? db.access[token] : undefined;
      const user = session && session.expiresAt > Date.now() ? db.users.find(u => u.id === session.userId) : undefined;
      if (!user) {
        // A refused handshake: socket.io stops retrying, the client refreshes.
        this.active = false;
        this.fire('connect_error', Object.assign(new Error('UNAUTHORIZED'), { data: { code: session ? 'TOKEN_EXPIRED' : 'UNAUTHORIZED' } }));
        return;
      }
      this.user = user;
      this.rooms.add(`user:${user.id}`);
      this.connected = true;
      this.server.attach(this);
      this.fire('connect');
    })();
  }

  disconnect() {
    const was = this.connected;
    this.connected = false;
    this.active = false;
    this.rooms.clear();
    this.server.detach(this);
    if (was) this.fire('disconnect', 'io client disconnect');
  }

  emit(event: string, payload: unknown) {
    void this.emitWithAck(event, payload);
  }

  async emitWithAck(event: string, payload: unknown): Promise<unknown> {
    await tick();
    if (!this.connected || !this.user) throw new Error('not connected');
    return this.server.dispatch(this, event, payload);
  }
}

class MockRealtimeServer {
  private sockets = new Set<MockSocket>();
  private handlers = new Map<string, MockSocketHandler>();

  attach(s: MockSocket) {
    this.sockets.add(s);
  }

  detach(s: MockSocket) {
    this.sockets.delete(s);
  }

  /** What the server does when a client emits `event`. */
  handle(event: string, handler: MockSocketHandler) {
    this.handlers.set(event, handler);
  }

  hasHandler(event: string) {
    return this.handlers.has(event);
  }

  async dispatch(s: MockSocket, event: string, payload: unknown): Promise<unknown> {
    const handler = this.handlers.get(event);
    if (!handler || !s.user) return { ok: false, code: 'UNKNOWN_EVENT' };
    const db = await getDb();
    return handler({ db, user: s.user, join: room => s.rooms.add(room), leave: room => s.rooms.delete(room) }, payload);
  }

  /** Server → every socket in `room`, on the next turn of the loop (after the write's response). */
  emitToRoom(room: string, event: string, payload: unknown) {
    const targets = [...this.sockets].filter(s => s.rooms.has(room));
    if (!targets.length) return;
    setTimeout(() => targets.forEach(s => s.connected && s.fire(event, payload)), 0);
  }

  emitToUser(userId: string, event: string, payload: unknown) {
    this.emitToRoom(`user:${userId}`, event, payload);
  }

  /** Simulate the server dropping everyone (tests, the realtime dev screen). */
  dropAll() {
    [...this.sockets].forEach(s => {
      s.connected = false;
      s.active = true;
      s.rooms.clear();
      this.detach(s);
      s.fire('disconnect', 'transport close');
      // socket.io would retry by itself: so does the stand-in.
      setTimeout(() => s.active && s.connect(), 50);
    });
  }

  get connectedCount() {
    return this.sockets.size;
  }
}

export const mockRealtime = new MockRealtimeServer();

export const createMockSocket = (): SocketLike => new MockSocket(mockRealtime);
