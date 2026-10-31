// MetroMatrix — Write a review.

import type { ReviewInput } from '../../types/shopping';
import type { ValidationErrors } from '../authModel';

export const MAX_REVIEW_PHOTOS = 4;
export const MIN_REVIEW_TEXT = 10;

/** Words are needed unless photos tell the story. */
export const validateReview = (r: ReviewInput): ValidationErrors => {
  const errors: ValidationErrors = {};
  if (!Number.isInteger(r.rating) || r.rating < 1 || r.rating > 5) errors.rating = 'Tap a star rating';
  if (!r.photos.length && r.body.trim().length < MIN_REVIEW_TEXT) {
    errors.body = `Write at least ${MIN_REVIEW_TEXT} characters, or add a photo`;
  }
  if (r.body.length > 1000) errors.body = 'Keep it under 1,000 characters';
  if (r.photos.length > MAX_REVIEW_PHOTOS) errors.photos = `Up to ${MAX_REVIEW_PHOTOS} photos`;
  return errors;
};

export const RATING_WORDS = ['', 'Poor', 'Fair', 'Good', 'Very good', 'Excellent'];
