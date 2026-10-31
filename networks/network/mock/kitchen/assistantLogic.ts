// ═══════════════════════════════════════════════════════
// MetroMatrix — Dummy assistant (5C): descriptions, specials, combos,
// photo check, review themes, and a kitchen's nutrition
// ═══════════════════════════════════════════════════════
// Rules and templates stand in for the model: the same input gives the
// same draft, and nothing here writes (the app confirms through the
// ordinary menu, recipe and promotion endpoints). Nutrition is worked out
// from recipe cards and the nutrition foods each ingredient maps to; a dish
// without a card gets an estimate from its name, marked as one.
// TODO(API_AI): docs/AI_ASSUMED.md §3. TODO(API_KITCHEN): §4.7 (nutrition).

import type { MockDb } from '../mockDb';
import type { MockFoodReview, MockFoodVendor, MockMenuItem } from '../food/foodTypes';
import { addDays, dateInZone, isoWeekday } from '../../../../utils/healthTime';
import type { MockIngredient, MockNutritionFood } from './kitchenTypes';
import { costOf, costView, defaultVariantOf, expiringOf, ingredientsOf, itemsOf, k, onHandOf, recipeCost, recipeFor, settingsOf, todayOf } from './kitchenLogic';
import { hashOf } from './aiStandIns';

const round10 = (n: number) => Math.max(10, Math.round(n / 10) * 10);
const down10 = (n: number) => Math.max(10, Math.floor(n / 10) * 10);

// ── Urdu, for the description drafts ──
/** Common words in dish names. Unknown words stay as written (a draft the cook edits). */
const UR_WORDS: Record<string, string> = {
  chicken: 'چکن', mutton: 'مٹن', beef: 'بیف', biryani: 'بریانی', karahi: 'کڑاہی', seekh: 'سیخ', kebab: 'کباب', kebabs: 'کباب',
  naan: 'نان', kheer: 'کھیر', lassi: 'لسی', malai: 'ملائی', boti: 'بوٹی', half: 'ہاف', full: 'فل', raita: 'رائتہ',
  salad: 'سلاد', daal: 'دال', chawal: 'چاول', qorma: 'قورمہ', pulao: 'پلاؤ', haleem: 'حلیم', nihari: 'نہاری',
  paratha: 'پراٹھا', burger: 'برگر', fries: 'فرائز', roll: 'رول', tikka: 'تکہ', zarda: 'زردہ', smash: 'سمیش',
  cheese: 'چیز', shake: 'شیک', soft: 'سافٹ', drink: 'ڈرنک', solo: 'سولو', family: 'فیملی', deal: 'ڈیل', aloo: 'آلو',
  gosht: 'گوشت', pcs: 'عدد', chai: 'چائے', tea: 'چائے', mango: 'آم', sweet: 'میٹھی', salted: 'نمکین', plain: 'سادہ',
  garlic: 'لہسن', butter: 'مکھن', double: 'ڈبل', fried: 'فرائیڈ', rice: 'چاول', egg: 'انڈا', omelette: 'آملیٹ',
  sindhi: 'سندھی', wings: 'ونگز', classic: 'کلاسک', spicy: 'مصالحے دار', keema: 'قیمہ', chapli: 'چپلی', handi: 'ہانڈی',
  achar: 'اچار', achaar: 'اچار', roti: 'روٹی', kulfi: 'قلفی', box: 'باکس', meal: 'میل', special: 'اسپیشل',
};
const UR_JOIN = (xs: string[]) => (xs.length < 2 ? xs.join('') : `${xs.slice(0, -1).join('، ')} اور ${xs[xs.length - 1]}`);
const EN_JOIN = (xs: string[]) => (xs.length < 2 ? xs.join('') : `${xs.slice(0, -1).join(', ')} and ${xs[xs.length - 1]}`);

export const urduName = (name: string) =>
  name
    .replace(/[()]/g, ' ')
    .split(/\s+/)
    .filter(Boolean)
    .map(w => UR_WORDS[w.toLowerCase().replace(/[^a-z]/g, '')] ?? w)
    .join(' ');

/** An ingredient's Urdu word, from the aliases staff keep. */
const urduOf = (db: MockDb, key: string | null) => (key ? (k(db).aliases.find(a => a.key === key && a.language === 'ur')?.word ?? null) : null);

