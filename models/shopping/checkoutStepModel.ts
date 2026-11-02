// MetroMatrix — Checkout's three steps (the FYP's stepped checkout).
// One screen, three steps: where it goes, how each store is paid, then the
// whole order to check before placing it. A step goes on only when what it
// asks for is settled; this says why not, in plain words.

import type { CheckoutPreview } from '../shopping';

export const CHECKOUT_STEPS = ['Deliver to', 'Payment', 'Review'] as const;
export type CheckoutStep = 0 | 1 | 2;

export interface StepState {
  hasAddress: boolean;
  preview: Pick<CheckoutPreview, 'canPlace' | 'stores'> | null;
  /** The preview is being worked out again (a change hasn't settled yet). */
  stale: boolean;
}

/** Why `step` can't go on yet, or null when it can. */
export const stepBlocker = (step: CheckoutStep, s: StepState): string | null => {
  if (!s.hasAddress) return 'Add the address the stores should deliver to.';
  if (step === 0) {
    const unserved = s.preview?.stores.filter(st => st.error?.code === 'CITY_NOT_SERVED') ?? [];
    if (unserved.length) {
      return unserved.length === 1
        ? `${unserved[0].store.name} doesn't deliver to this address.`
        : `${unserved.length} stores don't deliver to this address.`;
    }
    return null;
  }
  if (!s.preview || s.stale) return 'Working out your totals…';
  if (s.preview.stores.some(st => st.error)) return 'Fix the store marked above to go on.';
  if (step === 2 && !s.preview.canPlace) return 'Go back to your bag to fix it.';
  return null;
};
