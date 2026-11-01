// The 5B "reaching customers" helpers: why Ramadan mode is off, a menu
// test's price rules and result, the storefront's attribution window,
// hygiene's request rules, batching words; and the serializers that keep a
// small demand cell off the map.

import {
  batchLine,
  broughtCount,
  busiestGap,
  dropOrderLabel,
  ramadanSwitch,
  requestBlocker,
  resultLines,
  storeSourceFor,
  storeToOpen,
  unmetLine,
  validateRamadanWindows,
  validateStory,
  validateTestPrice,
} from '../kitchen/reachModel';
import { demandMapSerializer, experimentSerializer, menuInsightsSerializer } from '../../serializers/kitchen/reachSerializer';
import type { Hygiene } from '../kitchen';

const DAY = 86_400_000;

describe('Ramadan mode', () => {
  it('says when it opens, and moves only in Ramadan and the month before', () => {
    const event = { name: 'Ramadan 1448', startsOn: '2027-02-08', endsOn: '2027-03-09' };
    expect(ramadanSwitch({ state: 'none', event, opensOn: '2027-01-09' })).toEqual({
      disabled: true,
      reason: 'Ramadan mode opens on Sat 9 Jan, a month before the first fast (Mon 8 Feb).',
    });
    expect(ramadanSwitch({ state: 'none', event: null, opensOn: null }).reason).toMatch(/No Ramadan dates/);
    expect(ramadanSwitch({ state: 'upcoming', event, opensOn: '2027-01-09' }).disabled).toBe(false);
    expect(ramadanSwitch({ state: 'active', event, opensOn: '2027-01-09' }).disabled).toBe(false);
  });

  it('checks the windows run forwards', () => {
    expect(validateRamadanWindows({ sehri: { from: '02:30', to: '04:30' }, iftar: { from: '17:30', to: '19:00' } })).toEqual({});
    expect(validateRamadanWindows({ sehri: { from: '04:30', to: '02:30' }, iftar: { from: '19:00', to: '19:00' } })).toEqual({
      sehri: 'Sehri ends after it starts',
      iftar: 'Iftar ends after it starts',
    });
  });
});

describe('the storefront', () => {
  it('counts link and QR orders as brought, and remembers a visit for a week', () => {
    expect(broughtCount({ stats: { month: '2026-10', link: 3, qr: 2, app: 40, tiffin: 9 } })).toBe(5);
    const now = Date.parse('2026-10-20T10:00:00Z');
    const saved = { kind: 'qr' as const, slug: 'biryani-bazaar', at: now - 2 * DAY };
    expect(storeSourceFor(saved, 'biryani-bazaar', now)).toEqual({ kind: 'qr', slug: 'biryani-bazaar' });
    expect(storeSourceFor(saved, 'smash-lab', now)).toBeNull();
    expect(storeSourceFor({ ...saved, at: now - 8 * DAY }, 'biryani-bazaar', now)).toBeNull();
    expect(storeSourceFor(null, 'biryani-bazaar', now)).toBeNull();
  });

  it('opens the kitchen once after signing in, within the hour', () => {
    const now = Date.parse('2026-10-20T10:00:00Z');
    expect(storeToOpen({ kind: 'link', slug: 'nani-ki-handi', at: now - 10 * 60_000 }, now)).toBe('nani-ki-handi');
    expect(storeToOpen({ kind: 'link', slug: 'nani-ki-handi', at: now - 10 * 60_000, opened: true }, now)).toBeNull();
    expect(storeToOpen({ kind: 'link', slug: 'nani-ki-handi', at: now - 2 * 3_600_000 }, now)).toBeNull();
  });
});

describe('demand', () => {
  it('says what went unfound, and the hour the kitchen misses', () => {
    expect(unmetLine({ query: 'sushi', searches: 116, unmetShare: 0.91, hour: 22 })).toBe('116 searches, 91% found nothing open · most at 10 PM');
    const area = Array(24).fill(0.1);
    const own = Array(24).fill(0.1);
    area[23] = 1;
    own[23] = 0.2;
    area[13] = 0.9;
    own[13] = 0.9;
    expect(busiestGap({ area, own })).toBe(23);
    expect(busiestGap({ area: own, own })).toBeNull();
  });

  it('never draws a cell under the minimum, and fills the day to 24 hours', () => {
    const d = demandMapSerializer({
      map: {
        k: 5,
        cells: [
          { geohash6: 'ttsg7c', bounds: { south: 31.51, west: 74.34, north: 31.52, east: 74.35 }, searches: 53, unmetSearches: 12 },
          // The API's floor is 5; the app's is 10.
          { geohash6: 'ttsg7d', bounds: { south: 31.52, west: 74.34, north: 31.53, east: 74.35 }, searches: 7, unmetSearches: 7 },
          { geohash6: 'broken' },
        ],
        hidden: 2,
      },
      curve: { own: { orders: [[0, 2], [0, 4]] }, area: null },
    });
    expect(d.cells.map(c => c.geohash)).toEqual(['ttsg7c']);
    expect(d.cells[0].unmetShare).toBeCloseTo(12 / 53);
    expect(d).toMatchObject({ minCount: 10, hidden: 3, total: 60 });
    expect(d.hourCurve.area).toHaveLength(24);
    expect(d.hourCurve.own[1]).toBe(1);
    expect(d.hourCurve.area.slice(0, 2)).toEqual([0, 0]);
  });
});