/** Lines that say what a dish is: the biggest by weight, not oil, salt, water or spices. */
const mainLines = (db: MockDb, businessId: string, i: MockMenuItem) => {
  const r = recipeFor(db, businessId, i.id, defaultVariantOf(i)?.id ?? null);
  if (!r) return [];
  return [...r.lines]
    .map(l => ({ l, ing: k(db).ingredients.find(x => x.id === l.ingredientId) }))
    .filter((x): x is { l: (typeof r.lines)[number]; ing: MockIngredient } => !!x.ing && !['spices', 'oils_ghee', 'packaging', 'other'].includes(x.ing.category))
    .sort((a, b) => b.l.qty - a.l.qty)
    .slice(0, 3)
    .map(x => x.ing);
};

export const describeItem = (db: MockDb, businessId: string, i: MockMenuItem) => {
  const mains = mainLines(db, businessId, i);
  const r = recipeFor(db, businessId, i.id, defaultVariantOf(i)?.id ?? null);
  // Spices beyond salt: "our own spice mix".
  const spiced = !!r?.lines.some(l => {
    const ing = k(db).ingredients.find(x => x.id === l.ingredientId);
    return ing?.category === 'spices' && ing.priceRefKey !== 'salt';
  });
  const urName = urduName(i.name);
  const enTail = [i.tags.includes('bestseller') ? 'One of our best sellers.' : null, i.tags.includes('spicy') ? 'Spicy.' : null, 'Made fresh every day.'].filter(Boolean).join(' ');
  const urTail = [i.tags.includes('bestseller') ? 'ہمارے سب سے پسندیدہ پکوانوں میں سے۔' : null, i.tags.includes('spicy') ? 'مصالحے دار۔' : null, 'روزانہ تازہ۔'].filter(Boolean).join(' ');
  if (!mains.length) {
    return {
      en: `${i.name}, cooked to order in our kitchen. ${enTail}`.slice(0, 300),
      ur: `${urName}، ہمارے کچن میں آرڈر پر تیار کردہ۔ ${urTail}`.slice(0, 300),
    };
  }
  const enParts = mains.map(m => m.name.toLowerCase());
  const urParts = [...mains.map(m => urduOf(db, m.priceRefKey) ?? m.name), ...(spiced ? ['ہمارے اپنے مصالحوں'] : [])];
  return {
    en: `${i.name}: ${EN_JOIN(enParts)}${spiced ? ', cooked with our own spice mix' : ''}. ${enTail}`.slice(0, 300),
    ur: `${urName}: ${UR_JOIN(urParts)} سے تیار کردہ۔ ${urTail}`.slice(0, 300),
  };
};

// ── Today's specials, from what expires soonest ──
/** What a cook might make from an ingredient that has to go, with the rest it needs (base units a serving). */
const SPECIAL_IDEAS: Record<string, { title: string; description: string; lines: [string, number][] }> = {
  chicken: { title: 'Chicken tikka plate', description: 'Chargrilled chicken tikka with naan, raita and salad.', lines: [['chicken', 220], ['yoghurt', 40], ['red_chilli', 4], ['lemon', 10], ['onion', 30]] },
  chicken_boneless: { title: 'Chicken handi', description: 'Boneless chicken in a creamy tomato handi gravy.', lines: [['chicken_boneless', 200], ['tomato', 80], ['cream', 30], ['onion', 40], ['garam_masala', 4]] },
  chicken_wings: { title: 'Chilli garlic wings', description: 'Six wings tossed in chilli garlic, with a dip.', lines: [['chicken_wings', 240], ['ginger_garlic', 15], ['red_chilli', 5], ['mayo', 25]] },
  chicken_thigh: { title: 'Peri thigh plate', description: 'Spiced chicken thighs with fries.', lines: [['chicken_thigh', 220], ['potato', 150], ['red_chilli', 4], ['oil', 20]] },
  beef_mince: { title: 'Keema naan', description: 'Spiced beef keema baked into a naan, with chutney.', lines: [['beef_mince', 120], ['flour', 110], ['onion', 30], ['garam_masala', 3]] },
  beef: { title: 'Beef pulao', description: 'Beef and rice cooked together in yakhni.', lines: [['beef', 150], ['rice', 140], ['onion', 50], ['oil', 20]] },
  mutton: { title: 'Mutton chops', description: 'Marinated chops off the grill, with naan.', lines: [['mutton', 220], ['yoghurt', 30], ['ginger_garlic', 10], ['lemon', 10]] },
  milk: { title: 'Kheer', description: 'Slow-cooked rice pudding with almonds and cardamom.', lines: [['milk', 250], ['rice', 25], ['sugar', 30], ['almonds', 5], ['cardamom', 1]] },
  yoghurt: { title: 'Lassi', description: 'Thick sweet lassi, made today.', lines: [['yoghurt', 250], ['milk', 50], ['sugar', 25]] },
  cream: { title: 'Malai boti plate', description: 'Creamy malai boti with naan.', lines: [['chicken_boneless', 180], ['cream', 50], ['ginger_garlic', 10]] },
  tomato: { title: 'Tomato daal', description: 'Masoor daal with a tomato and garlic tarka.', lines: [['masoor_daal', 80], ['tomato', 100], ['ginger_garlic', 10], ['ghee', 15]] },
  potato: { title: 'Aloo paratha', description: 'Two spiced potato parathas with yoghurt.', lines: [['potato', 180], ['atta', 140], ['ghee', 20], ['yoghurt', 60]] },
  egg: { title: 'Anda paratha roll', description: 'Egg and paratha roll with chutney.', lines: [['egg', 2], ['atta', 90], ['onion', 20], ['ghee', 10]] },
  lettuce: { title: 'Chicken salad bowl', description: 'Crisp lettuce, grilled chicken and a lemon dressing.', lines: [['lettuce', 120], ['chicken_boneless', 120], ['lemon', 10], ['cucumber', 60]] },
  cheese_slice: { title: 'Double cheese melt', description: 'A grilled cheese and chicken melt.', lines: [['cheese_slice', 3], ['burger_bun', 1], ['chicken_boneless', 90]] },
};

