// ═══════════════════════════════════════════════════════
// MetroMatrix — The dummy API's stand-in for speech understanding
// ═══════════════════════════════════════════════════════
// The real API turns a clip into words (speech to text) and the words into
// one proposed action. Here a rule reader does the second half for typed
// text, in Urdu script, Roman Urdu and English ("5 kilo tamatar 1200
// rupay", "پہلا آرڈر قبول کرو، بیس منٹ", "bought 10 kg chicken for 6200"),
// and a recording is answered with the context's next demo phrase. Nothing
// here writes: the app confirms, then calls the ordinary endpoint.
// TODO(API_VOICE): docs/VOICE_ASSUMED.md — the 40 phrases below are its test set.

import { parseUnit, toBase, UNITS, type StandardUnit } from '../../../../utils/units';

export type VoiceContext = 'board' | 'stock' | 'purchases' | 'today' | 'search' | 'pantry';
export const VOICE_CONTEXTS: VoiceContext[] = ['board', 'stock', 'purchases', 'today', 'search', 'pantry'];

export interface VoiceWorld {
  today: string;
  ingredients: { id: string; name: string; key: string | null }[];
  aliases: { word: string; key: string }[];
  /** Canonical key → its usual name ("egg" → "Eggs"), for things the kitchen doesn't stock yet. */
  names: Record<string, string>;
  items: { id: string; name: string }[];
  /** The kitchen's open orders (board), oldest first. */
  orders: { id: string; code: string; status: string; placedAt: string }[];
}

export interface QtyLine {
  ingredientId: string | null;
  /** The canonical ingredient it was heard as (null: a word nobody knows yet). */
  key: string | null;
  name: string;
  qty: number;
  unit: StandardUnit;
  total: number | null;
}

export type VoiceAction =
  | { kind: 'order.accept'; orderId: string; code: string; etaMinutes: number | null }
  | { kind: 'order.reject'; orderId: string; code: string; reason: string }
  | { kind: 'order.ready'; orderId: string; code: string }
  | { kind: 'item.unavailable'; itemId: string; name: string }
  | { kind: 'vendor.busy'; extraMinutes: number }
  | { kind: 'purchase.add'; lines: QtyLine[] }
  | { kind: 'waste.log'; reason: string; lines: QtyLine[] }
  | { kind: 'stock.count'; lines: QtyLine[] }
  | { kind: 'portions.set'; lines: { itemId: string; name: string; portions: number }[] }
  | { kind: 'search'; query: string }
  | { kind: 'pantry.add'; lines: (Omit<QtyLine, 'ingredientId' | 'total'> & { expiresOn: string | null })[] };

export interface Interpretation {
  transcript: string;
  language: 'ur' | 'en';
  confidence: number;
  action: VoiceAction | null;
  alternatives: { transcript: string; action: VoiceAction }[];
}

