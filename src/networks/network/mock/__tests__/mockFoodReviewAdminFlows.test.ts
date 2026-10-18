// The dummy Food API's reviews, insights and staff console, through the REAL
// networks: a review only once the order arrived, and only once; the
// kitchen's reply; staff hiding a review (it leaves the rating and the
// lists); featuring and suspending a vendor; cuisines in use can't go;
// banners whose target is gone aren't shown; plan overrides take effect at
// once (rider seats, scheduled orders, insights).

import { authAdminTotp, authSignin } from '../../../auth/authNetwork';
import { addToFoodCart, setFoodCartMode } from '../../../food/cartNetwork';
import { getFoodHome, getVendorPage } from '../../../food/discoveryNetwork';
import { getFoodOrder, placeFoodOrder } from '../../../food/ordersNetwork';
import { listKitchenReviews, reviewFoodOrder } from '../../../food/reviewsNetwork';
import { acceptOrder, handedExternal, markDelivered, markReady, startPreparing } from '../../../food/vendor/ordersNetwork';
import { getFoodInsights } from '../../../food/vendor/insightsNetwork';
import { listMyReviews, replyToReview } from '../../../food/vendor/reviewsNetwork';
import { listRiders } from '../../../food/vendor/ridersNetwork';
import {
  createCuisine,
  createFoodBanner,
  deleteCuisine,
  getAdminFoodOrder,
  getAdminFoodVendor,
  getFoodOverview,
  listAdminCuisines,
  listAdminFoodOrders,
  listAdminFoodReviews,
  listAdminFoodVendors,
  setFoodReviewHidden,
  setVendorFeatured,
  setVendorPlanOverrides,
  setVendorSuspended,
} from '../../../admin/adminFoodNetwork';
import { AuthError } from '../../apiHelpers';
import { clearTokens } from '../../../../utils/storageUtils';
import { MOCK, SEED_PASSWORD, STAFF_PASSWORD } from '../mockConfig';
import { resetMockDb } from '../mockDb';

// Thursday 15 October 2026, 3 PM in Pakistan: Biryani Bazaar is open.
const T0 = new Date('2026-10-15T10:00:00Z').getTime();
const HOME = { lat: 31.516, lng: 74.342 };

const failure = async (p: Promise<unknown>): Promise<AuthError> => {
  try {
    await p;
  } catch (e) {
    return e as AuthError;
  }
  throw new Error('expected the call to fail');
};

const as = async (who: 'customer' | 'vendor' | 'admin') => {
  await clearTokens();
  if (who === 'customer') await authSignin({ email: 'customer@metromatrix.app', password: SEED_PASSWORD, portal: 'customer' });
  else if (who === 'vendor') await authSignin({ email: 'restaurant@metromatrix.app', password: SEED_PASSWORD, portal: 'partner' });
  else {
    const outcome = await authSignin({ email: 'admin@metromatrix.app', password: STAFF_PASSWORD, portal: 'admin' });
    if (outcome.kind !== 'totp') throw new Error('expected a challenge');
    await authAdminTotp(outcome.challenge.challengeToken, { code: MOCK.TOTP_CODE });
  }
};

const order = async () => {
  await as('customer');
  await addToFoodCart({ vendorId: 'fb_resto', itemId: 'mi_chicken_biryani', variantId: 'mi_chicken_biryani_v1', optionIds: ['og_spice_1'], quantity: 2, notes: null });
  return placeFoodOrder(
    { addressId: 'ad_customer_home', paymentMethod: 'cod', promoCode: null, cutlery: false, note: null, building: null, floor: null, riderInstructions: null },
    `k-${Math.random()}`,
  );
};

/** Placed, cooked, handed to the kitchen's own rider, delivered. */
const deliveredOrder = async () => {
  const o = await order();
  await as('vendor');
  await acceptOrder(o.id, 30);
  await startPreparing(o.id);
  await markReady(o.id);
  await handedExternal(o.id);
  await markDelivered(o.id, null);
  return o;
};

const REVIEW = { foodRating: 2, deliveryRating: 4, tags: ['hot_and_fresh' as const], text: 'Rice was cold.', photos: [] };

