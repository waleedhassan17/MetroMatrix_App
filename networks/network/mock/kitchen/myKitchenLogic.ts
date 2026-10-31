// ═══════════════════════════════════════════════════════
// MetroMatrix — Dummy My Kitchen (5C): the customer's pantry, recipe ideas,
// missing items from Shopping, and their own nutrition
// ═══════════════════════════════════════════════════════
// A pantry in base units with expiry ("use soon" within three days), a
// small library of home recipes in English and Urdu ranked by what is in
// the pantry and what expires first, the missing ingredients priced per kilo,
// litre or piece from Shopping's grocers, a calorie target worked out from
// the person's own numbers, and a week of what they ordered on Food Court.
// None of it ever reaches a kitchen. TODO(API_KITCHEN): §4.7, TODO(API_AI).

import type { MockDb } from '../mockDb';
import type { MockFoodVendor } from '../food/foodTypes';
import { addDays, dateInZone } from '../../../../utils/healthTime';
import { pricePerUnit, type BaseUnit } from '../../../../utils/units';
import type { MockNutritionSettings, MockPantryItem } from './kitchenTypes';
import { CANON } from './kitchenSeed';
import { k } from './kitchenLogic';
import { nutritionOf } from './assistantLogic';

const TZ = 'Asia/Karachi';
export const USE_SOON_DAYS = 3;
export const todayPk = (now: number) => dateInZone(new Date(now).toISOString(), TZ);

// ── Words ──
/** An ingredient's name in the person's language (Urdu from the aliases staff keep). */
export const ingredientName = (db: MockDb, key: string, language: 'en' | 'ur') =>
  (language === 'ur' ? k(db).aliases.find(a => a.key === key && a.language === 'ur')?.word : null) ?? CANON[key]?.name ?? key;

/** A typed or spoken name → its canonical key (any language), or null. */
export const keyOfName = (db: MockDb, name: string) => {
  const n = name.trim().toLowerCase();
  if (CANON[n]) return n;
  const exact = k(db).aliases.find(a => a.word.toLowerCase() === n);
  if (exact) return exact.key;
  const byName = Object.entries(CANON).find(([, c]) => c.name.toLowerCase() === n || c.name.toLowerCase().startsWith(`${n} `) || c.name.toLowerCase().startsWith(`${n} (`));
  return byName?.[0] ?? null;
};

/** How long a fresh thing keeps when nobody says (days); null: it keeps. */
export const shelfDays = (key: string | null) => {
  const c = key ? CANON[key] : null;
  if (!c) return null;
  if (c.category === 'meat_poultry') return 2;
  if (c.category === 'dairy') return 4;
  if (c.category === 'vegetables' || c.category === 'fruit') return 7;
  return null;
};

// ── The pantry ──
export type PantryState = 'fresh' | 'use_soon' | 'expired';

export const pantryState = (p: Pick<MockPantryItem, 'expiresOn'>, today: string): PantryState =>
  !p.expiresOn ? 'fresh' : p.expiresOn < today ? 'expired' : p.expiresOn <= addDays(today, USE_SOON_DAYS) ? 'use_soon' : 'fresh';

export const pantryOf = (db: MockDb, userId: string) => (k(db).pantry ?? []).filter(p => p.userId === userId && p.status === 'in');

export const pantryWire = (p: MockPantryItem, today: string) => ({
  id: p.id,
  name: p.name,
  key: p.key,
  qty: p.qty,
  unit: p.unit,
  expiresOn: p.expiresOn,
  state: pantryState(p, today),
  source: p.source,
  addedAt: p.addedAt,
});

// ── Recipes ──
interface RecipeDef {
  id: string;
  title: { en: string; ur: string };
  /** The word Food Court menus use for the dish ("Order it nearby"), in English. */
  searchTerm: string;
  minutes: number;
  servings: number;
  /** Base units for `servings`. Salt is assumed in every kitchen. */
  lines: [key: string, qty: number][];
  steps: { en: string[]; ur: string[] };
}

