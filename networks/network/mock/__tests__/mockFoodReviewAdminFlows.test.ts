// The dummy Food API's reviews, insights and staff console, through the REAL
// networks: a review only once the order arrived, and only once; the
// kitchen's reply; staff hiding a review (it leaves the rating and the
// lists); featuring and suspending a vendor; cuisines in use can't go;
// banners whose target is gone aren't shown; plan overrides take effect at
// once (rider seats, scheduled orders, insights).

import { addToFoodCartAPI, setFoodCartModeAPI } from '../../../food/cartNetwork';
import { getFoodHomeAPI, getVendorPageAPI } from '../../../food/discoveryNetwork';
import { getFoodOrderAPI, placeFoodOrderAPI } from '../../../food/ordersNetwork';
import { getKitchenReviewsAPI, reviewFoodOrderAPI } from '../../../food/reviewsNetwork';
import { acceptOrderAPI, handedExternalAPI, markDeliveredAPI, markReadyAPI, startPreparingAPI } from '../../../food/vendor/ordersNetwork';
import { getFoodInsightsAPI } from '../../../food/vendor/insightsNetwork';
import { getMyReviewsAPI, replyToReviewAPI } from '../../../food/vendor/reviewsNetwork';
import { getRidersAPI } from '../../../food/vendor/ridersNetwork';
import {
  createCuisineAPI,
  createFoodBannerAPI,
  deleteCuisineAPI,
  getAdminFoodOrderAPI,
  getAdminFoodVendorAPI,
  getFoodOverviewAPI,
  getAdminCuisinesAPI,
  getAdminFoodOrdersAPI,
  getAdminFoodReviewsAPI,
  getAdminFoodVendorsAPI,
  setFoodReviewHiddenAPI,
  setVendorFeaturedAPI,
  setVendorPlanOverridesAPI,
  setVendorSuspendedAPI,
} from '../../../admin/adminFoodNetwork';
import { ApiError, required } from '../../apiHelpers';
import { clearTokens } from '../../../../utils/storageUtils';
import { resetMockDb } from '../mockDb';
import { signInAs, installDummyApi } from '../testing';
import { foodOrderSerializer, foodCartSerializer } from '../../../../serializers/food/orderSerializer';
import { foodReviewSerializer, vendorReviewsPageSerializer, foodReviewsPageSerializer, foodInsightsSerializer } from '../../../../serializers/food/reviewSerializer';
import { vendorPageSerializer, foodHomeSerializer } from '../../../../serializers/food/discoverySerializer';
import { foodRidersSerializer } from '../../../../serializers/food/riderSerializer';
import { adminFoodReviewsPageSerializer, adminFoodVendorSerializer, adminFoodOverviewSerializer, adminFoodVendorsPageSerializer, adminFoodOrdersPageSerializer, adminFoodOrderSerializer, adminFeaturedSerializer, adminSuspensionSerializer, adminCuisinesSerializer, adminCuisineSerializer, adminFoodBannerSerializer } from '../../../../serializers/food/adminFoodSerializer';
import { vendorPlanSerializer } from '../../../../serializers/food/vendorSerializer';

installDummyApi();

// Thursday 15 October 2026, 3 PM in Pakistan: Biryani Bazaar is open.
const T0 = new Date('2026-10-15T10:00:00Z').getTime();
const HOME = { lat: 31.516, lng: 74.342 };

const failure = async (p: Promise<unknown>): Promise<ApiError> => {
  try {
    await p;
  } catch (e) {
    return e as ApiError;
  }
  throw new Error('expected the call to fail');
};

const as = async (who: 'customer' | 'vendor' | 'admin') => {
  await clearTokens();
  if (who === 'customer') await signInAs('customer@metromatrix.app');
  else if (who === 'vendor') await signInAs('restaurant@metromatrix.app');
  else {
    await signInAs('admin@metromatrix.app');
  }
};

const order = async () => {
  await as('customer');
  await addToFoodCartAPI({ vendorId: 'fb_resto', itemId: 'mi_chicken_biryani', variantId: 'mi_chicken_biryani_v1', optionIds: ['og_spice_1'], quantity: 2, notes: null });
  return required(foodOrderSerializer(await placeFoodOrderAPI({ addressId: 'ad_customer_home', paymentMethod: 'cod', promoCode: null, cutlery: false, note: null, building: null, floor: null, riderInstructions: null }, `k-${Math.random()}`)));
};

