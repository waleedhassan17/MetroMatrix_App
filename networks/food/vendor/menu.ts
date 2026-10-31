// ═══════════════════════════════════════════════════════
// MetroMatrix — Food Vendor Menu Network (API_FOOD.md)
// ═══════════════════════════════════════════════════════
// The menu (categories, dishes with sizes, the
// reusable add-on groups). docs/API_FOOD.md §4.3 Menu.

import { API, toApiError } from '../../network/network';
import type { MenuItemInput, OptionGroupInput } from '../../../models/food';

const enc = encodeURIComponent;
// ── Categories ──
export const fetchMenuCategories = async (): Promise<unknown> => {
  try {
    const response = await API.GET({ URL: '/food/vendor/menu/categories' });
    return response.data;
  } catch (e) {
    throw toApiError(e);
  }
};

export const createMenuCategory = async (input: { name: string; availableFrom: string | null; availableTo: string | null }): Promise<unknown> => {
  try {
    const response = await API.POST({ URL: '/food/vendor/menu/categories', data: {
        name: input.name,
        ...(input.availableFrom && input.availableTo ? { availableFrom: input.availableFrom, availableTo: input.availableTo } : null),
      } });
    return response.data;
  } catch (e) {
    throw toApiError(e);
  }
};

export const updateMenuCategory = async (id: string, input: Partial<{ name: string; availableFrom: string | null; availableTo: string | null; isActive: boolean }>): Promise<unknown> => {
  try {
    const response = await API.PATCH({ URL: `/food/vendor/menu/categories/${enc(id)}`, data: input });
    return response.data;
  } catch (e) {
    throw toApiError(e);
  }
};

/** 409 CONFLICT (details.items) while it still has dishes. */
export const deleteMenuCategory = async (id: string): Promise<unknown> => {
  try {
    const response = await API.DELETE({ URL: `/food/vendor/menu/categories/${enc(id)}` });
    return response.data;
  } catch (e) {
    throw toApiError(e);
  }
};

export const reorderMenuCategories = async (ids: string[]): Promise<unknown> => {
  try {
    const response = await API.PUT({ URL: '/food/vendor/menu/categories/reorder', data: { ids } });
    return response.data;
  } catch (e) {
    throw toApiError(e);
  }
};

// ── Dishes ──
export const fetchMenuItems = async (): Promise<unknown> => {
  try {
    const response = await API.GET({ URL: '/food/vendor/menu/items' });
    return response.data;
  } catch (e) {
    throw toApiError(e);
  }
};

export const fetchMenuItem = async (id: string): Promise<unknown> => {
  try {
    const response = await API.GET({ URL: `/food/vendor/menu/items/${enc(id)}` });
    return response.data;
  } catch (e) {
    throw toApiError(e);
  }
};

/** Counts against the plan (409 PLAN_LIMIT_REACHED). Sizes go in the same call. */
export const createMenuItem = async (input: MenuItemInput, variants: { name: string; price: number }[]): Promise<unknown> => {
  try {
    const response = await API.POST({ URL: '/food/vendor/menu/items', data: {
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
      } });
    return response.data;
  } catch (e) {
    throw toApiError(e);
  }
};

export const updateMenuItem = async (id: string, input: Partial<MenuItemInput>): Promise<unknown> => {
  try {
    const response = await API.PATCH({ URL: `/food/vendor/menu/items/${enc(id)}`, data: input });
    return response.data;
  } catch (e) {
    throw toApiError(e);
  }
};

export const deleteMenuItem = async (id: string): Promise<unknown> => {
  try {
    const response = await API.DELETE({ URL: `/food/vendor/menu/items/${enc(id)}` });
    return response.data;
  } catch (e) {
    throw toApiError(e);
  }
};

/** An inactive copy with the same sizes and add-on groups. */
export const duplicateMenuItem = async (id: string): Promise<unknown> => {
  try {
    const response = await API.POST({ URL: `/food/vendor/menu/items/${enc(id)}/duplicate` });
    return response.data;
  } catch (e) {
    throw toApiError(e);
  }
};

/** Replaces the sizes; existing ones keep their id. */
export const saveItemVariants = async (id: string, variants: { id?: string; name: string; price: number }[]): Promise<unknown> => {
  try {
    const response = await API.PUT({ URL: `/food/vendor/menu/items/${enc(id)}/variants`, data: variants });
    return response.data;
  } catch (e) {
    throw toApiError(e);
  }
};

/** Replaces the dish's add-on groups, in display order. */
export const saveItemGroups = async (id: string, links: { groupId: string; variantId?: string }[]): Promise<unknown> => {
  try {
    const response = await API.PUT({ URL: `/food/vendor/menu/items/${enc(id)}/option-groups`, data: links });
    return response.data;
  } catch (e) {
    throw toApiError(e);
  }
};

export const reorderMenuItems = async (ids: string[]): Promise<unknown> => {
  try {
    const response = await API.PUT({ URL: '/food/vendor/menu/items/reorder', data: { ids } });
    return response.data;
  } catch (e) {
    throw toApiError(e);
  }
};

// ── Add-on groups (the library) ──
export const fetchOptionGroups = async (): Promise<unknown> => {
  try {
    const response = await API.GET({ URL: '/food/vendor/menu/option-groups' });
    return response.data;
  } catch (e) {
    throw toApiError(e);
  }
};

export const fetchOptionGroup = async (id: string): Promise<unknown> => {
  try {
    const response = await API.GET({ URL: `/food/vendor/menu/option-groups/${enc(id)}` });
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

export const createOptionGroup = async (input: OptionGroupInput): Promise<unknown> => {
  try {
    const response = await API.POST({ URL: '/food/vendor/menu/option-groups', data: groupBody(input) });
    return response.data;
  } catch (e) {
    throw toApiError(e);
  }
};

export const updateOptionGroup = async (id: string, input: OptionGroupInput): Promise<unknown> => {
  try {
    const response = await API.PUT({ URL: `/food/vendor/menu/option-groups/${enc(id)}`, data: groupBody(input) });
    return response.data;
  } catch (e) {
    throw toApiError(e);
  }
};

/** Removing a group takes it off every dish that offers it. */
export const deleteOptionGroup = async (id: string): Promise<unknown> => {
  try {
    const response = await API.DELETE({ URL: `/food/vendor/menu/option-groups/${enc(id)}` });
    return response.data;
  } catch (e) {
    throw toApiError(e);
  }
};
