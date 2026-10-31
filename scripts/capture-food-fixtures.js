// Captures real Food Court responses (MetroMatrix-API docs/API_FOOD.md) from a
// local backend seeded with `npm run seed:food`, as the app's fixture:
//   BACKEND=~/MetroMatix-NestJS API=http://localhost:3000/api/v1 \
//     node scripts/capture-food-fixtures.js serializers/__tests__/fixtures/food/p8.json
// The names match the earlier per-phase captures (vendor.json, menu.json,
// discovery.json, orders.json), so the parity tests replay this run too.
//
// The run changes that (local) database: it edits Qandeel Karahi House's menu
// and settings and puts them back, places, moves, delivers and cancels orders
// at Smash Theory Burgers, adds deals, a cuisine and a rider, and suspends and
// reinstates a vendor. Re-seed afterwards if you need the demo as it was.
//
// Credentials come from the backend's git-ignored .env (SEED_DEMO_PASSWORD,
// SUPER_ADMIN_EMAIL, SUPER_ADMIN_PASSWORD) and are never printed. The staff
// account's authenticator secret is kept in TOTP_FILE (default: the OS temp
// folder) between runs. The output is scrubbed (tokens, passwords, the staff
// email, account numbers) and lists are cut to 3 rows.
const fs = require('fs');
const os = require('os');
const path = require('path');

const BACKEND = process.env.BACKEND;
const BASE = process.env.API || 'http://localhost:3000/api/v1';
const OUT = process.argv[2];
const TOTP_FILE = process.env.TOTP_FILE || path.join(os.tmpdir(), 'metromatrix-food-capture.totp');
if (!BACKEND || !OUT) {
  console.error('Usage: BACKEND=<backend repo> [API=<base url>] node scripts/capture-food-fixtures.js <out.json>');
  process.exit(2);
}
const { authenticator } = require(path.join(BACKEND, 'node_modules/otplib'));
const env = Object.fromEntries(
  fs
    .readFileSync(path.join(BACKEND, '.env'), 'utf8')
    .split('\n')
    .filter(l => l.includes('=') && !l.startsWith('#'))
    .map(l => [l.slice(0, l.indexOf('=')), l.slice(l.indexOf('=') + 1)]),
);
const DEMO = env.SEED_DEMO_PASSWORD;
const out = {};
let keyN = 0;
const sleep = ms => new Promise(r => setTimeout(r, ms));
const key = () => `capture-${Date.now()}-${keyN++}`;

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
  if (r.status >= 400 && !/Err$|Overlap$/.test(name)) console.log('unexpected', name, r.status, JSON.stringify(r.body).slice(0, 300));
  return r.body && r.body.data;
};
const signin = async body => {
  const r = await call('POST', '/auth/signin', { body });
  if (r.status !== 200) throw new Error(`signin ${body.portal}: ${r.status} ${JSON.stringify(r.body).slice(0, 200)}`);
  return r;
};
const tokenOf = r => r.body.data.tokens.accessToken;

async function staffToken() {
  const s1 = (await signin({ email: env.SUPER_ADMIN_EMAIL, password: env.SUPER_ADMIN_PASSWORD, portal: 'admin' })).body.data;
  // A first sign-in enrols an authenticator (docs/API_AUTH.md §4.4), with the challenge as the bearer.
  if (s1.enrolmentRequired) {
    const enrol = (await call('POST', '/admin/me/totp/enrol', { token: s1.challengeToken })).body.data;
    if (!enrol || !enrol.secret) throw new Error('staff enrolment failed');
    fs.writeFileSync(TOTP_FILE, enrol.secret, { mode: 0o600 });
    const ok = await call('POST', '/admin/me/totp/confirm', { token: s1.challengeToken, body: { code: authenticator.generate(enrol.secret) } });
    const t = ok.body && ok.body.data && ok.body.data.auth && ok.body.data.auth.tokens;
    if (!t) throw new Error(`staff enrolment: ${ok.status}`);
    return t.accessToken;
  }
  if (!fs.existsSync(TOTP_FILE)) throw new Error(`staff is enrolled but ${TOTP_FILE} is missing`);
  const ok = await call('POST', '/auth/admin/totp', { body: { challengeToken: s1.challengeToken, code: authenticator.generate(fs.readFileSync(TOTP_FILE, 'utf8').trim()) } });
  const t = ok.body && ok.body.data && ok.body.data.tokens;
  if (!t) throw new Error(`staff sign-in: ${ok.status}`);
  return t.accessToken;
}

