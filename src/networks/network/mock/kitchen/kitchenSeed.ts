// ═══════════════════════════════════════════════════════
// MetroMatrix — Dummy kitchen data (the demo vendors' stock and history)
// ═══════════════════════════════════════════════════════
// Ingredients, batches, recipes, suppliers and purchases for Biryani Bazaar
// (restaurant), Smash Lab (cloud kitchen), Ammi ka Khana (home kitchen) and
// Nani ki Handi (a newer home kitchen, 9 days of history: its forecast is
// still "learning"); ten weeks of daily dish sales from a seeded random
// walk; the city price list; nutrition references and the ingredient words
// people use. Prices are ordinary Lahore market rates in rupees; every name
// is invented.
//
// The demo is set up to show what a cook should notice first: 4 kg of
// chicken expiring tomorrow, yoghurt running low, cream recorded below
// zero (Malai Boti sells out by itself), tomatoes up on last month, Mutton
// Karahi over the food-cost target and five dishes without a recipe card.

import type { BaseUnit, CustomUnit } from '../../../../utils/units';
import { addDays, dateInZone, isoWeekday, weekStart, zonedToIso } from '../../../../utils/healthTime';
import { FOOD_IMG } from '../food/foodImages';
import type { MockFoodReview } from '../food/foodTypes';
import type {
  MockSearchLog,
  MockAlias,
  MockBatch,
  MockDailySale,
  MockIngredient,
  MockIngredientCategory,
  MockKitchen,
  MockMovement,
  MockNutritionFood,
  MockPurchase,
  MockRecipe,
  MockRecipeLine,
  MockSupplier,
} from './kitchenTypes';

const DAY = 24 * 60 * 60 * 1000;
const TZ = 'Asia/Karachi';
const iso = (msAgo = 0) => new Date(Date.now() - msAgo).toISOString();

// ── The canonical ingredients ─────────────────────────
// key → name, category, base unit, rupees per base unit, nutrition per 100 g
// / 100 ml / piece [kcal, protein, carbs, fat].
interface Canon {
  name: string;
  category: MockIngredientCategory;
  base: BaseUnit;
  cost: number;
  n: [number, number, number, number];
  dozens?: boolean;
  custom?: CustomUnit[];
}

export const CANON: Record<string, Canon> = {
  chicken: { name: 'Chicken (curry cut)', category: 'meat_poultry', base: 'g', cost: 0.62, n: [150, 20, 0, 7] },
  chicken_boneless: { name: 'Chicken boneless', category: 'meat_poultry', base: 'g', cost: 0.82, n: [120, 23, 0, 2.6] },
  chicken_thigh: { name: 'Chicken thigh', category: 'meat_poultry', base: 'g', cost: 0.75, n: [177, 18, 0, 11] },
  chicken_wings: { name: 'Chicken wings', category: 'meat_poultry', base: 'g', cost: 0.55, n: [203, 18, 0, 14] },
  beef: { name: 'Beef (boneless)', category: 'meat_poultry', base: 'g', cost: 1.1, n: [250, 26, 0, 15] },
  beef_mince: { name: 'Beef mince', category: 'meat_poultry', base: 'g', cost: 1.0, n: [254, 17, 0, 20] },
  mutton: { name: 'Mutton', category: 'meat_poultry', base: 'g', cost: 2.2, n: [294, 25, 0, 21] },
  rice: { name: 'Basmati rice', category: 'grains_flour', base: 'g', cost: 0.38, n: [350, 7.5, 78, 0.6], custom: [{ name: 'bori', base: 25000 }] },
  onion: { name: 'Onion', category: 'vegetables', base: 'g', cost: 0.12, n: [40, 1.1, 9.3, 0.1] },
  tomato: { name: 'Tomato', category: 'vegetables', base: 'g', cost: 0.18, n: [18, 0.9, 3.9, 0.2], custom: [{ name: 'crate', base: 10000 }] },
  potato: { name: 'Potato', category: 'vegetables', base: 'g', cost: 0.09, n: [77, 2, 17, 0.1] },
  green_chilli: { name: 'Green chilli', category: 'vegetables', base: 'g', cost: 0.3, n: [40, 2, 9, 0.2] },
  coriander: { name: 'Coriander', category: 'vegetables', base: 'g', cost: 0.3, n: [23, 2, 3.7, 0.5] },
  mint: { name: 'Mint', category: 'vegetables', base: 'g', cost: 0.4, n: [44, 3.3, 8.4, 0.7] },
  cucumber: { name: 'Cucumber', category: 'vegetables', base: 'g', cost: 0.16, n: [15, 0.7, 3.6, 0.1] },
  lettuce: { name: 'Lettuce', category: 'vegetables', base: 'g', cost: 0.4, n: [15, 1.4, 2.9, 0.2] },
  lemon: { name: 'Lemon', category: 'fruit', base: 'pc', cost: 15, n: [17, 0.6, 5.4, 0.2] },
  aloo_bukhara: { name: 'Aloo bukhara (dried plums)', category: 'fruit', base: 'g', cost: 1.6, n: [240, 2, 64, 0.4] },
  yoghurt: { name: 'Yoghurt', category: 'dairy', base: 'g', cost: 0.26, n: [61, 3.5, 4.7, 3.3] },
  milk: { name: 'Milk', category: 'dairy', base: 'ml', cost: 0.22, n: [61, 3.2, 4.8, 3.3] },
  cream: { name: 'Cream', category: 'dairy', base: 'g', cost: 0.9, n: [340, 2.8, 2.8, 36] },
  cheese_slice: { name: 'Cheese slices', category: 'dairy', base: 'pc', cost: 28, n: [66, 3.6, 1.4, 5.2] },
  ice_cream: { name: 'Vanilla ice cream', category: 'dairy', base: 'ml', cost: 0.65, n: [207, 3.5, 24, 11] },
  egg: { name: 'Eggs', category: 'dairy', base: 'pc', cost: 30, n: [72, 6.3, 0.4, 4.8], dozens: true, custom: [{ name: 'tray', base: 30 }] },
  ghee: { name: 'Desi ghee', category: 'oils_ghee', base: 'g', cost: 1.5, n: [900, 0, 0, 100] },
  oil: { name: 'Cooking oil', category: 'oils_ghee', base: 'ml', cost: 0.56, n: [820, 0, 0, 92] },
  ginger_garlic: { name: 'Ginger garlic paste', category: 'spices', base: 'g', cost: 0.6, n: [110, 4, 23, 0.5] },
  biryani_masala: { name: 'Biryani masala', category: 'spices', base: 'g', cost: 2.4, n: [300, 12, 50, 10] },
  red_chilli: { name: 'Red chilli powder', category: 'spices', base: 'g', cost: 1.2, n: [282, 12, 50, 14] },
  garam_masala: { name: 'Garam masala', category: 'spices', base: 'g', cost: 2.8, n: [379, 15, 45, 15] },
  black_pepper: { name: 'Black pepper', category: 'spices', base: 'g', cost: 3.0, n: [251, 10, 64, 3.3] },
  cardamom: { name: 'Green cardamom', category: 'spices', base: 'g', cost: 8.0, n: [311, 11, 68, 6.7] },
  salt: { name: 'Salt', category: 'spices', base: 'g', cost: 0.06, n: [0, 0, 0, 0] },
  flour: { name: 'Maida (white flour)', category: 'grains_flour', base: 'g', cost: 0.14, n: [364, 10, 76, 1] },
  atta: { name: 'Atta (wholewheat flour)', category: 'grains_flour', base: 'g', cost: 0.12, n: [340, 13, 72, 2.5] },
  masoor_daal: { name: 'Masoor daal', category: 'grains_flour', base: 'g', cost: 0.32, n: [352, 24, 63, 1] },
  sugar: { name: 'Sugar', category: 'other', base: 'g', cost: 0.15, n: [387, 0, 100, 0] },
  almonds: { name: 'Almonds', category: 'other', base: 'g', cost: 3.2, n: [579, 21, 22, 50] },
  achaar: { name: 'Mixed achaar', category: 'other', base: 'g', cost: 0.7, n: [180, 1, 6, 17] },
  pickles: { name: 'Pickled cucumber', category: 'other', base: 'g', cost: 0.6, n: [11, 0.3, 2, 0.2] },
  burger_sauce: { name: 'House burger sauce', category: 'other', base: 'g', cost: 0.8, n: [300, 1, 20, 24] },
  mayo: { name: 'Garlic mayo', category: 'other', base: 'g', cost: 0.7, n: [680, 1, 1, 75] },
  burger_bun: { name: 'Brioche buns', category: 'bakery', base: 'pc', cost: 45, n: [160, 5, 29, 2.5] },
  soft_drink: { name: 'Soft drink 345 ml', category: 'drinks', base: 'pc', cost: 70, n: [145, 0, 37, 0] },
  cola_500: { name: 'Soft drink 500 ml', category: 'drinks', base: 'pc', cost: 95, n: [210, 0, 53, 0] },
  box_biryani: { name: 'Biryani box', category: 'packaging', base: 'pc', cost: 25, n: [0, 0, 0, 0] },
  foil_tray: { name: 'Foil tray', category: 'packaging', base: 'pc', cost: 18, n: [0, 0, 0, 0] },
  raita_cup: { name: 'Raita cup', category: 'packaging', base: 'pc', cost: 6, n: [0, 0, 0, 0] },
  burger_box: { name: 'Burger box', category: 'packaging', base: 'pc', cost: 22, n: [0, 0, 0, 0] },
  fries_cup: { name: 'Fries cup', category: 'packaging', base: 'pc', cost: 8, n: [0, 0, 0, 0] },
  shake_cup: { name: 'Shake cup', category: 'packaging', base: 'pc', cost: 20, n: [0, 0, 0, 0] },
  handi_box: { name: 'Handi box', category: 'packaging', base: 'pc', cost: 20, n: [0, 0, 0, 0] },
};

