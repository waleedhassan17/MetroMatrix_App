// The one live connection: held while someone needs it, rooms joined again
// and REST resynced after every reconnect, a refused token refreshed before
// trying again, backing off between attempts.

import { BACKOFF_MS, LINGER_MS, RealtimeClient, type SocketLike } from '../realtime/socketClient';

class FakeSocket implements SocketLike {
  connected = false;
  active = false;
  connects = 0;
  emitted: { event: string; payload: unknown }[] = [];
  ackFor: (event: string, payload: any) => unknown = () => ({ ok: true });
  private listeners = new Map<string, Set<(...a: any[]) => void>>();

  on(event: string, fn: (...a: any[]) => void) {
    if (!this.listeners.has(event)) this.listeners.set(event, new Set());
    this.listeners.get(event)!.add(fn);
  }
  off(event: string, fn: (...a: any[]) => void) {
    this.listeners.get(event)?.delete(fn);
  }
  fire(event: string, ...args: unknown[]) {
    this.listeners.get(event)?.forEach(fn => fn(...args));
  }
  connect() {
    this.connects += 1;
    this.active = true;
  }
  disconnect() {
    this.connected = false;
    this.active = false;
  }
  emit(event: string, payload: unknown) {
    this.emitted.push({ event, payload });
  }
  async emitWithAck(event: string, payload: unknown) {
    this.emitted.push({ event, payload });
    return this.ackFor(event, payload);
  }
  /** The server accepted the handshake. */
  up() {
    this.connected = true;
    this.fire('connect');
  }
  /** The line dropped; socket.io keeps retrying by itself. */
  drop() {
    this.connected = false;
    this.fire('disconnect', 'transport close');
  }
}

const flush = () => new Promise(r => setImmediate(r));

const setup = () => {
  const sockets: FakeSocket[] = [];
  const refresh = jest.fn(async () => 'new-token');
  const client = new RealtimeClient(() => {
    const s = new FakeSocket();
    sockets.push(s);
    return s;
  }, refresh);
  const statuses: string[] = [];
  client.onStatus(s => statuses.push(s));
  return { client, sockets, refresh, statuses };
};

beforeEach(() => jest.useFakeTimers({ doNotFake: ['setImmediate', 'nextTick', 'queueMicrotask'] }));
afterEach(() => jest.useRealTimers());

