// The dummy Food API orders the way the real one does: the captured ordering
// run (src/serializers/__tests__/fixtures/food/orders.json — bag, deals,
// preview, checkout, the vendor's moves, the customer's orders) is replayed
// against the dummy API, and every answer has the real keys, at the top and
// in the nested objects the app reads. A key only one side has fails here
// unless it is listed in KNOWN with the reason.

import ordersReal from '../../../../serializers/__tests__/fixtures/food/orders.json';
import { authSignin } from '../../../auth/authNetwork';
import { api } from '../../apiHelpers';
import { clearTokens } from '../../../../utils/storageUtils';
import { SEED_PASSWORD } from '../mockConfig';
import { resetMockDb } from '../mockDb';

type Body = { success: boolean; data?: any; error?: { code: string; details?: unknown } };
const R = ordersReal as unknown as Record<string, { status: number; body: Body }>;

// Thursday 15 October 2026, 3 PM in Pakistan: Biryani Bazaar is open.
const T0 = new Date('2026-10-15T10:00:00Z').getTime();

const call = async (method: 'get' | 'post' | 'patch' | 'delete', url: string, body?: unknown, headers?: Record<string, string>): Promise<Body> => {
  try {
    const res = method === 'get' || method === 'delete' ? await api[method](url, { headers }) : await api[method](url, body ?? {}, { headers });
    return res.data as Body;
  } catch (e) {
    return ((e as { response?: { data?: Body } }).response?.data ?? { success: false }) as Body;
  }
};

const at = (v: unknown, path: string): unknown =>
  path ? path.split('.').reduce<unknown>((x, k) => (x && typeof x === 'object' ? (x as Record<string, unknown>)[k] : undefined), v) : v;
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
  'checkoutErr:error +details': 'The dummy API sends details: null on every error; the API leaves it out when there are none. The app reads both.',
};

const ORDER = ['', 'vendor', 'vendor.location', 'items.0', 'totals', 'payment', 'eta', 'timestamps', 'events.0'];
const ERROR = ['', 'error', 'error.details'];

type As = 'customer' | 'vendor';
const steps: { fixture: string; as: As; run: (s: State) => Promise<Body>; paths: string[] }[] = [];
const add = (fixture: string, as: As, run: (s: State) => Promise<Body>, paths: string[]) => steps.push({ fixture, as, run, paths });
interface State {
  code: string;
  id: string;
  lineId: string;
  transfer?: { code: string; id: string };
  pickup?: { code: string; id: string };
  rejected?: { code: string; id: string };
}

const biryani = { vendorId: 'fb_resto', itemId: 'mi_chicken_biryani', variantId: 'mi_chicken_biryani_v1', optionIds: ['og_spice_1', 'og_raita_2'], quantity: 2, notes: 'Less spicy please' };
const place = (paymentMethod: string, key: string) => call('post', '/food/checkout', { addressId: 'ad_customer_home', paymentMethod }, { 'Idempotency-Key': key });
const refill = () => call('post', '/food/cart/items', biryani);

// The vendor's deals first (the run creates two).
add('vendor.promotions', 'vendor', () => call('get', '/food/vendor/promotions'), ['', 'items.0']);
add('vendor.promotionPost', 'vendor', () => call('post', '/food/vendor/promotions', { title: 'Weekday lunch', kind: 'percent_off_order', value: 10, minOrder: 500, maxDiscount: 300 }), ['']);
add('vendor.promotionCode', 'vendor', () => call('post', '/food/vendor/promotions', { title: 'Rs 100 off with a code', kind: 'flat_off', value: 100, minOrder: 1000, code: 'BZ61064' }), ['']);
add('vendor.promotionErr', 'vendor', () => call('post', '/food/vendor/promotions', { title: 'x', kind: 'flat_off', value: 100 }), [...ERROR, 'error.details.fields']);

