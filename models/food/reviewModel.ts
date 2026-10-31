// MetroMatrix — Food Court: rating an order, and the kitchen's reply.
// One review per order, once it was delivered or collected. The delivery
// stars go only with a delivery; the rider tag only where there was a rider.

import type { FoodFulfilment, FoodRatingSummary, FoodReviewInput, FoodReviewTag } from '../../types/food';
import type { ValidationErrors } from '../authModel';

export { RATING_WORDS } from '../shopping/reviewFormModel';

export const MAX_FOOD_REVIEW_PHOTOS = 4;
export const MAX_FOOD_REVIEW_TEXT = 1000;

export const FOOD_REVIEW_TAG_LABEL: Record<FoodReviewTag, string> = {
  tasty: 'Tasty',
  hot_and_fresh: 'Hot and fresh',
  good_portion: 'Good portion',
  well_packed: 'Well packed',
  on_time: 'On time',
  polite_rider: 'Polite rider',
  value_for_money: 'Value for money',
};

/** The tags a customer can pick for this order. */
export const reviewTagsFor = (fulfilment: FoodFulfilment): FoodReviewTag[] =>
  (Object.keys(FOOD_REVIEW_TAG_LABEL) as FoodReviewTag[]).filter(t => fulfilment === 'delivery' || t !== 'polite_rider');

export const validateFoodReview = (r: FoodReviewInput): ValidationErrors => {
  const errors: ValidationErrors = {};
  if (!Number.isInteger(r.foodRating) || r.foodRating < 1 || r.foodRating > 5) errors.foodRating = 'Tap a star rating for the food';
  if (r.deliveryRating !== null && (!Number.isInteger(r.deliveryRating) || r.deliveryRating < 1 || r.deliveryRating > 5)) errors.deliveryRating = 'Tap a star rating for the delivery';
  if (r.text.length > MAX_FOOD_REVIEW_TEXT) errors.text = 'Keep it under 1,000 characters';
  if (r.photos.length > MAX_FOOD_REVIEW_PHOTOS) errors.photos = `Up to ${MAX_FOOD_REVIEW_PHOTOS} photos`;
  return errors;
};

export const MAX_REPLY = 1000;

export const validateReply = (reply: string): ValidationErrors => {
  const t = reply.trim();
  if (t.length < 2) return { reply: 'Write a short reply' };
  if (t.length > MAX_REPLY) return { reply: 'Keep it under 1,000 characters' };
  return {};
};

/** Each star's share of the visible reviews, 5 to 1, for the bars. */
export const starShares = (s: FoodRatingSummary) => {
  const total = Math.max(1, ([5, 4, 3, 2, 1] as const).reduce((n, k) => n + s.distribution[k], 0));
  return ([5, 4, 3, 2, 1] as const).map(stars => ({ stars, count: s.distribution[stars], share: s.distribution[stars] / total }));
};

/** "128 ratings". */
export const ratingCountLabel = (count: number) => `${count.toLocaleString('en-PK')} ${count === 1 ? 'rating' : 'ratings'}`;
