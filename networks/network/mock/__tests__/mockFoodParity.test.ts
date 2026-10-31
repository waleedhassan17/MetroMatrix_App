// The dummy Food API answers in the real API's shapes: for each vendor, rider,
// menu and discovery response captured from MetroMatrix-API — vendor.json,
// menu.json and discovery.json (the backend's P1–P3, as each landed) and
// p8.json (the released API on its `seed:food` demo) — the dummy API's answer
// to the same request has the same keys, at the top and in the nested objects
// the app reads. A key only one side has fails here unless it is listed in
// KNOWN with the reason. A response one run didn't capture is compared in the
// other.

import vendorReal from '../../../../serializers/__tests__/fixtures/food/vendor.json';
import menuReal from '../../../../serializers/__tests__/fixtures/food/menu.json';
import discoveryReal from '../../../../serializers/__tests__/fixtures/food/discovery.json';
import p8Real from '../../../../serializers/__tests__/fixtures/food/p8.json';
import { api } from '../../apiHelpers';
import { clearTokens } from '../../../../utils/storageUtils';
import { getDb, resetMockDb } from '../mockDb';
import { isAddition, shippedAdditions } from '../kitchen/foodAdditions';
import { signInAs, installDummyApi } from '../testing';

installDummyApi();

type Body = { success: boolean; data?: unknown; error?: { code: string; details?: unknown } };
type Captured = Record<string, { status: number; body: Body }>;
const RUNS: { label: string; real: Captured; strict: boolean }[] = [
  { label: 'P1–P3', real: { ...vendorReal, ...menuReal, ...discoveryReal } as unknown as Captured, strict: true },
  { label: 'P8', real: p8Real as unknown as Captured, strict: true },
];

// Thursday 15 October 2026, 3 PM in Pakistan.
const T0 = new Date('2026-10-15T10:00:00Z').getTime();

const call = async (method: 'get' | 'post' | 'put' | 'patch' | 'delete', url: string, body?: unknown): Promise<Body> => {
  try {
    const res = method === 'get' || method === 'delete' ? await api[method](url) : await api[method](url, body);
    return res.data as Body;
  } catch (e) {
    return ((e as { response?: { data?: Body } }).response?.data ?? { success: false }) as Body;
  }
};

const at = (v: unknown, path: string): unknown =>
  path
    ? path.split('.').reduce<unknown>((x, k) => (x && typeof x === 'object' ? (x as Record<string, unknown>)[k] : undefined), v)
    : v;

const keysOf = (v: unknown) => (v && typeof v === 'object' && !Array.isArray(v) ? Object.keys(v).sort() : null);

const diff = (name: string, realBody: Body, mockBody: Body, paths: string[]) => {
  const out: string[] = [];
  const realRoot = realBody.data ?? { error: realBody.error };
  const mockRoot = mockBody.data ?? { error: mockBody.error };
  for (const p of paths) {
    const rk = keysOf(at(realRoot, p));
    if (!rk) {
      out.push(`${name}:${p || '.'} not captured`);
      continue;
    }
    const mk = keysOf(at(mockRoot, p));
    if (!mk) {
      out.push(`${name}:${p || '.'} missing`);
      continue;
    }
    for (const k of rk) if (!mk.includes(k)) out.push(`${name}:${p || '.'} -${k}`);
    for (const k of mk) if (!rk.includes(k)) out.push(`${name}:${p || '.'} +${k}`);
  }
  return out;
};

/** Differences the dummy API keeps on purpose. Each says why; anything new fails the test. */
const KNOWN: Record<string, string> = {
  'vendorPageErr:error +details': 'The dummy API sends details: null on every error; the API leaves it out when there are none. The app reads both.',
};

type As = 'vendor' | 'rider' | 'home' | 'guest';
const CASES: { fixture: string; as: As; run: () => Promise<Body>; paths: string[] }[] = [];
const add = (fixture: string, as: As, run: () => Promise<Body>, paths: string[]) => CASES.push({ fixture, as, run, paths });