describe('menu tests', () => {
  it('keeps a test price within 40% of today’s, and not today’s', () => {
    expect(validateTestPrice('990', 900)).toBeNull();
    expect(validateTestPrice('900', 900)).toBe('That is today’s price (Rs 900)');
    expect(validateTestPrice('1300', 900)).toBe('Between Rs 540 and Rs 1,260');
    expect(validateTestPrice('abc', 900)).toBe('A price in whole rupees');
  });

  it('reads a result against the category, and the decision from its notes', () => {
    const e = experimentSerializer({
      id: 'ex_1',
      itemId: 'mi_seekh',
      item: 'Seekh Kebab (4 pcs)',
      startsOn: '2026-10-19',
      endsOn: '2026-10-21',
      days: 3,
      status: 'completed',
      notes: 'Price Rs 900 → Rs 990 · Kept',
      result: { days: 3, itemDaily: 7.3, categoryMedianDaily: 7, price: 990, recommendation: 'keep' },
    })!;
    expect(e).toMatchObject({ itemName: 'Seekh Kebab (4 pcs)', status: 'kept', change: { kind: 'price', oldPrice: 900, price: 990 }, progress: { daysIn: 3, days: 3 }, result: { verdict: 'keep' } });
    expect(resultLines(e)).toEqual([{ label: 'Sold a day', before: '7', during: '7.3' }]);
  });

  it('puts a dish without a recipe card in no group', () => {
    const m = menuInsightsSerializer({ data: { days: 30, items: [{ itemId: 'mi_k', name: 'Karahi', qty: 40, margin: 300, price: 1400, quadrant: 'star', action: 'feature', advice: 'Keep it prominent' }], needsRecipe: [{ itemId: 'mi_deal', name: 'Solo deal' }] } });
    expect(m.items[0]).toMatchObject({ quadrant: 'star', keep: 300, sold: 40, suggestion: { kind: 'keep', text: 'Keep it prominent' } });
    expect(m.items[1]).toMatchObject({ quadrant: 'unknown', profit: null, keep: null, suggestion: { kind: 'recipe' } });
  });
});

describe('story and hygiene', () => {
  it('checks the story’s length and the cook’s name', () => {
    expect(validateStory({ text: 'Too short', cookName: 'N', photoUrls: [] })).toEqual({ text: 'Tell it in at least 20 characters', cookName: 'Who cooks? 2 to 60 characters' });
    expect(validateStory({ text: 'Nani has cooked for the whole street since 1985.', cookName: 'Nasreen Begum', photoUrls: [] })).toEqual({});
  });

  it('says why verification can’t be asked for yet', () => {
    const items = [
      { key: 'water', label: 'Water', done: true, evidenceUrl: null },
      { key: 'pests', label: 'Pests', done: false, evidenceUrl: null },
    ];
    const h = (over: Partial<Hygiene>): Pick<Hygiene, 'status' | 'items' | 'canRequest'> => ({ status: 'none', items, canRequest: false, ...over });
    expect(requestBlocker(h({}))).toBe('Tick the last item first.');
    expect(requestBlocker(h({ status: 'pending' }))).toMatch(/Staff are looking/);
    expect(requestBlocker(h({ status: 'self_declared', items: items.map(i => ({ ...i, done: true })), canRequest: true }))).toBeNull();
  });
});

describe('batching', () => {
  it('says how far the other drop is, and the drop order', () => {
    expect(batchLine({ extraKm: 0, sameDirection: true })).toBe('Same way · next door');
    expect(batchLine({ extraKm: 1.24, sameDirection: false })).toBe('1.2 km from this drop');
    expect(dropOrderLabel({ position: 1, of: 2 })).toBe('Drop 1 of 2');
    expect(dropOrderLabel(null)).toBeNull();
  });
});
