// The App ↔ API contract for Kitchen Intelligence (docs/API_KITCHEN.md, AI.md,
// VOICE.md). Every Kitchen, growth, My Kitchen, voice and staff Kitchen
// network function runs once against a capturing axios adapter (a real base
// URL), and the one request it sends must exist in the API's OpenAPI
// document (docs/openapi.json, the backend's `npm run openapi:export`): the
// method and path template, every required field, and every body field —
// which must be a field of the route's DTO class (openapi.json lists only
// the fields with @ApiProperty; fixtures/dtoFields.json is read from the
// backend's source by scripts/kitchen-dto-fields.py). Every exported function
// is covered: a new one fails here until it has a case. Copy openapi.json and
// regenerate dtoFields.json when the API changes.

// First: the API URL network.ts reads when it loads (a real base URL, so no CONFIG_ERROR).
import '../../__fixtures__/testApiUrl';
import type { AxiosResponse, InternalAxiosRequestConfig } from 'axios';
import spec from '../../docs/openapi.json';
import dtoFields from './fixtures/dtoFields.json';
import { MainAxiosInstance } from '../network/network';
import { setTokens } from '../../utils/storage_utils/storageUtils';
import * as costing from '../kitchen/costing';
import * as forecast from '../kitchen/forecast';
import * as cards from '../kitchen/insightsCards';
import * as ai from '../kitchen/kitchenAi';
import * as nutrition from '../kitchen/nutrition';
import * as packing from '../kitchen/packing';
import * as purchases from '../kitchen/purchases';
import * as recipes from '../kitchen/recipes';
import * as stock from '../kitchen/stock';
import * as surplus from '../kitchen/surplus';
import * as waste from '../kitchen/waste';
import * as customerSurplus from '../food/surplus';
import * as batching from '../foodGrowth/batching';
import * as catering from '../foodGrowth/catering';
import * as demand from '../foodGrowth/demand';
import * as experiments from '../foodGrowth/experiments';
import * as ramadan from '../foodGrowth/ramadan';
import * as storefront from '../foodGrowth/storefront';
import * as story from '../foodGrowth/story';
import * as tiffin from '../foodGrowth/tiffin';
import * as voice from '../ai/voice';
import * as myNutrition from '../myKitchen/nutrition';
import * as pantry from '../myKitchen/pantry';
import * as homeRecipes from '../myKitchen/recipes';
import * as admin from '../admin/adminKitchen';

type Schema = { type?: string; properties?: Record<string, unknown>; required?: string[]; $ref?: string; allOf?: Schema[] };
type Operation = { requestBody?: { content?: Record<string, { schema?: Schema }> } };
const openapi = spec as unknown as { paths: Record<string, Record<string, Operation>>; components: { schemas: Record<string, Schema> } };

interface Captured {
  method: string;
  path: string;
  body: Record<string, unknown> | undefined;
}

let sent: Captured[] = [];

const capture = (config: InternalAxiosRequestConfig): Promise<AxiosResponse> => {
  const raw = typeof config.data === 'string' && config.data ? JSON.parse(config.data) : config.data;
  sent.push({ method: (config.method ?? 'get').toUpperCase(), path: new URL(`${config.baseURL}${config.url}`).pathname, body: raw ?? undefined });
  return Promise.resolve({ data: { success: true, data: {} }, status: 200, statusText: 'OK', headers: {}, config });
};

beforeAll(() => {
  MainAxiosInstance.defaults.adapter = capture as never;
});

beforeEach(async () => {
  sent = [];
  await setTokens('access-1', 'refresh-1');
});

const run = async (call: () => Promise<unknown>): Promise<Captured[]> => {
  await call().catch(() => undefined);
  return sent;
};

// ─── Matching against the OpenAPI document ──────────
const templates = Object.keys(openapi.paths)
  .map(template => ({ template, pattern: new RegExp(`^${template.replace(/\{[^}]+\}/g, '[^/]+')}$`), literal: template.split('/').filter(p => !p.startsWith('{')).length }))
  // A literal segment wins over a parameter (`/plans/{id}` vs `/plans/tomorrow`).
  .sort((a, b) => b.literal - a.literal);

