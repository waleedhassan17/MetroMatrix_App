// The dummy Food menu API, driven through the REAL menu networks: dishes with
// sizes and add-on groups, categories that refuse to go while they hold
// dishes, a copy that starts hidden, dishes off until a time, a home
// kitchen's portions (reset each day), the weekly menu and pre-order slots,
// and the menu step of the go-live checklist.

import {
  createMenuCategoryAPI,
  createMenuItemAPI,
  createOptionGroupAPI,
  deleteMenuCategoryAPI,
  deleteMenuItemAPI,
  deleteOptionGroupAPI,
  duplicateMenuItemAPI,
  getMenuItemAPI,
  getMenuItemsAPI,
  saveItemGroupsAPI,
  saveItemVariantsAPI,
} from '../../../food/vendor/menuNetwork';
import { getAvailabilityAPI, getPreorderSlotsAPI, getTodayAPI, savePreorderSlotsAPI, saveWeeklyMenuAPI, setAvailabilityAPI, setTodayAPI } from '../../../food/vendor/availabilityNetwork';
import { getVendorSetupAPI } from '../../../food/vendor/setupNetwork';
import { getVendorPlanAPI } from '../../../food/vendor/planNetwork';
import { ApiError, required } from '../../apiHelpers';
import { clearTokens } from '../../../../utils/storage_utils/storageUtils';
import { getDb, resetMockDb } from '../mockDb';
import { signInAs, installDummyApi } from '../testing';
import { vendorPlanSerializer, vendorSetupSerializer } from '../../../../serializers/food/vendorSerializer';
import { menuCategorySerializer, optionGroupSerializer, vendorMenuItemSerializer, vendorMenuItemsSerializer, menuAvailabilitySerializer, todayMenuSerializer, weeklyMenuSerializer, preorderSlotsSerializer } from '../../../../serializers/food/menuSerializer';

installDummyApi();

// Thursday 15 October 2026, 3 PM in Pakistan.
const T0 = new Date('2026-10-15T10:00:00Z').getTime();
const HOUR = 3_600_000;

const failure = async (p: Promise<unknown>): Promise<ApiError> => {
  try {
    await p;
  } catch (e) {
    return e as ApiError;
  }
  throw new Error('expected the call to fail');
};

const signIn = async (email: string) => {
  await clearTokens();
  await signInAs(email);
};

const dish = { description: null, photoUrl: null, tags: [], isDeal: false, serves: null, days: [0, 1, 2, 3, 4, 5, 6], isActive: true };

beforeAll(() => {
  jest.useFakeTimers({ doNotFake: ['setTimeout', 'setInterval', 'setImmediate', 'nextTick', 'queueMicrotask'] });
});
afterAll(() => jest.useRealTimers());

beforeEach(async () => {
  jest.setSystemTime(T0);
  await resetMockDb();
});