export const RECIPES: RecipeDef[] = [
  {
    id: 'rc_aloo_keema',
    title: { en: 'Aloo keema', ur: 'آلو قیمہ' },
    searchTerm: 'keema',
    minutes: 40,
    servings: 4,
    lines: [['beef_mince', 500], ['potato', 400], ['onion', 200], ['tomato', 200], ['ginger_garlic', 30], ['red_chilli', 10], ['garam_masala', 5], ['oil', 60], ['green_chilli', 20], ['coriander', 20]],
    steps: {
      en: ['Fry the sliced onion in oil until golden.', 'Add ginger garlic paste and the keema; cook until it browns.', 'Add tomatoes, red chilli and salt; cook until the oil separates.', 'Add the potatoes and a cup of water; cover and cook 15 minutes.', 'Finish with garam masala, green chillies and coriander.'],
      ur: ['پیاز کو تیل میں سنہری ہونے تک بھونیں۔', 'ادرک لہسن اور قیمہ ڈال کر بھونیں۔', 'ٹماٹر، لال مرچ اور نمک ڈال کر تیل الگ ہونے تک پکائیں۔', 'آلو اور ایک کپ پانی ڈال کر ڈھک کر پندرہ منٹ پکائیں۔', 'آخر میں گرم مصالحہ، ہری مرچ اور دھنیا ڈالیں۔'],
    },
  },
  {
    id: 'rc_daal_chawal',
    title: { en: 'Daal chawal', ur: 'دال چاول' },
    searchTerm: 'daal',
    minutes: 45,
    servings: 4,
    lines: [['masoor_daal', 250], ['rice', 400], ['onion', 100], ['tomato', 150], ['ginger_garlic', 20], ['red_chilli', 6], ['ghee', 40]],
    steps: {
      en: ['Wash the daal and boil it with salt and red chilli until soft.', 'Boil the rice separately and drain.', 'Fry onion and ginger garlic in ghee, add tomatoes and cook down.', 'Pour the tarka over the daal and serve with the rice.'],
      ur: ['دال دھو کر نمک اور لال مرچ کے ساتھ گلنے تک ابالیں۔', 'چاول الگ ابال کر پانی نکال دیں۔', 'گھی میں پیاز اور ادرک لہسن بھونیں، ٹماٹر ڈال کر پکائیں۔', 'تڑکا دال پر ڈالیں اور چاول کے ساتھ پیش کریں۔'],
    },
  },
  {
    id: 'rc_chicken_karahi',
    title: { en: 'Chicken karahi', ur: 'چکن کڑاہی' },
    searchTerm: 'karahi',
    minutes: 45,
    servings: 4,
    lines: [['chicken', 1000], ['tomato', 500], ['ginger_garlic', 40], ['green_chilli', 30], ['oil', 100], ['red_chilli', 10], ['black_pepper', 4], ['coriander', 20]],
    steps: {
      en: ['Fry the chicken in oil on high heat until it whitens.', 'Add ginger garlic paste and the chopped tomatoes.', 'Cook covered until the tomatoes melt, then uncover and dry the gravy.', 'Add red chilli, black pepper and salt; cook until the oil separates.', 'Top with green chillies and coriander.'],
      ur: ['تیز آنچ پر چکن کو تیل میں سفید ہونے تک بھونیں۔', 'ادرک لہسن اور کٹے ٹماٹر ڈالیں۔', 'ڈھک کر ٹماٹر گلنے تک پکائیں، پھر کھول کر شوربہ خشک کریں۔', 'لال مرچ، کالی مرچ اور نمک ڈال کر تیل الگ ہونے تک پکائیں۔', 'ہری مرچ اور دھنیا سے سجائیں۔'],
    },
  },
  {
    id: 'rc_aloo_paratha',
    title: { en: 'Aloo paratha with dahi', ur: 'آلو پراٹھا دہی کے ساتھ' },
    searchTerm: 'paratha',
    minutes: 35,
    servings: 4,
    lines: [['atta', 500], ['potato', 500], ['green_chilli', 15], ['coriander', 20], ['ghee', 80], ['red_chilli', 5], ['yoghurt', 400]],
    steps: {
      en: ['Knead the atta into a soft dough and rest it.', 'Boil and mash the potatoes with chilli, coriander and salt.', 'Fill each dough ball with potato and roll it out.', 'Cook on a hot tawa with ghee until both sides are golden.', 'Serve with dahi.'],
      ur: ['آٹا گوندھ کر کچھ دیر رکھ دیں۔', 'آلو ابال کر مرچ، دھنیا اور نمک کے ساتھ مسل لیں۔', 'پیڑے میں آلو بھر کر بیل لیں۔', 'گرم توے پر گھی کے ساتھ دونوں طرف سنہری کریں۔', 'دہی کے ساتھ پیش کریں۔'],
    },
  },
  {
    id: 'rc_anda_bhurji',
    title: { en: 'Anda bhurji', ur: 'انڈا بھرجی' },
    searchTerm: 'bhurji',
    minutes: 15,
    servings: 2,
    lines: [['egg', 4], ['onion', 100], ['tomato', 100], ['green_chilli', 10], ['oil', 20]],
    steps: {
      en: ['Fry the onion until soft.', 'Add tomatoes, green chilli and salt; cook two minutes.', 'Add the beaten eggs and stir until just set.'],
      ur: ['پیاز نرم ہونے تک بھونیں۔', 'ٹماٹر، ہری مرچ اور نمک ڈال کر دو منٹ پکائیں۔', 'پھینٹے ہوئے انڈے ڈال کر ہلاتے رہیں۔'],
    },
  },
  {
    id: 'rc_kheer',
    title: { en: 'Kheer', ur: 'کھیر' },
    searchTerm: 'kheer',
    minutes: 60,
    servings: 6,
    lines: [['milk', 1500], ['rice', 100], ['sugar', 150], ['almonds', 30], ['cardamom', 3]],
    steps: {
      en: ['Soak the rice for 30 minutes.', 'Boil the milk with cardamom, add the rice and cook slowly, stirring.', 'When thick, add sugar and almonds; cook five minutes more.', 'Serve warm or cold.'],
      ur: ['چاول آدھا گھنٹہ بھگو دیں۔', 'دودھ میں الائچی ڈال کر ابالیں، چاول ڈال کر ہلکی آنچ پر پکائیں۔', 'گاڑھا ہونے پر چینی اور بادام ڈال کر پانچ منٹ پکائیں۔', 'گرم یا ٹھنڈی پیش کریں۔'],
    },
  },
  {
    id: 'rc_chicken_pulao',
    title: { en: 'Chicken pulao', ur: 'چکن پلاؤ' },
    searchTerm: 'pulao',
    minutes: 60,
    servings: 4,
    lines: [['chicken', 750], ['rice', 500], ['onion', 200], ['yoghurt', 150], ['ginger_garlic', 30], ['garam_masala', 6], ['oil', 80]],
    steps: {
      en: ['Brown the onion in oil and add the chicken with ginger garlic.', 'Add yoghurt, garam masala and salt; cook until tender.', 'Add soaked rice and water to a finger above it.', 'Cook on high until the water dries, then on dum for 15 minutes.'],
      ur: ['تیل میں پیاز سنہری کریں اور ادرک لہسن کے ساتھ چکن ڈالیں۔', 'دہی، گرم مصالحہ اور نمک ڈال کر گلنے تک پکائیں۔', 'بھیگے چاول اور ایک انگلی اوپر تک پانی ڈالیں۔', 'پانی خشک ہونے تک تیز آنچ پر، پھر پندرہ منٹ دم پر رکھیں۔'],
    },
  },
  {
    id: 'rc_aloo_bhujia',
    title: { en: 'Aloo ki bhujia', ur: 'آلو کی بھجیا' },
    searchTerm: 'bhujia',
    minutes: 25,
    servings: 3,
    lines: [['potato', 600], ['onion', 150], ['tomato', 150], ['red_chilli', 6], ['oil', 40], ['coriander', 10]],
    steps: {
      en: ['Fry the onion, add tomatoes, red chilli and salt.', 'Add the cubed potatoes and a little water.', 'Cover and cook until soft; finish with coriander.'],
      ur: ['پیاز بھونیں، ٹماٹر، لال مرچ اور نمک ڈالیں۔', 'کٹے ہوئے آلو اور تھوڑا پانی ڈالیں۔', 'ڈھک کر نرم ہونے تک پکائیں، دھنیا ڈالیں۔'],
    },
  },
  {
    id: 'rc_kheera_raita',
    title: { en: 'Kheera raita', ur: 'کھیرے کا رائتہ' },
    searchTerm: 'raita',
    minutes: 10,
    servings: 4,
    lines: [['yoghurt', 500], ['cucumber', 200], ['mint', 10]],
    steps: {
      en: ['Whisk the yoghurt with salt.', 'Grate the cucumber, squeeze it and stir it in.', 'Add chopped mint and chill.'],
      ur: ['دہی میں نمک ڈال کر پھینٹ لیں۔', 'کھیرا کدوکش کر کے نچوڑیں اور ملا دیں۔', 'کٹا پودینہ ڈال کر ٹھنڈا کریں۔'],
    },
  },
];

