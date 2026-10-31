// Real MetroMatrix-API reviews, insights and staff-console responses
// (captured on a local backend after a delivered order) through the Food
// review and admin serializers.

import real from './fixtures/food/orders.json';
import {
  adminCuisineSerializer,
  adminCuisinesSerializer,
  adminFeaturedSerializer,
  adminFoodOrderSerializer,
  adminFoodOrdersPageSerializer,
  adminFoodOverviewSerializer,
  adminFoodReviewsPageSerializer,
  adminFoodVendorSerializer,
  adminFoodVendorsPageSerializer,
  adminHiddenSerializer,
  adminSuspensionSerializer,
} from '../food/adminFoodSerializer';
import { foodHomeSerializer, vendorPageSerializer } from '../food/discoverySerializer';
import { foodInsightsSerializer, foodReviewSerializer, foodReviewsPageSerializer, vendorReviewsPageSerializer } from '../food/reviewSerializer';
import { vendorPlanSerializer } from '../food/vendorSerializer';

type Captured = Record<string, { status: number; body: { success: boolean; data?: any; error?: any } }>;
const R = real as unknown as Captured;
const data = (k: string) => R[k].body.data;

describe('reviews', () => {
  it('reads the customer’s own review (no author) and the kitchen’s list (first names, the order)', () => {
    expect(foodReviewSerializer(data('review'))).toMatchObject({ author: null, foodRating: 5, deliveryRating: 4, tags: ['tasty', 'on_time'], vendorReply: null });
    const mine = vendorReviewsPageSerializer(data('vendorReviews'));
    expect(mine.items[0]).toMatchObject({ author: 'Ali', orderCode: expect.stringMatching(/^FC-/) });
    expect(foodReviewSerializer(data('reviewReply'))!.vendorReply).toBe('Thank you, see you again soon.');
    expect(foodReviewsPageSerializer(data('publicReviews')).items.length).toBeGreaterThan(0);
  });

  it('reads the vendor page’s rating block and the home’s banners', () => {
    const page = vendorPageSerializer(data('vendorPageWithDeal'))!;
    expect(page.ratingSummary === null || page.ratingSummary.distribution[5] >= 0).toBe(true);
    expect(foodHomeSerializer(data('homeWithBanner'))!.banners).toEqual([]);
    const adminVendor = adminFoodVendorSerializer(data('adminVendor'))!;
    expect(adminVendor.ratings).toMatchObject({ ratingAvg: 5, ratingCount: 3, distribution: { 5: 3, 1: 0 } });
    expect(adminVendor.ratings!.topTags.map(t => t.tag).sort()).toEqual(['on_time', 'tasty']);
  });
});

describe('insights', () => {
  it('reads recorded sales over local days, rates as fractions', () => {
    const i = foodInsightsSerializer(data('insights'))!;
    expect(i.range).toEqual({ from: '2026-10-12', to: '2026-10-18', timezone: 'Asia/Karachi' });
    expect(i.totals).toEqual({ orders: 12, completed: 3, recordedSales: 6210, averageOrderValue: 2070 });
    expect(i.days).toHaveLength(7);
    expect(i.acceptanceRate).toBe(0.667);
    expect(i.cancelReasons).toContainEqual({ status: 'rejected', reason: 'too_busy', count: 3 });
    expect(i.topItems[0]).toEqual({ name: 'Chicken Biryani', quantity: 9, recordedSales: 6570 });
    expect(i.repeatCustomers).toEqual({ customers: 1, repeat: 1, rate: 1 });
    expect(i.note).toMatch(/MetroMatrix holds none of it/);
  });
});