describe('dishes and add-ons', () => {
  it('adds a dish with sizes and add-on groups, and counts it on the plan', async () => {
    await signIn('cloudkitchen@metromatrix.app');
    const before = (required(vendorPlanSerializer(await getVendorPlanAPI()))).usage.menu_items;
    const c = required(menuCategorySerializer(await createMenuCategoryAPI({ name: 'Wraps', availableFrom: null, availableTo: null })));
    const g = required(optionGroupSerializer(await createOptionGroupAPI({
      name: 'Choose a sauce',
      minSelect: 1,
      maxSelect: 1,
      options: [
        { name: 'Garlic', priceDelta: 0, isDefault: true, isActive: true },
        { name: 'Chilli', priceDelta: 30, isDefault: false, isActive: true },
      ],
    })));
    expect(g).toMatchObject({ required: true, usedByItems: 0 });
    let item = required(vendorMenuItemSerializer(await createMenuItemAPI({ ...dish, categoryId: c.id, name: 'Chicken wrap', basePrice: 550, tags: ['spicy'] }, [
      { name: 'Regular', price: 550 },
      { name: 'Large', price: 750 },
    ])));
    item = required(vendorMenuItemSerializer(await saveItemGroupsAPI(item.id, [{ groupId: g.id }])));
    expect(item.variants.map(v => v.name)).toEqual(['Regular', 'Large']);
    expect(item.optionGroups).toEqual([{ groupId: g.id, variantId: null, sort: 0 }]);
    // Sizes keep their ids when edited; a dropped size is gone.
    item = required(vendorMenuItemSerializer(await saveItemVariantsAPI(item.id, [{ id: item.variants[1].id, name: 'Large', price: 790 }])));
    expect(item.variants).toEqual([expect.objectContaining({ name: 'Large', price: 790 })]);
    expect((required(vendorPlanSerializer(await getVendorPlanAPI()))).usage.menu_items).toBe(before + 1);
  });

  it('refuses an impossible add-on rule and an unknown tag', async () => {
    await signIn('restaurant@metromatrix.app');
    const e = await failure(createOptionGroupAPI({ name: 'Bad', minSelect: 2, maxSelect: 1, options: [{ name: 'A', priceDelta: 0, isDefault: false, isActive: true }] }).then(raw => required(optionGroupSerializer(raw))));
    expect(e.code).toBe('VALIDATION_FAILED');
    expect(e.details?.fields).toHaveProperty('minSelect');
    const t = await failure(createMenuItemAPI({ ...dish, categoryId: 'mc_resto_biryani', name: 'Odd', basePrice: 100, tags: ['halal' as never] }, []).then(raw => required(vendorMenuItemSerializer(raw))));
    expect(t.details?.fields).toHaveProperty('tags');
  });

  it('keeps a category while it has dishes; a copy starts hidden; deleting a group takes it off dishes', async () => {
    await signIn('restaurant@metromatrix.app');
    const e = await failure(deleteMenuCategoryAPI('mc_resto_breads').then(() => true as const));
    expect(e.code).toBe('CONFLICT');
    expect(e.details?.items).toBe(2);
    const copy = required(vendorMenuItemSerializer(await duplicateMenuItemAPI('mi_chicken_biryani')));
    expect(copy).toMatchObject({ name: 'Chicken Biryani (copy)', isActive: false });
    expect(copy.variants).toHaveLength(3);
    expect(copy.optionGroups.map(l => l.groupId)).toEqual(['og_spice', 'og_raita', 'og_drink']);
    await deleteOptionGroupAPI('og_drink');
    expect((required(vendorMenuItemSerializer(await getMenuItemAPI('mi_chicken_biryani')))).optionGroups.map(l => l.groupId)).toEqual(['og_spice', 'og_raita']);
    await deleteMenuItemAPI('mi_naan');
    await deleteMenuItemAPI('mi_roghni');
    await deleteMenuCategoryAPI('mc_resto_breads');
    expect((required(vendorMenuItemsSerializer(await getMenuItemsAPI()))).some(i => i.categoryId === 'mc_resto_breads')).toBe(false);
  });
});

describe('what can be ordered now', () => {
  it('switches a dish off until a time; it comes back on its own', async () => {
    await signIn('restaurant@metromatrix.app');
    const until = new Date(T0 + 2 * HOUR).toISOString();
    const a = required(menuAvailabilitySerializer(await setAvailabilityAPI({ items: [{ itemId: 'mi_seekh', isAvailable: false, unavailableUntil: until }], options: [{ optionId: 'og_raita_1', isAvailable: false }] })));
    expect(a.items.find(i => i.itemId === 'mi_seekh')).toMatchObject({ isAvailable: false, unavailableUntil: until });
    expect(a.options.find(o => o.optionId === 'og_raita_1')?.isAvailable).toBe(false);
    jest.setSystemTime(T0 + 2 * HOUR + 1);
    expect((required(menuAvailabilitySerializer(await getAvailabilityAPI()))).items.find(i => i.itemId === 'mi_seekh')).toMatchObject({ isAvailable: true, unavailableUntil: null });
  });

  it('switches a dish off until the vendor switches it back', async () => {
    await signIn('restaurant@metromatrix.app');
    await setAvailabilityAPI({ items: [{ itemId: 'mi_soft', isAvailable: false }] });
    jest.setSystemTime(T0 + 48 * HOUR);
    expect((required(menuAvailabilitySerializer(await getAvailabilityAPI()))).items.find(i => i.itemId === 'mi_soft')?.isAvailable).toBe(false);
  });
});