const NON_FOOD: MockIngredientCategory[] = ['packaging'];

export const nutritionFoodId = (key: string) => `nf_${key}`;

const seedNutritionFoods = (): MockNutritionFood[] =>
  Object.entries(CANON)
    .filter(([, c]) => !NON_FOOD.includes(c.category))
    .map(([key, c]) => ({
      id: nutritionFoodId(key),
      key,
      name: c.name,
      per: c.base === 'g' ? 'g100' : c.base === 'ml' ? 'ml100' : 'piece',
      kcal: c.n[0],
      protein: c.n[1],
      carbs: c.n[2],
      fat: c.n[3],
      updatedAt: iso(60 * DAY),
    }));

// ── The words people use (voice, search, matching receipts) ──
const WORDS: [string, 'ur' | 'roman_ur' | 'en', string][] = [
  ['tamatar', 'roman_ur', 'tomato'],
  ['tamaatar', 'roman_ur', 'tomato'],
  ['ٹماٹر', 'ur', 'tomato'],
  ['tomato', 'en', 'tomato'],
  ['tomatoes', 'en', 'tomato'],
  ['pyaz', 'roman_ur', 'onion'],
  ['piyaz', 'roman_ur', 'onion'],
  ['پیاز', 'ur', 'onion'],
  ['onion', 'en', 'onion'],
  ['onions', 'en', 'onion'],
  ['aloo', 'roman_ur', 'potato'],
  ['آلو', 'ur', 'potato'],
  ['potato', 'en', 'potato'],
  ['potatoes', 'en', 'potato'],
  ['murghi', 'roman_ur', 'chicken'],
  ['murgi', 'roman_ur', 'chicken'],
  ['chicken', 'en', 'chicken'],
  ['مرغی', 'ur', 'chicken'],
  ['چکن', 'ur', 'chicken'],
  ['boneless', 'en', 'chicken_boneless'],
  ['gosht', 'roman_ur', 'beef'],
  ['beef', 'en', 'beef'],
  ['گوشت', 'ur', 'beef'],
  ['qeema', 'roman_ur', 'beef_mince'],
  ['keema', 'roman_ur', 'beef_mince'],
  ['mince', 'en', 'beef_mince'],
  ['قیمہ', 'ur', 'beef_mince'],
  ['mutton', 'en', 'mutton'],
  ['bakra', 'roman_ur', 'mutton'],
  ['مٹن', 'ur', 'mutton'],
  ['dahi', 'roman_ur', 'yoghurt'],
  ['دہی', 'ur', 'yoghurt'],
  ['yoghurt', 'en', 'yoghurt'],
  ['yogurt', 'en', 'yoghurt'],
  ['doodh', 'roman_ur', 'milk'],
  ['دودھ', 'ur', 'milk'],
  ['milk', 'en', 'milk'],
  ['malai', 'roman_ur', 'cream'],
  ['cream', 'en', 'cream'],
  ['ملائی', 'ur', 'cream'],
  ['chawal', 'roman_ur', 'rice'],
  ['چاول', 'ur', 'rice'],
  ['rice', 'en', 'rice'],
  ['atta', 'roman_ur', 'atta'],
  ['آٹا', 'ur', 'atta'],
  ['maida', 'roman_ur', 'flour'],
  ['میدہ', 'ur', 'flour'],
  ['flour', 'en', 'flour'],
  ['cheeni', 'roman_ur', 'sugar'],
  ['چینی', 'ur', 'sugar'],
  ['sugar', 'en', 'sugar'],
  ['namak', 'roman_ur', 'salt'],
  ['نمک', 'ur', 'salt'],
  ['salt', 'en', 'salt'],
  ['anday', 'roman_ur', 'egg'],
  ['anday', 'roman_ur', 'egg'],
  ['anda', 'roman_ur', 'egg'],
  ['انڈے', 'ur', 'egg'],
  ['eggs', 'en', 'egg'],
  ['egg', 'en', 'egg'],
  ['tel', 'roman_ur', 'oil'],
  ['تیل', 'ur', 'oil'],
  ['oil', 'en', 'oil'],
  ['ghee', 'roman_ur', 'ghee'],
  ['گھی', 'ur', 'ghee'],
  ['hari mirch', 'roman_ur', 'green_chilli'],
  ['ہری مرچ', 'ur', 'green_chilli'],
  ['green chilli', 'en', 'green_chilli'],
  ['dhania', 'roman_ur', 'coriander'],
  ['دھنیا', 'ur', 'coriander'],
  ['coriander', 'en', 'coriander'],
  ['pudina', 'roman_ur', 'mint'],
  ['پودینہ', 'ur', 'mint'],
  ['mint', 'en', 'mint'],
  ['nimbu', 'roman_ur', 'lemon'],
  ['لیموں', 'ur', 'lemon'],
  ['lemon', 'en', 'lemon'],
  ['lemons', 'en', 'lemon'],
  ['kheera', 'roman_ur', 'cucumber'],
  ['کھیرا', 'ur', 'cucumber'],
  ['cucumber', 'en', 'cucumber'],
  ['daal', 'roman_ur', 'masoor_daal'],
  ['دال', 'ur', 'masoor_daal'],
  ['lentils', 'en', 'masoor_daal'],
  ['adrak lehsan', 'roman_ur', 'ginger_garlic'],
  ['ginger garlic', 'en', 'ginger_garlic'],
  ['ادرک لہسن', 'ur', 'ginger_garlic'],
  ['bun', 'en', 'burger_bun'],
  ['buns', 'en', 'burger_bun'],
  ['cheese', 'en', 'cheese_slice'],
  ['achaar', 'roman_ur', 'achaar'],
  ['اچار', 'ur', 'achaar'],
];

