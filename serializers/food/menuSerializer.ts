// ═══════════════════════════════════════════════════════
// MetroMatrix — Food menu serializers (the vendor's own menu)
// ═══════════════════════════════════════════════════════
// docs/API_FOOD.md §4.3 Menu and Availability.

import type {
  AvailabilityItem,
  AvailabilityOption,
  ItemGroupLink,
  ItemTag,
  ItemVariant,
  MenuAvailability,
  MenuCategory,
  MenuOption,
  OptionGroup,
  PreorderSlot,
  TodayItem,
  TodayMenu,
  VendorMenuItem,
  WeeklyMenuEntry,
} from '../../types/food';
import { arr, bool, isObject, num, str, strOrNull, fromResponse } from '../serializerUtils';

export const ITEM_TAGS: readonly ItemTag[] = ['spicy', 'veg', 'bestseller', 'new', 'contains_nuts'];

const compact = <T>(xs: (T | null)[]): T[] => xs.filter((x): x is T => x !== null);
const hhmm = (v: unknown): string | null => {
  const s = strOrNull(v);
  return s && /^\d{2}:\d{2}/.test(s) ? s.slice(0, 5) : null;
};
const intOrNull = (v: unknown): number | null => (v === null || v === undefined || !Number.isFinite(Number(v)) ? null : Math.round(Number(v)));
const isoOrNull = (v: unknown): string | null => {
  const s = strOrNull(v);
  return s && !Number.isNaN(Date.parse(s)) ? new Date(s).toISOString() : null;
};
const weekdays = (v: unknown): number[] =>
  [...new Set(arr(v).map(d => Math.round(num(d, -1))).filter(d => d >= 0 && d <= 6))].sort((a, b) => a - b);

export const menuCategorySerializer = fromResponse((raw: unknown): MenuCategory | null => {
  if (!isObject(raw) || !str(raw.id)) return null;
  const from = hhmm(raw.availableFrom);
  const to = hhmm(raw.availableTo);
  return {
    id: str(raw.id),
    name: str(raw.name),
    sort: num(raw.sort),
    availableFrom: from && to ? from : null,
    availableTo: from && to ? to : null,
    isActive: raw.isActive !== false,
    itemCount: Math.max(0, Math.round(num(raw.itemCount))),
  };
});

export const menuCategoriesSerializer = fromResponse((raw: unknown): MenuCategory[] =>
  compact(arr(raw).map(menuCategorySerializer)).sort((a, b) => a.sort - b.sort || a.name.localeCompare(b.name)));

const variantSerializer = (raw: unknown): ItemVariant | null =>
  isObject(raw) && str(raw.id) ? { id: str(raw.id), name: str(raw.name), price: Math.max(0, Math.round(num(raw.price))) } : null;

const linkSerializer = (raw: unknown): ItemGroupLink | null =>
  isObject(raw) && str(raw.groupId) ? { groupId: str(raw.groupId), variantId: strOrNull(raw.variantId), sort: num(raw.sort) } : null;

export const vendorMenuItemSerializer = fromResponse((raw: unknown): VendorMenuItem | null => {
  if (!isObject(raw) || !str(raw.id)) return null;
  const days = weekdays(raw.days);
  return {
    id: str(raw.id),
    categoryId: str(raw.categoryId),
    name: str(raw.name),
    description: strOrNull(raw.description),
    photoUrl: strOrNull(raw.photoUrl),
    basePrice: Math.max(0, Math.round(num(raw.basePrice))),
    tags: arr(raw.tags).filter((t): t is ItemTag => ITEM_TAGS.includes(t as ItemTag)),
    isDeal: bool(raw.isDeal),
    serves: intOrNull(raw.serves),
    days: days.length ? days : [0, 1, 2, 3, 4, 5, 6],
    isActive: raw.isActive !== false,
    sort: num(raw.sort),
    sold30d: Math.max(0, Math.round(num(raw.sold30d))),
    variants: compact(arr(raw.variants).map(variantSerializer)),
    optionGroups: compact(arr(raw.optionGroups).map(linkSerializer)).sort((a, b) => a.sort - b.sort),
  };
});

