// The Food bag, checkout and deal rules (bagModel, promotionModel).

import { bagBlocker, bagNotices, cleanCode, defaultPayment, fixOf, lineChoices, payChoices, validateCheckout, whenChoices } from '../food/bagModel';
import { dealLabel, daysLine, emptyPromotionForm, formLabel, promotionForm, promotionInput, validatePromotion, whenLine } from '../food/promotionModel';
import type { FoodPreview, FoodPromotion, FoodSlots } from '../../types/food';

// Thursday 15 October 2026, 3:10 PM in Pakistan.
const NOW = Date.parse('2026-10-15T10:10:00Z');
const issue = (code: string, details: Record<string, unknown> | null = null) => ({ code, message: code, details });

describe('the bag', () => {
  it('says a line’s size and add-ons', () => {
    expect(lineChoices({ variant: { id: 'v', name: 'Single' }, options: [{ id: 'a', name: 'Mild', group: 'Spice', priceDelta: 0 }, { id: 'b', name: 'Raita', group: 'Add', priceDelta: 60 }] })).toBe(
      'Single · Mild, Raita',
    );
    expect(lineChoices({ variant: null, options: [] })).toBe('');
  });

  it('lets the address, payment and code wait for checkout', () => {
    expect(bagBlocker({ issues: [issue('ADDRESS_LOCATION_REQUIRED'), issue('PROMO_INVALID')] })).toBeNull();
    expect(bagBlocker({ issues: [issue('ADDRESS_LOCATION_REQUIRED'), issue('VENDOR_CLOSED')] })!.code).toBe('VENDOR_CLOSED');
  });

  it('says line problems on the line, not above the bag', () => {
    const notices = bagNotices({ warnings: [issue('ITEM_UNAVAILABLE', { lineId: 'l1' }), issue('VENDOR_CLOSED'), issue('VENDOR_CLOSED'), issue('BELOW_MIN_ORDER')] });
    expect(notices.map(n => n.code)).toEqual(['VENDOR_CLOSED']);
  });

  it('knows the fix for each problem', () => {
    expect(fixOf(issue('VENDOR_CLOSED'))).toBe('schedule');
    expect(fixOf(issue('OUT_OF_ZONE'))).toBe('pickup');
    expect(fixOf(issue('OUT_OF_ZONE', { pickupAvailable: false }))).toBe('address');
    expect(fixOf(issue('PORTIONS_SOLD_OUT'))).toBe('bag');
    expect(fixOf(issue('BELOW_MIN_ORDER'))).toBe('menu');
    expect(fixOf(issue('PROMO_INVALID'))).toBe('code');
    expect(fixOf(issue('SOMETHING_NEW'))).toBeNull();
  });
});

describe('when', () => {
  it('offers half hours from at least 30 minutes ahead', () => {
    const c = whenChoices(null, NOW);
    expect(c[0]).toMatchObject({ at: '2026-10-15T11:00:00.000Z', label: 'Today · 4:00 PM', disabled: false });
    expect(Date.parse(c[1].at) - Date.parse(c[0].at)).toBe(30 * 60_000);
    expect(c[c.length - 1].label.startsWith('Tomorrow')).toBe(true);
  });

  it('starts when a closed kitchen opens', () => {
    expect(whenChoices(null, NOW, '2026-10-15T13:00:00.000Z')[0].label).toBe('Today · 6:00 PM');
  });

  it('offers a home kitchen’s own slots, full ones shown but not chosen', () => {
    const slots: FoodSlots = {
      timezone: 'Asia/Karachi',
      preorderOnly: true,
      usesSlots: true,
      slots: [
        { slotId: 's1', startsAt: '2026-10-16T08:00:00.000Z', cutoffAt: '2026-10-16T05:00:00.000Z', label: '', maxOrders: 15, remaining: 2, full: false },
        { slotId: 's2', startsAt: '2026-10-17T08:00:00.000Z', cutoffAt: '2026-10-17T05:00:00.000Z', label: '', maxOrders: 15, remaining: 0, full: true },
      ],
    };
    expect(whenChoices(slots, NOW)).toEqual([
      { at: '2026-10-16T08:00:00.000Z', label: 'Tomorrow · 1:00 PM', note: '2 left', disabled: false },
      { at: '2026-10-17T08:00:00.000Z', label: 'Sat 17 Oct · 1:00 PM', note: 'Full', disabled: true },
    ]);
  });
});

