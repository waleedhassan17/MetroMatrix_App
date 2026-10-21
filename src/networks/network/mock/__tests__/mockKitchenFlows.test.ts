// The dummy Kitchen Intelligence API (docs/API_KITCHEN_ASSUMED.md), driven
// through the REAL networks: stock in base units with first-expiring-first
// out; an accepted order takes its recipes from stock and a declined one
// gives them back; a dish sells out by itself when its recipe can't be made,
// and a purchase brings it back; the packing photo a kitchen can require;
// recipe costs against the target; forecasts that are honest while still
// learning; waste; Bachat Box (one box can't be sold twice); voice that only
// proposes; the assistant's switch and quota; a pause that lifts by itself.

import { authAdminTotp, authSignin } from '../../../auth/authNetwork';
import { addToFoodCart, clearFoodCart } from '../../../food/cartNetwork';
import { getFoodOrder, placeFoodOrder } from '../../../food/ordersNetwork';
import { acceptOrder, markReady, rejectOrder, startPreparing } from '../../../food/vendor/ordersNetwork';
import { getVendorPage } from '../../../food/discoveryNetwork';
import { getVendorProfile, pauseOrders } from '../../../food/vendor/profileNetwork';
import { getIngredient, listStock, recordStockTake } from '../../../kitchen/stockNetwork';
import { createPurchase, getPriceWatch, listPurchases } from '../../../kitchen/purchasesNetwork';
import { getRecipe, listRecipes, saveRecipe } from '../../../kitchen/recipesNetwork';
import { getBoardHints, updateKitchenSettings } from '../../../kitchen/costingNetwork';
import { adjustForecast, getForecast, getForecastAccuracy, getPrepSheet, getShoppingList } from '../../../kitchen/forecastNetwork';
import { getWasteSummary, logDonation, logWaste } from '../../../kitchen/wasteNetwork';
import { collectReservation, createBox, getBox } from '../../../kitchen/surplusNetwork';
import { attachPackingPhoto, getAnnouncement } from '../../../kitchen/packingNetwork';
import { getAiUsage, scanReceipt } from '../../../kitchen/kitchenAiNetwork';
import { getKitchenHub, listInsightCards, snoozeInsightCard } from '../../../kitchen/insightsCardsNetwork';
import { interpretVoice } from '../../../ai/voiceNetwork';
import { listSurplusNearby, reserveSurplus } from '../../../food/surplusNetwork';
import { listBoard } from '../../../food/vendor/ordersNetwork';
import {
  createTiffinPlan,
  getMyTiffin,
  getTiffinCalendar,
  getTiffinTomorrow,
  listTiffinSubscriptions,
  moveSubscriber,
  skipTiffinDay,
  subscribeTiffin,
} from '../../../foodGrowth/tiffinNetwork';
import { acceptQuote, confirmAdvance, getMyCatering, requestCatering, sendQuote, submitAdvanceProof } from '../../../foodGrowth/cateringNetwork';
import { getRamadan, listIftarNearby, updateRamadan } from '../../../foodGrowth/ramadanNetwork';
import { getStorefront } from '../../../foodGrowth/storefrontNetwork';
import { getDemand } from '../../../foodGrowth/demandNetwork';
import { decideExperiment, getExperiment, getMenuInsights, startExperiment } from '../../../foodGrowth/experimentsNetwork';
import { getHygiene, requestHygieneVerification, saveStory, setHygieneItem } from '../../../foodGrowth/storyNetwork';
import { getBatchSuggestions } from '../../../foodGrowth/batchingNetwork';
import {
  approveSignature,
  createAlias,
  createCalendarEvent,
  getAiUsageReport,
  getPlatformDemand,
  getReferencePrices,
  importNutritionFoods,
  importReferencePrices,
  listHygieneQueue,
  listSignatures,
  lookupGrowthCode,
  rejectHygiene,
  removeSignature,
  setAiQuota,
  updateCalendarEvent,
  updateNutritionFood,
  listNutritionFoods,
  verifyHygiene,
} from '../../../admin/adminKitchenNetwork';
import { listVendors } from '../../../food/discoveryNetwork';
import { getRiderOrder, setDuty } from '../../../food/rider/riderNetwork';
import { assignRider } from '../../../food/vendor/ordersNetwork';
import { ramadanSwitch } from '../../../../models/kitchen/reachModel';
import { checkPhoto, draftDescriptions, getReviewInsights, saveDescription, suggestCombos, suggestSpecials } from '../../../kitchen/kitchenAiNetwork';
import { getVendorNutrition, mapIngredientNutrition, setNutritionHidden } from '../../../kitchen/nutritionNetwork';
import { createMenuItem, getMenuItem } from '../../../food/vendor/menuNetwork';
import { getItemSheet } from '../../../food/discoveryNetwork';
import { listReviewsByTheme } from '../../../food/vendor/reviewsNetwork';
import { comboItemInput, specialItemInput, specialRecipe } from '../../../../models/kitchen/assistantModel';
import { isUrduScript } from '../../../../utils/script';
import { addToPantry, listPantry } from '../../../myKitchen/pantryNetwork';
import { getHomeRecipe, getMissingItems, suggestHomeRecipes } from '../../../myKitchen/recipesNetwork';
import { deleteNutritionData, getNutritionSettings, getNutritionSummary, listHealthyPicks, saveNutritionSettings } from '../../../myKitchen/nutritionNetwork';
import { searchFood } from '../../../food/discoveryNetwork';
import { addToCart as addToShopCart, getCart as getShopCart } from '../../../shopping/cartNetwork';
import { handedExternal, markDelivered } from '../../../food/vendor/ordersNetwork';
import { api, AuthError } from '../../apiHelpers';
import { clearTokens } from '../../../../utils/storageUtils';
import { MOCK, SEED_PASSWORD, STAFF_PASSWORD } from '../mockConfig';
import { getDb, resetMockDb } from '../mockDb';
import type { FoodCheckoutInput } from '../../../../types/food';

// Thursday 15 October 2026, 3 PM in Pakistan: Biryani Bazaar is open.
const T0 = new Date('2026-10-15T10:00:00Z').getTime();
const MINUTE = 60_000;
const GULBERG = { lat: 31.5102, lng: 74.3441 };

const failure = async (p: Promise<unknown>): Promise<AuthError> => {
  try {
    await p;
  } catch (e) {
    return e as AuthError;
  }
  throw new Error('expected the call to fail');
};

const as = async (email: string, portal: 'customer' | 'partner' = 'partner') => {
  await clearTokens();
  await authSignin({ email, password: SEED_PASSWORD, portal });
};
const asVendor = () => as('restaurant@metromatrix.app');
const asCustomer = (email = 'customer@metromatrix.app') => as(email, 'customer');
const asStaff = async () => {
  await clearTokens();
  const outcome = await authSignin({ email: 'admin@metromatrix.app', password: STAFF_PASSWORD, portal: 'admin' });
  if (outcome.kind !== 'totp') throw new Error('expected a challenge');
  await authAdminTotp(outcome.challenge.challengeToken, { code: MOCK.TOTP_CODE });
};

const checkout: FoodCheckoutInput = { addressId: 'ad_customer_home', paymentMethod: 'cod', promoCode: null, cutlery: false, note: null, building: null, floor: null, riderInstructions: null };
let keyN = 0;
const key = () => `kitchen-key-${++keyN}`;