export interface SpecialIdea {
  id: string;
  title: string;
  description: string;
  uses: string[];
  usesExpiring: string[];
  lines: { ingredientId: string; qty: number }[];
  suggestedPrice: number;
  cost: ReturnType<typeof costView>;
}

export const specialIdeas = (db: MockDb, v: MockFoodVendor, ingredientIds: string[] | null, now: number): SpecialIdea[] => {
  const today = todayOf(v, now);
  const mine = ingredientsOf(db, v.businessId);
  const byKey = (key: string) => mine.find(i => i.priceRefKey === key && onHandOf(db, i) > 0) ?? mine.find(i => i.priceRefKey === key) ?? null;
  const picked = ingredientIds?.length
    ? mine.filter(i => ingredientIds.includes(i.id))
    : mine
        .map(i => ({ i, e: expiringOf(db, i, today) }))
        .filter((x): x is { i: MockIngredient; e: NonNullable<ReturnType<typeof expiringOf>> } => !!x.e)
        .sort((a, b) => a.e.on.localeCompare(b.e.on))
        .map(x => x.i);
  const target = settingsOf(db, v.businessId).targetFoodCostPct;
  const out: SpecialIdea[] = [];
  for (const ing of picked) {
    const idea = ing.priceRefKey ? SPECIAL_IDEAS[ing.priceRefKey] : null;
    if (!idea || out.some(o => o.title === idea.title)) continue;
    const lines = idea.lines.map(([key, qty]) => ({ ing: key === ing.priceRefKey ? ing : byKey(key), qty })).filter((x): x is { ing: MockIngredient; qty: number } => !!x.ing);
    const toMake = lines.reduce((n, x) => n + x.qty * costOf(db, x.ing), 0);
    const price = round10(toMake / 0.35);
    const expiring = lines.filter(x => expiringOf(db, x.ing, today)).map(x => x.ing.name);
    out.push({
      id: `sp_${ing.priceRefKey}`,
      title: idea.title,
      description: idea.description,
      uses: lines.map(x => x.ing.name),
      usesExpiring: expiring.length ? expiring : [ing.name],
      lines: lines.map(x => ({ ingredientId: x.ing.id, qty: x.qty })),
      suggestedPrice: price,
      cost: costView(toMake, price, target),
    });
    if (out.length === 3) break;
  }
  return out;
};

// ── Combo ideas: dishes ordered together ──
const ROLE: [RegExp, 'main' | 'bread' | 'drink' | 'sweet' | 'side'][] = [
  [/naan|roti|paratha/i, 'bread'],
  [/drink|lassi|shake|chai|tea|cola|water/i, 'drink'],
  [/kheer|kulfi|zarda|halwa|ice cream|brownie/i, 'sweet'],
  [/raita|salad|fries|achaar/i, 'side'],
];
const roleOf = (i: MockMenuItem) => (i.isDeal ? null : (ROLE.find(([re]) => re.test(i.name))?.[1] ?? 'main'));
const AFFINITY: Record<string, number> = { bread: 0.34, drink: 0.26, side: 0.22, sweet: 0.14 };

