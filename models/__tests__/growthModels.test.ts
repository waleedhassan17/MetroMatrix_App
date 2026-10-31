// The 5B helpers: tiffin words, start days, the month grid and the plan
// form; the dawat form, the quote builder and a quote's card.

import { cutoffChoiceLabel, daysLabel, draftPerMeal, emptyPlanForm, monthGrid, monthLabel, periodAmountLabel, planInput, priceLabel, shiftMonth, startChoices, validatePlan } from '../kitchen/tiffinModel';
import { cateringInput, draftFromRequest, emptyCateringForm, eventLine, quoteCardData, quoteInput, quoteTotals, validateCatering, validateQuote } from '../kitchen/cateringModel';
import type { CateringQuote, CateringRequest, TiffinDay } from '../kitchen';

describe('tiffin words', () => {
  it('says days, prices and credit plainly', () => {
    expect(daysLabel([1, 2, 3, 4, 5])).toBe('Mon to Fri');
    expect(daysLabel([1, 3, 5])).toBe('Mon, Wed, Fri');
    expect(daysLabel([1, 2, 3, 4, 5, 6, 7])).toBe('Every day');
    expect(priceLabel({ price: 2300, period: 'week' })).toBe('Rs 2,300 a week');
    expect(priceLabel({ price: 10800, period: 'month' })).toBe('Rs 10,800 for 4 weeks');
    expect(periodAmountLabel({ amount: 1840, credit: 1 }, 460)).toBe('Rs 1,840 (Rs 460 off for 1 skipped meal)');
    expect(cutoffChoiceLabel(14, '12:30')).toBe('14 hours before (10:30 PM, the day before)');
    expect(cutoffChoiceLabel(4, '19:30')).toBe('4 hours before (3:30 PM, that day)');
  });

  it('offers plan days from the earliest open one', () => {
    expect(startChoices({ days: [1, 2, 3, 4, 5], nextStart: '2026-10-16' }, 3)).toEqual(['2026-10-16', '2026-10-19', '2026-10-20']);
    expect(startChoices({ days: [1], nextStart: null })).toEqual([]);
  });

  it('lays a month out in weeks from Monday', () => {
    const days: TiffinDay[] = Array.from({ length: 31 }, (_, n) => ({ date: `2026-10-${String(n + 1).padStart(2, '0')}`, state: 'off', dishes: [], cutoffAt: null, canSkip: false, canUnskip: false, orderCode: null }));
    const grid = monthGrid(days);
    // 1 October 2026 is a Thursday: three empty days first.
    expect(grid[0].slice(0, 4).map(d => d?.date ?? null)).toEqual([null, null, null, '2026-10-01']);
    expect(grid.every(w => w.length === 7)).toBe(true);
    expect(monthLabel('2026-10')).toBe('October 2026');
    expect([shiftMonth('2026-12', 1), shiftMonth('2026-01', -1)]).toEqual(['2027-01', '2025-12']);
  });

  it('checks the plan form and sends base values', () => {
    const f = { ...emptyPlanForm(), name: 'Office lunch tiffin', price: '2300', rotation: { 1: { itemIds: ['mi_a'], note: '' }, 2: { itemIds: [], note: 'Daal, roti' } } };
    expect(validatePlan(f).rotation).toBe('Say what is cooked on Wed, Thu, Fri');
    expect(draftPerMeal(f)).toBe(460);
    const full = { ...f, days: [1, 2], from: '12.30', to: '1330' };
    expect(validatePlan(full)).toEqual({});
    expect(planInput(full)).toMatchObject({ price: 2300, window: { from: '12:30', to: '13:30' }, rotation: [{ weekday: 1, itemIds: ['mi_a'], note: null }, { weekday: 2, itemIds: [], note: 'Daal, roti' }] });
  });
});

describe('catering', () => {
  const vendor = { minGuests: 20, earliestDate: '2026-10-17' };
  const request = (more: Partial<CateringRequest> = {}): CateringRequest => ({
    code: 'CT-AAAAAA',
    status: 'requested',
    vendor: { id: 'fb', slug: 'bb', name: 'Biryani Bazaar', logoUrl: null, phone: null },
    customer: null,
    date: '2026-10-31',
    time: '19:30',
    startsAt: '2026-10-31T14:30:00.000Z',
    guests: 60,
    eventType: 'aqiqah',
    dishes: [
      { itemId: 'mi_b', name: 'Chicken Biryani', qty: 60 },
      { itemId: null, name: 'Zarda', qty: 60 },
    ],
    budget: 45000,
    mode: 'delivery',
    address: null,
    notes: null,
    quotes: [],
    acceptedVersion: null,
    advance: null,
    balance: null,
    declineReason: null,
    cancelReason: null,
    canAccept: false,
    canCancel: true,
    canQuote: true,
    createdAt: '',
    updatedAt: '',
    ...more,
  });

  it('checks the dawat form and sends only what the API takes', () => {
    const f = { ...emptyCateringForm(), date: '2026-10-31', guests: '10', addressId: 'ad_1' };
    expect(Object.keys(validateCatering(f, vendor))).toEqual(['guests', 'dishes']);
    const ok = { ...f, guests: '60', dishes: [{ key: 'a', itemId: 'mi_b', name: 'Chicken Biryani', qty: '60' }, { key: 'b', itemId: null, name: 'Zarda', qty: '60' }] };
    expect(validateCatering(ok, vendor)).toEqual({});
    expect(cateringInput(ok, 'fb_resto')).toMatchObject({ vendorId: 'fb_resto', guests: 60, dishes: [{ itemId: 'mi_b', qty: 60 }, { name: 'Zarda', qty: 60 }], budget: null, addressId: 'ad_1' });
    expect(eventLine(request())).toBe('Aqiqah · 60 guests · Sat 31 Oct, 7:30 PM');
  });

  it('starts a quote from the request at menu prices, adds it up, and keeps it open before the event', () => {
    const d = draftFromRequest(request(), { mi_b: 520 });
    expect(d.lines.map(l => [l.name, l.qty, l.unitPrice])).toEqual([
      ['Chicken Biryani', '60', '520'],
      ['Zarda', '60', ''],
    ]);
    expect(validateQuote(d).lineErrors[d.lines[1].key]).toBe('Price each');
    const priced = { ...d, deliveryFee: '1500', lines: d.lines.map((l, n) => (n === 1 ? { ...l, unitPrice: '110' } : l)) };
    expect(quoteTotals(priced)).toMatchObject({ subtotal: 37800, total: 39300, advance: 11790 });
    const now = Date.parse('2026-10-29T10:00:00Z');
    expect(quoteInput({ ...priced, validDays: 7 }, request(), now).validUntil).toBe('2026-10-31T13:30:00.000Z');
  });

  it('marks a replaced quote with the version that replaced it', () => {
    const q: CateringQuote = { version: 1, lines: [], subtotal: 0, deliveryFee: 0, total: 0, advancePct: 30, advance: 0, validUntil: '2026-10-22T18:59:00.000Z', notes: null, createdAt: '', state: 'outdated' };
    expect(quoteCardData(q, 'Asia/Karachi', 2)).toMatchObject({ stateLabel: 'Replaced by version 2', current: false });
    expect(quoteCardData({ ...q, state: 'current' }, 'Asia/Karachi', 1)).toMatchObject({ stateLabel: 'Latest', current: true });
  });
});