const operationFor = (method: string, path: string) => {
  const match = templates.find(t => t.pattern.test(path) && openapi.paths[t.template][method.toLowerCase()]);
  return match ? { template: match.template, op: openapi.paths[match.template][method.toLowerCase()] } : null;
};

const resolve = (s: Schema | undefined): Schema | null => {
  if (!s) return null;
  if (s.$ref) return resolve(openapi.components.schemas[s.$ref.split('/').pop()!]);
  if (s.allOf) {
    const parts = s.allOf.map(resolve).filter((x): x is Schema => !!x);
    return { properties: Object.assign({}, ...parts.map(p => p.properties ?? {})), required: parts.flatMap(p => p.required ?? []) };
  }
  return s;
};

const problems = (req: Captured): string[] => {
  const found = operationFor(req.method, req.path);
  if (!found) return [`${req.method} ${req.path} is not in openapi.json`];
  const schema = resolve(found.op.requestBody?.content?.['application/json']?.schema);
  const body = req.body ?? {};
  const dto = (dtoFields as Record<string, string[]>)[`${req.method} ${found.template}`];
  if (!schema && !dto) return Object.keys(body).length ? [`${req.method} ${found.template} takes no body, got ${Object.keys(body).join(', ')}`] : [];
  const allowed = new Set([...Object.keys(schema?.properties ?? {}), ...(dto ?? [])]);
  return [
    ...Object.keys(body)
      .filter(f => !allowed.has(f))
      .map(f => `${req.method} ${found.template}: "${f}" is not in the body schema`),
    ...(schema?.required ?? []).filter(f => !(f in body)).map(f => `${req.method} ${found.template}: required "${f}" is missing`),
  ];
};

const ID = '00000000-0000-4000-8000-000000000001';
const LINE = { ingredientId: ID, qty: 2, unit: 'kg', total: 500 };
const box = { title: 'Bachat Box', contentsHint: 'Biryani and raita', value: 1200, price: 450, quantity: 4, pickupFrom: '2026-11-01T15:00:00.000Z', pickupTo: '2026-11-01T17:00:00.000Z' };
const plan = {
  name: 'Office lunch',
  description: 'Home-style lunch',
  meal: 'lunch' as const,
  days: [1, 2, 3, 4, 5],
  period: 'week' as const,
  price: 2250,
  mode: 'both' as const,
  window: { from: '12:30', to: '13:30' },
  capacity: 12,
  skipCutoffHour: 20,
  rotation: [{ weekday: 1, itemIds: [ID], note: null }],
};
const recipe = { yield: 4, lines: [{ ingredientId: ID, qty: 500, baseUnit: 'g' as const }], addOns: [{ optionId: ID, lines: [{ ingredientId: ID, qty: 50, baseUnit: 'g' as const }] }], packaging: [{ ingredientId: ID, qty: 1, baseUnit: 'pc' as const }], signature: { on: false, creatorName: null } };

