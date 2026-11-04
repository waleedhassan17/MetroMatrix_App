// Real MetroMatrix-API Kitchen Intelligence responses (captured end to end on a
// local backend's seed:food + seed:kitchen demo by
// scripts/capture-kitchen-fixtures.js, with AI off: the kitchen's stock,
// recipes, purchases, forecast, waste, Bachat Box, tiffin, catering, growth
// and assistant; a customer's pantry and nutrition; staff answers and the
// busier kitchen screens from the backend's e2e run,
// scripts/capture-kitchen-staff-fixtures.js) through the Kitchen serializers.

import real from './fixtures/kitchen/real.json';
import staffCapture from './fixtures/kitchen/staff.json';
import { aiUsageSerializer, announcementSerializer, boardHintsSerializer, insightCardsSerializer, kitchenSummarySerializer, snoozedCardSerializer } from '../kitchen/insightSerializer';
import {
  ingredientDetailSerializer,
  priceWatchSerializer,
  purchaseSerializer,
  purchasesPageSerializer,
  stockListSerializer,
  stockTakeSerializer,
  suppliersSerializer,
} from '../kitchen/stockSerializer';
import { kitchenSettingsSerializer, recipeListSerializer, recipeSerializer } from '../kitchen/recipeSerializer';
import { accuracySerializer, forecastSerializer, prepSheetSerializer, shoppingListSerializer } from '../kitchen/forecastSerializer';
import { donationsSerializer, wasteBatchSerializer, wastePageSerializer, wasteSummarySerializer } from '../kitchen/wasteSerializer';
import {
  liveBoxesSerializer,
  myReservationSerializer,
  reservationSerializer,
  reservationsSerializer,
  surplusCardsSerializer,
  surplusDetailSerializer,
  surplusSuggestionSerializer,
} from '../kitchen/surplusSerializer';
import {
  cateringCalendarSerializer,
  cateringInboxSerializer,
  cateringRequestByCodeSerializer,
  cateringRequestSerializer,
  cateringSettingsSerializer,
  cateringVendorSerializer,
  myTiffinSerializer,
  tiffinCalendarSerializer,
  tiffinInboxSerializer,
  tiffinPlanSerializer,
  tiffinPlansSerializer,
  tiffinSubscriptionSerializer,
  tiffinTomorrowSerializer,
} from '../kitchen/growthSerializer';
import {
  batchSuggestionsSerializer,
  demandMapSerializer,
  experimentSerializer,
  experimentsSerializer,
  hygieneSerializer,
  menuInsightsSerializer,
  ramadanSettingsSerializer,
  storefrontSerializer,
  storySerializer,
} from '../kitchen/reachSerializer';
import {
  comboIdeasSerializer,
  dishNutritionSerializer,
  nutritionFoodsSerializer,
  reviewInsightsSerializer,
  reviewInsightsWaitSerializer,
  specialIdeasSerializer,
  vendorNutritionSerializer,
} from '../kitchen/assistantSerializer';
import { voiceResultSerializer } from '../ai/voiceSerializer';
import {
  groceryOrdersSerializer,
  homeRecipeSerializer,
  missingItemsSerializer,
  nutritionSettingsSerializer,
  nutritionSummarySerializer,
  pantryItemsSerializer,
  pantryListSerializer,
  pantryRemindersSerializer,
  pantryStatsSerializer,
  pantryUsedUpSerializer,
  recipeIdeasSerializer,
} from '../myKitchen/myKitchenSerializer';
import {
  adminDemandSerializer,
  aiUsageReportSerializer,
  aliasesSerializer,
  calendarEventsSerializer,
  growthLookupSerializer,
  hygieneQueueSerializer,
  nutritionFoodImportSerializer,
  priceImportSerializer,
  signatureListSerializer,
  staffNutritionFoodsSerializer,
} from '../kitchen/adminKitchenSerializer';

