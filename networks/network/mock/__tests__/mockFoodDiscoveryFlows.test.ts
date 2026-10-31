// The dummy Food discovery API, driven through the REAL discovery networks:
// who delivers to a point, the rails, pick-up reach, sorts and filters,
// paused and closed vendors, a category outside its hours, dishes off or
// not on today's menu, portions running out, the dish sheet and search.

import { getFoodHomeAPI, getItemSheetAPI, getVendorPageAPI, getVendorsAPI, searchFoodAPI } from '../../../food/discoveryNetwork';
import { ApiError, required } from '../../apiHelpers';
import { clearTokens } from '../../../../utils/storageUtils';
import { getDb, resetMockDb } from '../mockDb';
import { installDummyApi } from '../testing';
import { foodHomeSerializer, vendorCardsPageSerializer, vendorPageSerializer, itemSheetSerializer, foodSearchSerializer } from '../../../../serializers/food/discoverySerializer';

installDummyApi();

// Thursday 15 October 2026, 3 PM in Pakistan.
const T0 = new Date('2026-10-15T10:00:00Z').getTime();
const GULBERG = { lat: 31.516, lng: 74.342 };
const KARACHI = { lat: 24.8607, lng: 67.0011 };

const failure = async (p: Promise<unknown>): Promise<ApiError> => {
  try {
    await p;
  } catch (e) {
    return e as ApiError;
  }
  throw new Error('expected the call to fail');
};

const slugs = (xs: { slug: string }[]) => xs.map(x => x.slug);

beforeAll(() => {
  jest.useFakeTimers({ doNotFake: ['setTimeout', 'setInterval', 'setImmediate', 'nextTick', 'queueMicrotask'] });
});
afterAll(() => jest.useRealTimers());

beforeEach(async () => {
  jest.setSystemTime(T0);
  await resetMockDb();
  await clearTokens();
});

describe('the home', () => {
  it('fills the rails for a point in Gulberg', async () => {
    const h = required(foodHomeSerializer(await getFoodHomeAPI(GULBERG.lat, GULBERG.lng)));
    expect(h.coverage).toMatchObject({ delivering: true, message: null });
    expect(h.cuisines).toHaveLength(18);
    // Open ones only, best rated first.
    expect(slugs(h.topRated).slice(0, 2)).toEqual(['nani-ki-handi', 'green-bowl-co']);
    expect(slugs(h.topRated)).not.toContain('tandoor-nights');
    expect(slugs(h.freeDelivery)).toEqual(['golden-wok-house']);
    expect(slugs(h.homeKitchens)).toEqual(['nani-ki-handi']);
    expect(slugs(h.newOnFoodCourt)).toContain('slice-theory');
    expect(h.fastest[0]).toMatchObject({ slug: 'roll-republic', eta: { min: 17, max: 27, label: '17–27 min' } });
    // Paused vendors stay out of every list.
    const all = [...h.topRated, ...h.fastest, ...h.homeKitchens, ...h.newOnFoodCourt, ...h.freeDelivery].map(v => v.slug);
    expect(all).not.toContain('chai-khana-corner');
  });

  it('says when nothing delivers to a point', async () => {
    const h = required(foodHomeSerializer(await getFoodHomeAPI(KARACHI.lat, KARACHI.lng)));
    expect(h.coverage).toEqual({ delivering: false, message: 'Not delivering here yet', pickupNearby: 0 });
    expect(h.topRated).toEqual([]);
  });
});

describe('vendor lists', () => {
  it('puts open vendors first, then the sort', async () => {
    const p = required(vendorCardsPageSerializer(await getVendorsAPI({ ...GULBERG, sort: 'rating' }, 1, 20)));
    const open = p.items.filter(v => v.openState.open);
    expect(p.items.slice(0, open.length).every(v => v.openState.open)).toBe(true);
    expect(p.items[p.items.length - 1]).toMatchObject({ slug: 'tandoor-nights', openState: { open: false, label: 'Opens 5:00 PM' } });
    expect(open.map(v => v.ratingAvg)).toEqual([...open.map(v => v.ratingAvg)].sort((a, b) => b - a));
  });

  it('filters: free delivery, open now, cuisine, home kitchens, and pages', async () => {
    expect(slugs((required(vendorCardsPageSerializer(await getVendorsAPI({ ...GULBERG, freeDelivery: true }, 1, 20)))).items)).toEqual(['golden-wok-house']);
    expect(slugs((required(vendorCardsPageSerializer(await getVendorsAPI({ ...GULBERG, openNow: true }, 1, 20)))).items)).not.toContain('tandoor-nights');
    expect(slugs((required(vendorCardsPageSerializer(await getVendorsAPI({ ...GULBERG, cuisine: 'pizza' }, 1, 20)))).items)).toEqual(['slice-theory']);
    expect(slugs((required(vendorCardsPageSerializer(await getVendorsAPI({ ...GULBERG, homeKitchen: true }, 1, 20)))).items)).toEqual(['nani-ki-handi']);
    const first = required(vendorCardsPageSerializer(await getVendorsAPI(GULBERG, 1, 3)));
    const second = required(vendorCardsPageSerializer(await getVendorsAPI(GULBERG, 2, 3)));
    expect(first.total).toBe(second.total);
    expect(first.items.some(v => second.items.some(w => w.id === v.id))).toBe(false);
  });

  it('reaches pick-up places further away than any delivery zone', async () => {
    // Bahria Town: about 20 km out, past every delivery zone, inside pick-up reach.
    const far = { lat: 31.37, lng: 74.2 };
    expect((required(vendorCardsPageSerializer(await getVendorsAPI({ ...far }, 1, 20)))).total).toBe(0);
    const pickup = required(vendorCardsPageSerializer(await getVendorsAPI({ ...far, pickup: true }, 1, 20)));
    expect(pickup.items.length).toBeGreaterThan(0);
    expect(pickup.items.every(v => v.fulfilment.pickup)).toBe(true);
  });
});

