// MetroMatrix — Food vendor: the menu (categories, dishes with sizes, the
// reusable add-on groups). docs/API_FOOD.md §4.3 Menu.

import { api } from '../../network/apiHelpers';
import {
  menuCategoriesSerializer,
  menuCategorySerializer,
  optionGroupSerializer,
  optionGroupsSerializer,
  vendorMenuItemSerializer,
  vendorMenuItemsSerializer,
} from '../../../serializers/food/menuSerializer';
import type { MenuItemInput, OptionGroupInput } from '../../../types/food';
import { request } from '../../shopping/http';

const enc = encodeURIComponent;
const ack = () => true;

// ── Categories ──
export const listMenuCategories = () => request(() => api.get('/food/vendor/menu/categories'), menuCategoriesSerializer);

export const createMenuCategory = (input: { name: string; availableFrom: string | null; availableTo: string | null }) =>
  request(
    () =>
      api.post('/food/vendor/menu/categories', {
        name: input.name,
        ...(input.availableFrom && input.availableTo ? { availableFrom: input.availableFrom, availableTo: input.availableTo } : null),
      }),
    menuCategorySerializer,
  );

export const updateMenuCategory = (id: string, input: Partial<{ name: string; availableFrom: string | null; availableTo: string | null; isActive: boolean }>) =>
  request(() => api.patch(`/food/vendor/menu/categories/${enc(id)}`, input), menuCategorySerializer);

/** 409 CONFLICT (details.items) while it still has dishes. */
export const deleteMenuCategory = (id: string) => request(() => api.delete(`/food/vendor/menu/categories/${enc(id)}`), ack);

export const reorderMenuCategories = (ids: string[]) => request(() => api.put('/food/vendor/menu/categories/reorder', { ids }), menuCategoriesSerializer);

// ── Dishes ──
export const listMenuItems = () => request(() => api.get('/food/vendor/menu/items'), vendorMenuItemsSerializer);

export const getMenuItem = (id: string) => request(() => api.get(`/food/vendor/menu/items/${enc(id)}`), vendorMenuItemSerializer);

/** Counts against the plan (409 PLAN_LIMIT_REACHED). Sizes go in the same call. */
export const createMenuItem = (input: MenuItemInput, variants: { name: string; price: number }[]) =>
  request(
    () =>
      api.post('/food/vendor/menu/items', {
        categoryId: input.categoryId,
        name: input.name,
        ...(input.description ? { description: input.description } : null),
        ...(input.photoUrl ? { photoUrl: input.photoUrl } : null),
        basePrice: input.basePrice,
        tags: input.tags,
        isDeal: input.isDeal,
        ...(input.serves ? { serves: input.serves } : null),
        days: input.days,
        isActive: input.isActive,
        ...(variants.length ? { variants } : null),
      }),
    vendorMenuItemSerializer,
  );

export const updateMenuItem = (id: string, input: Partial<MenuItemInput>) =>
  request(() => api.patch(`/food/vendor/menu/items/${enc(id)}`, input), vendorMenuItemSerializer);

export const deleteMenuItem = (id: string) => request(() => api.delete(`/food/vendor/menu/items/${enc(id)}`), ack);

/** An inactive copy with the same sizes and add-on groups. */
export const duplicateMenuItem = (id: string) => request(() => api.post(`/food/vendor/menu/items/${enc(id)}/duplicate`), vendorMenuItemSerializer);

/** Replaces the sizes; existing ones keep their id. */
export const saveItemVariants = (id: string, variants: { id?: string; name: string; price: number }[]) =>
  request(() => api.put(`/food/vendor/menu/items/${enc(id)}/variants`, variants), vendorMenuItemSerializer);

/** Replaces the dish's add-on groups, in display order. */
export const saveItemGroups = (id: string, links: { groupId: string; variantId?: string }[]) =>
  request(() => api.put(`/food/vendor/menu/items/${enc(id)}/option-groups`, links), vendorMenuItemSerializer);

export const reorderMenuItems = (ids: string[]) => request(() => api.put('/food/vendor/menu/items/reorder', { ids }), vendorMenuItemsSerializer);

// ── Add-on groups (the library) ──
export const listOptionGroups = () => request(() => api.get('/food/vendor/menu/option-groups'), optionGroupsSerializer);

export const getOptionGroup = (id: string) => request(() => api.get(`/food/vendor/menu/option-groups/${enc(id)}`), optionGroupSerializer);

const groupBody = (input: OptionGroupInput) => ({
  name: input.name,
  minSelect: input.minSelect,
  maxSelect: input.maxSelect,
  options: input.options.map(o => ({ ...(o.id ? { id: o.id } : null), name: o.name, priceDelta: o.priceDelta, isDefault: o.isDefault, isActive: o.isActive })),
});

export const createOptionGroup = (input: OptionGroupInput) => request(() => api.post('/food/vendor/menu/option-groups', groupBody(input)), optionGroupSerializer);

export const updateOptionGroup = (id: string, input: OptionGroupInput) =>
  request(() => api.put(`/food/vendor/menu/option-groups/${enc(id)}`, groupBody(input)), optionGroupSerializer);

/** Removing a group takes it off every dish that offers it. */
export const deleteOptionGroup = (id: string) => request(() => api.delete(`/food/vendor/menu/option-groups/${enc(id)}`), ack);
