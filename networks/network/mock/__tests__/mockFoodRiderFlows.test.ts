// The dummy Food API's riders on orders, through the REAL networks: the
// kitchen gives a delivery only to its own rider on duty; the rider's steps
// (picked up only once the kitchen marked it ready), cash at the door onto
// their ledger (never more than the total), the kitchen's handover (never
// more than they hold), handing a delivery back, and location (on duty,
// their own orders) reaching the customer's tracking.

import { addToFoodCartAPI } from '../../../food/cartNetwork';
import { getFoodTrackingAPI, placeFoodOrderAPI } from '../../../food/ordersNetwork';
import { acceptOrderAPI, assignRiderAPI, markReadyAPI, startPreparingAPI } from '../../../food/vendor/ordersNetwork';
import { getRiderCashForVendorAPI, liveRidersAPI, recordHandoverAPI, suggestRidersAPI } from '../../../food/vendor/ridersNetwork';
import { declineDeliveryAPI, getRiderCashAPI, getRiderOrdersAPI, markRiderDeliveredAPI, riderStepAPI, sendLocationBatchAPI, setDutyAPI } from '../../../food/rider/riderNetwork';
import { ApiError, required } from '../../apiHelpers';
import { clearTokens } from '../../../../utils/storage_utils/storageUtils';
import { resetMockDb } from '../mockDb';
import { signInAs, installDummyApi } from '../testing';
import { foodOrderSerializer, vendorFoodOrderSerializer, foodTrackingSerializer } from '../../../../serializers/food/orderSerializer';
import { riderSuggestionsSerializer, riderDutySerializer, riderOrdersPageSerializer, riderOrderSerializer, riderCashSerializer, riderDeclinedSerializer, liveRidersSerializer, locationBatchSerializer } from '../../../../serializers/food/riderSerializer';

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
  await addToFoodCartAPI({ vendorId: 'fb_resto', itemId: 'mi_chicken_biryani', variantId: 'mi_chicken_biryani_v1', optionIds: ['og_spice_1'], quantity: 3, notes: null });
  const o = required(foodOrderSerializer(await placeFoodOrderAPI({ addressId: 'ad_customer_home', paymentMethod: 'cod', promoCode: null, cutlery: false, note: null, building: null, floor: null, riderInstructions: null }, `k-${Math.random()}`)));
  await as('vendor');
  await acceptOrderAPI(o.id, 30);
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
  expect((await failure(assignRiderAPI(o.id, 'rd_ali').then(raw => required(vendorFoodOrderSerializer(raw))))).code).toBe('RIDER_NOT_AVAILABLE');
  expect(required(riderSuggestionsSerializer(await suggestRidersAPI(o.id)))).toEqual([]);
  await as('rider');
  expect(required(riderDutySerializer(await setDutyAPI(true)))).toBe(true);
  await as('vendor');
  expect((required(riderSuggestionsSerializer(await suggestRidersAPI(o.id)))).map(r => r.fullName)).toEqual(['Ali Raza']);
  const assigned = required(vendorFoodOrderSerializer(await assignRiderAPI(o.id, 'rd_ali')));
  expect(assigned.rider).toMatchObject({ name: 'Ali Raza', step: 'assigned' });
  expect((await failure(assignRiderAPI(o.id, 'rd_someone_else').then(raw => required(vendorFoodOrderSerializer(raw))))).code).toBe('NOT_FOUND');
});