const PER: Record<'g100' | 'ml100' | 'piece', number> = { g100: 100, ml100: 100, piece: 1 };

/** A serving's nutrition from the nutrition foods (rounded). */
export const recipeNutrition = (db: MockDb, r: RecipeDef) => {
  const sum = { kcal: 0, protein: 0, carbs: 0, fat: 0 };
  for (const [key, qty] of r.lines) {
    const f = k(db).nutritionFoods.find(x => x.key === key);
    if (!f) continue;
    const m = qty / r.servings / PER[f.per];
    sum.kcal += f.kcal * m;
    sum.protein += f.protein * m;
    sum.carbs += f.carbs * m;
    sum.fat += f.fat * m;
  }
  return { kcal: Math.round(sum.kcal), protein: Math.round(sum.protein), carbs: Math.round(sum.carbs), fat: Math.round(sum.fat) };
};

export const recipeById = (id: string) => RECIPES.find(r => r.id === id) ?? null;

/** What the pantry has of a recipe, what's missing, and what expires soonest. */
export const recipeFit = (db: MockDb, userId: string, r: RecipeDef, today: string) => {
  const pantry = pantryOf(db, userId).filter(p => pantryState(p, today) !== 'expired');
  const have = r.lines.filter(([key]) => pantry.some(p => p.key === key)).map(([key]) => key);
  const missing = r.lines.filter(([key]) => !have.includes(key)).map(([key]) => key);
  const expiring = have.filter(key => pantry.some(p => p.key === key && pantryState(p, today) === 'use_soon'));
  return { have, missing, expiring };
};