/** A customer orders `quantity` Single chicken biryanis from Biryani Bazaar. */
const orderBiryani = async (quantity = 2) => {
  await asCustomer();
  await clearFoodCart();
  await addToFoodCart({ vendorId: 'fb_resto', itemId: 'mi_chicken_biryani', variantId: 'mi_chicken_biryani_v1', optionIds: ['og_spice_1'], quantity, notes: null }, true);
  return placeFoodOrder(checkout, key());
};

const onHand = async (id: string) => (await getIngredient(id)).onHand;

beforeAll(() => {
  jest.useFakeTimers({ doNotFake: ['setTimeout', 'setInterval', 'setImmediate', 'nextTick', 'queueMicrotask'] });
});
afterAll(() => jest.useRealTimers());

beforeEach(async () => {
  jest.setSystemTime(T0);
  await resetMockDb();
  await asVendor();
});

describe('stock', () => {
  it('lists stock by segment with counts, in base units', async () => {
    const all = await listStock('all', '');
    expect(all.counts.all).toBeGreaterThan(25);
    expect(all.counts.negative).toBe(1);
    const chicken = all.items.find(i => i.id === 'ing_bb_chicken')!;
    expect(chicken).toMatchObject({ baseUnit: 'g', onHand: 16000, expiring: { on: '2026-10-16', qty: 4000 } });
    const neg = await listStock('negative', '');
    expect(neg.items.map(i => i.name)).toEqual(['Cream']);
    expect((await listStock('all', 'tamatar')).items.map(i => i.name)).toEqual(['Tomato']);
  });

  it('records a six-item stock take and shows the movements (QA 5)', async () => {
    const ids = ['ing_bb_chicken', 'ing_bb_rice', 'ing_bb_onion', 'ing_bb_yoghurt', 'ing_bb_cream', 'ing_bb_salt'];
    const r = await recordStockTake(ids.map((ingredientId, n) => ({ ingredientId, counted: [15000, 22000, 11000, 1500, 500, 5000][n] })));
    expect(r.adjusted).toBe(3);
    expect(r.lines.find(l => l.ingredientId === 'ing_bb_cream')).toMatchObject({ before: -200, counted: 500, change: 700 });
    const cream = await getIngredient('ing_bb_cream');
    expect(cream.onHand).toBe(500);
    expect(cream.state).toBe('low');
    expect(cream.movements[0]).toMatchObject({ kind: 'count', qty: 700 });
  });

  it('takes an accepted order’s recipes from stock and gives them back when it is declined', async () => {
    const o1 = await orderBiryani(2);
    await asVendor();
    const before = await onHand('ing_bb_chicken');
    await acceptOrder(o1.id, 20);
    // Two Single biryanis: 150 g of chicken each.
    expect(await onHand('ing_bb_chicken')).toBe(before - 300);
    const o2 = await orderBiryani(1);
    await asVendor();
    await rejectOrder(o2.id, 'too_busy');
    expect(await onHand('ing_bb_chicken')).toBe(before - 300);
    const detail = await getIngredient('ing_bb_chicken');
    expect(detail.movements.find(m => m.kind === 'usage' && m.orderCode === o1.code)?.qty).toBe(-300);
  });

  it('sells a dish out when its recipe can’t be made, and a purchase brings it back (QA 21)', async () => {
    // 7 PM, when BBQ is served. Cream is recorded below zero: Malai Boti can't be made.
    jest.setSystemTime(T0 + 4 * 60 * MINUTE);
    const hints = await getBoardHints();
    expect(hints.soldOutByStock.map(x => x.itemId)).toContain('mi_malai');
    const page = await getVendorPage('biryani-bazaar', GULBERG);
    const malai = page.menu.flatMap(c => c.items).find(i => i.id === 'mi_malai')!;
    expect(malai).toMatchObject({ available: false, unavailableReason: 'ingredients' });
    const p = await createPurchase({ source: 'voice', supplierName: 'Gulberg Cash & Carry', lines: [{ ingredientId: 'ing_bb_cream', qty: 2, unit: 'kg', total: 1800 }] });
    expect(p.lines[0]).toMatchObject({ qty: 2000, total: 1800, costPerBase: 0.9 });
    expect(await onHand('ing_bb_cream')).toBe(1800);
    expect((await getBoardHints()).soldOutByStock.map(x => x.itemId)).not.toContain('mi_malai');
    const after = (await getVendorPage('biryani-bazaar', GULBERG)).menu.flatMap(c => c.items).find(i => i.id === 'mi_malai')!;
    expect(after.available).toBe(true);
  });

  it('adds a purchase with a new ingredient and converts the units', async () => {
    const p = await createPurchase({
      source: 'receipt',
      lines: [
        { ingredientId: 'ing_bb_tomato', qty: 5, unit: 'kg', total: 1200 },
        { newIngredient: { name: 'Shimla mirch (capsicum)', category: 'vegetables', baseUnit: 'g' }, qty: 1, unit: 'kg', total: 280 },
      ],
    });
    expect(p.total).toBe(1480);
    expect(p.lines.map(l => l.qty)).toEqual([5000, 1000]);
    const list = await listPurchases(1, 20);
    expect(list.items[0].id).toBe(p.id);
    expect(list.weekTotal).toBeGreaterThanOrEqual(1480);
    const err = await failure(createPurchase({ source: 'manual', lines: [{ ingredientId: 'ing_bb_tomato', qty: 2, unit: 'L', total: 100 }] }));
    expect(err.code).toBe('VALIDATION_FAILED');
  });

  it('shows ingredients above the city price with a trend (QA 11)', async () => {
    const w = await getPriceWatch();
    const tomato = w.items.find(i => i.name === 'Tomato')!;
    expect(tomato.diffPct).toBeGreaterThanOrEqual(10);
    expect(tomato.trend).toHaveLength(8);
    expect(w.items.some(i => i.name === 'Salt')).toBe(false);
  });
});

describe('recipes and costs', () => {
  it('costs a recipe against the target and lists the dishes that need one (QA 8, 9)', async () => {
    const list = await listRecipes(false);
    expect(list.targetFoodCostPct).toBe(40);
    const mutton = list.items.find(r => r.itemId === 'mi_mutton_karahi')!;
    expect(mutton.cost?.overTarget).toBe(true);
    const needs = await listRecipes(true);
    expect(needs.items.map(r => r.itemId)).toEqual(expect.arrayContaining(['mi_sindhi_biryani', 'mi_kheer', 'mi_soft']));
    expect(needs.items.every(r => r.status !== 'complete')).toBe(true);
  });

  it('saves a recipe and answers its cost to make', async () => {
    const r = await saveRecipe('mi_sindhi_biryani', null, {
      yield: 1,
      lines: [
        { ingredientId: 'ing_bb_chicken', qty: 150 },
        { ingredientId: 'ing_bb_rice', qty: 140 },
        { ingredientId: 'ing_bb_potato', qty: 60 },
      ],
      addOns: [],
      packaging: [{ ingredientId: 'ing_bb_box_biryani', qty: 1 }],
      signature: { on: false, creatorName: null },
    });
    expect(r.cost?.sellPrice).toBe(780);
    expect(r.cost?.toMake).toBeGreaterThan(100);
    expect(r.cost!.keep).toBe(780 - r.cost!.toMake);
    const back = await getRecipe('mi_sindhi_biryani');
    expect(back.lines).toHaveLength(3);
    const err = await failure(saveRecipe('mi_sindhi_biryani', null, { yield: 1, lines: [], addOns: [], packaging: [], signature: { on: false, creatorName: null } }));
    expect(err.code).toBe('VALIDATION_FAILED');
  });
});