describe('the staff console', () => {
  it('reads the overview', () => {
    expect(adminFoodOverviewSerializer(data('adminOverview'))).toEqual({
      date: '2026-10-18',
      activeVendors: { restaurant: 1, cloud_kitchen: 1, home_kitchen: 1, total: 3 },
      ordersToday: 12,
      activeOrders: 0,
      acceptanceRateToday: 0.667,
      autoRejectsToday: 0,
      topCuisines: [
        { slug: 'bbq', name: 'BBQ', orders: 12 },
        { slug: 'pakistani', name: 'Pakistani', orders: 12 },
      ],
      waiting: { approvals: 0, foodSafetyChecks: 0 },
    });
  });

  it('reads vendors, one vendor in full, and the moves on it', () => {
    const list = adminFoodVendorsPageSerializer(data('adminVendors'));
    expect(list.items.map(v => v.subType).sort()).toEqual(['cloud_kitchen', 'home_kitchen', 'restaurant']);
    expect(list.items.find(v => v.subType === 'home_kitchen')).toMatchObject({ subTypeLabel: 'Home kitchen', planKey: 'community', foodSafetyCheckedAt: expect.any(String) });
    const v = adminFoodVendorSerializer(data('adminVendor'))!;
    expect(v).toMatchObject({ subType: 'restaurant', businessStatus: 'approved', suspensionReason: null, ownerEmail: 'demo.resto@metromatrix.test', complaints: [] });
    expect(v.profile!.branch.id).toBeTruthy();
    expect(v.settings!.autoRejectMinutes).toBe(5);
    expect(v.hours.length).toBeGreaterThan(0);
    expect(v.feeBands).toEqual([
      { fromKm: 0, toKm: 3, fee: 99, minOrder: 500 },
      { fromKm: 3, toKm: 6, fee: 149, minOrder: 800 },
    ]);
    expect(v.setup!.items.length).toBeGreaterThan(0);
    expect(v.plan).toMatchObject({ key: 'community', price: 0, entitlements: { riders: true, preorders: true } });
    expect(v.menu[0].items[0]).toMatchObject({ name: 'Chicken Biryani', basePrice: 650, isActive: true });
    expect(v.recentOrders[0].code).toMatch(/^FC-/);
    expect(adminFeaturedSerializer(data('adminFeature'))).toEqual({ id: v.id, isFeatured: true });
    expect(adminSuspensionSerializer(data('adminSuspend'))).toMatchObject({ businessStatus: 'suspended', suspensionReason: 'Food safety complaint under review' });
    expect(adminSuspensionSerializer(data('adminReinstate'))).toMatchObject({ businessStatus: 'approved', suspensionReason: null });
    expect(vendorPlanSerializer(data('adminPlan'))).toMatchObject({ limits: { riders: 25 }, overrides: {} });
  });

  it('reads orders for disputes, with the customer’s contact', () => {
    const rows = adminFoodOrdersPageSerializer(data('adminOrders'));
    expect(rows.items[0]).toMatchObject({ code: expect.stringMatching(/^FC-/), vendorId: expect.any(String) });
    const o = adminFoodOrderSerializer(data('adminOrder'))!;
    expect(o).toMatchObject({ status: 'delivered', customer: { name: 'Ali Raza', email: 'demo.patient1@metromatrix.test' } });
    expect(o.events.length).toBeGreaterThan(3);
  });

  it('reads review moderation, cuisines', () => {
    const r = adminFoodReviewsPageSerializer(data('adminReviews'));
    expect(r.items[0]).toMatchObject({ author: 'Ali Raza', isHidden: false, hiddenReason: null, orderCode: expect.stringMatching(/^FC-/) });
    expect(adminHiddenSerializer(data('adminReviewHide'))).toMatchObject({ isHidden: true, hiddenReason: 'Contains a phone number' });
    const cuisines = adminCuisinesSerializer(data('adminCuisines'));
    expect(cuisines[0]).toMatchObject({ slug: 'pakistani', vendors: 2, isActive: true });
    expect(adminCuisineSerializer(data('adminCuisinePost'))).toMatchObject({ name: 'Seafood', vendors: 0 });
  });
});
