// The staff console's Kitchen tools: how numbers, prices and events are
// said, and what each form checks before it is sent.

import {
  aiFeatureLabel,
  canImport,
  eventLine,
  failedLabel,
  foodKeyOf,
  importSummary,
  macrosLine,
  referenceLine,
  secondsLabel,
  validateAlias,
  validateCsvText,
  validateEvent,
  validateLookupCode,
  validateNutritionFood,
  validateStaffNote,
  NUTRITION_COLUMNS,
  PRICE_COLUMNS,
} from '../kitchen/adminKitchenModel';
import {
  aiUsageReportSerializer,
  csvErrorsSerializer,
  growthLookupSerializer,
  priceImportSerializer,
  signatureListSerializer,
} from '../../serializers/kitchen/adminKitchenSerializer';

describe('the assistant', () => {
  it('says features, times, failures and limits plainly', () => {
    expect(aiFeatureLabel('receipt_scan')).toBe('Receipt scans');
    expect(aiFeatureLabel('something_new')).toBe('something new');
    expect(secondsLabel(932)).toBe('0.9 s');
    expect(secondsLabel(40)).toBe('under 0.1 s');
    expect(failedLabel(0, 12)).toBe('none failed');
    expect(failedLabel(1, 300)).toBe('1% failed');
  });

  it('reads a usage report with the switches, defensively', () => {
    const r = aiUsageReportSerializer({
      usage: { days: 7, totals: { calls: 4, failures: 1, cached: 2 }, byFeature: [{ feature: 'voice', calls: 3, invalid: 1, quota: 1 }], byBusiness: [{ businessId: 'b_x', calls: 2 }, { nope: true }] },
      settings: { enabled: true, model: 'some-model', providerConfigured: false },
    });
    expect(r).toMatchObject({ days: 7, enabled: true, model: null, totals: { actions: 4, failures: 1, failureRate: 0.25, cached: 2 } });
    expect(r?.byFeature[0]).toMatchObject({ feature: 'voice', actions: 3, failures: 2 });
    expect(r?.byBusiness).toEqual([{ businessId: 'b_x', name: 'A kitchen', actions: 2, failures: 0 }]);
    expect(aiUsageReportSerializer({ usage: null, settings: null })).toBeNull();
  });
});

describe('city prices and CSV imports', () => {
  it('says where a reference item stands', () => {
    expect(referenceLine({ unit: 'kg', cities: 3, latestWeek: '2026-10-15' })).toBe('kg · 3 cities · the week ending Thu 15 Oct');
    expect(referenceLine({ unit: 'dozen', cities: 0, latestWeek: null })).toBe('dozen · no prices yet');
  });

  it('checks the header before sending, and imports only a clean dry run', () => {
    expect(validateCsvText('', PRICE_COLUMNS).csv).toBeTruthy();
    expect(validateCsvText('city,item,price\nLahore,Tomatoes,190', PRICE_COLUMNS).csv).toMatch(/columns/);
    expect(validateCsvText('week_ending,city,item,unit,price', PRICE_COLUMNS).csv).toMatch(/no rows/);
    expect(validateCsvText('﻿"Week_Ending",City,ITEM,unit,price\n2026-10-15,Lahore,Tomatoes,kg,180', PRICE_COLUMNS)).toEqual({});
    expect(validateCsvText('key,name,name_ur,food_group,kcal,protein_g,carbs_g,fat_g,fibre_g,sodium_mg,piece_grams\nx,X,,Dairy,1,1,1,1,0,0,', NUTRITION_COLUMNS)).toEqual({});
    expect(importSummary({ rows: 3, valid: 1 })).toBe('3 rows · 1 ready · 2 with problems');
    expect(importSummary({ rows: 1, valid: 1 })).toBe('1 row · 1 ready');
    expect(canImport({ rows: 3, valid: 1, errors: [{ row: 3, field: 'week', message: '' }] })).toBe(false);
    expect(canImport({ rows: 2, valid: 2, errors: [] })).toBe(true);
    expect(canImport(null)).toBe(false);
  });

  it('reads a dry run and a refusal', () => {
    const r = priceImportSerializer({ items: 1, prices: 1, cities: ['Lahore'], weeks: ['2026-10-15'], rejected: 1, errors: [{ line: 3, error: 'unit "bushel" isn’t one we can compare' }, { line: 0 }], dryRun: true });
    expect(r).toMatchObject({ dryRun: true, rows: 2, valid: 1, imported: 0, summary: '1 price for 1 item, 1 city, the week ending Thu 15 Oct' });
    expect(r?.errors).toEqual([{ row: 3, field: '', message: 'unit "bushel" isn’t one we can compare' }]);
    expect(csvErrorsSerializer({ errors: [{ line: 4, error: 'Above 0' }] })).toEqual([{ row: 4, field: '', message: 'Above 0' }]);
  });
});

