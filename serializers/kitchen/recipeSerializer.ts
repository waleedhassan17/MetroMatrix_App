// MetroMatrix — Kitchen serializers: recipe cards and costs, kitchen settings.
// docs/API_KITCHEN.md §3, §5. The recipes list is the costing (one row per dish and size)
// with the menu's photos and categories; the editor reads the card with its dish (sizes,
// add-on groups), the groups' options and the dish's costing rows.

import type { Cost, KitchenSettings, Recipe, RecipeLine, RecipeList, RecipeRow } from '../../models/kitchen';
import { bool, isObject, num, str, strOrNull, bodiesOf, fromResponse } from '../serializerUtils';
import { baseUnit, count, intOrNull, list } from './kitchenCommon';

type Row = Record<string, unknown>;

/** A costing row → the cost card: what it costs to make, what the kitchen keeps. */
const costOf = (row: Row | undefined): Cost | null => {
  if (!row || !bool(row.hasRecipe) || row.cost === null || row.cost === undefined) return null;
  const sellPrice = count(row.price);
  const keep = Math.round(num(row.margin));
  return {
    toMake: Math.round(num(row.cost)),
    sellPrice,
    keep,
    keepPct: sellPrice ? Math.round((keep / sellPrice) * 100) : 0,
    foodCostPct: Math.round(num(row.foodCostPct)),
    overTarget: bool(row.aboveTarget),
  };
};

const rowsOf = (costing: unknown): Row[] => (isObject(costing) && Array.isArray(costing.items) ? costing.items.filter(isObject) : []);

/** GET /costing (+ the menu's dishes, for photos and categories). */
export const recipeListSerializer = (parts: { costing: unknown; menu?: unknown; categories?: unknown }): RecipeList | null => {
  const raw = bodiesOf(parts);
  if (!isObject(raw.costing)) return null;
  const rows = rowsOf(raw.costing);
  const menu = new Map(list(raw.menu, m => (isObject(m) && str(m.id) ? m : null)).map(m => [str(m.id), m]));
  const categories = new Map(list(raw.categories, c => (isObject(c) && str(c.id) ? c : null)).map(c => [str(c.id), str(c.name)]));
  const summary = isObject(raw.costing.summary) ? raw.costing.summary : {};
  const items = rows.map((r): RecipeRow => {
    const dish = menu.get(str(r.itemId));
    return {
      itemId: str(r.itemId),
      name: str(r.name),
      photoUrl: dish ? strOrNull(dish.photoUrl) : null,
      categoryName: dish ? (categories.get(str(dish.categoryId)) ?? null) : null,
      status: !bool(r.hasRecipe) ? 'missing' : list(r.uncosted, x => x).length ? 'partial' : 'complete',
      variantId: strOrNull(r.variantId),
      variantName: strOrNull(r.variantName),
      variantCount: rows.filter(x => x.itemId === r.itemId).length,
      sellPrice: count(r.price),
      cost: costOf(r),
      servingsLeft: null,
      signature: false,
    };
  });
  return {
    targetFoodCostPct: count(raw.costing.targetFoodCostPct) || 35,
    avgFoodCostPct: intOrNull(summary.avgFoodCostPct),
    counts: { all: count(summary.dishes), missing: Math.max(0, count(summary.dishes) - count(summary.withRecipe)), overTarget: count(summary.aboveTarget) },
    items,
  };
};

const lineOf = (l: Row, yieldServings: number): RecipeLine => {
  const unit = baseUnit(l.baseUnit);
  const qty = Math.max(0, num(l.qtyBase));
  const cost = Math.max(0, num(l.costPerServing)) * yieldServings;
  return { ingredientId: str(l.ingredientId), name: str(l.name, 'Ingredient'), baseUnit: unit, dozens: unit === 'pc', qty, costPerBase: qty ? cost / qty : 0, cost };
};

/**
 * The editor's card: GET /items/:id/recipe (null before one is saved), the dish
 * (GET /food/vendor/menu/items/:id), the option groups and GET /costing.
 */
export const recipeSerializer = (parts: { card: unknown; item: unknown; groups?: unknown; costing?: unknown }, variantId: string | null = null): Recipe | null => {
  const raw = bodiesOf(parts);
  if (!isObject(raw.item) || !str(raw.item.id)) return null;
  const item = raw.item;
  const card = isObject(raw.card) ? raw.card : null;
  const yieldServings = Math.max(1, count(card?.yieldServings) || 1);
  const lines = card ? list(card.lines, l => (isObject(l) && str(l.ingredientId) ? l : null)) : [];
  const groups = list(raw.groups, g => (isObject(g) && str(g.id) ? g : null));
  const linked = new Set(list(item.optionGroups, g => (isObject(g) ? str(g.groupId) : null)));
  const options = groups
    .filter(g => linked.has(str(g.id)))
    .flatMap(g => list(g.options, o => (isObject(o) && str(o.id) ? { optionId: str(o.id), name: str(o.name), groupName: str(g.name) } : null)));
  const rows = rowsOf(raw.costing).filter(r => r.itemId === item.id);
  const row = rows.find(r => (r.variantId ?? null) === variantId) ?? rows[0];
  const addOnIds = [...new Set(lines.filter(l => str(l.optionId)).map(l => str(l.optionId)))];
  const variants = list(item.variants, v =>
    isObject(v) && str(v.id) ? { id: str(v.id), name: str(v.name), price: count(v.price), hasRecipe: bool(rows.find(r => r.variantId === v.id)?.hasRecipe) } : null,
  );
  return {
    itemId: str(item.id),
    itemName: str(item.name),
    photoUrl: strOrNull(item.photoUrl),
    variantId,
    variants,
    sellPrice: count(row?.price) || variants.find(v => v.id === variantId)?.price || count(item.basePrice),
    yield: yieldServings,
    lines: lines.filter(l => !str(l.optionId) && !bool(l.isPackaging)).map(l => lineOf(l, yieldServings)),
    addOns: addOnIds.map(id => {
      const o = options.find(x => x.optionId === id);
      return {
        optionId: id,
        optionName: o?.name ?? str(lines.find(l => l.optionId === id)?.optionName),
        groupName: o?.groupName ?? '',
        lines: lines.filter(l => l.optionId === id).map(l => lineOf(l, yieldServings)),
      };
    }),
    options,
    packaging: lines.filter(l => bool(l.isPackaging)).map(l => lineOf(l, yieldServings)),
    signature: {
      on: bool(card?.isSignature),
      creatorName: strOrNull(card?.signatureBy),
      removedNote: card?.signatureRemovedAt ? strOrNull(card.signatureRemovedReason) : null,
    },
    cost: costOf(row),
    servingsLeft: card ? intOrNull(card.servings) : null,
    targetFoodCostPct: (isObject(raw.costing) ? count(raw.costing.targetFoodCostPct) : 0) || 35,
    updatedAt: null,
  };
};

/** A packing photo is always possible; `required` when the kitchen asks for one every time. */
export const kitchenSettingsSerializer = fromResponse((raw: unknown): KitchenSettings | null =>
  isObject(raw) ? { targetFoodCostPct: count(raw.targetFoodCostPct) || 35, packingPhoto: bool(raw.requirePackingPhoto) ? 'required' : 'optional' } : null);