export interface ComboIdea {
  id: string;
  itemIds: string[];
  names: string[];
  orderedTogether: number;
  regularPrice: number;
  bundlePrice: number;
  cost: ReturnType<typeof costView> | null;
}

/**
 * Pairs a main with a bread, drink, side or sweet. "Ordered together" is the
 * kitchen's own baskets in recorded orders plus, in the dummy API, an
 * estimate from each dish's daily sales (the demo kitchens' history is
 * daily counts, not baskets).
 */
export const comboIdeas = (db: MockDb, v: MockFoodVendor): ComboIdea[] => {
  const items = itemsOf(db, v.businessId).filter(i => !i.isDeal);
  const together = new Map<string, number>();
  for (const o of db.food.orders.filter(x => x.businessId === v.businessId)) {
    const ids = [...new Set((o.items as { itemId: string }[]).map(x => x.itemId))].sort();
    for (let a = 0; a < ids.length; a++) for (let b = a + 1; b < ids.length; b++) together.set(`${ids[a]}|${ids[b]}`, (together.get(`${ids[a]}|${ids[b]}`) ?? 0) + 1);
  }
  const mains = items.filter(i => roleOf(i) === 'main').sort((a, b) => b.sold30d - a.sold30d).slice(0, 4);
  const extras = items.filter(i => roleOf(i) && roleOf(i) !== 'main');
  const target = settingsOf(db, v.businessId).targetFoodCostPct;
  const priceOf = (i: MockMenuItem) => defaultVariantOf(i)?.price ?? i.basePrice;
  const costOfItem = (i: MockMenuItem) => {
    const r = recipeFor(db, v.businessId, i.id, defaultVariantOf(i)?.id ?? null);
    return r ? recipeCost(db, r, i).toMake : null;
  };
  const pairs: ComboIdea[] = [];
  for (const m of mains) {
    for (const x of extras) {
      const key = [m.id, x.id].sort().join('|');
      const estimate = Math.round(Math.min(m.sold30d, x.sold30d) * (AFFINITY[roleOf(x)!] ?? 0.1));
      const count = (together.get(key) ?? 0) + estimate;
      const regular = priceOf(m) + priceOf(x);
      const bundle = down10(regular * 0.9);
      const cm = costOfItem(m);
      const cx = costOfItem(x);
      pairs.push({
        id: `cb_${m.id}_${x.id}`,
        itemIds: [m.id, x.id],
        names: [m.name, x.name],
        orderedTogether: count,
        regularPrice: regular,
        bundlePrice: bundle,
        cost: cm !== null && cx !== null ? costView(cm + cx, bundle, target) : null,
      });
    }
  }
  // The most often together, one per main.
  const seen = new Set<string>();
  return pairs
    .sort((a, b) => b.orderedTogether - a.orderedTogether)
    .filter(p => (seen.has(p.itemIds[0]) ? false : (seen.add(p.itemIds[0]), true)))
    .slice(0, 3);
};

/** Where a new dish or deal goes: a category named like `want`, else the first one. */
export const categoryFor = (db: MockDb, businessId: string, want: RegExp) => {
  const cats = db.food.categories.filter(c => c.businessId === businessId && c.isActive).sort((a, b) => a.sort - b.sort);
  const c = cats.find(x => want.test(x.name)) ?? cats[0] ?? null;
  return c ? { id: c.id, name: c.name } : null;
};

// ── Photo check ──
const TIPS: { kind: 'light' | 'framing' | 'background' | 'focus'; text: string }[] = [
  { kind: 'light', text: 'Shoot by a window in daylight; the tube light makes the rice look grey.' },
  { kind: 'light', text: 'Turn off the flash: it flattens the gravy and adds glare on the plate.' },
  { kind: 'framing', text: 'Fill the frame with the dish and leave a little space around the plate.' },
  { kind: 'framing', text: 'Shoot from a little above, about where a customer sits.' },
  { kind: 'background', text: 'Use a plain surface: the steel counter behind it pulls the eye away.' },
  { kind: 'background', text: 'Clear the bottles and packets from the edges of the photo.' },
  { kind: 'focus', text: 'Tap the screen on the food before you shoot, so it is sharp.' },
  { kind: 'focus', text: 'Hold the phone with both hands; this one is a little blurred.' },
];