describe('the hub', () => {
  it('opens with at most five cards, the most urgent first, and snoozes one for a day', async () => {
    const hub = await getKitchenHub();
    expect(hub.cards.length).toBeLessThanOrEqual(5);
    expect(hub.cards[0].kind).toBe('expiring_stock');
    expect(hub.cards[0].title).toBe('4 kg chicken (curry cut) expires tomorrow');
    expect(hub.cards.map(c => c.kind)).toEqual(expect.arrayContaining(['negative_stock', 'food_cost_high']));
    expect(hub.summary.stock.negative).toBe(1);
    expect(hub.usage?.left).toBe(300);
    await snoozeInsightCard(hub.cards[0].id);
    expect((await getKitchenHub()).cards.some(c => c.id === hub.cards[0].id)).toBe(false);
    jest.setSystemTime(T0 + 25 * 60 * MINUTE);
    expect((await getKitchenHub()).cards.some(c => c.kind === 'expiring_stock')).toBe(true);
  });
});

describe('forecast and prep', () => {
  it('forecasts with a range from ten weeks, and adjusting a dish moves the prep sheet (QA 14)', async () => {
    const f = await getForecast('2026-10-16');
    expect(f.learning).toBe(false);
    const biryani = f.items.find(i => i.itemId === 'mi_chicken_biryani')!;
    expect(biryani.low).toBeLessThanOrEqual(biryani.expected);
    expect(biryani.high).toBeGreaterThanOrEqual(biryani.expected);
    const chicken = (s: Awaited<ReturnType<typeof getPrepSheet>>) => s.groups.flatMap(g => g.lines).find(l => l.ingredientId === 'ing_bb_chicken')!.qty;
    const before = chicken(await getPrepSheet('2026-10-16'));
    await adjustForecast('2026-10-16', 'mi_chicken_biryani', biryani.expected + 10);
    expect(chicken(await getPrepSheet('2026-10-16'))).toBe(before + 1500);
    const list = await getShoppingList('2026-10-16');
    expect(list.shareText).toContain('To buy for');
    expect((await getForecastAccuracy()).accuracyPct).not.toBeNull();
  });

  it('says it is still learning with under 14 days of history (QA 13)', async () => {
    await as('nani@metromatrix.app');
    const f = await getForecast('2026-10-16');
    expect(f.learning).toBe(true);
    const qorma = f.items.find(i => i.itemId === 'mi_nani_qorma')!;
    expect(qorma.high - qorma.low).toBeGreaterThanOrEqual(qorma.expected);
    expect((await getForecastAccuracy()).accuracyPct).toBeNull();
  });
});

describe('waste and donations', () => {
  it('logs waste at what it cost and counts rescued meals', async () => {
    const w = await logWaste([{ ingredientId: 'ing_bb_onion', qty: 2, unit: 'kg', reason: 'spoiled' }]);
    expect(w.lines[0]).toMatchObject({ qty: 2000, reason: 'spoiled' });
    expect(w.cost).toBeGreaterThan(0);
    await logDonation({ meals: 8, to: 'Edhi centre, Gulberg' });
    const s = await getWasteSummary('7d');
    expect(s.cost).toBeGreaterThanOrEqual(w.cost);
    expect(s.mealsRescued.total).toBeGreaterThanOrEqual(20);
  });
});

describe('the board', () => {
  it('can require a packing photo before ready, and checks it if the assistant is on', async () => {
    await updateKitchenSettings({ packingPhoto: 'required' });
    const o = await orderBiryani(1);
    await asVendor();
    await acceptOrder(o.id, 15);
    await startPreparing(o.id);
    expect((await failure(markReady(o.id))).code).toBe('PACKING_PHOTO_REQUIRED');
    const r = await attachPackingPhoto(o.id, 'https://res.cloudinary.com/demo/packed.jpg');
    expect(r.check?.note).toBeTruthy();
    await markReady(o.id);
    await asCustomer();
    expect((await getFoodOrder(o.code)).packedPhotoUrl).toBe('https://res.cloudinary.com/demo/packed.jpg');
  });

  it('speaks a new order in Urdu or English', async () => {
    const o = await orderBiryani(2);
    await asVendor();
    const ur = await getAnnouncement(o.id, 'ur');
    expect(ur.text).toMatch(/^نیا آرڈر/);
    expect(ur.ttsUrl).toBeNull();
    const en = await getAnnouncement(o.id, 'en');
    expect(en.text).toContain('2 Chicken Biryani');
  });

  it('pauses for a private reason and resumes by itself (QA 19)', async () => {
    const at = new Date(T0 + 30 * MINUTE).toISOString();
    const p = await pauseOrders(null, { reason: 'gas', resumeAt: at });
    expect(p.branch.isPaused).toBe(true);
    const raw = (await api.get('/food/vendor/profile')).data.data;
    expect(raw.branch).toMatchObject({ pauseReason: 'gas', resumeAt: at });
    await asCustomer();
    const page = (await api.get('/food/vendors/biryani-bazaar')).data.data;
    expect(JSON.stringify(page)).not.toContain('gas');
    jest.setSystemTime(T0 + 31 * MINUTE);
    await asVendor();
    expect((await getVendorProfile()).branch.isPaused).toBe(false);
  });
});

describe('Bachat Box', () => {
  const box = () => ({
    title: 'Chef’s mix box',
    contentsHint: 'Biryani and kebabs from today',
    value: 1200,
    price: 450,
    quantity: 1,
    pickupFrom: new Date(T0 + 60 * MINUTE).toISOString(),
    pickupTo: new Date(T0 + 180 * MINUTE).toISOString(),
  });

  it('shows a new box nearby, and the last one goes to one customer only (QA 22, 23)', async () => {
    const b = await createBox(box());
    await asCustomer();
    const near = await listSurplusNearby(GULBERG);
    expect(near.map(x => x.id)).toContain(b.id);
    const r1 = await reserveSurplus(b.id, { quantity: 1, paymentMethod: 'pay_at_pickup' }, 'race-1');
    expect(r1.code).toMatch(/^BB-[A-Z2-9]{6}$/);
    // A retry with the same key replays; it never reserves twice.
    expect((await reserveSurplus(b.id, { quantity: 1, paymentMethod: 'pay_at_pickup' }, 'race-1')).code).toBe(r1.code);
    await asCustomer('hamza@metromatrix.app');
    const err = await failure(reserveSurplus(b.id, { quantity: 1, paymentMethod: 'pay_at_pickup' }, 'race-2'));
    expect(err.code).toBe('SURPLUS_SOLD_OUT');
    expect(err.details).toMatchObject({ left: 0 });
    await asVendor();
    const c = await collectReservation(r1.code.toLowerCase());
    expect(c).toMatchObject({ status: 'collected', payment: { status: 'paid' } });
    expect((await getBox(b.id)).collected).toBe(1);
  });

  it('refuses a box that isn’t a saving', async () => {
    expect((await failure(createBox({ ...box(), price: 1100 }))).code).toBe('VALIDATION_FAILED');
  });
});