// /auth/me (`business.food`) is the real API's alone now: the dummy API has no auth routes.
add('cuisines', 'vendor', () => call('get', '/food/cuisines'), ['0']);
add('resto.setupAfter', 'vendor', () => call('get', '/food/vendor/setup'), ['', 'items.0']);
add('resto.profilePatch', 'vendor', () => call('get', '/food/vendor/profile'), ['', 'cuisines.0', 'branch', 'branch.openState']);
add('resto.busy', 'vendor', () => call('post', '/food/vendor/busy', { extraMinutes: 15 }), ['', 'branch', 'branch.busy', 'branch.openState']);
add('resto.pause', 'vendor', () => call('post', '/food/vendor/pause', { message: 'Back soon' }), ['', 'branch']);
add('resto.resume', 'vendor', () => call('post', '/food/vendor/resume'), ['', 'branch']);
add('resto.settingsPatch', 'vendor', () => call('patch', '/food/vendor/settings', { codLimit: 5000 }), ['', 'location']);
add('resto.hoursPut', 'vendor', () => call('get', '/food/vendor/hours'), ['0']);
add(
  'resto.hoursOverlap',
  'vendor',
  () =>
    call('put', '/food/vendor/hours', [
      { weekday: 1, opensAt: '12:00', closesAt: '16:00' },
      { weekday: 1, opensAt: '15:00', closesAt: '23:00' },
    ]),
  ['', 'error', 'error.details', 'error.details.fields', 'error.details.conflict.0'],
);
add('resto.feeBandsPut', 'vendor', () => call('get', '/food/vendor/fee-bands'), ['0']);
add('resto.closurePost', 'vendor', () => call('post', '/food/vendor/closures', { startsAt: '2026-12-24T19:00:00.000Z', endsAt: '2026-12-25T19:00:00.000Z', reason: 'Family wedding' }), ['']);
add('resto.accountPost', 'vendor', () => call('get', '/food/vendor/payment-accounts').then(b => ({ ...b, data: (b.data as unknown[])[0] })), ['']);
add('resto.plan', 'vendor', () => call('get', '/food/vendor/plan'), ['', 'limits', 'usage', 'entitlements']);
add('resto.riderCreate', 'vendor', () => call('post', '/food/vendor/riders', { fullName: 'Kamran Shah', vehicle: 'bike' }), ['', 'rider', 'credential']);
add('resto.riderGet', 'vendor', () => call('get', '/food/vendor/riders/rd_ali'), ['']);
add('resto.riderCredential', 'vendor', () => call('get', '/food/vendor/riders/rd_ali/credential'), ['']);
add('resto.riderStatus', 'vendor', () => call('patch', '/food/vendor/riders/rd_usman/status', { status: 'active' }), ['']);
add('resto.riderPatch', 'vendor', () => call('patch', '/food/vendor/riders/rd_usman', { vehicle: 'car' }), ['']);
add('resto.goLive', 'vendor', async () => {
  const db = await getDb();
  const v = db.food.vendors.find(x => x.slug === 'biryani-bazaar')!;
  v.status = 'draft';
  v.logoUrl = null;
  return call('post', '/food/vendor/go-live');
}, ['', 'error', 'error.details']);
add('resto.riderReset', 'vendor', () => call('post', '/food/vendor/riders/rd_usman/reset-password'), ['']);
add('rider.me', 'rider', () => call('get', '/food/rider/me'), ['', 'rider', 'vendor']);

