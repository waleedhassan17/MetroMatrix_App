// The staff console's Kitchen tools: how numbers, prices and events are
// said, and what each form checks before it is sent.

import {
  aiFeatureLabel,
  canImport,
  changeLine,
  eventLine,
  failedLabel,
  foodKeyOf,
  importSummary,
  macrosLine,
  quotaLine,
  secondsLabel,
  unitPrice,
  validateAlias,
  validateCsvText,
  validateEvent,
  validateLookupCode,
  validateNutritionFood,
  validateQuota,
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
    expect(quotaLine({ usedThisMonth: 12, limit: 300, override: null })).toBe('12 of 300 this month');
    expect(quotaLine({ usedThisMonth: 1200, limit: 2000, override: 2000 })).toBe('1,200 of 2,000 this month · staff limit');
  });

  it('takes a whole-number limit, or empty for the plan’s', () => {
    expect(validateQuota('')).toEqual({});
    expect(validateQuota('500')).toEqual({});
    expect(validateQuota('2.5').limit).toBeTruthy();
    expect(validateQuota('100001').limit).toBeTruthy();
  });

  it('reads a usage report defensively', () => {
    const r = aiUsageReportSerializer({ totals: { actions: 3, failureRate: 4 }, byOwner: [{ ownerId: 'b_x', kind: 'kitchen', override: null }, { nope: true }] });
    expect(r.totals.failureRate).toBe(1);
    expect(r.byOwner).toHaveLength(1);
    expect(r.byOwner[0]).toMatchObject({ name: 'b_x', override: null, limit: 0 });
  });
});

describe('city prices and CSV imports', () => {
  it('says a price per unit and how it moved', () => {
    expect(unitPrice(171, 'kg')).toBe('Rs 171 / kg');
    expect(unitPrice(540, 'l')).toBe('Rs 540 / litre');
    expect(changeLine(22)).toBe('Up 22% in 4 weeks');
    expect(changeLine(-3)).toBe('Down 3% in 4 weeks');
    expect(changeLine(0)).toBe('Same as 4 weeks ago');
    expect(changeLine(null)).toBeNull();
  });

  it('checks the header before sending, and imports only a clean dry run', () => {
    expect(validateCsvText('', PRICE_COLUMNS).csv).toBeTruthy();
    expect(validateCsvText('key,city,price\ntomato,Lahore,190', PRICE_COLUMNS).csv).toMatch(/columns/);
    expect(validateCsvText('key,city,week,price', PRICE_COLUMNS).csv).toMatch(/no rows/);
    expect(validateCsvText('﻿"Key",City,WEEK,price\ntomato,Lahore,2026-10-19,190', PRICE_COLUMNS)).toEqual({});
    expect(validateCsvText('key,name,per,kcal,protein,carbs,fat\nx,X,g100,1,1,1,1', NUTRITION_COLUMNS)).toEqual({});
    expect(importSummary({ rows: 3, valid: 1 })).toBe('3 rows · 1 ready · 2 with problems');
    expect(importSummary({ rows: 1, valid: 1 })).toBe('1 row · 1 ready');
    expect(canImport({ rows: 3, valid: 1, errors: [{ row: 3, field: 'week', message: '' }] })).toBe(false);
    expect(canImport({ rows: 2, valid: 2, errors: [] })).toBe(true);
    expect(canImport(null)).toBe(false);
  });

  it('reads a dry run and a refusal', () => {
    const r = priceImportSerializer({ dryRun: true, rows: 2, valid: 1, errors: [{ row: 3, field: 'key', message: 'No ingredient' }, { row: 0 }], preview: [{ row: 2, key: 'tomato', price: '190', unit: 'kg', previous: null }] });
    expect(r.errors).toHaveLength(1);
    expect(r.preview[0]).toMatchObject({ key: 'tomato', price: 190, previous: null, name: 'tomato' });
    expect(csvErrorsSerializer({ errors: [{ row: 4, field: 'price', message: 'Above 0' }] })).toEqual([{ row: 4, field: 'price', message: 'Above 0' }]);
  });
});

describe('nutrition foods, words and the calendar', () => {
  it('checks a nutrition food and makes its key from the name', () => {
    expect(foodKeyOf('Spinach (palak)')).toBe('spinach_palak');
    const ok = { key: 'spinach_palak', name: 'Spinach (palak)', per: 'g100' as const, kcal: '23', protein: '2.9', carbs: '3.6', fat: '0.4' };
    expect(validateNutritionFood(ok, true)).toEqual({});
    expect(validateNutritionFood({ ...ok, key: 'Bad Key' }, true).key).toBeTruthy();
    expect(validateNutritionFood({ ...ok, key: 'Bad Key' }, false).key).toBeUndefined();
    expect(validateNutritionFood({ ...ok, kcal: '', fat: '300' }, false)).toMatchObject({ kcal: '0 to 2000', fat: '0 to 200' });
    expect(macrosLine({ per: 'piece', kcal: 120, protein: 3, carbs: 18, fat: 4 })).toBe('120 kcal · 3 g protein · 18 g carbs · 4 g fat, per piece');
  });

  it('keeps Urdu words in Urdu script, and needs the ingredient', () => {
    expect(validateAlias({ word: 'tamatar', language: 'roman_ur', key: 'tomato', keyName: 'Tomato' })).toEqual({});
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
    expect(signatureListSerializer({ items: [{ itemId: 'mi_x', status: 'weird' }], counts: { new: 2 } })).toEqual({
      items: [expect.objectContaining({ itemId: 'mi_x', status: 'new', vendor: null })],
      counts: { new: 2, approved: 0, removed: 0 },
    });
    expect(validateLookupCode('tf-hmz4k2')).toEqual({});
    expect(validateLookupCode('FC-NBNWXT').code).toBeTruthy();
    expect(growthLookupSerializer({ kind: 'tiffin', tiffin: null })).toBeNull();
    expect(growthLookupSerializer({ kind: 'other' })).toBeNull();
  });
});