beforeAll(() => {
  jest.useFakeTimers({ doNotFake: ['setTimeout', 'setInterval', 'setImmediate', 'nextTick', 'queueMicrotask'] });
});
afterAll(() => jest.useRealTimers());

beforeEach(async () => {
  jest.setSystemTime(T0);
  await resetMockDb();
});

it('takes one review per order, once it arrived; the kitchen replies; staff can hide it', async () => {
  const early = await order();
  expect((await failure(reviewFoodOrder(early.code, REVIEW))).code).toBe('REVIEW_NOT_ALLOWED');

  const o = await deliveredOrder();
  await as('customer');
  expect((await getFoodOrder(o.code)).canReview).toBe(true);
  const before = (await getVendorPage('biryani-bazaar', HOME)).ratingSummary!;
  const r = await reviewFoodOrder(o.code, REVIEW);
  expect(r).toMatchObject({ foodRating: 2, deliveryRating: 4, tags: ['hot_and_fresh'], author: null });
  expect((await failure(reviewFoodOrder(o.code, REVIEW))).code).toBe('REVIEW_EXISTS');
  expect((await getFoodOrder(o.code)).canReview).toBe(false);
  const after = (await getVendorPage('biryani-bazaar', HOME)).ratingSummary!;
  expect(after.ratingCount).toBe(before.ratingCount + 1);
  expect(after.ratingAvg).toBeLessThan(before.ratingAvg);
  expect(after.recent[0]).toMatchObject({ id: r.id, author: 'Ayesha' });

  await as('vendor');
  const waiting = await listMyReviews(true, 1, 20);
  expect(waiting.items.map(x => x.id)).toContain(r.id);
  expect(waiting.items.find(x => x.id === r.id)!.orderCode).toBe(o.code);
  await replyToReview(r.id, 'Sorry about that, the next one is on us.');
  expect((await listMyReviews(true, 1, 20)).items.map(x => x.id)).not.toContain(r.id);

  await as('admin');
  const low = await listAdminFoodReviews({ maxRating: 2 }, 1, 20);
  expect(low.items[0]).toMatchObject({ id: r.id, orderCode: o.code, vendorId: 'fb_resto', isHidden: false });
  expect((await getAdminFoodVendor('fb_resto')).complaints.map(c => c.id)).toContain(r.id);
  await setFoodReviewHidden(r.id, true, 'Contains a phone number');
  await as('customer');
  expect((await listKitchenReviews('fb_resto', 1, 20)).items.map(x => x.id)).not.toContain(r.id);
  expect((await getVendorPage('biryani-bazaar', HOME)).ratingSummary!.ratingCount).toBe(before.ratingCount);
  await as('admin');
  await setFoodReviewHidden(r.id, false, null);
  await as('customer');
  expect((await listKitchenReviews('fb_resto', 1, 20)).items.map(x => x.id)).toContain(r.id);
});

it('counts the kitchen’s recorded sales over local days', async () => {
  const o = await deliveredOrder();
  await as('vendor');
  const today = await getFoodInsights('today');
  expect(today.totals).toMatchObject({ orders: 1, completed: 1, recordedSales: o.totals.total });
  expect(today.days).toHaveLength(1);
  expect(today.topItems[0]).toMatchObject({ name: 'Chicken Biryani', quantity: 2 });
  expect(today.note).toMatch(/directly/);
  expect((await getFoodInsights('7d')).days).toHaveLength(7);
});

