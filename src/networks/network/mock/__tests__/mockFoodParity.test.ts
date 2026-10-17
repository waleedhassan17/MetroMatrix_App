// The dummy Food API answers in the real API's shapes: for each vendor and
// rider response captured from MetroMatrix-API
// (src/serializers/__tests__/fixtures/food/vendor.json), the dummy API's
// answer to the same request has the same keys, at the top and in the nested
// objects the app reads. A key only one side has fails here unless it is
// listed in KNOWN with the reason.

import real from '../../../../serializers/__tests__/fixtures/food/vendor.json';
import { authSignin } from '../../../auth/authNetwork';
import { api } from '../../apiHelpers';
import { clearTokens } from '../../../../utils/storageUtils';
import { SEED_PASSWORD } from '../mockConfig';
import { getDb, resetMockDb } from '../mockDb';

type Body = { success: boolean; data?: unknown; error?: { code: string; details?: unknown } };
const R = real as unknown as Record<string, { status: number; body: Body }>;

// Thursday 15 October 2026, 3 PM in Pakistan.
const T0 = new Date('2026-10-15T10:00:00Z').getTime();

const call = async (method: 'get' | 'post' | 'put' | 'patch', url: string, body?: unknown): Promise<Body> => {
  try {
    const res = method === 'get' ? await api.get(url) : await api[method](url, body);
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
const KNOWN: Record<string, string> = {};

const CASES: { fixture: string; as: 'vendor' | 'rider'; run: () => Promise<Body>; paths: string[] }[] = [];
const add = (fixture: string, as: 'vendor' | 'rider', run: () => Promise<Body>, paths: string[]) => CASES.push({ fixture, as, run, paths });

add('resto.meAfter', 'vendor', () => call('get', '/auth/me'), ['business.food']);
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

beforeAll(() => {
  jest.useFakeTimers({ doNotFake: ['setTimeout', 'setInterval', 'setImmediate', 'nextTick', 'queueMicrotask'] });
});
afterAll(() => jest.useRealTimers());

it('answers every captured vendor and rider request with the real keys', async () => {
  jest.setSystemTime(T0);
  await resetMockDb();
  const found: string[] = [];
  let who: string | null = null;
  for (const c of CASES) {
    if (c.as !== who) {
      await clearTokens();
      if (c.as === 'vendor') await authSignin({ email: 'restaurant@metromatrix.app', password: SEED_PASSWORD, portal: 'partner' });
      else await authSignin({ username: 'biryani-bazaar.ali', password: SEED_PASSWORD, portal: 'partner' });
      who = c.as;
    }
    found.push(...diff(c.fixture, R[c.fixture].body, await c.run(), c.paths));
  }
  const unexpected = found.filter(f => !KNOWN[f]);
  const stale = Object.keys(KNOWN).filter(k => !found.includes(k));
  expect({ unexpected, stale }).toEqual({ unexpected: [], stale: [] });
});