describe('tiffin', () => {
  const asNani = () => as('nani@metromatrix.app');

  it('puts a new plan on the kitchen’s page (QA 25)', async () => {
    await asNani();
    const p = await createTiffinPlan({
      name: 'Breakfast paratha box',
      meal: 'breakfast',
      days: [1, 2, 3, 4, 5, 6],
      period: 'week',
      price: 1800,
      mode: 'pickup',
      window: { from: '08:00', to: '09:30' },
      capacity: 10,
      skipCutoffHours: 10,
      rotation: [1, 2, 3, 4, 5, 6].map(weekday => ({ weekday, itemIds: [], note: 'Aloo paratha, omelette and chai' })),
    });
    expect(p).toMatchObject({ perMeal: 300, mealsPerPeriod: 6, seatsLeft: 10 });
    await asCustomer();
    const page = await getVendorPage('nani-ki-handi', GULBERG);
    expect(page.tiffinPlans.map(x => x.name)).toEqual(expect.arrayContaining(['Office lunch tiffin', 'Breakfast paratha box']));
    expect(page.catering).toMatchObject({ open: true });
  });

  it('starts pending, is approved, and the calendar shows the deliveries (QA 26)', async () => {
    await asCustomer();
    const s = await subscribeTiffin('tp_nani_lunch', { startDate: '2026-10-16', addressId: 'ad_customer_home', paymentMethod: 'transfer' }, key());
    expect(s).toMatchObject({ status: 'pending', period: null });
    await as('nani@metromatrix.app');
    expect((await listTiffinSubscriptions('pending')).items.map(x => x.code)).toContain(s.code);
    const a = await moveSubscriber(s.code, { kind: 'approve' });
    expect(a).toMatchObject({ status: 'active', period: { from: '2026-10-16', to: '2026-10-22', amount: 2300, payment: { status: 'awaiting_transfer' } } });
    await asCustomer();
    const cal = await getTiffinCalendar(s.code, '2026-10');
    const state = (d: string) => cal.days.find(x => x.date === d)!.state;
    expect([state('2026-10-15'), state('2026-10-16'), state('2026-10-17'), state('2026-10-19')]).toEqual(['before_start', 'upcoming', 'off', 'upcoming']);
    expect(cal.days.find(x => x.date === '2026-10-16')!.dishes).toEqual(['Chicken pulao']);
  });

  it('skips a day before its cut-off, not after, and takes it off the next period (QA 27)', async () => {
    await asCustomer();
    const s = await subscribeTiffin('tp_nani_lunch', { startDate: '2026-10-16', addressId: 'ad_customer_home', paymentMethod: 'cash' }, key());
    await as('nani@metromatrix.app');
    await moveSubscriber(s.code, { kind: 'approve' });
    await asCustomer();
    expect(await skipTiffinDay(s.code, '2026-10-19', true)).toMatchObject({ state: 'skipped', canUnskip: true });
    // Thursday 11 PM: Friday's cut-off (10:30 PM) has passed.
    jest.setSystemTime(T0 + 8 * 60 * MINUTE);
    const err = await failure(skipTiffinDay(s.code, '2026-10-16', true));
    expect(err.code).toBe('TIFFIN_SKIP_CLOSED');
    expect(err.details).toMatchObject({ cutoffAt: '2026-10-15T17:30:00.000Z' });
    const day = (await getTiffinCalendar(s.code, '2026-10')).days.find(x => x.date === '2026-10-16')!;
    expect(day).toMatchObject({ canSkip: false, state: 'ordered' });
    // The next week's period is Rs 460 less for the skipped Monday.
    jest.setSystemTime(Date.parse('2026-10-23T03:00:00Z'));
    expect((await getMyTiffin(s.code)).period).toMatchObject({ from: '2026-10-23', credit: 1, amount: 1840 });
  });

  it('makes tomorrow’s tiffins scheduled orders on the board at the cut-off (QA 28)', async () => {
    await asCustomer();
    const s = await subscribeTiffin('tp_nani_lunch', { startDate: '2026-10-16', addressId: 'ad_customer_home', paymentMethod: 'transfer' }, key());
    await as('nani@metromatrix.app');
    await moveSubscriber(s.code, { kind: 'approve' });
    expect((await getTiffinTomorrow()).plans[0]).toMatchObject({ name: 'Office lunch tiffin', count: 2, dishes: ['Chicken pulao'] });
    const before = (await listBoard('active')).items.filter(c => c.origin.kind === 'tiffin');
    expect(before).toHaveLength(0);
    jest.setSystemTime(T0 + 8 * 60 * MINUTE);
    const cards = (await listBoard('active')).items.filter(c => c.origin.kind === 'tiffin');
    expect(cards.map(c => c.origin.ref).sort()).toEqual([s.code, 'TF-HMZ4K2'].sort());
    expect(cards[0]).toMatchObject({ status: 'accepted', scheduledFor: '2026-10-16T07:30:00.000Z', payment: { method: 'tiffin_plan', status: 'paid' } });
  });
});

describe('catering', () => {
  const request = () =>
    requestCatering({
      vendorId: 'fb_resto',
      date: '2026-10-31',
      time: '19:30',
      guests: 60,
      eventType: 'aqiqah',
      dishes: [{ itemId: 'mi_chicken_biryani', qty: 60 }, { name: 'Zarda', qty: 60 }],
      budget: 45000,
      mode: 'delivery',
      addressId: 'ad_customer_home',
    });
  const quote = (unitPrice: number) => ({
    lines: [
      { itemId: 'mi_chicken_biryani', qty: 60, unitPrice },
      { name: 'Zarda', qty: 60, unitPrice: 110 },
    ],
    deliveryFee: 1500,
    advancePct: 30,
    validUntil: '2026-10-22T18:59:00.000Z',
  });

  it('goes request → quote → accept → advance → confirmed, and keeps every version (QA 29, 31)', async () => {
    await asCustomer();
    const r = await request();
    expect(r).toMatchObject({ status: 'requested', canAccept: false });
    await asVendor();
    const q = await sendQuote(r.code, quote(520));
    expect(q).toMatchObject({ status: 'quoted', quotes: [{ version: 1, total: 39300, advance: 11790, state: 'current' }] });
    await asCustomer();
    const a = await acceptQuote(r.code, 1);
    expect(a).toMatchObject({ status: 'accepted', acceptedVersion: 1, advance: { amount: 11790, status: 'awaiting_transfer' }, balance: 27510 });
    expect((await submitAdvanceProof(r.code, { transactionId: 'IBFT-77120', imageUrl: null })).advance).toMatchObject({ status: 'proof_submitted', reference: 'IBFT-77120' });
    await asVendor();
    expect(await confirmAdvance(r.code)).toMatchObject({ status: 'confirmed', advance: { status: 'paid' } });
  });

  it('refuses an outdated quote and an expired one (QA 30)', async () => {
    await asCustomer();
    const r = await request();
    await asVendor();
    await sendQuote(r.code, quote(520));
    await sendQuote(r.code, quote(480));
    await asCustomer();
    const outdated = await failure(acceptQuote(r.code, 1));
    expect(outdated.code).toBe('QUOTE_OUTDATED');
    expect(outdated.details).toMatchObject({ latest: 2 });
    expect((await getMyCatering(r.code)).quotes.map(x => x.state)).toEqual(['outdated', 'current']);
    jest.setSystemTime(Date.parse('2026-10-23T00:00:00Z'));
    expect((await failure(acceptQuote(r.code, 2))).code).toBe('QUOTE_EXPIRED');
  });
});