type Capture = Record<string, { status: number; body: { success: boolean; data?: unknown; error?: { code: string } } }>;
const R = real as unknown as Capture;
const STAFF = staffCapture as unknown as Record<string, { status: number; body: { data: unknown } }[]>;
/** The captured body (the envelope), as a network function returns it. */
const body = (k: string) => {
  expect(R[k]).toBeDefined();
  return R[k].body;
};
const ok = (k: string) => {
  expect(R[k]?.status).toBeLessThan(300);
  return R[k].body;
};
const staff = (route: string, n = -1) => {
  expect(STAFF[route]?.length).toBeGreaterThan(0);
  return STAFF[route].at(n)!.body;
};
const DATE = /^\d{4}-\d{2}-\d{2}$/;

describe('the Kitchen tab and its cards', () => {
  it('reads the numbers, the board and the settings', () => {
    const s = kitchenSummarySerializer(ok('summary'))!;
    expect(s.date).toMatch(DATE);
    expect(s.stock.total).toBeGreaterThan(0);
    expect(s.stock.low + s.stock.negative).toBeLessThanOrEqual(s.stock.total);
    expect(s.recipes.targetFoodCostPct).toBeGreaterThan(0);
    expect(['none', 'self_declared', 'verified']).toContain(s.growth.hygiene);
    expect(['active', 'upcoming', 'none']).toContain(s.growth.ramadan.state);
    const b = boardHintsSerializer(ok('board'))!;
    expect(b.lowStock.every(x => x.itemId && x.name && x.servingsLeft >= 0)).toBe(true);
    expect(['optional', 'required']).toContain(b.packingPhoto);
    expect(kitchenSettingsSerializer(ok('settings'))).toMatchObject({ targetFoodCostPct: expect.any(Number), packingPhoto: expect.stringMatching(/optional|required/) });
  });

  it('turns the cards into actions the app has pages for, at most five', () => {
    const cards = insightCardsSerializer(ok('cards'));
    expect(cards.length).toBeGreaterThan(0);
    expect(cards.length).toBeLessThanOrEqual(5);
    for (const c of cards) {
      expect(c.id).toBeTruthy();
      expect(['critical', 'warning', 'info']).toContain(c.severity);
      expect(c.action.kind).toBeTruthy();
    }
    expect(snoozedCardSerializer(ok('cardSnooze'))).toMatchObject({ id: expect.stringContaining(':'), snoozedUntil: expect.any(String) });
  });
});

describe('stock, recipes and purchases', () => {
  it('reads an ingredient with its batches and moves, and the stock list by segment', () => {
    const d = ingredientDetailSerializer({ ingredient: ok('ingredient'), batches: ok('batches'), movements: ok('movements') })!;
    expect(d.id).toBeTruthy();
    expect(['g', 'ml', 'pc']).toContain(d.baseUnit);
    expect(d.batches.every(x => x.expiresOn === null || DATE.test(x.expiresOn))).toBe(true);
    expect(d.movements.length).toBeGreaterThan(0);
    const list = stockListSerializer(ok('stock'))!;
    expect(list.items.length).toBeGreaterThan(0);
    expect(list.counts.all).toBeGreaterThanOrEqual(list.items.length);
    expect(stockListSerializer(ok('stockExpiring'))!.items.every(i => i.expiring !== null)).toBe(true);
    expect(stockTakeSerializer(ok('stockCount'), [])).not.toBeNull();
  });

  it('reads the costing, a recipe card with its dish, and a dish without one', () => {
    const list = recipeListSerializer({ costing: ok('costing') })!;
    expect(list.items.length).toBeGreaterThan(0);
    expect(list.items.some(i => i.cost !== null)).toBe(true);
    const recipe = ok('recipe') as { data: { itemId: string } };
    const row = (ok('costing') as { data: { items: { itemId: string }[] } }).data.items.find(r => r.itemId === recipe.data.itemId)!;
    const r = recipeSerializer({ card: recipe, item: { id: row.itemId, name: 'A dish', variants: [] }, costing: ok('costing') })!;
    expect(r.lines.length).toBeGreaterThan(0);
    expect(r.lines.every(l => l.qty > 0 && l.ingredientId)).toBe(true);
    expect(body('recipeNone').data).toBeNull();
    expect(R.recipeDelete.status).toBe(200);
  });

  it('reads purchases (list and one), suppliers and price watch', () => {
    const page = purchasesPageSerializer(ok('purchases'));
    expect(page.items.length).toBeGreaterThan(0);
    expect(page.items[0].lineCount).toBeGreaterThan(0);
    expect(purchaseSerializer(ok('purchase'))!.lines.length).toBeGreaterThan(0);
    expect(suppliersSerializer(ok('suppliers')).every(s => s.spent30d >= 0)).toBe(true);
    const pw = priceWatchSerializer(ok('priceWatch'))!;
    expect(pw.items.length).toBeGreaterThan(0);
  });
});

