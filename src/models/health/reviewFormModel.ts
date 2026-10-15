// MetroMatrix — Rate a visit (after a completed appointment).

import type { ConsultKind, DoctorReviewInput, ReviewDimension } from '../../types/health';
import type { ValidationErrors } from '../authModel';

export const DIMENSIONS: { key: ReviewDimension; label: string; clinicOnly: boolean }[] = [
  { key: 'diagnosis', label: 'Diagnosis', clinicOnly: false },
  { key: 'staff', label: 'Staff', clinicOnly: true },
  { key: 'environment', label: 'Clinic environment', clinicOnly: true },
];

export const dimensionsFor = (kind: ConsultKind) => DIMENSIONS.filter(d => !d.clinicOnly || kind === 'clinic');

export const REVIEW_TAGS = [
  'No waiting time',
  'Great experience',
  'Explained clearly',
  'Listened carefully',
  'Friendly staff',
  'On time',
  'Clean clinic',
  'Good follow-up',
];

export const RATING_WORDS = ['', 'Poor', 'Fair', 'Good', 'Very good', 'Excellent'];
export const MAX_REVIEW_TEXT = 1000;

export const emptyDoctorReview = (): DoctorReviewInput => ({
  rating: 0,
  recommend: true,
  dimensions: {},
  tags: [],
  text: null,
  anonymous: true,
});

export const validateDoctorReview = (r: DoctorReviewInput): ValidationErrors => {
  const errors: ValidationErrors = {};
  if (!Number.isInteger(r.rating) || r.rating < 1 || r.rating > 5) errors.rating = 'Tap a star rating';
  for (const [k, v] of Object.entries(r.dimensions)) {
    if (v !== undefined && (!Number.isInteger(v) || v < 1 || v > 5)) errors[`dimension.${k}`] = 'Choose 1 to 5 stars';
  }
  if ((r.text ?? '').length > MAX_REVIEW_TEXT) errors.text = 'Keep it under 1,000 characters';
  return errors;
};

export const MAX_REPLY = 600;

export const validateReply = (text: string): ValidationErrors => {
  const t = text.trim();
  if (t.length < 2) return { reply: 'Write a reply' };
  if (t.length > MAX_REPLY) return { reply: `Keep it under ${MAX_REPLY} characters` };
  return {};
};