describe('Ramadan', () => {
  it('keeps the switch off outside the event and the month before it, with the reason (QA 32)', async () => {
    const r = await getRamadan();
    expect(r).toMatchObject({ state: 'none', enabled: false, opensOn: '2027-01-09', event: { name: 'Ramadan 1448', startsOn: '2027-02-08' } });
    expect(ramadanSwitch(r)).toEqual({ disabled: true, reason: 'Ramadan mode opens on Sat 9 Jan, a month before the first fast (Mon 8 Feb).' });
    const e = await failure(updateRamadan({ enabled: true }));
    expect(e.code).toBe('RAMADAN_NOT_ACTIVE');
    expect(e.details).toMatchObject({ opensOn: '2027-01-09' });
  });

  it('turns on in Ramadan, shows the hours on the page and in "Iftar near you"', async () => {
    jest.setSystemTime(Date.parse('2027-02-12T08:00:00Z'));
    await asVendor();
    expect(ramadanSwitch(await getRamadan()).disabled).toBe(false);
    const on = await updateRamadan({ enabled: true, iftar: { from: '17:45', to: '19:15' } });
    expect(on).toMatchObject({ state: 'active', enabled: true, iftar: { label: '5:45 PM – 7:15 PM' } });
    await asCustomer();
    expect((await getVendorPage('biryani-bazaar', GULBERG)).ramadan).toMatchObject({ iftar: { from: '17:45', to: '19:15' }, iftarPreorderOnly: true });
    const near = await listIftarNearby(GULBERG);
    expect(near.state).toBe('active');
    expect(near.items.map(i => i.slug)).toEqual(['biryani-bazaar']);
  });
});

describe('the storefront', () => {
  it('gives the kitchen its link and QR, and counts the orders they bring (QA 33, 34)', async () => {
    const before = await getStorefront();
    expect(before).toMatchObject({ url: 'https://metromatrix.app/s/biryani-bazaar', qrUrl: 'https://metromatrix.app/s/biryani-bazaar?via=qr', slug: 'biryani-bazaar' });
    expect(before.shareText).toContain(before.url);
    const viaLink = async (source: FoodCheckoutInput['source']) => {
      await asCustomer();
      await clearFoodCart();
      await addToFoodCart({ vendorId: 'fb_resto', itemId: 'mi_naan', variantId: null, optionIds: [], quantity: 10, notes: null }, true);
      return placeFoodOrder({ ...checkout, source }, key());
    };
    await viaLink({ kind: 'link', slug: 'biryani-bazaar' });
    await viaLink({ kind: 'qr', slug: 'biryani-bazaar' });
    // Another kitchen's link isn't this one's to count.
    await viaLink({ kind: 'link', slug: 'smash-lab' });
    await asVendor();
    const after = await getStorefront();
    expect(after.stats.link - before.stats.link).toBe(1);
    expect(after.stats.qr - before.stats.qr).toBe(1);
    expect(after.stats.app - before.stats.app).toBe(1);
  });
});

describe('demand', () => {
  it('sends only cells with enough searches, and says how many it held back (QA 35)', async () => {
    const d = await getDemand();
    expect(d.minCount).toBe(10);
    expect(d.cells.length).toBeGreaterThan(5);
    expect(d.cells.every(c => c.searches >= 10)).toBe(true);
    expect(d.hidden).toBeGreaterThan(0);
    expect(d.hourCurve.area).toHaveLength(24);
    expect(d.topUnmet[0].unmetShare).toBeGreaterThan(0.5);
    const late = await getDemand({ hour: 23 });
    expect(late.total).toBeLessThan(d.total);
  });
});

describe('menu insights and experiments', () => {
  it('puts each dish in a group with a suggestion (QA 36)', async () => {
    const m = await getMenuInsights();
    const seekh = m.items.find(i => i.itemId === 'mi_seekh')!;
    expect(seekh).toMatchObject({ quadrant: 'star', suggestion: { kind: 'keep' } });
    const naan = m.items.find(i => i.itemId === 'mi_naan')!;
    expect(naan).toMatchObject({ quadrant: 'plowhorse', suggestion: { kind: 'price', price: 70, text: expect.stringContaining('Rs 70') } });
    expect(m.items.some(i => i.quadrant === 'unknown' && i.keep === null)).toBe(true);
  });

  it('tests a price, reports a result at the end, and keeps or goes back (QA 37)', async () => {
    const e = await startExperiment({ itemId: 'mi_seekh', change: { kind: 'price', price: 990 }, days: 3 });
    expect(e).toMatchObject({ status: 'running', change: { oldPrice: 900, price: 990 }, result: null });
    expect((await getMenuInsights()).items.find(i => i.itemId === 'mi_seekh')).toMatchObject({ price: 990, experimentRunning: true });
    expect((await failure(startExperiment({ itemId: 'mi_seekh', change: { kind: 'price', price: 950 }, days: 3 }))).code).toBe('EXPERIMENT_RUNNING');
    expect((await failure(startExperiment({ itemId: 'mi_chicken_biryani', change: { kind: 'price', price: 700 }, days: 3 }))).code).toBe('EXPERIMENT_NOT_SUPPORTED');
    expect((await failure(decideExperiment(e.id, { kind: 'keep' }))).code).toBe('INVALID_TRANSITION');
    jest.setSystemTime(T0 + 4 * 86_400_000);
    await asVendor();
    const done = await getExperiment(e.id);
    expect(done.status).toBe('done');
    expect(done.result).toMatchObject({ verdict: expect.stringMatching(/keep|adjust|drop/), before: { perDay: expect.any(Number) }, during: { perDay: expect.any(Number) } });
    expect((await decideExperiment(e.id, { kind: 'drop' })).status).toBe('dropped');
    expect((await getMenuInsights()).items.find(i => i.itemId === 'mi_seekh')).toMatchObject({ price: 900, experimentRunning: false });
  });
});

describe('story and hygiene', () => {
  it('shows the verified badge only after staff verify the checklist (QA 38)', async () => {
    await as('nani@metromatrix.app');
    await saveStory({ text: 'Nani has cooked for the whole street since 1985; now she cooks for you.', cookName: 'Nasreen Begum', photoUrls: [], videoUrl: null });
    const h = await getHygiene();
    expect(h.status).toBe('self_declared');
    await setHygieneItem('water', { done: true, evidenceUrl: 'https://res.cloudinary.com/demo/filter.jpg' });
    expect((await requestHygieneVerification()).status).toBe('pending');
    const badges = async () => {
      await asCustomer();
      const page = await getVendorPage('nani-ki-handi', GULBERG);
      const card = (await listVendors({ lat: GULBERG.lat, lng: GULBERG.lng, homeKitchen: true }, 1, 20)).items.find(v => v.slug === 'nani-ki-handi');
      return { page: page.hygiene.status, card: card?.badges ?? [], story: page.story?.cookName };
    };
    const pending = await badges();
    expect(pending.page).toBe('self_declared');
    expect(pending.card).not.toContain('hygiene_verified');
    expect(pending.story).toBe('Nasreen Begum');
    await asStaff();
    expect((await listHygieneQueue()).map(x => x.businessId)).toContain('b_nani');
    expect((await verifyHygiene('b_nani')).status).toBe('verified');
    const verified = await badges();
    expect(verified.page).toBe('verified');
    expect(verified.card).toContain('hygiene_verified');
  });

  it('won’t ask for verification before every item is ticked', async () => {
    await as('nani@metromatrix.app');
    await setHygieneItem('pests', { done: false });
    const e = await failure(requestHygieneVerification());
    expect(e.code).toBe('HYGIENE_INCOMPLETE');
    expect((await getHygiene()).status).toBe('none');
  });
});