describe('paying', () => {
  const preview = (fulfilment: 'delivery' | 'pickup', available: { cod: boolean; transfer: boolean; pay_at_pickup: boolean }) =>
    ({ fulfilment, payment: { method: null, available, codLimit: 5000, accounts: [] } }) as unknown as Pick<FoodPreview, 'fulfilment' | 'payment'>;

  it('offers cash or a transfer for delivery, the counter or a transfer for pick-up', () => {
    expect(payChoices(preview('delivery', { cod: true, transfer: false, pay_at_pickup: false })).map(c => [c.method, c.available])).toEqual([
      ['cod', true],
      ['transfer', false],
    ]);
    expect(payChoices(preview('pickup', { cod: false, transfer: true, pay_at_pickup: true })).map(c => c.method)).toEqual(['pay_at_pickup', 'transfer']);
  });

  it('keeps the customer’s choice while it works, else the first that does', () => {
    const p = preview('delivery', { cod: true, transfer: true, pay_at_pickup: false });
    expect(defaultPayment(p, 'transfer')).toBe('transfer');
    expect(defaultPayment(p, 'pay_at_pickup')).toBe('cod');
    expect(defaultPayment(preview('delivery', { cod: false, transfer: false, pay_at_pickup: false }), null)).toBeNull();
  });

  it('checks the form: an address with a pin for delivery, a way to pay, a clean code', () => {
    expect(validateCheckout({ fulfilment: 'delivery', addressId: null, addressPinned: false, paymentMethod: null, promoCode: '' })).toEqual({
      address: 'Choose where to deliver.',
      paymentMethod: 'Choose how you’ll pay.',
    });
    expect(validateCheckout({ fulfilment: 'delivery', addressId: 'a', addressPinned: false, paymentMethod: 'cod', promoCode: '' }).address).toMatch(/pin/);
    expect(validateCheckout({ fulfilment: 'pickup', addressId: null, addressPinned: false, paymentMethod: 'pay_at_pickup', promoCode: 'bad code!' })).toEqual({
      promoCode: 'A code is letters, digits or dashes.',
    });
    expect(cleanCode(' bazaar 150 ')).toBe('BAZAAR150');
  });
});

describe('deals', () => {
  it('words a deal as the API does', () => {
    expect(dealLabel({ kind: 'percent_off_order', value: 10, minOrder: 500 })).toBe('10% off over Rs 500');
    expect(dealLabel({ kind: 'percent_off_items', value: 20, minOrder: 0 })).toBe('20% off selected items');
    expect(dealLabel({ kind: 'flat_off', value: 150, minOrder: 1500 })).toBe('Rs 150 off over Rs 1,500');
    expect(dealLabel({ kind: 'free_delivery', value: 0, minOrder: 0 })).toBe('Free delivery');
  });

  it('says the days in a word where it can', () => {
    expect(daysLine([0, 1, 2, 3, 4, 5, 6])).toBe('Every day');
    expect(daysLine([1, 2, 3, 4, 5])).toBe('Weekdays');
    expect(daysLine([6, 0])).toBe('Weekends');
    expect(daysLine([5, 1])).toBe('Mon, Fri');
  });

  it('checks the form with the API’s rules', () => {
    const f = { ...emptyPromotionForm(), title: 'x', value: '120', withCode: true, code: 'a b', weekdays: [], withWindow: true, timeFrom: '18:00', timeTo: '18:00' };
    expect(validatePromotion(f, '2026-10-15')).toEqual({
      title: 'Give the deal a name customers will see.',
      value: 'A percent deal is 1–100%.',
      code: 'A code is 3–20 letters, digits or dashes.',
      weekdays: 'Choose at least one day.',
      timeTo: 'The window can’t start and end together.',
    });
    expect(validatePromotion({ ...emptyPromotionForm(), title: 'Dishes', kind: 'percent_off_items' }, '2026-10-15')).toEqual({ itemIds: 'Choose the dishes this deal applies to.' });
    expect(validatePromotion({ ...emptyPromotionForm(), title: 'Old', endsOn: '2026-10-01' }, '2026-10-15').endsOn).toMatch(/past/);
    expect(validatePromotion({ ...emptyPromotionForm(), title: 'Fine' }, '2026-10-15')).toEqual({});
  });

  it('builds the request: the kind’s own fields, the code upper-cased, the end after the last day', () => {
    const input = promotionInput({ ...emptyPromotionForm(), title: ' Late night ', kind: 'flat_off', value: '100', maxDiscount: '50', withCode: true, code: 'smash100', endsOn: '2026-10-31', usageLimit: '200' });
    expect(input).toMatchObject({ title: 'Late night', kind: 'flat_off', value: 100, maxDiscount: null, code: 'SMASH100', usageLimit: 200, perUserLimit: null, itemIds: [], timeFrom: null });
    // Midnight after 31 October in Pakistan.
    expect(input.endsAt).toBe('2026-10-31T19:00:00.000Z');
    expect(promotionInput({ ...emptyPromotionForm(), kind: 'free_delivery', value: '15' }).value).toBe(0);
  });

  it('reads a saved deal back into the form', () => {
    const p: FoodPromotion = {
      id: 'p1',
      title: 'Nights',
      kind: 'percent_off_order',
      value: 10,
      itemIds: [],
      minOrder: 500,
      maxDiscount: 300,
      code: null,
      startsAt: '2026-10-01T00:00:00.000Z',
      endsAt: '2026-10-31T19:00:00.000Z',
      weekdays: [5, 6],
      timeFrom: '18:00',
      timeTo: '02:00',
      usageLimit: null,
      perUserLimit: 1,
      usedCount: 3,
      firstOrderOnly: false,
      isActive: true,
      state: 'live',
      label: '10% off over Rs 500',
    };
    const f = promotionForm(p);
    expect(f).toMatchObject({ value: '10', maxDiscount: '300', withCode: false, withWindow: true, endsOn: '2026-10-31', perUserLimit: '1', usageLimit: '' });
    expect(formLabel(f)).toBe(p.label);
    expect(whenLine(p)).toBe('Fri, Sat · 18:00–02:00 · until Sat 31 Oct');
  });
});