// ── Words ──
const NUMBER_WORDS: Record<string, number> = {
  // Roman Urdu
  ek: 1, aik: 1, do: 2, teen: 3, char: 4, chaar: 4, panch: 5, paanch: 5, chay: 6, chhe: 6, che: 6, saat: 7, aath: 8, nau: 9,
  das: 10, gyarah: 11, barah: 12, baara: 12, terah: 13, chaudah: 14, pandrah: 15, solah: 16, satrah: 17, atharah: 18, unees: 19,
  bees: 20, pachees: 25, tees: 30, chalees: 40, pachas: 50, pachaas: 50, sau: 100,
  // Urdu script
  'ایک': 1, 'دو': 2, 'تین': 3, 'چار': 4, 'پانچ': 5, 'چھ': 6, 'سات': 7, 'آٹھ': 8, 'نو': 9, 'دس': 10, 'بارہ': 12, 'پندرہ': 15,
  'بیس': 20, 'پچیس': 25, 'تیس': 30, 'چالیس': 40, 'پچاس': 50, 'سو': 100,
  // English
  one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10, eleven: 11, twelve: 12,
  fifteen: 15, twenty: 20, thirty: 30, forty: 40, fifty: 50, hundred: 100,
};
const FRACTIONS: Record<string, number> = {
  aadha: 0.5, adha: 0.5, aadhi: 0.5, 'آدھا': 0.5, 'آدھی': 0.5, half: 0.5,
  dedh: 1.5, 'ڈیڑھ': 1.5,
  dhai: 2.5, dhaai: 2.5, 'ڈھائی': 2.5,
};
const THOUSAND = ['hazaar', 'hazar', 'ہزار', 'thousand'];
const SAWA = ['sawa', 'سوا'];
const PAUNE = ['paune', 'پونے'];
const PRICE_WORDS = ['rupay', 'rupaye', 'rupee', 'rupees', 'rs', 'روپے', 'روپیہ', 'rupiya'];
const MINUTE_WORDS = ['minute', 'minutes', 'min', 'mins', 'mint', 'منٹ'];
const SEPARATORS = ['aur', 'and', 'اور', ',', '،'];
const FILLER = new Set([
  'ka', 'ki', 'ke', 'ko', 'kay', 'ne', 'se', 'mein', 'me', 'liya', 'liye', 'li', 'kharida', 'khareeda', 'khareedi', 'kharidi', 'bought', 'buy',
  'for', 'of', 'the', 'a', 'an', 'we', 'have', 'has', 'left', 'bacha', 'bachi', 'bache', 'hai', 'hain', 'ho', 'gaya', 'gayi', 'gaye', 'is', 'are',
  'kharab', 'kharaab', 'spoiled', 'expired', 'wasted', 'waste', 'zaya', 'jal', 'burnt', 'gir', 'dropped', 'stock', 'count', 'today', 'aaj',
  'make', 'set', 'to', 'portions', 'portion', 'plates', 'plate', 'expiry', 'expires', 'expire', 'use', 'in', 'by', 'tak', 'agle', 'hafte',
  'next', 'week', 'tomorrow', 'kal', 'parson', 'mahine', 'month', 'din', 'days', 'day', 'of', 'cooking', 'litres', 'karo', 'kar', 'karna',
  'خریدا', 'لیا', 'خراب', 'ہو', 'گیا', 'گئی', 'ہے', 'ہیں', 'کا', 'کی', 'کے', 'آج', 'باقی', 'ضائع', 'کل', 'تک', 'میں',
]);
const DISH_WORDS: Record<string, string> = {
  'قورمہ': 'qorma', 'بریانی': 'biryani', 'دال': 'daal', 'چاول': 'chawal', 'کھیر': 'kheer', 'پلاؤ': 'pulao', 'قیمہ': 'keema',
  'آلو': 'aloo', 'کڑاہی': 'karahi', 'سیخ': 'seekh', 'کباب': 'kebab', 'تکہ': 'tikka', 'نان': 'naan', 'korma': 'qorma', 'kebabs': 'kebab',
};
const ROMAN_URDU_MARKERS = [
  'karo', 'kar', 'hai', 'hain', 'aaj', 'rupay', 'aur', 'ka', 'ki', 'kharab', 'gaya', 'gayi', 'pehla', 'tayyar', 'masroof', 'chahiye', 'mujhe',
  'agle', 'hafte', 'darjan', 'dhai', 'sawa', 'anday', 'dahi', 'bacha', 'murghi', 'chawal', 'tamatar', 'pyaz', 'aloo', 'khatam', 'naya', 'hum', 'kilo',
];

const has = (words: string[], ...needles: (string | RegExp)[]) =>
  needles.some(n => (typeof n === 'string' ? words.includes(n) : words.some(w => n.test(w))));

/** Urdu and Arabic digits → ASCII; Urdu punctuation → spaces; lower case. */
export const normalize = (raw: string) =>
  raw
    .replace(/[۰-۹]/g, d => String(d.charCodeAt(0) - 0x06f0))
    .replace(/[٠-٩]/g, d => String(d.charCodeAt(0) - 0x0660))
    .replace(/[۔؟!?.]/g, ' ')
    .replace(/([،,])/g, ' $1 ')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();

