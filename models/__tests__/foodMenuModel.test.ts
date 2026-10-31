import {
  categoryWindowLabel,
  cutoffLabel,
  daysLabel,
  emptyGroupForm,
  emptyItemForm,
  groupInput,
  groupRuleLabel,
  itemInput,
  itemPriceLabel,
  offUntil,
  validateCategory,
  validateGroup,
  validateItem,
  validateSlots,
  variantsInput,
  type GroupForm,
  type ItemForm,
} from '../food/menuModel';

const dish = (over: Partial<ItemForm> = {}): ItemForm => ({ ...emptyItemForm('mc_1'), name: 'Chicken Biryani', basePrice: '650', ...over });
const group = (over: Partial<GroupForm> = {}): GroupForm => ({
  ...emptyGroupForm(),
  name: 'Spice level',
  minSelect: 1,
  maxSelect: 1,
  options: [
    { name: 'Mild', priceDelta: '0', isDefault: true, isActive: true },
    { name: 'Hot', priceDelta: '0', isDefault: false, isActive: true },
  ],
  ...over,
});

describe('days', () => {
  it('reads a week the way a vendor says it', () => {
    expect(daysLabel([0, 1, 2, 3, 4, 5, 6])).toBe('Every day');
    expect(daysLabel([1, 2, 3, 4, 5])).toBe('Weekdays');
    expect(daysLabel([0, 6])).toBe('Weekends');
    expect(daysLabel([4, 5, 6])).toBe('Thu–Sat');
    expect(daysLabel([1, 3, 5])).toBe('Mon, Wed, Fri');
    expect(daysLabel([5])).toBe('Fri');
  });
});

describe('categories', () => {
  it('takes a window as both times or neither', () => {
    expect(validateCategory({ name: 'BBQ', availableFrom: '', availableTo: '' })).toEqual({});
    expect(validateCategory({ name: 'BBQ', availableFrom: '18:00', availableTo: '' })).toHaveProperty('availableTo');
    expect(validateCategory({ name: 'BBQ', availableFrom: '18:00', availableTo: '18:00' })).toHaveProperty('availableTo');
    expect(validateCategory({ name: '', availableFrom: '', availableTo: '' })).toHaveProperty('name');
    expect(categoryWindowLabel('18:00', '23:30')).toBe('6:00 PM – 11:30 PM');
    expect(categoryWindowLabel(null, null)).toBe('All day');
  });
});

describe('dishes', () => {
  it('needs a name, a price or sizes, and a day', () => {
    expect(validateItem(dish())).toEqual({});
    expect(validateItem(dish({ name: 'A' }))).toHaveProperty('name');
    expect(validateItem(dish({ basePrice: '' }))).toHaveProperty('basePrice');
    expect(validateItem(dish({ days: [] }))).toHaveProperty('days');
    expect(validateItem(dish({ serves: '60' }))).toHaveProperty('serves');
  });

  it('takes sizes in twos or more, each named and priced, no two alike', () => {
    const two = [
      { name: 'Single', price: '650' },
      { name: 'Half kg', price: '1100' },
    ];
    expect(validateItem(dish({ basePrice: '', variants: two }))).toEqual({});
    expect(validateItem(dish({ variants: [two[0]] }))).toHaveProperty('variants');
    expect(validateItem(dish({ variants: [two[0], { name: 'single', price: '700' }] }))).toHaveProperty('variants');
    expect(validateItem(dish({ variants: [two[0], { name: '', price: '' }] }))).toEqual(
      expect.objectContaining({ 'variants.1.name': expect.any(String), 'variants.1.price': expect.any(String) }),
    );
  });

  it('sends the cheapest size as the base price and keeps size ids', () => {
    const f = dish({ variants: [{ id: 'v1', name: 'Half kg', price: '1100' }, { name: 'Single', price: '650' }], days: [5, 1] });
    expect(itemInput(f)).toMatchObject({ basePrice: 650, days: [1, 5], description: null, serves: null });
    expect(variantsInput(f)).toEqual([
      { id: 'v1', name: 'Half kg', price: 1100 },
      { name: 'Single', price: 650 },
    ]);
    expect(itemPriceLabel({ basePrice: 650, variants: [{ id: 'a', name: 'S', price: 650 }, { id: 'b', name: 'L', price: 1100 }] })).toMatch(/^from Rs/);
    expect(itemPriceLabel({ basePrice: 120, variants: [] })).not.toMatch(/from/);
  });
});

describe('add-on groups', () => {
  it('keeps the rule possible: least ≤ most ≤ choices, defaults within most', () => {
    expect(validateGroup(group())).toEqual({});
    expect(validateGroup(group({ minSelect: 2, maxSelect: 1 }))).toHaveProperty('rule');
    expect(validateGroup(group({ maxSelect: 3 }))).toHaveProperty('rule');
    expect(validateGroup(group({ options: group().options.map(o => ({ ...o, isDefault: true })) }))).toHaveProperty('rule');
    expect(validateGroup(group({ options: [] }))).toHaveProperty('options');
  });

  it('says the rule as customers see it', () => {
    expect(groupRuleLabel({ minSelect: 1, maxSelect: 1 })).toBe('Required · pick 1');
    expect(groupRuleLabel({ minSelect: 1, maxSelect: 3 })).toBe('Required · pick 1 to 3');
    expect(groupRuleLabel({ minSelect: 0, maxSelect: 1 })).toBe('Optional · pick 1');
    expect(groupRuleLabel({ minSelect: 0, maxSelect: 4 })).toBe('Optional · up to 4');
    expect(groupInput(group()).options[0]).toEqual({ name: 'Mild', priceDelta: 0, isDefault: true, isActive: true });
  });
});

describe('off for a while, and pre-order slots', () => {
  it('ends an hour or two from now, tomorrow, or never', () => {
    const now = Date.parse('2026-10-15T10:00:00Z');
    expect(offUntil('1h', now, 'T')).toBe('2026-10-15T11:00:00.000Z');
    expect(offUntil('2h', now, 'T')).toBe('2026-10-15T12:00:00.000Z');
    expect(offUntil('today', now, '2026-10-15T19:00:00.000Z')).toBe('2026-10-15T19:00:00.000Z');
    expect(offUntil('manual', now, 'T')).toBeNull();
  });

  it('refuses two slots at the same time and a slot with no room', () => {
    const row = { weekday: 5, slotStart: '13:00', cutoffMinutesBefore: 180, maxOrders: '15' };
    expect(validateSlots([row])).toEqual({});
    expect(validateSlots([row, { ...row }])).toHaveProperty(['1.slotStart']);
    expect(validateSlots([{ ...row, maxOrders: '0' }])).toHaveProperty(['0.maxOrders']);
    expect(cutoffLabel(180)).toBe('3 h before');
    expect(cutoffLabel(1440)).toBe('1 day before');
  });
});