describe('forecast, prep and waste', () => {
  it('reads a learning forecast (the e2e kitchen) and the demo day', () => {
    const f = forecastSerializer({ forecast: staff('GET /food/vendor/kitchen/forecast'), prep: staff('GET /food/vendor/kitchen/prep-sheet') })!;
    expect(f.date).toMatch(DATE);
    expect(f.items.every(i => i.id && i.planned >= 0)).toBe(true);
    expect(forecastSerializer({ forecast: ok('forecast') })).not.toBeNull();
    expect(accuracySerializer(ok('forecast'))).not.toBeNull();
    expect(prepSheetSerializer(ok('prepSheet'))).not.toBeNull();
    expect(shoppingListSerializer(ok('shoppingList'))!.shareText).toMatch(/Shopping list/);
  });

  it('reads waste one line an entry, its summary with the meals rescued, and donations', () => {
    const w = wasteBatchSerializer([ok('wasteLog')])!;
    expect(w.lines).toHaveLength(1);
    expect(w.lines[0].reason).toBe('spoiled');
    expect(wastePageSerializer(ok('waste')).items.length).toBeGreaterThan(0);
    const s = wasteSummarySerializer({ summary: ok('wasteSummary'), donations: ok('donations') })!;
    expect(s.range).toBe('7d');
    expect(s.mealsRescued.total).toBeGreaterThan(0);
    expect(donationsSerializer(ok('donations'))!.items[0].to).toBeTruthy();
  });
});

describe('Bachat Box', () => {
  it('reads the kitchen’s boxes, the customer’s cards and page, and the empty suggestion', () => {
    const boxes = liveBoxesSerializer(ok('boxes'));
    expect(boxes.every(b => b.status === 'live' || b.status === 'sold_out')).toBe(true);
    const cards = surplusCardsSerializer(ok('nearby'));
    expect(cards.length).toBeGreaterThan(0);
    expect(cards[0].pickupLabel).toMatch(/AM|PM/);
    const page = surplusDetailSerializer({ box: ok('boxPage'), mine: ok('myReservations') })!;
    expect(page.paymentMethods).toContain('pay_at_pickup');
    expect(page.maxPerCustomer).toBe(10);
    expect(page.pickup.lat).not.toBeNull();
    expect(surplusSuggestionSerializer(ok('boxSuggestion'))).toBeNull();
  });

  it('reads reservations by id, with the accounts while a transfer is owed', () => {
    const t = reservationSerializer(ok('reserveTransfer'))!;
    expect(t).toMatchObject({ id: expect.any(String), code: expect.stringMatching(/^BB-/), payment: { method: 'transfer', status: 'awaiting_transfer' } });
    expect(t.payment.accounts?.length).toBeGreaterThan(0);
    const list = reservationsSerializer(ok('reservations'));
    expect(list.every(r => r.id && r.customerName !== undefined)).toBe(true);
    expect(myReservationSerializer(ok('myReservations'), t.code)).not.toBeNull();
    expect(reservationSerializer(ok('collected'))!.status).toBe('collected');
  });
});