const URDU = /[؀-ۿ]/;
export const detectLanguage = (text: string): 'ur' | 'en' => {
  if (URDU.test(text)) return 'ur';
  const words = normalize(text).split(' ');
  return words.some(w => ROMAN_URDU_MARKERS.includes(w)) && !words.some(w => ['the', 'is', 'we', 'for', 'bought', 'order'].includes(w) && !words.includes('karo'))
    ? 'ur'
    : 'en';
};

interface Token {
  word: string;
  num?: number;
  unit?: StandardUnit;
  price?: boolean;
  minutes?: boolean;
  sep?: boolean;
}

/** Words → tokens with numbers (2, "do", "dhai", "sawa kilo", "do hazaar"), units, price and minute words. */
const tokenize = (text: string): Token[] => {
  const words = normalize(text).replace(/\bkar do\b/g, 'karo').replace(/\bkardo\b/g, 'karo').replace(/کر دو/g, 'کرو').split(' ');
  const out: Token[] = [];
  for (let n = 0; n < words.length; n++) {
    const w = words[n];
    if (!w) continue;
    if (SEPARATORS.includes(w)) {
      out.push({ word: w, sep: true });
      continue;
    }
    if (PRICE_WORDS.includes(w)) {
      out.push({ word: w, price: true });
      continue;
    }
    if (MINUTE_WORDS.includes(w)) {
      out.push({ word: w, minutes: true });
      continue;
    }
    if (THOUSAND.includes(w) && out.length && out[out.length - 1].num !== undefined) {
      out[out.length - 1].num! *= 1000;
      continue;
    }
    if ((SAWA.includes(w) || PAUNE.includes(w)) && n + 1 < words.length) {
      const next = words[n + 1];
      const base = /^\d+(\.\d+)?$/.test(next) ? Number(next) : (NUMBER_WORDS[next] ?? null);
      const delta = SAWA.includes(w) ? 0.25 : -0.25;
      if (base !== null) {
        out.push({ word: `${w} ${next}`, num: base + delta });
        n++;
      } else out.push({ word: w, num: 1 + delta });
      continue;
    }
    const numeric = w.match(/^(\d+(?:\.\d+)?)([a-z]+)?$/);
    if (numeric) {
      out.push({ word: w, num: Number(numeric[1]) });
      const u = numeric[2] ? parseUnit(numeric[2]) : null;
      if (u) out.push({ word: numeric[2], unit: u });
      continue;
    }
    if (FRACTIONS[w] !== undefined) {
      out.push({ word: w, num: FRACTIONS[w] });
      continue;
    }
    if (NUMBER_WORDS[w] !== undefined) {
      out.push({ word: w, num: NUMBER_WORDS[w] });
      continue;
    }
    const u = parseUnit(w);
    if (u) {
      out.push({ word: w, unit: u });
      continue;
    }
    out.push({ word: w });
  }
  return out;
};

interface RawLine {
  qty: number | null;
  unit: StandardUnit | null;
  words: string[];
  total: number | null;
}

/** Tokens → lines of [qty][unit][name][price], split on "aur" / "and" / commas or a new quantity. */
const linesOf = (tokens: Token[]): RawLine[] => {
  const lines: RawLine[] = [];
  let cur: RawLine = { qty: null, unit: null, words: [], total: null };
  const close = () => {
    if (cur.qty !== null || cur.words.length) lines.push(cur);
    cur = { qty: null, unit: null, words: [], total: null };
  };
  for (let n = 0; n < tokens.length; n++) {
    const t = tokens[n];
    const next = tokens[n + 1];
    const prev = tokens[n - 1];
    if (t.sep) {
      close();
      continue;
    }
    if (t.num !== undefined) {
      const isPrice = next?.price || prev?.price || prev?.word === 'for' || (cur.qty !== null && cur.words.length > 0 && cur.total === null && !next?.unit && t.num >= 20);
      if (isPrice) {
        cur.total = Math.round(t.num);
        continue;
      }
      if (next?.minutes) continue;
      if (cur.qty !== null && (cur.words.length || cur.unit)) close();
      cur.qty = t.num;
      continue;
    }
    if (t.unit) {
      cur.unit = t.unit;
      continue;
    }
    if (t.price || t.minutes) continue;
    if (FILLER.has(t.word)) continue;
    cur.words.push(t.word);
  }
  close();
  return lines;
};

