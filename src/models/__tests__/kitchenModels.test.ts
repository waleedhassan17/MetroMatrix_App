import { costCard, costSentence, lineCostLabel, toMake, validateRecipe, validateTarget } from '../kitchen/costingModel';
import { countsOf, defaultUnit, expiryLabel, fillOf, ingredientInput, parLabel, parseAmount, typedToBase, unitChoices, validateIngredient } from '../kitchen/stockModel';
import { draftTotal, linesFromReceipt, linesFromVoice, purchaseInput, validatePurchase } from '../kitchen/purchaseModel';
import { accuracyBadge, adjustmentLabel, dayLabel, forecastDates, plannedOf, rangeLabel } from '../kitchen/forecastModel';
import { boxInput, discountLabel, emptyBoxForm, isPickupCode, normalizeCode, validateBox } from '../kitchen/surplusModel';
import { actionTitle, actionWarnings, isUnsure } from '../kitchen/voiceModel';
import { aiDownNote, isAiDown, usageLine, usageNote } from '../kitchen/aiModel';
import { cardLook, cardTarget } from '../kitchen/insightCardModel';
import { STOCK_STATE, boxPaymentStatus } from '../kitchen/kitchenStatusModel';
import type { InsightCard } from '../../types/kitchen';

describe('cost to make', () => {
  it('divides ingredients by the servings and adds packaging per serving', () => {
    const make = toMake(
      [
        { ingredientId: 'a', qty: 500, costPerBase: 0.62 },
        { ingredientId: 'b', qty: 300, costPerBase: 0.2 },
      ],
      [{ ingredientId: 'box', qty: 1, costPerBase: 18 }],
      2,
    );
    expect(make).toBeCloseTo(155 + 30 + 18);
  });

  it('says it plainly, with the target', () => {
    const c = costCard(312.4, 650, 40);
    expect(c).toEqual({ toMake: 312, sellPrice: 650, keep: 338, keepPct: 52, foodCostPct: 48, overTarget: true });
    expect(costSentence(c)).toBe('Cost to make Rs 312 · You sell Rs 650 · You keep Rs 338 (52%)');
    expect(lineCostLabel(0.12)).toBe('under Rs 1');
    expect(lineCostLabel(24.4)).toBe('Rs 24');
  });

  it('checks a recipe card before it is saved', () => {
    const ok = { yield: 1, lines: [{ ingredientId: 'a', qty: 10 }], addOns: [], packaging: [], signature: { on: false, creatorName: null } };
    expect(validateRecipe(ok)).toEqual({});
    expect(validateRecipe({ ...ok, lines: [] }).lines).toBeTruthy();
    expect(validateRecipe({ ...ok, signature: { on: true, creatorName: ' ' } }).creatorName).toBeTruthy();
    expect(validateTarget(35)).toEqual({});
    expect(validateTarget(95).targetFoodCostPct).toBeTruthy();
  });
});

describe('stock amounts', () => {
  const eggs = { baseUnit: 'pc' as const, dozens: true, customUnits: [{ name: 'tray', base: 30 }] };
  it('offers the units an ingredient can be counted in', () => {
    expect(unitChoices(eggs).map(u => u.label)).toEqual(['pieces', 'dozen', 'tray']);
    expect(unitChoices({ baseUnit: 'g', dozens: false, customUnits: [] }).map(u => u.label)).toEqual(['g', 'kg', 'pao']);
    expect(defaultUnit(eggs)).toBe('dozen');
  });

  it('turns what a cook types into base units', () => {
    expect(parseAmount('2,5')).toBe(2.5);
    expect(parseAmount('2½')).toBe(2.5);
    expect(parseAmount('abc')).toBeNull();
    expect(typedToBase('2.5', 'kg')).toBe(2500);
    expect(typedToBase('2', { name: 'tray', base: 30 })).toBe(60);
    expect(typedToBase('0', 'kg')).toBeNull();
  });

  it('words stock against its par level', () => {
    const i = { baseUnit: 'g' as const, dozens: false, onHand: 7500, parLevel: 10000 };
    expect(parLabel(i)).toBe('7.5 kg of 10 kg');
    expect(fillOf(i)).toBeCloseTo(0.375);
    expect(fillOf({ onHand: -200, parLevel: 1000 })).toBe(0);
    expect(STOCK_STATE.negative.label).toBe('Below zero');
  });

  it('says when stock expires (QA 6)', () => {
    expect(expiryLabel('2026-10-20', '2026-10-19')).toEqual({ label: 'Expires tomorrow', tone: 'warning' });
    expect(expiryLabel('2026-10-19', '2026-10-19').label).toBe('Expires today');
    expect(expiryLabel('2026-10-18', '2026-10-19').label).toBe('Expired');
    expect(expiryLabel('2026-10-22', '2026-10-19')).toEqual({ label: '3 days', tone: 'warning' });
  });

  it('builds an ingredient and a stock take from the forms', () => {
    const f = { name: ' Shimla mirch ', category: 'vegetables' as const, baseUnit: 'g' as const, dozens: false, par: '2', parUnit: 'kg' as const };
    expect(validateIngredient(f)).toEqual({});
    expect(ingredientInput(f)).toEqual({ name: 'Shimla mirch', category: 'vegetables', baseUnit: 'g', dozens: false, parLevel: 2000 });
    expect(validateIngredient({ ...f, parUnit: 'l' }).par).toBeTruthy();
    const c = countsOf([
      { ingredientId: 'a', typed: '4.5', unit: 'kg' },
      { ingredientId: 'b', typed: '', unit: 'kg' },
      { ingredientId: 'c', typed: 'x', unit: 'kg' },
    ]);
    expect(c.lines).toEqual([{ ingredientId: 'a', counted: 4500 }]);
    expect(Object.keys(c.errors)).toEqual(['c']);
  });
});