it('lets staff feature and suspend a vendor, and look up its orders', async () => {
  const o = await deliveredOrder();
  await as('admin');
  const overview = await getFoodOverview();
  expect(overview.ordersToday).toBe(1);
  expect(overview.activeVendors.total).toBeGreaterThan(0);
  const restaurants = (await listAdminFoodVendors({ type: 'restaurant' }, 1, 20)).items;
  expect(restaurants.map(v => v.id)).toContain('fb_resto');
  expect(restaurants.every(v => v.subType === 'restaurant')).toBe(true);
  expect((await listAdminFoodVendors({ q: 'restaurant@metromatrix' }, 1, 20)).items.map(v => v.id)).toEqual(['fb_resto']);
  expect((await listAdminFoodOrders({ code: o.code.toLowerCase() }, 1, 20)).items).toMatchObject([{ id: o.id, vendorId: 'fb_resto' }]);
  expect((await getAdminFoodOrder(o.id)).customer).toMatchObject({ name: 'Ayesha Khan', email: 'customer@metromatrix.app' });

  expect(await setVendorFeatured('fb_resto', true)).toEqual({ id: 'fb_resto', isFeatured: true });
  await as('customer');
  expect((await getVendorPage('biryani-bazaar', HOME)).isFeatured).toBe(true);

  await as('admin');
  expect((await failure(setVendorSuspended('fb_resto', true, 'x'))).code).toBe('VALIDATION_FAILED');
  expect(await setVendorSuspended('fb_resto', true, 'Food safety complaint under review')).toMatchObject({ businessStatus: 'suspended' });
  await as('customer');
  expect((await failure(getVendorPage('biryani-bazaar', HOME))).code).toBe('NOT_FOUND');
  await as('admin');
  expect((await failure(setVendorSuspended('fb_resto', true, 'Again please'))).code).toBe('INVALID_TRANSITION');
  await setVendorSuspended('fb_resto', false, 'Reviewed and cleared');
  await as('customer');
  expect((await getVendorPage('biryani-bazaar', HOME)).name).toBe('Biryani Bazaar');
});

it('keeps cuisines in use and shows only banners whose target is there', async () => {
  await as('admin');
  const used = (await listAdminCuisines()).find(c => c.vendors > 0)!;
  expect((await failure(deleteCuisine(used.id))).code).toBe('CONFLICT');
  const fresh = await createCuisine({ name: 'Seafood', slug: 'seafood', icon: 'seafood', sort: 200 });
  expect((await failure(createCuisine({ name: 'Seafood again', slug: 'seafood', icon: '', sort: 0 }))).code).toBe('CONFLICT');
  expect(await deleteCuisine(fresh.id)).toBe(true);

  const banner = { imageUrl: 'https://images.example.test/biryani-week.jpg', title: 'Biryani week', subtitle: null, city: null, startsAt: new Date(T0 - 60_000).toISOString(), endsAt: null, sort: 0, isActive: true };
  expect((await failure(createFoodBanner({ ...banner, targetType: 'vendor', targetId: 'fb_nowhere', targetQuery: null }))).code).toBe('VALIDATION_FAILED');
  await createFoodBanner({ ...banner, targetType: 'vendor', targetId: 'fb_resto', targetQuery: null });
  await as('customer');
  expect((await getFoodHome(HOME.lat, HOME.lng)).banners).toMatchObject([{ title: 'Biryani week', target: { type: 'vendor', slug: 'biryani-bazaar' } }]);
  await as('admin');
  await setVendorSuspended('fb_resto', true, 'Food safety complaint under review');
  await as('customer');
  expect((await getFoodHome(HOME.lat, HOME.lng)).banners).toEqual([]);
});

it('applies plan overrides at once: rider seats, scheduled orders, insights', async () => {
  await as('admin');
  const plan = await setVendorPlanOverrides('fb_resto', { limits: { riders: 0 }, entitlements: { preorders: false, insights: false } });
  expect(plan.limits.riders).toBe(0);
  expect(plan.entitlements).toMatchObject({ preorders: false, insights: false, riders: true });
  expect(plan.overrides).toEqual({ limits: { riders: 0 }, entitlements: { preorders: false, insights: false } });

  await as('vendor');
  expect((await listRiders()).every(r => r.status !== 'active')).toBe(true);
  expect((await failure(getFoodInsights('today'))).code).toBe('PLAN_LIMIT_REACHED');
  await as('customer');
  await addToFoodCart({ vendorId: 'fb_resto', itemId: 'mi_chicken_biryani', variantId: 'mi_chicken_biryani_v1', optionIds: ['og_spice_1'], quantity: 1, notes: null });
  const tomorrow = new Date(T0 + 24 * 3_600_000).toISOString();
  const e = await failure(setFoodCartMode({ scheduledFor: tomorrow }));
  expect([e.code, e.details]).toEqual(['SLOT_INVALID', { preorders: false }]);

  await as('admin');
  await setVendorPlanOverrides('fb_resto', null);
  await as('vendor');
  expect((await listRiders()).some(r => r.status === 'active')).toBe(true);
  expect((await getFoodInsights('today')).totals.orders).toBe(0);
});