/** Placed, cooked, handed to the kitchen's own rider, delivered. */
const deliveredOrder = async () => {
  const o = await order();
  await as('vendor');
  await acceptOrderAPI(o.id, 30);
  await startPreparingAPI(o.id);
  await markReadyAPI(o.id);
  await handedExternalAPI(o.id);
  await markDeliveredAPI(o.id, null);
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
  expect((await failure(reviewFoodOrderAPI(early.code, REVIEW).then(raw => required(foodReviewSerializer(raw))))).code).toBe('REVIEW_NOT_ALLOWED');

  const o = await deliveredOrder();
  await as('customer');
  expect((required(foodOrderSerializer(await getFoodOrderAPI(o.code)))).canReview).toBe(true);
  const before = (required(vendorPageSerializer(await getVendorPageAPI('biryani-bazaar', HOME)))).ratingSummary!;
  const r = required(foodReviewSerializer(await reviewFoodOrderAPI(o.code, REVIEW)));
  expect(r).toMatchObject({ foodRating: 2, deliveryRating: 4, tags: ['hot_and_fresh'], author: null });
  expect((await failure(reviewFoodOrderAPI(o.code, REVIEW).then(raw => required(foodReviewSerializer(raw))))).code).toBe('REVIEW_EXISTS');
  expect((required(foodOrderSerializer(await getFoodOrderAPI(o.code)))).canReview).toBe(false);
  const after = (required(vendorPageSerializer(await getVendorPageAPI('biryani-bazaar', HOME)))).ratingSummary!;
  expect(after.ratingCount).toBe(before.ratingCount + 1);
  expect(after.ratingAvg).toBeLessThan(before.ratingAvg);
  expect(after.recent[0]).toMatchObject({ id: r.id, author: 'Ayesha' });

  await as('vendor');
  const waiting = required(vendorReviewsPageSerializer(await getMyReviewsAPI(true, 1, 20)));
  expect(waiting.items.map(x => x.id)).toContain(r.id);
  expect(waiting.items.find(x => x.id === r.id)!.orderCode).toBe(o.code);
  await replyToReviewAPI(r.id, 'Sorry about that, the next one is on us.');
  expect((required(vendorReviewsPageSerializer(await getMyReviewsAPI(true, 1, 20)))).items.map(x => x.id)).not.toContain(r.id);

  await as('admin');
  const low = required(adminFoodReviewsPageSerializer(await getAdminFoodReviewsAPI({ maxRating: 2 }, 1, 20)));
  expect(low.items[0]).toMatchObject({ id: r.id, orderCode: o.code, vendorId: 'fb_resto', isHidden: false });
  expect((required(adminFoodVendorSerializer(await getAdminFoodVendorAPI('fb_resto')))).complaints.map(c => c.id)).toContain(r.id);
  await setFoodReviewHiddenAPI(r.id, true, 'Contains a phone number');
  await as('customer');
  expect((required(foodReviewsPageSerializer(await getKitchenReviewsAPI('fb_resto', 1, 20)))).items.map(x => x.id)).not.toContain(r.id);
  expect((required(vendorPageSerializer(await getVendorPageAPI('biryani-bazaar', HOME)))).ratingSummary!.ratingCount).toBe(before.ratingCount);
  await as('admin');
  await setFoodReviewHiddenAPI(r.id, false, null);
  await as('customer');
  expect((required(foodReviewsPageSerializer(await getKitchenReviewsAPI('fb_resto', 1, 20)))).items.map(x => x.id)).toContain(r.id);
});

it('counts the kitchen’s recorded sales over local days', async () => {
  const o = await deliveredOrder();
  await as('vendor');
  const today = required(foodInsightsSerializer(await getFoodInsightsAPI('today')));
  expect(today.totals).toMatchObject({ orders: 1, completed: 1, recordedSales: o.totals.total });
  expect(today.days).toHaveLength(1);
  expect(today.topItems[0]).toMatchObject({ name: 'Chicken Biryani', quantity: 2 });
  expect(today.note).toMatch(/directly/);
  expect((required(foodInsightsSerializer(await getFoodInsightsAPI('7d')))).days).toHaveLength(7);
});

it('lets staff feature and suspend a vendor, and look up its orders', async () => {
  const o = await deliveredOrder();
  await as('admin');
  const overview = required(adminFoodOverviewSerializer(await getFoodOverviewAPI()));
  expect(overview.ordersToday).toBe(1);
  expect(overview.activeVendors.total).toBeGreaterThan(0);
  const restaurants = (required(adminFoodVendorsPageSerializer(await getAdminFoodVendorsAPI({ type: 'restaurant' }, 1, 20)))).items;
  expect(restaurants.map(v => v.id)).toContain('fb_resto');
  expect(restaurants.every(v => v.subType === 'restaurant')).toBe(true);
  expect((required(adminFoodVendorsPageSerializer(await getAdminFoodVendorsAPI({ q: 'restaurant@metromatrix' }, 1, 20)))).items.map(v => v.id)).toEqual(['fb_resto']);
  expect((required(adminFoodOrdersPageSerializer(await getAdminFoodOrdersAPI({ code: o.code.toLowerCase() }, 1, 20)))).items).toMatchObject([{ id: o.id, vendorId: 'fb_resto' }]);
  expect((required(adminFoodOrderSerializer(await getAdminFoodOrderAPI(o.id)))).customer).toMatchObject({ name: 'Ayesha Khan', email: 'customer@metromatrix.app' });

  expect(required(adminFeaturedSerializer(await setVendorFeaturedAPI('fb_resto', true)))).toEqual({ id: 'fb_resto', isFeatured: true });
  await as('customer');
  expect((required(vendorPageSerializer(await getVendorPageAPI('biryani-bazaar', HOME)))).isFeatured).toBe(true);

  await as('admin');
  expect((await failure(setVendorSuspendedAPI('fb_resto', true, 'x').then(raw => required(adminSuspensionSerializer(raw))))).code).toBe('VALIDATION_FAILED');
  expect(required(adminSuspensionSerializer(await setVendorSuspendedAPI('fb_resto', true, 'Food safety complaint under review')))).toMatchObject({ businessStatus: 'suspended' });
  await as('customer');
  expect((await failure(getVendorPageAPI('biryani-bazaar', HOME).then(raw => required(vendorPageSerializer(raw))))).code).toBe('NOT_FOUND');
  await as('admin');
  expect((await failure(setVendorSuspendedAPI('fb_resto', true, 'Again please').then(raw => required(adminSuspensionSerializer(raw))))).code).toBe('INVALID_TRANSITION');
  await setVendorSuspendedAPI('fb_resto', false, 'Reviewed and cleared');
  await as('customer');
  expect((required(vendorPageSerializer(await getVendorPageAPI('biryani-bazaar', HOME)))).name).toBe('Biryani Bazaar');
});

