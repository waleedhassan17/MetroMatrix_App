// ═══════════════════════════════════════════════════════
// MetroMatrix — Dummy insight cards and the Kitchen hub's numbers
// ═══════════════════════════════════════════════════════
// Answers first: up to five findings a cook should act on, most urgent
// first, each with one action. A card snoozed today stays away for 24
// hours. The hub's tiles get one live number each.
// TODO(API_KITCHEN): docs/API_KITCHEN_ASSUMED.md §3.8.

import type { MockDb } from '../mockDb';
import { dayOf } from './tiffinLogic';
import { demandWire, ramadanState, storefrontWire } from './growthLogic';
import { addDays } from '../../../../utils/health-time/healthTime';
import { formatPKR } from '../../../../utils/money/money';
import { formatQty } from '../../../../utils/units/units';
import {
  HOUR,
  costOf,
  defaultVariantOf,
  expiringOf,
  ingredientsOf,
  isoNow,
  itemsOf,
  k,
  latestCostOf,
  localHour,
  recipeCost,
  recipeFor,
  recipeStatusOf,
  settingsOf,
  stateOf,
  todayOf,
  vendorOf,
} from './kitchenLogic';
import { forecastDay } from './forecastLogic';

export type CardSeverity = 'critical' | 'warning' | 'info';

export interface InsightCard {
  id: string;
  kind: string;
  severity: CardSeverity;
  title: string;
  why: string;
  action: { kind: string; label: string; params: Record<string, string | number | string[]> };
}

const SEVERITY_ORDER: CardSeverity[] = ['critical', 'warning', 'info'];
export const MAX_CARDS = 5;
/** A price counts as "up" from this much over what the kitchen paid before. */
export const PRICE_RISE_PCT = 15;

const qty = (i: { baseUnit: 'g' | 'ml' | 'pc'; dozens: boolean }, n: number) => formatQty(n, i.baseUnit, { dozens: i.dozens });
const list = (names: string[]) => (names.length <= 2 ? names.join(' and ') : `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`);

/** What the kitchen paid before its latest delivery, on average (rupees per base unit). */
const previousCost = (db: MockDb, ingredientId: string) => {
  const all = k(db).batches.filter(b => b.ingredientId === ingredientId).sort((a, b) => b.receivedAt.localeCompare(a.receivedAt));
  const older = all.slice(1);
  const qtySum = older.reduce((n, b) => n + b.receivedQty, 0);
  return qtySum ? older.reduce((n, b) => n + b.receivedQty * b.costPerBase, 0) / qtySum : null;
};

/** Extra cards the later milestones add (tiffin, demand, experiments, reviews). */
type CardSource = (db: MockDb, businessId: string, now: number) => InsightCard[];
const extraSources: CardSource[] = [];
export const addCardSource = (s: CardSource) => {
  extraSources.push(s);
};

/** Expiring stock offers this action (a special from it once the assistant is on: 5C). */
let expiringAction: (ingredientIds: string[], db: MockDb) => InsightCard['action'] = () => ({ kind: 'create_surplus', label: 'Make a Bachat Box', params: {} });
export const setExpiringAction = (f: typeof expiringAction) => {
  expiringAction = f;
};