// The bag.
add('cartEmpty', 'customer', () => call('get', '/food/cart'), ['']);
add('cartAddErr', 'customer', () => call('post', '/food/cart/items', { ...biryani, variantId: null }), ERROR);
add('cartAdd', 'customer', () => call('post', '/food/cart/items', biryani), ['', 'vendor', 'vendor.openState', 'lines.0', 'lines.0.variant', 'lines.0.options.0']);
add('cartOtherVendorErr', 'customer', () => call('post', '/food/cart/items', { vendorId: 'fb_cloud', itemId: 'mi_classic_smash', variantId: 'mi_classic_smash_v1', optionIds: [], quantity: 1 }), [
  ...ERROR,
  'error.details.currentVendor',
]);
add('cart', 'customer', () => call('get', '/food/cart'), ['', 'vendor', 'lines.0']);
add('cartLinePatch', 'customer', s => call('patch', `/food/cart/items/${s.lineId}`, { quantity: 3 }), ['']);
add('cartPatch', 'customer', () => call('patch', '/food/cart', { fulfilment: 'delivery', scheduledFor: null }), ['']);
add('preview', 'customer', () => call('post', '/food/cart/preview', { addressId: 'ad_customer_home', paymentMethod: 'cod' }), [
  '',
  'totals',
  'deal',
  'eta',
  'payment',
  'payment.available',
  'lines.0',
]);
add('previewBadCode', 'customer', () => call('post', '/food/cart/preview', { addressId: 'ad_customer_home', promoCode: 'NOPE' }), ['', 'issues.0', 'issues.0.details']);
add('previewTransfer', 'customer', () => call('post', '/food/cart/preview', { addressId: 'ad_customer_home', paymentMethod: 'transfer' }), ['payment', 'payment.accounts.0']);
add('previewPickup', 'customer', () => call('post', '/food/cart/preview', { paymentMethod: 'pay_at_pickup' }), ['', 'issues.0', 'issues.1', 'issues.1.details']);
add('slots', 'customer', () => call('get', '/food/vendors/biryani-bazaar/slots'), ['']);

// Checkout, and the customer's view of the order.
add('checkoutErr', 'customer', () => call('post', '/food/checkout', { addressId: 'ad_customer_home', paymentMethod: 'cod' }), ['', 'error']);
add('checkout', 'customer', () => place('cod', 'key-1'), [...ORDER, 'deal', 'address']);
add('checkoutReplay', 'customer', () => place('cod', 'key-1'), ['']);
add('ordersActive', 'customer', () => call('get', '/food/orders?status=active'), ['', 'items.0', 'items.0.vendor']);
add('order', 'customer', s => call('get', `/food/orders/${s.code}`), ['']);
add('tracking', 'customer', s => call('get', `/food/orders/${s.code}/tracking`), ['', 'eta', 'branch', 'drop']);

// The kitchen's board and moves.
add('boardNew', 'vendor', () => call('get', '/food/vendor/orders?status=new'), ['', 'items.0', 'items.0.payment']);
add('vendorOrder', 'vendor', s => call('get', `/food/vendor/orders/${s.id}`), ['', 'customer', 'actions']);
add('acceptErr', 'vendor', s => call('post', `/food/vendor/orders/${s.id}/accept`, { etaMinutes: 2 }), [...ERROR, 'error.details.fields']);
add('accept', 'vendor', s => call('post', `/food/vendor/orders/${s.id}/accept`, { etaMinutes: 25 }), ['', 'actions']);
add('preparing', 'vendor', s => call('post', `/food/vendor/orders/${s.id}/preparing`), ['']);
add('ready', 'vendor', s => call('post', `/food/vendor/orders/${s.id}/ready`), ['']);