export const photoCheck = (imageUrl: string) => {
  const h = hashOf(imageUrl);
  const score = 55 + (h % 38);
  const kinds: ('light' | 'framing' | 'background' | 'focus')[] = ['light', 'framing', 'background', 'focus'];
  const picks = score >= 85 ? 1 : score >= 70 ? 2 : 3;
  const tips = Array.from({ length: picks }, (_, n) => {
    const kind = kinds[(h >>> (n * 3)) % kinds.length];
    const options = TIPS.filter(t => t.kind === kind);
    return options[(h >>> (n * 5 + 1)) % options.length];
  }).filter((t, n, all) => all.findIndex(x => x.text === t.text) === n);
  return { score, verdict: score >= 85 ? 'good' : score >= 70 ? 'ok' : 'retake', tips };
};

// ── Review themes ──
export interface ThemeRule {
  key: string;
  label: string;
  tone: 'positive' | 'negative';
  tags: string[];
  words: RegExp;
}

export const THEMES: ThemeRule[] = [
  { key: 'taste', label: 'Taste', tone: 'positive', tags: ['tasty'], words: /\b(tasty|delicious|maza|mazedar|zabardast|flavou?r|loved|best biryani)\b/i },
  { key: 'fresh', label: 'Hot and fresh', tone: 'positive', tags: ['hot_and_fresh'], words: /\b(hot|fresh|garam)\b/i },
  { key: 'portion', label: 'Good portions', tone: 'positive', tags: ['good_portion'], words: /\b(generous|filling|big portion|enough for two)\b/i },
  { key: 'packing', label: 'Well packed', tone: 'positive', tags: ['well_packed'], words: /\b(well packed|packed well|neatly packed|sealed)\b/i },
  { key: 'value', label: 'Value for money', tone: 'positive', tags: ['value_for_money'], words: /\b(value|worth|reasonable)\b/i },
  { key: 'late', label: 'Took too long', tone: 'negative', tags: [], words: /\b(late|longer|delay(ed)?|waited|slow|der)\b/i },
  { key: 'cold', label: 'Arrived cold', tone: 'negative', tags: [], words: /\b(cold|thanda|lukewarm)\b/i },
  { key: 'spice', label: 'Too spicy or salty', tone: 'negative', tags: [], words: /\b(too spicy|teekha|too much chilli|salty|namak)\b/i },
  { key: 'small', label: 'Small portions', tone: 'negative', tags: [], words: /\b(small|not enough|kam|less (rice|meat|chicken))\b/i },
  { key: 'spill', label: 'Spilled or leaked', tone: 'negative', tags: [], words: /\b(spill(ed)?|leak(ed|ing)?|messy)\b/i },
];

/** Mondays in the kitchen's own time. */
export const weekOf = (date: string) => addDays(date, 1 - isoWeekday(date));

export const themeMatches = (t: ThemeRule, r: Pick<MockFoodReview, 'tags' | 'text'>) => t.tags.some(x => r.tags.includes(x)) || (!!r.text && t.words.test(r.text));

/** A snippet without names, numbers or contact details. */
const anonymise = (s: string) =>
  s
    .replace(/\+?\d[\d\s-]{6,}\d/g, '[number]')
    .replace(/\b[A-Z][a-z]+(?= (bhai|sahib|ji)\b)/g, '[name]')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 140);

/** This week, or the latest of the last eight with a review (Monday morning shows last week). */
export const defaultReviewWeek = (db: MockDb, v: MockFoodVendor, now: number) => {
  const thisWeek = weekOf(todayOf(v, now));
  const rows = db.food.reviews.filter(r => r.businessId === v.businessId && !r.isHidden).map(r => weekOf(dateInZone(r.createdAt, v.timezone)));
  return Array.from({ length: 8 }, (_, n) => addDays(thisWeek, -7 * n)).find(w => rows.includes(w)) ?? thisWeek;
};

export const reviewThemes = (db: MockDb, v: MockFoodVendor, week: string, now: number) => {
  const rows = db.food.reviews.filter(r => r.businessId === v.businessId && !r.isHidden);
  const inWeek = rows.filter(r => weekOf(dateInZone(r.createdAt, v.timezone)) === week);
  const themes = THEMES.map(t => {
    const hits = inWeek.filter(r => themeMatches(t, r));
    return {
      key: t.key,
      label: t.label,
      tone: t.tone,
      count: hits.length,
      snippets: hits
        .filter(r => r.text)
        .slice(0, 3)
        .map(r => anonymise(r.text!)),
    };
  }).filter(t => t.count > 0);
  const weeks = Array.from({ length: 8 }, (_, n) => addDays(weekOf(todayOf(v, now)), -7 * n)).map(w => ({ week: w, count: rows.filter(r => weekOf(dateInZone(r.createdAt, v.timezone)) === w).length }));
  return { week, from: week, to: addDays(week, 6), reviewCount: inWeek.length, weeks, themes: themes.sort((a, b) => b.count - a.count) };
};

