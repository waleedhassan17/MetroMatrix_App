// The Food review, insights and staff-console rules (reviewModel,
// insightsModel, adminFoodModel).

import { reviewTagsFor, starShares, validateFoodReview, validateReply } from '../food/reviewModel';
import { answerTimeLabel, cancelReasonText, minutesLabel, percentLabel } from '../food/insightsModel';
import {
  actorLabel,
  cuisineSlug,
  planOverridesFrom,
  validateCuisine,
  validateFoodBanner,
  validateHideFoodReview,
  validatePlanLimits,
  validateSafetyNote,
  validateSuspendReason,
  vendorStanding,
} from '../food/adminFoodModel';
import type { AdminFoodBannerInput } from '../../types/food';

describe('rating an order', () => {
  it('needs the food’s stars; the rest is optional', () => {
    const base = { foodRating: 0, deliveryRating: null, tags: [], text: '', photos: [] };
    expect(validateFoodReview(base)).toEqual({ foodRating: 'Tap a star rating for the food' });
    expect(validateFoodReview({ ...base, foodRating: 4 })).toEqual({});
    expect(validateFoodReview({ ...base, foodRating: 4, deliveryRating: 6 }).deliveryRating).toBeDefined();
    expect(validateFoodReview({ ...base, foodRating: 4, text: 'x'.repeat(1001) }).text).toBeDefined();
    expect(validateFoodReview({ ...base, foodRating: 4, photos: ['a', 'b', 'c', 'd', 'e'] }).photos).toBe('Up to 4 photos');
  });

  it('offers the rider tag only for a delivery', () => {
    expect(reviewTagsFor('delivery')).toContain('polite_rider');
    expect(reviewTagsFor('pickup')).not.toContain('polite_rider');
    expect(reviewTagsFor('pickup')).toContain('on_time');
  });

  it('needs a short reply at least', () => {
    expect(validateReply(' ')).toEqual({ reply: 'Write a short reply' });
    expect(validateReply('Thank you')).toEqual({});
  });

  it('shares each star of the visible reviews', () => {
    const shares = starShares({ ratingAvg: 4.5, ratingCount: 120, distribution: { 5: 3, 4: 1, 3: 0, 2: 0, 1: 0 }, topTags: [], recent: [] });
    expect(shares.map(s => [s.stars, s.share])).toEqual([
      [5, 0.75],
      [4, 0.25],
      [3, 0],
      [2, 0],
      [1, 0],
    ]);
  });
});

describe('insights', () => {
  it('reads rates and times, with a dash before any data', () => {
    expect(percentLabel(0.667)).toBe('67%');
    expect(percentLabel(null)).toBe('—');
    expect(answerTimeLabel(45)).toBe('45 sec');
    expect(answerTimeLabel(240)).toBe('4 min');
    expect(minutesLabel(null)).toBe('—');
  });

  it('says why orders ended in words', () => {
    expect(cancelReasonText({ status: 'rejected', reason: 'too_busy', count: 3 })).toBe('Declined: Too busy right now');
    expect(cancelReasonText({ status: 'cancelled', reason: 'Ordered by mistake', count: 1 })).toBe('Cancelled: Ordered by mistake');
    expect(cancelReasonText({ status: 'auto_rejected', reason: '', count: 1 })).toBe('Not answered in time');
  });
});

describe('the staff console', () => {
  it('asks for reasons the API will take', () => {
    expect(validateSuspendReason('no')).toEqual({ reason: 'Give a reason' });
    expect(validateSuspendReason('Food safety complaint')).toEqual({});
    expect(validateHideFoodReview('x'.repeat(301)).reason).toBeDefined();
    expect(validateSafetyNote('ok').note).toBeDefined();
  });

  it('checks a cuisine and makes its link from the name', () => {
    expect(cuisineSlug('Ice Cream & Shakes')).toBe('ice-cream-shakes');
    expect(validateCuisine({ name: 'Seafood', slug: 'seafood', icon: 'seafood', sort: 10 })).toEqual({});
    expect(validateCuisine({ name: 'S', slug: 'Sea Food', icon: '', sort: 1000 })).toEqual({
      name: 'Give the cuisine a name',
      slug: 'Use 2–40 lowercase letters, digits or dashes',
      sort: 'A number from 0 to 999',
    });
  });

  it('checks a banner’s picture, target and dates', () => {
    const b: AdminFoodBannerInput = {
      imageUrl: '',
      title: 'Biryani week',
      subtitle: null,
      targetType: 'vendor',
      targetId: null,
      targetQuery: null,
      city: null,
      startsAt: '2026-10-20T00:00:00.000Z',
      endsAt: '2026-10-19T00:00:00.000Z',
      sort: 0,
      isActive: true,
    };
    expect(validateFoodBanner(b)).toEqual({ imageUrl: 'Add a picture', targetId: 'Choose a vendor', endsAt: 'It must end after it starts' });
    expect(validateFoodBanner({ ...b, imageUrl: 'https://x', targetType: 'search', targetQuery: ' ', endsAt: null })).toEqual({ targetQuery: 'What should it search for?' });
  });

  it('turns the plan form into overrides: only what differs from the plan', () => {
    expect(planOverridesFrom({ riders: '3', menu_items: '' }, { riders: true, insights: false })).toEqual({ limits: { riders: 3 }, entitlements: { insights: false } });
    expect(planOverridesFrom({}, { riders: true })).toEqual({});
    expect(validatePlanLimits({ riders: '501' })).toEqual({ riders: 'A whole number from 0 to 500' });
  });

  it('says where a vendor stands and who did what', () => {
    expect(vendorStanding({ businessStatus: 'suspended', branchStatus: 'active', isPaused: false })).toEqual({ label: 'Suspended', tone: 'danger' });
    expect(vendorStanding({ businessStatus: 'approved', branchStatus: 'active', isPaused: true }).label).toBe('Paused');
    expect(vendorStanding({ businessStatus: 'approved', branchStatus: 'draft', isPaused: false }).label).toBe('Setting up');
    expect(actorLabel('system')).toBe('Food Court');
    expect(actorLabel(null)).toBe('Food Court');
    expect(actorLabel('vendor')).toBe('Vendor');
  });
});