describe('batching', () => {
  it('suggests a second order going the same way, and the rider sees the drop order (QA 39)', async () => {
    const a = await orderBiryani(1);
    const b = await orderBiryani(1);
    await asVendor();
    await acceptOrder(a.id, 20);
    await acceptOrder(b.id, 20);
    const s = await getBatchSuggestions(a.id);
    expect(s[0]).toMatchObject({ orderId: b.id, sameDirection: true, extraKm: 0 });
    await clearTokens();
    await authSignin({ username: 'biryani-bazaar.ali', password: SEED_PASSWORD, portal: 'partner' });
    await setDuty(true);
    await asVendor();
    await assignRider(a.id, 'rd_ali');
    await assignRider(b.id, 'rd_ali');
    await clearTokens();
    await authSignin({ username: 'biryani-bazaar.ali', password: SEED_PASSWORD, portal: 'partner' });
    const ra = await getRiderOrder(a.id);
    const rb = await getRiderOrder(b.id);
    expect([ra.dropOrder, rb.dropOrder].map(d => d?.of)).toEqual([2, 2]);
    expect([ra.dropOrder?.position, rb.dropOrder?.position].sort()).toEqual([1, 2]);
  });
});

describe('the assistant’s drafts (5C)', () => {
  it('drafts English and Urdu descriptions, and changes nothing until one is saved (QA 40)', async () => {
    const [naan] = await draftDescriptions(['mi_naan']);
    expect(naan.en).toMatch(/^Naan: /);
    expect(isUrduScript(naan.ur)).toBe(true);
    expect((await getMenuItem('mi_naan')).description).toBe(naan.current.en);
    expect((await getAiUsage()).used).toBe(1);
    await saveDescription('mi_naan', { description: naan.en, descriptionUr: naan.ur });
    await asCustomer();
    const sheet = await getItemSheet('mi_naan');
    expect(sheet).toMatchObject({ description: naan.en, descriptionUr: naan.ur });
  });

  it('suggests specials from expiring stock and adds one as a hidden dish with its recipe card (QA 41)', async () => {
    const { items, category } = await suggestSpecials();
    const tikka = items.find(i => i.title === 'Chicken tikka plate')!;
    expect(tikka.usesExpiring).toContain('Chicken (curry cut)');
    expect(tikka.cost.foodCostPct).toBeLessThanOrEqual(40);
    const dish = await createMenuItem(specialItemInput(tikka, category!.id, tikka.suggestedPrice), []);
    expect(dish).toMatchObject({ name: 'Chicken tikka plate', isActive: false, basePrice: tikka.suggestedPrice });
    expect((await saveRecipe(dish.id, null, specialRecipe(tikka))).cost?.toMake).toBe(tikka.cost.toMake);
    await asCustomer();
    const page = await getVendorPage('biryani-bazaar', GULBERG);
    expect(page.menu.flatMap(m => m.items).some(i => i.id === dish.id)).toBe(false);
  });

  it('pairs dishes ordered together into a deal at the bundle price (QA 42)', async () => {
    const { items, category } = await suggestCombos();
    const first = items[0];
    expect(first.itemIds).toHaveLength(2);
    expect(first.bundlePrice).toBeLessThan(first.regularPrice);
    expect(first.cost?.keep).toBe(first.bundlePrice - first.cost!.toMake);
    expect(category?.name).toBe('Deals');
    const deal = await createMenuItem(comboItemInput(first, category!.id, first.bundlePrice), []);
    expect(deal).toMatchObject({ isDeal: true, isActive: true, basePrice: first.bundlePrice, name: first.names.join(' + ') });
  });

  it('reads a week of reviews for themes, and lists the reviews behind one (QA 43)', async () => {
    const r = await getReviewInsights();
    const late = r.themes.find(t => t.key === 'late')!;
    expect(late).toMatchObject({ tone: 'negative' });
    expect(late.count).toBeGreaterThan(1);
    expect(late.snippets.every(x => !/\d{7,}/.test(x))).toBe(true);
    expect(r.weeks).toHaveLength(8);
    const behind = await listReviewsByTheme('late', r.week, 1, 20);
    expect(behind.items).toHaveLength(late.count);
    // Reading the same week again is free.
    const used = (await getAiUsage()).used;
    await getReviewInsights(r.week);
    expect((await getAiUsage()).used).toBe(used);
  });

  it('works out nutrition from recipe cards, says how, and lists what to match (QA 44)', async () => {
    const n = await getVendorNutrition();
    const biryani = n.items.find(i => i.itemId === 'mi_chicken_biryani')!;
    expect(biryani).toMatchObject({ method: 'recipe', missing: ['House biryani masala'] });
    expect(biryani.confidence).toBeLessThan(0.95);
    expect(n.items.some(i => i.method === 'ai_estimate')).toBe(true);
    const masala = n.unmapped.find(u => u.name === 'House biryani masala')!;
    expect(masala.usedIn).toContain('Chicken Biryani');
    expect(masala.suggestions[0]).toMatchObject({ name: 'Biryani masala' });
    await mapIngredientNutrition(masala.ingredientId, masala.suggestions[0].foodId);
    const after = await getVendorNutrition();
    expect(after.unmapped.some(u => u.ingredientId === masala.ingredientId)).toBe(false);
    expect(after.items.find(i => i.itemId === 'mi_chicken_biryani')).toMatchObject({ missing: [], confidence: 0.95 });
    expect((await setNutritionHidden('mi_chicken_biryani', true)).hidden).toBe(true);
  });

  it('checks a photo, and goes quiet when staff switch the assistant off', async () => {
    const c = await checkPhoto('https://res.cloudinary.com/demo/kebab.jpg', 'mi_seekh');
    expect(c.score).toBeGreaterThanOrEqual(55);
    expect(c.tips.length).toBeGreaterThan(0);
    await asStaff();
    await api.patch('/admin/kitchen/ai/settings', { enabled: false });
    await asVendor();
    expect((await failure(suggestSpecials())).code).toBe('AI_UNAVAILABLE');
    // The expiring-stock card falls back to a Bachat Box.
    const hub = await getKitchenHub();
    expect(hub.cards.find(x => x.kind === 'expiring_stock')?.action.kind).toBe('create_surplus');
  });
});

