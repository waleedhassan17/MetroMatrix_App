// The P2 helpers: the board's stock notes, times and pause line; waste lines;
// Bachat Box pickup times; the prep sheet, shopping list and Today's portions.

import { menuStockNote, needsPackingPhoto, pausedNote, pauseLine, quotedEta, resumeAtOf, suggestedEta, ticketStockNote } from '../kitchen/boardModel';
import { dishLine, ingredientLine, rescuedShareText, validateDonation, wasteDraftFromVoice, wasteInputOf, wasteSentence } from '../kitchen/wasteModel';
import { emptyBoxForm, pickupTimes, withPickupFrom } from '../kitchen/surplusModel';
import { barMax, dishesLine, prepGroups, purchaseDraftOf, suggestedPortions } from '../kitchen/forecastModel';
import type { BoardHints, ForecastItem } from '../../types/kitchen';

const hints = (more: Partial<BoardHints> = {}): BoardHints => ({
  lowStock: [{ itemId: 'mi_karahi', name: 'Chicken Karahi', servingsLeft: 2 }],
  soldOutByStock: [],
  prepHint: null,
  packingPhoto: 'off',
  ...more,
});

describe('the board, from stock', () => {
  it('says when a ticket’s dish is low on stock or out of it', () => {
    const card = { itemsSummary: '2× Chicken Karahi, 4× Naan', status: 'placed' as const };
    expect(ticketStockNote(card, hints())).toEqual({ label: 'Recipe stock low: Chicken Karahi, 2 left', tone: 'warning' });
    expect(ticketStockNote(card, hints({ soldOutByStock: [{ itemId: 'mi_naan', name: 'Naan' }] }))?.tone).toBe('danger');
    // A dish whose name only starts the same isn't this one; an order out of the kitchen needs no note.
    expect(ticketStockNote({ itemsSummary: '1× Chicken Karahi Half', status: 'placed' }, hints())).toBeNull();
    expect(ticketStockNote({ ...card, status: 'ready' }, hints())).toBeNull();
    expect(ticketStockNote(card, null)).toBeNull();
    expect(menuStockNote('mi_karahi', hints())).toBe('Recipe stock low: 2 left');
    expect(menuStockNote('mi_karahi', hints({ lowStock: [{ itemId: 'mi_karahi', name: 'Chicken Karahi', servingsLeft: 5 }] }))).toBeNull();
  });

  it('offers the usual prep time first, else the time quoted at checkout', () => {
    const c = { placedAt: '2026-10-19T14:00:00.000Z', promisedAt: '2026-10-19T14:42:00.000Z' };
    expect(quotedEta(c)).toBe(45);
    expect(suggestedEta(c, hints({ prepHint: { minutes: 22, label: 'Usually 22 min now' } }))).toBe(20);
    expect(suggestedEta(c, hints())).toBe(45);
  });

  it('holds Ready for a packing photo only when the kitchen requires one', () => {
    expect(needsPackingPhoto({ packedPhotoUrl: null }, 'required')).toBe(true);
    expect(needsPackingPhoto({ packedPhotoUrl: 'https://x/p.jpg' }, 'required')).toBe(false);
    expect(needsPackingPhoto({ packedPhotoUrl: null }, 'optional')).toBe(false);
  });

  it('words a pause for the kitchen, and when it lifts', () => {
    const now = Date.parse('2026-10-19T15:00:00.000Z');
    expect(resumeAtOf(60, now)).toBe('2026-10-19T16:00:00.000Z');
    expect(resumeAtOf(null, now)).toBeNull();
    expect(pauseLine({ pauseReason: 'gas', resumeAt: '2026-10-19T16:30:00.000Z' }, 'Asia/Karachi')).toBe('Gas · back by itself at 9:30 PM');
    expect(pauseLine({ pauseReason: null, resumeAt: null }, 'Asia/Karachi')).toBe('Until you resume');
    expect(pausedNote({ pauseReason: 'gas', resumeAt: '2026-10-19T16:30:00.000Z', pauseMessage: null }, 'Asia/Karachi')).toBe('Gas · back by itself at 9:30 PM. Until then, your kitchen is hidden from lists.');
  });
});

describe('waste', () => {
  const rice = { id: 'ing_rice', name: 'Basmati rice', baseUnit: 'g' as const, dozens: false, customUnits: [{ name: 'bori', base: 40000 }], costPerBase: 0.4 };
  const byId = { [rice.id]: rice };

  it('turns lines into the API’s: base units for ingredients, whole servings for dishes', () => {
    const a = { ...ingredientLine(rice), amount: '2.5' };
    const b = { ...dishLine({ itemId: 'mi_biryani', name: 'Biryani' }), amount: '6' };
    const out = wasteInputOf([a, b], 'leftover', byId);
    expect(out.input).toEqual([
      { ingredientId: 'ing_rice', qty: 2500, unit: 'g', reason: 'leftover' },
      { itemId: 'mi_biryani', qty: 6, reason: 'leftover' },
    ]);
    const bad = wasteInputOf([{ ...a, amount: '' }, { ...b, amount: '1.5' }], 'spoiled', byId);
    expect(Object.keys(bad.lineErrors)).toHaveLength(2);
    expect(wasteInputOf([], 'spoiled', byId).errors.lines).toBeTruthy();
    expect(wasteInputOf([{ ...a, amount: '1', unitKey: 'custom:bori' }], 'spoiled', byId).input[0].qty).toBe(40000);
  });

  it('keeps spoken lines the kitchen stocks', () => {
    const lines = wasteDraftFromVoice(
      [
        { ingredientId: 'ing_rice', key: 'rice', name: 'chawal', qty: 2, unit: 'kg', total: null },
        { ingredientId: null, key: null, name: 'saffron', qty: 1, unit: 'g', total: null },
      ],
      [rice],
    );
    expect(lines.map(l => [l.name, l.amount, l.unitKey])).toEqual([['Basmati rice', '2', 'kg']]);
  });

  it('says the week in a line, and checks a donation', () => {
    expect(
      wasteSentence({ range: '7d', from: '', to: '', cost: 1710, entries: 2, topReasons: [{ reason: 'leftover', cost: 1350 }], topItems: [], mealsRescued: { total: 12, inRange: 0 } }),
    ).toBe('Rs 1,710 in the last 7 days, mostly left over.');
    expect(validateDonation({ meals: '12', to: 'Edhi centre' })).toEqual({});
    expect(Object.keys(validateDonation({ meals: '0', to: 'x' }))).toEqual(['meals', 'to']);
    expect(rescuedShareText('Nani ki Handi', 1)).toContain('1 meal from');
  });
});

