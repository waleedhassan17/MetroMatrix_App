// Real MetroMatrix-API responses for a Food vendor's menu (captured from a
// local backend: the demo restaurant's categories, dishes with sizes and
// add-on groups, availability; the demo home kitchen's day, weekly menu and
// pre-order slots) through the menu serializers.

import real from './fixtures/food/menu.json';
import {
  menuAvailabilitySerializer,
  menuCategoriesSerializer,
  menuCategorySerializer,
  optionGroupSerializer,
  optionGroupsSerializer,
  preorderSlotsSerializer,
  todayMenuSerializer,
  vendorMenuItemSerializer,
  vendorMenuItemsSerializer,
  weeklyMenuSerializer,
} from '../food/menuSerializer';
import { vendorSetupSerializer, vendorPlanSerializer } from '../food/vendorSerializer';

type Captured = Record<string, { status: number; body: { success: boolean; data?: any; error?: any } }>;
const R = real as unknown as Captured;
const data = (k: string) => R[k].body.data;
const error = (k: string) => R[k].body.error;

describe('categories', () => {
  it('reads a category with a daily window, and the list in order', () => {
    expect(menuCategorySerializer(data('menu.categoryWindow'))).toMatchObject({ name: 'BBQ', availableFrom: '18:00', availableTo: '23:30', isActive: true, itemCount: 0 });
    const list = menuCategoriesSerializer(data('menu.categories'));
    expect(list.map(c => c.name)).toEqual(['Biryani', 'BBQ', 'Cold drinks']);
    expect(list[0]).toMatchObject({ availableFrom: null, availableTo: null, itemCount: 1 });
  });

  it('keeps the refusal to delete a category with dishes', () => {
    expect(R['menu.categoryDeleteErr'].status).toBe(409);
    expect(error('menu.categoryDeleteErr')).toMatchObject({ code: 'CONFLICT', details: { items: 1 } });
  });
});

describe('dishes', () => {
  it('reads a dish with sizes, tags, days and its add-on groups in order', () => {
    const i = vendorMenuItemSerializer(data('menu.item'))!;
    expect(i).toMatchObject({ name: 'Chicken Biryani', basePrice: 650, tags: ['spicy', 'bestseller'], serves: 1, isActive: true, isDeal: false, photoUrl: null });
    expect(i.days).toEqual([0, 1, 2, 3, 4, 5, 6]);
    expect(i.variants.map(v => v.name)).toEqual(['Single', 'Half kg', 'Family (1 kg)', 'Deg (5 kg)']);
    expect(i.optionGroups).toHaveLength(2);
    expect(i.optionGroups[0]).toMatchObject({ variantId: null, sort: 0 });
  });

  it('reads a plain dish on some days, and the whole list', () => {
    expect(vendorMenuItemSerializer(data('menu.itemPlain'))).toMatchObject({ basePrice: 900, days: [4, 5, 6], variants: [], optionGroups: [], serves: null });
    expect(vendorMenuItemsSerializer(data('menu.items')).length).toBeGreaterThanOrEqual(3);
  });

  it('keeps the field of a refused tag', () => {
    expect(error('menu.itemTagErr')).toMatchObject({ code: 'VALIDATION_FAILED', details: { fields: { tags: [expect.any(String)] } } });
  });
});

describe('add-on groups', () => {
  it('reads a required group with a default choice, and an optional one', () => {
    const g = optionGroupSerializer(data('menu.groupRequired'))!;
    expect(g).toMatchObject({ name: 'Spice level', minSelect: 1, maxSelect: 1, required: true, usedByItems: 0 });
    expect(g.options.map(o => [o.name, o.isDefault])).toEqual([
      ['Mild', true],
      ['Medium', false],
      ['Hot', false],
    ]);
    expect(optionGroupSerializer(data('menu.groupPost'))).toMatchObject({ minSelect: 0, maxSelect: 2, required: false });
    expect(optionGroupsSerializer(data('menu.groups')).length).toBe(2);
  });

  it('keeps the field of an impossible rule', () => {
    expect(error('menu.groupErr')).toMatchObject({ code: 'VALIDATION_FAILED', details: { fields: { minSelect: [expect.any(String)] } } });
  });
});

describe('availability', () => {
  it('reads dishes off (some until a time) and add-ons out of stock', () => {
    const a = menuAvailabilitySerializer(data('menu.availabilityPatch'));
    const kebab = a.items.find(i => i.name.startsWith('Seekh'))!;
    expect(kebab).toMatchObject({ isAvailable: false, category: 'BBQ' });
    expect(kebab.unavailableUntil).toMatch(/Z$/);
    expect(a.items.find(i => i.name === 'Soft drink')).toMatchObject({ isAvailable: false, unavailableUntil: null });
    expect(a.options.find(o => o.name === 'Raita')).toMatchObject({ isAvailable: false, group: 'Add raita or salad' });
  });

  it('adds the menu to the go-live checklist and counts dishes on the plan', () => {
    expect(vendorSetupSerializer(data('menu.setupAfter'))!.items.find(i => i.key === 'menu')).toMatchObject({ required: true, done: true });
    expect(vendorPlanSerializer(data('menu.plan'))!.usage.menu_items).toBe(3);
  });
});

describe('a home kitchen’s day', () => {
  it('reads today: portions, sold, and dishes off today’s menu', () => {
    const t = todayMenuSerializer(data('home.todayPatch'))!;
    expect(t).toMatchObject({ date: '2026-10-17', weekday: 6 });
    expect(t.items[0]).toMatchObject({ onTodaysMenu: true, cooking: true, dailyLimit: 20, remainingToday: 20, sold: 0 });
    expect(t.items[1]).toMatchObject({ onTodaysMenu: false, cooking: false, dailyLimit: null, sold: null });
  });

  it('reads pre-order slots and the weekly menu', () => {
    expect(preorderSlotsSerializer(data('home.slotsPut'))).toEqual([
      expect.objectContaining({ weekday: 5, slotStart: '13:00', cutoffMinutesBefore: 180, maxOrders: 15 }),
      expect.objectContaining({ weekday: 5, slotStart: '19:30', cutoffMinutesBefore: 240, maxOrders: 20 }),
    ]);
    expect(weeklyMenuSerializer(data('home.weeklyPut')).map(e => e.days)).toEqual([[0, 1, 2, 3, 4, 5, 6], [5]]);
  });

  it('adds portions and slots to a home kitchen’s checklist', () => {
    const s = vendorSetupSerializer(data('home.setupAfter'))!;
    expect(s.items.map(i => i.key)).toEqual(expect.arrayContaining(['menu', 'portions', 'slots']));
    expect(s.items.find(i => i.key === 'slots')).toMatchObject({ required: false });
  });
});