describe('My Kitchen and nutrition (5C)', () => {
  it('keeps calories off until the customer opts in; works out a target; deletes it all (QA 45, 46)', async () => {
    await asCustomer();
    expect(await getNutritionSettings()).toMatchObject({ enabled: false, showCalories: false, targetKcal: null });
    // Turning calories on without nutrition on keeps them off.
    expect((await saveNutritionSettings({ showCalories: true })).showCalories).toBe(false);
    const on = await saveNutritionSettings({ enabled: true, showCalories: true, goal: 'maintain', metrics: { sex: 'female', age: 31, heightCm: 163, weightKg: 62, activity: 'moderate' } });
    expect(on).toMatchObject({ enabled: true, showCalories: true, targetKcal: 1920 });
    expect((await saveNutritionSettings({ manualTargetKcal: 1800 })).targetKcal).toBe(1800);
    const gone = await deleteNutritionData();
    expect(gone).toMatchObject({ enabled: false, showCalories: false, metrics: null, manualTargetKcal: null, targetKcal: null });
    expect((await failure(getNutritionSummary())).code).toBe('NUTRITION_OFF');
  });

  it('filters search and healthy picks to dishes that qualify, per person (QA 47)', async () => {
    await asCustomer();
    const r = await searchFood('chicken', GULBERG.lat, GULBERG.lng, 'under_600');
    const dishes = r.dishes.flatMap(d => d.items);
    expect(dishes.length).toBeGreaterThan(0);
    expect(dishes.every(d => d.nutrition && d.nutrition.kcal < 600)).toBe(true);
    const all = await searchFood('chicken', GULBERG.lat, GULBERG.lng);
    expect(all.dishes.flatMap(d => d.items).length).toBeGreaterThan(dishes.length);
    const picks = await listHealthyPicks(GULBERG);
    expect(picks.length).toBeGreaterThan(0);
    expect(picks.every(p => p.kcal < 600 || (p.tags.includes('high_protein') && p.kcal <= 800))).toBe(true);
    expect(picks.some(p => /drink|naan|lassi/i.test(p.name))).toBe(false);
  });

  it('adds up only the Food Court food the customer ordered, plainly (QA 48)', async () => {
    const o = await orderBiryani(1);
    await asVendor();
    await acceptOrder(o.id, 20);
    await startPreparing(o.id);
    await markReady(o.id);
    await handedExternal(o.id);
    await markDelivered(o.id, o.totals.total);
    await asCustomer();
    await saveNutritionSettings({ enabled: true });
    const w = await getNutritionSummary();
    expect(w.days).toHaveLength(7);
    const today = w.days[w.days.length - 1];
    expect(today).toMatchObject({ orders: 1 });
    expect(today.kcal).toBeGreaterThan(500);
    expect(w.topDishes[0]).toMatchObject({ name: 'Chicken Biryani', count: 1 });
  });

  it('adds what was said to the pantry only on confirm, with its expiry (QA 49)', async () => {
    await asCustomer();
    const before = (await listPantry('all')).items.length;
    const v = await interpretVoice({ context: 'pantry', language: 'auto', text: 'do kilo aloo, expiry agle hafte' });
    expect(v.action?.kind).toBe('pantry.add');
    expect((await listPantry('all')).items).toHaveLength(before);
    const lines = v.action!.kind === 'pantry.add' ? v.action!.lines : [];
    const added = await addToPantry(lines.map(l => ({ name: l.name, key: l.key, qty: l.qty, unit: l.unit, expiresOn: l.expiresOn })), 'voice');
    expect(added[0]).toMatchObject({ key: 'potato', qty: 2000, unit: 'g', source: 'voice', expiresOn: '2026-10-22' });
  });

  it('suggests recipes using what expires first, with what is missing, priced from Shopping (QA 50, 51, 52)', async () => {
    await asCustomer();
    const ideas = await suggestHomeRecipes({ language: 'en', servings: 4 });
    expect(ideas[0].usesExpiring.length).toBeGreaterThan(0);
    const keema = ideas.find(i => i.id === 'rc_aloo_keema')!;
    expect(keema.have).toContain('Potato');
    expect(keema.missing).toContain('Ginger garlic paste');
    const missing = await getMissingItems('rc_aloo_keema', 4);
    const onions = missing.find(m => m.key === 'ginger_garlic')!;
    expect(onions.options[0]).toMatchObject({ store: { name: 'Daily Basket' }, pricePerUnit: { per: 'kg' } });
    const potato = await getMissingItems('rc_aloo_paratha', 4);
    const atta = potato.find(m => m.key === 'atta')!;
    expect(atta.options[0].pricePerUnit.amount).toBe(155);
    await addToShopCart(atta.options[0].variantId!, atta.options[0].packsNeeded);
    expect((await getShopCart()).groups.flatMap(g => g.lines).some(l => l.productId === atta.options[0].productId)).toBe(true);
    // "Order it nearby" searches Food Court for the dish's own word.
    expect(keema.searchTerm).toBe('keema');
    const pulao = await getHomeRecipe('rc_chicken_pulao', 'ur', null);
    expect(pulao.searchTerm).toBe('pulao');
    const nearby = await searchFood(pulao.searchTerm, GULBERG.lat, GULBERG.lng);
    expect(nearby.dishes.flatMap(d => d.items).some(i => /pulao/i.test(i.name))).toBe(true);
    // One set of ideas is one assistant action.
    expect((await getDb()).kitchen.aiUses.filter(u => u.feature === 'recipe_suggestions')).toHaveLength(1);
  });
});

describe('voice and the assistant', () => {
  it('proposes an action from typed words and from a recording, and never writes', async () => {
    const before = await onHand('ing_bb_tomato');
    const typed = await interpretVoice({ context: 'stock', language: 'auto', text: '5 kilo tamatar 1200 rupay' });
    expect(typed).toMatchObject({ heard: 'text', language: 'ur', action: { kind: 'purchase.add' } });
    const spoken = await interpretVoice({ context: 'stock', language: 'ur', audioUrl: 'file:///clip.m4a', durationMs: 4000 });
    expect(spoken.heard).toBe('audio');
    expect(spoken.transcript).toBeTruthy();
    expect(await onHand('ing_bb_tomato')).toBe(before);
    expect((await getAiUsage()).voice.used).toBe(2);
  });

  it('answers a receipt photo with draft lines, and goes quiet when staff switch the assistant off (QA 3, 4)', async () => {
    const d = await scanReceipt('https://res.cloudinary.com/demo/receipt.jpg');
    expect(d.lines.some(l => l.match === null)).toBe(true);
    expect((await getAiUsage()).used).toBe(1);
    await asStaff();
    await api.put('/admin/kitchen/ai/quotas/b_resto', { limit: 1 });
    await asVendor();
    const quota = await failure(scanReceipt('https://res.cloudinary.com/demo/receipt.jpg'));
    expect(quota.code).toBe('AI_QUOTA_REACHED');
    expect(quota.details).toMatchObject({ limit: 1, used: 1 });
    expect(String((quota.details as { resetsAt: string }).resetsAt)).toMatch(/^2026-10-31T19:00:00/);
    await asStaff();
    await api.patch('/admin/kitchen/ai/settings', { enabled: false });
    await asVendor();
    expect((await failure(interpretVoice({ context: 'board', language: 'auto', text: 'accept karo' }))).code).toBe('AI_UNAVAILABLE');
    expect((await getAiUsage()).enabled).toBe(false);
  });
});

it('keeps the kitchen rows when a Food write fails part-way', async () => {
  const db = await getDb();
  const before = JSON.stringify(db.kitchen.ingredients);
  await failure(acceptOrder('fo_missing', 20));
  expect(JSON.stringify((await getDb()).kitchen.ingredients)).toBe(before);
});