export const suggestRecipes = (db: MockDb, userId: string, q: { language: 'en' | 'ur'; maxMinutes: number | null; servings: number | null }, now: number) => {
  const today = todayPk(now);
  return RECIPES.filter(r => !q.maxMinutes || r.minutes <= q.maxMinutes)
    .map(r => ({ r, fit: recipeFit(db, userId, r, today) }))
    .filter(x => x.fit.have.length > 0)
    .sort((a, b) => b.fit.expiring.length - a.fit.expiring.length || a.fit.missing.length - b.fit.missing.length || a.r.minutes - b.r.minutes)
    .slice(0, 6)
    .map(({ r, fit }) => ({
      id: r.id,
      title: r.title[q.language],
      searchTerm: r.searchTerm,
      minutes: r.minutes,
      servings: q.servings ?? r.servings,
      have: fit.have.map(key => ingredientName(db, key, q.language)),
      missing: fit.missing.map(key => ingredientName(db, key, q.language)),
      usesExpiring: fit.expiring.map(key => ingredientName(db, key, q.language)),
      nutrition: recipeNutrition(db, r),
    }));
};

export const recipeWire = (db: MockDb, userId: string, r: RecipeDef, language: 'en' | 'ur', servings: number | null, now: number) => {
  const fit = recipeFit(db, userId, r, todayPk(now));
  const scale = (servings ?? r.servings) / r.servings;
  return {
    id: r.id,
    title: r.title[language],
    searchTerm: r.searchTerm,
    language,
    minutes: r.minutes,
    servings: servings ?? r.servings,
    ingredients: r.lines.map(([key, qty]) => ({
      key,
      name: ingredientName(db, key, language),
      qty: Math.round(qty * scale * 10) / 10,
      unit: (CANON[key]?.base ?? 'g') as BaseUnit,
      have: fit.have.includes(key),
      usesExpiring: fit.expiring.includes(key),
    })),
    steps: r.steps[language],
    nutrition: recipeNutrition(db, r),
  };
};