/** Tokens, passwords, the staff email and account numbers out; lists cut to 3 rows. */
function scrub(v, k = '') {
  if (Array.isArray(v)) return v.slice(0, 3).map(x => scrub(x, k));
  if (v && typeof v === 'object') return Object.fromEntries(Object.entries(v).map(([kk, x]) => [kk, scrub(x, kk)]));
  if (typeof v !== 'string') return v;
  if (/token$|^password$|signature/i.test(k)) return 'redacted';
  if (env.SUPER_ADMIN_EMAIL && v === env.SUPER_ADMIN_EMAIL) return 'staff@example.test';
  if (/^PK\d{2}[A-Z]{4}\d{16}$/.test(v)) return `${v.slice(0, 8)}0000000000000000`;
  return v;
}

const GULBERG = 'lat=31.5204&lng=74.3587';
const ISLAMABAD = 'lat=33.6844&lng=73.0479';

(async () => {
  const cuisines = save('cuisines', await call('GET', '/food/cuisines'));

  // ── The restaurant (Qandeel Karahi House): its settings, riders, menu ──
  const restoIn = await signin({ email: 'demo.food.qandeel@metromatrix.test', password: DEMO, portal: 'partner' });
  save('resto.signin', restoIn);
  const resto = tokenOf(restoIn);
  save('resto.me', await call('GET', '/auth/me', { token: resto }));
  save('resto.meAfter', await call('GET', '/auth/me', { token: resto }));
  save('resto.setupAfter', await call('GET', '/food/vendor/setup', { token: resto }));
  const profile = save('resto.profile', await call('GET', '/food/vendor/profile', { token: resto }));
  save('resto.profilePatch', await call('PATCH', '/food/vendor/profile', { token: resto, body: { tagline: profile.tagline } }));
  save('resto.busy', await call('POST', '/food/vendor/busy', { token: resto, body: { extraMinutes: 15 } }));
  await call('POST', '/food/vendor/busy', { token: resto, body: { extraMinutes: 0 } });
  save('resto.pause', await call('POST', '/food/vendor/pause', { token: resto, body: { message: 'Back soon' } }));
  save('resto.resume', await call('POST', '/food/vendor/resume', { token: resto }));
  const settings = save('resto.settings', await call('GET', '/food/vendor/settings', { token: resto }));
  save('resto.settingsPatch', await call('PATCH', '/food/vendor/settings', { token: resto, body: { codLimit: settings.codLimit } }));
  const hours = save('resto.hours', await call('GET', '/food/vendor/hours', { token: resto }));
  save('resto.hoursPut', await call('PUT', '/food/vendor/hours', { token: resto, body: hours.map(h => ({ weekday: h.weekday, opensAt: h.opensAt, closesAt: h.closesAt })) }));
  save('resto.hoursOverlap', await call('PUT', '/food/vendor/hours', { token: resto, body: [{ weekday: 1, opensAt: '12:00', closesAt: '16:00' }, { weekday: 1, opensAt: '15:00', closesAt: '23:00' }] }));
  const bands = save('resto.feeBands', await call('GET', '/food/vendor/fee-bands', { token: resto }));
  save('resto.feeBandsPut', await call('PUT', '/food/vendor/fee-bands', { token: resto, body: bands.map(b => ({ fromKm: b.fromKm, toKm: b.toKm, fee: b.fee, minOrder: b.minOrder })) }));
  const closure = save('resto.closurePost', await call('POST', '/food/vendor/closures', { token: resto, body: { startsAt: '2026-12-24T19:00:00.000Z', endsAt: '2026-12-25T19:00:00.000Z', reason: 'Family wedding' } }));
  if (closure) await call('DELETE', `/food/vendor/closures/${closure.id}`, { token: resto });
  const accounts = (await call('GET', '/food/vendor/payment-accounts', { token: resto })).body;
  out['resto.accountPost'] = { status: 200, body: { success: true, data: (accounts.data || [])[0] } };
  save('resto.plan', await call('GET', '/food/vendor/plan', { token: resto }));
  const riders = save('resto.riders', await call('GET', '/food/vendor/riders', { token: resto }));
  const made = save('resto.riderCreate', await call('POST', '/food/vendor/riders', { token: resto, body: { fullName: 'Kamran Shah', vehicle: 'bike' } }));
  const seeded = riders[0];
  save('resto.riderGet', await call('GET', `/food/vendor/riders/${seeded.id}`, { token: resto }));
  save('resto.riderCredential', await call('GET', `/food/vendor/riders/${seeded.id}/credential`, { token: resto }));
  if (made) {
    save('resto.riderPatch', await call('PATCH', `/food/vendor/riders/${made.rider.id}`, { token: resto, body: { vehicle: 'car' } }));
    save('resto.riderStatus', await call('PATCH', `/food/vendor/riders/${made.rider.id}/status`, { token: resto, body: { status: 'on_leave' } }));
    await call('PATCH', `/food/vendor/riders/${made.rider.id}/status`, { token: resto, body: { status: 'active' } });
    const cred = save('resto.riderReset', await call('POST', `/food/vendor/riders/${made.rider.id}/reset-password`, { token: resto }));
    const riderIn = await signin({ identifier: cred.username, password: cred.password, portal: 'partner' });
    save('rider.signin', riderIn);
    save('rider.me', await call('GET', '/food/rider/me', { token: tokenOf(riderIn) }));
    await call('PATCH', `/food/vendor/riders/${made.rider.id}/status`, { token: resto, body: { status: 'inactive' } });
  }

  // The menu.
  const cats = save('menu.categories', await call('GET', '/food/vendor/menu/categories', { token: resto }));
  const late = save('menu.categoryWindow', await call('POST', '/food/vendor/menu/categories', { token: resto, body: { name: 'Late night', availableFrom: '22:00', availableTo: '02:00' } }));
  const items = save('menu.items', await call('GET', '/food/vendor/menu/items', { token: resto }));
  const withGroups = [];
  for (const it of items.slice(0, 20)) {
    const full = (await call('GET', `/food/vendor/menu/items/${it.id}`, { token: resto })).body.data;
    if (full && full.variants.length && full.optionGroups.length) withGroups.push(full);
  }
  const dish = withGroups[0] || items[0];
  save('menu.item', await call('GET', `/food/vendor/menu/items/${dish.id}`, { token: resto }));
  const groups = save('menu.groups', await call('GET', '/food/vendor/menu/option-groups', { token: resto }));
  const required = groups.find(g => g.minSelect >= 1) || groups[0];
  save('menu.groupRequired', await call('GET', `/food/vendor/menu/option-groups/${required.id}`, { token: resto }));
  save('menu.groupErr', await call('POST', '/food/vendor/menu/option-groups', { token: resto, body: { name: 'Bad', minSelect: 3, maxSelect: 1, options: [{ name: 'A', priceDelta: 0 }] } }));
  save('menu.itemTagErr', await call('POST', '/food/vendor/menu/items', { token: resto, body: { categoryId: cats[0].id, name: 'Bad tags', basePrice: 100, tags: ['nope'] } }));
  save('menu.categoryDeleteErr', await call('DELETE', `/food/vendor/menu/categories/${cats[0].id}`, { token: resto }));
  const order = (await call('GET', '/food/vendor/menu/categories', { token: resto })).body.data.map(c => c.id);
  save('menu.categoriesReorder', await call('PUT', '/food/vendor/menu/categories/reorder', { token: resto, body: { ids: order } }));
  const copy = save('menu.itemDuplicate', await call('POST', `/food/vendor/menu/items/${dish.id}/duplicate`, { token: resto }));
  if (copy) await call('DELETE', `/food/vendor/menu/items/${copy.id}`, { token: resto });
  if (late) await call('DELETE', `/food/vendor/menu/categories/${late.id}`, { token: resto });
  const optionId = (required.options || [])[0] && required.options[0].id;
  const until = new Date(Date.now() + 2 * 3600_000).toISOString();
  save('menu.availabilityPatch', await call('PATCH', '/food/vendor/availability', { token: resto, body: { items: [{ itemId: items[1].id, isAvailable: false, unavailableUntil: until }], options: optionId ? [{ optionId, isAvailable: false }] : [] } }));
  await call('PATCH', '/food/vendor/availability', { token: resto, body: { items: [{ itemId: items[1].id, isAvailable: true }], options: optionId ? [{ optionId, isAvailable: true }] : [] } });

  // Home kitchens: Farzana's day (portions, weekly menu); Khala Rukhsana's slots.
  const homeIn = await signin({ email: 'demo.food.farzana@metromatrix.test', password: DEMO, portal: 'partner' });
  const home = tokenOf(homeIn);
  const today = (await call('GET', '/food/vendor/today', { token: home })).body.data;
  const todayItem = today && today.items && today.items[0];
  if (todayItem) save('home.todayPatch', await call('PATCH', '/food/vendor/today', { token: home, body: { items: [{ itemId: todayItem.itemId, portions: todayItem.portions || 20, cooking: true }] } }));
  if (todayItem) save('home.weeklyPut', await call('PUT', '/food/vendor/weekly-menu', { token: home, body: [{ itemId: todayItem.itemId, days: [0, 1, 2, 3, 4, 5, 6] }] }));
  const slotIn = await signin({ email: 'demo.food.rukhsana@metromatrix.test', password: DEMO, portal: 'partner' });
  const slotKitchen = tokenOf(slotIn);
  const slots = (await call('GET', '/food/vendor/preorder-slots', { token: slotKitchen })).body.data || [];
  save('home.slotsPut', await call('PUT', '/food/vendor/preorder-slots', { token: slotKitchen, body: slots.map(s => ({ weekday: s.weekday, slotStart: s.slotStart, cutoffMinutesBefore: s.cutoffMinutesBefore, maxOrders: s.maxOrders })) }));

  // ── Discovery (signed out, from Gulberg) ──
  save('home', await call('GET', `/food/home?${GULBERG}`));
  save('homeFar', await call('GET', `/food/home?${ISLAMABAD}`));
  save('homeErr', await call('GET', '/food/home'));
  save('vendors', await call('GET', `/food/vendors?${GULBERG}`));
  save('vendorPage', await call('GET', `/food/vendors/qandeel-karahi-house?${GULBERG}`));
  save('vendorPageNoPoint', await call('GET', '/food/vendors/qandeel-karahi-house'));
  save('vendorPageErr', await call('GET', '/food/vendors/no-such-kitchen'));
  save('search', await call('GET', `/food/search?q=karahi&${GULBERG}`));

  // ── Ordering at Smash Theory Burgers (open late; its own riders) ──
  const customer = tokenOf(await signin({ email: 'demo.foodie1@metromatrix.test', password: DEMO, portal: 'customer' }));
  const vendor = tokenOf(await signin({ email: 'demo.food.smash@metromatrix.test', password: DEMO, portal: 'partner' }));
  const riderToken = tokenOf(await signin({ identifier: 'smash-theory-burgers.hamza', password: DEMO, portal: 'partner' }));
  const addresses = (await call('GET', '/addresses', { token: customer })).body.data;
  const addr = (Array.isArray(addresses) ? addresses : addresses.items).find(a => a.lat) || (Array.isArray(addresses) ? addresses : addresses.items)[0];

  save('vendor.promotions', await call('GET', '/food/vendor/promotions', { token: vendor }));
  save('vendor.promotionPost', await call('POST', '/food/vendor/promotions', { token: vendor, body: { title: 'Weekday lunch', kind: 'percent_off_order', value: 10, minOrder: 500, maxDiscount: 300 } }));
  save('vendor.promotionCode', await call('POST', '/food/vendor/promotions', { token: vendor, body: { title: 'Rs 100 off with a code', kind: 'flat_off', value: 100, minOrder: 1000, code: `SMASH${Date.now() % 1000}` } }));
  save('vendor.promotionErr', await call('POST', '/food/vendor/promotions', { token: vendor, body: { title: 'x', kind: 'flat_off', value: 100 } }));

  const page = (await call('GET', `/food/vendors/smash-theory-burgers?${GULBERG}`, { token: customer })).body.data;
  const menuItems = page.menu.flatMap(c => c.items).filter(i => i.available);
  const burger = menuItems.find(i => i.hasVariants) || menuItems[0];
  const sheet = save('item', await call('GET', `/food/items/${burger.id}`));
  const variant = sheet.variants[0];
  const choose = sheet.groups
    .filter(g => g.minSelect >= 1 && (!g.variantId || g.variantId === (variant && variant.id)))
    .flatMap(g => g.options.filter(o => o.available).slice(0, g.minSelect).map(o => o.id));
  const line = { vendorId: page.id, itemId: burger.id, variantId: variant ? variant.id : null, optionIds: choose, quantity: 2, notes: 'No onions please' };

  await call('DELETE', '/food/cart', { token: customer });
  save('cartEmpty', await call('GET', '/food/cart', { token: customer }));
  save('cartAddErr', await call('POST', '/food/cart/items', { token: customer, body: { ...line, variantId: null } }));
  save('cartAddGroupErr', await call('POST', '/food/cart/items', { token: customer, body: { ...line, optionIds: [] } }));
  save('cartAdd', await call('POST', '/food/cart/items', { token: customer, body: line }));
  const other = (await call('GET', `/food/vendors/zafran-biryani-kitchen?${GULBERG}`)).body.data;
  const otherDish = other.menu.flatMap(c => c.items).find(i => i.available && !i.hasOptions);
  if (otherDish) save('cartOtherVendorErr', await call('POST', '/food/cart/items', { token: customer, body: { vendorId: other.id, itemId: otherDish.id, variantId: null, optionIds: [], quantity: 1 } }));
  const cart = save('cart', await call('GET', '/food/cart', { token: customer }));
  save('cartLinePatch', await call('PATCH', `/food/cart/items/${cart.lines[0].id}`, { token: customer, body: { quantity: 3 } }));
  save('cartPatch', await call('PATCH', '/food/cart', { token: customer, body: { fulfilment: 'delivery', scheduledFor: null } }));
  save('preview', await call('POST', '/food/cart/preview', { token: customer, body: { addressId: addr.id, paymentMethod: 'cod' } }));
  save('previewBadCode', await call('POST', '/food/cart/preview', { token: customer, body: { addressId: addr.id, promoCode: 'NOPE' } }));
  save('previewTransfer', await call('POST', '/food/cart/preview', { token: customer, body: { addressId: addr.id, paymentMethod: 'transfer' } }));
  save('previewPickup', await call('POST', '/food/cart/preview', { token: customer, body: { paymentMethod: 'pay_at_pickup' } }));
  save('slots', await call('GET', `/food/vendors/${page.id}/slots`, { token: customer }));

  save('checkoutErr', await call('POST', '/food/checkout', { token: customer, body: { addressId: addr.id, paymentMethod: 'cod' } }));
  const k1 = key();
  const placed = save('checkout', await call('POST', '/food/checkout', { token: customer, idem: k1, body: { addressId: addr.id, paymentMethod: 'cod', cutlery: false, note: 'Gate 2', riderInstructions: 'Call on arrival' } }));
  save('checkoutReplay', await call('POST', '/food/checkout', { token: customer, idem: k1, body: { addressId: addr.id, paymentMethod: 'cod' } }));
  const { id, code } = placed;
  save('ordersActive', await call('GET', '/food/orders?status=active', { token: customer }));
  save('order', await call('GET', `/food/orders/${code}`, { token: customer }));
  save('tracking', await call('GET', `/food/orders/${code}/tracking`, { token: customer }));

  save('boardNew', await call('GET', '/food/vendor/orders?status=new', { token: vendor }));
  save('vendorOrder', await call('GET', `/food/vendor/orders/${id}`, { token: vendor }));
  save('acceptErr', await call('POST', `/food/vendor/orders/${id}/accept`, { token: vendor, body: { etaMinutes: 1 } }));
  save('accept', await call('POST', `/food/vendor/orders/${id}/accept`, { token: vendor, body: { etaMinutes: 25 } }));
  save('preparing', await call('POST', `/food/vendor/orders/${id}/preparing`, { token: vendor }));
  save('ready', await call('POST', `/food/vendor/orders/${id}/ready`, { token: vendor }));

  // The kitchen's own rider.
  save('riderDuty', await call('PATCH', '/food/rider/duty', { token: riderToken, body: { onDuty: true } }));
  const me = save('riderMe', await call('GET', '/food/rider/me', { token: riderToken }));
  save('ridersLive', await call('GET', '/food/vendor/riders/live', { token: vendor }));
  save('ridersSuggest', await call('GET', `/food/vendor/riders/suggest?orderId=${id}`, { token: vendor }));
  save('assign', await call('POST', `/food/vendor/orders/${id}/assign`, { token: vendor, body: { riderId: me.rider.id } }));
  save('riderOrders', await call('GET', '/food/rider/orders?scope=active', { token: riderToken }));
  save('riderOrder', await call('GET', `/food/rider/orders/${id}`, { token: riderToken }));
  save('riderAccept', await call('POST', `/food/rider/orders/${id}/accept`, { token: riderToken }));
  save('riderArrivedBranch', await call('POST', `/food/rider/orders/${id}/arrived-branch`, { token: riderToken }));
  save('riderPickedUp', await call('POST', `/food/rider/orders/${id}/picked-up`, { token: riderToken }));
  save('riderLocation', await call('POST', '/food/rider/location', { token: riderToken, body: { points: [{ orderId: id, lat: 31.5125, lng: 74.343, heading: 20, speed: 6, accuracy: 12 }] } }));
  save('trackingOnTheWay', await call('GET', `/food/orders/${code}/tracking`, { token: customer }));
  save('riderArrivedCustomer', await call('POST', `/food/rider/orders/${id}/arrived-customer`, { token: riderToken }));
  const total = placed.totals.total;
  save('riderDeliveredErr', await call('POST', `/food/rider/orders/${id}/delivered`, { token: riderToken, body: { codCollected: total + 5000 } }));
  save('riderDelivered', await call('POST', `/food/rider/orders/${id}/delivered`, { token: riderToken, body: { codCollected: total } }));
  save('riderCash', await call('GET', '/food/rider/cash', { token: riderToken }));
  save('riderHistory', await call('GET', '/food/rider/orders?scope=history', { token: riderToken }));
  save('vendorRiderCash', await call('GET', `/food/vendor/riders/${me.rider.id}/cash`, { token: vendor }));
  save('handover', await call('POST', `/food/vendor/riders/${me.rider.id}/handover`, { token: vendor, body: { amount: Math.min(500, total), note: 'Evening handover' } }));
  save('orderDelivered', await call('GET', `/food/orders/${code}`, { token: customer }));

  // Reviews, saved kitchens, ordering again.
  const review = save('review', await call('POST', `/food/orders/${code}/review`, { token: customer, body: { foodRating: 5, deliveryRating: 4, tags: ['tasty', 'on_time'], text: 'Juicy, and the fries stayed crisp.' } }));
  save('reviewErr', await call('POST', `/food/orders/${code}/review`, { token: customer, body: { foodRating: 5 } }));
  save('vendorReviews', await call('GET', '/food/vendor/reviews', { token: vendor }));
  save('reviewReply', await call('POST', `/food/vendor/reviews/${review.id}/reply`, { token: vendor, body: { reply: 'Thank you, see you again soon.' } }));
  save('publicReviews', await call('GET', `/food/vendors/${page.id}/reviews`));
  save('favouriteAdd', await call('POST', `/food/favourites/${page.id}`, { token: customer }));
  save('favourites', await call('GET', '/food/favourites', { token: customer }));

  // A transfer: the receipt, the kitchen confirms, then cancels.
  await call('POST', `/food/orders/${code}/reorder`, { token: customer });
  const t = save('checkoutTransfer', await call('POST', '/food/checkout', { token: customer, idem: key(), body: { addressId: addr.id, paymentMethod: 'transfer' } }));
  if (t) {
    save('orderTransfer', await call('GET', `/food/orders/${t.code}`, { token: customer }));
    save('paymentProof', await call('POST', `/food/orders/${t.code}/payment-proof`, { token: customer, body: { paymentRef: 'TRX-778812' } }));
    save('acceptTransfer', await call('POST', `/food/vendor/orders/${t.id}/accept`, { token: vendor, body: { etaMinutes: 30 } }));
    save('preparingUnpaidErr', await call('POST', `/food/vendor/orders/${t.id}/preparing`, { token: vendor }));
    save('paymentConfirm', await call('POST', `/food/vendor/orders/${t.id}/payment/confirm`, { token: vendor }));
    save('cancelByVendor', await call('POST', `/food/vendor/orders/${t.id}/cancel`, { token: vendor, body: { reason: 'Gas ran out' } }));
  }
  // The customer cancels one; the kitchen declines another.
  await call('POST', `/food/orders/${code}/reorder`, { token: customer });
  const c2 = save('checkoutPickup', await call('POST', '/food/checkout', { token: customer, idem: key(), body: { addressId: addr.id, paymentMethod: 'cod' } }));
  if (c2) save('customerCancel', await call('POST', `/food/orders/${c2.code}/cancel`, { token: customer, body: { reason: 'Ordered by mistake' } }));
  await call('POST', `/food/orders/${code}/reorder`, { token: customer });
  const c3 = (await call('POST', '/food/checkout', { token: customer, idem: key(), body: { addressId: addr.id, paymentMethod: 'cod' } })).body.data;
  if (c3) save('reject', await call('POST', `/food/vendor/orders/${c3.id}/reject`, { token: vendor, body: { reason: 'too_busy' } }));
  save('reorder', await call('POST', `/food/orders/${code}/reorder`, { token: customer }));
  await call('DELETE', '/food/cart', { token: customer });
  save('ordersPast', await call('GET', '/food/orders?status=past', { token: customer }));
  save('boardDone', await call('GET', '/food/vendor/orders?status=done', { token: vendor }));
  save('insights', await call('GET', '/food/vendor/insights?range=7d', { token: vendor }));
  await call('PATCH', '/food/rider/duty', { token: riderToken, body: { onDuty: false } });

  // ── Staff ──
  const admin = await staffToken();
  save('adminOverview', await call('GET', '/admin/food/overview', { token: admin }));
  save('adminVendors', await call('GET', '/admin/food/vendors', { token: admin }));
  save('adminVendor', await call('GET', `/admin/food/vendors/${page.id}`, { token: admin }));
  save('adminFeature', await call('POST', `/admin/food/vendors/${page.id}/feature`, { token: admin }));
  save('adminUnfeature', await call('POST', `/admin/food/vendors/${page.id}/unfeature`, { token: admin }));
  const farzana = (await call('GET', '/admin/food/vendors?q=farzana', { token: admin })).body.data.items[0];
  if (farzana) {
    save('adminSuspend', await call('POST', `/admin/food/vendors/${farzana.id}/suspend`, { token: admin, body: { reason: 'Food safety complaint under review' } }));
    save('adminReinstate', await call('POST', `/admin/food/vendors/${farzana.id}/reinstate`, { token: admin, body: { reason: 'Reviewed and cleared' } }));
  }
  save('adminOrders', await call('GET', '/admin/food/orders', { token: admin }));
  save('adminOrder', await call('GET', `/admin/food/orders/${id}`, { token: admin }));
  save('adminReviews', await call('GET', '/admin/food/reviews', { token: admin }));
  save('adminReviewHide', await call('POST', `/admin/food/reviews/${review.id}/hide`, { token: admin, body: { reason: 'Contains a phone number' } }));
  save('adminReviewUnhide', await call('POST', `/admin/food/reviews/${review.id}/unhide`, { token: admin }));
  save('adminCuisines', await call('GET', '/admin/food/cuisines', { token: admin }));
  const cu = save('adminCuisinePost', await call('POST', '/admin/food/cuisines', { token: admin, body: { name: 'Seafood', slug: `seafood-${Date.now() % 10000}`, icon: 'seafood' } }));
  if (cu) save('adminCuisineDelete', await call('DELETE', `/admin/food/cuisines/${cu.id}`, { token: admin }));
  save('adminBanners', await call('GET', '/admin/food/banners', { token: admin }));
  save('adminBannerPostErr', await call('POST', '/admin/food/banners', { token: admin, body: { imageUrl: 'https://images.example.test/not-an-upload.jpg', title: 'Biryani week', targetType: 'search', targetQuery: 'biryani' } }));
  out.adminBannerPost = out.adminBannerPostErr;
  delete out.adminBannerPostErr;
  save('homeWithBanner', await call('GET', `/food/home?${GULBERG}`));
  save('adminPlan', await call('GET', `/admin/food/vendors/${page.id}/plan`, { token: admin }));
  save('adminPlanPatch', await call('PATCH', `/admin/food/vendors/${page.id}/plan`, { token: admin, body: { overrides: { limits: { riders: 1 }, entitlements: { insights: false } } } }));
  save('insightsOffErr', await call('GET', '/food/vendor/insights', { token: vendor }));
  save('adminPlanReset', await call('PATCH', `/admin/food/vendors/${page.id}/plan`, { token: admin, body: { overrides: null } }));

  if (cuisines && !cuisines.length) console.log('warning: no cuisines');
  fs.writeFileSync(OUT, JSON.stringify(scrub(out), null, 1) + '\n');
  console.log('saved', Object.keys(out).length, 'responses to', OUT);
})().catch(e => {
  console.error('FAILED', e.message);
  process.exit(1);
});