describe('tiffin and catering', () => {
  it('reads plans (ISO weekdays, the evening-before cut-off) and subscriptions by id', () => {
    const p = tiffinPlanSerializer(ok('tiffinPlanPage'))!;
    expect(p.days.every(d => d >= 1 && d <= 7)).toBe(true);
    expect(p.skipCutoffHour).toBeGreaterThanOrEqual(0);
    expect(p.window.label).toMatch(/PM|AM/);
    expect(p.rotation.every(r => r.dishes.every(d => d.name))).toBe(true);
    expect(tiffinPlansSerializer(ok('tiffinVendorPlans')).length).toBeGreaterThan(0);
    const s = tiffinSubscriptionSerializer(ok('tiffinSubscribe'))!;
    expect(s.status).toBe('pending');
    const mine = myTiffinSerializer(ok('tiffinMine'), s.code)!;
    expect(mine.vendor.name).toBeTruthy();
    expect(tiffinCalendarSerializer(ok('tiffinCalendar')).days.length).toBeGreaterThan(0);
    expect(tiffinInboxSerializer(ok('tiffinSubscriptions')).items.length).toBeGreaterThan(0);
    expect(tiffinTomorrowSerializer(ok('tiffinTomorrow')).plans.length).toBeGreaterThan(0);
    expect(tiffinTomorrowSerializer(staff('GET /food/vendor/tiffin/tomorrow')).date).toMatch(DATE);
  });

  it('reads a dawat by its code, its quotes and the advance', () => {
    const CAPTURED_AT = Date.parse('2026-11-02T00:00:00.000Z');
    const r = cateringRequestSerializer(ok('cateringRequest'))!;
    expect(r).toMatchObject({ id: expect.any(String), code: expect.stringMatching(/^CT-/), status: 'requested', eventType: 'dawat' });
    // Read at capture time: the quote's validity is relative to the day it was captured.
    const quoted = cateringRequestSerializer(ok('cateringQuote2'), CAPTURED_AT)!;
    expect(quoted.quotes[0]).toMatchObject({ version: 2, state: 'current' });
    expect(quoted.quotes[0].lines.every(l => l.total === l.qty * l.unitPrice)).toBe(true);
    const accepted = cateringRequestSerializer(ok('cateringAccept'))!;
    expect(accepted.advance).toMatchObject({ status: 'awaiting_transfer', amount: expect.any(Number) });
    expect(cateringRequestSerializer(ok('cateringAdvanceProof'))!.advance!.status).toBe('proof_submitted');
    expect(cateringRequestSerializer(ok('cateringAdvanceConfirm'))!.advance!.status).toBe('paid');
    expect(cateringRequestSerializer(ok('cateringDecline'))!.declineReason).toBeTruthy();
    expect(cateringRequestByCodeSerializer(ok('cateringMine'), r.code)).not.toBeNull();
    expect(cateringInboxSerializer(ok('cateringRequests')).items.length).toBeGreaterThan(0);
    expect(cateringCalendarSerializer(ok('cateringRequests'), r.date.slice(0, 7)).month).toBe(r.date.slice(0, 7));
    expect(cateringVendorSerializer(ok('cateringVendor'))!.modes.length).toBeGreaterThan(0);
    expect(cateringSettingsSerializer(ok('cateringSettings')).minGuests).toBeGreaterThan(0);
  });
});

describe('reaching customers', () => {
  it('reads Ramadan, the storefront, story and hygiene, demand, menu engineering and experiments', () => {
    const r = ramadanSettingsSerializer(ok('ramadan'));
    expect(r.iftar.label).toMatch(/PM/);
    const sf = storefrontSerializer(ok('storefront'));
    expect(sf.qrUrl).toMatch(/src=qr/);
    expect(storySerializer(ok('story')).cookName).toBeTruthy();
    const h = hygieneSerializer(ok('story'));
    expect(h.items).toHaveLength(6);
    expect(['none', 'self_declared', 'verified']).toContain(h.status);
    const d = demandMapSerializer({ map: ok('demandMap'), curve: ok('demandCurve') });
    expect(d.minCount).toBeGreaterThanOrEqual(10);
    expect(d.cells.every(c => c.searches >= d.minCount)).toBe(true);
    expect(d.hourCurve.own).toHaveLength(24);
    const m = menuInsightsSerializer({ data: ok('menuEngineering'), experiments: ok('experiments') });
    expect(m.items.length).toBeGreaterThan(0);
    expect(m.items.every(i => ['star', 'plowhorse', 'puzzle', 'dog', 'unknown'].includes(i.quadrant))).toBe(true);
    expect(experimentsSerializer(ok('experiments')).length).toBeGreaterThan(0);
    expect(experimentSerializer(ok('experimentStart'))!.status).toBe('running');
    expect(batchSuggestionsSerializer({ success: true, data: { batchWith: [{ orderId: 'o', code: 'FC-X', bearingDiff: 10, extraKm: 1.2 }] } })).toEqual([{ orderId: 'o', code: 'FC-X', extraKm: 1.2, sameDirection: true, readyAt: null }]);
  });
});

