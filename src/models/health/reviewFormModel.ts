// MetroMatrix — Rate a visit (after a completed appointment).

import type { ConsultKind, DoctorReviewInput, ReviewDimension } from '../../types/health';
import type { ValidationErrors } from '../authModel';

export const DIMENSIONS: { key: ReviewDimension; label: string; clinicOnly: boolean }[] = [
  { key: 'diagnosis', label: 'Diagnosis', clinicOnly: false },
  { key: 'staff', label: 'Staff', clinicOnly: true },
  { key: 'environment', label: 'Clinic environment', clinicOnly: true },
];

export const dimensionsFor = (kind: ConsultKind) => DIMENSIONS.filter(d => !d.clinicOnly || kind === 'clinic');

/** The API's seven review tags, by label (the form shows labels; the API takes the codes). */
export const REVIEW_TAG_CODES = {
  'No waiting time': 'no_wait',
  'Great experience': 'great_experience',
  'Explained clearly': 'explained_well',
  'Friendly staff': 'friendly',
  'On time': 'on_time',
  'Clean clinic': 'clean_clinic',
  'Good value': 'value_for_money',
} as const;

export type ReviewTagCode = (typeof REVIEW_TAG_CODES)[keyof typeof REVIEW_TAG_CODES];

export const REVIEW_TAGS = Object.keys(REVIEW_TAG_CODES);

const TAG_LABEL = Object.fromEntries(Object.entries(REVIEW_TAG_CODES).map(([label, code]) => [code, label])) as Record<ReviewTagCode, string>;

/** "explained_well" → "Explained clearly" (an unknown code reads as words). */
export const reviewTagLabel = (code: string): string =>
  TAG_LABEL[code as ReviewTagCode] ?? code.replace(/_/g, ' ').replace(/^./, c => c.toUpperCase());

/** The labels a patient chose, as the API's codes. */
export const reviewTagCodes = (labels: string[]): ReviewTagCode[] =>
  labels.map(l => REVIEW_TAG_CODES[l as keyof typeof REVIEW_TAG_CODES]).filter((c): c is ReviewTagCode => !!c);

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