const seedAliases = (): MockAlias[] => {
  const seen = new Set<string>();
  return WORDS.filter(([w]) => (seen.has(w) ? false : (seen.add(w), true))).map(([word, language, key], i) => ({ id: `al_${i + 1}`, word, language, key }));
};

// ── The city price list (8 weeks, Lahore, Karachi, Islamabad) ──
// Tomatoes climb about a third over the eight weeks in Lahore; onions a
// quarter; the rest drift a few percent.
const CITY_FACTOR: Record<string, number> = { Lahore: 1, Karachi: 1.04, Islamabad: 1.07 };
const TREND: Record<string, number> = { tomato: 0.32, onion: 0.22, chicken: 0.04, yoghurt: 0.03 };

const seedPriceRefs = (today: string): MockKitchen['priceRefs'] => {
  const out: MockKitchen['priceRefs'] = [];
  const thisWeek = weekStart(today);
  for (const [key, c] of Object.entries(CANON)) {
    if (c.category === 'packaging') continue;
    for (const city of Object.keys(CITY_FACTOR)) {
      for (let w = 7; w >= 0; w--) {
        const week = addDays(thisWeek, -7 * w);
        // Eight weeks ago the price was (1 - trend) of today's; a straight climb.
        const rise = TREND[key] ?? 0.02;
        const factor = (1 - rise * (w / 7)) * CITY_FACTOR[city];
        // The city's typical price is a little under what a busy kitchen pays.
        out.push({ key, name: c.name, city, week, costPerBase: Math.round(c.cost * 0.95 * factor * 10000) / 10000 });
      }
    }
  }
  return out;
};

// ── Per kitchen ────────────────────────────────────────
interface StockSeed {
  key: string;
  /** On hand now, in base units (negative: used more than recorded). */
  onHand: number;
  par?: number;
  /** A batch of this much expires in this many days (the rest later). */
  expiring?: [qty: number, inDays: number];
  /** What this kitchen pays, vs the canonical price (1.25 = a quarter more). */
  paid?: number;
  /** Its own name, not yet matched to a nutrition food (the nutrition screen's "unmapped" list). */
  ownName?: string;
}

interface RecipeSeed {
  itemId: string;
  variantId?: string;
  yield?: number;
  lines: [key: string, qty: number][];
  packaging?: [key: string, qty: number][];
  addOns?: { optionId: string; lines: [key: string, qty: number][] }[];
  signature?: string;
}

interface KitchenSeed {
  businessId: string;
  short: string;
  historyDays: number;
  suppliers: [name: string, phone: string | null][];
  stock: StockSeed[];
  recipes: RecipeSeed[];
}

const BIRYANI: [string, number][] = [
  ['chicken', 150],
  ['rice', 140],
  ['onion', 50],
  ['yoghurt', 30],
  ['oil', 25],
  ['biryani_masala', 6],
  ['ginger_garlic', 8],
  ['tomato', 30],
  ['mint', 2],
  ['salt', 4],
];
const scale = (lines: [string, number][], k: number): [string, number][] => lines.map(([key, q]) => [key, Math.round(q * k)]);

const RAITA_ADDONS = [
  { optionId: 'og_raita_1', lines: [['yoghurt', 80], ['cucumber', 20], ['mint', 2]] as [string, number][] },
  { optionId: 'og_raita_2', lines: [['tomato', 40], ['onion', 40], ['cucumber', 40]] as [string, number][] },
  { optionId: 'og_drink_1', lines: [['soft_drink', 1]] as [string, number][] },
];

