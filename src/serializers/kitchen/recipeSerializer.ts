// MetroMatrix — Kitchen serializers: recipes and costs, kitchen settings.
// docs/API_KITCHEN_ASSUMED.md §2.4, §4.2.

import type { KitchenSettings, PackingPhotoRule, Recipe, RecipeLine, RecipeList, RecipeRow, RecipeStatus } from '../../types/kitchen';
import { bool, isObject, num, oneOf, str, strOrNull } from '../serializerUtils';
import { baseUnit, costSerializer, count, intOrNull, list } from './kitchenCommon';

const STATUSES: readonly RecipeStatus[] = ['complete', 'partial', 'missing'];
const PACKING: readonly PackingPhotoRule[] = ['off', 'optional', 'required'];

const lineSerializer = (raw: unknown): RecipeLine | null =>
  isObject(raw) && str(raw.ingredientId)
    ? {
        ingredientId: str(raw.ingredientId),
        name: str(raw.name, 'Ingredient'),
        baseUnit: baseUnit(raw.baseUnit),
        dozens: bool(raw.dozens),
        qty: Math.max(0, num(raw.qty)),
        costPerBase: Math.max(0, num(raw.costPerBase)),
        cost: Math.max(0, num(raw.cost)),
      }
    : null;

export const recipeRowSerializer = (raw: unknown): RecipeRow | null => {
  if (!isObject(raw) || !str(raw.itemId)) return null;
  return {
    itemId: str(raw.itemId),
    name: str(raw.name),
    photoUrl: strOrNull(raw.photoUrl),
    categoryName: strOrNull(raw.categoryName),
    status: oneOf(raw.status, STATUSES, 'missing'),
    variantId: strOrNull(raw.variantId),
    variantName: strOrNull(raw.variantName),
    variantCount: count(raw.variantCount),
    sellPrice: count(raw.sellPrice),
    cost: costSerializer(raw.cost),
    servingsLeft: intOrNull(raw.servingsLeft),
    signature: bool(raw.signature),
  };
};

export const recipeListSerializer = (raw: unknown): RecipeList | null => {
  if (!isObject(raw)) return null;
  const c = isObject(raw.counts) ? raw.counts : {};
  return {
    targetFoodCostPct: count(raw.targetFoodCostPct) || 40,
    avgFoodCostPct: intOrNull(raw.avgFoodCostPct),
    counts: { all: count(c.all), missing: count(c.missing), overTarget: count(c.overTarget) },
    items: list(raw.items, recipeRowSerializer),
  };
};

export const recipeSerializer = (raw: unknown): Recipe | null => {
  if (!isObject(raw) || !str(raw.itemId)) return null;
  return {
    itemId: str(raw.itemId),
    itemName: str(raw.itemName),
    photoUrl: strOrNull(raw.photoUrl),
    variantId: strOrNull(raw.variantId),
    variants: list(raw.variants, v => (isObject(v) && str(v.id) ? { id: str(v.id), name: str(v.name), price: count(v.price), hasRecipe: bool(v.hasRecipe) } : null)),
    sellPrice: count(raw.sellPrice),
    yield: Math.max(1, count(raw.yield)),
    lines: list(raw.lines, lineSerializer),
    addOns: list(raw.addOns, a =>
      isObject(a) && str(a.optionId) ? { optionId: str(a.optionId), optionName: str(a.optionName), groupName: str(a.groupName), lines: list(a.lines, lineSerializer) } : null,
    ),
    options: list(raw.options, o => (isObject(o) && str(o.optionId) ? { optionId: str(o.optionId), name: str(o.name), groupName: str(o.groupName) } : null)),
    packaging: list(raw.packaging, lineSerializer),
    signature: isObject(raw.signature) ? { on: bool(raw.signature.on), creatorName: strOrNull(raw.signature.creatorName) } : { on: false, creatorName: null },
    cost: costSerializer(raw.cost),
    servingsLeft: intOrNull(raw.servingsLeft),
    targetFoodCostPct: count(raw.targetFoodCostPct) || 40,
    updatedAt: strOrNull(raw.updatedAt),
  };
};

export const kitchenSettingsSerializer = (raw: unknown): KitchenSettings | null =>
  isObject(raw)
    ? { targetFoodCostPct: count(raw.targetFoodCostPct) || 40, autoSellOut: bool(raw.autoSellOut, true), packingPhoto: oneOf(raw.packingPhoto, PACKING, 'off') }
    : null;
