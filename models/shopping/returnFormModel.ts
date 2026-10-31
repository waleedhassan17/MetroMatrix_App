// MetroMatrix — Return request form and the return window.

import type { OrderItem, ReturnInput, ReturnReason } from '../shopping';
import type { ValidationErrors } from '../authModel';

export const MAX_RETURN_PHOTOS = 4;

export const RETURN_REASONS: { key: ReturnReason; label: string }[] = [
  { key: 'size_issue', label: 'Size or fit' },
  { key: 'damaged', label: 'Damaged' },
  { key: 'wrong_item', label: 'Wrong item' },
  { key: 'not_as_described', label: 'Not as described' },
  { key: 'changed_mind', label: 'Changed my mind' },
];

export const returnReasonLabel = (r: ReturnReason) => RETURN_REASONS.find(x => x.key === r)?.label ?? 'Other';

/** Whole days left in the return window (0 on the last day, negative after). */
export const returnDaysLeft = (endsAt: string | null, now: Date = new Date()): number | null => {
  if (!endsAt) return null;
  const ms = new Date(endsAt).getTime() - now.getTime();
  return Math.ceil(ms / (24 * 60 * 60 * 1000));
};

export const validateReturn = (input: ReturnInput, items: Pick<OrderItem, 'id' | 'returnableQuantity'>[]): ValidationErrors => {
  const errors: ValidationErrors = {};
  const chosen = input.items.filter(i => i.quantity > 0);
  if (!chosen.length) errors.items = 'Choose at least one item to return';
  for (const c of chosen) {
    const item = items.find(i => i.id === c.orderItemId);
    if (!item || c.quantity > item.returnableQuantity) errors.items = 'You can return up to the quantity you received';
  }
  if (input.details.trim().length < 10) errors.details = 'Tell the store what went wrong (10 characters or more)';
  if (input.photos.length > MAX_RETURN_PHOTOS) errors.photos = `Up to ${MAX_RETURN_PHOTOS} photos`;
  return errors;
};