const matchKey = (words: string[], world: VoiceWorld): { key: string | null; used: number } => {
  for (let size = Math.min(3, words.length); size >= 1; size--) {
    for (let start = 0; start + size <= words.length; start++) {
      const phrase = words.slice(start, start + size).join(' ');
      const hit = world.aliases.find(a => a.word === phrase);
      if (hit) return { key: hit.key, used: size };
    }
  }
  return { key: null, used: 0 };
};

const titleCase = (s: string) => s.replace(/\b[a-z]/g, c => c.toUpperCase());

const resolveIngredient = (words: string[], world: VoiceWorld) => {
  const { key } = matchKey(words, world);
  const byKey = key ? world.ingredients.find(i => i.key === key) : undefined;
  if (byKey) return { ingredientId: byKey.id, name: byKey.name, key };
  const joined = words.join(' ');
  const byName = world.ingredients.find(i => joined && i.name.toLowerCase().includes(joined));
  if (byName) return { ingredientId: byName.id, name: byName.name, key: byName.key };
  return { ingredientId: null, name: (key && world.names[key]) || titleCase(joined), key };
};

const dishTokens = (s: string) =>
  normalize(s.replace(/[()]/g, ' '))
    .split(' ')
    .map(w => DISH_WORDS[w] ?? w)
    .filter(w => w && !FILLER.has(w) && !/^\d/.test(w) && w !== 'with' && w !== 'roti');

const resolveDish = (words: string[], world: VoiceWorld) => {
  const want = words.map(w => DISH_WORDS[w] ?? w).filter(w => !FILLER.has(w));
  let best: { id: string; name: string; score: number } | null = null;
  for (const i of world.items) {
    const tokens = dishTokens(i.name);
    const score = want.filter(w => tokens.includes(w)).length;
    if (score > 0 && (!best || score > best.score || (score === best.score && i.name.length < best.name.length))) best = { id: i.id, name: i.name, score };
  }
  return best;
};

const DEFAULT_UNIT: StandardUnit = 'kg';

const qtyLines = (raw: RawLine[], world: VoiceWorld): QtyLine[] =>
  raw
    .filter(l => l.qty !== null && l.words.length)
    .map(l => {
      const ing = resolveIngredient(l.words, world);
      const unit = l.unit ?? (ing.key === 'egg' || ing.key === 'lemon' ? 'pc' : DEFAULT_UNIT);
      return { ingredientId: ing.ingredientId, key: ing.key, name: ing.name, qty: l.qty!, unit, total: l.total };
    });

const minutesIn = (tokens: Token[]) => {
  const n = tokens.findIndex(t => t.minutes);
  return n > 0 && tokens[n - 1].num !== undefined ? Math.round(tokens[n - 1].num!) : null;
};

const expiryIn = (words: string[], today: string): string | null => {
  const plus = (d: number) => {
    const t = new Date(`${today}T00:00:00Z`);
    t.setUTCDate(t.getUTCDate() + d);
    return t.toISOString().slice(0, 10);
  };
  const joined = ` ${words.join(' ')} `;
  if (/ (agle hafte|next week|اگلے ہفتے) /.test(joined)) return plus(7);
  if (/ (agle mahine|next month|اگلے مہینے) /.test(joined)) return plus(30);
  if (/ (parson|پرسوں) /.test(joined)) return plus(2);
  const days = joined.match(/ (\d+) (din|days|day|دن) /);
  if (days) return plus(Number(days[1]));
  if (/ (kal|tomorrow|کل) /.test(joined)) return plus(1);
  return null;
};

const REASONS: [RegExp, string][] = [
  [/busy|masroof|مصروف|rush/, 'too_busy'],
  [/khatam|ختم|finished|item|nahi hai|available/, 'item_unavailable'],
  [/band|closing|closed|بند/, 'closing_soon'],
  [/door|far|area|دور/, 'out_of_area'],
];

const WASTE_REASONS: [RegExp, string][] = [
  [/expired|expire|expiry/, 'expired'],
  [/kharab|kharaab|خراب|spoiled|spoilt|rotten|sar gaya/, 'spoiled'],
  [/jal|burnt|burned|جل/, 'burnt'],
  [/gir|dropped|spilled|گر/, 'dropped'],
];