// ── Nutrition ──
const PER: Record<MockNutritionFood['per'], number> = { g100: 100, ml100: 100, piece: 1 };
/** Ingredients that add nothing worth counting. */
const IGNORED = new Set(['salt', 'water']);

/** A dish without a recipe card: a typical serving of what its name says. */
const ESTIMATES: [RegExp, [number, number, number, number]][] = [
  [/biryani/i, [690, 28, 82, 26]],
  [/karahi|handi|qorma/i, [620, 38, 12, 46]],
  [/kebab|tikka|boti|chops/i, [430, 42, 6, 26]],
  [/burger/i, [640, 30, 48, 36]],
  [/fries/i, [365, 4, 48, 17]],
  [/naan|paratha|roti/i, [262, 8, 46, 5]],
  [/kheer|zarda|kulfi/i, [330, 8, 48, 12]],
  [/lassi|shake/i, [260, 9, 38, 8]],
  [/drink|cola/i, [210, 0, 53, 0]],
  [/daal|dal/i, [310, 16, 42, 9]],
  [/deal/i, [980, 40, 120, 36]],
];

export interface NutritionRow {
  itemId: string;
  name: string;
  kcal: number | null;
  protein: number | null;
  carbs: number | null;
  fat: number | null;
  method: 'recipe' | 'ai_estimate' | 'none';
  confidence: number;
  hidden: boolean;
  missing: string[];
}

export const nutritionOf = (db: MockDb, businessId: string, i: MockMenuItem, estimatesAllowed: boolean): NutritionRow => {
  const hidden = (k(db).nutritionHidden ?? []).includes(i.id);
  const base = { itemId: i.id, name: i.name, hidden };
  const r = recipeFor(db, businessId, i.id, defaultVariantOf(i)?.id ?? null);
  if (r) {
    let kcal = 0;
    let protein = 0;
    let carbs = 0;
    let fat = 0;
    const missing: string[] = [];
    let counted = 0;
    for (const l of r.lines) {
      const ing = k(db).ingredients.find(x => x.id === l.ingredientId);
      if (!ing || ing.category === 'packaging' || IGNORED.has(ing.priceRefKey ?? '')) continue;
      const food = ing.nutritionFoodId ? k(db).nutritionFoods.find(f => f.id === ing.nutritionFoodId) : null;
      if (!food) {
        missing.push(ing.name);
        continue;
      }
      const f = l.qty / Math.max(1, r.yield) / PER[food.per];
      kcal += food.kcal * f;
      protein += food.protein * f;
      carbs += food.carbs * f;
      fat += food.fat * f;
      counted += 1;
    }
    if (counted) {
      return {
        ...base,
        kcal: Math.round(kcal),
        protein: Math.round(protein),
        carbs: Math.round(carbs),
        fat: Math.round(fat),
        method: 'recipe',
        confidence: Math.max(0.5, Math.round((0.95 - 0.12 * missing.length) * 100) / 100),
        missing,
      };
    }
  }
  if (!estimatesAllowed) return { ...base, kcal: null, protein: null, carbs: null, fat: null, method: 'none', confidence: 0, missing: [] };
  const hit = ESTIMATES.find(([re]) => re.test(i.name));
  const [kcal, protein, carbs, fat] = hit?.[1] ?? [520, 20, 55, 22];
  return { ...base, kcal, protein, carbs, fat, method: 'ai_estimate', confidence: hit ? 0.55 : 0.35, missing: [] };
};

/** Foods whose name shares a word with the ingredient's (the mapping's suggestions). */
export const foodSuggestions = (db: MockDb, name: string) => {
  const words = name.toLowerCase().split(/[^a-z]+/).filter(w => w.length > 2);
  return k(db)
    .nutritionFoods.map(f => ({ f, score: words.filter(w => f.name.toLowerCase().includes(w)).length }))
    .filter(x => x.score > 0)
    .sort((a, b) => b.score - a.score || a.f.name.localeCompare(b.f.name))
    .slice(0, 3)
    .map(x => ({ foodId: x.f.id, name: x.f.name, per: x.f.per }));
};