it('keeps cuisines in use and shows only banners whose target is there', async () => {
  await as('admin');
  const used = (required(adminCuisinesSerializer(await getAdminCuisinesAPI()))).find(c => c.vendors > 0)!;
  expect((await failure(deleteCuisineAPI(used.id).then(() => true as const))).code).toBe('CONFLICT');
  const fresh = required(adminCuisineSerializer(await createCuisineAPI({ name: 'Seafood', slug: 'seafood', icon: 'seafood', sort: 200 })));
  expect((await failure(createCuisineAPI({ name: 'Seafood again', slug: 'seafood', icon: '', sort: 0 }).then(raw => required(adminCuisineSerializer(raw))))).code).toBe('CONFLICT');
  expect(await deleteCuisineAPI(fresh.id)).toMatchObject({ success: true });

  const banner = { imageUrl: 'https://images.example.test/biryani-week.jpg', title: 'Biryani week', subtitle: null, city: null, startsAt: new Date(T0 - 60_000).toISOString(), endsAt: null, sort: 0, isActive: true };
  expect((await failure(createFoodBannerAPI({ ...banner, targetType: 'vendor', targetId: 'fb_nowhere', targetQuery: null }).then(raw => required(adminFoodBannerSerializer(raw))))).code).toBe('VALIDATION_FAILED');
  await createFoodBannerAPI({ ...banner, targetType: 'vendor', targetId: 'fb_resto', targetQuery: null });
  await as('customer');
  expect((required(foodHomeSerializer(await getFoodHomeAPI(HOME.lat, HOME.lng)))).banners).toMatchObject([{ title: 'Biryani week', target: { type: 'vendor', slug: 'biryani-bazaar' } }]);
  await as('admin');
  await setVendorSuspendedAPI('fb_resto', true, 'Food safety complaint under review');
  await as('customer');
  expect((required(foodHomeSerializer(await getFoodHomeAPI(HOME.lat, HOME.lng)))).banners).toEqual([]);
});

it('applies plan overrides at once: rider seats, scheduled orders, insights', async () => {
  await as('admin');
  const plan = required(vendorPlanSerializer(await setVendorPlanOverridesAPI('fb_resto', { limits: { riders: 0 }, entitlements: { preorders: false, insights: false } })));
  expect(plan.limits.riders).toBe(0);
  expect(plan.entitlements).toMatchObject({ preorders: false, insights: false, riders: true });
  expect(plan.overrides).toEqual({ limits: { riders: 0 }, entitlements: { preorders: false, insights: false } });

  await as('vendor');
  expect((required(foodRidersSerializer(await getRidersAPI()))).every(r => r.status !== 'active')).toBe(true);
  expect((await failure(getFoodInsightsAPI('today').then(raw => required(foodInsightsSerializer(raw))))).code).toBe('PLAN_LIMIT_REACHED');
  await as('customer');
  await addToFoodCartAPI({ vendorId: 'fb_resto', itemId: 'mi_chicken_biryani', variantId: 'mi_chicken_biryani_v1', optionIds: ['og_spice_1'], quantity: 1, notes: null });
  const tomorrow = new Date(T0 + 24 * 3_600_000).toISOString();
  const e = await failure(setFoodCartModeAPI({ scheduledFor: tomorrow }).then(raw => required(foodCartSerializer(raw))));
  expect([e.code, e.details]).toEqual(['SLOT_INVALID', { preorders: false }]);

  await as('admin');
  await setVendorPlanOverridesAPI('fb_resto', null);
  await as('vendor');
  expect((required(foodRidersSerializer(await getRidersAPI()))).some(r => r.status === 'active')).toBe(true);
  expect((required(foodInsightsSerializer(await getFoodInsightsAPI('today')))).totals.orders).toBe(0);
});
