// The assumed kitchen contract (docs/API_KITCHEN_ASSUMED.md, AI_ASSUMED.md,
// VOICE_ASSUMED.md) and the dummy API agree: every JSON example marked
// `<!-- contract: name -->` has the keys the dummy API's answer to that
// request has — at every level, the first item of each list — and every
// request this suite runs is documented. Until the backend ships its own
// documents this keeps the assumed contract and the dummy API one thing
// (when it does, a parity test on real captures replaces this, as Food's).

import fs from 'fs';
import path from 'path';
import { MainAxiosInstance, required } from '../../network';
import { clearTokens } from '../../../../utils/storage_utils/storageUtils';
import { resetMockDb } from '../mockDb';
import { addToFoodCart, clearFoodCart } from '../../../food/cart';
import { placeFoodOrder } from '../../../food/orders';
import { addToCart, fetchCart, removeCartLine } from '../../../shopping/cart';
import { placeOrder } from '../../../shopping/checkout';
import { fetchAddresses } from '../../../addresses/addresses';
import { signInAs, installDummyApi } from '../testing';
import { addressListSerializer } from '../../../../serializers/addressSerializer';
import { cartSerializer } from '../../../../serializers/shopping/cartSerializer';
import { orderGroupSerializer } from '../../../../serializers/shopping/orderSerializer';
import { foodOrderSerializer } from '../../../../serializers/food/orderSerializer';

installDummyApi();

const DOCS = ['API_KITCHEN_ASSUMED.md', 'AI_ASSUMED.md', 'VOICE_ASSUMED.md'].map(f => path.join(__dirname, '../../../../docs', f));
const T0 = new Date('2026-10-15T10:00:00Z').getTime();
const out: Record<string, { data?: unknown; error?: unknown }> = {};

const call = async (name: string, method: 'get' | 'post' | 'put' | 'patch' | 'delete', url: string, body?: unknown, headers?: Record<string, string>) => {
  try {
    const r = method === 'get' || method === 'delete' ? await MainAxiosInstance[method](url, { headers }) : await MainAxiosInstance[method](url, body, { headers });
    out[name] = r.data;
    return r.data.data;
  } catch (e) {
    out[name] = (e as { response?: { data?: { error?: unknown } } }).response?.data ?? {};
    return null;
  }
};
const clearShopCart = async () => {
  for (const l of (required(cartSerializer(await fetchCart()))).groups.flatMap(g => g.lines)) await removeCartLine(l.id);
};
const as = async (email: string, _portal: 'customer' | 'partner' = 'partner') => {
  await clearTokens();
  await signInAs(email);
};