// The menu (the restaurant), then a home kitchen's day.
add('menu.categories', 'vendor', () => call('get', '/food/vendor/menu/categories'), ['0']);
add('menu.categoryWindow', 'vendor', () => call('post', '/food/vendor/menu/categories', { name: 'Late night', availableFrom: '22:00', availableTo: '02:00' }), ['']);
add('menu.item', 'vendor', () => call('get', '/food/vendor/menu/items/mi_chicken_biryani'), ['', 'variants.0', 'optionGroups.0']);
add('menu.items', 'vendor', () => call('get', '/food/vendor/menu/items'), ['0']);
add('menu.groupRequired', 'vendor', () => call('get', '/food/vendor/menu/option-groups/og_spice'), ['', 'options.0']);
add('menu.groups', 'vendor', () => call('get', '/food/vendor/menu/option-groups'), ['0', '0.options.0']);
add('menu.groupErr', 'vendor', () => call('post', '/food/vendor/menu/option-groups', { name: 'Bad', minSelect: 3, maxSelect: 1, options: [{ name: 'A', priceDelta: 0 }] }), [
  '',
  'error',
  'error.details',
  'error.details.fields',
]);
add('menu.itemTagErr', 'vendor', () => call('post', '/food/vendor/menu/items', { categoryId: 'mc_resto_biryani', name: 'Bad tags', basePrice: 100, tags: ['nope'] }), [
  '',
  'error',
  'error.details',
]);
add('menu.categoryDeleteErr', 'vendor', () => call('delete', '/food/vendor/menu/categories/mc_resto_biryani'), ['', 'error', 'error.details']);
add('menu.categoriesReorder', 'vendor', () => call('put', '/food/vendor/menu/categories/reorder', { ids: ['mc_resto_biryani', 'mc_resto_karahi'] }), ['0']);
add('menu.itemDuplicate', 'vendor', () => call('post', '/food/vendor/menu/items/mi_chicken_biryani/duplicate'), ['', 'variants.0', 'optionGroups.0']);
add(
  'menu.availabilityPatch',
  'vendor',
  () =>
    call('patch', '/food/vendor/availability', {
      items: [{ itemId: 'mi_seekh', isAvailable: false, unavailableUntil: new Date(T0 + 7_200_000).toISOString() }],
      options: [{ optionId: 'og_raita_1', isAvailable: false }],
    }),
  ['', 'items.0', 'options.0'],
);
add('home.todayPatch', 'home', () => call('patch', '/food/vendor/today', { items: [{ itemId: 'mi_qorma', portions: 20, cooking: true }] }), ['', 'items.0']);
add('home.slotsPut', 'home', () => call('put', '/food/vendor/preorder-slots', [{ weekday: 5, slotStart: '13:00', cutoffMinutesBefore: 180, maxOrders: 15 }]), ['0']);
// Discovery, signed out, from Gulberg (the captures' point).
const P = 'lat=31.5160&lng=74.3420';
const CARD = ['', 'etaRange', 'openState', 'fulfilment', 'cuisines.0'];
add('home', 'guest', () => call('get', `/food/home?${P}`), ['', 'coverage', 'cuisines.0', ...CARD.map(k => `homeKitchens.0${k ? `.${k}` : ''}`)]);
add('homeFar', 'guest', () => call('get', '/food/home?lat=24.8607&lng=67.0011'), ['', 'coverage']);
add('homeErr', 'guest', () => call('get', '/food/home'), ['', 'error', 'error.details', 'error.details.fields']);
add('vendors', 'guest', () => call('get', `/food/vendors?${P}`), ['', ...CARD.map(k => `items.0${k ? `.${k}` : ''}`)]);
add('vendorPage', 'guest', () => call('get', `/food/vendors/biryani-bazaar?${P}`), [
  '',
  'delivery',
  'delivery.etaRange',
  'pickup',
  'pickup.readyIn',
  'location',
  'openState',
  'menu.0',
  'menu.0.items.0',
]);
add('vendorPageNoPoint', 'guest', () => call('get', '/food/vendors/biryani-bazaar'), ['']);
add('vendorPageErr', 'guest', () => call('get', '/food/vendors/no-such-kitchen'), ['', 'error']);
add('item', 'guest', () => call('get', '/food/items/mi_chicken_biryani'), ['', 'category', 'variants.0', 'groups.0', 'groups.0.options.0']);
add('search', 'guest', () => call('get', `/food/search?q=biryani&${P}`), ['', 'vendors.0', 'dishes.0', 'dishes.0.vendor', 'dishes.0.items.0']);
add('home.weeklyPut', 'home', () => call('put', '/food/vendor/weekly-menu', [{ itemId: 'mi_pulao', days: [5] }]), ['0']);

beforeAll(() => {
  jest.useFakeTimers({ doNotFake: ['setTimeout', 'setInterval', 'setImmediate', 'nextTick', 'queueMicrotask'] });
});
afterAll(() => jest.useRealTimers());

/** Every case against a fresh dummy API; compared with `real` where it captured that response. */
const replay = async ({ label, real, strict }: (typeof RUNS)[number]) => {
  jest.setSystemTime(T0);
  await resetMockDb();
  await clearTokens();
  const found: string[] = [];
  const compare = (fixture: string, body: Body, paths: string[]) => {
    const r = real[fixture];
    if (r) found.push(...diff(fixture, r.body, body, paths).filter(f => strict || !f.endsWith(' not captured')));
  };
  let who: string | null = null;
  for (const c of CASES) {
    if (c.as !== who) {
      await clearTokens();
      if (c.as === 'guest') {
        // Signed out, on a fresh seed (the vendor cases above take a kitchen offline).
        if (who !== 'guest') {
          await resetMockDb();
          await clearTokens();
        }
        who = c.as;
        compare(c.fixture, await c.run(), c.paths);
        continue;
      }
      if (c.as === 'vendor') await signInAs('restaurant@metromatrix.app');
      else if (c.as === 'home') await signInAs('homekitchen@metromatrix.app');
      else await signInAs('biryani-bazaar.ali');
      who = c.as;
    }
    compare(c.fixture, await c.run(), c.paths);
  }
  return found.map(f => ({ label, f }));
};

it('answers every captured vendor, rider, menu and discovery request with the real keys', async () => {
  const found = [...(await replay(RUNS[0])), ...(await replay(RUNS[1]))];
  // Keys the assumed kitchen API adds (../kitchen/foodAdditions) are compared once the backend ships them.
  const unexpected = found.filter(x => !KNOWN[x.f] && !isAddition(x.f)).map(x => `${x.label} ${x.f}`);
  expect(shippedAdditions(RUNS.map(r => r.real))).toEqual([]);
  const stale = Object.keys(KNOWN).filter(k => !found.some(x => x.f === k));
  const uncovered = CASES.filter(c => !RUNS.some(run => run.real[c.fixture])).map(c => c.fixture);
  expect({ unexpected, stale, uncovered }).toEqual({ unexpected: [], stale: [], uncovered: [] });
});