describe('the staff console (5C)', () => {
  it('shows the assistant’s use and changes a kitchen’s monthly limit', async () => {
    await asStaff();
    const r = await getAiUsageReport();
    expect(r.totals.actions).toBeGreaterThan(50);
    expect(r.byFeature.map(f => f.feature)).toContain('voice');
    const resto = r.byOwner.find(o => o.ownerId === 'b_resto')!;
    expect(resto).toMatchObject({ kind: 'kitchen', name: 'Biryani Bazaar', limit: 300, override: null });
    await setAiQuota('b_resto', 1000);
    expect((await getAiUsageReport()).byOwner.find(o => o.ownerId === 'b_resto')).toMatchObject({ limit: 1000, override: 1000 });
    await asVendor();
    expect((await getAiUsage()).limit).toBe(1000);
  });

  it('imports city prices only from a clean file, all or nothing', async () => {
    await asStaff();
    const bad = 'key,city,week,price\ntomato,Lahore,2026-10-12,250\nshimla,Lahore,2026-10-12,300\nonion,Lahore,2026-10-13,150';
    const dry = await importReferencePrices(bad, true);
    expect(dry).toMatchObject({ dryRun: true, rows: 3, valid: 1, imported: 0 });
    expect(dry.errors.map(e => [e.row, e.field])).toEqual([[3, 'key'], [4, 'week']]);
    const before = JSON.stringify((await getDb()).kitchen.priceRefs);
    expect((await failure(importReferencePrices(bad, false))).code).toBe('CSV_HAS_ERRORS');
    expect(JSON.stringify((await getDb()).kitchen.priceRefs)).toBe(before);
    expect((await importReferencePrices('key,city,week,price\ntomato,Lahore,2026-10-12,250', false)).imported).toBe(1);
    expect((await getReferencePrices({ city: 'Lahore', q: 'tomato' })).items.find(i => i.key === 'tomato')).toMatchObject({ price: 250, unit: 'kg' });
  });

  it('corrects a nutrition food, and a dry run says what an import would change', async () => {
    await asStaff();
    const ghee = (await listNutritionFoods({ q: 'ghee' })).items[0];
    expect(ghee.usedBy).toBeGreaterThan(0);
    const dry = await importNutritionFoods(`key,name,per,kcal,protein,carbs,fat\n${ghee.key},${ghee.name},g100,${ghee.kcal},${ghee.protein},${ghee.carbs},${ghee.fat}\nkhoya,Khoya,g100,421,14.6,25,30`, true);
    expect(dry.preview.map(p => p.change)).toEqual(['same', 'new']);
    await updateNutritionFood(ghee.id, { kcal: ghee.kcal + 100 });
    expect((await listNutritionFoods({ q: 'ghee' })).items[0].kcal).toBe(ghee.kcal + 100);
  });

  it('teaches voice a new word, and refuses one that already means something', async () => {
    await asStaff();
    await createAlias({ word: 'Tomatar', language: 'roman_ur', key: 'tomato' });
    expect((await failure(createAlias({ word: 'tomatar', language: 'roman_ur', key: 'onion' }))).code).toBe('ALIAS_EXISTS');
    await asVendor();
    const v = await interpretVoice({ context: 'purchases', language: 'auto', text: '3 kilo tomatar 600 rupay' });
    expect(v.action).toMatchObject({ kind: 'purchase.add' });
    expect(JSON.stringify(v.action)).toMatch(/Tomato/);
  });

  it('moves Ramadan, and never lets two Ramadans overlap', async () => {
    await asStaff();
    expect((await failure(createCalendarEvent({ kind: 'ramadan', name: 'Ramadan again', startsOn: '2027-02-20', endsOn: '2027-03-01' }))).code).toBe('EVENT_OVERLAP');
    expect(await updateCalendarEvent('ev_ramadan_1448', { startsOn: '2027-02-09', endsOn: '2027-03-10' })).toMatchObject({ startsOn: '2027-02-09', days: 30, state: 'upcoming' });
    expect((await failure(createCalendarEvent({ kind: 'other', name: 'Too long', startsOn: '2027-01-01', endsOn: '2027-03-01' }))).code).toBe('VALIDATION_FAILED');
  });

  it('sends a hygiene check back with a note, then verifies it', async () => {
    await asStaff();
    expect((await listHygieneQueue('pending')).map(h => h.businessId)).toContain('b_homek');
    expect((await failure(rejectHygiene('b_homek', 'no'))).code).toBe('VALIDATION_FAILED');
    expect(await rejectHygiene('b_homek', 'The storage photo does not show the fridge.')).toMatchObject({ status: 'rejected', note: 'The storage photo does not show the fridge.' });
    expect((await listHygieneQueue('rejected')).map(h => h.businessId)).toContain('b_homek');
    expect((await failure(verifyHygiene('b_homek'))).code).toBe('INVALID_TRANSITION');
  });

  it('keeps a signature dish, or takes the label off and tells the kitchen why', async () => {
    await asStaff();
    const fresh = await listSignatures('new');
    expect(fresh.items.map(d => d.itemId)).toEqual(expect.arrayContaining(['mi_chicken_biryani', 'mi_seekh']));
    expect((await approveSignature('mi_chicken_biryani')).status).toBe('approved');
    expect((await failure(removeSignature('mi_seekh', 'no'))).code).toBe('VALIDATION_FAILED');
    expect(await removeSignature('mi_seekh', 'Another kitchen sells this seekh under its own name.')).toMatchObject({ status: 'removed' });
    expect((await listSignatures('new')).counts).toMatchObject({ new: fresh.counts.new - 2, approved: 1, removed: 1 });
    // The kitchen reads the note on the recipe, where the label is turned on.
    await asVendor();
    expect((await getRecipe('mi_seekh')).signature).toEqual({ on: false, creatorName: 'Imran Qureshi', removedNote: 'Another kitchen sells this seekh under its own name.' });
    // And on the hub when there's room (cards are ranked; this one is info).
    const cards = await listInsightCards();
    if (cards.length < 5) expect(cards.find(c => c.kind === 'signature_removed')).toMatchObject({ action: { kind: 'open_recipe' } });
  });

  it('shows a city’s demand without any area too small to be anonymous', async () => {
    await asStaff();
    const d = await getPlatformDemand({ city: 'Lahore' });
    expect(d.cities).toEqual(['Lahore', 'Karachi', 'Islamabad']);
    expect(d.cells.length).toBeGreaterThan(0);
    expect(d.cells.every(c => c.searches >= d.minCount)).toBe(true);
    expect(d.total).toBeGreaterThan(d.hidden);
    expect(d.hourCurve.own.every(x => x === 0)).toBe(true);
  });

  it('looks up a tiffin or catering code as its kitchen sees it', async () => {
    await asStaff();
    const t = await lookupGrowthCode('tf-hmz4k2');
    expect(t.kind === 'tiffin' && t.tiffin).toMatchObject({ code: 'TF-HMZ4K2', customer: { name: 'Hamza Qureshi' } });
    const c = await lookupGrowthCode('CT-MHD7Q4');
    expect(c.kind === 'catering' && c.catering.guests).toBe(80);
    expect((await failure(lookupGrowthCode('TF-NOPE00'))).code).toBe('NOT_FOUND');
    expect((await failure(lookupGrowthCode('FC-NBNWXT'))).code).toBe('VALIDATION_FAILED');
  });

  it('is staff only', async () => {
    await asVendor();
    expect((await failure(getAiUsageReport())).status).toBe(403);
    await asCustomer();
    expect((await failure(listSignatures('new'))).status).toBe(403);
  });
});
