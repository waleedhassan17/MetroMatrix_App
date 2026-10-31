// My Kitchen's words and forms: the pantry line, expiry, the month's line,
// grocery prices per unit; nutrition goals, body numbers and a week said
// without praise or blame.

import { emptyPantryForm, expiryLine, optionLine, pantryLineOf, pantryQty, statsLine, validatePantryForm } from '../myKitchen/pantryModel';
import { dayLine, dishFactsLine, metricsOf, targetLine, validateManualTarget, validateMetrics, vsTarget } from '../myKitchen/nutritionModel';
import { actionTitle } from '../kitchen/voiceModel';
import { dishFactsSerializer, nutritionSettingsSerializer, pantryListSerializer } from '../../serializers/myKitchen/myKitchenSerializer';

describe('the pantry', () => {
  it('says how much and until when', () => {
    expect(pantryQty({ qty: 2000, unit: 'g', key: 'potato' })).toBe('2 kg');
    expect(pantryQty({ qty: 12, unit: 'pc', key: 'egg' })).toBe('1 dozen');
    expect(expiryLine({ expiresOn: '2026-10-22', state: 'use_soon' })).toBe('Use by Thu 22 Oct');
    expect(expiryLine({ expiresOn: '2026-10-14', state: 'expired' })).toBe('Expired Wed 14 Oct');
    expect(expiryLine({ expiresOn: null, state: 'fresh' })).toBe('No use-by date');
  });

  it('checks the form and turns it into a line', () => {
    expect(validatePantryForm(emptyPantryForm())).toEqual({ name: 'What is it?', qty: 'How much?' });
    expect(pantryLineOf({ name: ' Aloo ', qty: '2', unit: 'kg', expiresIn: 7 }, '2026-10-21')).toEqual({ name: 'Aloo', qty: 2, unit: 'kg', expiresOn: '2026-10-28' });
    expect(pantryLineOf({ name: 'Rice', qty: '5', unit: 'kg', expiresIn: null }, '2026-10-21').expiresOn).toBeNull();
  });

  it('counts the month plainly, and prices groceries per unit', () => {
    expect(statsLine({ savedFromWaste: 7, used: 9 })).toBe('7 things saved from waste this month');
    expect(statsLine({ savedFromWaste: 0, used: 1 })).toBe('1 thing used up this month');
    expect(optionLine({ price: 1550, netQuantity: { qty: 10000, unit: 'g' }, pricePerUnit: { amount: 155, per: 'kg' } })).toBe('Rs 1,550 · 10 kg · Rs 155 / kg');
  });

  it('says what a spoken pantry line adds, with its use-by date', () => {
    const lines = [{ key: 'potato', name: 'Potato', qty: 2, unit: 'kg' as const, expiresOn: '2026-10-28' }];
    expect(actionTitle({ kind: 'pantry.add', lines })).toBe('Add to your pantry: 2 kg potato · use by Wed 28 Oct');
    expect(actionTitle({ kind: 'pantry.add', lines: [{ ...lines[0], expiresOn: null }] })).toBe('Add to your pantry: 2 kg potato');
  });

  it('reads a pantry defensively', () => {
    const p = pantryListSerializer({ counts: { all: 1 }, items: [{ id: 'pn_1', name: 'Milk', qty: 1000, unit: 'ml', state: 'odd' }, { name: 'no id' }] });
    expect(p.counts).toEqual({ all: 1, use_soon: 0, expired: 0 });
    expect(p.items).toHaveLength(1);
    expect(p.items[0]).toMatchObject({ state: 'fresh', unit: 'ml', expiresOn: null });
  });
});

describe('nutrition', () => {
  it('checks body numbers and an own target', () => {
    expect(validateMetrics({ sex: 'female', age: '12', heightCm: '163', weightKg: '62', activity: 'moderate' })).toEqual({ age: 'Age 14 to 100' });
    expect(metricsOf({ sex: 'male', age: '40', heightCm: '175', weightKg: '80.5', activity: 'low' })).toEqual({ sex: 'male', age: 40, heightCm: 175, weightKg: 80.5, activity: 'low' });
    expect(validateManualTarget('900')).toBe('A daily target of 1,000 to 5,000 kcal');
    expect(validateManualTarget('1800')).toBeNull();
  });

  it('says a day and the target without judging', () => {
    expect(dayLine({ date: '2026-10-20', kcal: 1840, protein: 60, carbs: 200, fat: 70, orders: 2 })).toBe('Tue 20 Oct: 1,840 kcal from 2 orders');
    expect(dayLine({ date: '2026-10-19', kcal: 0, protein: 0, carbs: 0, fat: 0, orders: 0 })).toBe('Mon 19 Oct: no Food Court orders');
    expect(vsTarget(2220, 1920)).toBe('About 300 kcal over your daily target');
    expect(vsTarget(1600, 1920)).toBe('About 320 kcal under your daily target');
    expect(vsTarget(1930, 1920)).toBe('About your daily target');
    for (const line of [vsTarget(2600, 1920), vsTarget(1000, 1920)]) expect(line).not.toMatch(/great|well done|too much|bad|good job/i);
    expect(targetLine(1920)).toBe('Your daily target: about 1,920 kcal');
    expect(targetLine(null)).toBe('No daily target: add your numbers or set one');
  });

  it('gives a dish that serves more as a person’s share', () => {
    expect(dishFactsLine({ kcal: 494, protein: 49, serves: 1 })).toBe('About 494 kcal · 49 g protein');
    expect(dishFactsLine({ kcal: 1923, protein: 122, serves: 2 })).toBe('About 962 kcal a person · 61 g protein');
    expect(dishFactsSerializer({ kcal: 1923, protein: 122, carbs: 40, fat: 140, method: 'recipe', serves: 2 })).toMatchObject({ serves: 2 });
    expect(dishFactsSerializer({ kcal: 500, protein: 20, carbs: 40, fat: 20, method: 'recipe' })).toMatchObject({ serves: 1 });
  });

  it('never shows calories while nutrition is off', () => {
    expect(nutritionSettingsSerializer({ enabled: false, showCalories: true, targetKcal: 1900 })).toMatchObject({ showCalories: false, targetKcal: null });
  });
});
