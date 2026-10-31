// The released Food API (MetroMatrix-API docs/API_FOOD.md, P8) on its
// `seed:food` demo, captured by scripts/capture-food-fixtures.js
// (fixtures/food/p8.json): every response the app reads goes through its
// serializer into a whole value, and the contract's rules hold in what came
// back — money is subtotal − deal + the kitchen's delivery fee and nothing
// else, riders' sessions carry no email the app would show, staff see full
// names and customers first names. (The capture keeps at most 3 rows of any list.)

import real from './fixtures/food/p8.json';
import { sessionSerializer } from '../authSerializer';
import {
  adminCuisinesSerializer,
  adminFoodOrderSerializer,
  adminFoodOrdersPageSerializer,
  adminFoodOverviewSerializer,
  adminFoodReviewsPageSerializer,
  adminFoodVendorSerializer,
  adminFoodVendorsPageSerializer,
} from '../food/adminFoodSerializer';
import { foodHomeSerializer, foodSearchSerializer, itemSheetSerializer, vendorCardsPageSerializer, vendorPageSerializer } from '../food/discoverySerializer';
import { foodFavouritesSerializer } from '../food/favouriteSerializer';
import { menuCategoriesSerializer, optionGroupsSerializer, vendorMenuItemSerializer } from '../food/menuSerializer';
import {
  boardPageSerializer,
  foodCartSerializer,
  foodOrderSerializer,
  foodOrdersPageSerializer,
  foodPreviewSerializer,
  foodPromotionsSerializer,
  foodTrackingSerializer,
  vendorFoodOrderSerializer,
} from '../food/orderSerializer';
import { foodInsightsSerializer, foodReviewSerializer, vendorReviewsPageSerializer } from '../food/reviewSerializer';
import { liveRidersSerializer, riderCashSerializer, riderHomeSerializer, riderOrderSerializer, riderSuggestionsSerializer } from '../food/riderSerializer';
import { feeBandsSerializer, hoursSerializer, vendorPlanSerializer, vendorProfileSerializer, vendorSettingsSerializer, vendorSetupSerializer } from '../food/vendorSerializer';
import type { FoodTotals } from '../../models/food';

type Captured = Record<string, { status: number; body: { success: boolean; data?: any; error?: any } }>;
const R = real as unknown as Captured;
const data = (k: string) => R[k].body.data;
const error = (k: string) => R[k].body.error;

/** The only money rule there is. */
const adds = (t: FoodTotals) => t.total === t.subtotal - t.discount + t.deliveryFee;

describe('the kitchen', () => {
  it('reads the session, setup, brand, settings, hours, zones and plan', () => {
    expect(sessionSerializer(data('resto.meAfter'))?.business?.food).toMatchObject({ brandSlug: 'qandeel-karahi-house', isLive: true, setupComplete: true });
    expect(vendorSetupSerializer(data('resto.setupAfter'))).toMatchObject({ ready: true, isLive: true });
    expect(vendorProfileSerializer(data('resto.profilePatch'))).toMatchObject({ kind: 'restaurant', name: 'Qandeel Karahi House' });
    expect(vendorSettingsSerializer(data('resto.settingsPatch'))?.location.city).toBe('Lahore');
    expect(hoursSerializer(data('resto.hoursPut')).length).toBeGreaterThan(0);
    expect(feeBandsSerializer(data('resto.feeBandsPut'))[0].fromKm).toBe(0);
    expect(vendorPlanSerializer(data('resto.plan'))).toMatchObject({ key: 'community', price: 0, entitlements: { riders: true, promotions: true, insights: true, preorders: true } });
    expect(error('resto.hoursOverlap').code).toBe('VALIDATION_FAILED');
  });

  it('reads its menu', () => {
    expect(menuCategoriesSerializer(data('menu.categories')).length).toBeGreaterThan(1);
    const dish = vendorMenuItemSerializer(data('menu.item'))!;
    expect(dish.variants.length).toBeGreaterThan(0);
    expect(dish.optionGroups.length).toBeGreaterThan(0);
    expect(optionGroupsSerializer(data('menu.groups'))[0].options.length).toBeGreaterThan(0);
  });

  it('reads a rider made for the kitchen, signed in by username', () => {
    const s = sessionSerializer(data('rider.signin'))!;
    expect(s.user.role).toBe('rider');
    expect(riderHomeSerializer(data('rider.me'))?.vendor.name).toBe('Qandeel Karahi House');
    expect(data('resto.riderReset').password).toBe('redacted');
  });
});