describe('purchases', () => {
  it('turns spoken and scanned lines into one draft (QA 1, 10)', () => {
    const spoken = linesFromVoice([{ ingredientId: 'ing_tomato', key: 'tomato', name: 'Tomato', qty: 5, unit: 'kg', total: 1200 }]);
    expect(spoken[0]).toMatchObject({ ingredientId: 'ing_tomato', qty: '5', unit: 'kg', total: '1200', baseUnit: 'g' });
    const scanned = linesFromReceipt({
      supplierName: 'Anwar Sabzi Wala',
      date: '2026-10-19',
      imageUrl: 'x',
      total: 1430,
      lines: [
        { name: 'Tomato', qty: 5, unit: 'kg', total: 1150, match: { ingredientId: 'ing_tomato', name: 'Tomato', confidence: 0.9 } },
        { name: 'Shimla mirch', qty: 1, unit: 'kg', total: 280, match: null },
      ],
    });
    expect(scanned.map(l => l.ingredientId)).toEqual(['ing_tomato', null]);
    expect(draftTotal(scanned)).toBe(1430);
    const input = purchaseInput(scanned, 'receipt', { supplierName: 'Anwar Sabzi Wala', receiptUrl: 'x' });
    expect(input.lines[1]).toEqual({ newIngredient: { name: 'Shimla mirch', category: 'vegetables', baseUnit: 'g' }, qty: 1, unit: 'kg', total: 280 });
    expect(input.supplierName).toBe('Anwar Sabzi Wala');
  });

  it('asks for what is missing on a line', () => {
    const v = validatePurchase([{ key: 'k', ingredientId: 'a', name: 'A', category: 'other', baseUnit: 'g', qty: '2', unit: 'kg', total: '', expiresOn: null }]);
    expect(v.lineErrors.k).toBe('Enter what it cost');
    expect(validatePurchase([]).errors.lines).toBeTruthy();
  });
});

describe('forecasts', () => {
  const item = { itemId: 'x', name: 'Biryani', photoUrl: null, expected: 42, low: 35, high: 49, learning: false, adjusted: null, fixed: { tiffin: 3, catering: 0 }, planned: 45 };
  it('plans the cook’s number plus fixed demand, and says the change', () => {
    expect(plannedOf(item)).toBe(45);
    expect(plannedOf({ ...item, adjusted: 50 })).toBe(53);
    expect(rangeLabel(item)).toBe('35–49');
    expect(adjustmentLabel({ adjusted: 36, expected: 42 })).toBe('−6 on the forecast');
    expect(adjustmentLabel({ adjusted: null, expected: 42 })).toBeNull();
  });

  it('starts with tomorrow and only shows accuracy it can measure (QA 13)', () => {
    expect(forecastDates('2026-10-19')[0]).toBe('2026-10-20');
    expect(dayLabel('2026-10-20', '2026-10-19')).toBe('Tomorrow');
    expect(accuracyBadge({ days: 7, accuracyPct: 86, learning: false, note: '' })).toBe('Last 7 days: 86% accurate');
    expect(accuracyBadge({ days: 7, accuracyPct: null, learning: true, note: '' })).toBeNull();
  });
});

