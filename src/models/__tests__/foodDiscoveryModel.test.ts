import {
  chooseVariant,
  chosenOptionIds,
  firstProblem,
  groupHint,
  groupsFor,
  initialSelection,
  linePrice,
  toggleOption,
  unavailableLabel,
  unitPrice,
} from '../food/itemSelectionModel';
import { cardLine, closedLabel, cuisineLine, distanceLabel, feeLabel, filtersOf, listQuery, pointOfAddress, priceLevelLabel, ratingLabel, railList } from '../food/discoveryModel';
import type { Address, ItemSheet, VendorCard } from '../../types';

const sheet = (over: Partial<ItemSheet> = {}): ItemSheet => ({
  id: 'mi_1',
  name: 'Chicken Biryani',
  description: null,
  photoUrl: null,
  tags: [],
  isDeal: false,
  serves: 1,
  basePrice: 650,
  fromPrice: 650,
  category: { id: 'c', name: 'Biryani' },
  available: true,
  unavailableReason: null,
  remainingToday: null,
  variants: [
    { id: 'v_half', name: 'Half kg', price: 1100, groupIds: ['g_spice', 'g_raita'] },
    { id: 'v_single', name: 'Single', price: 650, groupIds: ['g_spice', 'g_raita'] },
  ],
  groups: [
    {
      id: 'g_spice',
      name: 'Spice level',
      minSelect: 1,
      maxSelect: 1,
      required: true,
      variantId: null,
      options: [
        { id: 'o_mild', name: 'Mild', priceDelta: 0, isDefault: true, available: true },
        { id: 'o_hot', name: 'Hot', priceDelta: 0, isDefault: false, available: true },
      ],
    },
    {
      id: 'g_raita',
      name: 'Add raita or salad',
      minSelect: 0,
      maxSelect: 2,
      required: false,
      variantId: null,
      options: [
        { id: 'o_raita', name: 'Raita', priceDelta: 60, isDefault: false, available: true },
        { id: 'o_salad', name: 'Salad', priceDelta: 80, isDefault: false, available: true },
        { id: 'o_mint', name: 'Mint chutney', priceDelta: 30, isDefault: false, available: false },
      ],
    },
    {
      id: 'g_deg',
      name: 'Deg extras',
      minSelect: 1,
      maxSelect: 1,
      required: true,
      variantId: 'v_half',
      options: [{ id: 'o_box', name: 'Serving box', priceDelta: 100, isDefault: false, available: true }],
    },
  ],
  ...over,
});

describe('the dish sheet', () => {
  it('starts on the cheapest size with in-stock defaults ticked', () => {
    const s = initialSelection(sheet());
    expect(s).toMatchObject({ variantId: 'v_single', quantity: 1, note: '' });
    expect(s.options.g_spice).toEqual(['o_mild']);
    expect(unitPrice(sheet(), s)).toBe(650);
  });

  it('offers a size its own groups, and keeps choices in groups it still offers', () => {
    const sh = sheet();
    let s = initialSelection(sh);
    s = toggleOption(sh, s, 'g_spice', 'o_hot');
    expect(groupsFor(sh, 'v_single').map(g => g.id)).toEqual(['g_spice', 'g_raita']);
    s = chooseVariant(sh, s, 'v_half');
    expect(groupsFor(sh, 'v_half').map(g => g.id)).toEqual(['g_spice', 'g_raita', 'g_deg']);
    expect(s.options.g_spice).toEqual(['o_hot']);
    expect(firstProblem(sh, s)).toEqual({ groupId: 'g_deg', message: 'Choose deg extras for Chicken Biryani.' });
  });

  it('swaps in a pick-one group, stops at a group’s most, and ignores out-of-stock choices', () => {
    const sh = sheet();
    let s = initialSelection(sh);
    s = toggleOption(sh, s, 'g_spice', 'o_hot');
    expect(s.options.g_spice).toEqual(['o_hot']);
    s = toggleOption(sh, s, 'g_raita', 'o_raita');
    s = toggleOption(sh, s, 'g_raita', 'o_salad');
    expect(toggleOption(sh, s, 'g_raita', 'o_mint')).toBe(s);
    expect(s.options.g_raita).toEqual(['o_raita', 'o_salad']);
    expect(unitPrice(sh, s)).toBe(650 + 60 + 80);
    expect(linePrice(sh, { ...s, quantity: 3 })).toBe((650 + 140) * 3);
    expect(chosenOptionIds(sh, s)).toEqual(['o_hot', 'o_raita', 'o_salad']);
  });

  it('names the first unmet rule the way the API does', () => {
    const sh = sheet();
    const s = { ...initialSelection(sh), options: {} };
    expect(firstProblem(sh, s)?.message).toBe('Choose spice level for Chicken Biryani.');
    expect(firstProblem(sh, { ...initialSelection(sh), variantId: null })?.message).toBe('Choose a size for Chicken Biryani.');
    expect(firstProblem({ ...sh, remainingToday: 2 }, { ...initialSelection(sh), quantity: 3 })?.message).toBe('Only 2 left today.');
    expect(firstProblem(sh, initialSelection(sh))).toBeNull();
  });

  it('says rules and reasons plainly', () => {
    expect(groupHint({ minSelect: 1, maxSelect: 1 })).toBe('Required · pick 1');
    expect(groupHint({ minSelect: 0, maxSelect: 2 })).toBe('Optional · up to 2');
    expect(unavailableLabel('sold_out')).toBe('Sold out today');
    expect(unavailableLabel('outside_hours', '18:00')).toBe('Served from 6:00 PM');
    expect(unavailableLabel(null)).toBeNull();
  });
});

