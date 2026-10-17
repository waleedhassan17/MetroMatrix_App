// The dummy API's live connection: it checks the same session tokens as the
// dummy REST API, lets the server decide who joins a room, pushes events to
// a room only, and — driven through the app's real client — rejoins rooms and
// resyncs after the server drops everyone.

import { authSignin } from '../../../auth/authNetwork';
import { clearTokens } from '../../../../utils/storageUtils';
import { RealtimeClient } from '../../../../services/realtime/socketClient';
import { SEED_PASSWORD } from '../mockConfig';
import { getDb, resetMockDb } from '../mockDb';
import { createMockSocket, mockRealtime } from '../mockRealtime';

const until = async (check: () => boolean, ms = 2000) => {
  const end = Date.now() + ms;
  while (!check()) {
    if (Date.now() > end) throw new Error('timed out');
    await new Promise(r => setTimeout(r, 10));
  }
};

beforeEach(async () => {
  await resetMockDb();
  await clearTokens();
  // Only the customer's own order room may be joined.
  mockRealtime.handle('subscribe', (ctx, payload: { orderId?: string }) => {
    if (payload?.orderId !== `${ctx.user.id}-order`) return { ok: false, code: 'NOT_FOUND' };
    ctx.join(`order:${payload.orderId}`);
    return { ok: true };
  });
});

describe('the dummy live connection', () => {
  it('refuses a socket with no session, and accepts a signed-in one', async () => {
    const anon = createMockSocket();
    const errors: any[] = [];
    anon.on('connect_error', e => errors.push(e));
    anon.connect();
    await until(() => errors.length > 0);
    expect(errors[0].data.code).toBe('UNAUTHORIZED');
    expect(anon.active).toBe(false);

    await authSignin({ email: 'customer@metromatrix.app', password: SEED_PASSWORD, portal: 'customer' });
    const s = createMockSocket();
    let connected = false;
    s.on('connect', () => (connected = true));
    s.connect();
    await until(() => connected);
    expect(s.connected).toBe(true);
    s.disconnect();
  });

  it('lets the server decide who joins, and pushes only to the room', async () => {
    await authSignin({ email: 'customer@metromatrix.app', password: SEED_PASSWORD, portal: 'customer' });
    const s = createMockSocket();
    const got: unknown[] = [];
    s.on('order.updated', p => got.push(p));
    let connected = false;
    s.on('connect', () => (connected = true));
    s.connect();
    await until(() => connected);

    expect(await s.emitWithAck('subscribe', { orderId: 'someone-else' }, 1000)).toEqual({ ok: false, code: 'NOT_FOUND' });
    const userId = (s as unknown as { user: { id: string } }).user.id;
    expect(await s.emitWithAck('subscribe', { orderId: `${userId}-order` }, 1000)).toEqual({ ok: true });

    mockRealtime.emitToRoom('order:other', 'order.updated', { code: 'X' });
    mockRealtime.emitToRoom(`order:${userId}-order`, 'order.updated', { code: 'MINE' });
    await until(() => got.length > 0);
    await new Promise(r => setTimeout(r, 20));
    expect(got).toEqual([{ code: 'MINE' }]);
    s.disconnect();
  });

  it('through the real client: a server drop is followed by a rejoin and a resync', async () => {
    await authSignin({ email: 'customer@metromatrix.app', password: SEED_PASSWORD, portal: 'customer' });
    const client = new RealtimeClient(createMockSocket, async () => undefined);
    const resync = jest.fn();
    client.onResync(resync);
    const joins: boolean[] = [];
    let userId = '';
    const release = client.acquire();
    await until(() => client.status === 'connected');
    userId = (await getDb()).users.find(u => u.email === 'customer@metromatrix.app')!.id;
    client.joinRoom({ key: 'mine', payload: { orderId: `${userId}-order` }, onResult: ok => joins.push(ok) });
    await until(() => joins.length === 1);
    expect(resync).toHaveBeenCalledTimes(1);

    mockRealtime.dropAll();
    await until(() => resync.mock.calls.length === 2);
    await until(() => joins.length === 2);
    expect(joins).toEqual([true, true]);
    expect(client.status).toBe('connected');
    client.stop();
    release();
  });
});