describe('the assistant, with AI off', () => {
  it('reads the meter and the manual path', () => {
    expect(aiUsageSerializer(ok('aiUsage'))).toMatchObject({ enabled: false, limit: 300, voice: { limit: 120 } });
    expect(body('describeErr').error?.code).toBe('AI_UNAVAILABLE');
    expect(body('receiptScanErr').error?.code).toBe('AI_UNAVAILABLE');
    expect(specialIdeasSerializer(ok('specialsErr'))).toMatchObject({ items: [], message: expect.any(String) });
    const combos = comboIdeasSerializer(ok('combos'));
    expect(combos.items.length).toBeGreaterThan(0);
    expect(combos.items[0].name).toContain('+');
    expect(reviewInsightsWaitSerializer(ok('reviewInsights'))).toMatchObject({ needed: 5 });
    expect(reviewInsightsSerializer(staff('GET /food/vendor/kitchen/review-insights'))).not.toBeNull();
    expect(announcementSerializer({ success: true, data: { orderId: 'o', text: 'Naya order' } })).toMatchObject({ text: 'Naya order', language: 'ur' });
  });

  it('turns spoken commands into the API’s own requests, and notes what is missing', () => {
    const p = voiceResultSerializer(ok('voicePurchase'))!;
    expect(p.action).toMatchObject({ kind: 'purchase.add', request: { method: 'POST', path: '/food/vendor/kitchen/purchases' } });
    const t = voiceResultSerializer(ok('voiceToday'))!;
    expect(t.action).toMatchObject({ kind: 'portions.set', request: { method: 'PATCH', path: '/food/vendor/today' } });
    const pantry = voiceResultSerializer(ok('voicePantry'))!;
    expect(pantry.action).toMatchObject({ kind: 'pantry.add', request: { path: '/my-kitchen/pantry/batch' } });
    const board = voiceResultSerializer(ok('voiceBoard'))!;
    expect(board.note).toBeTruthy();
    expect(body('voiceUnclearErr').error?.code).toBe('VOICE_UNCLEAR');
  });

  it('reads the kitchen’s nutrition and the reference foods', () => {
    const n = vendorNutritionSerializer({ items: ok('nutritionItems'), mapping: ok('nutritionMapping') });
    expect(n.items.length).toBeGreaterThan(0);
    expect(n.items[0].kcal).toBeGreaterThan(0);
    expect(dishNutritionSerializer(ok('nutritionItem'), 'A dish')!.method).toBe('recipe');
    expect(nutritionFoodsSerializer(ok('nutritionFoods')).every(f => f.per === 'g100')).toBe(true);
  });
});

