// The 5C assistant helpers: what confirming a draft sends, prices and what
// is kept, review weeks, nutrition in plain words; and the serializers.

import {
  comboItemInput,
  confidenceOf,
  descriptionInput,
  nutritionLine,
  repriced,
  savingLine,
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

  it('adds a combo as a deal', () => {
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
  it('keeps no numbers for a dish not worked out, and drops ideas without a name', () => {
    expect(dishNutritionSerializer({ itemId: 'mi_x', name: 'X', method: 'none', kcal: 500 })).toMatchObject({ kcal: null, method: 'none' });
    expect(dishNutritionSerializer({ itemId: 'mi_y', nutrition: { perServing: { kcal: 591, proteinG: 46.6 }, method: 'recipe' } }, 'Qorma')).toMatchObject({ name: 'Qorma', kcal: 591, protein: 47, method: 'recipe' });
    const ideas = specialIdeasSerializer({ targetFoodCostPct: 35, ideas: [{ description: 'no name' }, { name: 'Kheer', servings: 4, costPerServing: 69, suggestedPrice: 200, foodCostPct: 34.5, lines: [{ ingredientId: 'i1', name: 'Milk', qty: 1, unit: 'l', expiring: true }] }] });
    expect(ideas.items.map(i => i.title)).toEqual(['Kheer']);
    expect(ideas.items[0]).toMatchObject({ servings: 4, usesExpiring: ['Milk'], cost: { toMake: 69, keep: 131, overTarget: false }, lines: [{ ingredientId: 'i1', qty: 1, unit: 'l' }] });
  });

  it('reads a week of review themes (anonymised), the latest or one picked', () => {
    const raw = {
      latest: { periodStart: '2026-10-19', periodEnd: '2026-10-25', reviewCount: 8, themes: [{ theme: 'cold food', sentiment: 'negative', count: 3, examples: ['came cold'] }] },
      history: [{ periodStart: '2026-10-12', periodEnd: '2026-10-18', reviewCount: 5, themes: [] }],
    };
    expect(reviewInsightsSerializer(raw)).toMatchObject({ week: '2026-10-19', reviewCount: 8, themes: [{ key: 'cold food', label: 'Cold food', tone: 'negative', count: 3, snippets: ['came cold'] }], weeks: [{ week: '2026-10-19', count: 8 }, { week: '2026-10-12', count: 5 }] });
    expect(reviewInsightsSerializer(raw, '2026-10-12')?.week).toBe('2026-10-12');
    expect(reviewInsightsSerializer({ latest: null, newReviews: 2 })).toBeNull();
  });
});