export const allCards = (db: MockDb, businessId: string, now: number): InsightCard[] => {
  const v = vendorOf(db, businessId);
  const today = todayOf(v, now);
  const hour = localHour(v, now);
  const ings = ingredientsOf(db, businessId);
  const cards: InsightCard[] = [];

  // Expiring today or tomorrow.
  const expiring = ings
    .map(i => ({ i, e: expiringOf(db, i, today) }))
    .filter(x => x.e && x.e.on <= addDays(today, 1) && x.i.category !== 'packaging')
    .sort((a, b) => a.e!.on.localeCompare(b.e!.on) || b.e!.qty * costOf(db, b.i) - a.e!.qty * costOf(db, a.i));
  if (expiring.length) {
    const first = expiring[0];
    const when = first.e!.on <= today ? 'today' : 'tomorrow';
    cards.push({
      id: `expiring_stock:${first.i.id}:${first.e!.on}`,
      kind: 'expiring_stock',
      severity: when === 'today' ? 'critical' : 'warning',
      title: `${qty(first.i, first.e!.qty)} ${first.i.name.toLowerCase()} expires ${when}`,
      why: expiring.length > 1 ? `${list(expiring.slice(1, 3).map(x => x.i.name))} too. Use them before they go to waste.` : 'Use it before it goes to waste.',
      action: expiringAction(expiring.map(x => x.i.id), db),
    });
  }

  // Used more than recorded.
  const negative = ings.filter(i => stateOf(db, i) === 'negative');
  if (negative.length) {
    const i = negative[0];
    cards.push({
      id: `negative_stock:${i.id}`,
      kind: 'negative_stock',
      severity: 'warning',
      title: `${i.name} is recorded below zero`,
      why: 'Orders used more than your stock shows. Count it to put the numbers right.',
      action: { kind: 'stock_take', label: 'Count stock', params: { ingredientIds: negative.map(x => x.id) } },
    });
  }

  // Running low.
  const low = ings.filter(i => stateOf(db, i) === 'low' || stateOf(db, i) === 'out');
  if (low.length) {
    cards.push({
      id: `running_low:${today}`,
      kind: 'running_low',
      severity: low.some(i => stateOf(db, i) === 'out') ? 'warning' : 'info',
      title: low.length === 1 ? `${low[0].name} is running low` : `${low.length} ingredients running low`,
      why: `${list(low.slice(0, 3).map(i => i.name))} ${low.length === 1 ? 'is' : 'are'} under the level you restock at.`,
      action: { kind: 'add_purchase', label: 'Add a purchase', params: {} },
    });
  }

  // Prices up on what the kitchen paid before, and the dish it hurts most.
  const items = itemsOf(db, businessId);
  const risen = ings
    .map(i => {
      const before = previousCost(db, i.id);
      const now_ = latestCostOf(db, i);
      return before && now_ > 0 ? { i, pct: Math.round(((now_ - before) / before) * 100) } : null;
    })
    .filter((x): x is { i: (typeof ings)[number]; pct: number } => !!x && x.pct >= PRICE_RISE_PCT && x.i.category !== 'packaging')
    .sort((a, b) => b.pct - a.pct);
  for (const r of risen.slice(0, 1)) {
    const hit = items
      .map(item => {
        const rec = recipeFor(db, businessId, item.id, defaultVariantOf(item)?.id ?? null);
        return rec && rec.lines.some(l => l.ingredientId === r.i.id) ? { item, cost: recipeCost(db, rec, item) } : null;
      })
      .filter((x): x is NonNullable<typeof x> => !!x)
      .sort((a, b) => a.cost.keepPct - b.cost.keepPct)[0];
    cards.push({
      id: `price_rise:${r.i.id}:${today}`,
      kind: 'price_rise',
      severity: 'info',
      title: `${r.i.name} up ${r.pct}%`,
      why: hit ? `${hit.item.name} now costs ${formatPKR(hit.cost.toMake)} to make. You keep ${hit.cost.keepPct}%.` : 'Check the dishes that use it.',
      action: hit ? { kind: 'open_recipe', label: 'Check the recipe', params: { itemId: hit.item.id } } : { kind: 'open_ingredient', label: 'See the price', params: { ingredientId: r.i.id } },
    });
  }

  // Over the food-cost target.
  const target = settingsOf(db, businessId).targetFoodCostPct;
  const over = items
    .map(item => {
      const rec = recipeFor(db, businessId, item.id, defaultVariantOf(item)?.id ?? null);
      return rec ? { item, cost: recipeCost(db, rec, item) } : null;
    })
    .filter((x): x is NonNullable<typeof x> => !!x && x.cost.overTarget)
    .sort((a, b) => b.cost.foodCostPct - a.cost.foodCostPct);
  if (over.length) {
    const o = over[0];
    cards.push({
      id: `food_cost_high:${o.item.id}`,
      kind: 'food_cost_high',
      severity: 'warning',
      title: `${o.item.name} costs ${o.cost.foodCostPct}% of its price to make`,
      why: `Your target is ${target}%. Raise the price a little or trim the recipe.`,
      action: { kind: 'open_recipe', label: 'Open the recipe', params: { itemId: o.item.id } },
    });
  }

  // Dishes without a recipe card.
  const missing = items.filter(i => recipeStatusOf(db, i) !== 'complete');
  if (missing.length) {
    cards.push({
      id: `recipes_missing:${missing.length}`,
      kind: 'recipes_missing',
      severity: 'info',
      title: missing.length === 1 ? '1 dish has no recipe card' : `${missing.length} dishes have no recipe card`,
      why: 'Costs, stock and the prep sheet need one for every dish.',
      action: { kind: 'open_recipes', label: 'Add recipes', params: { needs: 'recipe' } },
    });
  }

  // Tomorrow's prep, from the afternoon.
  if (hour >= 15) {
    const tomorrow = addDays(today, 1);
    const day = forecastDay(db, businessId, tomorrow, now);
    if (day.totals.dishes > 0) {
      const homeKitchen = v.kind === 'home_kitchen';
      cards.push({
        id: `${homeKitchen ? 'portions_suggested' : 'prep_ready'}:${tomorrow}`,
        kind: homeKitchen ? 'portions_suggested' : 'prep_ready',
        severity: 'info',
        title: homeKitchen ? 'Set tomorrow’s portions' : 'Tomorrow’s prep sheet is ready',
        why: `${day.learning ? 'Still learning your patterns: about' : 'About'} ${day.totals.dishes} dishes expected.`,
        action: homeKitchen
          ? { kind: 'apply_portions', label: 'See the suggestion', params: { date: tomorrow } }
          : { kind: 'open_prep', label: 'Open the prep sheet', params: { date: tomorrow } },
      });
    }
  }

  // Leftovers at the end of the day.
  if (hour >= 20 && !k(db).boxes.some(b => b.businessId === businessId && b.createdAt.startsWith(today))) {
    cards.push({
      id: `surplus_suggested:${today}`,
      kind: 'surplus_suggested',
      severity: 'info',
      title: 'Food left tonight? Make a Bachat Box',
      why: 'Sell it at a lower price for pickup instead of throwing it away.',
      action: { kind: 'create_surplus', label: 'Make a Bachat Box', params: {} },
    });
  }

  for (const s of extraSources) cards.push(...s(db, businessId, now));
  return cards;
};

