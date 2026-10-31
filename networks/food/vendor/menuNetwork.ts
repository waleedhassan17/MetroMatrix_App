// ═══════════════════════════════════════════════════════
// MetroMatrix — Food Vendor Menu Network (API_FOOD.md)
// ═══════════════════════════════════════════════════════
// The menu (categories, dishes with sizes, the
// reusable add-on groups). docs/API_FOOD.md §4.3 Menu.

import { api, toApiError } from '../../network/apiHelpers';
import type { MenuItemInput, OptionGroupInput } from '../../../types/food';

const enc = encodeURIComponent;
// ── Categories ──
export const getMenuCategoriesAPI = async (): Promise<unknown> => {
  try {
    const response = await api.get('/food/vendor/menu/categories');
    return response.data;
  } catch (e) {
    throw toApiError(e);
  }
};

export const createMenuCategoryAPI = async (input: { name: string; availableFrom: string | null; availableTo: string | null }): Promise<unknown> => {
  try {
    const response = await api.post('/food/vendor/menu/categories', {
        name: input.name,
        ...(input.availableFrom && input.availableTo ? { availableFrom: input.availableFrom, availableTo: input.availableTo } : null),
      });
    return response.data;
  } catch (e) {
    throw toApiError(e);
  }
};

export const updateMenuCategoryAPI = async (id: string, input: Partial<{ name: string; availableFrom: string | null; availableTo: string | null; isActive: boolean }>): Promise<unknown> => {
  try {
    const response = await api.patch(`/food/vendor/menu/categories/${enc(id)}`, input);
    return response.data;
  } catch (e) {
    throw toApiError(e);
  }
};

/** 409 CONFLICT (details.items) while it still has dishes. */
export const deleteMenuCategoryAPI = async (id: string): Promise<unknown> => {
  try {
    const response = await api.delete(`/food/vendor/menu/categories/${enc(id)}`);
    return response.data;
  } catch (e) {
    throw toApiError(e);
  }
};

export const reorderMenuCategoriesAPI = async (ids: string[]): Promise<unknown> => {
  try {
    const response = await api.put('/food/vendor/menu/categories/reorder', { ids });
    return response.data;
  } catch (e) {
    throw toApiError(e);
  }
};

// ── Dishes ──
export const getMenuItemsAPI = async (): Promise<unknown> => {
  try {
    const response = await api.get('/food/vendor/menu/items');
    return response.data;
  } catch (e) {
    throw toApiError(e);
  }
};

export const getMenuItemAPI = async (id: string): Promise<unknown> => {
  try {
    const response = await api.get(`/food/vendor/menu/items/${enc(id)}`);
    return response.data;
  } catch (e) {
    throw toApiError(e);
  }
};

/** Counts against the plan (409 PLAN_LIMIT_REACHED). Sizes go in the same call. */
export const createMenuItemAPI = async (input: MenuItemInput, variants: { name: string; price: number }[]): Promise<unknown> => {
  try {
    const response = await api.post('/food/vendor/menu/items', {
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
      });
    return response.data;
  } catch (e) {
    throw toApiError(e);
  }
};

export const updateMenuItemAPI = async (id: string, input: Partial<MenuItemInput>): Promise<unknown> => {
  try {
    const response = await api.patch(`/food/vendor/menu/items/${enc(id)}`, input);
    return response.data;
  } catch (e) {
    throw toApiError(e);
  }
};

export const deleteMenuItemAPI = async (id: string): Promise<unknown> => {
  try {
    const response = await api.delete(`/food/vendor/menu/items/${enc(id)}`);
    return response.data;
  } catch (e) {
    throw toApiError(e);
  }
};

/** An inactive copy with the same sizes and add-on groups. */
export const duplicateMenuItemAPI = async (id: string): Promise<unknown> => {
  try {
    const response = await api.post(`/food/vendor/menu/items/${enc(id)}/duplicate`);
    return response.data;
  } catch (e) {
    throw toApiError(e);
  }
};

/** Replaces the sizes; existing ones keep their id. */
export const saveItemVariantsAPI = async (id: string, variants: { id?: string; name: string; price: number }[]): Promise<unknown> => {
  try {
    const response = await api.put(`/food/vendor/menu/items/${enc(id)}/variants`, variants);
    return response.data;
  } catch (e) {
    throw toApiError(e);
  }
};

/** Replaces the dish's add-on groups, in display order. */
export const saveItemGroupsAPI = async (id: string, links: { groupId: string; variantId?: string }[]): Promise<unknown> => {
  try {
    const response = await api.put(`/food/vendor/menu/items/${enc(id)}/option-groups`, links);
    return response.data;
  } catch (e) {
    throw toApiError(e);
  }
};

export const reorderMenuItemsAPI = async (ids: string[]): Promise<unknown> => {
  try {
    const response = await api.put('/food/vendor/menu/items/reorder', { ids });
    return response.data;
  } catch (e) {
    throw toApiError(e);
  }
};

// ── Add-on groups (the library) ──
export const getOptionGroupsAPI = async (): Promise<unknown> => {
  try {
    const response = await api.get('/food/vendor/menu/option-groups');
    return response.data;
  } catch (e) {
    throw toApiError(e);
  }
};

export const getOptionGroupAPI = async (id: string): Promise<unknown> => {
  try {
    const response = await api.get(`/food/vendor/menu/option-groups/${enc(id)}`);
    return response.data;
  } catch (e) {
    throw toApiError(e);
  }
};

const groupBody = (input: OptionGroupInput) => ({
  name: input.name,
  minSelect: input.minSelect,
  maxSelect: input.maxSelect,
  options: input.options.map(o => ({ ...(o.id ? { id: o.id } : null), name: o.name, priceDelta: o.priceDelta, isDefault: o.isDefault, isActive: o.isActive })),
});

export const createOptionGroupAPI = async (input: OptionGroupInput): Promise<unknown> => {
  try {
    const response = await api.post('/food/vendor/menu/option-groups', groupBody(input));
    return response.data;
  } catch (e) {
    throw toApiError(e);
  }
};

export const updateOptionGroupAPI = async (id: string, input: OptionGroupInput): Promise<unknown> => {
  try {
    const response = await api.put(`/food/vendor/menu/option-groups/${enc(id)}`, groupBody(input));
    return response.data;
  } catch (e) {
    throw toApiError(e);
  }
};

/** Removing a group takes it off every dish that offers it. */
export const deleteOptionGroupAPI = async (id: string): Promise<unknown> => {
  try {
    const response = await api.delete(`/food/vendor/menu/option-groups/${enc(id)}`);
    return response.data;
  } catch (e) {
    throw toApiError(e);
  }
};