export const KITCHENS: KitchenSeed[] = [
  {
    businessId: 'b_resto',
    short: 'bb',
    historyDays: 70,
    suppliers: [
      ['Shah Poultry, Ichhra', '+923004441101'],
      ['Anwar Sabzi Wala', '+923004441102'],
      ['Gulberg Cash & Carry', null],
    ],
    stock: [
      { key: 'chicken', onHand: 16000, par: 10000, expiring: [4000, 1] },
      { key: 'chicken_boneless', onHand: 6000, par: 4000 },
      { key: 'beef', onHand: 9000, par: 6000 },
      { key: 'beef_mince', onHand: 7000, par: 5000 },
      { key: 'mutton', onHand: 4000, par: 3000 },
      { key: 'rice', onHand: 22000, par: 15000 },
      { key: 'onion', onHand: 12000, par: 8000, paid: 1.25 },
      { key: 'tomato', onHand: 9000, par: 6000, paid: 1.3, expiring: [3000, 3] },
      { key: 'potato', onHand: 6000, par: 3000 },
      { key: 'yoghurt', onHand: 1500, par: 4000, expiring: [1500, 2] },
      { key: 'milk', onHand: 4000, par: 3000, expiring: [2000, 1] },
      { key: 'cream', onHand: -200, par: 1000 },
      { key: 'ghee', onHand: 3000, par: 2000 },
      { key: 'oil', onHand: 14000, par: 10000 },
      { key: 'ginger_garlic', onHand: 2000, par: 1000 },
      { key: 'green_chilli', onHand: 800, par: 500 },
      { key: 'coriander', onHand: 400, par: 300, expiring: [400, 1] },
      { key: 'mint', onHand: 300, par: 300 },
      { key: 'cucumber', onHand: 3000, par: 2000 },
      { key: 'lemon', onHand: 40, par: 30 },
      { key: 'aloo_bukhara', onHand: 800, par: 500, ownName: 'Aloo bukhara (dried plums)' },
      { key: 'biryani_masala', onHand: 1200, par: 800, ownName: 'House biryani masala' },
      { key: 'red_chilli', onHand: 900, par: 500 },
      { key: 'black_pepper', onHand: 400, par: 200 },
      { key: 'salt', onHand: 5000, par: 2000 },
      { key: 'flour', onHand: 15000, par: 10000 },
      { key: 'sugar', onHand: 4000, par: 2000 },
      { key: 'soft_drink', onHand: 96, par: 48 },
      { key: 'box_biryani', onHand: 300, par: 200 },
      { key: 'foil_tray', onHand: 250, par: 150 },
      { key: 'raita_cup', onHand: 60, par: 100 },
    ],
    recipes: [
      { itemId: 'mi_chicken_biryani', variantId: 'mi_chicken_biryani_v1', lines: BIRYANI, packaging: [['box_biryani', 1]], addOns: RAITA_ADDONS, signature: 'Imran Qureshi' },
      { itemId: 'mi_chicken_biryani', variantId: 'mi_chicken_biryani_v2', lines: scale(BIRYANI, 1.7), packaging: [['box_biryani', 1]], addOns: RAITA_ADDONS },
      { itemId: 'mi_chicken_biryani', variantId: 'mi_chicken_biryani_v3', lines: scale(BIRYANI, 3.2), packaging: [['box_biryani', 2]], addOns: RAITA_ADDONS },
      {
        itemId: 'mi_beef_biryani',
        lines: [['beef', 130], ['rice', 140], ['aloo_bukhara', 10], ['onion', 50], ['oil', 25], ['biryani_masala', 6], ['yoghurt', 30], ['salt', 4]],
        packaging: [['box_biryani', 1]],
        addOns: RAITA_ADDONS.slice(0, 2),
      },
      {
        itemId: 'mi_chicken_karahi',
        variantId: 'mi_chicken_karahi_v1',
        lines: [['chicken', 500], ['tomato', 300], ['ginger_garlic', 20], ['green_chilli', 20], ['oil', 60], ['ghee', 20], ['red_chilli', 6], ['salt', 6], ['coriander', 10]],
        packaging: [['foil_tray', 1]],
      },
      {
        itemId: 'mi_chicken_karahi',
        variantId: 'mi_chicken_karahi_v2',
        lines: [['chicken', 900], ['tomato', 540], ['ginger_garlic', 36], ['green_chilli', 36], ['oil', 108], ['ghee', 36], ['red_chilli', 11], ['salt', 11], ['coriander', 18]],
        packaging: [['foil_tray', 1]],
      },
      {
        itemId: 'mi_mutton_karahi',
        lines: [['mutton', 500], ['tomato', 250], ['ghee', 40], ['black_pepper', 8], ['ginger_garlic', 20], ['green_chilli', 15], ['salt', 6]],
        packaging: [['foil_tray', 1]],
      },
      { itemId: 'mi_seekh', lines: [['beef_mince', 260], ['onion', 40], ['red_chilli', 6], ['coriander', 10], ['yoghurt', 40], ['mint', 5], ['salt', 4]], packaging: [['foil_tray', 1]], signature: 'Imran Qureshi' },
      { itemId: 'mi_tikka', lines: [['chicken', 230], ['yoghurt', 40], ['red_chilli', 5], ['ginger_garlic', 10], ['lemon', 1], ['oil', 10], ['salt', 3]], packaging: [['foil_tray', 1]] },
      { itemId: 'mi_malai', lines: [['chicken_boneless', 250], ['cream', 60], ['yoghurt', 30], ['ginger_garlic', 10], ['black_pepper', 2], ['salt', 3]], packaging: [['foil_tray', 1]] },
      { itemId: 'mi_naan', lines: [['flour', 120], ['yoghurt', 10], ['salt', 2], ['oil', 5]] },
      { itemId: 'mi_roghni', lines: [['flour', 120], ['milk', 30], ['ghee', 5], ['salt', 2]] },
      { itemId: 'mi_lassi', variantId: 'mi_lassi_v1', lines: [['yoghurt', 200], ['sugar', 20], ['milk', 40]] },
      { itemId: 'mi_lassi', variantId: 'mi_lassi_v2', lines: [['yoghurt', 200], ['salt', 3], ['milk', 40]] },
    ],
  },
  {
    businessId: 'b_cloud',
    short: 'sl',
    historyDays: 70,
    suppliers: [
      ['Model Town Meat Shop', '+923004441201'],
      ['Bake House Wholesale', '+923004441202'],
    ],
    stock: [
      { key: 'beef_mince', onHand: 14000, par: 10000 },
      { key: 'chicken_thigh', onHand: 8000, par: 5000 },
      { key: 'chicken_wings', onHand: 6000, par: 4000, expiring: [2000, 2] },
      { key: 'burger_bun', onHand: 120, par: 80 },
      { key: 'cheese_slice', onHand: 300, par: 200 },
      { key: 'lettuce', onHand: 1200, par: 1000 },
      { key: 'tomato', onHand: 3000, par: 2000, paid: 1.2 },
      { key: 'onion', onHand: 4000, par: 2000 },
      { key: 'pickles', onHand: 1500, par: 1000 },
      { key: 'burger_sauce', onHand: 3000, par: 2000 },
      { key: 'mayo', onHand: 2500, par: 2000 },
      { key: 'potato', onHand: 25000, par: 15000 },
      { key: 'oil', onHand: 20000, par: 15000 },
      { key: 'flour', onHand: 5000, par: 3000 },
      { key: 'egg', onHand: 60, par: 36 },
      { key: 'milk', onHand: 8000, par: 5000, expiring: [3000, 2] },
      { key: 'ice_cream', onHand: 9000, par: 6000 },
      { key: 'sugar', onHand: 3000, par: 1000 },
      { key: 'salt', onHand: 3000, par: 1000 },
      { key: 'red_chilli', onHand: 600, par: 300 },
      { key: 'cola_500', onHand: 140, par: 96 },
      { key: 'burger_box', onHand: 400, par: 200 },
      { key: 'fries_cup', onHand: 500, par: 300 },
      { key: 'shake_cup', onHand: 150, par: 100 },
    ],
    recipes: [
      {
        itemId: 'mi_classic_smash',
        variantId: 'mi_classic_smash_v1',
        lines: [['beef_mince', 150], ['burger_bun', 1], ['cheese_slice', 1], ['pickles', 15], ['burger_sauce', 25], ['onion', 15]],
        packaging: [['burger_box', 1]],
        addOns: [
          { optionId: 'og_toppings_1', lines: [['cheese_slice', 1]] },
          { optionId: 'og_toppings_3', lines: [['egg', 1]] },
          { optionId: 'og_toppings_4', lines: [['beef_mince', 150]] },
          { optionId: 'og_meal_1', lines: [['potato', 180], ['oil', 20], ['cola_500', 1]] },
        ],
        signature: 'Faraz Ahmed',
      },
      {
        itemId: 'mi_classic_smash',
        variantId: 'mi_classic_smash_v2',
        lines: [['beef_mince', 300], ['burger_bun', 1], ['cheese_slice', 2], ['pickles', 20], ['burger_sauce', 30], ['onion', 20]],
        packaging: [['burger_box', 1]],
      },
      { itemId: 'mi_cheese_smash', lines: [['beef_mince', 300], ['burger_bun', 1], ['cheese_slice', 3], ['onion', 40], ['oil', 10], ['burger_sauce', 25]], packaging: [['burger_box', 1]] },
      { itemId: 'mi_spicy_chicken', lines: [['chicken_thigh', 180], ['flour', 60], ['red_chilli', 4], ['burger_bun', 1], ['lettuce', 20], ['mayo', 20], ['oil', 40]], packaging: [['burger_box', 1]] },
      { itemId: 'mi_fries', variantId: 'mi_fries_v1', lines: [['potato', 220], ['oil', 25], ['salt', 2]], packaging: [['fries_cup', 1]] },
      { itemId: 'mi_fries', variantId: 'mi_fries_v2', lines: [['potato', 320], ['oil', 35], ['salt', 3]], packaging: [['fries_cup', 1]] },
      { itemId: 'mi_loaded_fries', lines: [['potato', 260], ['oil', 30], ['cheese_slice', 2], ['beef_mince', 60], ['mayo', 20]], packaging: [['fries_cup', 1]] },
      { itemId: 'mi_wings', lines: [['chicken_wings', 300], ['flour', 40], ['red_chilli', 5], ['oil', 40], ['salt', 3]], packaging: [['burger_box', 1]] },
      { itemId: 'mi_shake', variantId: 'mi_shake_v1', lines: [['milk', 200], ['ice_cream', 150], ['sugar', 15]], packaging: [['shake_cup', 1]] },
      { itemId: 'mi_cola', lines: [['cola_500', 1]] },
    ],
  },
  {
    businessId: 'b_homek',
    short: 'ak',
    historyDays: 70,
    suppliers: [['Akbari Mandi (Ammi’s usual stall)', null]],
    stock: [
      { key: 'chicken', onHand: 6000, par: 4000, expiring: [2000, 1] },
      { key: 'beef_mince', onHand: 3000, par: 2000 },
      { key: 'onion', onHand: 5000, par: 3000 },
      { key: 'tomato', onHand: 3000, par: 2000, paid: 1.15 },
      { key: 'potato', onHand: 4000, par: 2000 },
      { key: 'yoghurt', onHand: 2000, par: 1500 },
      { key: 'oil', onHand: 6000, par: 4000 },
      { key: 'ghee', onHand: 1000, par: 800 },
      { key: 'atta', onHand: 9000, par: 8000 },
      { key: 'rice', onHand: 6000, par: 5000 },
      { key: 'masoor_daal', onHand: 2500, par: 2000 },
      { key: 'achaar', onHand: 1500, par: 1000 },
      { key: 'ginger_garlic', onHand: 600, par: 400 },
      { key: 'garam_masala', onHand: 300, par: 200 },
      { key: 'red_chilli', onHand: 300, par: 200 },
      { key: 'salt', onHand: 2000, par: 1000 },
      { key: 'milk', onHand: 3000, par: 2000, expiring: [1000, 1] },
      { key: 'sugar', onHand: 2000, par: 1000 },
      { key: 'cardamom', onHand: 50, par: 40 },
      { key: 'almonds', onHand: 300, par: 200 },
      { key: 'handi_box', onHand: 80, par: 60 },
    ],
    recipes: [
      {
        itemId: 'mi_qorma',
        yield: 10,
        lines: [['chicken', 2000], ['onion', 800], ['yoghurt', 500], ['oil', 300], ['ginger_garlic', 60], ['garam_masala', 20], ['red_chilli', 20], ['salt', 30], ['atta', 1200]],
        packaging: [['handi_box', 1]],
        signature: 'Nasreen Akhtar',
      },
      { itemId: 'mi_daal', yield: 10, lines: [['masoor_daal', 800], ['rice', 1200], ['onion', 300], ['tomato', 300], ['oil', 200], ['salt', 25], ['achaar', 200]], packaging: [['handi_box', 1]] },
      { itemId: 'mi_aloo_keema', yield: 8, lines: [['beef_mince', 1200], ['potato', 1000], ['onion', 400], ['tomato', 400], ['oil', 200], ['garam_masala', 15], ['salt', 20], ['atta', 960]], packaging: [['handi_box', 1]] },
      { itemId: 'mi_pulao', yield: 10, lines: [['chicken', 1500], ['rice', 1500], ['onion', 400], ['oil', 250], ['garam_masala', 15], ['salt', 25], ['yoghurt', 400]], packaging: [['handi_box', 1]] },
      { itemId: 'mi_homek_kheer', yield: 8, lines: [['milk', 2000], ['rice', 150], ['sugar', 250], ['cardamom', 6], ['almonds', 60]] },
    ],
  },
  {
    businessId: 'b_nani',
    short: 'nk',
    historyDays: 9,
    suppliers: [],
    stock: [
      { key: 'chicken', onHand: 3000, par: 2000 },
      { key: 'onion', onHand: 2000, par: 1500 },
      { key: 'yoghurt', onHand: 1000, par: 800 },
      { key: 'oil', onHand: 3000, par: 2000 },
      { key: 'atta', onHand: 5000, par: 4000 },
      { key: 'rice', onHand: 4000, par: 3000 },
      { key: 'masoor_daal', onHand: 1500, par: 1000 },
      { key: 'salt', onHand: 1000, par: 500 },
    ],
    recipes: [
      { itemId: 'mi_nani_qorma', yield: 10, lines: [['chicken', 2000], ['onion', 800], ['yoghurt', 500], ['oil', 300], ['salt', 30], ['atta', 1200]] },
      { itemId: 'mi_nani_daal', yield: 10, lines: [['masoor_daal', 800], ['rice', 1200], ['onion', 300], ['oil', 200], ['salt', 25]] },
    ],
  },
];

