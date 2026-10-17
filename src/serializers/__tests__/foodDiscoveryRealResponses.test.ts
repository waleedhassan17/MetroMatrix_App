// Real MetroMatrix-API discovery responses (captured from a local backend
// with three live demo vendors, signed out and as a demo customer) through
// the Food discovery serializers.

import real from './fixtures/food/discovery.json';
import {
  foodHomeSerializer,
  foodSearchSerializer,
  itemSheetSerializer,
  vendorCardsPageSerializer,
  vendorPageSerializer,
} from '../food/discoverySerializer';

type Captured = Record<string, { status: number; body: { success: boolean; data?: any; error?: any } }>;
const R = real as unknown as Captured;
const data = (k: string) => R[k].body.data;
const error = (k: string) => R[k].body.error;

describe('the home', () => {
  it('reads coverage, cuisines and the rails as vendor cards', () => {
    const h = foodHomeSerializer(data('home'))!;
    expect(h.coverage).toEqual({ delivering: true, message: null, pickupNearby: 2 });
    expect(h.cuisines.length).toBeGreaterThanOrEqual(18);
    expect(h.cuisines[0]).toMatchObject({ slug: 'pakistani', icon: 'pakistani' });
    const card = h.homeKitchens[0];
    expect(card).toMatchObject({ slug: 'ammi-ka-khana-demo', isHomeKitchen: true, isNew: true, distanceKm: 3.9, deliveryFee: 120, minOrder: 600 });
    expect(card.eta).toEqual({ min: 36, max: 46, label: '36–46 min' });
    expect(card.cuisines.map(c => c.slug)).toEqual(['home-food', 'pakistani']);
  });

  it('says when nothing delivers there, and needs a point', () => {
    expect(foodHomeSerializer(data('homeFar'))!.coverage).toMatchObject({ delivering: false, message: 'Not delivering here yet' });
    expect(R.homeErr.status).toBe(400);
    expect(error('homeErr').details.fields).toHaveProperty('lat');
  });
});

describe('vendor lists', () => {
  it('reads a page of cards: open ones first, with their open state', () => {
    const p = vendorCardsPageSerializer(data('vendors'));
    expect(p).toMatchObject({ total: 2, page: 1, pageSize: 20 });
    expect(p.items[0]).toMatchObject({ slug: 'karachi-biryani-house-demo', ratingAvg: 4.6, ratingCount: 312, deliveryFee: 99, freeDeliveryOver: 2500 });
    expect(p.items[0].openState).toMatchObject({ open: true, paused: false });
    expect(p.items[1].openState.open).toBe(false);
    expect(p.items[1].openState.opensAt).toMatch(/Z$/);
  });

  it('pages, and filters by cuisine and home kitchens', () => {
    expect(vendorCardsPageSerializer(data('vendorsPage2'))).toMatchObject({ page: 2, pageSize: 1, total: 2 });
    expect(vendorCardsPageSerializer(data('vendorsCuisine')).items.every(v => v.cuisines.some(c => c.slug === 'biryani' || c.slug === 'pakistani'))).toBe(true);
    expect(vendorCardsPageSerializer(data('vendorsHome')).items.every(v => v.isHomeKitchen)).toBe(true);
  });
});

describe("a vendor's page", () => {
  it('reads the quote for the point, pick-up, location and the menu', () => {
    const p = vendorPageSerializer(data('vendorPage'))!;
    expect(p.delivery).toMatchObject({ available: true, outOfZone: false, fee: 99, minOrder: 500 });
    expect(p.pickup?.readyIn).toEqual({ min: 20, max: 30, label: '20–30 min' });
    expect(p.location).toMatchObject({ area: 'Gulberg III', city: 'Lahore', lat: 31.5102, phone: '+923001110001' });
    expect(p.acceptsCod).toBe(true);
    const dish = p.menu[0].items[0];
    expect(dish).toMatchObject({ name: 'Chicken Biryani', fromPrice: 650, hasVariants: true, hasOptions: true, available: true, soldOut: false });
    expect(dish.photoUrl).toMatch(/^https:\/\/images\.unsplash\.com\//);
  });

  it('has no delivery quote without a point, and says when it is out of zone', () => {
    expect(vendorPageSerializer(data('vendorPageNoPoint'))!.delivery).toBeNull();
    expect(vendorPageSerializer(data('vendorPageFar'))!.delivery).toMatchObject({ available: false, outOfZone: true });
    expect(error('vendorPageErr')).toMatchObject({ code: 'NOT_FOUND', message: 'This vendor is not on Food Court.' });
  });

  it("reads a home kitchen's portions left", () => {
    expect(vendorPageSerializer(data('vendorPageHome'))!.menu[0].items[0]).toMatchObject({ remainingToday: 20, remainingLabel: null });
  });
});

describe('the dish sheet and search', () => {
  it('reads sizes with the groups each offers, and options out of stock', () => {
    const s = itemSheetSerializer(data('item'))!;
    expect(s.variants.map(v => v.name)).toEqual(['Single', 'Half kg', 'Family (1 kg)', 'Deg (5 kg)']);
    expect(s.variants[0].groupIds).toHaveLength(1);
    expect(s.groups[0]).toMatchObject({ name: 'Add raita or salad', minSelect: 0, maxSelect: 2, required: false, variantId: null });
    expect(s.groups[0].options.find(o => o.name === 'Raita')?.available).toBe(false);
    expect(s.category.name).toBe('Biryani');
  });

  it('reads restaurants and dishes grouped by kitchen', () => {
    const r = foodSearchSerializer(data('search'));
    expect(r.vendors.map(v => v.slug)).toContain('karachi-biryani-house-demo');
    expect(r.dishes[0].items[0]).toMatchObject({ name: 'Chicken Biryani', fromPrice: 650 });
    expect(foodSearchSerializer(data('searchNone'))).toEqual({ vendors: [], dishes: [] });
  });
});