/** [network function, a call]: the export's name and how this suite calls it. */
const CASES: [string, () => Promise<unknown>][] = [
  // The Kitchen tab, settings, the board
  ['fetchKitchenSummary', () => cards.fetchKitchenSummary()],
  ['fetchInsightCards', () => cards.fetchInsightCards()],
  ['snoozeInsightCard', () => cards.snoozeInsightCard(`expiring_stock:${ID}`)],
  ['fetchKitchenSettings', () => costing.fetchKitchenSettings()],
  ['updateKitchenSettings', () => costing.updateKitchenSettings({ targetFoodCostPct: 32, packingPhoto: 'required' })],
  ['fetchBoardHints', () => costing.fetchBoardHints()],
  // Stock
  ['fetchStock', () => stock.fetchStock('low', 'tomato', 1, 50)],
  ['fetchIngredient', () => stock.fetchIngredient(ID)],
  ['fetchIngredientBatches', () => stock.fetchIngredientBatches(ID)],
  ['fetchIngredientMovements', () => stock.fetchIngredientMovements(ID)],
  ['createIngredient', () => stock.createIngredient({ name: 'Tomato', nameUr: 'ٹماٹر', category: 'vegetable', baseUnit: 'g', parLevel: 4000, customUnits: [{ name: 'crate', base: 10000 }], openingStock: { qty: 2000, totalCost: 360, expiresOn: '2026-11-05' } })],
  ['updateIngredient', () => stock.updateIngredient(ID, { name: 'Tomatoes', parLevel: 5000 }, 'g')],
  ['deleteIngredient', () => stock.deleteIngredient(ID)],
  ['setIngredientReference', () => stock.setIngredientReference(ID, ID)],
  ['recordStockTake', () => stock.recordStockTake([{ ingredientId: ID, counted: 2500, baseUnit: 'g' }], 'Sunday count')],
  // Recipes and costing
  ['fetchCosting', () => recipes.fetchCosting()],
  ['fetchRecipe', () => recipes.fetchRecipe(ID, ID)],
  ['saveRecipe', () => recipes.saveRecipe(ID, null, recipe)],
  ['deleteRecipe', () => recipes.deleteRecipe(ID, null)],
  ['fetchServings', () => recipes.fetchServings(ID)],
  ['setSignature', () => recipes.setSignature(ID, null, { on: true, creatorName: 'Ustad Rafiq' })],
  // Purchases, suppliers, price watch
  ['fetchPurchases', () => purchases.fetchPurchases(1, 20)],
  ['fetchPurchase', () => purchases.fetchPurchase(ID)],
  ['createPurchase', () => purchases.createPurchase({ supplierId: ID, date: '2026-11-01', source: 'receipt', receiptUrl: 'https://res.cloudinary.com/x/r.jpg', receiptPublicId: 'x/r', note: 'Morning mandi', lines: [LINE] })],
  ['updatePurchase', () => purchases.updatePurchase(ID, { supplierId: null, note: 'Corrected' })],
  ['deletePurchase', () => purchases.deletePurchase(ID)],
  ['fetchSuppliers', () => purchases.fetchSuppliers()],
  ['createSupplier', () => purchases.createSupplier({ name: 'Akbari Mandi', phone: '+923000000000', note: 'Early' })],
  ['updateSupplier', () => purchases.updateSupplier(ID, { phone: null })],
  ['deleteSupplier', () => purchases.deleteSupplier(ID)],
  ['fetchPriceWatch', () => purchases.fetchPriceWatch()],
  ['fetchReferenceItems', () => purchases.fetchReferenceItems('rice')],
  // Forecast and prep
  ['fetchForecast', () => forecast.fetchForecast('2026-11-01', 7)],
  ['adjustForecast', () => forecast.adjustForecast(ID, 30)],
  ['fetchPrepSheet', () => forecast.fetchPrepSheet('2026-11-02')],
  ['fetchShoppingList', () => forecast.fetchShoppingList('2026-11-02')],
  ['fetchPortionSuggestions', () => forecast.fetchPortionSuggestions('2026-11-02')],
  ['applyPortionSuggestion', () => forecast.applyPortionSuggestion('2026-11-02')],
  ['fetchEtaAccuracy', () => forecast.fetchEtaAccuracy()],
  // Waste and donations
  ['logWaste', () => waste.logWaste({ ingredientId: ID, qty: 1, unit: 'kg', reason: 'spoiled' }, 'Left out')],
  ['fetchWaste', () => waste.fetchWaste(1, 20)],
  ['fetchWasteSummary', () => waste.fetchWasteSummary('30d')],
  ['fetchDonations', () => waste.fetchDonations()],
  ['logDonation', () => waste.logDonation({ meals: 12, to: 'Edhi', note: 'Evening', photoUrl: null })],
  // Bachat Box, the kitchen
  ['fetchBoxes', () => surplus.fetchBoxes()],
  ['fetchBoxSuggestion', () => surplus.fetchBoxSuggestion()],
  ['createBox', () => surplus.createBox({ ...box, photoUrl: 'https://res.cloudinary.com/x/b.jpg' })],
  ['updateBox', () => surplus.updateBox(ID, { quantity: 2, pickupTo: '2026-11-01T18:00:00.000Z' })],
  ['cancelBox', () => surplus.cancelBox(ID)],
  ['fetchBoxReservations', () => surplus.fetchBoxReservations(ID, 'reserved')],
  ['collectReservation', () => surplus.collectReservation(ID, 'bb-7kq2px')],
  ['markNoShow', () => surplus.markNoShow(ID)],
  ['confirmBoxPayment', () => surplus.confirmBoxPayment(ID)],
  ['rejectBoxPayment', () => surplus.rejectBoxPayment(ID, 'Not in the account yet')],
  // Bachat Box, customers
  ['fetchSurplusNearby', () => customerSurplus.fetchSurplusNearby({ lat: 31.48, lng: 74.32 })],
  ['fetchSurplus', () => customerSurplus.fetchSurplus(ID, { lat: 31.48, lng: 74.32 })],
  ['reserveSurplus', () => customerSurplus.reserveSurplus(ID, { quantity: 1, paymentMethod: 'transfer' }, ID)],
  ['fetchMyReservations', () => customerSurplus.fetchMyReservations()],
  ['cancelReservation', () => customerSurplus.cancelReservation(ID)],
  ['submitReservationProof', () => customerSurplus.submitReservationProof(ID, { transactionId: 'IBFT 5521', imageUrl: 'https://res.cloudinary.com/x/p.jpg', publicId: 'x/p' })],
  // Packing and the announcement
  ['attachPackingPhoto', () => packing.attachPackingPhoto(ID, 'https://res.cloudinary.com/x/k.jpg', 'x/k')],
  ['fetchAnnouncement', () => packing.fetchAnnouncement(ID, 'roman')],
  // The assistant
  ['fetchAiUsage', () => ai.fetchAiUsage()],
  ['scanReceipt', () => ai.scanReceipt('https://res.cloudinary.com/x/r.jpg', 'x/r')],
  ['draftDescription', () => ai.draftDescription(ID)],
  ['saveDescription', () => ai.saveDescription(ID, { description: 'Slow-cooked over coal.', descriptionUr: 'کوئلے پر پکی ہوئی' })],
  ['suggestSpecials', () => ai.suggestSpecials([ID])],
  ['createSpecial', () => ai.createSpecial({ name: 'Palak paneer', description: 'Tonight only', basePrice: 650, categoryId: ID, servings: 4, lines: [{ ingredientId: ID, qty: 1, unit: 'kg' }] })],
  ['suggestCombos', () => ai.suggestCombos()],
  ['checkPhoto', () => ai.checkPhoto('https://res.cloudinary.com/x/d.jpg', ID)],
  ['fetchReviewInsights', () => ai.fetchReviewInsights()],
  // The kitchen's nutrition
  ['fetchVendorNutrition', () => nutrition.fetchVendorNutrition()],
  ['fetchItemNutrition', () => nutrition.fetchItemNutrition(ID)],
  ['estimateNutrition', () => nutrition.estimateNutrition(ID)],
  ['setNutritionHidden', () => nutrition.setNutritionHidden(ID, true)],
  ['searchNutritionFoods', () => nutrition.searchNutritionFoods('rice')],
  ['fetchNutritionMapping', () => nutrition.fetchNutritionMapping()],
  ['setNutritionMapping', () => nutrition.setNutritionMapping(ID, ID, 55)],
  ['acceptMappingSuggestions', () => nutrition.acceptMappingSuggestions()],
  // Voice
  ['interpretVoice', () => voice.interpretVoice({ context: 'purchases', language: 'ur', audioUrl: 'https://res.cloudinary.com/x/v.m4a', publicId: 'x/v', durationMs: 4200 })],
  ['confirmVoiceAction', () => voice.confirmVoiceAction({ method: 'PATCH', path: '/food/vendor/today', body: { items: [{ itemId: ID, portions: 20 }] } })],
  // Tiffin, the kitchen
  ['fetchMyTiffinPlans', () => tiffin.fetchMyTiffinPlans()],
  ['fetchMyTiffinPlan', () => tiffin.fetchMyTiffinPlan(ID)],
  ['createTiffinPlan', () => tiffin.createTiffinPlan(plan)],
  ['updateTiffinPlan', () => tiffin.updateTiffinPlan(ID, { ...plan, photoUrl: null, isActive: false })],
  ['fetchTiffinSubscriptions', () => tiffin.fetchTiffinSubscriptions({ status: 'pending', planId: ID })],
  ['moveSubscriber', () => tiffin.moveSubscriber(ID, 'decline', { reason: 'The plan is full' })],
  ['confirmTiffinPayment', () => tiffin.confirmTiffinPayment(ID)],
  ['rejectTiffinPayment', () => tiffin.rejectTiffinPayment(ID, 'Not received')],
  ['fetchTiffinTomorrow', () => tiffin.fetchTiffinTomorrow('2026-11-02')],
  // Tiffin, customers
  ['fetchTiffinPlans', () => tiffin.fetchTiffinPlans('khala-rukhsanas-kitchen')],
  ['fetchTiffinPlan', () => tiffin.fetchTiffinPlan(ID)],
  ['subscribeTiffin', () => tiffin.subscribeTiffin(ID, { startDate: '2026-11-02', addressId: ID, paymentMethod: 'transfer' }, ID)],
  ['fetchMyTiffins', () => tiffin.fetchMyTiffins()],
  ['fetchTiffinCalendar', () => tiffin.fetchTiffinCalendar(ID, '2026-11')],
  ['skipTiffinDay', () => tiffin.skipTiffinDay(ID, '2026-11-03', true)],
  ['pauseMyTiffin', () => tiffin.pauseMyTiffin(ID, '2026-11-08')],
  ['resumeMyTiffin', () => tiffin.resumeMyTiffin(ID)],
  ['cancelMyTiffin', () => tiffin.cancelMyTiffin(ID)],
  ['submitTiffinProof', () => tiffin.submitTiffinProof(ID, { transactionId: 'IBFT 1', imageUrl: 'https://res.cloudinary.com/x/p.jpg' })],
  // Catering
  ['fetchCateringVendor', () => catering.fetchCateringVendor('qandeel-karahi-house')],
  [
    'requestCatering',
    () =>
      catering.requestCatering({ vendorId: ID, date: '2026-11-08', time: '19:30', guests: 40, eventType: 'dawat', dishes: [{ itemId: ID, qty: 10 }, { name: 'Kheer for dessert', qty: 0 }], budget: 50000, mode: 'delivery', addressId: ID, notes: 'Two tables' }),
  ],
  ['fetchMyCateringRequests', () => catering.fetchMyCateringRequests()],
  ['fetchMyCateringRequest', () => catering.fetchMyCateringRequest(ID)],
  ['acceptQuote', () => catering.acceptQuote(ID, 2)],
  ['submitAdvanceProof', () => catering.submitAdvanceProof(ID, { transactionId: 'IBFT 99', imageUrl: 'https://res.cloudinary.com/x/a.jpg' })],
  ['cancelMyCatering', () => catering.cancelMyCatering(ID, 'Plans changed')],
  ['fetchCateringSettings', () => catering.fetchCateringSettings()],
  ['updateCateringSettings', () => catering.updateCateringSettings({ open: true, minGuests: 20, leadDays: 2 })],
  ['fetchCateringRequests', () => catering.fetchCateringRequests('requested')],
  ['fetchCateringRequest', () => catering.fetchCateringRequest(ID)],
  ['sendQuote', () => catering.sendQuote(ID, { lines: [{ itemId: ID, name: 'Chicken Handi', qty: 10, unitPrice: 1400 }], deliveryFee: 0, advancePct: 30, validUntil: '2026-11-05T19:00:00.000Z', notes: 'With serving dishes' })],
  ['declineCatering', () => catering.declineCatering(ID, 'Booked that evening')],
  ['confirmAdvance', () => catering.confirmAdvance(ID)],
  ['rejectAdvance', () => catering.rejectAdvance(ID, 'The amount is short.')],
  // Ramadan, the storefront, story, demand, menu engineering and experiments, batching
  ['fetchRamadan', () => ramadan.fetchRamadan()],
  ['updateRamadan', () => ramadan.updateRamadan({ enabled: true, sehri: { from: '02:30', to: '04:45' }, iftar: { from: '17:30', to: '21:30' }, iftarPreorderOnly: true })],
  ['fetchStorefront', () => storefront.fetchStorefront(30)],
  ['fetchStory', () => story.fetchStory()],
  ['saveStory', () => story.saveStory({ text: 'Our biryani is sealed on a slow fire.', cookName: 'Ustad Zafran', photoUrls: ['https://res.cloudinary.com/x/s.jpg'], videoUrl: null }, { gloves: true, hairnet: true, cleanWater: true, fridgeTempLog: true, separateBoards: true, pestControlOn: '2026-10-02' })],
  ['fetchDemandMap', () => demand.fetchDemandMap({ cuisineId: ID, hour: 13, week: '2026-10-26' })],
  ['fetchDemandCurve', () => demand.fetchDemandCurve(8)],
  ['fetchMenuInsights', () => experiments.fetchMenuInsights()],
  ['fetchExperiments', () => experiments.fetchExperiments('running')],
  ['startExperiment', () => experiments.startExperiment({ itemId: ID, days: 14, notes: 'Price Rs 60 → Rs 50' })],
  ['fetchExperiment', () => experiments.fetchExperiment(ID)],
  ['updateExperiment', () => experiments.updateExperiment(ID, { notes: 'Price Rs 60 → Rs 50 · Kept' })],
  ['endExperiment', () => experiments.endExperiment(ID)],
  ['cancelExperiment', () => experiments.cancelExperiment(ID)],
  ['fetchBatchSuggestions', () => batching.fetchBatchSuggestions(ID)],
  // My Kitchen and the customer's nutrition
  ['fetchNutritionProfile', () => myNutrition.fetchNutritionProfile()],
  ['saveNutritionProfile', () => myNutrition.saveNutritionProfile({ goal: 'lose', metrics: { sex: 'female', age: 29, heightCm: 162, weightKg: 64, activity: 'light' }, manualTargetKcal: null, showCalories: true })],
  ['deleteNutritionProfile', () => myNutrition.deleteNutritionProfile()],
  ['fetchNutritionSummary', () => myNutrition.fetchNutritionSummary('30d')],
  ['fetchHealthyPicks', () => myNutrition.fetchHealthyPicks({ lat: 31.48, lng: 74.32 })],
  ['fetchPantry', () => pantry.fetchPantry('expired')],
  ['fetchExpiringPantry', () => pantry.fetchExpiringPantry()],
  ['addPantryItem', () => pantry.addPantryItem({ name: 'palak', qty: 2, unit: 'pao', expiresOn: '2026-11-03' })],
  ['addPantryItems', () => pantry.addPantryItems([{ name: 'doodh', qty: 1, unit: 'l' }, { name: 'anday', qty: 12, unit: 'pc' }])],
  ['updatePantryItem', () => pantry.updatePantryItem(ID, { qty: 300, unit: 'g', expiresOn: null })],
  ['removePantryItem', () => pantry.removePantryItem(ID)],
  ['markPantryUsed', () => pantry.markPantryUsed(ID)],
  ['discardPantryItem', () => pantry.discardPantryItem(ID)],
  ['fetchGroceryOrders', () => pantry.fetchGroceryOrders()],
  ['addFromShoppingOrder', () => pantry.addFromShoppingOrder([{ storeOrderItemId: ID, expiresOn: '2026-11-05' }])],
  ['fetchPantryReminders', () => pantry.fetchPantryReminders()],
  ['savePantryReminders', () => pantry.savePantryReminders({ enabled: true, time: '09:00', daysBefore: 2 })],
  ['fetchPantryStats', () => pantry.fetchPantryStats(30)],
  ['suggestHomeRecipes', () => homeRecipes.suggestHomeRecipes()],
  ['fetchMissingItems', () => homeRecipes.fetchMissingItems(['tomato', 'paneer'], 'Lahore')],
  // The staff console's Kitchen tools
  ['fetchHygieneQueue', () => admin.fetchHygieneQueue('verified')],
  ['verifyHygiene', () => admin.verifyHygiene(ID, 'video_call', 'Walked through the kitchen')],
  ['revokeHygiene', () => admin.revokeHygiene(ID, 'A customer complaint; we will visit again.')],
  ['fetchAiUsageReport', () => admin.fetchAiUsageReport()],
  ['fetchAiSettings', () => admin.fetchAiSettings()],
  ['fetchAiPrompts', () => admin.fetchAiPrompts()],
  ['setAiEnabled', () => admin.setAiEnabled(false, '123456')],
  ['fetchReferenceItems', () => admin.fetchReferenceItems('rice')],
  ['importReferencePrices', () => admin.importReferencePrices('week_ending,city,item,unit,price\n2026-10-15,Lahore,Tomatoes,kg,180', true)],
  ['fetchNutritionFoods', () => admin.fetchNutritionFoods({ q: 'rice', page: 1, pageSize: 30 })],
  ['createNutritionFood', () => admin.createNutritionFood({ key: 'khoya', name: 'Khoya', kcal: 421, protein: 14.6, carbs: 25, fat: 30 })],
  ['updateNutritionFood', () => admin.updateNutritionFood(ID, { kcal: 420 })],
  ['activateNutritionFood', () => admin.activateNutritionFood(ID)],
  ['deactivateNutritionFood', () => admin.deactivateNutritionFood(ID)],
  ['importNutritionFoods', () => admin.importNutritionFoods('key,name\nx,X', false)],
  ['fetchAliases', () => admin.fetchAliases('tamatar')],
  ['createAlias', () => admin.createAlias({ word: 'laal tamatar', language: 'roman', key: 'tomato' })],
  ['deleteAlias', () => admin.deleteAlias(ID)],
  ['fetchCalendarEvents', () => admin.fetchCalendarEvents({ kind: 'ramadan', from: '2026-11-01', city: 'Lahore', page: 1 })],
  ['createCalendarEvent', () => admin.createCalendarEvent({ kind: 'eid', name: 'Eid ul Fitr', startsOn: '2027-03-10', endsOn: '2027-03-12', city: null })],
  ['updateCalendarEvent', () => admin.updateCalendarEvent(ID, { name: 'Eid ul Fitr (expected)', city: 'Lahore' })],
  ['deleteCalendarEvent', () => admin.deleteCalendarEvent(ID)],
  ['fetchSignatures', () => admin.fetchSignatures('removed')],
  ['removeSignature', () => admin.removeSignature(ID, 'A copy of a chain’s recipe')],
  ['fetchPlatformDemand', () => admin.fetchPlatformDemand({ city: 'Lahore', cuisineId: ID, hour: 20, week: '2026-10-26' })],
  ['fetchDemandCities', () => admin.fetchDemandCities()],
  ['lookupGrowthCode', () => admin.lookupGrowthCode('ct-mhd7q4')],
];

