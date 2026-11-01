// ═══════════════════════════════════════════════════════
// Live Kitchen Intelligence run against a real MetroMatrix API
// ═══════════════════════════════════════════════════════
// Skipped unless LIVE_API_URL is set:
//   LIVE_API_URL=http://localhost:3000/api/v1 LIVE_MAIL_LOG=<the API's console log> \
//   LIVE_BACKEND=<the API's checkout, for its .env> npx jest __live__/liveKitchen
// The API runs with the console mail transport (MAIL_HOST empty) and AI off
// (AI_ENABLED=false) on its seed:food + seed:kitchen demo; the kitchens sign in
// with the seed's SEED_DEMO_PASSWORD, read from the API's own .env (never
// printed). Everything goes through the App's own networks, slices' shared
// flows and serializers: a kitchen's stock, a recipe card on a dish of its own,
// the forecast and prep, waste, a Bachat Box reserved and collected, a tiffin
// approved and cancelled, a dawat quoted, accepted and cancelled, and a new
// customer's pantry and nutrition. What it adds is its own (Live … names, a
// live.* customer) and is taken off again where the API allows.

// First: point network.ts at the live API before it loads.
import './liveApiUrl';
import { readFileSync } from 'fs';
import { join } from 'path';
import { MainAxiosInstance, RefreshAxiosInstance, required, type ApiError } from '../networks/network/network';
import { clearTokens, getAccessToken, getRefreshToken, setTokens } from '../utils/storage_utils/storageUtils';
import { authLogin } from '../networks/authcalls/signin';
import { authSignup } from '../networks/authcalls/signup';
import { verifyEmail } from '../networks/authcalls/verifyEmail';
import * as users from '../networks/users/users';
import * as addresses from '../networks/addresses/addresses';
import * as menu from '../networks/food/vendor/menu';
import * as cards from '../networks/kitchen/insightsCards';
import * as stock from '../networks/kitchen/stock';
import * as recipes from '../networks/kitchen/recipes';
import * as forecast from '../networks/kitchen/forecast';
import * as waste from '../networks/kitchen/waste';
import * as boxes from '../networks/kitchen/surplus';
import * as surplus from '../networks/food/surplus';
import * as tiffin from '../networks/foodGrowth/tiffin';
import * as catering from '../networks/foodGrowth/catering';
import * as pantry from '../networks/myKitchen/pantry';
import * as nutrition from '../networks/myKitchen/nutrition';
import * as voice from '../networks/ai/voice';
import { fetchAiUsage } from '../networks/kitchen/kitchenAi';
import { addressSerializer } from '../serializers/addressSerializer';
import { vendorMenuItemSerializer, menuCategoriesSerializer } from '../serializers/food/menuSerializer';
import { insightCardsSerializer, kitchenSummarySerializer, aiUsageSerializer } from '../serializers/kitchen/insightSerializer';
import { ingredientDetailSerializer, stockTakeSerializer } from '../serializers/kitchen/stockSerializer';
import { recipeSerializer } from '../serializers/kitchen/recipeSerializer';
import { forecastSerializer, prepSheetSerializer } from '../serializers/kitchen/forecastSerializer';
import { wasteBatchSerializer, wasteSummarySerializer } from '../serializers/kitchen/wasteSerializer';
import { myReservationSerializer, reservationSerializer, reservationsSerializer, surplusBoxSerializer, surplusCardsSerializer, surplusDetailSerializer } from '../serializers/kitchen/surplusSerializer';
import { cateringRequestByCodeSerializer, cateringRequestSerializer, cateringVendorSerializer, myTiffinSerializer, tiffinCalendarSerializer, tiffinPlansSerializer, tiffinSubscriptionSerializer } from '../serializers/kitchen/growthSerializer';
import { nutritionSettingsSerializer, nutritionSummarySerializer, pantryItemsSerializer, pantryListSerializer, pantryUsedUpSerializer } from '../serializers/myKitchen/myKitchenSerializer';
import { voiceResultSerializer } from '../serializers/ai/voiceSerializer';
import { fromResponse } from '../serializers/serializerUtils';
import { ingredientSerializer } from '../serializers/kitchen/stockSerializer';
import { PKT, addDays, todayInZone } from '../utils/health-time/healthTime';
import { EVERY_DAY } from '../models/food/menuModel';

