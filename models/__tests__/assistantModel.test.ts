// The 5C assistant helpers: what confirming a draft sends, prices and what
// is kept, review weeks, nutrition in plain words; and the serializers.

import {
  comboItemInput,
  confidenceOf,
  descriptionInput,
  nutritionLine,
  repriced,
  savingLine,
  specialItemInput,
  specialRecipe,
  validateDescription,
  validateDraftPrice,
  weekLabel,
} from '../kitchen/assistantModel';
import { dishNutritionSerializer, reviewInsightsSerializer, specialIdeasSerializer } from '../../serializers/kitchen/assistantSerializer';

describe('confirming drafts', () => {
  it('saves a description in English, Urdu or both', () => {
    expect(validateDescription({ en: '', ur: '' })).toEqual({ en: 'Write it in English, Urdu or both' });
    expect(validateDescription({ en: '', ur: 'تنور سے تازہ نان۔' })).toEqual({});
    expect(descriptionInput({ en: '  Fresh naan. ', ur: '' })).toEqual({ description: 'Fresh naan.', descriptionUr: null });
  });

  it('adds a special hidden, with its recipe card, and a combo as a deal', () => {
    const special = specialItemInput({ title: 'Chicken tikka plate', description: 'Chargrilled.' }, 'mc_bbq', 870);
    expect(special).toMatchObject({ categoryId: 'mc_bbq', name: 'Chicken tikka plate', basePrice: 870, isActive: false, isDeal: false });
    expect(specialRecipe({ lines: [{ ingredientId: 'ing_bb_chicken', qty: 220.4 }] })).toMatchObject({ yield: 1, lines: [{ ingredientId: 'ing_bb_chicken', qty: 220 }] });
    const combo = comboItemInput({ names: ['Chicken Biryani', 'Naan'] }, 'mc_deals', 630);
    expect(combo).toMatchObject({ name: 'Chicken Biryani + Naan', description: 'Chicken Biryani and Naan together.', isDeal: true, isActive: true, basePrice: 630 });
  });

  it('re-prices what is kept as the cook types', () => {
    expect(validateDraftPrice('5')).toBe('A price in rupees');
    expect(validateDraftPrice('870')).toBeNull();
    expect(repriced({ toMake: 305 }, '900', 40)).toMatchObject({ sellPrice: 900, keep: 595, foodCostPct: 34, overTarget: false });
    expect(repriced({ toMake: 305 }, 'abc', 40)).toBeNull();
    expect(savingLine({ regularPrice: 710 }, 630)).toBe('Rs 80 less than both apart (Rs 710)');
  });
});

describe('weeks and nutrition', () => {
  it('says a week as dates', () => {
    expect(weekLabel('2026-10-12')).toBe('12–18 Oct');
    expect(weekLabel('2026-09-28')).toBe('28 Sep – 4 Oct');
  });

  it('says nutrition plainly, with how sure it is', () => {
    expect(nutritionLine({ kcal: 973, protein: 43, carbs: 118, fat: 35 })).toBe('973 kcal · protein 43 g · carbs 118 g · fat 35 g');
    expect(nutritionLine({ kcal: null, protein: null, carbs: null, fat: null })).toBe('No numbers yet');
    expect(confidenceOf(0.95).label).toBe('High confidence');
    expect(confidenceOf(0.83).label).toBe('Medium confidence');
    expect(confidenceOf(0.55).label).toBe('Medium confidence');
    expect(confidenceOf(0.35).label).toBe('Low confidence');
  });
});

describe('the assistant’s serializers', () => {
  it('keeps no numbers for a dish not worked out, and drops ideas without a cost', () => {
    expect(dishNutritionSerializer({ itemId: 'mi_x', name: 'X', method: 'none', kcal: 500 })).toMatchObject({ kcal: null, method: 'none' });
    expect(specialIdeasSerializer({ items: [{ title: 'No cost' }, { title: 'Kheer', cost: { toMake: 69, sellPrice: 200, keep: 131 } }] }).items.map(i => i.title)).toEqual(['Kheer']);
  });

  it('drops a review theme it doesn’t know', () => {
    const r = reviewInsightsSerializer({ week: '2026-10-12', themes: [{ key: 'late', label: 'Took too long', tone: 'negative', count: 3 }, { key: 'weird', count: 1 }] });
    expect(r?.themes.map(t => t.key)).toEqual(['late']);
  });
});

describe('the dummy photo check', () => {
  it('always gives tips, whatever the address hashes to', () => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { photoCheck } = require('../../networks/network/mock/kitchen/assistantLogic') as typeof import('../../networks/network/mock/kitchen/assistantLogic');
    for (let n = 0; n < 300; n++) {
      const r = photoCheck(`blob:http://localhost:8093/${n.toString(36)}-${n * 7919}`);
      expect(r.tips.length).toBeGreaterThan(0);
      expect(r.tips.every(t => typeof t.text === 'string')).toBe(true);
    }
  });
});