const card = (over: Partial<VendorCard> = {}): VendorCard => ({
  id: 'fb',
  slug: 'biryani-bazaar',
  name: 'Biryani Bazaar',
  tagline: null,
  logoUrl: null,
  coverUrl: null,
  brandColor: '#B45309',
  onBrandColor: '#FFFFFF',
  cuisines: [
    { name: 'Pakistani', slug: 'pakistani' },
    { name: 'Biryani', slug: 'biryani' },
  ],
  priceLevel: 2,
  ratingAvg: 4.6,
  ratingCount: 312,
  isHomeKitchen: false,
  isFeatured: false,
  isNew: false,
  distanceKm: 0.7,
  eta: { min: 27, max: 37, label: '27–37 min' },
  deliveryFee: 99,
  minOrder: 500,
  freeDeliveryOver: null,
  dealLabel: null,
  fulfilment: { delivery: true, pickup: true },
  preorderOnly: false,
  openState: { open: true, paused: false, label: 'Open until 2:00 AM', opensAt: null },
  ...over,
});

describe('vendor cards and lists', () => {
  it('says time, fee and distance; free delivery as such; ratings or New', () => {
    expect(cardLine(card())).toBe('27–37 min · Rs 99 delivery · 700 m');
    expect(cardLine(card({ distanceKm: 2.34, deliveryFee: 0 }))).toBe('27–37 min · Free delivery · 2.3 km');
    expect(cardLine(card(), true)).toBe('Ready in 27–37 min · Pick-up · 700 m');
    expect(feeLabel({ deliveryFee: 0 })).toBe('Free delivery');
    expect(ratingLabel(card())).toBe('4.6 (312)');
    expect(ratingLabel(card({ ratingCount: 0 }))).toBe('New');
    expect(cuisineLine(card())).toBe('Pakistani · Biryani · Rs Rs');
    expect(priceLevelLabel(3)).toBe('Rs Rs Rs');
    expect(distanceLabel(null)).toBeNull();
    expect(closedLabel(card())).toBeNull();
    expect(closedLabel(card({ openState: { open: false, paused: false, label: 'Opens 6:00 PM', opensAt: null } }))).toBe('Opens 6:00 PM');
  });

  it('builds the list query from a rail preset, a sort and filter chips', () => {
    expect(railList('fastest')).toEqual({ sort: 'delivery_time', openNow: true });
    expect(filtersOf(railList('topRated'))).toEqual(['rating4']);
    expect(listQuery({ lat: 31.5, lng: 74.3 }, { cuisine: 'biryani' }, 'rating', ['freeDelivery', 'pickup'])).toEqual({
      cuisine: 'biryani',
      lat: 31.5,
      lng: 74.3,
      sort: 'rating',
      freeDelivery: true,
      pickup: true,
    });
  });

  it('delivers only to addresses with a map pin', () => {
    const a: Address = { id: 'a1', label: 'home', fullName: 'A', phone: '+923001234567', city: 'Lahore', area: 'Gulberg III', line1: 'House 12', landmark: null, lat: 31.5, lng: 74.3, isDefault: true };
    expect(pointOfAddress(a)).toEqual({ lat: 31.5, lng: 74.3, label: 'Home · Gulberg III', addressId: 'a1' });
    expect(pointOfAddress({ ...a, lat: null })).toBeNull();
  });
});