describe('the live connection', () => {
  it('opens for its first holder, joins rooms and resyncs on connect', async () => {
    const { client, sockets, statuses } = setup();
    const resync = jest.fn();
    client.onResync(resync);
    const results: [boolean, string | null][] = [];
    const leave = client.joinRoom({ key: 'order:1', payload: { orderId: 'o1' }, onResult: (ok, code) => results.push([ok, code]) });

    const release = client.acquire();
    expect(sockets).toHaveLength(1);
    expect(sockets[0].connects).toBe(1);
    expect(statuses).toEqual(['connecting']);

    sockets[0].up();
    await flush();
    expect(statuses).toEqual(['connecting', 'connected']);
    expect(sockets[0].emitted).toEqual([{ event: 'subscribe', payload: { orderId: 'o1' } }]);
    expect(results).toEqual([[true, null]]);
    expect(resync).toHaveBeenCalledTimes(1);

    leave();
    expect(sockets[0].emitted[1]).toEqual({ event: 'unsubscribe', payload: { orderId: 'o1' } });
    release();
  });

  it('after a drop, rejoins every room and resyncs again', async () => {
    const { client, sockets, statuses } = setup();
    const resync = jest.fn();
    client.onResync(resync);
    client.joinRoom({ key: 'order:1', payload: { orderId: 'o1' } });
    client.acquire();
    sockets[0].up();
    await flush();

    sockets[0].drop();
    expect(statuses[statuses.length - 1]).toBe('reconnecting');
    sockets[0].up(); // socket.io reconnected by itself
    await flush();
    expect(sockets[0].emitted.filter(e => e.event === 'subscribe')).toHaveLength(2);
    expect(resync).toHaveBeenCalledTimes(2);
  });

  it("reports a refused room (another person's order)", async () => {
    const { client, sockets } = setup();
    client.acquire();
    sockets[0].ackFor = () => ({ ok: false, code: 'NOT_FOUND' });
    const results: [boolean, string | null][] = [];
    client.joinRoom({ key: 'order:x', payload: { orderId: 'x' }, onResult: (ok, code) => results.push([ok, code]) });
    sockets[0].up();
    await flush();
    expect(results).toEqual([[false, 'NOT_FOUND']]);
  });

  it('refreshes the token after an UNAUTHORIZED handshake, then reconnects with backoff', async () => {
    const { client, sockets, refresh } = setup();
    client.acquire();
    const s = sockets[0];
    s.active = false; // a refused handshake stops socket.io's own retries
    s.fire('connect_error', Object.assign(new Error('UNAUTHORIZED'), { data: { code: 'UNAUTHORIZED' } }));
    expect(refresh).not.toHaveBeenCalled();
    jest.advanceTimersByTime(BACKOFF_MS[0]);
    await flush();
    expect(refresh).toHaveBeenCalledTimes(1);
    expect(s.connects).toBe(2);

    // A second refusal waits longer.
    s.active = false;
    s.fire('connect_error', Object.assign(new Error('UNAUTHORIZED'), { data: { code: 'UNAUTHORIZED' } }));
    jest.advanceTimersByTime(BACKOFF_MS[0]);
    await flush();
    expect(s.connects).toBe(2);
    jest.advanceTimersByTime(BACKOFF_MS[1] - BACKOFF_MS[0]);
    await flush();
    expect(s.connects).toBe(3);
  });

  it('stops trying when the refresh fails (signed out)', async () => {
    const { client, sockets, refresh, statuses } = setup();
    refresh.mockRejectedValueOnce(new Error('signed out'));
    client.acquire();
    sockets[0].active = false;
    sockets[0].fire('connect_error', Object.assign(new Error('TOKEN_EXPIRED'), { data: { code: 'TOKEN_EXPIRED' } }));
    jest.advanceTimersByTime(BACKOFF_MS[0]);
    await flush();
    expect(statuses[statuses.length - 1]).toBe('idle');
    expect(sockets[0].connects).toBe(1);
  });

  it('stops for good when the account is off (ACCOUNT_DISABLED)', async () => {
    const { client, sockets, refresh, statuses } = setup();
    client.acquire();
    sockets[0].active = false;
    sockets[0].fire('connect_error', Object.assign(new Error('ACCOUNT_DISABLED'), { data: { code: 'ACCOUNT_DISABLED' } }));
    jest.advanceTimersByTime(BACKOFF_MS[BACKOFF_MS.length - 1] * 2);
    await flush();
    expect(statuses[statuses.length - 1]).toBe('idle');
    expect(sockets[0].connects).toBe(1);
    expect(refresh).not.toHaveBeenCalled();
  });

  it('delivers events to every listener, and lingers after the last holder leaves', async () => {
    const { client, sockets, statuses } = setup();
    const a = jest.fn();
    const b = jest.fn();
    const offA = client.on('order.updated', a);
    client.on('order.updated', b);
    const r1 = client.acquire();
    const r2 = client.acquire();
    sockets[0].up();
    sockets[0].fire('order.updated', { code: 'FC-1', rev: 2 });
    expect(a).toHaveBeenCalledWith({ code: 'FC-1', rev: 2 });
    expect(b).toHaveBeenCalledTimes(1);
    offA();
    sockets[0].fire('order.updated', { code: 'FC-1', rev: 3 });
    expect(a).toHaveBeenCalledTimes(1);
    expect(b).toHaveBeenCalledTimes(2);

    r1();
    r2();
    jest.advanceTimersByTime(LINGER_MS - 1);
    expect(statuses[statuses.length - 1]).toBe('connected');
    const r3 = client.acquire(); // a new screen within the linger keeps it
    jest.advanceTimersByTime(LINGER_MS);
    expect(statuses[statuses.length - 1]).toBe('connected');
    r3();
    jest.advanceTimersByTime(LINGER_MS);
    expect(statuses[statuses.length - 1]).toBe('idle');
    expect(sockets).toHaveLength(1);
  });

  it('sends with an ack only while connected', async () => {
    const { client, sockets } = setup();
    client.acquire();
    expect(await client.send('rider.location', { fixes: [] })).toBe(false);
    sockets[0].up();
    sockets[0].ackFor = () => ({ accepted: 1 });
    expect(await client.send('rider.location', { fixes: [] })).toEqual({ accepted: 1 });
  });
});