describe('nutrition foods, words and the calendar', () => {
  it('checks a nutrition food and makes its key from the name', () => {
    expect(foodKeyOf('Spinach (palak)')).toBe('spinach-palak');
    const ok = { key: 'spinach-palak', name: 'Spinach (palak)', per: 'g100' as const, kcal: '23', protein: '2.9', carbs: '3.6', fat: '0.4' };
    expect(validateNutritionFood(ok, true)).toEqual({});
    expect(validateNutritionFood({ ...ok, key: 'Bad Key' }, true).key).toBeTruthy();
    expect(validateNutritionFood({ ...ok, key: 'Bad Key' }, false).key).toBeUndefined();
    expect(validateNutritionFood({ ...ok, kcal: '', fat: '300' }, false)).toMatchObject({ kcal: '0 to 950', fat: '0 to 100' });
    expect(macrosLine({ per: 'piece', kcal: 120, protein: 3, carbs: 18, fat: 4 })).toBe('120 kcal · 3 g protein · 18 g carbs · 4 g fat, per piece');
  });

  it('keeps Urdu words in Urdu script, and needs the ingredient', () => {
    expect(validateAlias({ word: 'tamatar', language: 'roman', key: 'tomato', keyName: 'Tomato' })).toEqual({});
    expect(validateAlias({ word: 'ٹماٹر', language: 'ur', key: 'tomato', keyName: 'Tomato' })).toEqual({});
    expect(validateAlias({ word: 'tamatar', language: 'ur', key: 'tomato', keyName: 'Tomato' }).word).toMatch(/Urdu script/);
    expect(validateAlias({ word: 'ٹماٹر', language: 'en', key: 'tomato', keyName: 'Tomato' }).word).toMatch(/Pick Urdu/);
    expect(validateAlias({ word: '', language: 'en', key: '', keyName: '' })).toMatchObject({ word: expect.any(String), key: expect.any(String) });
  });

  it('checks an event’s days and says them', () => {
    expect(validateEvent({ kind: 'ramadan', name: 'Ramadan 1448', startsOn: '2027-02-08', endsOn: '2027-03-09' })).toEqual({});
    expect(validateEvent({ kind: 'eid', name: 'Eid', startsOn: '2027-03-12', endsOn: '2027-03-10' }).endsOn).toMatch(/on or after/);
    expect(validateEvent({ kind: 'other', name: 'Long', startsOn: '2027-01-01', endsOn: '2027-03-01' }).endsOn).toMatch(/40 days/);
    expect(validateEvent({ kind: 'other', name: 'x', startsOn: '2027-01-01', endsOn: '2027-01-01' }).name).toBeTruthy();
    expect(eventLine({ startsOn: '2027-03-10', endsOn: '2027-03-12', days: 3 })).toBe('Wed 10 Mar – Fri 12 Mar · 3 days');
    expect(eventLine({ startsOn: '2027-02-05', endsOn: '2027-02-05', days: 1 })).toBe('Fri 5 Feb · 1 day');
  });
});

describe('signatures, hygiene notes and lookups', () => {
  it('needs a note the kitchen can act on', () => {
    expect(validateStaffNote('no').note).toBeTruthy();
    expect(validateStaffNote('The fridge photo is missing.')).toEqual({});
    expect(validateStaffNote('x'.repeat(301)).note).toMatch(/300/);
  });

  it('reads signature counts and a code lookup', () => {
    expect(
      signatureListSerializer({ claimed: { items: [{ recipeCardId: 'rc1', itemId: 'mi_x', item: 'Karahi', by: 'Ustad', since: '2015-06-01' }, { nope: true }], total: 1 }, removed: { items: [], total: 2 } }, 'claimed'),
    ).toEqual({
      items: [expect.objectContaining({ recipeCardId: 'rc1', itemId: 'mi_x', name: 'Karahi', status: 'claimed', creatorName: 'Ustad', since: '2015-06-01', vendor: null })],
      counts: { claimed: 1, removed: 2 },
    });
    expect(validateLookupCode('ct-mhd7q4')).toEqual({});
    expect(validateLookupCode('FC-NBNWXT')).toEqual({});
    expect(validateLookupCode('72713c2d-e678-4cbb-b652-0d0054f929a8')).toEqual({});
    expect(validateLookupCode('TF-HMZ4K2').code).toBeTruthy();
    expect(growthLookupSerializer({ kind: 'tiffin', id: 't1', status: 'requested', plan: 'Lunch', vendor: 'K', customer: 'C', deliveries: 2, missed: 1 })).toMatchObject({
      kind: 'tiffin',
      code: 't1',
      lines: expect.arrayContaining([{ label: 'Plan', value: 'Lunch' }, { label: 'Delivered', value: '2 (missed 1)' }]),
    });
    expect(growthLookupSerializer({ kind: 'other' })).toBeNull();
  });
});