describe('My Kitchen and nutrition for customers', () => {
  it('reads the pantry in base units, its numbers, reminders and grocery lines', () => {
    const list = pantryListSerializer({ items: ok('pantry'), active: ok('pantry'), expiring: ok('pantryExpiring'), expired: { success: true, data: { items: [], total: 0 } } });
    expect(list.items.length).toBeGreaterThan(0);
    expect(list.items.every(i => ['g', 'ml', 'pc'].includes(i.unit))).toBe(true);
    expect(pantryItemsSerializer(ok('pantryAdd'))).toHaveLength(1);
    expect(pantryItemsSerializer(ok('pantryBatch')).length).toBeGreaterThan(1);
    expect(pantryUsedUpSerializer(ok('pantryUsed'))).toMatchObject({ usedUp: true });
    expect(pantryStatsSerializer({ stats: ok('pantryStats'), active: ok('pantry') })).toMatchObject({ used: 1, wasted: 1 });
    // GET /my-kitchen/pantry/reminders (docs/API_KITCHEN.md §35): on, 09:00, 2 days before until changed.
    expect(pantryRemindersSerializer({ success: true, data: { enabled: true, time: '09:00', daysBefore: 2 } })).toEqual({ enabled: true, time: '09:00', daysBefore: 2 });
    expect(groceryOrdersSerializer(ok('pantryFromOrders'))).toEqual([]);
  });

  it('reads recipe ideas, one recipe and what is missing from Shopping', () => {
    const ideas = recipeIdeasSerializer(ok('recipesSuggest'));
    expect(ideas.length).toBeGreaterThan(0);
    expect(ideas[0].titleUr).toBeTruthy();
    const one = homeRecipeSerializer(ok('recipesSuggest'), ideas[0].id)!;
    expect(one.steps.length).toBeGreaterThan(0);
    expect(one.ingredients.some(i => i.have)).toBe(true);
    const missing = missingItemsSerializer(ok('missingToBag'));
    expect(missing[0].options[0]).toMatchObject({ variantId: expect.any(String), store: { deliversToYou: expect.any(Boolean) } });
  });

  it('reads the nutrition profile (none is off), and the week', () => {
    expect(nutritionSettingsSerializer(ok('profile'))).toMatchObject({ enabled: true, manualTargetKcal: 1900 });
    expect(nutritionSettingsSerializer(null).enabled).toBe(false);
    expect(R.profileNoneErr.status).toBe(404);
    const s = nutritionSummarySerializer(ok('nutritionSummary'))!;
    expect(s.days.length).toBeGreaterThan(0);
    expect(s.from).toMatch(DATE);
  });
});

describe('the staff console’s Kitchen tools', () => {
  it('reads the assistant’s use, imports, foods, words, the calendar and signatures', () => {
    const ai = aiUsageReportSerializer({ usage: staff('GET /admin/ai/usage'), settings: staff('GET /admin/ai/settings') })!;
    expect(ai.byFeature.length).toBeGreaterThan(0);
    expect(ai.byBusiness.length).toBeGreaterThan(0);
    expect(priceImportSerializer(staff('POST /admin/kitchen/reference-prices/import'))).toMatchObject({ rows: expect.any(Number), summary: expect.any(String) });
    expect(nutritionFoodImportSerializer(staff('POST /admin/nutrition/foods/import'))).toMatchObject({ summary: expect.stringMatching(/new/) });
    expect(staffNutritionFoodsSerializer(staff('GET /admin/nutrition/foods')).items[0]).toMatchObject({ key: expect.any(String), per: 'g100' });
    expect(aliasesSerializer(staff('GET /admin/kitchen/aliases')).items[0]).toMatchObject({ word: expect.any(String), language: expect.stringMatching(/ur|roman|en/), key: expect.any(String) });
    expect(calendarEventsSerializer(staff('GET /admin/food/calendar-events'))[0]).toMatchObject({ kind: expect.any(String), days: expect.any(Number) });
    const sig = signatureListSerializer({ claimed: staff('GET /admin/food/signatures', 0), removed: staff('GET /admin/food/signatures') }, 'removed');
    expect(sig.items.every(s => s.recipeCardId)).toBe(true);
  });

  it('reads the hygiene list, the platform demand map and every kind of lookup', () => {
    const h = hygieneQueueSerializer(staff('GET /admin/food/hygiene'));
    expect(h[0]).toMatchObject({ brandId: expect.any(String), items: expect.any(Array) });
    expect(h[0].items).toHaveLength(6);
    const d = adminDemandSerializer({ map: staff('GET /admin/food/demand-map'), cities: staff('GET /admin/food/demand-map/cities') });
    expect(d.cities.length).toBeGreaterThan(0);
    const kinds = STAFF['GET /admin/food/lookup'].map(x => growthLookupSerializer(x.body)?.kind);
    expect(new Set(kinds)).toEqual(new Set(['tiffin', 'catering', 'order']));
  });
});