describe('customers browse', () => {
  it('reads the home with its banners, and a place nobody delivers to', () => {
    const home = foodHomeSerializer(data('home'))!;
    expect(home.coverage.delivering).toBe(true);
    expect(home.banners.length).toBeGreaterThan(0);
    expect(home.banners[0].target).toMatchObject({ type: 'vendor', slug: 'qandeel-karahi-house' });
    expect(home.cuisines.length).toBe(3);
    expect(foodHomeSerializer(data('homeFar'))!.coverage).toEqual({ delivering: false, message: 'Not delivering here yet', pickupNearby: 0 });
  });

  it('reads lists, a vendor page with its ratings, a dish and search', () => {
    expect(vendorCardsPageSerializer(data('vendors')).items.length).toBeGreaterThan(1);
    const page = vendorPageSerializer(data('vendorPage'))!;
    expect(page.ratingSummary).toMatchObject({ ratingCount: 9 });
    expect(page.ratingSummary!.recent[0].author).not.toMatch(/\s/);
    expect(page.menu.length).toBeGreaterThan(1);
    expect(itemSheetSerializer(data('item'))!.groups.length).toBeGreaterThan(0);
    expect(foodSearchSerializer(data('search')).dishes.length + foodSearchSerializer(data('search')).vendors.length).toBeGreaterThan(0);
  });
});

describe('ordering', () => {
  it('prices the bag, the preview and the order the same way, with no other fee', () => {
    const cart = foodCartSerializer(data('cart'))!;
    expect(cart.lines.length).toBe(1);
    const preview = foodPreviewSerializer(data('preview'))!;
    expect(adds(preview.totals)).toBe(true);
    const order = foodOrderSerializer(data('checkout'))!;
    expect(adds(order.totals)).toBe(true);
    expect(Object.keys(data('checkout').totals).sort()).toEqual(['deliveryFee', 'discount', 'subtotal', 'total']);
    expect(order.deal).toMatchObject({ title: 'Weekday lunch' });
    expect(foodOrderSerializer(data('checkoutReplay'))!.code).toBe(order.code);
    expect(error('checkoutErr').code).toBe('IDEMPOTENCY_KEY_REQUIRED');
    expect(error('cartOtherVendorErr').code).toBe('CART_OTHER_VENDOR');
    expect([error('cartAddErr').code, error('cartAddGroupErr').code]).toEqual(['OPTION_REQUIRED', 'OPTION_REQUIRED']);
  });

  it('follows the order through the kitchen and its own rider to the door', () => {
    expect(foodOrdersPageSerializer(data('ordersActive')).items.length).toBeGreaterThan(0);
    expect(foodTrackingSerializer(data('tracking'))).toMatchObject({ status: 'placed' });
    expect(boardPageSerializer(data('boardNew')).items[0].status).toBe('placed');
    expect(vendorFoodOrderSerializer(data('vendorOrder'))!.actions.status).toEqual(expect.arrayContaining(['accepted', 'rejected']));
    expect(error('acceptErr').code).toBe('VALIDATION_FAILED');
    expect(foodOrderSerializer(data('ready'))!.status).toBe('ready');
    expect(liveRidersSerializer(data('ridersLive')).length).toBeGreaterThan(0);
    expect(riderSuggestionsSerializer(data('ridersSuggest'))[0]).toMatchObject({ fullName: expect.any(String), activeOrders: 0 });
    expect(riderOrderSerializer(data('riderPickedUp'))).toMatchObject({ status: 'on_the_way', riderStep: 'picked_up' });
    expect(foodTrackingSerializer(data('trackingOnTheWay'))!.rider).toMatchObject({ step: 'picked_up', locationLive: true });
    expect(error('riderDeliveredErr').code).toBe('VALIDATION_FAILED');
    const delivered = riderOrderSerializer(data('riderDelivered'))!;
    expect(delivered.status).toBe('delivered');
    expect(riderCashSerializer(data('riderCash'))!.balance).toBeGreaterThan(0);
    expect(foodOrderSerializer(data('orderDelivered'))).toMatchObject({ status: 'delivered', canReview: true });
  });

  it('reads a transfer, cancels and the past', () => {
    expect(foodOrderSerializer(data('paymentProof'))!.payment.status).toBe('proof_submitted');
    expect(error('preparingUnpaidErr').code).toBe('PAYMENT_NOT_CONFIRMED');
    expect(foodOrderSerializer(data('cancelByVendor'))!.payment.status).toBe('refund_due');
    expect(foodOrderSerializer(data('customerCancel'))!.status).toBe('cancelled');
    expect(foodOrderSerializer(data('reject'))!.status).toBe('rejected');
    expect(foodOrdersPageSerializer(data('ordersPast')).items.length).toBeGreaterThan(0);
    expect(foodFavouritesSerializer(data('favourites'))[0].slug).toBe('smash-theory-burgers');
    expect(foodPromotionsSerializer(data('vendor.promotions')).length).toBeGreaterThan(0);
  });
});