describe("a home kitchen's day", () => {
  it('sets portions (what is left resets) and takes a dish off for today', async () => {
    await signIn('homekitchen@metromatrix.app');
    // Thursday: qorma and aloo keema are on; daal (Mon/Wed/Fri) is not.
    const t = required(todayMenuSerializer(await getTodayAPI()));
    expect(t.weekday).toBe(4);
    expect(t.items.find(i => i.itemId === 'mi_daal')?.onTodaysMenu).toBe(false);
    const after = required(todayMenuSerializer(await setTodayAPI([
      { itemId: 'mi_qorma', portions: 30 },
      { itemId: 'mi_aloo_keema', cooking: false },
    ])));
    expect(after.items.find(i => i.itemId === 'mi_qorma')).toMatchObject({ dailyLimit: 30, remainingToday: 30, sold: 0 });
    expect(after.items.find(i => i.itemId === 'mi_aloo_keema')?.cooking).toBe(false);
  });

  it('resets what is left to the day’s portions on a new day', async () => {
    await signIn('homekitchen@metromatrix.app');
    await setTodayAPI([{ itemId: 'mi_qorma', portions: 20 }]);
    const db = await getDb();
    db.food.items.find(i => i.id === 'mi_qorma')!.override!.remainingToday = 3;
    expect((required(todayMenuSerializer(await getTodayAPI()))).items.find(i => i.itemId === 'mi_qorma')).toMatchObject({ remainingToday: 3, sold: 17 });
    jest.setSystemTime(T0 + 24 * HOUR);
    expect((required(todayMenuSerializer(await getTodayAPI()))).items.find(i => i.itemId === 'mi_qorma')).toMatchObject({ dailyLimit: 20, remainingToday: 20, sold: 0 });
  });

  it('saves the weekly menu and pre-order slots; slots are for home kitchens only', async () => {
    await signIn('homekitchen@metromatrix.app');
    const week = required(weeklyMenuSerializer(await saveWeeklyMenuAPI([{ itemId: 'mi_pulao', days: [5, 0] }])));
    expect(week.find(e => e.itemId === 'mi_pulao')?.days).toEqual([0, 5]);
    expect((await failure(savePreorderSlotsAPI([{ weekday: 5, slotStart: '13:00', cutoffMinutesBefore: 180, maxOrders: 10 }, { weekday: 5, slotStart: '13:00', cutoffMinutesBefore: 60, maxOrders: 5 }]).then(raw => required(preorderSlotsSerializer(raw))))).message).toBe(
      'Two slots at the same time.',
    );
    await savePreorderSlotsAPI([{ weekday: 5, slotStart: '13:00', cutoffMinutesBefore: 180, maxOrders: 10 }]);
    expect(required(preorderSlotsSerializer(await getPreorderSlotsAPI()))).toEqual([expect.objectContaining({ weekday: 5, slotStart: '13:00', maxOrders: 10 })]);
    await signIn('restaurant@metromatrix.app');
    expect((await failure(savePreorderSlotsAPI([]).then(raw => required(preorderSlotsSerializer(raw))))).message).toBe('Pre-order slots are for home kitchens.');
  });

  it('puts the menu and portions on the checklist', async () => {
    await signIn('homekitchen@metromatrix.app');
    const s = required(vendorSetupSerializer(await getVendorSetupAPI()));
    expect(s.items.find(i => i.key === 'menu')).toMatchObject({ required: true, done: true });
    expect(s.items.find(i => i.key === 'portions')).toMatchObject({ required: true, done: true });
    expect(s.items.find(i => i.key === 'slots')).toMatchObject({ required: false });
  });
});