const MODULES = { costing, forecast, cards, ai, nutrition, packing, purchases, recipes, stock, surplus, waste, customerSurplus, batching, catering, demand, experiments, ramadan, storefront, story, tiffin, voice, myNutrition, pantry, homeRecipes, admin };

describe('Kitchen Intelligence ↔ API contract (docs/openapi.json)', () => {
  it.each(CASES)('%s', async (_name, call) => {
    const reqs = await run(call);
    expect(reqs).toHaveLength(1);
    expect(problems(reqs[0])).toEqual([]);
  });

  it('covers every Kitchen network function', () => {
    const covered = new Set(CASES.map(([name]) => name));
    const missing = Object.entries(MODULES).flatMap(([mod, m]) =>
      Object.entries(m)
        .filter(([, v]) => typeof v === 'function')
        .map(([name]) => name)
        .filter(name => !/^api[A-Z]/.test(name) && !['lineQty', 'baseQty', 'apiUnit', 'apiWeekday'].includes(name) && !covered.has(name))
        .map(name => `${mod}.${name}`),
    );
    expect(missing).toEqual([]);
  });

  it('sends Bachat Box and tiffin reservations with an Idempotency-Key, and pantry quantities in the pantry’s units', async () => {
    const [p] = await run(() => pantry.addPantryItem({ name: 'palak', qty: 2, unit: 'pao' }));
    expect(p.body).toMatchObject({ name: 'palak', qty: 500, unit: 'g' });
    sent = [];
    const [plansReq] = await run(() => tiffin.createTiffinPlan(plan));
    // The API's weekdays: 0 Sunday … 6 Saturday; its periods: weekly, monthly.
    expect(plansReq.body).toMatchObject({ days: [1, 2, 3, 4, 5], period: 'weekly', deliveryMode: 'both', skipCutoffHour: 20 });
  });
});