export const vendorMenuItemsSerializer = fromResponse((raw: unknown): VendorMenuItem[] => compact(arr(raw).map(vendorMenuItemSerializer)));

const optionSerializer = (raw: unknown): MenuOption | null =>
  isObject(raw) && str(raw.id)
    ? { id: str(raw.id), name: str(raw.name), priceDelta: Math.round(num(raw.priceDelta)), isDefault: bool(raw.isDefault), isActive: raw.isActive !== false }
    : null;

export const optionGroupSerializer = fromResponse((raw: unknown): OptionGroup | null => {
  if (!isObject(raw) || !str(raw.id)) return null;
  const minSelect = Math.max(0, Math.round(num(raw.minSelect)));
  return {
    id: str(raw.id),
    name: str(raw.name),
    minSelect,
    maxSelect: Math.max(1, Math.round(num(raw.maxSelect, 1))),
    required: raw.required !== undefined ? bool(raw.required) : minSelect >= 1,
    usedByItems: Math.max(0, Math.round(num(raw.usedByItems))),
    options: compact(arr(raw.options).map(optionSerializer)),
  };
});

export const optionGroupsSerializer = fromResponse((raw: unknown): OptionGroup[] => compact(arr(raw).map(optionGroupSerializer)));

const availabilityItemSerializer = (raw: unknown): AvailabilityItem | null =>
  isObject(raw) && str(raw.itemId)
    ? {
        itemId: str(raw.itemId),
        name: str(raw.name),
        category: str(raw.category),
        isAvailable: raw.isAvailable !== false,
        unavailableUntil: isoOrNull(raw.unavailableUntil),
        dailyLimit: intOrNull(raw.dailyLimit),
        remainingToday: intOrNull(raw.remainingToday),
      }
    : null;

const availabilityOptionSerializer = (raw: unknown): AvailabilityOption | null =>
  isObject(raw) && str(raw.optionId)
    ? { optionId: str(raw.optionId), name: str(raw.name), group: str(raw.group), isAvailable: raw.isAvailable !== false }
    : null;

export const menuAvailabilitySerializer = fromResponse((raw: unknown): MenuAvailability => {
  const r = isObject(raw) ? raw : {};
  return { items: compact(arr(r.items).map(availabilityItemSerializer)), options: compact(arr(r.options).map(availabilityOptionSerializer)) };
});

const todayItemSerializer = (raw: unknown): TodayItem | null =>
  isObject(raw) && str(raw.itemId)
    ? {
        itemId: str(raw.itemId),
        name: str(raw.name),
        onTodaysMenu: bool(raw.onTodaysMenu),
        cooking: bool(raw.cooking),
        dailyLimit: intOrNull(raw.dailyLimit),
        remainingToday: intOrNull(raw.remainingToday),
        sold: intOrNull(raw.sold),
      }
    : null;

export const todayMenuSerializer = fromResponse((raw: unknown): TodayMenu | null => {
  if (!isObject(raw) || !str(raw.date)) return null;
  return { date: str(raw.date), weekday: Math.round(num(raw.weekday)), items: compact(arr(raw.items).map(todayItemSerializer)) };
});

const slotSerializer = (raw: unknown): PreorderSlot | null => {
  if (!isObject(raw) || !str(raw.id)) return null;
  const start = hhmm(raw.slotStart);
  if (!start) return null;
  return {
    id: str(raw.id),
    weekday: Math.round(num(raw.weekday)),
    slotStart: start,
    cutoffMinutesBefore: Math.max(0, Math.round(num(raw.cutoffMinutesBefore))),
    maxOrders: Math.max(1, Math.round(num(raw.maxOrders, 1))),
  };
};

export const preorderSlotsSerializer = fromResponse((raw: unknown): PreorderSlot[] =>
  compact(arr(raw).map(slotSerializer)).sort((a, b) => a.weekday - b.weekday || a.slotStart.localeCompare(b.slotStart)));

export const weeklyMenuSerializer = fromResponse((raw: unknown): WeeklyMenuEntry[] =>
  compact(arr(raw).map(r => (isObject(r) && str(r.itemId) ? { itemId: str(r.itemId), name: str(r.name), days: weekdays(r.days) } : null))));