const pickOrder = (words: string[], text: string, world: VoiceWorld, statuses: string[]) => {
  const code = text.match(/fc[-\s]?([a-z0-9]{6})/i);
  const pool = world.orders.filter(o => statuses.includes(o.status));
  if (code) {
    const o = world.orders.find(x => x.code.toLowerCase() === `fc-${code[1].toLowerCase()}`);
    return o ? { order: o, how: 'code' as const, pool } : { order: null, how: 'code' as const, pool };
  }
  if (!pool.length) return { order: null, how: 'none' as const, pool };
  if (has(words, 'latest', 'naya', 'نیا', 'new', 'aakhri', 'last', 'newest', 'آخری')) return { order: pool[pool.length - 1], how: 'named' as const, pool };
  if (has(words, 'pehla', 'pehle', 'first', 'پہلا', 'oldest', 'purana')) return { order: pool[0], how: 'named' as const, pool };
  return { order: pool[0], how: pool.length === 1 ? ('only' as const) : ('guess' as const), pool };
};

const confidenceOf = (how: string) => (how === 'code' || how === 'only' ? 0.92 : how === 'named' ? 0.85 : 0.6);

const board = (text: string, world: VoiceWorld): Omit<Interpretation, 'transcript' | 'language'> => {
  const tokens = tokenize(text);
  const words = tokens.map(t => t.word);
  const joined = words.join(' ');
  const alt = (pool: VoiceWorld['orders'], chosen: string, make: (o: VoiceWorld['orders'][number]) => VoiceAction) =>
    pool.filter(o => o.id !== chosen).slice(0, 2).map(o => ({ transcript: `${text} (${o.code})`, action: make(o) }));
  if (has(words, 'reject', 'cancel', 'mana', 'منع', 'decline', 'inkar', 'انکار', 'reject karo')) {
    const p = pickOrder(words, text, world, ['placed']);
    if (!p.order) return { confidence: 0.3, action: null, alternatives: [] };
    const reason = REASONS.find(([re]) => re.test(joined))?.[1] ?? 'too_busy';
    const make = (o: VoiceWorld['orders'][number]): VoiceAction => ({ kind: 'order.reject', orderId: o.id, code: o.code, reason });
    return { confidence: confidenceOf(p.how), action: make(p.order), alternatives: p.how === 'guess' ? alt(p.pool, p.order.id, make) : [] };
  }
  if (has(words, 'accept', 'qubool', 'qabool', 'قبول', 'manzoor', 'منظور', 'ok', 'okay')) {
    const p = pickOrder(words, text, world, ['placed']);
    if (!p.order) return { confidence: 0.3, action: null, alternatives: [] };
    const eta = minutesIn(tokens);
    const make = (o: VoiceWorld['orders'][number]): VoiceAction => ({ kind: 'order.accept', orderId: o.id, code: o.code, etaMinutes: eta });
    return { confidence: confidenceOf(p.how), action: make(p.order), alternatives: p.how === 'guess' ? alt(p.pool, p.order.id, make) : [] };
  }
  if (has(words, 'ready', 'tayyar', 'tayar', 'تیار')) {
    const p = pickOrder(words, text, world, ['accepted', 'preparing']);
    if (!p.order) return { confidence: 0.3, action: null, alternatives: [] };
    const make = (o: VoiceWorld['orders'][number]): VoiceAction => ({ kind: 'order.ready', orderId: o.id, code: o.code });
    return { confidence: confidenceOf(p.how), action: make(p.order), alternatives: p.how === 'guess' ? alt(p.pool, p.order.id, make) : [] };
  }
  if (has(words, 'busy', 'masroof', 'مصروف', 'rush')) {
    const m = minutesIn(tokens) ?? tokens.find(t => t.num !== undefined)?.num ?? 15;
    return { confidence: 0.88, action: { kind: 'vendor.busy', extraMinutes: Math.max(5, Math.min(60, Math.round(m))) }, alternatives: [] };
  }
  if (/khatam|ختم|finished|out of stock|\b86\b|nahi hai|sold out/.test(joined)) {
    const dish = resolveDish(words.filter(w => !/khatam|ختم|finished|sold|out/.test(w)), world);
    if (!dish) return { confidence: 0.35, action: null, alternatives: [] };
    return { confidence: 0.86, action: { kind: 'item.unavailable', itemId: dish.id, name: dish.name }, alternatives: [] };
  }
  return { confidence: 0.3, action: null, alternatives: [] };
};

