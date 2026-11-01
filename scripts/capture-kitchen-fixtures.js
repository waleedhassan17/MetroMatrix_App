// Captures real Kitchen Intelligence responses (MetroMatrix-API docs/API_KITCHEN.md, AI.md,
// VOICE.md) from a local backend seeded with `npm run seed:food` and `npm run seed:kitchen`,
// as the app's fixture:
//   BACKEND=~/MetroMatix-NestJS API=http://localhost:3000/api/v1 MAIL_LOG=<the API's console log> \
//     node scripts/capture-kitchen-fixtures.js serializers/__tests__/fixtures/kitchen/real.json
// The API must run with MAIL_HOST= (console mail: the new customer's verification link is read
// from MAIL_LOG) and AI_ENABLED=false (every assistant answer is its manual path, and no model
// is called on anyone's key).
//
// The run changes that (local) database, on rows it owns: a kitchen.capture.* customer and its
// address, orders, reservations, subscriptions, catering request and pantry; and at the demo
// kitchens a "Capture" ingredient, dish, supplier, purchase, waste entry, donation and Bachat
// Box. It leaves the demo kitchens as it found them: forecast numbers it changes go back, and
// the dish it orders is cancelled (its stock comes back). Delete the kitchen.capture.* customers
// and the "Capture" rows to clear the rest. Staff routes (/admin/kitchen, /admin/food,
// /admin/nutrition, /admin/ai) come from scripts/capture-kitchen-staff-fixtures.js.
//
// Credentials come from the backend's git-ignored .env (SEED_DEMO_PASSWORD) and are never
// printed. The output is scrubbed (tokens, passwords, emails, phones, account numbers) and
// lists are cut to 3 rows.
const fs = require('fs');
const path = require('path');

