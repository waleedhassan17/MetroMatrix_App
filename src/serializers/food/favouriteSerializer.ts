// MetroMatrix — Food Court: saved kitchens → the app's shape.
// TODO(API_FOOD): GET /food/favourites as committed.

import type { FoodFavourite } from '../../types/food';
import { arr, bool, isObject, num, str, strOrNull } from '../serializerUtils';

export const foodFavouriteSerializer = (raw: unknown): FoodFavourite | null => {
  if (!isObject(raw) || !str(raw.id)) return null;
  const o = isObject(raw.openState) ? raw.openState : {};
  return {
    id: str(raw.id),
    slug: str(raw.slug),
    name: str(raw.name),
    logoUrl: strOrNull(raw.logoUrl),
    coverUrl: strOrNull(raw.coverUrl),
    ratingAvg: Math.max(0, num(raw.ratingAvg)),
    ratingCount: Math.max(0, Math.round(num(raw.ratingCount))),
    openState: { open: bool(o.open), paused: bool(o.paused), label: str(o.label) },
    savedAt: str(raw.savedAt),
  };
};

export const foodFavouritesSerializer = (raw: unknown): FoodFavourite[] =>
  arr(isObject(raw) ? raw.items : raw)
    .map(foodFavouriteSerializer)
    .filter((f): f is FoodFavourite => f !== null);