const quantities = (text: string, world: VoiceWorld, context: VoiceContext): Omit<Interpretation, 'transcript' | 'language'> => {
  const tokens = tokenize(text);
  const words = tokens.map(t => t.word);
  const joined = words.join(' ');
  const raw = linesOf(tokens);
  const lines = qtyLines(raw, world);
  if (!lines.length) return { confidence: 0.3, action: null, alternatives: [] };
  const matched = lines.every(l => l.ingredientId);
  const confidence = matched ? 0.9 : 0.7;
  const waste = WASTE_REASONS.find(([re]) => re.test(joined));
  const priced = lines.some(l => l.total !== null);
  if (context === 'stock' && waste && !priced) return { confidence, action: { kind: 'waste.log', reason: waste[1], lines }, alternatives: [] };
  if (context === 'stock' && !priced && /bacha|باقی|left|have|count|stock|remaining/.test(joined)) {
    return { confidence, action: { kind: 'stock.count', lines }, alternatives: [] };
  }
  return { confidence: priced ? confidence : Math.min(confidence, 0.75), action: { kind: 'purchase.add', lines }, alternatives: [] };
};

const today = (text: string, world: VoiceWorld): Omit<Interpretation, 'transcript' | 'language'> => {
  const tokens = tokenize(text);
  const out: { itemId: string; name: string; portions: number }[] = [];
  for (const l of linesOf(tokens)) {
    if (l.qty === null || !l.words.length) continue;
    const dish = resolveDish(l.words, world);
    if (dish && !out.some(o => o.itemId === dish.id)) out.push({ itemId: dish.id, name: dish.name, portions: Math.round(l.qty) });
  }
  return out.length ? { confidence: 0.9, action: { kind: 'portions.set', lines: out }, alternatives: [] } : { confidence: 0.3, action: null, alternatives: [] };
};

const SEARCH_FILLER = new Set(['mujhe', 'chahiye', 'dikhao', 'near', 'me', 'nearby', 'order', 'khana', 'something', 'with', 'want', 'i', 'show', 'find', 'please', 'mangwao', 'مجھے', 'چاہیے']);
const search = (text: string): Omit<Interpretation, 'transcript' | 'language'> => {
  const words = normalize(text)
    .split(' ')
    .map(w => DISH_WORDS[w] ?? w)
    .filter(w => w && !SEARCH_FILLER.has(w));
  const query = words.join(' ').trim();
  return query ? { confidence: 0.85, action: { kind: 'search', query }, alternatives: [] } : { confidence: 0.3, action: null, alternatives: [] };
};

const pantry = (text: string, world: VoiceWorld): Omit<Interpretation, 'transcript' | 'language'> => {
  const tokens = tokenize(text);
  const words = tokens.map(t => t.word);
  const expiresOn = expiryIn(words, world.today);
  const lines = linesOf(tokens)
    .filter(l => l.qty !== null && l.words.length)
    .map(l => {
      const { key } = matchKey(l.words, world);
      const unit = l.unit ?? (key === 'egg' || key === 'lemon' ? 'pc' : DEFAULT_UNIT);
      return { key, name: (key && world.names[key]) || titleCase(l.words.join(' ')), qty: l.qty!, unit, expiresOn };
    });
  return lines.length ? { confidence: lines.every(l => l.key) ? 0.88 : 0.7, action: { kind: 'pantry.add', lines }, alternatives: [] } : { confidence: 0.3, action: null, alternatives: [] };
};

export const interpret = (text: string, context: VoiceContext, world: VoiceWorld): Interpretation => {
  const transcript = text.trim().replace(/\s+/g, ' ');
  const language = detectLanguage(transcript);
  const r =
    context === 'board'
      ? board(transcript, world)
      : context === 'today'
        ? today(transcript, world)
        : context === 'search'
          ? search(transcript)
          : context === 'pantry'
            ? pantry(transcript, world)
            : quantities(transcript, world, context);
  return { transcript, language, ...r };
};