it('walks the steps: picked up only once ready; cash at the door onto the ledger; the kitchen takes it back', async () => {
  const o = await acceptedOrder();
  await as('rider');
  await setDutyAPI(true);
  await as('vendor');
  await assignRiderAPI(o.id, 'rd_ali');

  await as('rider');
  const [mine] = (required(riderOrdersPageSerializer(await getRiderOrdersAPI('active')))).items;
  expect(mine).toMatchObject({ code: o.code, riderStep: 'assigned', cashToCollect: o.totals.total });
  expect(mine.nextSteps).toEqual(['accepted_by_rider', 'declined']);
  expect((required(riderOrderSerializer(await riderStepAPI(o.id, 'accept')))).riderStep).toBe('accepted_by_rider');
  expect((await failure(riderStepAPI(o.id, 'picked-up').then(raw => required(riderOrderSerializer(raw))))).code).toBe('INVALID_TRANSITION');

  await as('vendor');
  await startPreparingAPI(o.id);
  await markReadyAPI(o.id);

  await as('rider');
  await riderStepAPI(o.id, 'arrived-branch');
  const out = required(riderOrderSerializer(await riderStepAPI(o.id, 'picked-up')));
  expect(out).toMatchObject({ status: 'on_the_way', riderStep: 'picked_up' });
  await riderStepAPI(o.id, 'arrived-customer');
  expect((await failure(markRiderDeliveredAPI(o.id, o.totals.total + 1).then(raw => required(riderOrderSerializer(raw))))).code).toBe('VALIDATION_FAILED');
  const done = required(riderOrderSerializer(await markRiderDeliveredAPI(o.id, null)));
  expect(done).toMatchObject({ status: 'delivered', codCollected: o.totals.total, cashToCollect: 0 });
  expect((required(riderCashSerializer(await getRiderCashAPI()))).balance).toBe(o.totals.total);

  await as('vendor');
  expect((await failure(recordHandoverAPI('rd_ali', o.totals.total + 1, null).then(raw => required(riderCashSerializer(raw))))).code).toBe('VALIDATION_FAILED');
  const after = required(riderCashSerializer(await recordHandoverAPI('rd_ali', 500, 'Evening handover')));
  expect(after.balance).toBe(o.totals.total - 500);
  expect(after.entries[0]).toMatchObject({ kind: 'handover', amount: -500, note: 'Evening handover' });
  expect((required(riderCashSerializer(await getRiderCashForVendorAPI('rd_ali')))).balance).toBe(o.totals.total - 500);
});

it('lets the rider hand a delivery back before pickup', async () => {
  const o = await acceptedOrder();
  await as('rider');
  await setDutyAPI(true);
  await as('vendor');
  await assignRiderAPI(o.id, 'rd_ali');
  await as('rider');
  expect(required(riderDeclinedSerializer(await declineDeliveryAPI(o.id, 'My vehicle has a problem')))).toBe(true);
  expect((required(riderOrdersPageSerializer(await getRiderOrdersAPI('active')))).items).toEqual([]);
  await as('vendor');
  expect((required(liveRidersSerializer(await liveRidersAPI())))[0].activeOrders).toEqual([]);
});

it('shares location only on duty, only for their own orders, and the customer sees it', async () => {
  const o = await acceptedOrder();
  await as('rider');
  expect((await failure(sendLocationBatchAPI([fix()]).then(raw => required(locationBatchSerializer(raw))))).code).toBe('RIDER_NOT_AVAILABLE');
  await setDutyAPI(true);
  await as('vendor');
  await assignRiderAPI(o.id, 'rd_ali');
  await startPreparingAPI(o.id);
  await markReadyAPI(o.id);
  await as('rider');
  await riderStepAPI(o.id, 'picked-up');
  expect(required(locationBatchSerializer(await sendLocationBatchAPI([fix()])))).toBe(1);

  await as('customer');
  const t = required(foodTrackingSerializer(await getFoodTrackingAPI(o.code)));
  expect(t.rider).toMatchObject({ name: 'Ali Raza', step: 'picked_up', locationLive: true, lastPosition: { lat: 31.5125, lng: 74.343 } });

  // Two minutes on, the position is no longer live: it isn't shown.
  jest.setSystemTime(T0 + 3 * 60_000);
  const stale = required(foodTrackingSerializer(await getFoodTrackingAPI(o.code)));
  expect(stale.rider).toMatchObject({ locationLive: false, lastPosition: null });

  await as('vendor');
  expect((required(liveRidersSerializer(await liveRidersAPI())))[0]).toMatchObject({ onDuty: true, locationLive: false, activeOrders: [{ code: o.code, riderStep: 'picked_up' }] });
});