const LIVE = process.env.LIVE_API_URL;
const MAIL_LOG = process.env.LIVE_MAIL_LOG ?? '';
const live = LIVE ? describe : describe.skip;

jest.setTimeout(300_000);

// ─── Helpers ─────────────────────────────────────────
const run = Date.now().toString(36);
const EMAIL = `live.${run}.kitchen@example.com`;
const PASSWORD = 'Metro2026Live';
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));
const today = () => todayInZone(PKT);
const ingredientOf = fromResponse(ingredientSerializer);

/** The seed's demo password from the API's own .env (never printed). */
const demoPassword = () => {
  const env = readFileSync(join(process.env.LIVE_BACKEND ?? '', '.env'), 'utf8');
  const line = env.split('\n').find(l => l.startsWith('SEED_DEMO_PASSWORD='));
  if (!line) throw new Error('SEED_DEMO_PASSWORD is not in the API’s .env');
  return line.slice('SEED_DEMO_PASSWORD='.length).trim().replace(/^["']|["']$/g, '');
};

interface Session {
  access: string;
  refresh: string;
}
const hold = async (s: Session) => setTokens(s.access, s.refresh);
const stored = async (): Promise<Session> => ({ access: (await getAccessToken())!, refresh: (await getRefreshToken())! });

const signin = async (...args: Parameters<typeof authLogin>) => {
  for (let attempt = 1; ; attempt++) {
    try {
      return await authLogin(...args);
    } catch (e) {
      const err = e as ApiError;
      if (err.code !== 'RATE_LIMITED' || attempt > 3) throw e;
      await sleep((Number(err.details?.retryAfter) || 60) * 1000 + 1000);
    }
  }
};

const linkToken = async (to: string): Promise<string> => {
  for (let i = 0; i < 40; i++) {
    const blocks = readFileSync(MAIL_LOG, 'utf8').split('[DEV EMAIL]').filter(b => b.includes(`To: ${to}`));
    for (const b of blocks.reverse()) {
      const m = b.match(/verify-email\?token=([A-Za-z0-9_-]+)/);
      if (m) return m[1];
    }
    await sleep(250);
  }
  throw new Error(`no email to ${to}`);
};

const failure = async (p: Promise<unknown>): Promise<ApiError> => {
  try {
    await p;
  } catch (e) {
    return e as ApiError;
  }
  throw new Error('expected the call to fail');
};

// ─── The run ─────────────────────────────────────────
live('live Kitchen Intelligence run against the local API', () => {
  const s: Record<'customer' | 'zafran' | 'rukhsana' | 'qandeel', Session> = {
    customer: { access: '', refresh: '' },
    zafran: { access: '', refresh: '' },
    rukhsana: { access: '', refresh: '' },
    qandeel: { access: '', refresh: '' },
  };
  let addressId = '';
  let ingredientId = '';
  let dishId = '';
  let boxId = '';
  const as = (who: keyof typeof s) => hold(s[who]);

  beforeAll(async () => {
    MainAxiosInstance.defaults.adapter = 'fetch';
    RefreshAxiosInstance.defaults.adapter = 'fetch';
    const DEMO = demoPassword();
    for (const [who, email] of [
      ['zafran', 'demo.food.zafran@metromatrix.test'],
      ['rukhsana', 'demo.food.rukhsana@metromatrix.test'],
      ['qandeel', 'demo.food.qandeel@metromatrix.test'],
    ] as const) {
      await clearTokens();
      await signin({ email, password: DEMO, portal: 'partner' });
      s[who] = await stored();
    }
    await clearTokens();
    await authSignup({ name: 'Live Kitchen Customer', email: EMAIL, phone: `+9230${String(Math.floor(Math.random() * 1e8)).padStart(8, '0')}`, password: PASSWORD, portal: 'customer' });
    await verifyEmail(await linkToken(EMAIL));
    await clearTokens();
    await signin({ email: EMAIL, password: PASSWORD, portal: 'customer' });
    s.customer = await stored();
    await users.completeProfile({ dateOfBirth: '1996-05-02', gender: 'female', streetAddress: '21 Model Town', city: 'Lahore', postalCode: '54700' });
    const a = required(addressSerializer(await addresses.createAddress({ label: 'home', fullName: 'Live Customer', phone: '+923001112233', city: 'Lahore', area: 'Model Town', line1: 'House 21, Block C', landmark: null, lat: 31.4841, lng: 74.3262 })));
    addressId = a.id;
  });

  afterAll(async () => {
    // Off the kitchen's books: the dish (its recipe card goes with it), the box, the ingredient.
    await as('zafran');
    if (boxId) await boxes.cancelBox(boxId).catch(() => undefined);
    if (dishId) await menu.deleteMenuItem(dishId).catch(() => undefined);
    if (ingredientId) await stock.deleteIngredient(ingredientId).catch(() => undefined);
  });

  it('reads the Kitchen tab with AI off', async () => {
    await as('zafran');
    expect(kitchenSummarySerializer(await cards.fetchKitchenSummary())).toMatchObject({ date: today() });
    expect(insightCardsSerializer(await cards.fetchInsightCards()).length).toBeLessThanOrEqual(5);
    expect(aiUsageSerializer(await fetchAiUsage())).toMatchObject({ enabled: false });
  });

  it('adds an ingredient, counts it, and costs a recipe card on a dish of its own', async () => {
    await as('zafran');
    const made = required(ingredientOf(await stock.createIngredient({ name: `Live flour ${run}`, category: 'grain', baseUnit: 'g', parLevel: 1000, openingStock: { qty: 3000, totalCost: 450 } })));
    ingredientId = made.id;
    const take = required(stockTakeSerializer(await stock.recordStockTake([{ ingredientId, counted: 2500, baseUnit: 'g' }], 'Live count'), []));
    expect(take.adjusted).toBe(1);
    const detail = required(ingredientDetailSerializer({ ingredient: await stock.fetchIngredient(ingredientId), batches: await stock.fetchIngredientBatches(ingredientId), movements: await stock.fetchIngredientMovements(ingredientId) }));
    expect(detail.onHand).toBe(2500);
    expect(detail.batches.length).toBeGreaterThan(0);

    const [category] = menuCategoriesSerializer(await menu.fetchMenuCategories());
    const dish = required(vendorMenuItemSerializer(await menu.createMenuItem({ categoryId: category.id, name: `Live roti ${run}`, description: null, photoUrl: null, basePrice: 60, tags: [], isDeal: false, serves: 1, days: EVERY_DAY, isActive: false }, [])));
    dishId = dish.id;
    await recipes.saveRecipe(dishId, null, { yield: 10, lines: [{ ingredientId, qty: 1000, baseUnit: 'g' }], addOns: [], packaging: [], signature: { on: false, creatorName: null } });
    const r = required(recipeSerializer({ card: await recipes.fetchRecipe(dishId), item: await menu.fetchMenuItem(dishId), costing: await recipes.fetchCosting() }));
    expect(r.lines).toEqual([expect.objectContaining({ ingredientId, qty: 1000 })]);
    expect(r.cost?.toMake).toBeGreaterThan(0);
    await recipes.deleteRecipe(dishId, null);
    expect((await recipes.fetchRecipe(dishId)) as { data: unknown }).toMatchObject({ data: null });
  });

  it('reads the forecast with its prep, and logs waste one line an entry', async () => {
    await as('zafran');
    const day = addDays(today(), 1);
    expect(forecastSerializer({ forecast: await forecast.fetchForecast(day), prep: await forecast.fetchPrepSheet(day) })).toMatchObject({ date: day });
    expect(prepSheetSerializer(await forecast.fetchPrepSheet(day))).not.toBeNull();
    const w = required(wasteBatchSerializer([await waste.logWaste({ ingredientId, qty: 100, unit: 'g', reason: 'spoiled' }, 'Live run')]));
    expect(w.lines[0]).toMatchObject({ ingredientId, reason: 'spoiled', qty: 100 });
    expect(wasteSummarySerializer({ summary: await waste.fetchWasteSummary('7d'), donations: await waste.fetchDonations() })?.entries).toBeGreaterThan(0);
  });

  it('puts up a Bachat Box; a customer reserves it, and the kitchen hands it over by its code', async () => {
    await as('zafran');
    const now = Date.now();
    const made = required(surplusBoxSerializer(await boxes.createBox({ title: `Live Bachat Box ${run}`, contentsHint: 'Usually biryani and raita', value: 1200, price: 450, quantity: 2, pickupFrom: new Date(now + 60_000).toISOString(), pickupTo: new Date(now + 90 * 60_000).toISOString() })));
    boxId = made.id;
    expect(made).toMatchObject({ status: 'live', left: 2, value: 1200 });

    await as('customer');
    const near = surplusCardsSerializer(await surplus.fetchSurplusNearby({ lat: 31.4841, lng: 74.3262 }));
    expect(near.map(c => c.id)).toContain(boxId);
    const page = required(surplusDetailSerializer({ box: await surplus.fetchSurplus(boxId, { lat: 31.4841, lng: 74.3262 }), mine: await surplus.fetchMyReservations() }));
    expect(page.paymentMethods).toContain('pay_at_pickup');
    const r = required(reservationSerializer(await surplus.reserveSurplus(boxId, { quantity: 1, paymentMethod: 'pay_at_pickup' }, `live-${run}-box`)));
    expect(r.code).toMatch(/^BB-/);
    expect(myReservationSerializer(await surplus.fetchMyReservations(), r.code)?.status).toBe('reserved');

    await as('zafran');
    const waiting = reservationsSerializer(await boxes.fetchBoxReservations(undefined, 'reserved'));
    const held = waiting.find(x => x.code === r.code)!;
    expect(held.id).toBe(r.id);
    expect(reservationSerializer(await boxes.collectReservation(held.id, r.code.toLowerCase()))?.status).toBe('collected');
    expect((await failure(boxes.collectReservation(held.id, r.code))).code).toBe('INVALID_TRANSITION');
  });

  it('subscribes to a tiffin, which the kitchen approves; the customer cancels it', async () => {
    await as('customer');
    const plans = tiffinPlansSerializer(await tiffin.fetchTiffinPlans('khala-rukhsanas-kitchen'));
    const plan = plans.find(p => p.isActive && p.seatsLeft > 0 && p.mode !== 'delivery')!;
    expect(plan).toBeDefined();
    const sub = required(tiffinSubscriptionSerializer(await tiffin.subscribeTiffin(plan.id, { startDate: plan.nextStart!, addressId: null, paymentMethod: 'cash' }, `live-${run}-tiffin`)));
    expect(sub.status).toBe('pending');

    await as('rukhsana');
    await tiffin.moveSubscriber(sub.code, 'approve', {});

    await as('customer');
    const mine = required(myTiffinSerializer(await tiffin.fetchMyTiffins(), sub.code));
    expect(mine.status).toBe('active');
    expect(tiffinCalendarSerializer(await tiffin.fetchTiffinCalendar(sub.code, today().slice(0, 7))).days.length).toBeGreaterThan(0);
    expect(tiffinSubscriptionSerializer(await tiffin.cancelMyTiffin(sub.code))?.status).toBe('cancelled');
  });

  it('asks for a dawat; the kitchen quotes, the customer accepts, then cancels', async () => {
    await as('customer');
    const vendor = required(cateringVendorSerializer(await catering.fetchCateringVendor('qandeel-karahi-house')));
    const asked = required(cateringRequestSerializer(await catering.requestCatering({ vendorId: vendor.vendorId, date: addDays(today(), 8), time: '19:30', guests: 30, eventType: 'birthday', dishes: [{ name: 'Chicken Karahi', qty: 5 }], budget: 30000, mode: 'pickup', notes: `Live ${run}` })));
    expect(asked.code).toMatch(/^CT-/);

    await as('qandeel');
    const quoted = required(cateringRequestSerializer(await catering.sendQuote(asked.id, { lines: [{ name: 'Chicken Karahi', qty: 5, unitPrice: 1450 }], deliveryFee: 0, advancePct: 30, validUntil: new Date(Date.now() + 2 * 86_400_000).toISOString(), notes: 'Live quote' })));
    expect(quoted.quotes[0]).toMatchObject({ version: 1, total: 7250, state: 'current' });

    await as('customer');
    const mine = required(cateringRequestByCodeSerializer(await catering.fetchMyCateringRequests(), asked.code));
    const accepted = required(cateringRequestSerializer(await catering.acceptQuote(mine.id, 1)));
    expect(accepted.advance).toMatchObject({ status: 'awaiting_transfer', amount: 2175 });
    expect(cateringRequestSerializer(await catering.cancelMyCatering(mine.id, 'Plans changed'))?.status).toBe('cancelled');
  });

  it('keeps a pantry, and an opt-in nutrition profile it can delete', async () => {
    await as('customer');
    const added = pantryItemsSerializer(await pantry.addPantryItems([{ name: 'palak', qty: 2, unit: 'pao', expiresOn: addDays(today(), 2) }, { name: 'doodh', qty: 1, unit: 'l' }]));
    expect(added.map(i => i.key)).toEqual(['spinach', 'milk']);
    expect(added[0]).toMatchObject({ qty: 500, unit: 'g', state: 'use_soon' });
    const list = pantryListSerializer({ items: await pantry.fetchPantry('active'), active: await pantry.fetchPantry('active'), expiring: await pantry.fetchExpiringPantry(), expired: await pantry.fetchPantry('expired') });
    expect(list.counts.all).toBe(2);
    expect(pantryUsedUpSerializer(await pantry.markPantryUsed(added[0].id))).toMatchObject({ usedUp: true, savedFromWaste: true });
    await pantry.discardPantryItem(added[1].id);

    expect((await failure(nutrition.fetchNutritionProfile())).status).toBe(404);
    expect(nutritionSettingsSerializer(await nutrition.saveNutritionProfile({ goal: 'maintain', metrics: null, manualTargetKcal: 1900, showCalories: false }))).toMatchObject({ enabled: true, showCalories: false, manualTargetKcal: 1900 });
    expect(nutritionSummarySerializer(await nutrition.fetchNutritionSummary('7d'))?.days.length).toBe(7);
    await nutrition.deleteNutritionProfile();
    expect((await failure(nutrition.fetchNutritionProfile())).status).toBe(404);
  });

  it('understands a typed purchase as the API’s own request, and writes nothing', async () => {
    await as('zafran');
    const v = required(voiceResultSerializer(await voice.interpretVoice({ context: 'purchases', language: 'ur', text: 'do kilo tamatar paanch sau rupay' }), 'text'));
    expect(v.action).toMatchObject({ kind: 'purchase.add', request: { method: 'POST', path: '/food/vendor/kitchen/purchases' } });
    expect((await failure(voice.interpretVoice({ context: 'purchases', language: 'ur', text: 'aaj mausam kaisa hai' }))).code).toBe('VOICE_UNCLEAR');
  });

  it('keeps the new customer’s address', () => {
    expect(addressId).toBeTruthy();
  });
});
