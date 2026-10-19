// The 40 test phrases of docs/VOICE_ASSUMED.md §4 through the dummy API's
// speech-understanding stand-in: each proposes the action the document
// says, with the right quantities in base units, prices, orders and dishes.
// (The real API's speech to text can only be checked on a phone: see
// docs/KITCHEN_DEVICE_CHECKS.md.)

import { CANON, seedKitchen } from '../kitchen/kitchenSeed';
import { seedMenus } from '../food/foodMenuSeed';
import { VOICE_TEST_PHRASES, baseQtyOf, interpret, type VoiceAction, type VoiceWorld } from '../kitchen/voiceStandIn';

const TODAY = '2026-10-19';
const menus = seedMenus(TODAY);
const kitchen = seedKitchen(menus.items.map(i => ({ id: i.id, businessId: i.businessId, sold30d: i.sold30d, days: i.days })), Date.parse('2026-10-19T09:00:00Z'));
const names = Object.fromEntries(Object.entries(CANON).map(([key, c]) => [key, c.name]));
const aliases = kitchen.aliases.map(a => ({ word: a.word, key: a.key }));

const worldOf = (businessId: string, everything = false): VoiceWorld => ({
  today: TODAY,
  ingredients: everything
    ? Object.entries(CANON).map(([key, c]) => ({ id: key, name: c.name, key }))
    : kitchen.ingredients.filter(i => i.businessId === businessId).map(i => ({ id: i.id, name: i.name, key: i.priceRefKey })),
  aliases,
  names,
  items: menus.items.filter(i => i.businessId === businessId).map(i => ({ id: i.id, name: i.name })),
  orders: [
    { id: 'o1', code: 'FC-AAAAAA', status: 'placed', placedAt: '2026-10-19T08:00:00Z' },
    { id: 'o2', code: 'FC-BBBBBB', status: 'placed', placedAt: '2026-10-19T08:05:00Z' },
    { id: 'o3', code: 'FC-CCCCCC', status: 'preparing', placedAt: '2026-10-19T07:40:00Z' },
  ],
});

const WORLDS: Record<string, VoiceWorld> = {
  board: worldOf('b_resto'),
  stock: worldOf('b_resto'),
  purchases: worldOf('b_resto'),
  today: worldOf('b_homek'),
  search: worldOf('b_resto'),
  pantry: worldOf('none', true),
};

const ORDER_OF: Record<string, string> = { oldest: 'o1', newest: 'o2', cooking: 'o3' };
const keyOf = (world: VoiceWorld, line: { ingredientId?: string | null; key?: string | null }) =>
  line.key ?? world.ingredients.find(i => i.id === line.ingredientId)?.key ?? null;
const daysBetween = (a: string, b: string) => Math.round((Date.parse(b) - Date.parse(a)) / 86_400_000);

describe('voice stand-in: the 40 test phrases', () => {
  it('has 40 phrases across the six contexts', () => {
    expect(VOICE_TEST_PHRASES).toHaveLength(40);
  });

  it.each(VOICE_TEST_PHRASES.map(p => [p.context, p.text, p]))('%s: %s', (_c, _t, p) => {
    const world = WORLDS[p.context];
    const r = interpret(p.text, p.context, world);
    expect(r.transcript).toBe(p.text.trim());
    expect(r.action).not.toBeNull();
    const a = r.action as VoiceAction & Record<string, any>;
    const e = p.expect as Record<string, any>;
    expect(a.kind).toBe(e.kind);
    if (e.order) expect(a.orderId).toBe(ORDER_OF[e.order]);
    for (const f of ['etaMinutes', 'reason', 'itemId', 'extraMinutes', 'query']) if (e[f] !== undefined) expect(a[f]).toBe(e[f]);
    if (e.lines) {
      expect(a.lines).toHaveLength(e.lines.length);
      e.lines.forEach((want: Record<string, any>, n: number) => {
        const got = a.lines[n];
        if (want.key) expect(keyOf(world, got)).toBe(want.key);
        if (want.name) expect(got.name).toBe(want.name);
        if (want.base !== undefined) expect(baseQtyOf(got)).toBe(want.base);
        if (want.total !== undefined) expect(got.total).toBe(want.total);
        if (want.itemId) expect(got.itemId).toBe(want.itemId);
        if (want.portions !== undefined) expect(got.portions).toBe(want.portions);
        if (want.expiresInDays !== undefined) expect(daysBetween(TODAY, got.expiresOn)).toBe(want.expiresInDays);
      });
    }
    expect(r.confidence).toBeGreaterThanOrEqual(0.6);
  });

  it('reads the script and the language', () => {
    expect(interpret('۵ کلو ٹماٹر ۱۲۰۰ روپے', 'stock', WORLDS.stock).language).toBe('ur');
    expect(interpret('5 kilo tamatar 1200 rupay', 'stock', WORLDS.stock).language).toBe('ur');
    expect(interpret('bought 10 kg chicken for 6200 rupees', 'stock', WORLDS.stock).language).toBe('en');
  });

  it('offers "did you mean" orders when it had to guess', () => {
    const r = interpret('accept karo', 'board', WORLDS.board);
    expect(r.confidence).toBeLessThan(0.7);
    expect(r.alternatives.map(x => (x.action as { orderId: string }).orderId)).toEqual(['o2']);
  });

  it('proposes nothing it did not understand', () => {
    expect(interpret('hello there', 'stock', WORLDS.stock).action).toBeNull();
  });
});