/** Shopping's grocery packs for each missing ingredient, cheapest per kilo, litre or piece first. */
export const missingItems = (db: MockDb, userId: string, r: RecipeDef, servings: number | null, now: number) => {
  const fit = recipeFit(db, userId, r, todayPk(now));
  const scale = (servings ?? r.servings) / r.servings;
  return fit.missing.map(key => {
    const need = (r.lines.find(([x]) => x === key)?.[1] ?? 0) * scale;
    const unit = (CANON[key]?.base ?? 'g') as BaseUnit;
    const options = db.shop.products
      .filter(p => p.ingredientKey === key && p.status === 'active' && !p.removed && p.netQuantity)
      .map(p => {
        const store = db.shop.stores.find(s => s.id === p.storeId);
        const price = p.salePrice ?? p.price;
        const v = p.variants[0];
        return {
          productId: p.id,
          variantId: v?.id ?? null,
          name: p.name,
          store: { id: p.storeId, name: store?.name ?? 'A store' },
          price,
          netQuantity: p.netQuantity!,
          pricePerUnit: { amount: Math.round(pricePerUnit(price, p.netQuantity!.qty, p.netQuantity!.unit)), per: p.netQuantity!.unit === 'g' ? 'kg' : p.netQuantity!.unit === 'ml' ? 'litre' : 'piece' },
          packsNeeded: Math.max(1, Math.ceil(need / p.netQuantity!.qty)),
          inStock: (v?.stock ?? 0) > 0 && !store?.isPaused,
        };
      })
      .sort((a, b) => a.pricePerUnit.amount - b.pricePerUnit.amount);
    return { key, name: CANON[key]?.name ?? key, need: { qty: Math.round(need), unit }, options };
  });
};

// ── Nutrition: the person's own ──
export const DEFAULT_NUTRITION = (userId: string): MockNutritionSettings => ({
  userId,
  enabled: false,
  showCalories: false,
  goal: 'eat_better',
  metrics: null,
  manualTargetKcal: null,
  updatedAt: '',
});

export const nutritionSettingsOf = (db: MockDb, userId: string) => (k(db).nutritionSettings ?? []).find(s => s.userId === userId) ?? DEFAULT_NUTRITION(userId);

const ACTIVITY = { low: 1.2, moderate: 1.45, high: 1.7 } as const;
const GOAL_SHIFT = { eat_better: 0, maintain: 0, lose: -400, gain: 300 } as const;

/** A day's target: the person's own number, else Mifflin–St Jeor from their metrics and goal (to 10 kcal). */
export const targetKcalOf = (s: Pick<MockNutritionSettings, 'manualTargetKcal' | 'metrics' | 'goal'>) => {
  if (s.manualTargetKcal) return s.manualTargetKcal;
  const m = s.metrics;
  if (!m) return null;
  const bmr = 10 * m.weightKg + 6.25 * m.heightCm - 5 * m.age + (m.sex === 'male' ? 5 : -161);
  return Math.max(1200, Math.round((bmr * ACTIVITY[m.activity] + GOAL_SHIFT[s.goal]) / 10) * 10);
};

export const nutritionSettingsWire = (s: MockNutritionSettings) => ({
  enabled: s.enabled,
  showCalories: s.enabled && s.showCalories,
  goal: s.goal,
  metrics: s.metrics,
  manualTargetKcal: s.manualTargetKcal,
  targetKcal: s.enabled ? targetKcalOf(s) : null,
  updatedAt: s.updatedAt || null,
});