describe("a vendor's page", () => {
  it('quotes delivery to the point, and pick-up', async () => {
    const p = required(vendorPageSerializer(await getVendorPageAPI('biryani-bazaar', GULBERG)));
    expect(p.delivery).toMatchObject({ available: true, outOfZone: false, fee: 99, minOrder: 500 });
    expect(p.pickup?.readyIn.label).toBe('20–30 min');
    expect(p.popular[0]?.name).toBe('Chicken Biryani');
    const far = required(vendorPageSerializer(await getVendorPageAPI('biryani-bazaar', KARACHI)));
    expect(far.delivery).toMatchObject({ available: false, outOfZone: true });
  });

  it('opens a paused vendor with its message, and hides one that is not live', async () => {
    const chai = required(vendorPageSerializer(await getVendorPageAPI('chai-khana-corner', GULBERG)));
    expect(chai).toMatchObject({ paused: true, pauseMessage: 'Back after Asr prayers' });
    expect(chai.openState).toMatchObject({ open: false, paused: true, label: 'Back after Asr prayers' });
    expect((await failure(getVendorPageAPI('ammi-ka-khana', GULBERG).then(raw => required(vendorPageSerializer(raw))))).message).toBe('This vendor is not on Food Court.');
  });

  it('shows a category outside its hours as such, and leaves dishes switched off out', async () => {
    const db = await getDb();
    db.food.items.find(i => i.id === 'mi_tikka')!.override = { isAvailable: false, unavailableUntil: null, dailyLimit: null, remainingToday: null, portionsDate: null };
    const p = required(vendorPageSerializer(await getVendorPageAPI('biryani-bazaar', GULBERG)));
    const bbq = p.menu.find(c => c.name === 'BBQ')!;
    expect(bbq.availableNow).toBe(false);
    expect(bbq.items.find(i => i.name.startsWith('Seekh'))).toMatchObject({ available: false, unavailableReason: 'outside_hours' });
    expect(bbq.items.some(i => i.id === 'mi_tikka')).toBe(false);
  });

  it("marks a home kitchen's sold-out and nearly sold-out dishes, and leaves out other days' dishes", async () => {
    const p = required(vendorPageSerializer(await getVendorPageAPI('nani-ki-handi', GULBERG)));
    const items = p.menu.flatMap(c => c.items);
    expect(items.find(i => i.id === 'mi_nani_qorma')).toMatchObject({ available: true, remainingToday: 6, remainingLabel: '6 left today' });
    expect(items.find(i => i.id === 'mi_nani_daal')).toMatchObject({ available: false, soldOut: true, unavailableReason: 'sold_out' });
    // Pulao is a Friday dish.
    expect(items.some(i => i.id === 'mi_nani_pulao')).toBe(false);
  });
});

describe('the dish sheet and search', () => {
  it('opens a dish with its sizes and groups, an add-on out of stock marked', async () => {
    const db = await getDb();
    db.food.groups.find(g => g.id === 'og_raita')!.options[0].available = false;
    const s = required(itemSheetSerializer(await getItemSheetAPI('mi_chicken_biryani')));
    expect(s.variants.map(v => v.name)).toEqual(['Single', 'Half kg', 'Family (1 kg)']);
    expect(s.groups.map(g => [g.name, g.required])).toEqual([
      ['Spice level', true],
      ['Add raita or salad', false],
      ['Add a drink', false],
    ]);
    expect(s.groups[1].options[0]).toMatchObject({ name: 'Raita', available: false });
    expect((await failure(getItemSheetAPI('mi_qorma').then(raw => required(itemSheetSerializer(raw))))).code).toBe('NOT_FOUND');
  });

  it('finds dishes grouped by kitchen, and kitchens by name or cuisine', async () => {
    const r = required(foodSearchSerializer(await searchFoodAPI('biryani', GULBERG.lat, GULBERG.lng)));
    expect(r.dishes[0].vendor.slug).toBe('biryani-bazaar');
    expect(r.dishes[0].items.map(i => i.name)).toEqual(['Chicken Biryani', 'Beef Biryani', 'Sindhi Biryani']);
    // A kitchen whose dishes match is listed with its dishes; by name, as a kitchen.
    expect((required(foodSearchSerializer(await searchFoodAPI('pizza', GULBERG.lat, GULBERG.lng)))).dishes[0].vendor.slug).toBe('slice-theory');
    expect(slugs((required(foodSearchSerializer(await searchFoodAPI('wok', GULBERG.lat, GULBERG.lng)))).vendors)).toEqual(['golden-wok-house']);
    expect(required(foodSearchSerializer(await searchFoodAPI('sushi', GULBERG.lat, GULBERG.lng)))).toEqual({ vendors: [], dishes: [] });
  });
});