/** The menus' dishes that sell, and their 30-day counts (from the Food seed) — passed in to keep the seeds independent. */
export interface SeedDish {
  id: string;
  businessId: string;
  sold30d: number;
  days: number[];
}

// A small seeded random generator (mulberry32), so every install sees the same history.
export const rng = (seed: number) => () => {
  let t = (seed += 0x6d2b79f5);
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};

// Fridays and weekends sell more; Mondays least.
export const WEEKDAY_FACTOR = [1.2, 0.8, 0.9, 0.95, 1.0, 1.3, 1.35];

const seedSales = (dishes: SeedDish[], today: string): MockDailySale[] => {
  const out: MockDailySale[] = [];
  const random = rng(20261019);
  for (const k of KITCHENS) {
    for (const d of dishes.filter(x => x.businessId === k.businessId && x.sold30d > 0)) {
      const perDay = d.sold30d / 30;
      for (let back = k.historyDays; back >= 1; back--) {
        const date = addDays(today, -back);
        const weekday = new Date(`${date}T00:00:00Z`).getUTCDay();
        if (!d.days.includes(weekday)) continue;
        // On days it is cooked, a home kitchen's dish sells its share of the week.
        const share = d.days.length < 7 ? 7 / d.days.length : 1;
        const noise = 0.75 + random() * 0.5;
        out.push({ businessId: k.businessId, itemId: d.id, date, qty: Math.max(0, Math.round(perDay * share * WEEKDAY_FACTOR[weekday] * noise)) });
      }
    }
  }
  return out;
};

export const ingredientId = (short: string, key: string) => `ing_${short}_${key}`;

// ── Growth (5B): Ramadan, anonymous searches, story, hygiene ──
/** Lahore neighbourhoods people search from, and how often each one finds an open kitchen late at night. */
const AREAS: { name: string; lat: number; lng: number; weight: number; lateGap: number }[] = [
  { name: 'Gulberg', lat: 31.5154, lng: 74.3422, weight: 5, lateGap: 0.2 },
  { name: 'Johar Town', lat: 31.4697, lng: 74.2728, weight: 4, lateGap: 0.6 },
  { name: 'DHA Phase 5', lat: 31.4627, lng: 74.4089, weight: 4, lateGap: 0.7 },
  { name: 'Model Town', lat: 31.4834, lng: 74.3255, weight: 3, lateGap: 0.4 },
  { name: 'Garden Town', lat: 31.5004, lng: 74.3178, weight: 2, lateGap: 0.3 },
  { name: 'Wapda Town', lat: 31.4352, lng: 74.2671, weight: 2, lateGap: 0.8 },
];

/** What people search for, its cuisine, and how often nothing open answers it. */
const QUERIES: [string, string | null, number][] = [
  ['biryani', 'biryani', 0.05],
  ['karahi', 'karahi', 0.1],
  ['burger', 'burgers', 0.05],
  ['pizza', 'pizza', 0.1],
  ['nihari', 'pakistani', 0.55],
  ['haleem', 'pakistani', 0.6],
  ['paratha roll', 'rolls', 0.25],
  ['shawarma', 'shawarma', 0.2],
  ['chinese', 'chinese', 0.3],
  ['salad', 'healthy', 0.45],
  ['halwa puri', 'breakfast', 0.7],
  ['daal chawal', 'home-food', 0.35],
  ['kulfi', 'desserts', 0.5],
  ['sushi', null, 0.9],
];

/** An hour of the day, weighted to lunch, dinner and late night. */
const HOURS = [0, 0, 1, 1, 2, 8, 9, 10, 12, 13, 13, 14, 15, 17, 19, 20, 20, 21, 21, 22, 22, 23, 23, 23];

const seedSearches = (now: number): MockSearchLog[] => {
  const random = rng(14481019);
  const pick = <T,>(xs: T[]) => xs[Math.floor(random() * xs.length)];
  const areas = AREAS.flatMap(a => Array.from({ length: a.weight }, () => a));
  const out: MockSearchLog[] = [];
  for (let n = 0; n < 2400; n++) {
    const a = pick(areas);
    const [text, cuisine, gap] = pick(QUERIES);
    const hour = pick(HOURS);
    const late = hour >= 23 || hour <= 2;
    const at = now - Math.floor(random() * 30) * DAY - Math.floor(random() * 3_600_000);
    out.push({
      at: new Date(at).toISOString(),
      // Scattered over the neighbourhood (about a kilometre and a half).
      lat: Math.round((a.lat + (random() - 0.5) * 0.028) * 10_000) / 10_000,
      lng: Math.round((a.lng + (random() - 0.5) * 0.028) * 10_000) / 10_000,
      hour,
      cuisine,
      text,
      foundOpen: random() > Math.min(0.95, gap + (late ? a.lateGap : 0)),
    });
  }
  return out;
};