describe('Bachat Box pickup times', () => {
  it('offers quarter hours from now until 2 AM, and a new start keeps the window’s length', () => {
    const now = Date.parse('2026-10-19T15:07:00.000Z'); // 8:07 PM in Lahore
    const times = pickupTimes(now, 'Asia/Karachi');
    expect(times[0].label).toBe('8:15 PM');
    expect(times[times.length - 1].label).toBe('2:00 AM');
    const f = emptyBoxForm(now);
    const moved = withPickupFrom(f, times.find(t => t.label === '11:00 PM')!.iso, 'Asia/Karachi', now);
    expect(Date.parse(moved.pickupTo) - Date.parse(moved.pickupFrom)).toBe(2 * 3_600_000);
    const late = withPickupFrom(f, times.find(t => t.label === '1:00 AM')!.iso, 'Asia/Karachi', now);
    expect(late.pickupTo).toBe(times[times.length - 1].iso);
  });
});

describe('prep, shopping and Today', () => {
  const item = (more: Partial<ForecastItem>): ForecastItem => ({
    itemId: 'mi_a',
    name: 'Aloo Gosht',
    photoUrl: null,
    expected: 12,
    low: 9,
    high: 15,
    learning: false,
    adjusted: null,
    fixed: { tiffin: 0, catering: 0 },
    planned: 12,
    ...more,
  });

  it('groups the prep sheet with amounts and what each line is for', () => {
    const g = prepGroups({
      date: '2026-10-20',
      dishes: [{ itemId: 'mi_a', name: 'Aloo Gosht', servings: 12 }],
      groups: [{ key: 'meat_poultry', title: 'Meat and poultry', lines: [{ ingredientId: 'ing_mutton', name: 'Mutton', qty: 2400, baseUnit: 'g', dozens: false, forItems: ['Aloo Gosht'] }] }],
      shareText: '',
    });
    expect(g[0].lines[0]).toEqual({ id: '2026-10-20|ing_mutton', name: 'Mutton', qtyLabel: '2.4 kg', sub: 'For Aloo Gosht' });
    expect(dishesLine({ dishes: [1, 2, 3, 4].map(n => ({ itemId: `${n}`, name: `D${n}`, servings: n })) })).toBe('1 D1, 2 D2, 3 D3 and 1 more');
    expect(barMax([item({ high: 15 }), item({ adjusted: 22 })])).toBe(22);
  });

  it('turns what is left to buy into purchase lines in the units a cook buys', () => {
    const lines = purchaseDraftOf({
      date: '2026-10-20',
      estTotal: 900,
      shareText: '',
      lines: [
        { ingredientId: 'ing_onion', name: 'Onion', baseUnit: 'g', dozens: false, need: 5000, onHand: 1500, toBuy: 3500, estCost: 420 },
        { ingredientId: 'ing_egg', name: 'Eggs', baseUnit: 'pc', dozens: true, need: 24, onHand: 0, toBuy: 24, estCost: 480 },
        { ingredientId: 'ing_salt', name: 'Salt', baseUnit: 'g', dozens: false, need: 100, onHand: 900, toBuy: 0, estCost: 0 },
      ],
    });
    expect(lines.map(l => [l.name, l.qty, l.unit, l.total])).toEqual([
      ['Onion', 3.5, 'kg', 420],
      ['Eggs', 2, 'dozen', 480],
    ]);
  });

  it('offers today’s portions only where the plan differs', () => {
    const today = {
      date: '2026-10-19',
      weekday: 1,
      items: [
        { itemId: 'mi_a', name: 'Aloo Gosht', onTodaysMenu: true, cooking: true, dailyLimit: 10, remainingToday: 10, sold: 0 },
        { itemId: 'mi_b', name: 'Daal', onTodaysMenu: true, cooking: true, dailyLimit: 8, remainingToday: 8, sold: 0 },
        { itemId: 'mi_c', name: 'Kheer', onTodaysMenu: false, cooking: false, dailyLimit: null, remainingToday: null, sold: null },
      ],
    };
    const f = { date: '2026-10-19', learning: false, basisDays: 60, dishes: 3, orders: { expected: 20, low: 15, high: 25 }, items: [item({}), item({ itemId: 'mi_b', name: 'Daal', expected: 8 }), item({ itemId: 'mi_c', name: 'Kheer', expected: 5 })] };
    expect(suggestedPortions(today, f)).toEqual([{ itemId: 'mi_a', name: 'Aloo Gosht', portions: 12, current: 10 }]);
  });
});