describe('Bachat Box', () => {
  const now = Date.parse('2026-10-19T15:00:00Z');
  it('checks a box is a real saving with a fair window', () => {
    const f = { ...emptyBoxForm(now), title: 'Chef’s mix', contentsHint: 'Biryani and kebabs', value: '1200', price: '450' };
    expect(validateBox(f, now)).toEqual({});
    expect(discountLabel(1200, 450)).toBe('63% off');
    expect(validateBox({ ...f, price: '1100' }, now).price).toBe('At least 20% under its value');
    expect(validateBox({ ...f, pickupTo: f.pickupFrom }, now).pickupTo).toBeTruthy();
    expect(boxInput(f)).toMatchObject({ value: 1200, price: 450, quantity: 3 });
  });

  it('reads a pickup code however it is typed', () => {
    expect(normalizeCode(' bb-7kq2px ')).toBe('BB-7KQ2PX');
    expect(normalizeCode('7kq2px')).toBe('BB-7KQ2PX');
    expect(isPickupCode('7KQ2PX')).toBe(true);
    expect(isPickupCode('BB-0O1I')).toBe(false);
    expect(boxPaymentStatus('awaiting_transfer').label).toBe('Waiting for your transfer');
  });
});

describe('voice', () => {
  it('says each proposed action in plain words', () => {
    expect(actionTitle({ kind: 'order.accept', orderId: 'o', code: 'FC-NBNWXT', etaMinutes: 20 })).toBe('Accept order FC-NBNWXT · ready in 20 min');
    expect(actionTitle({ kind: 'order.reject', orderId: 'o', code: 'FC-NBNWXT', reason: 'too_busy' })).toBe('Decline order FC-NBNWXT · too busy right now');
    expect(actionTitle({ kind: 'purchase.add', lines: [{ ingredientId: 'i', key: 'tomato', name: 'Tomato', qty: 5, unit: 'kg', total: 1200 }] })).toBe('Add a purchase: 5 kg tomato · Rs 1,200');
    expect(actionTitle({ kind: 'waste.log', reason: 'spoiled', lines: [{ ingredientId: 'i', key: 'onion', name: 'Onion', qty: 2, unit: 'kg', total: null }] })).toBe('Log waste: 2 kg onion · went bad');
    expect(actionTitle({ kind: 'portions.set', lines: [{ itemId: 'q', name: 'Chicken qorma', portions: 20 }] })).toBe('Today: 20 chicken qorma');
    expect(actionTitle({ kind: 'vendor.busy', extraMinutes: 15 })).toBe('Add 15 min to every order');
  });

  it('flags what to check, and when it is unsure', () => {
    expect(actionWarnings({ kind: 'purchase.add', lines: [{ ingredientId: null, key: null, name: 'Shimla mirch', qty: 1, unit: 'kg', total: null }] })).toHaveLength(2);
    const r = { id: 'v', transcript: 'x', language: 'en' as const, confidence: 0.6, action: { kind: 'vendor.busy' as const, extraMinutes: 15 }, alternatives: [], heard: 'text' as const };
    expect(isUnsure(r)).toBe(true);
    expect(isUnsure({ ...r, confidence: 0.9 })).toBe(false);
  });
});

describe('the assistant', () => {
  const u = { enabled: true, limit: 300, used: 158, left: 142, resetsAt: '2026-10-31T19:00:00.000Z', voice: { limit: 200, used: 3, left: 197, resetsAt: '' } };
  it('meters the month and explains when it can’t help (QA 3, 4)', () => {
    expect(usageLine(u)).toBe('142 of 300 assistant actions left');
    expect(usageNote({ ...u, left: 0 })).toBe('Used up. Resets on 1 Nov 2026.');
    expect(usageNote({ ...u, enabled: false })).toBe('The assistant is off right now.');
    expect(aiDownNote('AI_QUOTA_REACHED', { feature: 'receipt_scan', resetsAt: u.resetsAt }).message).toContain('1 Nov 2026');
    expect(aiDownNote('AI_UNAVAILABLE').title).toBe('The assistant is off right now');
    expect(isAiDown('AI_QUOTA_REACHED')).toBe(true);
  });
});

describe('insight cards', () => {
  const card = (over: Partial<InsightCard> = {}): InsightCard => ({ id: 'c', kind: 'expiring_stock', severity: 'warning', title: 't', why: 'w', action: { kind: 'open_recipe', label: 'Open', params: { itemId: 'mi_x' } }, ...over });
  it('looks by kind and severity, and opens one screen', () => {
    expect(cardLook(card())).toEqual({ icon: 'time-outline', tone: 'warning' });
    expect(cardLook(card({ kind: 'unknown', severity: 'critical' })).tone).toBe('danger');
    expect(cardTarget(card())).toEqual({ screen: 'KitchenRecipe', params: { itemId: 'mi_x' } });
    expect(cardTarget(card({ action: { kind: 'stock_take', label: 'Count', params: { ingredientIds: ['a', 'b'] } } }))).toEqual({ screen: 'KitchenStockTake', params: { ingredientIds: ['a', 'b'] } });
  });
});