export const cardsWire = (db: MockDb, businessId: string, now: number) => {
  const snoozed = (id: string) => {
    const until = k(db).snoozed[`${businessId}:${id}`];
    return !!until && Date.parse(until) > now;
  };
  const items = allCards(db, businessId, now)
    .filter(c => !snoozed(c.id))
    .sort((a, b) => SEVERITY_ORDER.indexOf(a.severity) - SEVERITY_ORDER.indexOf(b.severity))
    .slice(0, MAX_CARDS);
  return { items, generatedAt: isoNow(now) };
};

export const snoozeCard = (db: MockDb, businessId: string, cardId: string, now: number) => {
  const until = isoNow(now + 24 * HOUR);
  k(db).snoozed[`${businessId}:${cardId}`] = until;
  return { id: cardId, snoozedUntil: until };
};

/** The hub's tiles: one live number each. */
export const summaryWire = (db: MockDb, businessId: string, now: number) => {
  const v = vendorOf(db, businessId);
  const today = todayOf(v, now);
  const ings = ingredientsOf(db, businessId);
  const items = itemsOf(db, businessId);
  const target = settingsOf(db, businessId).targetFoodCostPct;
  const costs = items
    .map(item => {
      const rec = recipeFor(db, businessId, item.id, defaultVariantOf(item)?.id ?? null);
      return rec ? recipeCost(db, rec, item) : null;
    })
    .filter((c): c is NonNullable<typeof c> => !!c);
  const weekAgo = addDays(today, -6);
  const purchases = k(db).purchases.filter(p => p.businessId === businessId && p.date >= weekAgo);
  const waste = k(db).waste.filter(w => w.businessId === businessId && w.at.slice(0, 10) >= weekAgo);
  const tomorrow = forecastDay(db, businessId, addDays(today, 1), now);
  return {
    date: today,
    stock: {
      total: ings.length,
      low: ings.filter(i => ['low', 'out'].includes(stateOf(db, i))).length,
      negative: ings.filter(i => stateOf(db, i) === 'negative').length,
      expiring: ings.filter(i => expiringOf(db, i, today)).length,
    },
    recipes: {
      avgFoodCostPct: costs.length ? Math.round(costs.reduce((n, c) => n + c.foodCostPct, 0) / costs.length) : null,
      targetFoodCostPct: target,
      missing: items.filter(i => recipeStatusOf(db, i) !== 'complete').length,
      overTarget: costs.filter(c => c.overTarget).length,
    },
    purchases: { weekTotal: purchases.reduce((n, p) => n + p.total, 0), weekCount: purchases.length },
    forecast: { date: tomorrow.date, dishes: tomorrow.totals.dishes, orders: tomorrow.totals.orders.expected, learning: tomorrow.learning },
    waste: {
      weekCost: waste.reduce((n, w) => n + w.cost, 0),
      mealsRescued: mealsRescued(db, businessId, weekAgo),
    },
    growth: growthSummary(db, businessId, today, now),
  };
};

