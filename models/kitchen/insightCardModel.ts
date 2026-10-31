// ═══════════════════════════════════════════════════════
// MetroMatrix — Insight cards: their look and where their one action goes
// ═══════════════════════════════════════════════════════
// A card's severity is carried by a tinted icon well (never a coloured strip
// down its side); its action opens one screen of the vendor's Kitchen.
// Pure: the screen navigates with what this returns.

import type { InsightActionKind, InsightCard, InsightSeverity } from '../../types/kitchen';
import type { IonName } from '../../Custom-Components/Icon';
import { ROUTES } from '../../navigations-maps/Base';
import { SEVERITY_TONE, type KitchenTone } from './kitchenStatusModel';

/** A glyph per finding (by the card's kind), falling back to the severity's. */
const KIND_ICON: Record<string, IonName> = {
  expiring_stock: 'time-outline',
  negative_stock: 'remove-circle-outline',
  running_low: 'trending-down-outline',
  price_rise: 'trending-up-outline',
  food_cost_high: 'pie-chart-outline',
  recipes_missing: 'document-text-outline',
  prep_ready: 'clipboard-outline',
  portions_suggested: 'restaurant-outline',
  surplus_suggested: 'gift-outline',
  unmet_demand: 'map-outline',
  experiment_done: 'flask-outline',
  review_theme: 'chatbubbles-outline',
  tiffin_pending: 'calendar-outline',
  catering_new: 'people-outline',
  signature_removed: 'ribbon-outline',
};

const SEVERITY_ICON: Record<InsightSeverity, IonName> = {
  critical: 'alert-circle-outline',
  warning: 'warning-outline',
  info: 'bulb-outline',
};

export const cardLook = (c: Pick<InsightCard, 'kind' | 'severity'>): { icon: IonName; tone: KitchenTone } => ({
  icon: KIND_ICON[c.kind] ?? SEVERITY_ICON[c.severity],
  tone: SEVERITY_TONE[c.severity],
});

/** Where a card's action goes: a route in the vendor's stack and its params. */
export interface CardTarget {
  screen: string;
  params?: Record<string, unknown>;
}

const str = (v: unknown) => (typeof v === 'string' ? v : typeof v === 'number' ? String(v) : undefined);
const strs = (v: unknown) => (Array.isArray(v) ? v.map(String) : undefined);

const TARGETS: Record<InsightActionKind, (p: InsightCard['action']['params']) => CardTarget> = {
  open_stock: () => ({ screen: ROUTES.KITCHEN_STOCK }),
  open_ingredient: p => ({ screen: ROUTES.KITCHEN_INGREDIENT, params: { id: str(p.ingredientId) } }),
  add_purchase: () => ({ screen: ROUTES.KITCHEN_PURCHASE_FORM, params: {} }),
  stock_take: p => ({ screen: ROUTES.KITCHEN_STOCK_TAKE, params: { ingredientIds: strs(p.ingredientIds) } }),
  open_recipe: p => ({ screen: ROUTES.KITCHEN_RECIPE, params: { itemId: str(p.itemId) } }),
  open_recipes: p => ({ screen: ROUTES.KITCHEN_RECIPES, params: { needsRecipe: p.needs === 'recipe' } }),
  open_prep: p => ({ screen: ROUTES.KITCHEN_FORECAST, params: { date: str(p.date), tab: 'prep' } }),
  apply_portions: p => ({ screen: ROUTES.KITCHEN_FORECAST, params: { date: str(p.date) } }),
  create_surplus: () => ({ screen: ROUTES.KITCHEN_BOX_FORM, params: { suggest: true } }),
  // Today's specials from expiring stock (the assistant; while it is off the card offers a Bachat Box).
  make_special: p => ({ screen: ROUTES.KITCHEN_AI_SPECIALS, params: { ingredientIds: strs(p.ingredientIds) } }),
  open_demand: () => ({ screen: ROUTES.GROWTH_DEMAND }),
  open_experiment: p => (str(p.experimentId) ? { screen: ROUTES.GROWTH_EXPERIMENT, params: { id: str(p.experimentId) } } : { screen: ROUTES.GROWTH_MENU_INSIGHTS }),
  open_review_insights: () => ({ screen: ROUTES.KITCHEN_REVIEW_INSIGHTS }),
  open_tiffin: p => ({ screen: ROUTES.GROWTH_TIFFIN_SUBSCRIBERS, params: { status: str(p.status) ?? 'pending' } }),
  open_catering: p => (str(p.code) ? { screen: ROUTES.GROWTH_CATERING_REQUEST, params: { code: str(p.code) } } : { screen: ROUTES.GROWTH_CATERING }),
};

/** Lets later milestones point an action at their own screen (Assistant, Tiffin, Demand map …). */
export const setCardTarget = (kind: InsightActionKind, f: (p: InsightCard['action']['params']) => CardTarget) => {
  TARGETS[kind] = f;
};

export const cardTarget = (c: InsightCard): CardTarget => TARGETS[c.action.kind](c.action.params);
