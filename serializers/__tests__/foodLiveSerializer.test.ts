// The Food socket's events (as the API's gateway sends them) through the
// live serializers: hints only, so anything malformed is null.

import real from './fixtures/food/orders.json';
import {
  boardSyncSerializer,
  liveBoardUpdateSerializer,
  liveCustomerUpdateSerializer,
  liveNewOrderSerializer,
  livePaymentSerializer,
  riderFixSerializer,
} from '../food/liveSerializer';

type Captured = Record<string, { body: { data?: any } }>;
const R = real as unknown as Captured;
const card = R.boardNew.body.data.items[0];
const view = R.accept.body.data;
const head = { orderId: view.id, code: view.code, status: 'accepted' };

describe('live events', () => {
  it('reads order.new and board.sync as board cards', () => {
    expect(liveNewOrderSerializer({ order: card })).toMatchObject({ code: card.code, status: 'placed', itemsSummary: '3× Chicken Biryani' });
    const sync = boardSyncSerializer({ at: '2026-10-17T19:41:01.000Z', orders: [card, { nonsense: true }] })!;
    expect(sync.orders).toHaveLength(1);
  });

  it('reads order.updated: the customer’s view in the order’s room, a card on the board', () => {
    const toCustomer = liveCustomerUpdateSerializer({ ...head, order: view })!;
    expect(toCustomer).toMatchObject({ orderId: view.id, status: 'accepted' });
    expect(toCustomer.order).toMatchObject({ status: 'accepted', eta: { minutes: expect.any(Number) } });
    const toKitchen = liveBoardUpdateSerializer({ ...head, order: { ...card, status: 'accepted' } })!;
    expect(toKitchen.order).toMatchObject({ code: card.code, status: 'accepted' });
  });

  it('reads order.payment and rider.location', () => {
    expect(livePaymentSerializer({ ...head, paymentStatus: 'proof_submitted', paymentMethod: 'transfer' })).toMatchObject({ paymentStatus: 'proof_submitted', paymentMethod: 'transfer' });
    expect(riderFixSerializer({ orderId: 'o1', lat: 31.5125, lng: 74.343, heading: 90, speed: 4.2, at: '2026-10-17T19:41:01.564Z' })).toEqual({
      orderId: 'o1',
      lat: 31.5125,
      lng: 74.343,
      heading: 90,
      at: '2026-10-17T19:41:01.564Z',
    });
  });

  it('drops what it can’t read', () => {
    expect(liveCustomerUpdateSerializer({ orderId: 'x', status: 'teleported' })).toBeNull();
    expect(riderFixSerializer({ orderId: 'o1', lat: 'north' })).toBeNull();
    expect(liveNewOrderSerializer(null)).toBeNull();
  });
});