const seedGrowthMore = (now: number, today: string): Pick<MockKitchen, 'calendarEvents' | 'ramadan' | 'searches' | 'experiments' | 'stories' | 'hygiene' | 'salesThrough'> => {
  const allDone = (done: boolean) => HYGIENE_KEYS.map(key => ({ key, done, evidenceUrl: null }));
  return {
    // Approximate dates (the moon decides); staff correct them in the console.
    calendarEvents: [
      { id: 'ev_ramadan_1448', kind: 'ramadan', name: 'Ramadan 1448', startsOn: '2027-02-08', endsOn: '2027-03-09' },
      { id: 'ev_eid_1448', kind: 'eid', name: 'Eid ul-Fitr', startsOn: '2027-03-10', endsOn: '2027-03-12' },
    ],
    ramadan: [],
    searches: seedSearches(now),
    experiments: [],
    stories: [
      {
        businessId: 'b_nani',
        cookName: 'Shazia Parveen',
        text: 'I started cooking for my neighbours when my children left for university. Everything is made the way my mother made it: slow, in a clay handi, with spices I grind myself.',
        photoUrls: [FOOD_IMG.curry, FOOD_IMG.thali],
        videoUrl: null,
        updatedAt: iso(20 * DAY),
      },
    ],
    hygiene: [
      { businessId: 'b_resto', status: 'verified', note: null, items: allDone(true), requestedAt: iso(40 * DAY), reviewedAt: iso(38 * DAY) },
      { businessId: 'b_nani', status: 'self_declared', note: null, items: allDone(true), requestedAt: null, reviewedAt: null },
    ],
    // The demo kitchens' everyday sales are filled in to yesterday (and go on as the clock moves).
    salesThrough: Object.fromEntries(KITCHENS.map(k => [k.businessId, addDays(today, -1)])),
  };
};

/** The hygiene checklist a kitchen fills in before asking staff to verify it. */
export const HYGIENE_KEYS = ['clean_kitchen', 'water', 'storage', 'hands', 'pests', 'medical'];

/**
 * Tiffin and catering (5B): Nani ki Handi's weekday office lunch and its
 * monthly dinner; Hamza has had the lunch tiffin for a week (this week
 * paid); he has also asked Biryani Bazaar to cater his sister's mehndi,
 * and it has sent a first quote. Ayesha has neither, for the walks.
 */
const seedGrowth = (now: number, today: string): Pick<MockKitchen, 'tiffinPlans' | 'tiffinSubs' | 'tiffinPeriods' | 'tiffinDays' | 'catering' | 'cateringSettings'> => {
  const at = new Date(now).toISOString();
  const lunch = {
    id: 'tp_nani_lunch',
    businessId: 'b_nani',
    name: 'Office lunch tiffin',
    description: 'Home-cooked lunch on weekdays, in a steel tiffin you keep. Roti and salad with every meal.',
    meal: 'lunch' as const,
    days: [1, 2, 3, 4, 5],
    period: 'week' as const,
    price: 2300,
    mode: 'delivery' as const,
    windowFrom: '12:30',
    windowTo: '13:30',
    capacity: 25,
    skipCutoffHours: 14,
    rotation: [
      { weekday: 1, itemIds: ['mi_nani_daal'], note: null },
      { weekday: 2, itemIds: ['mi_nani_qorma'], note: null },
      { weekday: 3, itemIds: ['mi_nani_daal'], note: null },
      { weekday: 4, itemIds: [], note: 'Aloo gosht with 2 roti' },
      { weekday: 5, itemIds: ['mi_nani_pulao'], note: null },
    ],
    photoUrl: FOOD_IMG.thali,
    isActive: true,
    createdAt: iso(60 * DAY),
  };
  const dinner = {
    id: 'tp_nani_dinner',
    businessId: 'b_nani',
    name: 'Ghar ka khana, dinner',
    description: 'Dinner six days a week, the way Nani makes it. Four weeks at a time.',
    meal: 'dinner' as const,
    days: [1, 2, 3, 4, 5, 6],
    period: 'month' as const,
    price: 10800,
    mode: 'delivery' as const,
    windowFrom: '19:30',
    windowTo: '20:30',
    capacity: 15,
    skipCutoffHours: 6,
    rotation: [
      { weekday: 1, itemIds: ['mi_nani_qorma'], note: null },
      { weekday: 2, itemIds: ['mi_nani_daal'], note: null },
      { weekday: 3, itemIds: ['mi_nani_qorma'], note: null },
      { weekday: 4, itemIds: ['mi_nani_daal'], note: null },
      { weekday: 5, itemIds: ['mi_nani_pulao'], note: null },
      { weekday: 6, itemIds: [], note: 'Sabzi, daal and roti' },
    ],
    photoUrl: FOOD_IMG.curry,
    isActive: true,
    createdAt: iso(5 * DAY),
  };
  // Hamza's lunch tiffin: started last Monday (or today, if today is Monday), this week paid.
  const start = addDays(today, -(isoWeekday(today) - 1));
  const sub = {
    id: 'ts_seed_hamza',
    code: 'TF-HMZ4K2',
    planId: lunch.id,
    businessId: lunch.businessId,
    userId: 'u_shopper',
    status: 'active' as const,
    startDate: start,
    endDate: null,
    address: { label: 'work', fullName: 'Hamza Qureshi', phone: '+923451234567', city: 'Lahore', area: 'Gulberg III', line1: 'Office 4, Siddiq Trade Centre, Main Boulevard', landmark: null, lat: 31.5137, lng: 74.3502 },
    paymentMethod: 'transfer' as const,
    pausedFrom: null,
    pausedUntil: null,
    declineReason: null,
    endReason: null,
    createdAt: iso(9 * DAY),
    approvedAt: iso(8 * DAY),
  };
  const period = {
    id: 'tpd_seed_hamza_1',
    subId: sub.id,
    businessId: sub.businessId,
    from: start,
    to: addDays(start, 6),
    meals: 5,
    credit: 0,
    amount: 2300,
    paymentStatus: 'paid' as const,
    payBy: null,
    paymentRef: 'TID55120934',
    paymentProofUrl: null,
    paymentRejectedReason: null,
    createdAt: iso(8 * DAY),
  };
  const mehndi = addDays(today, 12);
  const catering = {
    id: 'ct_seed_hamza',
    code: 'CT-MHD7Q4',
    businessId: 'b_resto',
    userId: 'u_shopper',
    status: 'quoted' as const,
    date: mehndi,
    time: '20:00',
    guests: 80,
    eventType: 'mehndi',
    dishes: [
      { itemId: 'mi_chicken_biryani', name: 'Chicken Biryani', qty: 80 },
      { itemId: 'mi_seekh', name: 'Seekh Kebab (4 pcs)', qty: 40 },
      { itemId: null, name: 'Kheer', qty: 80 },
    ],
    budget: 70000,
    mode: 'delivery' as const,
    address: { label: 'home', fullName: 'Hamza Qureshi', phone: '+923451234567', city: 'Lahore', area: 'DHA Phase 5', line1: 'House 88, Street 9, DHA Phase 5', landmark: null, lat: 31.4697, lng: 74.4089 },
    notes: 'Outdoor, about 80 guests. Please send serving staff if you can.',
    quotes: [
      {
        version: 1,
        lines: [
          { itemId: 'mi_chicken_biryani', name: 'Chicken Biryani', qty: 80, unitPrice: 520, total: 41600 },
          { itemId: 'mi_seekh', name: 'Seekh Kebab (4 pcs)', qty: 40, unitPrice: 480, total: 19200 },
          { itemId: null, name: 'Kheer (bowl)', qty: 80, unitPrice: 120, total: 9600 },
        ],
        subtotal: 70400,
        deliveryFee: 2500,
        total: 72900,
        advancePct: 30,
        advance: 21870,
        validUntil: zonedToIso(addDays(today, 5), '23:59', TZ),
        notes: 'Two serving staff included. Disposable plates extra if needed.',
        createdAt: iso(DAY),
      },
    ],
    acceptedVersion: null,
    advanceStatus: 'none' as const,
    advanceRef: null,
    advanceProofUrl: null,
    advanceRejectedReason: null,
    declineReason: null,
    cancelReason: null,
    createdAt: iso(2 * DAY),
    updatedAt: iso(DAY),
  };
  return {
    tiffinPlans: [lunch, dinner],
    tiffinSubs: [sub],
    tiffinPeriods: [period],
    // Its weekdays so far were delivered (the seed has no orders for them).
    tiffinDays: Array.from({ length: Math.max(0, isoWeekday(today) - 1) }, (_, n) => addDays(start, n))
      .filter(d => lunch.days.includes(isoWeekday(d)))
      .map(date => ({ subId: sub.id, date, state: 'ordered' as const, orderId: null, at })),
    catering: [catering],
    cateringSettings: [
      { businessId: 'b_resto', open: true, minGuests: 20, leadDays: 2 },
      { businessId: 'b_homek', open: false, minGuests: 10, leadDays: 3 },
      { businessId: 'b_nani', open: true, minGuests: 10, leadDays: 3 },
      { businessId: 'b_cloud', open: false, minGuests: 25, leadDays: 2 },
    ],
  };
};