const BACKEND = process.env.BACKEND;
const BASE = process.env.API || 'http://localhost:3000/api/v1';
const MAIL_LOG = process.env.MAIL_LOG;
const OUT = process.argv[2];
if (!BACKEND || !OUT || !MAIL_LOG) {
  console.error('Usage: BACKEND=<backend repo> MAIL_LOG=<api console log> [API=<base url>] node scripts/capture-kitchen-fixtures.js <out.json>');
  process.exit(2);
}
const env = Object.fromEntries(
  fs
    .readFileSync(path.join(BACKEND, '.env'), 'utf8')
    .split('\n')
    .filter(l => l.includes('=') && !l.startsWith('#'))
    .map(l => [l.slice(0, l.indexOf('=')), l.slice(l.indexOf('=') + 1).trim().replace(/^["']|["']$/g, '')]),
);
const DEMO = env.SEED_DEMO_PASSWORD;
const out = {};
/** Changes to the demo kitchens themselves, undone at the end of the run (even when it fails). */
const undo = [];
const putBack = async () => {
  for (const f of undo.splice(0).reverse()) await f().catch(e => console.error('putting back failed:', e.message));
};
let keyN = 0;
let assetN = 0;
const sleep = ms => new Promise(r => setTimeout(r, ms));
const key = () => `kcapture-${Date.now()}-${keyN++}`;
const TZ = 'Asia/Karachi';
const pk = (d = new Date()) => new Intl.DateTimeFormat('en-CA', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit' }).format(d);
const addDays = (date, n) => new Date(Date.parse(`${date}T00:00:00Z`) + n * 86400000).toISOString().slice(0, 10);

async function call(method, p, { token, body, idem } = {}) {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers.Authorization = `Bearer ${token}`;
  if (idem) headers['Idempotency-Key'] = idem;
  for (let i = 0; i < 6; i++) {
    const res = await fetch(BASE + p, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
    if (res.status === 429) {
      await sleep(15000);
      continue;
    }
    return { status: res.status, body: await res.json().catch(() => null) };
  }
  throw new Error(`${method} ${p}: rate limited`);
}
/** Keep a response; an unexpected failure is reported (names ending in Err are meant to fail). */
const save = (name, r) => {
  out[name] = r;
  if (r.status >= 400 && !/Err$/.test(name)) console.log('unexpected', name, r.status, JSON.stringify(r.body).slice(0, 300));
  return r.body && r.body.data;
};
const get = async (name, p, token) => save(name, await call('GET', p, { token }));
const post = async (name, p, token, body, idem) => save(name, await call('POST', p, { token, body, idem }));
const put = async (name, p, token, body) => save(name, await call('PUT', p, { token, body }));
const patch = async (name, p, token, body) => save(name, await call('PATCH', p, { token, body }));
const del = async (name, p, token) => save(name, await call('DELETE', p, { token }));
/** A request whose answer only has to succeed (not kept). */
const must = async (method, p, token, body, idem) => {
  const r = await call(method, p, { token, body, idem });
  if (r.status >= 400) throw new Error(`${method} ${p}: ${r.status} ${JSON.stringify(r.body).slice(0, 300)}`);
  return r.body && r.body.data;
};

const signin = async body => {
  const r = await call('POST', '/auth/signin', { body });
  if (r.status !== 200) throw new Error(`signin ${body.portal}: ${r.status} ${JSON.stringify(r.body).slice(0, 200)}`);
  return r.body.data.tokens.accessToken;
};
const linkToken = async to => {
  for (let i = 0; i < 40; i++) {
    const blocks = fs.readFileSync(MAIL_LOG, 'utf8').split('[DEV EMAIL]').filter(b => b.includes(`To: ${to}`));
    const m = blocks.length && /verify-email\?token=([A-Za-z0-9_-]+)/.exec(blocks[blocks.length - 1]);
    if (m) return m[1];
    await sleep(250);
  }
  throw new Error(`no verification mail for ${to}`);
};
/** A new customer in Model Town, Lahore (Zafran's area), with a pinned address. */
async function customer() {
  const email = `kitchen.capture.${Date.now()}@example.com`;
  const password = 'Metro2026Kitchen';
  const r = await call('POST', '/auth/signup', { body: { email, password, displayName: 'Hina Raza', role: 'customer' } });
  if (r.status !== 201 && r.status !== 200) throw new Error(`signup: ${r.status} ${JSON.stringify(r.body).slice(0, 200)}`);
  await call('POST', '/auth/verify-email', { body: { token: await linkToken(email) } });
  const token = await signin({ email, password, portal: 'customer' });
  await must('PATCH', '/users/me/profile', token, { dateOfBirth: '1996-05-02', gender: 'female', streetAddress: '21 Model Town', city: 'Lahore', postalCode: '54700' });
  const address = await must('POST', '/addresses', token, { label: 'home', fullName: 'Hina Raza', phone: '+923001112233', city: 'Lahore', area: 'Model Town', line1: 'House 21, Block C', lat: 31.4841, lng: 74.3262 });
  return { token, addressId: address.id };
}
/** A URL of the caller's own upload folder, as the API accepts it (the file itself isn't needed). */
async function ownUpload(token, purpose) {
  const s = await must('POST', '/media/sign-upload', token, { purpose });
  const id = `${s.folder}/capture${++assetN}`;
  const delivery = s.type === 'authenticated' ? 'authenticated/s--Xy12_ab-9--' : 'upload';
  return { url: `https://res.cloudinary.com/${s.cloudName}/image/${delivery}/v1712345678/${id}.jpg`, publicId: id };
}
/** A pickup window inside today in Pakistan, from now. */
const pickupWindow = (minutes = 90) => {
  const now = Date.now();
  const midnight = Date.parse(`${addDays(pk(), 1)}T00:00:00+05:00`) - 60000;
  return { pickupFrom: new Date(now + 60000).toISOString(), pickupTo: new Date(Math.min(now + minutes * 60000, midnight)).toISOString() };
};

/** Placeholders for what must not leave the machine. */
const scrub = v => {
  if (Array.isArray(v)) return v.map(scrub);
  if (!v || typeof v !== 'object') return v;
  const o = {};
  for (const [k, x] of Object.entries(v)) {
    if (/^(accessToken|refreshToken|password|apiKey|signature)$/.test(k)) o[k] = '<redacted>';
    else if (k === 'email' && typeof x === 'string') o[k] = 'someone@example.com';
    else if (k === 'accountNumber' && typeof x === 'string') o[k] = x.startsWith('PK') ? 'PK00TEST0000000000000000' : '+920000000000';
    else if (/^(phone|riderPhone|customerPhone)$/.test(k) && typeof x === 'string') o[k] = '+923000000000';
    else o[k] = scrub(x);
  }
  return o;
};
/** Lists keep three rows: enough for every shape, small enough to read. */
const trim = v => {
  if (Array.isArray(v)) return v.slice(0, 3).map(trim);
  if (!v || typeof v !== 'object') return v;
  return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, trim(x)]));
};

(async () => {
  const zafran = await signin({ email: 'demo.food.zafran@metromatrix.test', password: DEMO, portal: 'partner' });
  const rukhsana = await signin({ email: 'demo.food.rukhsana@metromatrix.test', password: DEMO, portal: 'partner' });
  const me = await customer();
  const K = '/food/vendor/kitchen';
  const today = pk();

  // ── The Kitchen tab, settings, the board ──
  await get('setup', `${K}/setup`, zafran);
  await get('summary', `${K}/summary`, zafran);
  await get('board', `${K}/board`, zafran);
  const settings = await get('settings', `${K}/settings`, zafran);
  await patch('settingsUpdate', `${K}/settings`, zafran, { targetFoodCostPct: settings.targetFoodCostPct, requirePackingPhoto: settings.requirePackingPhoto });
  await patch('settingsErr', `${K}/settings`, zafran, { targetFoodCostPct: 200 });

  // ── Ingredients and stock (the run's own ingredient) ──
  const ingredients = await get('ingredients', `${K}/ingredients?page=1&pageSize=3`, zafran);
  await get('ingredient', `${K}/ingredients/${ingredients.items[0].id}`, zafran);
  const mine = await post('ingredientCreate', `${K}/ingredients`, zafran, {
    name: `Capture flour ${Date.now().toString(36)}`,
    nameUr: 'آٹا',
    category: 'grain',
    baseUnit: 'g',
    customUnits: [{ name: 'bori', factor: 10000 }],
    parLevel: { qty: 2, unit: 'kg' },
    openingStock: { qty: 3, unit: 'kg', totalCost: 450, expiresOn: addDays(today, 1) },
  });
  await post('ingredientDupErr', `${K}/ingredients`, zafran, { name: mine.name, category: 'grain', baseUnit: 'g' });
  await post('ingredientUnitErr', `${K}/ingredients`, zafran, { name: 'Capture oil', category: 'oil', baseUnit: 'ml', openingStock: { qty: 2, unit: 'kg' } });
  await patch('ingredientUpdate', `${K}/ingredients/${mine.id}`, zafran, { parLevel: { qty: 1, unit: 'kg' } });
  await get('stock', `${K}/stock?page=1&pageSize=3`, zafran);
  await get('stockExpiring', `${K}/stock?filter=expiring&pageSize=3`, zafran);
  await get('stockBelowPar', `${K}/stock?filter=below_par&pageSize=3`, zafran);
  await get('stockNegative', `${K}/stock?filter=negative&pageSize=3`, zafran);
  await get('stockSearch', `${K}/stock?q=${encodeURIComponent('ٹماٹر')}&pageSize=3`, zafran);
  await post('stockCount', `${K}/stock/count`, zafran, { lines: [{ ingredientId: mine.id, qty: 2.5, unit: 'kg' }], note: 'Capture count' });
  await post('stockCountErr', `${K}/stock/count`, zafran, { lines: [{ ingredientId: mine.id, qty: 2, unit: 'piece' }] });
  await get('movements', `${K}/stock/${mine.id}/movements?page=1&pageSize=3`, zafran);
  await get('batches', `${K}/stock/${mine.id}/batches`, zafran);

  // ── Recipe cards (a demo dish's, then the run's own dish) ──
  const costing = await get('costing', `${K}/costing`, zafran);
  const carded = costing.items.find(r => r.hasRecipe);
  await get('recipe', `${K}/items/${carded.itemId}/recipe`, zafran);
  if (carded.variantId) await get('recipeSized', `${K}/items/${carded.itemId}/recipe?variantId=${carded.variantId}`, zafran);
  await get('servings', `${K}/items/${carded.itemId}/servings`, zafran);
  const categories = await must('GET', '/food/vendor/menu/categories', zafran);
  const dish = await must('POST', '/food/vendor/menu/items', zafran, { categoryId: categories[0].id, name: `Capture roti ${Date.now().toString(36)}`, basePrice: 60 });
  undo.push(() => must('DELETE', `/food/vendor/menu/items/${dish.id}`, zafran));
  await get('recipeNone', `${K}/items/${dish.id}/recipe`, zafran);
  await put('recipeSave', `${K}/items/${dish.id}/recipe`, zafran, { yieldServings: 10, notes: 'Knead, rest 20 minutes.', lines: [{ ingredientId: mine.id, qty: 1, unit: 'kg' }] });
  await put('recipeSaveErr', `${K}/items/${dish.id}/recipe`, zafran, { lines: [{ ingredientId: mine.id, qty: 1, unit: 'l' }] });
  await get('servingsMine', `${K}/items/${dish.id}/servings`, zafran);
  await put('signatureOn', `${K}/items/${dish.id}/signature`, zafran, { isSignature: true, by: 'Capture cook' });
  await put('signatureOff', `${K}/items/${dish.id}/signature`, zafran, { isSignature: false });
  // An experiment on the run's dish, called off.
  const trial = await post('experimentStart', `${K}/experiments`, zafran, { itemId: dish.id, days: 14, notes: 'Capture: price 60 → 50' });
  await post('experimentDupErr', `${K}/experiments`, zafran, { itemId: dish.id, days: 14 });
  if (trial) await del('experimentCancel', `${K}/experiments/${trial.id}`, zafran);
  await del('recipeDelete', `${K}/items/${dish.id}/recipe`, zafran);

  // ── Suppliers, purchases, price watch ──
  await get('suppliers', `${K}/suppliers`, zafran);
  const supplier = await post('supplierCreate', `${K}/suppliers`, zafran, { name: `Capture Mandi ${Date.now().toString(36)}`, phone: '03001234567', notes: 'Opens at 6' });
  await patch('supplierUpdate', `${K}/suppliers/${supplier.id}`, zafran, { notes: 'Opens at 5' });
  const purchases = await get('purchases', `${K}/purchases?page=1&pageSize=3`, zafran);
  if (purchases.items.length) await get('purchase', `${K}/purchases/${purchases.items[0].id}`, zafran);
  const bought = await post('purchaseCreate', `${K}/purchases`, zafran, {
    supplierId: supplier.id,
    source: 'manual',
    note: 'Capture run',
    lines: [{ ingredientId: mine.id, qty: 5, unit: 'kg', totalPrice: 800, expiresOn: addDays(today, 30) }],
  });
  await post('purchaseErr', `${K}/purchases`, zafran, { lines: [{ ingredientId: mine.id, qty: 5, unit: 'l', totalPrice: 800 }] });
  await patch('purchaseUpdate', `${K}/purchases/${bought.id}`, zafran, { note: 'Capture run (checked)' });
  await get('purchaseMine', `${K}/purchases/${bought.id}`, zafran);
  await del('purchaseDelete', `${K}/purchases/${bought.id}`, zafran);
  await del('supplierDelete', `${K}/suppliers/${supplier.id}`, zafran);
  await get('priceWatch', `${K}/price-watch`, zafran);
  await get('referenceItems', `${K}/price-watch/reference-items?q=tom`, zafran);

  // ── Forecast, prep, shopping list, portions, ETA ──
  const forecast = await get('forecast', `${K}/forecast?days=7`, zafran);
  const row = forecast.items[0];
  if (row) {
    undo.push(() => must('PATCH', `${K}/forecast/${row.id}`, zafran, { adjusted: row.adjusted }));
    await patch('forecastAdjust', `${K}/forecast/${row.id}`, zafran, { adjusted: Math.round(row.expected) + 3 });
  }
  await get('prepSheet', `${K}/prep-sheet`, zafran);
  await get('shoppingList', `${K}/shopping-list`, zafran);
  await get('portions', `${K}/portions/suggestions`, rukhsana);
  await get('portionsErr', `${K}/portions/suggestions`, zafran);
  await get('etaAccuracy', `${K}/eta-accuracy`, zafran);

  // ── Waste and donations ──
  await post('wasteLog', `${K}/waste`, zafran, { ingredientId: mine.id, qty: 250, unit: 'g', reason: 'spoiled', note: 'Capture run' });
  await post('wasteErr', `${K}/waste`, zafran, { ingredientId: mine.id, qty: 1, unit: 'piece', reason: 'spoiled' });
  await get('waste', `${K}/waste?page=1&pageSize=3`, zafran);
  await get('wasteSummary', `${K}/waste/summary?range=7d`, zafran);
  await get('wasteSummary30', `${K}/waste/summary?range=30d`, zafran);
  await get('donations', `${K}/donations`, zafran);
  await post('donationLog', `${K}/donations`, zafran, { organisation: 'Capture Welfare Trust', meals: 12, notes: 'Capture run' });

  // ── Insight cards ──
  const cards = await get('cards', `${K}/insights/cards`, zafran);
  const card = cards.find(c => c.key === `expiring_stock:${mine.id}`) || cards[0];
  if (card) await post('cardSnooze', `${K}/insights/cards/${encodeURIComponent(card.key)}/snooze`, zafran);
  await post('cardSnoozeErr', `${K}/insights/cards/${encodeURIComponent('not a key')}/snooze`, zafran);
  await del('ingredientDelete', `${K}/ingredients/${mine.id}`, zafran);

  // ── Bachat Box: the kitchen's box, a customer's reservations, both payments ──
  await get('boxes', `${K}/surplus-boxes`, zafran);
  await get('boxSuggestion', `${K}/surplus-boxes/suggestion`, zafran);
  const box = await post('boxCreate', `${K}/surplus-boxes`, zafran, {
    title: 'Capture Bachat Box',
    description: 'What the evening leaves',
    contentsHint: 'Usually biryani and raita',
    originalValue: 1200,
    price: 450,
    quantity: 4,
    ...pickupWindow(),
    tags: ['veg'],
  });
  undo.push(() => must('POST', `${K}/surplus-boxes/${box.id}/cancel`, zafran).catch(() => null));
  await post('boxCreateErr', `${K}/surplus-boxes`, zafran, { title: 'Capture', originalValue: 500, price: 600, quantity: 1, ...pickupWindow() });
  await patch('boxUpdate', `${K}/surplus-boxes/${box.id}`, zafran, { quantity: 5 });
  await get('nearby', '/food/surplus?lat=31.4841&lng=74.3262');
  await get('boxPage', `/food/surplus/${box.id}?lat=31.4841&lng=74.3262`);
  await get('boxPageErr', '/food/surplus/00000000-0000-0000-0000-000000000000');
  const cash = await post('reserve', `/food/surplus/${box.id}/reserve`, me.token, { quantity: 1, paymentMethod: 'pay_at_pickup' }, key());
  const transfer = await post('reserveTransfer', `/food/surplus/${box.id}/reserve`, me.token, { quantity: 1, paymentMethod: 'transfer' }, key());
  const later = await post('reserveCancelled', `/food/surplus/${box.id}/reserve`, me.token, { quantity: 1 }, key());
  await post('reserveErr', `/food/surplus/${box.id}/reserve`, me.token, { quantity: 1 });
  const proof = await ownUpload(me.token, 'payment_proof');
  await post('reservationProof', `/food/surplus/reservations/${transfer.id}/payment-proof`, me.token, { proofUrl: proof.url, publicId: proof.publicId, ref: 'IBFT 5521' });
  await post('reservationProofErr', `/food/surplus/reservations/${transfer.id}/payment-proof`, me.token, { proofUrl: proof.url });
  await get('reservations', `${K}/surplus-reservations?boxId=${box.id}`, zafran);
  await post('paymentReject', `${K}/surplus-reservations/${transfer.id}/payment/reject`, zafran, { reason: 'The amount is short.' });
  const proof2 = await ownUpload(me.token, 'payment_proof');
  await must('POST', `/food/surplus/reservations/${transfer.id}/payment-proof`, me.token, { proofUrl: proof2.url, publicId: proof2.publicId });
  await post('paymentConfirm', `${K}/surplus-reservations/${transfer.id}/payment/confirm`, zafran);
  await post('collected', `${K}/surplus-reservations/${cash.id}/collected`, zafran, { code: cash.code });
  await post('collectedErr', `${K}/surplus-reservations/${cash.id}/collected`, zafran, { code: cash.code });
  await post('noShowErr', `${K}/surplus-reservations/${transfer.id}/no-show`, zafran);
  await post('reservationCancel', `/food/surplus/reservations/${later.id}/cancel`, me.token);
  await get('myReservations', '/food/surplus/reservations', me.token);
  await post('boxCancel', `${K}/surplus-boxes/${box.id}/cancel`, zafran);
  await get('myReservationsAfter', '/food/surplus/reservations', me.token);

  // ── An order at Zafran: the packing photo and the announcement, then cancelled (stock back) ──
  const page = (await call('GET', '/food/vendors/zafran-biryani-kitchen?lat=31.4841&lng=74.3262', { token: me.token })).body.data;
  const plate = page.menu.flatMap(c => c.items).find(i => i.available && !i.hasVariants);
  await must('DELETE', '/food/cart', me.token).catch(() => null);
  const added = await call('POST', '/food/cart/items', { token: me.token, body: { vendorId: page.id, itemId: plate.id, variantId: null, optionIds: [], quantity: 1 } });
  const placed = added.status < 400 ? await call('POST', '/food/checkout', { token: me.token, idem: key(), body: { addressId: me.addressId, paymentMethod: 'cod' } }) : added;
  if (placed.status >= 400) {
    // A closed kitchen can't take the order (the capture ran outside its hours).
    save('checkoutClosedErr', placed);
  } else {
    const order = placed.body.data;
    undo.push(() => must('POST', `/food/vendor/orders/${order.id}/cancel`, zafran, { reason: 'Capture run' }).catch(() => null));
    await must('POST', `/food/vendor/orders/${order.id}/accept`, zafran, { etaMinutes: 30 });
    await get('announce', `/ai/announce?orderId=${order.id}&lang=ur`, zafran);
    await get('announceRoman', `/ai/announce?orderId=${order.id}&lang=roman`, zafran);
    await get('announceEn', `/ai/announce?orderId=${order.id}&lang=en`, zafran);
    const photo = await ownUpload(zafran, 'packing_proof');
    await post('packingProof', `${K}/orders/${order.id}/packing-proof`, zafran, { photoUrl: photo.url, publicId: photo.publicId });
  }
  await get('announceErr', '/ai/announce?orderId=00000000-0000-0000-0000-000000000000&lang=ur', zafran);
  if (placed.status < 400) await get('batchSuggest', `/food/vendor/riders/suggest?orderId=${placed.body.data.id}`, zafran);

  // ── Growth: tiffin at Khala Rukhsana's (picked up: the run's customer lives in Lahore) ──
  const G = '/food/vendor/tiffin';
  await get('tiffinPlans', `${G}/plans`, rukhsana);
  const rMenu = (await call('GET', '/food/vendors/khala-rukhsanas-kitchen', { token: me.token })).body.data;
  const rDishes = rMenu.menu.flatMap(c => c.items).slice(0, 2).map(i => i.id);
  const planBody = {
    name: 'Capture lunch',
    description: 'A home-cooked lunch',
    meal: 'lunch',
    days: [0, 1, 2, 3, 4, 5, 6],
    period: 'weekly',
    pricePerPeriod: 2100,
    deliveryMode: 'both',
    deliveryWindowFrom: '12:30',
    deliveryWindowTo: '13:30',
    capacity: 3,
    skipCutoffHour: 20,
    rotation: [0, 1, 2, 3, 4, 5, 6].map(weekday => ({ weekday, menuItemIds: [rDishes[weekday % rDishes.length]] })),
  };
  const plan = await post('tiffinPlanCreate', `${G}/plans`, rukhsana, planBody);
  undo.push(() => must('PUT', `${G}/plans/${plan.id}`, rukhsana, { ...planBody, isActive: false }));
  await post('tiffinPlanErr', `${G}/plans`, rukhsana, { ...planBody, rotation: [] });
  await put('tiffinPlanUpdate', `${G}/plans/${plan.id}`, rukhsana, { ...planBody, name: 'Capture lunch (weekdays too)' });
  await get('tiffinPlan', `${G}/plans/${plan.id}`, rukhsana);
  await get('tiffinVendorPlans', '/food/vendors/khala-rukhsanas-kitchen/tiffin-plans');
  await get('tiffinPlanPage', `/food/tiffin/plans/${plan.id}`);
  await get('tiffinPlanPageErr', '/food/tiffin/plans/00000000-0000-0000-0000-000000000000');
  const sub = await post('tiffinSubscribe', '/food/tiffin/subscribe', me.token, { planId: plan.id, startsOn: addDays(today, 1), paymentMethod: 'cash_weekly', fulfilment: 'pickup' }, key());
  await post('tiffinSubscribeErr', '/food/tiffin/subscribe', me.token, { planId: plan.id, startsOn: addDays(today, 1), paymentMethod: 'cash_weekly', fulfilment: 'pickup' });
  await get('tiffinSubscriptions', `${G}/subscriptions`, rukhsana);
  await get('tiffinSubscriptionsRequested', `${G}/subscriptions?status=requested&planId=${plan.id}`, rukhsana);
  await post('tiffinApprove', `${G}/subscriptions/${sub.id}/approve`, rukhsana);
  await get('tiffinMine', '/food/tiffin/subscriptions', me.token);
  await get('tiffinCalendar', `/food/tiffin/subscriptions/${sub.id}/calendar?month=${addDays(today, 3).slice(0, 7)}`, me.token);
  await get('tiffinCalendarErr', `/food/tiffin/subscriptions/${sub.id}/calendar?month=2026-13`, me.token);
  await post('tiffinSkip', `/food/tiffin/subscriptions/${sub.id}/skip`, me.token, { date: addDays(today, 3) });
  await post('tiffinUnskip', `/food/tiffin/subscriptions/${sub.id}/unskip`, me.token, { date: addDays(today, 3) });
  await post('tiffinSkipErr', `/food/tiffin/subscriptions/${sub.id}/skip`, me.token, { date: today });
  await post('tiffinPause', `/food/tiffin/subscriptions/${sub.id}/pause`, me.token, { until: addDays(today, 4) });
  await post('tiffinResume', `/food/tiffin/subscriptions/${sub.id}/resume`, me.token);
  await post('tiffinResumeErr', `/food/tiffin/subscriptions/${sub.id}/resume`, me.token);
  await post('tiffinVendorPause', `${G}/subscriptions/${sub.id}/pause`, rukhsana, { until: addDays(today, 3) });
  await post('tiffinVendorResume', `${G}/subscriptions/${sub.id}/resume`, rukhsana);
  await get('tiffinTomorrow', `${G}/tomorrow`, rukhsana);
  // One live subscription per plan and person: this one ends before the next.
  await post('tiffinCancel', `/food/tiffin/subscriptions/${sub.id}/cancel`, me.token);
  const paying = await post('tiffinSubscribeTransfer', '/food/tiffin/subscribe', me.token, { planId: plan.id, startsOn: addDays(today, 1), paymentMethod: 'transfer_per_period', fulfilment: 'pickup' }, key());
  if (paying) {
    await must('POST', `${G}/subscriptions/${paying.id}/approve`, rukhsana);
    const p1 = await ownUpload(me.token, 'payment_proof');
    await post('tiffinProof', `/food/tiffin/subscriptions/${paying.id}/payment-proof`, me.token, { proofUrl: p1.url, publicId: p1.publicId, ref: 'IBFT 7781' });
    await post('tiffinPaymentReject', `${G}/subscriptions/${paying.id}/payment/reject`, rukhsana, { reason: 'Not in the account yet.' });
    const p2 = await ownUpload(me.token, 'payment_proof');
    await must('POST', `/food/tiffin/subscriptions/${paying.id}/payment-proof`, me.token, { proofUrl: p2.url, publicId: p2.publicId });
    await post('tiffinPaymentConfirm', `${G}/subscriptions/${paying.id}/payment/confirm`, rukhsana);
    await post('tiffinEnd', `${G}/subscriptions/${paying.id}/end`, rukhsana, { reason: 'Capture run over' });
  }
  const third = await call('POST', '/food/tiffin/subscribe', { token: me.token, idem: key(), body: { planId: plan.id, startsOn: addDays(today, 2), paymentMethod: 'cash_weekly', fulfilment: 'pickup' } });
  if (third.status < 400) await post('tiffinDecline', `${G}/subscriptions/${third.body.data.id}/decline`, rukhsana, { reason: 'Full on those days' });

  // ── Growth: catering at Qandeel ──
  const qandeel = await signin({ email: 'demo.food.qandeel@metromatrix.test', password: DEMO, portal: 'partner' });
  const cSettings = await get('cateringSettings', '/food/vendor/catering/settings', qandeel);
  await patch('cateringSettingsUpdate', '/food/vendor/catering/settings', qandeel, { open: cSettings.open, minGuests: cSettings.minGuests, leadDays: cSettings.leadDays });
  await patch('cateringSettingsErr', '/food/vendor/catering/settings', qandeel, { leadDays: 0 });
  const cPage = await get('cateringVendor', '/food/catering/vendors/qandeel-karahi-house', me.token);
  await get('cateringVendorErr', '/food/catering/vendors/no-such-kitchen', me.token);
  const ask = (extra = {}) => ({
    vendorId: cPage.vendorId,
    eventDate: addDays(today, 7),
    eventTime: '19:30',
    guests: 40,
    eventType: 'dawat',
    requestedItems: [{ menuItemId: cPage.menu[0].itemId, name: cPage.menu[0].name, qty: 10 }, { name: 'Kheer for dessert' }],
    budget: 50000,
    fulfilment: 'pickup',
    notes: 'Capture run',
    ...extra,
  });
  const cr = await post('cateringRequest', '/food/catering', me.token, ask());
  await post('cateringRequestErr', '/food/catering', me.token, ask({ eventDate: today }));
  await get('cateringRequests', '/food/vendor/catering', qandeel);
  await get('cateringRequestVendor', `/food/vendor/catering/${cr.id}`, qandeel);
  const quoteBody = { lines: [{ menuItemId: cPage.menu[0].itemId, name: cPage.menu[0].name, qty: 10, unitPrice: 1400 }, { name: 'Kheer', qty: 40, unitPrice: 120 }], deliveryFee: 0, advancePct: 30, notes: 'Includes serving dishes' };
  await post('cateringQuote', `/food/vendor/catering/${cr.id}/quote`, qandeel, quoteBody);
  await post('cateringQuote2', `/food/vendor/catering/${cr.id}/quote`, qandeel, { ...quoteBody, deliveryFee: 500 });
  await get('cateringMine', '/food/catering', me.token);
  await get('cateringMineOne', `/food/catering/${cr.id}`, me.token);
  await post('cateringAcceptOldErr', `/food/catering/${cr.id}/accept`, me.token, { version: 1 });
  await post('cateringAccept', `/food/catering/${cr.id}/accept`, me.token, { version: 2 });
  const a1 = await ownUpload(me.token, 'payment_proof');
  await post('cateringAdvanceProof', `/food/catering/${cr.id}/advance-proof`, me.token, { proofUrl: a1.url, publicId: a1.publicId, ref: 'IBFT 9921' });
  await post('cateringAdvanceReject', `/food/vendor/catering/${cr.id}/advance/reject`, qandeel, { reason: 'The amount is short.' });
  const a2 = await ownUpload(me.token, 'payment_proof');
  await must('POST', `/food/catering/${cr.id}/advance-proof`, me.token, { proofUrl: a2.url, publicId: a2.publicId });
  await post('cateringAdvanceConfirm', `/food/vendor/catering/${cr.id}/advance/confirm`, qandeel);
  const cr2 = await post('cateringRequestToDecline', '/food/catering', me.token, ask({ guests: 80 }));
  if (cr2) await post('cateringDecline', `/food/vendor/catering/${cr2.id}/decline`, qandeel, { reason: 'Booked that evening' });
  const cr3 = await post('cateringRequestToCancel', '/food/catering', me.token, ask({ guests: 50 }));
  if (cr3) await post('cateringCancel', `/food/catering/${cr3.id}/cancel`, me.token, { reason: 'Plans changed' });

  // ── Growth: Ramadan, storefront, story, demand, menu engineering (Zafran) ──
  const ramadan = await get('ramadan', '/food/vendor/ramadan', zafran);
  await put('ramadanUpdate', '/food/vendor/ramadan', zafran, ramadan.settings);
  await put('ramadanErr', '/food/vendor/ramadan', zafran, { ...ramadan.settings, sehriFrom: '02:00', sehriTo: null });
  await get('storefront', '/food/vendor/storefront?days=30', zafran);
  await get('publicStore', '/public/food/store/zafran-biryani-kitchen');
  const story = await get('story', '/food/vendor/story', zafran);
  await put('storyUpdate', '/food/vendor/story', zafran, {
    story: story.story ?? undefined,
    cookName: story.cookName ?? undefined,
    videoUrl: story.videoUrl ?? undefined,
    photos: story.photos ?? [],
    hygieneChecklist: story.hygieneChecklist ?? undefined,
  });
  await get('demandMap', '/food/vendor/demand-map', zafran);
  await get('demandCurve', '/food/vendor/demand-curve?weeks=8', zafran);
  await get('menuEngineering', `${K}/menu-engineering`, zafran);
  const trials = await get('experiments', `${K}/experiments`, zafran);
  if (trials.length) await get('experiment', `${K}/experiments/${trials[0].id}`, zafran);
  await get('foodHome', '/food/home?lat=31.4841&lng=74.3262', me.token);

  // ── The assistant with AI off: voice by the rules, the manual paths ──
  await get('aiUsage', '/ai/usage', zafran);
  await get('aiUsageCustomer', '/ai/usage', me.token);
  await post('voiceBoard', '/ai/voice', zafran, { context: 'board', text: 'order accept karo, bees minute', languageHint: 'ur' });
  await post('voiceStock', '/ai/voice', zafran, { context: 'stock', text: 'tamatar do kilo', languageHint: 'ur' });
  await post('voicePurchase', '/ai/voice', zafran, { context: 'purchase', text: 'do kilo tamatar paanch sau rupay', languageHint: 'ur' });
  await post('voiceToday', '/ai/voice', rukhsana, { context: 'today', text: 'biryani ki bees plate', languageHint: 'ur' });
  await post('voiceMenuSearch', '/ai/voice', zafran, { context: 'menu_search', text: 'karahi', languageHint: 'en' });
  await post('voicePantry', '/ai/voice', me.token, { context: 'pantry', text: 'ek litre doodh, teen din mein expire', languageHint: 'ur' });
  await post('voiceUnclearErr', '/ai/voice', zafran, { context: 'board', text: 'aaj mausam kaisa hai', languageHint: 'ur' });
  await post('voiceWrongSideErr', '/ai/voice', me.token, { context: 'board', text: 'order accept karo' });
  const receipt = await ownUpload(zafran, 'receipt');
  await post('receiptScanErr', `${K}/purchases/scan`, zafran, { imageUrl: receipt.url, publicId: receipt.publicId });
  await post('describeErr', `${K}/ai/describe`, zafran, { itemId: carded.itemId });
  await post('specialsErr', `${K}/ai/specials`, zafran, {});
  await post('combos', `${K}/ai/combos`, zafran);
  const dishPhoto = await ownUpload(zafran, 'menu_item');
  await post('photoCheckErr', `${K}/ai/photo-check`, zafran, { imageUrl: dishPhoto.url, itemId: carded.itemId });
  await get('reviewInsights', `${K}/review-insights`, zafran);

  // ── Nutrition: the kitchen's dishes, the customer's profile ──
  const N = `${K}/nutrition`;
  await get('nutritionFoods', `${N}/foods?q=rice`, zafran);
  await get('nutritionMapping', `${N}/mapping`, zafran);
  const items = await get('nutritionItems', `${N}/items?page=1&pageSize=3`, zafran);
  const shown = items.items.find(i => i.kcal !== null) || items.items[0];
  await get('nutritionItem', `${N}/items/${shown.itemId}`, zafran);
  await post('nutritionEstimateErr', `${N}/items/${shown.itemId}/estimate`, zafran);
  if (shown.kcal !== null) {
    undo.push(() => must('PATCH', `${N}/items/${shown.itemId}`, zafran, { hidden: shown.hidden }));
    await patch('nutritionHide', `${N}/items/${shown.itemId}`, zafran, { hidden: !shown.hidden });
  }
  await get('profileNoneErr', '/food/me/nutrition/profile', me.token);
  await put('profileSave', '/food/me/nutrition/profile', me.token, { goal: 'lose', sex: 'female', age: 29, heightCm: 162, weightKg: 64, activity: 'light' });
  await put('profileManual', '/food/me/nutrition/profile', me.token, { goal: 'maintain', manualTargetKcal: 1900 });
  await put('profileErr', '/food/me/nutrition/profile', me.token, { goal: 'lose', sex: 'female' });
  await get('profile', '/food/me/nutrition/profile', me.token);
  await get('nutritionSummary', '/food/me/nutrition/summary?range=7d', me.token);
  await get('nutritionSummary30', '/food/me/nutrition/summary?range=30d', me.token);
  await get('profileVendorErr', '/food/me/nutrition/profile', zafran);
  await get('lighterKitchens', '/food/vendors?lat=31.4841&lng=74.3262&maxKcal=600', me.token);
  await del('profileDelete', '/food/me/nutrition/profile', me.token);

  // ── My Kitchen: the run's customer's pantry (and the demo customer's, read only) ──
  const M = '/my-kitchen';
  const ayesha = await signin({ email: 'demo.foodie1@metromatrix.test', password: DEMO, portal: 'customer' });
  await get('pantryDemo', `${M}/pantry?status=active&page=1&pageSize=3`, ayesha);
  const spinach = await post('pantryAdd', `${M}/pantry`, me.token, { name: 'palak', qty: 500, unit: 'g', expiresOn: addDays(today, 2) });
  await post('pantryAddErr', `${M}/pantry`, me.token, { name: 'doodh', qty: 1, unit: 'cup' });
  const batch = await post('pantryBatch', `${M}/pantry/batch`, me.token, { items: [{ name: 'doodh', qty: 1, unit: 'l', expiresOn: addDays(today, 3) }, { name: 'anday', qty: 1, unit: 'dozen', expiresOn: addDays(today, 10) }] });
  await get('pantry', `${M}/pantry?status=active&page=1&pageSize=3`, me.token);
  await get('pantryExpiring', `${M}/pantry/expiring`, me.token);
  await patch('pantryUpdate', `${M}/pantry/${spinach.id}`, me.token, { qty: 300, unit: 'g' });
  await post('pantryUsed', `${M}/pantry/${spinach.id}/used`, me.token);
  const batchItems = (batch && (batch.added || batch.items || batch)) || [];
  if (batchItems[0]) await post('pantryDiscard', `${M}/pantry/${batchItems[0].id}/discard`, me.token);
  if (batchItems[1]) await del('pantryDelete', `${M}/pantry/${batchItems[1].id}`, me.token);
  await get('pantryUsedList', `${M}/pantry?status=used&page=1&pageSize=3`, me.token);
  await get('pantryStats', `${M}/stats?days=30`, me.token);
  await get('pantryFromOrders', `${M}/pantry/from-orders`, me.token);
  await post('recipesSuggest', `${M}/recipes/suggest`, ayesha);
  await post('missingToBag', `${M}/missing-to-bag`, me.token, { items: [{ name: 'paneer' }, { name: 'tamatar' }], city: 'Lahore' });

  await putBack();
  const doc = scrub(trim(out));
  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, JSON.stringify(doc, null, 2) + '\n');
  console.log(`${Object.keys(out).length} responses → ${OUT}`);
})().catch(async e => {
  console.error(e);
  await putBack();
  process.exit(1);
});
