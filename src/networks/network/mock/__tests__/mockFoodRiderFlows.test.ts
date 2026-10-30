// The dummy Food API's riders on orders, through the REAL networks: the
// kitchen gives a delivery only to its own rider on duty; the rider's steps
// (picked up only once the kitchen marked it ready), cash at the door onto
// their ledger (never more than the total), the kitchen's handover (never
// more than they hold), handing a delivery back, and location (on duty,
// their own orders) reaching the customer's tracking.

import { addToFoodCart } from '../../../food/cartNetwork';
import { getFoodTracking, placeFoodOrder } from '../../../food/ordersNetwork';
import { acceptOrder, assignRider, markReady, startPreparing } from '../../../food/vendor/ordersNetwork';
import { getRiderCashForVendor, liveRiders, recordHandover, suggestRiders } from '../../../food/vendor/ridersNetwork';
import { declineDelivery, getRiderCash, listRiderOrders, markRiderDelivered, riderStep, sendLocationBatch, setDuty } from '../../../food/rider/riderNetwork';
import { ApiError } from '../../apiHelpers';
import { clearTokens } from '../../../../utils/storageUtils';
import { resetMockDb } from '../mockDb';
import { signInAs, installDummyApi } from '../testing';

installDummyApi();

// Thursday 15 October 2026, 3 PM in Pakistan: Biryani Bazaar is open.
const T0 = new Date('2026-10-15T10:00:00Z').getTime();

const failure = async (p: Promise<unknown>): Promise<ApiError> => {
  try {
    await p;
  } catch (e) {
    return e as ApiError;
  }
  throw new Error('expected the call to fail');
};

const as = async (who: 'customer' | 'vendor' | 'rider') => {
  await clearTokens();
  if (who === 'customer') await signInAs('customer@metromatrix.app');
  else if (who === 'vendor') await signInAs('restaurant@metromatrix.app');
  else await signInAs('biryani-bazaar.ali');
};

const fix = (lat = 31.5125, lng = 74.343) => ({ lat, lng, heading: null, speed: null, accuracy: null, at: new Date(Date.now()).toISOString() });

/** A cash order, accepted by the kitchen. */
const acceptedOrder = async () => {
  await as('customer');
  await addToFoodCart({ vendorId: 'fb_resto', itemId: 'mi_chicken_biryani', variantId: 'mi_chicken_biryani_v1', optionIds: ['og_spice_1'], quantity: 3, notes: null });
  const o = await placeFoodOrder(
    { addressId: 'ad_customer_home', paymentMethod: 'cod', promoCode: null, cutlery: false, note: null, building: null, floor: null, riderInstructions: null },
    `k-${Math.random()}`,
  );
  await as('vendor');
  await acceptOrder(o.id, 30);
  return o;
};

beforeAll(() => {
  jest.useFakeTimers({ doNotFake: ['setTimeout', 'setInterval', 'setImmediate', 'nextTick', 'queueMicrotask'] });
});
afterAll(() => jest.useRealTimers());

beforeEach(async () => {
  jest.setSystemTime(T0);
  await resetMockDb();
});

it('gives a delivery only to its own rider on duty, fewest deliveries first', async () => {
  const o = await acceptedOrder();
  expect((await failure(assignRider(o.id, 'rd_ali'))).code).toBe('RIDER_NOT_AVAILABLE');
  expect(await suggestRiders(o.id)).toEqual([]);
  await as('rider');
  expect(await setDuty(true)).toBe(true);
  await as('vendor');
  expect((await suggestRiders(o.id)).map(r => r.fullName)).toEqual(['Ali Raza']);
  const assigned = await assignRider(o.id, 'rd_ali');
  expect(assigned.rider).toMatchObject({ name: 'Ali Raza', step: 'assigned' });
  expect((await failure(assignRider(o.id, 'rd_someone_else'))).code).toBe('NOT_FOUND');
});

it('walks the steps: picked up only once ready; cash at the door onto the ledger; the kitchen takes it back', async () => {
  const o = await acceptedOrder();
  await as('rider');
  await setDuty(true);
  await as('vendor');
  await assignRider(o.id, 'rd_ali');

  await as('rider');
  const [mine] = (await listRiderOrders('active')).items;
  expect(mine).toMatchObject({ code: o.code, riderStep: 'assigned', cashToCollect: o.totals.total });
  expect(mine.nextSteps).toEqual(['accepted_by_rider', 'declined']);
  expect((await riderStep(o.id, 'accept')).riderStep).toBe('accepted_by_rider');
  expect((await failure(riderStep(o.id, 'picked-up'))).code).toBe('INVALID_TRANSITION');

  await as('vendor');
  await startPreparing(o.id);
  await markReady(o.id);

  await as('rider');
  await riderStep(o.id, 'arrived-branch');
  const out = await riderStep(o.id, 'picked-up');
  expect(out).toMatchObject({ status: 'on_the_way', riderStep: 'picked_up' });
  await riderStep(o.id, 'arrived-customer');
  expect((await failure(markRiderDelivered(o.id, o.totals.total + 1))).code).toBe('VALIDATION_FAILED');
  const done = await markRiderDelivered(o.id, null);
  expect(done).toMatchObject({ status: 'delivered', codCollected: o.totals.total, cashToCollect: 0 });
  expect((await getRiderCash()).balance).toBe(o.totals.total);

  await as('vendor');
  expect((await failure(recordHandover('rd_ali', o.totals.total + 1, null))).code).toBe('VALIDATION_FAILED');
  const after = await recordHandover('rd_ali', 500, 'Evening handover');
  expect(after.balance).toBe(o.totals.total - 500);
  expect(after.entries[0]).toMatchObject({ kind: 'handover', amount: -500, note: 'Evening handover' });
  expect((await getRiderCashForVendor('rd_ali')).balance).toBe(o.totals.total - 500);
});

it('lets the rider hand a delivery back before pickup', async () => {
  const o = await acceptedOrder();
  await as('rider');
  await setDuty(true);
  await as('vendor');
  await assignRider(o.id, 'rd_ali');
  await as('rider');
  expect(await declineDelivery(o.id, 'My vehicle has a problem')).toBe(true);
  expect((await listRiderOrders('active')).items).toEqual([]);
  await as('vendor');
  expect((await liveRiders())[0].activeOrders).toEqual([]);
});

it('shares location only on duty, only for their own orders, and the customer sees it', async () => {
  const o = await acceptedOrder();
  await as('rider');
  expect((await failure(sendLocationBatch([fix()]))).code).toBe('RIDER_NOT_AVAILABLE');
  await setDuty(true);
  await as('vendor');
  await assignRider(o.id, 'rd_ali');
  await startPreparing(o.id);
  await markReady(o.id);
  await as('rider');
  await riderStep(o.id, 'picked-up');
  expect(await sendLocationBatch([fix()])).toBe(1);

  await as('customer');
  const t = await getFoodTracking(o.code);
  expect(t.rider).toMatchObject({ name: 'Ali Raza', step: 'picked_up', locationLive: true, lastPosition: { lat: 31.5125, lng: 74.343 } });

  // Two minutes on, the position is no longer live: it isn't shown.
  jest.setSystemTime(T0 + 3 * 60_000);
  const stale = await getFoodTracking(o.code);
  expect(stale.rider).toMatchObject({ locationLive: false, lastPosition: null });

  await as('vendor');
  expect((await liveRiders())[0]).toMatchObject({ onDuty: true, locationLive: false, activeOrders: [{ code: o.code, riderStep: 'picked_up' }] });
});
