// ═══════════════════════════════════════════════════════
// MetroMatrix — Food vendor: one dish (new or edit)
// ═══════════════════════════════════════════════════════
// The dish, its sizes and the add-on groups it offers. Saving a new dish
// sends the sizes with it, then its groups; an edit sends only what changed
// (the dish, the sizes, the groups) — per-size groups the API keeps are left
// as they are.

import type { PayloadAction } from '@reduxjs/toolkit';
import { createAppSlice } from '@store/createAppSlice';
import {
  createMenuItemAPI,
  deleteMenuItemAPI,
  duplicateMenuItemAPI,
  getMenuItemAPI,
  getMenuCategoriesAPI,
  getOptionGroupsAPI,
  saveItemGroupsAPI,
  saveItemVariantsAPI,
  updateMenuItemAPI,
} from '@networks/food/vendor/menuNetwork';
import { toRejectedValue, required } from '@networks/network/apiHelpers';
import { emptyItemForm, itemForm, itemInput, variantsInput, type ItemForm } from '@models/food/menuModel';
import type { ItemTag, LocalFile, MenuCategory, OptionGroup, VendorMenuItem } from '@/types';
import { NO_ERROR, readRejection, type FormStatus, type ServerError } from '../../../Auth/shared/formStatus';
import { upload } from '../../../Shopping/Customer/shared/photoUploads';
import { menuChanged } from '../VendorMenu/vendorMenuSlice';
import { vendorMenuItemSerializer, menuCategoriesSerializer, optionGroupsSerializer } from '@serializers/food/menuSerializer';

export interface VendorMenuItemSliceState {
  /** The dish being edited (null for a new one). */
  item: VendorMenuItem | null;
  form: ItemForm | null;
  categories: MenuCategory[];
  groups: OptionGroup[];
  status: FormStatus;
  saving: boolean;
  uploading: boolean;
  submitted: boolean;
  error: ServerError;
}

const initialState: VendorMenuItemSliceState = {
  item: null,
  form: null,
  categories: [],
  groups: [],
  status: 'idle',
  saving: false,
  uploading: false,
  submitted: false,
  error: NO_ERROR,
};

type Field = Exclude<keyof ItemForm, 'variants' | 'groupIds' | 'tags' | 'days'>;

const sameJson = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