const run = async () => {
  jest.setSystemTime(T0);
  await resetMockDb();
  await as('restaurant@metromatrix.app');
  await call('settings', 'get', '/food/vendor/kitchen/settings');
  await call('summary', 'get', '/food/vendor/kitchen/summary');
  await call('cards', 'get', '/food/vendor/kitchen/insights/cards');
  await call('snooze', 'post', '/food/vendor/kitchen/insights/cards/running_low%3A2026-10-15/snooze');
  await call('board', 'get', '/food/vendor/kitchen/board');
  await call('stock', 'get', '/food/vendor/kitchen/stock?segment=all');
  await call('ingredient', 'get', '/food/vendor/kitchen/ingredients/ing_bb_chicken');
  await call('ingredientCreate', 'post', '/food/vendor/kitchen/ingredients', { name: 'Shimla mirch', category: 'vegetables', baseUnit: 'g', parLevel: 2000 });
  await call('stockTake', 'post', '/food/vendor/kitchen/stock-takes', { lines: [{ ingredientId: 'ing_bb_cream', counted: 500 }, { ingredientId: 'ing_bb_salt', counted: 5000 }] });
  await call('suppliers', 'get', '/food/vendor/kitchen/suppliers');
  await call('purchases', 'get', '/food/vendor/kitchen/purchases?page=1&pageSize=2');
  await call('purchaseCreate', 'post', '/food/vendor/kitchen/purchases', { source: 'voice', supplierName: 'Anwar Sabzi Wala', lines: [{ ingredientId: 'ing_bb_tomato', qty: 5, unit: 'kg', total: 1200 }, { newIngredient: { name: 'Capsicum', category: 'vegetables', baseUnit: 'g' }, qty: 1, unit: 'kg', total: 280 }] });
  await call('priceWatch', 'get', '/food/vendor/kitchen/price-watch');
  await call('recipes', 'get', '/food/vendor/kitchen/recipes');
  await call('recipe', 'get', '/food/vendor/kitchen/recipes/mi_chicken_biryani?variantId=mi_chicken_biryani_v1');
  await call('forecast', 'get', '/food/vendor/kitchen/forecast?date=2026-10-16');
  await call('forecastAdjust', 'put', '/food/vendor/kitchen/forecast/2026-10-16/items/mi_chicken_biryani', { adjusted: 30 });
  await call('accuracy', 'get', '/food/vendor/kitchen/forecast/accuracy');
  await call('prep', 'get', '/food/vendor/kitchen/prep-sheet?date=2026-10-16');
  await call('shoppingList', 'get', '/food/vendor/kitchen/shopping-list?date=2026-10-16');
  await call('waste', 'post', '/food/vendor/kitchen/waste', { lines: [{ ingredientId: 'ing_bb_onion', qty: 2, unit: 'kg', reason: 'spoiled' }] });
  await call('wasteSummary', 'get', '/food/vendor/kitchen/waste/summary?range=7d');
  await call('donations', 'get', '/food/vendor/kitchen/donations');
  await call('usage', 'get', '/food/vendor/ai/usage');
  await call('receipt', 'post', '/food/vendor/ai/receipt-scan', { imageUrl: 'https://res.cloudinary.com/demo/receipt.jpg' });
  await call('voice', 'post', '/ai/voice/interpret', { context: 'stock', language: 'auto', text: '5 kilo tamatar 1200 rupay' });
  const box = await call('boxCreate', 'post', '/food/vendor/surplus', { title: 'Chef’s mix box', contentsHint: 'Biryani and kebabs from today', value: 1200, price: 450, quantity: 3, pickupFrom: new Date(T0 + 3600e3).toISOString(), pickupTo: new Date(T0 + 3 * 3600e3).toISOString() });
  jest.setSystemTime(T0 + 9 * 3600e3);
  await call('suggestion', 'get', '/food/vendor/surplus/suggestion');
  jest.setSystemTime(T0);
  await call('pause', 'post', '/food/vendor/pause', { reason: 'gas', resumeAt: new Date(T0 + 1800e3).toISOString() });
  await call('resume', 'post', '/food/vendor/resume');
  // An order to show the packing photo and the announcement on.
  await as('customer@metromatrix.app', 'customer');
  await clearFoodCart();
  await addToFoodCart({ vendorId: 'fb_resto', itemId: 'mi_chicken_biryani', variantId: 'mi_chicken_biryani_v1', optionIds: ['og_spice_1'], quantity: 2, notes: null }, true);
  const order = required(foodOrderSerializer(await placeFoodOrder({ addressId: 'ad_customer_home', paymentMethod: 'cod', promoCode: null, cutlery: false, note: null, building: null, floor: null, riderInstructions: null }, 'k1')));
  await call('surplusNearby', 'get', '/food/surplus?lat=31.5102&lng=74.3441');
  await call('surplusDetail', 'get', `/food/surplus/${box.id}?lat=31.5102&lng=74.3441`);
  const res = await call('reserve', 'post', `/food/surplus/${box.id}/reserve`, { quantity: 1, paymentMethod: 'transfer' }, { 'Idempotency-Key': 'doc-1' });
  await call('reservations', 'get', '/food/surplus/reservations');
  await call('proof', 'post', `/food/surplus/reservations/${res.code}/payment-proof`, { transactionId: 'RAAST-88231', imageUrl: 'https://res.cloudinary.com/demo/proof.jpg' });
  await as('hamza@metromatrix.app', 'customer');
  await call('reserveSoldOut', 'post', `/food/surplus/${box.id}/reserve`, { quantity: 2, paymentMethod: 'pay_at_pickup' }, { 'Idempotency-Key': 'doc-2' });
  await as('restaurant@metromatrix.app');
  await call('boxDetail', 'get', `/food/vendor/surplus/${box.id}`);
  await call('boxPaymentConfirm', 'post', `/food/vendor/surplus/reservations/${res.code}/payment/confirm`);
  await call('collect', 'post', `/food/vendor/surplus/reservations/${res.code}/collect`);
  await call('boxes', 'get', '/food/vendor/surplus?scope=live');
  await call('announcementUr', 'get', `/food/vendor/orders/${order.id}/announcement?language=ur`);
  await call('announcementEn', 'get', `/food/vendor/orders/${order.id}/announcement?language=en`);
  await MainAxiosInstance.patch('/food/vendor/kitchen/settings', { packingPhoto: 'required' });
  await MainAxiosInstance.post(`/food/vendor/orders/${order.id}/accept`, { etaMinutes: 20 });
  await MainAxiosInstance.post(`/food/vendor/orders/${order.id}/preparing`);
  await call('readyNoPhoto', 'post', `/food/vendor/orders/${order.id}/ready`);
  await call('packing', 'post', `/food/vendor/orders/${order.id}/packing-photo`, { imageUrl: 'https://res.cloudinary.com/demo/packed.jpg' });
  await call('readyWithPhoto', 'post', `/food/vendor/orders/${order.id}/ready`);
  await clearTokens();
  await signInAs('admin@metromatrix.app');
  await call('adminQuota', 'put', '/admin/kitchen/ai/quotas/b_resto', { limit: 1 });
  await as('restaurant@metromatrix.app');
  await call('quotaReached', 'post', '/food/vendor/ai/receipt-scan', { imageUrl: 'https://res.cloudinary.com/demo/receipt.jpg' });
  // Back to the plan's limit for the rest of the run.
  await clearTokens();
  await signInAs('admin@metromatrix.app');
  await MainAxiosInstance.put('/admin/kitchen/ai/quotas/b_resto', { limit: null });

  // ── Tiffin (5B): Thursday 15 Oct, 3 PM in Lahore ──
  jest.setSystemTime(T0);
  await as('nani@metromatrix.app');
  await call('tiffinPlans', 'get', '/food/vendor/tiffin/plans');
  await call('tiffinPlanCreate', 'post', '/food/vendor/tiffin/plans', {
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
  await as('customer@metromatrix.app', 'customer');
  await call('tiffinPlansPublic', 'get', '/food/tiffin/plans?vendor=nani-ki-handi');
  await call('tiffinPlan', 'get', '/food/tiffin/plans/tp_nani_lunch');
  const sub = await call('tiffinSubscribe', 'post', '/food/tiffin/plans/tp_nani_lunch/subscribe', { startDate: '2026-10-16', addressId: 'ad_customer_home', paymentMethod: 'transfer' }, { 'Idempotency-Key': 'doc-tf-1' });
  await as('nani@metromatrix.app');
  await call('tiffinInbox', 'get', '/food/vendor/tiffin/subscriptions?status=pending');
  await call('tiffinApprove', 'post', `/food/vendor/tiffin/subscriptions/${sub.code}/approve`);
  await call('tiffinSubscribers', 'get', '/food/vendor/tiffin/plans/tp_nani_lunch/subscribers');
  await as('customer@metromatrix.app', 'customer');
  await call('tiffinSubscription', 'get', `/food/tiffin/subscriptions/${sub.code}`);
  await call('tiffinSkip', 'post', `/food/tiffin/subscriptions/${sub.code}/days/2026-10-19/skip`);
  await call('tiffinCalendar', 'get', `/food/tiffin/subscriptions/${sub.code}/calendar?month=2026-10`);
  const period = (out.tiffinSubscription?.data as { period: { id: string } }).period;
  await call('tiffinProof', 'post', `/food/tiffin/periods/${period.id}/payment-proof`, { transactionId: 'RAAST-40912', imageUrl: null });
  await call('tiffinSubscriptions', 'get', '/food/tiffin/subscriptions');
  // 11 PM: Friday's cut-off (10:30 PM) has passed; its order is on the board.
  jest.setSystemTime(T0 + 8 * 3600e3);
  await call('tiffinSkipClosed', 'post', `/food/tiffin/subscriptions/${sub.code}/days/2026-10-16/skip`);
  await as('nani@metromatrix.app');
  await call('tiffinTomorrow', 'get', '/food/vendor/tiffin/tomorrow');
  await call('tiffinBoard', 'get', '/food/vendor/orders?bucket=active');
  await call('tiffinPeriodConfirm', 'post', `/food/vendor/tiffin/periods/${period.id}/payment/confirm`);

  // ── Catering (5B) ──
  jest.setSystemTime(T0);
  await as('customer@metromatrix.app', 'customer');
  await call('cateringVendor', 'get', '/food/catering/vendors/biryani-bazaar');
  const req = await call('cateringRequest', 'post', '/food/catering/requests', {
    vendorId: 'fb_resto',
    date: '2026-10-31',
    time: '19:30',
    guests: 60,
    eventType: 'aqiqah',
    dishes: [
      { itemId: 'mi_chicken_biryani', qty: 60 },
      { name: 'Zarda', qty: 60 },
    ],
    budget: 45000,
    mode: 'delivery',
    addressId: 'ad_customer_home',
    notes: 'Please include raita.',
  });
  await as('restaurant@metromatrix.app');
  await call('cateringInbox', 'get', '/food/vendor/catering/requests?status=new');
  const quote = (version: number, unitPrice: number) => ({
    lines: [
      { itemId: 'mi_chicken_biryani', qty: 60, unitPrice },
      { name: 'Zarda', qty: 60, unitPrice: 110 },
    ],
    deliveryFee: 1500,
    advancePct: 30,
    validUntil: '2026-10-22T18:59:00.000Z',
    notes: version === 1 ? 'Raita included.' : 'Raita included; biryani at the bulk rate.',
  });
  await call('cateringQuote', 'post', `/food/vendor/catering/requests/${req.code}/quotes`, quote(1, 520));
  await call('cateringQuote2', 'post', `/food/vendor/catering/requests/${req.code}/quotes`, quote(2, 480));
  await as('customer@metromatrix.app', 'customer');
  await call('quoteOutdated', 'post', `/food/catering/requests/${req.code}/quotes/1/accept`);
  await call('cateringAccept', 'post', `/food/catering/requests/${req.code}/quotes/2/accept`);
  await call('cateringProof', 'post', `/food/catering/requests/${req.code}/advance-proof`, { transactionId: 'IBFT-77120', imageUrl: null });
  await call('cateringRequests', 'get', '/food/catering/requests');
  await as('restaurant@metromatrix.app');
  await call('cateringConfirm', 'post', `/food/vendor/catering/requests/${req.code}/advance/confirm`);
  await call('cateringCalendar', 'get', '/food/vendor/catering/calendar?month=2026-10');
  await call('cateringSettings', 'get', '/food/vendor/catering/settings');

  // ── Growth (5B): Ramadan, storefront, demand, menu insights, experiments, story, hygiene, batching ──
  jest.setSystemTime(T0);
  await as('restaurant@metromatrix.app');
  await call('ramadan', 'get', '/food/vendor/ramadan');
  await call('ramadanClosed', 'put', '/food/vendor/ramadan', { enabled: true });
  await call('storefront', 'get', '/food/vendor/storefront');
  await call('demand', 'get', '/food/vendor/demand');
  await call('menuInsights', 'get', '/food/vendor/menu-insights');
  const ex = await call('experimentStart', 'post', '/food/vendor/experiments', { itemId: 'mi_seekh', change: { kind: 'price', price: 990 }, days: 3 });
  await call('experiments', 'get', '/food/vendor/experiments');
  await call('story', 'get', '/food/vendor/story');
  await call('storyPut', 'put', '/food/vendor/story', { text: 'Three brothers from Gujranwala, cooking biryani the way our father did since 1998.', cookName: 'Imran Qureshi', photoUrls: ['https://res.cloudinary.com/demo/kitchen.jpg'] });
  // Two deliveries to the same street: the second rides with the first.
  await as('customer@metromatrix.app', 'customer');
  await clearFoodCart();
  await addToFoodCart({ vendorId: 'fb_resto', itemId: 'mi_naan', variantId: null, optionIds: [], quantity: 10, notes: null }, true);
  const second = required(foodOrderSerializer(await placeFoodOrder({ addressId: 'ad_customer_home', paymentMethod: 'cod', promoCode: null, cutlery: false, note: null, building: null, floor: null, riderInstructions: null }, 'k2')));
  await as('restaurant@metromatrix.app');
  await MainAxiosInstance.post(`/food/vendor/orders/${second.id}/accept`, { etaMinutes: 25 });
  await call('batch', 'get', `/food/vendor/orders/${second.id}/batch-suggestions`);
  await as('nani@metromatrix.app');
  await call('hygiene', 'get', '/food/vendor/hygiene');
  await call('hygieneItem', 'put', '/food/vendor/hygiene/items/water', { done: true, evidenceUrl: 'https://res.cloudinary.com/demo/filter.jpg' });
  await call('hygieneRequest', 'post', '/food/vendor/hygiene/request-verification');
  await clearTokens();
  await signInAs('admin@metromatrix.app');
  await call('hygieneQueue', 'get', '/admin/kitchen/hygiene?status=pending');
  await call('hygieneVerify', 'post', '/admin/kitchen/hygiene/b_nani/verify');
  await as('customer@metromatrix.app', 'customer');
  await call('iftar', 'get', '/food/ramadan/iftar?lat=31.5102&lng=74.3441');
  await call('tiffinNearby', 'get', '/food/tiffin/plans?lat=31.5102&lng=74.3441');
  // Four days on: the price test has finished, with a result.
  jest.setSystemTime(T0 + 4 * 86_400_000);
  await as('restaurant@metromatrix.app');
  await call('experimentDone', 'get', `/food/vendor/experiments/${ex.id}`);
  await call('experimentKeep', 'post', `/food/vendor/experiments/${ex.id}/keep`);
  // ── The assistant (5C): drafts, review themes, nutrition ──
  await as('restaurant@metromatrix.app');
  await call('descriptions', 'post', '/food/vendor/ai/descriptions', { itemIds: ['mi_chicken_biryani', 'mi_naan'] });
  await call('saveUrdu', 'patch', '/food/vendor/menu/items/mi_naan', { description: 'Fresh naan from the tandoor.', descriptionUr: 'تنور سے تازہ نان۔' });
  await call('specials', 'post', '/food/vendor/ai/specials', {});
  await call('combos', 'post', '/food/vendor/ai/combos');
  await call('photoCheck', 'post', '/food/vendor/ai/photo-check', { imageUrl: 'https://res.cloudinary.com/demo/kebab.jpg', itemId: 'mi_seekh' });
  await call('reviewInsights', 'get', '/food/vendor/reviews/insights');
  await call('reviewsByTheme', 'get', '/food/vendor/reviews?theme=late');
  await call('nutrition', 'get', '/food/vendor/nutrition');
  await call('nutritionHide', 'patch', '/food/vendor/nutrition/mi_kheer', { hidden: true });
  await call('nutritionFoods', 'get', '/food/vendor/kitchen/nutrition-foods?q=plum');
  // ── My Kitchen (5C): the customer's pantry, recipes, nutrition ──
  await as('customer@metromatrix.app', 'customer');
  await call('pantry', 'get', '/my-kitchen/pantry?segment=all');
  await call('pantryAdd', 'post', '/my-kitchen/pantry', { source: 'voice', lines: [{ name: 'aloo', key: 'potato', qty: 2, unit: 'kg', expiresOn: '2026-10-22' }] });
  await call('pantryUse', 'post', '/my-kitchen/pantry/pn_seed_4/use', {});
  await call('pantryStats', 'get', '/my-kitchen/stats');
  await call('pantryReminders', 'get', '/my-kitchen/pantry/reminders');
  // A grocery order to add from.
  await clearShopCart();
  await addToCart('p_g5_v0', 1);
  const home = (required(addressListSerializer(await fetchAddresses()))).find(x => x.city === 'Lahore')!;
  const grocery = required(orderGroupSerializer(await placeOrder({ addressId: home.id, stores: [{ storeId: 's_basket', paymentMethod: 'cod', couponCode: null, note: null }] }, 'kc-groceries')));
  void grocery;
  await call('pantryOrders', 'get', '/my-kitchen/pantry/shopping-orders');
  const ord = (out.pantryOrders.data as { items: { orderId: string; lines: { lineId: string }[] }[] }).items[0];
  await call('pantryFromOrder', 'post', '/my-kitchen/pantry/from-shopping-order', { orderId: ord.orderId, lineIds: ord.lines.map(l => l.lineId) });
  await call('recipeSuggest', 'post', '/my-kitchen/recipes/suggest', { language: 'en', maxMinutes: 45, servings: 4 });
  await call('homeRecipe', 'get', '/my-kitchen/recipes/rc_aloo_keema?language=ur&servings=4');
  await call('missingItems', 'get', '/my-kitchen/recipes/rc_aloo_keema/missing-items?servings=4');
  await call('nutritionOff', 'get', '/my-kitchen/nutrition/settings');
  await call('nutritionOn', 'put', '/my-kitchen/nutrition/settings', { enabled: true, showCalories: true, goal: 'maintain', metrics: { sex: 'female', age: 31, heightCm: 163, weightKg: 62, activity: 'moderate' } });
  await call('nutritionSummary', 'get', '/my-kitchen/nutrition/summary?days=7');
  await call('healthyPicks', 'get', '/food/healthy-picks?lat=31.5102&lng=74.3441');
  await call('nutritionDelete', 'delete', '/my-kitchen/nutrition');
  // ── The staff console's Kitchen tools (5C) ──
  await clearTokens();
  await signInAs('admin@metromatrix.app');
  await call('adminAiUsage', 'get', '/admin/kitchen/ai/usage');
  await call('adminAiSwitch', 'patch', '/admin/kitchen/ai/settings', { enabled: true });
  await call('adminPrices', 'get', '/admin/kitchen/reference-prices?city=Lahore&q=tom');
  const prices = 'key,city,week,price\ntomato,Lahore,2026-10-19,190\nonion,Lahore,2026-10-20,150\nshimla,Lahore,2026-10-19,300';
  await call('adminPricePreview', 'post', '/admin/kitchen/reference-prices?dryRun=true', { csv: prices });
  await call('adminPriceRefused', 'post', '/admin/kitchen/reference-prices', { csv: prices });
  await call('adminPriceImport', 'post', '/admin/kitchen/reference-prices', { csv: 'key,city,week,price\ntomato,Lahore,2026-10-19,190' });
  await call('adminFoods', 'get', '/admin/kitchen/nutrition-foods?q=tomato');
  const food = await call('adminFoodCreate', 'post', '/admin/kitchen/nutrition-foods', { key: 'shimla_mirch', name: 'Shimla mirch (capsicum)', per: 'g100', kcal: 20, protein: 0.9, carbs: 4.6, fat: 0.2 });
  await call('adminFoodEdit', 'patch', `/admin/kitchen/nutrition-foods/${food.id}`, { kcal: 21 });
  await call('adminFoodImport', 'post', '/admin/kitchen/nutrition-foods/import?dryRun=true', { csv: 'key,name,per,kcal,protein,carbs,fat\nshimla_mirch,Shimla mirch (capsicum),g100,21,0.9,4.6,0.2\nkhoya,Khoya,g100,421,14.6,25,30' });
  await call('adminKeys', 'get', '/admin/kitchen/ingredient-keys?q=tom');
  await call('adminAliases', 'get', '/admin/kitchen/aliases?q=tamatar');
  const alias = await call('adminAliasCreate', 'post', '/admin/kitchen/aliases', { word: 'Tomatar', language: 'roman_ur', key: 'tomato' });
  await call('adminAliasExists', 'post', '/admin/kitchen/aliases', { word: 'tomatar', language: 'roman_ur', key: 'onion' });
  await call('adminAliasDelete', 'delete', `/admin/kitchen/aliases/${alias.id}`);
  await call('adminEvents', 'get', '/admin/kitchen/calendar-events');
  const event = await call('adminEventCreate', 'post', '/admin/kitchen/calendar-events', { kind: 'other', name: 'Basant', startsOn: '2027-02-05', endsOn: '2027-02-06' });
  await call('adminEventOverlap', 'post', '/admin/kitchen/calendar-events', { kind: 'ramadan', name: 'Ramadan (corrected)', startsOn: '2027-02-09', endsOn: '2027-03-10' });
  await call('adminEventEdit', 'patch', '/admin/kitchen/calendar-events/ev_ramadan_1448', { startsOn: '2027-02-09', endsOn: '2027-03-10' });
  await call('adminEventDelete', 'delete', `/admin/kitchen/calendar-events/${event.id}`);
  await call('adminSignatures', 'get', '/admin/kitchen/signatures?status=new');
  await call('adminSignatureApprove', 'post', '/admin/kitchen/signatures/mi_chicken_biryani/approve', {});
  await call('adminSignatureRemove', 'post', '/admin/kitchen/signatures/mi_seekh/remove', { note: 'The same seekh is sold next door; a signature dish should be your own.' });
  await call('adminDemand', 'get', '/admin/kitchen/demand?city=Lahore');
  await call('adminLookup', 'get', '/admin/kitchen/lookup?code=TF-HMZ4K2');
  await call('adminLookupCatering', 'get', '/admin/kitchen/lookup?code=ct-mhd7q4');
  // In Ramadan: the kitchen turns it on, and it shows in "Iftar near you".
  jest.setSystemTime(new Date('2027-02-12T08:00:00Z').getTime());
  await as('restaurant@metromatrix.app');
  await call('ramadanOn', 'put', '/food/vendor/ramadan', { enabled: true, iftar: { from: '17:45', to: '19:15' } });
  await as('customer@metromatrix.app', 'customer');
  await call('iftarOpen', 'get', '/food/ramadan/iftar?lat=31.5102&lng=74.3441');
  if (process.env.DUMP_CONTRACT) fs.writeFileSync(process.env.DUMP_CONTRACT, JSON.stringify(out, null, 2));
};


/** The documented examples: name → the JSON under its marker. */
const documented = (): Record<string, unknown> => {
  const found: Record<string, unknown> = {};
  for (const file of DOCS) {
    const text = fs.readFileSync(file, 'utf8');
    for (const m of text.matchAll(/<!-- contract: (\w+) -->\s*```json\n([\s\S]*?)\n```/g)) found[m[1]] = JSON.parse(m[2]);
  }
  return found;
};

const isObj = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);

/** Where the two disagree: "name:path +key" (only the dummy API has it), "-key" (only the doc). */
const diff = (name: string, doc: unknown, mock: unknown, at = ''): string[] => {
  if (Array.isArray(doc) && Array.isArray(mock)) return doc.length && mock.length ? diff(name, doc[0], mock[0], `${at}.0`) : [];
  if (!isObj(doc) || !isObj(mock)) return [];
  const out_: string[] = [];
  for (const k of Object.keys(doc)) if (!(k in mock)) out_.push(`${name}:${at || '.'} -${k}`);
  for (const k of Object.keys(mock)) if (!(k in doc)) out_.push(`${name}:${at || '.'} +${k}`);
  for (const k of Object.keys(doc)) if (k in mock) out_.push(...diff(name, doc[k], mock[k], `${at}.${k}`));
  return out_;
};

beforeAll(() => jest.useFakeTimers({ doNotFake: ['setTimeout', 'setInterval', 'setImmediate', 'nextTick', 'queueMicrotask'] }));
afterAll(() => jest.useRealTimers());

it('documents every request the dummy kitchen API answers, with the same keys', async () => {
  await run();
  const docs = documented();
  const answer = (name: string) => (out[name]?.error !== undefined ? { error: out[name].error } : out[name]?.data);
  const mismatched = Object.keys(docs).flatMap(name => (name in out ? diff(name, docs[name], answer(name)) : [`${name}: never requested`]));
  // Requests run only to set up the next step (Food's own pause and resume carry the additions of §3.7).
  const SETUP = ['readyWithPhoto', 'pause', 'resume', 'boxPaymentConfirm', 'collect', 'boxes', 'proof', 'reservations', 'ingredientCreate', 'forecastAdjust'];
  // Same shapes as a documented example (a plan, a subscription, a request, or a list of them).
  SETUP.push('tiffinPlans', 'tiffinPlanCreate', 'tiffinPlansPublic', 'tiffinSubscribe', 'tiffinSubscribers', 'tiffinProof', 'tiffinSubscriptions', 'tiffinPeriodConfirm');
  SETUP.push('cateringQuote', 'cateringQuote2', 'cateringProof', 'cateringRequests', 'cateringConfirm');
  SETUP.push('experiments', 'storyPut', 'hygieneItem', 'hygieneQueue', 'hygieneVerify', 'experimentKeep', 'tiffinNearby', 'story', 'iftar');
  SETUP.push('saveUrdu', 'reviewsByTheme', 'pantryReminders');
  // Staff: the same shapes as a documented answer (an import, a food, an event, a signature, a lookup).
  SETUP.push('adminAiSwitch', 'adminPriceImport', 'adminFoodEdit', 'adminAliasDelete', 'adminEventEdit', 'adminEventDelete', 'adminSignatureApprove', 'adminLookupCatering');
  const undocumented = Object.keys(out).filter(name => !(name in docs) && !SETUP.includes(name));
  expect({ mismatched, undocumented }).toEqual({ mismatched: [], undocumented: [] });
});