/**
 * Two Bachat Boxes up for tonight when the dummy database is made, so the
 * customer's rail has something to show: pickup 9 to 11 PM (or, later in the
 * evening, from 15 minutes on, until 1:30 AM at the latest).
 */
const seedBoxes = (now: number, today: string): MockKitchen['boxes'] => {
  const nine = Date.parse(zonedToIso(today, '21:00', TZ));
  const latest = Date.parse(zonedToIso(addDays(today, 1), '01:30', TZ));
  const from = Math.max(nine, Math.ceil((now + 15 * 60_000) / (15 * 60_000)) * 15 * 60_000);
  const to = Math.min(from + 2 * 3_600_000, latest);
  if (to - from < 30 * 60_000) return [];
  const at = new Date(now).toISOString();
  const box = (id: string, businessId: string, title: string, contentsHint: string, photo: keyof typeof FOOD_IMG, value: number, price: number, quantity: number) => ({
    id,
    businessId,
    title,
    contentsHint,
    photoUrl: FOOD_IMG[photo],
    value,
    price,
    quantity,
    pickupFrom: new Date(from).toISOString(),
    pickupTo: new Date(to).toISOString(),
    status: 'live' as const,
    createdAt: at,
  });
  return [
    box('sb_seed_resto', 'b_resto', 'Chef’s mix box', 'Some of today’s biryani, karahi and naan', 'biryani', 1200, 450, 4),
    box('sb_seed_nani', 'b_nani', 'Tonight’s handi box', 'Today’s salan with roti or rice', 'curry', 800, 300, 2),
  ];
};