/** What a customer may see of a dish: never hidden ones, never estimates the kitchen hasn't made. */
export const dishNutritionFor = (db: MockDb, v: MockFoodVendor, itemId: string) => {
  const i = db.food.items.find(x => x.id === itemId);
  if (!i) return null;
  const n = nutritionOf(db, v.businessId, i, (k(db).aiCounted ?? []).includes(`nutrition_estimate:${i.id}`));
  if (n.hidden || n.method === 'none' || n.kcal === null) return null;
  return { kcal: n.kcal, protein: n.protein, carbs: n.carbs, fat: n.fat, method: n.method, serves: Math.max(1, i.serves ?? 1) };
};

export const UNDER_KCAL = 600;
export const HIGH_PROTEIN_G = 25;
/** A meal, not a drink, a side or a sweet (healthy picks are meals). */
export const MEAL_MIN_KCAL = 300;
const NOT_A_MEAL = /drink|cola|soda|lassi|shake|chai|tea|water|fries|naan|roti|raita|salad|kheer|kulfi|zarda|halwa|ice cream|brownie/i;
export const isMeal = (name: string, kcal: number | null, serves: number | null = 1) => !NOT_A_MEAL.test(name) && kcal !== null && kcal / Math.max(1, serves ?? 1) >= MEAL_MIN_KCAL;

/**
 * Per person (a dish that serves two is halved): under 600 kcal; high protein
 * when it has 25 g or more and protein is at least a fifth of the calories.
 */
export const healthyTags = (n: { kcal: number | null; protein: number | null } | null, serves: number | null = 1) => {
  if (!n || n.kcal === null) return [];
  const per = Math.max(1, serves ?? 1);
  const kcal = n.kcal / per;
  const protein = (n.protein ?? 0) / per;
  return [...(kcal < UNDER_KCAL ? ['under_600'] : []), ...(protein >= HIGH_PROTEIN_G && (protein * 4) / kcal >= 0.2 ? ['high_protein'] : [])];
};

/** The last `days` days of the person's delivered or collected Food Court orders. */
export const nutritionSummary = (db: MockDb, userId: string, days: number, now: number) => {
  const today = todayPk(now);
  const from = addDays(today, 1 - days);
  const dates = Array.from({ length: days }, (_, n) => addDays(from, n));
  const orders = db.food.orders.filter(o => o.userId === userId && ['delivered', 'picked_up'].includes(o.status) && dateInZone(o.placedAt, TZ) >= from);
  const byDay = new Map(dates.map(d => [d, { date: d, kcal: 0, protein: 0, carbs: 0, fat: 0, orders: 0 }]));
  const dishes = new Map<string, number>();
  let uncounted = 0;
  for (const o of orders) {
    const day = byDay.get(dateInZone(o.placedAt, TZ));
    if (!day) continue;
    day.orders += 1;
    const v = db.food.vendors.find(x => x.businessId === o.businessId);
    for (const line of o.items) {
      const n = v ? dishNutritionFor(db, v, line.itemId) : null;
      dishes.set(line.name, (dishes.get(line.name) ?? 0) + line.quantity);
      if (!n) {
        uncounted += line.quantity;
        continue;
      }
      day.kcal += n.kcal * line.quantity;
      day.protein += (n.protein ?? 0) * line.quantity;
      day.carbs += (n.carbs ?? 0) * line.quantity;
      day.fat += (n.fat ?? 0) * line.quantity;
    }
  }
  const rows = dates.map(d => byDay.get(d)!);
  const withOrders = rows.filter(r => r.orders > 0);
  const avg = (f: (r: (typeof rows)[number]) => number) => (withOrders.length ? Math.round(withOrders.reduce((n, r) => n + f(r), 0) / withOrders.length) : 0);
  return {
    from,
    to: today,
    scope: 'food_court_orders',
    days: rows,
    averageOnOrderDays: { kcal: avg(r => r.kcal), protein: avg(r => r.protein), carbs: avg(r => r.carbs), fat: avg(r => r.fat) },
    topDishes: [...dishes].sort((a, b) => b[1] - a[1]).slice(0, 3).map(([name, count]) => ({ name, count })),
    uncounted,
  };
};