/** Tiffin and catering at a glance (5B). */
const growthSummary = (db: MockDb, businessId: string, today: string, now: number) => {
  const v = vendorOf(db, businessId);
  const experiments = (k(db).experiments ?? []).filter(e => e.businessId === businessId);
  const subs = (k(db).tiffinSubs ?? []).filter(s => s.businessId === businessId);
  const tomorrow = addDays(today, 1);
  const requests = (k(db).catering ?? []).filter(r => r.businessId === businessId);
  return {
    tiffin: {
      plans: (k(db).tiffinPlans ?? []).filter(p => p.businessId === businessId && p.isActive).length,
      active: subs.filter(s => s.status === 'active').length,
      pending: subs.filter(s => s.status === 'pending').length,
      tomorrow: subs.filter(s => ['active', 'paused'].includes(s.status) && ['upcoming', 'ordered'].includes(dayOf(db, s, tomorrow, now).state)).length,
    },
    catering: {
      new: requests.filter(r => r.status === 'requested').length,
      upcoming: requests.filter(r => ['accepted', 'confirmed'].includes(r.status) && r.date >= today).length,
    },
    // Reaching customers (5B, §2.11–2.14).
    storefront: { brought: (({ link, qr }) => link + qr)(storefrontWire(db, v, now).stats) },
    demand: { unmet: (d => d.cells.reduce((n, c) => n + Math.round(c.searches * c.unmetShare), 0))(demandWire(db, v, { cuisine: null, hour: null }, now)) },
    experiments: {
      running: experiments.filter(e => e.status === 'running').length,
      results: experiments.filter(e => e.status === 'done').length,
    },
    // Read without making a row (a GET writes nothing).
    hygiene: (k(db).hygiene ?? []).find(h => h.businessId === businessId)?.status ?? 'none',
    ramadan: { state: ramadanState(db, today).state, enabled: (k(db).ramadan ?? []).find(r => r.businessId === businessId)?.enabled ?? false },
  };
};

/** Bachat Boxes collected plus meals donated, since `from` (a local date) or ever. */
export const mealsRescued = (db: MockDb, businessId: string, from?: string) => {
  const boxes = k(db)
    .reservations.filter(r => r.businessId === businessId && r.status === 'collected' && (!from || (r.collectedAt ?? '').slice(0, 10) >= from))
    .reduce((n, r) => n + r.quantity, 0);
  const donated = k(db)
    .donations.filter(d => d.businessId === businessId && (!from || d.at.slice(0, 10) >= from))
    .reduce((n, d) => n + d.meals, 0);
  return boxes + donated;
};
