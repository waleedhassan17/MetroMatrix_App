// The dummy Food live channel speaks as the API's gateway: a kitchen gets
// board.sync on connect and order.new when a customer checks out; only an
// order's customer (or its kitchen) may join its room; a move sends the
// customer the new view and the kitchen a card; a failed write sends
// nothing; the minute jobs say what they did.

import { addToFoodCartAPI } from '../../../food/cartNetwork';
import { placeFoodOrderAPI } from '../../../food/ordersNetwork';
import { acceptOrderAPI } from '../../../food/vendor/ordersNetwork';
import { clearTokens } from '../../../../utils/storageUtils';
import { getDb, resetMockDb } from '../mockDb';
import { createMockSocket } from '../mockRealtime';
import { getItemSheetAPI } from '../../../food/discoveryNetwork';
import type { SocketLike } from '../../../../services/realtime/socketClient';
import { signInAs, installDummyApi } from '../testing';
import { foodOrderSerializer, vendorFoodOrderSerializer } from '../../../../serializers/food/orderSerializer';
import { required } from '../../apiHelpers';

installDummyApi();

const until = async (check: () => boolean, ms = 3000) => {
  const end = Date.now() + ms;
  while (!check()) {
    if (Date.now() > end) throw new Error('timed out');
    await new Promise(r => setTimeout(r, 10));
  }
};

const asCustomer = async () => {
  await clearTokens();
  await signInAs('customer@metromatrix.app');
};
const asVendor = async () => {
  await clearTokens();
  await signInAs('cloudkitchen@metromatrix.app');
};

/** A connected socket for whoever is signed in now, recording what it hears. */
const listen = async () => {
  const s = createMockSocket();
  const heard: { event: string; payload: any }[] = [];
  for (const e of ['board.sync', 'order.new', 'order.updated', 'order.payment']) s.on(e, (p: unknown) => heard.push({ event: e, payload: p }));
  s.connect();
  await until(() => s.connected);
  return { s, heard };
};

const order = async () => {
  await addToFoodCartAPI({ vendorId: 'fb_cloud', itemId: 'mi_classic_smash', variantId: 'mi_classic_smash_v1', optionIds: [], quantity: 1, notes: null });
  return required(foodOrderSerializer(await placeFoodOrderAPI({ addressId: 'ad_customer_home', paymentMethod: 'cod', promoCode: null, cutlery: false, note: null, building: null, floor: null, riderInstructions: null }, `k-${Math.random()}`)));
};

let sockets: SocketLike[] = [];

beforeAll(() => {
  // Smash Lab is open until 3 AM: 9 PM in Pakistan on a Thursday.
  jest.useFakeTimers({ doNotFake: ['setTimeout', 'setInterval', 'setImmediate', 'nextTick', 'queueMicrotask'] });
});
afterAll(() => jest.useRealTimers());

beforeEach(async () => {
  jest.setSystemTime(new Date('2026-10-15T16:00:00Z').getTime());
  await resetMockDb();
});
afterEach(() => {
  sockets.forEach(s => s.disconnect());
  sockets = [];
});

it('gives the kitchen its board on connect, and rings it for a new order', async () => {
  await asVendor();
  const kitchen = await listen();
  sockets.push(kitchen.s);
  await until(() => kitchen.heard.some(h => h.event === 'board.sync'));
  expect(kitchen.heard[0].payload).toMatchObject({ orders: expect.any(Array) });

  await asCustomer();
  const o = await order();
  await until(() => kitchen.heard.some(h => h.event === 'order.new'));
  expect(kitchen.heard.find(h => h.event === 'order.new')!.payload.order).toMatchObject({ id: o.id, code: o.code, status: 'placed', itemsSummary: '1× Classic Smash' });
});

it('lets only the order’s customer into its room, and tells them each move', async () => {
  await asVendor();
  const kitchen = await listen();
  await asCustomer();
  const customer = await listen();
  sockets.push(kitchen.s, customer.s);
  const o = await order();

  expect(await customer.s.emitWithAck('subscribe', { orderId: 'fo_someone_else' }, 1000)).toEqual({ ok: false, code: 'NOT_FOUND' });
  expect(await customer.s.emitWithAck('subscribe', { orderId: o.id }, 1000)).toEqual({ ok: true, orderId: o.id });

  // A refused move says nothing.
  await asVendor();
  await expect(acceptOrderAPI(o.id, 2).then(raw => required(vendorFoodOrderSerializer(raw)))).rejects.toMatchObject({ code: 'VALIDATION_FAILED' });
  await new Promise(r => setTimeout(r, 30));
  expect(customer.heard.filter(h => h.event === 'order.updated')).toHaveLength(0);

  await acceptOrderAPI(o.id, 20);
  await until(() => customer.heard.some(h => h.event === 'order.updated'));
  const toCustomer = customer.heard.find(h => h.event === 'order.updated')!.payload;
  expect(toCustomer).toMatchObject({ orderId: o.id, code: o.code, status: 'accepted' });
  expect(toCustomer.order).toMatchObject({ code: o.code, status: 'accepted', eta: { minutes: 20 } });
  // The kitchen gets the board card, not the customer's view.
  await until(() => kitchen.heard.some(h => h.event === 'order.updated'));
  expect(kitchen.heard.find(h => h.event === 'order.updated')!.payload.order).toMatchObject({ id: o.id, status: 'accepted', itemCount: 1 });
});

it('says when an order wasn’t answered in time', async () => {
  await asCustomer();
  const customer = await listen();
  sockets.push(customer.s);
  const o = await order();
  await customer.s.emitWithAck('subscribe', { orderId: o.id }, 1000);
  jest.setSystemTime(Date.now() + 6 * 60_000);
  // Any Food request runs the minute jobs.
  await getItemSheetAPI('mi_classic_smash');
  await until(() => customer.heard.some(h => h.event === 'order.updated'));
  expect(customer.heard.find(h => h.event === 'order.updated')!.payload).toMatchObject({ status: 'auto_rejected' });
  expect((await getDb()).food.orders.find(x => x.id === o.id)!.status).toBe('auto_rejected');
});