export const seedKitchen = (dishes: SeedDish[], now: number = Date.now()): MockKitchen => {
  const today = dateInZone(new Date(now).toISOString(), TZ);
  const ingredients: MockIngredient[] = [];
  const batches: MockBatch[] = [];
  const movements: MockMovement[] = [];
  const recipes: MockRecipe[] = [];
  const suppliers: MockSupplier[] = [];
  const purchases: MockPurchase[] = [];
  let seq = 0;
  const id = (p: string) => `${p}_seed${++seq}`;

  for (const k of KITCHENS) {
    k.suppliers.forEach(([name, phone], i) =>
      suppliers.push({ id: `sp_${k.short}_${i + 1}`, businessId: k.businessId, name, phone, note: null, createdAt: iso(90 * DAY) }),
    );
    // Purchases a few days apart over the last three weeks, rotating suppliers.
    const buyDays = [20, 16, 12, 9, 6, 3, 1];
    for (const s of k.stock) {
      const c = CANON[s.key];
      const ingId = ingredientId(k.short, s.key);
      ingredients.push({
        id: ingId,
        businessId: k.businessId,
        name: s.ownName ?? c.name,
        category: c.category,
        baseUnit: c.base,
        dozens: !!c.dozens,
        customUnits: c.custom ?? [],
        parLevel: s.par ?? null,
        priceRefKey: s.key,
        nutritionFoodId: c.category === 'packaging' || s.ownName ? null : nutritionFoodId(s.key),
        deficit: s.onHand < 0 ? -s.onHand : 0,
        createdAt: iso(90 * DAY),
        updatedAt: iso(DAY),
      });
      const paid = s.paid ?? 1;
      // Older purchases at the old price, the latest at today's: what a rising market looks like
      // (the latest delivery of tomatoes cost 32% more than the ones before it).
      const latestCost = Math.round(c.cost * paid * 10000) / 10000;
      const olderCost = Math.round((latestCost / (1 + (TREND[s.key] ?? 0))) * 10000) / 10000;
      const held = Math.max(0, s.onHand);
      const [expQty, expDays] = s.expiring ?? [0, 0];
      const parts: { qty: number; expires: string | null; daysAgo: number; cost: number }[] = [];
      const shelf = c.category === 'meat_poultry' || c.category === 'dairy' || c.category === 'vegetables' ? 5 : null;
      if (expQty > 0 && held > 0) parts.push({ qty: Math.min(expQty, held), expires: addDays(today, expDays), daysAgo: shelf ? shelf - expDays : 4, cost: olderCost });
      const rest = held - (parts[0]?.qty ?? 0);
      if (rest > 0) parts.push({ qty: rest, expires: shelf ? addDays(today, shelf) : null, daysAgo: 1, cost: latestCost });
      for (const p of parts) {
        const batchId = id('bt');
        const purchaseId = id('pu');
        const date = addDays(today, -p.daysAgo);
        const supplier = k.suppliers.length ? `sp_${k.short}_${(seq % k.suppliers.length) + 1}` : null;
        const total = Math.round(p.qty * p.cost);
        batches.push({ id: batchId, businessId: k.businessId, ingredientId: ingId, qty: p.qty, receivedQty: p.qty, costPerBase: p.cost, receivedAt: `${date}T05:00:00.000Z`, expiresOn: p.expires, purchaseId });
        purchases.push({ id: purchaseId, businessId: k.businessId, date, supplierId: supplier, source: 'manual', receiptUrl: null, lines: [{ id: id('pl'), ingredientId: ingId, qty: p.qty, total, expiresOn: p.expires, batchId }], total, createdAt: `${date}T05:00:00.000Z` });
        movements.push({ id: id('mv'), businessId: k.businessId, ingredientId: ingId, kind: 'purchase', qty: p.qty, at: `${date}T05:00:00.000Z`, note: null, orderId: null, orderCode: null, purchaseId });
      }
      // Earlier deliveries, used up: the history a price-watch trend and the purchases list read.
      for (const back of buyDays.slice(0, 3)) {
        if (c.category === 'packaging' || s.onHand <= 0) continue;
        const date = addDays(today, -back);
        const qty = Math.max(1, Math.round((s.par ?? held) * 0.8));
        const purchaseId = id('pu');
        const batchId = id('bt');
        const total = Math.round(qty * olderCost);
        batches.push({ id: batchId, businessId: k.businessId, ingredientId: ingId, qty: 0, receivedQty: qty, costPerBase: olderCost, receivedAt: `${date}T05:00:00.000Z`, expiresOn: null, purchaseId });
        purchases.push({ id: purchaseId, businessId: k.businessId, date, supplierId: k.suppliers.length ? `sp_${k.short}_${(back % k.suppliers.length) + 1}` : null, source: 'manual', receiptUrl: null, lines: [{ id: id('pl'), ingredientId: ingId, qty, total, expiresOn: null, batchId }], total, createdAt: `${date}T05:00:00.000Z` });
        movements.push({ id: id('mv'), businessId: k.businessId, ingredientId: ingId, kind: 'purchase', qty, at: `${date}T05:00:00.000Z`, note: null, orderId: null, orderCode: null, purchaseId });
        movements.push({ id: id('mv'), businessId: k.businessId, ingredientId: ingId, kind: 'usage', qty: -qty, at: `${addDays(date, 2)}T15:00:00.000Z`, note: 'Orders', orderId: null, orderCode: null, purchaseId: null });
      }
      if (s.onHand < 0) {
        movements.push({ id: id('mv'), businessId: k.businessId, ingredientId: ingId, kind: 'usage', qty: s.onHand, at: iso(6 * 60 * 60 * 1000), note: 'Orders (more than was recorded in stock)', orderId: null, orderCode: null, purchaseId: null });
      }
    }
    for (const r of k.recipes) {
      const line = ([key, qty]: [string, number]): MockRecipeLine => ({ ingredientId: ingredientId(k.short, key), qty });
      recipes.push({
        businessId: k.businessId,
        itemId: r.itemId,
        variantId: r.variantId ?? null,
        yield: r.yield ?? 1,
        lines: r.lines.map(line),
        addOns: (r.addOns ?? []).map(a => ({ optionId: a.optionId, lines: a.lines.map(line) })),
        packaging: (r.packaging ?? []).map(line),
        signature: { on: !!r.signature, creatorName: r.signature ?? null },
        updatedAt: iso(10 * DAY),
      });
    }
  }

  // Merge each day's purchases from one supplier into one purchase (what a receipt is).
  const merged = new Map<string, MockPurchase>();
  for (const p of purchases) {
    const key = `${p.businessId}|${p.date}|${p.supplierId}`;
    const m = merged.get(key);
    if (m) {
      m.lines.push(...p.lines);
      m.total += p.total;
      for (const mv of movements) if (mv.purchaseId === p.id) mv.purchaseId = m.id;
      for (const b of batches) if (b.purchaseId === p.id) b.purchaseId = m.id;
    } else merged.set(key, { ...p, lines: [...p.lines] });
  }

  return {
    ingredients,
    batches,
    movements,
    recipes,
    suppliers,
    purchases: [...merged.values()],
    settings: KITCHENS.map(k => ({ businessId: k.businessId, targetFoodCostPct: 40, autoSellOut: true, packingPhoto: k.businessId === 'b_cloud' ? 'required' : 'optional' })),
    sales: seedSales(dishes, today),
    adjustments: [],
    waste: [
      {
        id: 'ws_seed1',
        businessId: 'b_resto',
        at: iso(2 * DAY),
        lines: [{ ingredientId: ingredientId('bb', 'yoghurt'), itemId: null, name: CANON.yoghurt.name, qty: 1500, baseUnit: 'g', cost: 390, reason: 'expired' }],
        cost: 390,
        note: null,
      },
      {
        id: 'ws_seed2',
        businessId: 'b_resto',
        at: iso(DAY),
        lines: [{ ingredientId: null, itemId: 'mi_chicken_biryani', name: 'Chicken Biryani', qty: 6, baseUnit: null, cost: 1350, reason: 'leftover' }],
        cost: 1350,
        note: 'End of night',
      },
      {
        id: 'ws_seed3',
        businessId: 'b_resto',
        at: iso(4 * DAY),
        lines: [{ ingredientId: ingredientId('bb', 'tomato'), itemId: null, name: CANON.tomato.name, qty: 2000, baseUnit: 'g', cost: 360, reason: 'spoiled' }],
        cost: 360,
        note: null,
      },
    ],
    donations: [{ id: 'dn_seed1', businessId: 'b_resto', at: iso(3 * DAY), meals: 12, to: 'Edhi centre, Gulberg', note: null }],
    boxes: seedBoxes(now, today),
    ...seedGrowth(now, today),
    ...seedGrowthMore(now, today),
    reservations: [],
    pauses: [],
    orders: [],
    snoozed: {},
    aiUses: [],
    aiLimits: {},
    aiEnabled: true,
    nutritionFoods: seedNutritionFoods(),
    aliases: seedAliases(),
    priceRefs: seedPriceRefs(today),
    voiceCursor: {},
    idempotency: {},
    seq: 0,
  };
};

// ── Earlier reviews of Biryani Bazaar (review themes, 5C) ──
/** What customers wrote over eight weeks: mostly happy, a run of late and cold deliveries this week. */
const REVIEW_LINES: [rating: number, tags: string[], text: string][] = [
  [5, ['tasty', 'hot_and_fresh'], 'Biryani was hot and full of flavour. The raita was fresh too.'],
  [5, ['tasty'], 'Best biryani in Gulberg, the meat falls off the bone.'],
  [4, ['good_portion'], 'Generous portions, enough for two of us.'],
  [2, [], 'Took almost an hour and arrived late. The food was good once it came.'],
  [3, [], 'The karahi arrived cold, we had to heat it again.'],
  [5, ['well_packed', 'on_time'], 'Packed well, nothing spilled, and on time.'],
  [4, ['value_for_money'], 'Good value for the price. Will order again.'],
  [2, [], 'Too spicy for the kids even on mild.'],
  [3, [], 'Waited 70 minutes. Please tell us when it will be late.'],
  [4, ['tasty', 'hot_and_fresh'], 'Seekh kebabs were fresh off the grill, very tasty.'],
  [3, [], 'The gravy leaked into the bag, the box was not sealed.'],
  [5, ['tasty', 'good_portion'], 'Delicious and filling. The malai boti is the best thing on the menu.'],
  [2, [], 'Small portion of chicken in the biryani this time, mostly rice.'],
  [4, ['on_time'], 'Came on time and the rider was polite.'],
  [3, [], 'Food was lukewarm when it reached us.'],
];

/** One week each, newest first: how many reviews and which lines (this week leans late and cold). */
const REVIEW_WEEKS: number[][] = [
  [3, 4, 8, 14, 0, 2],
  [0, 5, 11, 6],
  [1, 9, 2, 6],
  [11, 12, 0],
  [13, 5, 1, 7],
  [0, 10, 6],
  [3, 2, 9],
  [1, 4, 5],
];

export const seedReviewHistory = (now: number = Date.now()): MockFoodReview[] => {
  const out: MockFoodReview[] = [];
  REVIEW_WEEKS.forEach((lines, w) => {
    lines.forEach((line, n) => {
      const [rating, tags, text] = REVIEW_LINES[line];
      // Spread over the week, never in the future.
      const at = now - (w * 7 + n) * DAY - (3 + n * 2) * 3_600_000;
      out.push({
        id: `frv_h${w}_${n}`,
        orderId: null,
        businessId: 'b_resto',
        userId: `u_guest_${(w * 5 + n) % 11}`,
        foodRating: rating,
        deliveryRating: rating <= 3 ? 2 : 5,
        tags,
        text,
        photos: [],
        vendorReply: w > 1 && rating >= 4 ? 'Thank you, see you again soon.' : null,
        repliedAt: w > 1 && rating >= 4 ? new Date(at + DAY).toISOString() : null,
        isHidden: false,
        hiddenReason: null,
        // Already part of the kitchen's seeded ratings (312): not counted again.
        seeded: true,
        createdAt: new Date(at).toISOString(),
      });
    });
  });
  return out;
};