describe('reviews, insights and staff', () => {
  it('reads a review once, the reply, and the kitchen’s numbers', () => {
    expect(foodReviewSerializer(data('review'))).toMatchObject({ foodRating: 5, deliveryRating: 4, author: null });
    expect(error('reviewErr').code).toBe('REVIEW_EXISTS');
    expect(vendorReviewsPageSerializer(data('vendorReviews')).items[0].orderCode).toMatch(/^FC-/);
    expect(foodReviewSerializer(data('reviewReply'))!.vendorReply).toBe('Thank you, see you again soon.');
    const insights = foodInsightsSerializer(data('insights'))!;
    expect(insights.range.timezone).toBe('Asia/Karachi');
    expect(insights.days[0].date).toBe(insights.range.from);
    expect(insights.totals.recordedSales).toBeGreaterThan(0);
  });

  it('reads the staff console, and a plan change that takes effect at once', () => {
    expect(adminFoodOverviewSerializer(data('adminOverview'))!.activeVendors.total).toBe(6);
    expect(adminFoodVendorsPageSerializer(data('adminVendors')).items.length).toBeGreaterThan(0);
    const v = adminFoodVendorSerializer(data('adminVendor'))!;
    expect(v).toMatchObject({ subType: 'cloud_kitchen', businessStatus: 'approved' });
    expect(v.ratings?.ratingCount).toBeGreaterThan(0);
    expect(adminFoodOrdersPageSerializer(data('adminOrders')).items[0].vendorId).toBeTruthy();
    expect(adminFoodOrderSerializer(data('adminOrder'))!.customer.name).toBe('Ayesha Khan');
    expect(adminFoodReviewsPageSerializer(data('adminReviews')).items[0].author).toMatch(/\s/);
    expect(adminCuisinesSerializer(data('adminCuisines'))[0].vendors).toBeGreaterThanOrEqual(0);
    expect(error('adminBannerPost').code).toBe('VALIDATION_FAILED');
    expect(vendorPlanSerializer(data('adminPlanPatch'))).toMatchObject({
      limits: { riders: 1 },
      entitlements: { insights: false },
      overrides: { limits: { riders: 1 }, entitlements: { insights: false } },
    });
    expect(error('insightsOffErr')).toMatchObject({ code: 'PLAN_LIMIT_REACHED', details: { entitlement: 'insights' } });
    expect(vendorPlanSerializer(data('adminPlanReset'))!.overrides).toEqual({});
  });
});