/** A line's quantity in base units (what the ordinary endpoints take). */
export const baseQtyOf = (l: { qty: number; unit: StandardUnit }) => toBase(l.qty, l.unit);
export const baseUnitOf = (u: StandardUnit) => UNITS[u].base;

// ── The 40 test phrases (docs/VOICE_ASSUMED.md §4) ──
// Board phrases run against two new orders and one cooking; stock and
// purchases against Biryani Bazaar's stock; today against Ammi ka Khana's
// menu; pantry against the shared ingredient words.
export interface VoicePhrase {
  context: VoiceContext;
  text: string;
  expect: Record<string, unknown>;
}

export const VOICE_TEST_PHRASES: VoicePhrase[] = [
  // Board (10)
  { context: 'board', text: 'pehla order accept karo, 20 minute', expect: { kind: 'order.accept', order: 'oldest', etaMinutes: 20 } },
  { context: 'board', text: 'پہلا آرڈر قبول کرو، بیس منٹ', expect: { kind: 'order.accept', order: 'oldest', etaMinutes: 20 } },
  { context: 'board', text: 'accept the latest order, ready in 15 minutes', expect: { kind: 'order.accept', order: 'newest', etaMinutes: 15 } },
  { context: 'board', text: 'naya order reject karo, item khatam hai', expect: { kind: 'order.reject', order: 'newest', reason: 'item_unavailable' } },
  { context: 'board', text: 'reject the first order, we are too busy', expect: { kind: 'order.reject', order: 'oldest', reason: 'too_busy' } },
  { context: 'board', text: 'pehla order tayyar hai', expect: { kind: 'order.ready', order: 'cooking' } },
  { context: 'board', text: 'chicken biryani khatam ho gayi', expect: { kind: 'item.unavailable', itemId: 'mi_chicken_biryani' } },
  { context: 'board', text: 'seekh kebab is finished for today', expect: { kind: 'item.unavailable', itemId: 'mi_seekh' } },
  { context: 'board', text: 'hum masroof hain, 15 minute extra', expect: { kind: 'vendor.busy', extraMinutes: 15 } },
  { context: 'board', text: 'we are busy, add 20 minutes', expect: { kind: 'vendor.busy', extraMinutes: 20 } },
  // Stock (8)
  { context: 'stock', text: '5 kilo tamatar 1200 rupay', expect: { kind: 'purchase.add', lines: [{ key: 'tomato', base: 5000, total: 1200 }] } },
  { context: 'stock', text: '2 kilo pyaz kharab ho gaya', expect: { kind: 'waste.log', reason: 'spoiled', lines: [{ key: 'onion', base: 2000 }] } },
  { context: 'stock', text: '۵ کلو ٹماٹر ۱۲۰۰ روپے', expect: { kind: 'purchase.add', lines: [{ key: 'tomato', base: 5000, total: 1200 }] } },
  { context: 'stock', text: 'دو کلو پیاز خراب ہو گیا', expect: { kind: 'waste.log', reason: 'spoiled', lines: [{ key: 'onion', base: 2000 }] } },
  { context: 'stock', text: 'bought 10 kg chicken for 6200 rupees', expect: { kind: 'purchase.add', lines: [{ key: 'chicken', base: 10000, total: 6200 }] } },
  { context: 'stock', text: '3 litres of milk expired', expect: { kind: 'waste.log', reason: 'expired', lines: [{ key: 'milk', base: 3000 }] } },
  { context: 'stock', text: 'dahi 4 kilo bacha hai', expect: { kind: 'stock.count', lines: [{ key: 'yoghurt', base: 4000 }] } },
  { context: 'stock', text: 'we have 12 kilo rice left', expect: { kind: 'stock.count', lines: [{ key: 'rice', base: 12000 }] } },
  // Purchases (6)
  { context: 'purchases', text: 'dhai kilo murghi 1550 rupay', expect: { kind: 'purchase.add', lines: [{ key: 'chicken', base: 2500, total: 1550 }] } },
  { context: 'purchases', text: 'do darjan anday 720 rupay', expect: { kind: 'purchase.add', lines: [{ name: 'Eggs', base: 24, total: 720 }] } },
  { context: 'purchases', text: 'آدھا کلو ادرک لہسن ۳۰۰ روپے', expect: { kind: 'purchase.add', lines: [{ key: 'ginger_garlic', base: 500, total: 300 }] } },
  { context: 'purchases', text: '5 kilo aloo 450 aur 3 kilo pyaz 390', expect: { kind: 'purchase.add', lines: [{ key: 'potato', base: 5000, total: 450 }, { key: 'onion', base: 3000, total: 390 }] } },
  { context: 'purchases', text: '20 litre cooking oil for 11200', expect: { kind: 'purchase.add', lines: [{ key: 'oil', base: 20000, total: 11200 }] } },
  { context: 'purchases', text: 'sawa kilo dhania 200 rupay', expect: { kind: 'purchase.add', lines: [{ key: 'coriander', base: 1250, total: 200 }] } },
  // Today, a home kitchen (5)
  { context: 'today', text: 'aaj 20 qorma', expect: { kind: 'portions.set', lines: [{ itemId: 'mi_qorma', portions: 20 }] } },
  { context: 'today', text: 'aaj 15 daal chawal aur 10 kheer', expect: { kind: 'portions.set', lines: [{ itemId: 'mi_daal', portions: 15 }, { itemId: 'mi_homek_kheer', portions: 10 }] } },
  { context: 'today', text: 'آج بیس قورمہ', expect: { kind: 'portions.set', lines: [{ itemId: 'mi_qorma', portions: 20 }] } },
  { context: 'today', text: 'make 12 pulao today', expect: { kind: 'portions.set', lines: [{ itemId: 'mi_pulao', portions: 12 }] } },
  { context: 'today', text: 'set aloo keema to 8 portions', expect: { kind: 'portions.set', lines: [{ itemId: 'mi_aloo_keema', portions: 8 }] } },
  // Customer search (5)
  { context: 'search', text: 'biryani', expect: { kind: 'search', query: 'biryani' } },
  { context: 'search', text: 'mujhe karahi chahiye', expect: { kind: 'search', query: 'karahi' } },
  { context: 'search', text: 'بریانی', expect: { kind: 'search', query: 'biryani' } },
  { context: 'search', text: 'shawarma near me', expect: { kind: 'search', query: 'shawarma' } },
  { context: 'search', text: 'chicken tikka pizza', expect: { kind: 'search', query: 'chicken tikka pizza' } },
  // Customer pantry (6)
  { context: 'pantry', text: 'do kilo aloo, expiry agle hafte', expect: { kind: 'pantry.add', lines: [{ key: 'potato', base: 2000, expiresInDays: 7 }] } },
  { context: 'pantry', text: 'ایک درجن انڈے', expect: { kind: 'pantry.add', lines: [{ key: 'egg', base: 12 }] } },
  { context: 'pantry', text: '1 litre milk expires tomorrow', expect: { kind: 'pantry.add', lines: [{ key: 'milk', base: 1000, expiresInDays: 1 }] } },
  { context: 'pantry', text: 'aadha kilo dahi kal tak', expect: { kind: 'pantry.add', lines: [{ key: 'yoghurt', base: 500, expiresInDays: 1 }] } },
  { context: 'pantry', text: '3 kilo chawal', expect: { kind: 'pantry.add', lines: [{ key: 'rice', base: 3000 }] } },
  { context: 'pantry', text: 'two kilos of tomatoes, use in 3 days', expect: { kind: 'pantry.add', lines: [{ key: 'tomato', base: 2000, expiresInDays: 3 }] } },
];

/** What a recording "said" in the dummy API: the context's phrases in turn. */
export const DEMO_PHRASES: Record<VoiceContext, string[]> = VOICE_CONTEXTS.reduce(
  (acc, c) => ({ ...acc, [c]: VOICE_TEST_PHRASES.filter(p => p.context === c).map(p => p.text) }),
  {} as Record<VoiceContext, string[]>,
);