// A transfer: the receipt, the kitchen waits for the money, then confirms; then cancels.
add('checkoutTransfer', 'customer', async () => (await refill(), place('transfer', 'key-2')), ['', 'payment', 'payment.accounts.0']);
add('orderTransfer', 'customer', s => call('get', `/food/orders/${s.transfer!.code}`), ['', 'payment']);
add('paymentProof', 'customer', s => call('post', `/food/orders/${s.transfer!.code}/payment-proof`, { paymentRef: 'TXN 8812 3341' }), ['', 'payment']);
add('acceptTransfer', 'vendor', s => call('post', `/food/vendor/orders/${s.transfer!.id}/accept`, { etaMinutes: 30 }), ['', 'actions']);
add('preparingUnpaidErr', 'vendor', s => call('post', `/food/vendor/orders/${s.transfer!.id}/preparing`), ERROR);
add('paymentConfirm', 'vendor', s => call('post', `/food/vendor/orders/${s.transfer!.id}/payment/confirm`), ['', 'payment']);
add('cancelByVendor', 'vendor', s => call('post', `/food/vendor/orders/${s.transfer!.id}/cancel`, { reason: 'Out of chicken today' }), ['', 'payment']);

// The customer cancels before the kitchen answers; the kitchen declines another.
add('checkoutPickup', 'customer', async () => (await refill(), place('cod', 'key-3')), ['']);
add('customerCancel', 'customer', s => call('post', `/food/orders/${s.pickup!.code}/cancel`, { reason: 'Ordered by mistake' }), ['']);
add('reject', 'vendor', async s => {
  await clearTokens();
  await authSignin({ email: 'customer@metromatrix.app', password: SEED_PASSWORD, portal: 'customer' });
  await refill();
  const o = (await place('cod', 'key-4')).data;
  s.rejected = { code: o.code, id: o.id };
  await clearTokens();
  await authSignin({ email: 'restaurant@metromatrix.app', password: SEED_PASSWORD, portal: 'partner' });
  return call('post', `/food/vendor/orders/${o.id}/reject`, { reason: 'too_busy' });
}, ['']);
add('boardDone', 'vendor', () => call('get', '/food/vendor/orders?status=done'), ['', 'items.0']);
add('ordersPast', 'customer', () => call('get', '/food/orders?status=past'), ['', 'items.0']);
add('reorder', 'customer', s => call('post', `/food/orders/${s.rejected!.code}/reorder`), ['', 'cart', 'cart.vendor', 'cart.lines.0']);

beforeAll(() => {
  jest.useFakeTimers({ doNotFake: ['setTimeout', 'setInterval', 'setImmediate', 'nextTick', 'queueMicrotask'] });
});
afterAll(() => jest.useRealTimers());

it('answers every captured ordering request with the real keys', async () => {
  jest.setSystemTime(T0);
  await resetMockDb();
  await clearTokens();
  const s: State = { code: '', id: '', lineId: '' };
  const found: string[] = [];
  let who: As | null = null;
  for (const c of steps) {
    if (c.as !== who) {
      await clearTokens();
      if (c.as === 'customer') await authSignin({ email: 'customer@metromatrix.app', password: SEED_PASSWORD, portal: 'customer' });
      else await authSignin({ email: 'restaurant@metromatrix.app', password: SEED_PASSWORD, portal: 'partner' });
      who = c.as;
    }
    const body = await c.run(s);
    if (c.fixture === 'reject') who = 'vendor';
    if (c.fixture === 'cartAdd') s.lineId = body.data.lines[0].id;
    if (c.fixture === 'checkout') s.code = body.data.code;
    if (c.fixture === 'checkout') s.id = body.data.id;
    if (c.fixture === 'checkoutTransfer') s.transfer = { code: body.data.code, id: body.data.id };
    if (c.fixture === 'checkoutPickup') s.pickup = { code: body.data.code, id: body.data.id };
    expect([c.fixture, body.error?.code ?? 'ok']).toEqual([c.fixture, R[c.fixture].body.error?.code ?? 'ok']);
    found.push(...diff(c.fixture, R[c.fixture].body, body, c.paths));
  }
  const unexpected = found.filter(f => !KNOWN[f]);
  const stale = Object.keys(KNOWN).filter(k => !found.includes(k));
  expect({ unexpected, stale }).toEqual({ unexpected: [], stale: [] });
});