export const vendorMenuItemSlice = createAppSlice({
  name: 'vendorMenuItem',
  initialState,
  reducers: create => ({
    setItemField: create.reducer((state, action: PayloadAction<{ field: Field; value: ItemForm[Field] }>) => {
      if (state.form) (state.form as unknown as Record<string, unknown>)[action.payload.field] = action.payload.value;
    }),
    toggleItemTag: create.reducer((state, action: PayloadAction<ItemTag>) => {
      if (!state.form) return;
      const t = action.payload;
      state.form.tags = state.form.tags.includes(t) ? state.form.tags.filter(x => x !== t) : [...state.form.tags, t];
    }),
    toggleItemDay: create.reducer((state, action: PayloadAction<number>) => {
      if (!state.form) return;
      const d = action.payload;
      state.form.days = state.form.days.includes(d) ? state.form.days.filter(x => x !== d) : [...state.form.days, d].sort((a, b) => a - b);
    }),
    toggleItemGroup: create.reducer((state, action: PayloadAction<string>) => {
      if (!state.form) return;
      const id = action.payload;
      state.form.groupIds = state.form.groupIds.includes(id) ? state.form.groupIds.filter(x => x !== id) : [...state.form.groupIds, id];
    }),
    addVariant: create.reducer(state => {
      if (!state.form) return;
      // The first size starts from the dish's price, so nothing is lost.
      if (!state.form.variants.length) state.form.variants.push({ name: 'Regular', price: state.form.basePrice });
      state.form.variants.push({ name: '', price: '' });
    }),
    setVariant: create.reducer((state, action: PayloadAction<{ index: number; field: 'name' | 'price'; value: string }>) => {
      const v = state.form?.variants[action.payload.index];
      if (v) v[action.payload.field] = action.payload.value;
    }),
    removeVariant: create.reducer((state, action: PayloadAction<number>) => {
      if (!state.form) return;
      const removed = state.form.variants.splice(action.payload, 1);
      // One size left is just the dish's price.
      if (state.form.variants.length === 1) {
        state.form.basePrice = state.form.variants[0].price || removed[0]?.price || state.form.basePrice;
        state.form.variants = [];
      }
    }),
    markItemSubmitted: create.reducer(state => {
      state.submitted = true;
    }),
    loadMenuItemAsync: create.asyncThunk(
      async ({ id, categoryId }: { id?: string; categoryId?: string }, { rejectWithValue }) => {
        try {
          const [item, categories, groups] = await Promise.all([id ? getMenuItemAPI(id).then(raw => required(vendorMenuItemSerializer(raw))) : Promise.resolve(null), getMenuCategoriesAPI().then(raw => required(menuCategoriesSerializer(raw))), getOptionGroupsAPI().then(raw => required(optionGroupsSerializer(raw)))]);
          return { item, categories, groups, categoryId: categoryId ?? null };
        } catch (e) {
          return rejectWithValue(toRejectedValue(e));
        }
      },
      {
        pending: state => {
          Object.assign(state, initialState, { status: 'loading' });
        },
        fulfilled: (state, action) => {
          const { item, categories, groups, categoryId } = action.payload;
          state.status = 'succeeded';
          state.item = item;
          state.categories = categories;
          state.groups = groups;
          state.form = item ? itemForm(item) : emptyItemForm(categoryId ?? categories[0]?.id ?? '');
        },
        rejected: (state, action) => {
          state.status = 'failed';
          state.error = readRejection(action, "The dish didn't load.");
        },
      },
    ),
    uploadItemPhotoAsync: create.asyncThunk(
      async (file: LocalFile, { rejectWithValue }) => {
        try {
          return await upload(file, 'menu_item', () => undefined);
        } catch (e) {
          return rejectWithValue(toRejectedValue(e));
        }
      },
      {
        pending: state => {
          state.uploading = true;
          state.error = NO_ERROR;
        },
        fulfilled: (state, action) => {
          state.uploading = false;
          if (state.form) state.form.photoUrl = action.payload.url;
        },
        rejected: (state, action) => {
          state.uploading = false;
          state.error = readRejection(action, "The photo didn't upload.");
        },
      },
    ),
    saveMenuItemAsync: create.asyncThunk(
      async (_: void, { getState, dispatch, rejectWithValue }) => {
        const { item, form } = (getState() as { vendorMenuItem: VendorMenuItemSliceState }).vendorMenuItem;
        if (!form) return rejectWithValue({ message: 'Nothing to save.', code: null, details: null });
        try {
          const input = itemInput(form);
          const sizes = variantsInput(form);
          let saved: VendorMenuItem;
          if (!item) {
            saved = required(vendorMenuItemSerializer(await createMenuItemAPI(input, sizes.map(({ name, price }) => ({ name, price })))));
            if (form.groupIds.length) saved = required(vendorMenuItemSerializer(await saveItemGroupsAPI(saved.id, form.groupIds.map(groupId => ({ groupId })))));
          } else {
            saved = required(vendorMenuItemSerializer(await updateMenuItemAPI(item.id, input)));
            const before = item.variants.map(v => ({ id: v.id, name: v.name, price: v.price }));
            if (!sameJson(before, sizes)) saved = required(vendorMenuItemSerializer(await saveItemVariantsAPI(item.id, sizes)));
            const allSizes = item.optionGroups.filter(l => !l.variantId).map(l => l.groupId);
            if (!sameJson(allSizes, form.groupIds)) {
              const perSize = saved.optionGroups.filter(l => l.variantId).map(l => ({ groupId: l.groupId, variantId: l.variantId! }));
              saved = required(vendorMenuItemSerializer(await saveItemGroupsAPI(item.id, [...form.groupIds.map(groupId => ({ groupId })), ...perSize])));
            }
          }
          dispatch(menuChanged());
          return saved;
        } catch (e) {
          return rejectWithValue(toRejectedValue(e));
        }
      },
      {
        pending: state => {
          state.saving = true;
          state.error = NO_ERROR;
        },
        fulfilled: (state, action) => {
          state.saving = false;
          state.item = action.payload;
          state.form = itemForm(action.payload);
          state.submitted = false;
        },
        rejected: (state, action) => {
          state.saving = false;
          state.error = readRejection(action, "The dish didn't save.");
        },
      },
    ),
    deleteMenuItemAsync: create.asyncThunk(
      async (id: string, { dispatch, rejectWithValue }) => {
        try {
          await deleteMenuItemAPI(id);
          dispatch(menuChanged());
          return id;
        } catch (e) {
          return rejectWithValue(toRejectedValue(e));
        }
      },
      {
        pending: state => {
          state.saving = true;
          state.error = NO_ERROR;
        },
        fulfilled: state => {
          state.saving = false;
        },
        rejected: (state, action) => {
          state.saving = false;
          state.error = readRejection(action, "The dish wasn't deleted.");
        },
      },
    ),
    duplicateMenuItemAsync: create.asyncThunk(
      async (id: string, { dispatch, rejectWithValue }) => {
        try {
          const copy = required(vendorMenuItemSerializer(await duplicateMenuItemAPI(id)));
          dispatch(menuChanged());
          return copy;
        } catch (e) {
          return rejectWithValue(toRejectedValue(e));
        }
      },
      {
        pending: state => {
          state.saving = true;
          state.error = NO_ERROR;
        },
        fulfilled: state => {
          state.saving = false;
        },
        rejected: (state, action) => {
          state.saving = false;
          state.error = readRejection(action, "The copy wasn't made.");
        },
      },
    ),
  }),
  selectors: {
    selectVendorMenuItem: state => state,
  },
});

export const {
  setItemField,
  toggleItemTag,
  toggleItemDay,
  toggleItemGroup,
  addVariant,
  setVariant,
  removeVariant,
  markItemSubmitted,
  loadMenuItemAsync,
  uploadItemPhotoAsync,
  saveMenuItemAsync,
  deleteMenuItemAsync,
  duplicateMenuItemAsync,
} = vendorMenuItemSlice.actions;
export const { selectVendorMenuItem } = vendorMenuItemSlice.selectors;
