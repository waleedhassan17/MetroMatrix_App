// ═══════════════════════════════════════════════════════
// MetroMatrix — Product form slice (add or edit a product)
// ═══════════════════════════════════════════════════════
// A draft saves half-done; publishing needs what a buyer can't do without
// (productFormModel). Options cross into variants, each with its own stock
// and SKU (variantMatrixModel). Photos upload as they're added; the first is
// the cover.

import type { PayloadAction } from '@reduxjs/toolkit';
import { createAppSlice } from '../../store/createAppSlice';
import { fetchCategories } from '../../networks/shopping/catalog';
import {
  createPartnerProduct,
  fetchPartnerProduct,
  fetchCollections,
  setPartnerProductStatus,
  updatePartnerProduct,
} from '../../networks/shopping/partner/products';
import { toRejectedValue, required } from '../../networks/network/network';
import {
  MAX_OPTION_VALUES,
  emptyProductForm,
  fromPartnerProduct,
  makeCover,
  movePhoto,
  syncVariants,
  toProductInput,
  type ProductForm,
} from '../../models/shopping/productFormModel';
import { swatchFor } from '../../models/shopping/colourNames';
import { setAllStock, type VariantRow } from '../../models/shopping/variantMatrixModel';
import type { Collection, LocalFile, PartnerProductStatus, ShopCategory } from '../../models';
import { NO_ERROR, readRejection, type FormStatus, type ServerError } from '../shared/formStatus';
import { pendingPhoto, photoFailed, photoProgress, upload, type FormPhoto } from '../shared/photoUploads';
import { partnerProductSerializer } from '../../serializers/shopping/partnerSerializer';
import { categoryListSerializer, collectionListSerializer } from '../../serializers/shopping/catalogSerializer';

export interface ProductFormSliceState {
  productId: string | null;
  form: ProductForm;
  /** What was loaded or last saved (the unsaved-changes guard compares). */
  original: ProductForm;
  loadStatus: FormStatus;
  saveStatus: FormStatus;
  error: ServerError;
  /** Field messages from the server (PUBLISH_BLOCKED, VALIDATION_FAILED). */
  serverFields: Record<string, string>;
  submitted: 'draft' | 'publish' | null;
  categories: ShopCategory[];
  collections: Collection[];
  uploads: FormPhoto[];
  optionInput: { 1: string; 2: string };
}

const initialState: ProductFormSliceState = {
  productId: null,
  form: emptyProductForm(),
  original: emptyProductForm(),
  loadStatus: 'idle',
  saveStatus: 'idle',
  error: NO_ERROR,
  serverFields: {},
  submitted: null,
  categories: [],
  collections: [],
  uploads: [],
  optionInput: { 1: '', 2: '' },
};

const fieldsOf = (details: Record<string, any> | null): Record<string, string> => {
  const f = details?.fields;
  if (!f || typeof f !== 'object') return {};
  return Object.fromEntries(Object.entries(f).map(([k, v]) => [k, Array.isArray(v) ? String(v[0]) : String(v)]));
};

const resync = (state: ProductFormSliceState) => {
  state.form.variants = syncVariants(state.form);
};

type Field = Exclude<keyof ProductForm, 'variants' | 'images' | 'option1Values' | 'option2Values' | 'swatches'>;

export const productFormSlice = createAppSlice({
  name: 'productForm',
  initialState,
  reducers: create => ({
    resetProductForm: create.reducer(() => initialState),
    /** A save was tried: show the local messages for that intent. */
    attemptProductSave: create.reducer((state, action: PayloadAction<'draft' | 'publish'>) => {
      state.submitted = action.payload;
    }),
    setProductField: create.reducer(<K extends Field>(state: ProductFormSliceState, action: PayloadAction<{ field: K; value: ProductForm[K] }>) => {
      state.form[action.payload.field] = action.payload.value;
      if (action.payload.field === 'hasOptions' || action.payload.field === 'baseSku') resync(state);
      delete state.serverFields[action.payload.field];
    }),
    setOptionInput: create.reducer((state, action: PayloadAction<{ which: 1 | 2; text: string }>) => {
      state.optionInput[action.payload.which] = action.payload.text;
    }),
    /** Add what's typed (comma-separated works too) to option 1 or 2. */
    addOptionValues: create.reducer((state, action: PayloadAction<1 | 2>) => {
      const which = action.payload;
      const key = which === 1 ? 'option1Values' : 'option2Values';
      const typed = state.optionInput[which].split(',').map(v => v.trim()).filter(Boolean);
      for (const v of typed) {
        if (state.form[key].length >= MAX_OPTION_VALUES) break;
        if (state.form[key].some(x => x.toLowerCase() === v.toLowerCase())) continue;
        state.form[key].push(v);
        if (which === 2) {
          const hex = swatchFor(v);
          if (hex) state.form.swatches[v] = hex;
        }
      }
      state.optionInput[which] = '';
      resync(state);
    }),
    removeOptionValue: create.reducer((state, action: PayloadAction<{ which: 1 | 2; value: string }>) => {
      const key = action.payload.which === 1 ? 'option1Values' : 'option2Values';
      state.form[key] = state.form[key].filter(v => v !== action.payload.value);
      delete state.form.swatches[action.payload.value];
      resync(state);
    }),
    setVariantField: create.reducer((state, action: PayloadAction<{ key: string; field: 'sku' | 'stock' | 'priceDelta'; value: string }>) => {
      const row = state.form.variants.find(v => v.key === action.payload.key);
      if (row) row[action.payload.field] = action.payload.field === 'sku' ? action.payload.value.toUpperCase() : action.payload.value.replace(/[^\d-]/g, '');
      delete state.serverFields.variants;
    }),
    setEveryStock: create.reducer((state, action: PayloadAction<number>) => {
      state.form.variants = setAllStock(state.form.variants, action.payload) as VariantRow[];
    }),
    moveProductPhoto: create.reducer((state, action: PayloadAction<{ index: number; by: -1 | 1 }>) => {
      state.form.images = movePhoto(state.form.images, action.payload.index, action.payload.by);
    }),
    makeCoverPhoto: create.reducer((state, action: PayloadAction<number>) => {
      state.form.images = makeCover(state.form.images, action.payload);
    }),
    removeProductPhoto: create.reducer((state, action: PayloadAction<number>) => {
      state.form.images = state.form.images.filter((_, i) => i !== action.payload);
    }),
    productPhotoProgress: create.reducer((state, action: PayloadAction<{ key: string; progress: number }>) => {
      photoProgress(state.uploads, action.payload.key, action.payload.progress);
    }),

    loadProductFormAsync: create.asyncThunk(
      async (id: string | null, { rejectWithValue }) => {
        try {
          const [product, categories, collections] = await Promise.all([id ? fetchPartnerProduct(id).then(raw => required(partnerProductSerializer(raw))) : Promise.resolve(null), fetchCategories().then(raw => required(categoryListSerializer(raw))), fetchCollections().then(raw => required(collectionListSerializer(raw)))]);
          return { product, categories, collections };
        } catch (e) {
          return rejectWithValue(toRejectedValue(e));
        }
      },
      {
        pending: (state, action) => {
          state.loadStatus = 'loading';
          state.productId = action.meta.arg;
          state.error = NO_ERROR;
        },
        fulfilled: (state, action) => {
          state.loadStatus = 'succeeded';
          state.categories = action.payload.categories;
          state.collections = action.payload.collections;
          const form = action.payload.product ? fromPartnerProduct(action.payload.product) : emptyProductForm();
          state.form = form;
          state.original = form;
        },
        rejected: (state, action) => {
          state.loadStatus = 'failed';
          state.error = readRejection(action, "We couldn't open this product.");
        },
      },
    ),

    addProductPhotoAsync: create.asyncThunk(
      async ({ key, file }: { key: string; file: LocalFile }, { dispatch, rejectWithValue }) => {
        try {
          return await upload(file, 'product_image', progress => dispatch(productFormSlice.actions.productPhotoProgress({ key, progress })));
        } catch (e) {
          return rejectWithValue(toRejectedValue(e));
        }
      },
      {
        pending: (state, action) => {
          state.uploads.push(pendingPhoto(action.meta.arg.key, action.meta.arg.file));
        },
        fulfilled: (state, action) => {
          state.uploads = state.uploads.filter(u => u.key !== action.meta.arg.key);
          state.form.images.push({ url: action.payload.url, publicId: action.payload.publicId });
          delete state.serverFields.images;
        },
        rejected: (state, action) => {
          state.uploads = photoFailed(state.uploads, action.meta.arg.key);
          state.error = readRejection(action, "A photo didn't upload. Try again.");
        },
      },
    ),

    saveProductAsync: create.asyncThunk(
      async ({ id, form, status }: { id: string | null; form: ProductForm; status: PartnerProductStatus }, { rejectWithValue }) => {
        try {
          const input = toProductInput(form, status);
          return id ? await updatePartnerProduct(id, input) : await createPartnerProduct(input);
        } catch (e) {
          return rejectWithValue(toRejectedValue(e));
        }
      },
      {
        pending: (state, action) => {
          state.saveStatus = 'loading';
          state.submitted = action.meta.arg.status === 'active' ? 'publish' : 'draft';
          state.error = NO_ERROR;
          state.serverFields = {};
        },
        fulfilled: (state, action) => {
          const payload = partnerProductSerializer(action.payload);
          state.saveStatus = 'succeeded';
          if (!payload) return;
          state.productId = payload.id;
          const form = fromPartnerProduct(payload);
          state.form = form;
          state.original = form;
        },
        rejected: (state, action) => {
          state.saveStatus = 'failed';
          state.error = readRejection(action, "We couldn't save this product.");
          state.serverFields = fieldsOf(state.error.details);
        },
      },
    ),

    setProductStatusAsync: create.asyncThunk(
      async ({ id, status }: { id: string; status: PartnerProductStatus }, { rejectWithValue }) => {
        try {
          return await setPartnerProductStatus(id, status);
        } catch (e) {
          return rejectWithValue(toRejectedValue(e));
        }
      },
      {
        pending: state => {
          state.saveStatus = 'loading';
          state.error = NO_ERROR;
        },
        fulfilled: (state, action) => {
          const payload = partnerProductSerializer(action.payload);
          state.saveStatus = 'succeeded';
          if (!payload) return;
          state.form.status = payload.status;
          state.original.status = payload.status;
        },
        rejected: (state, action) => {
          state.saveStatus = 'failed';
          state.error = readRejection(action, "We couldn't change this product.");
          state.serverFields = fieldsOf(state.error.details);
        },
      },
    ),
  }),
  selectors: {
    selectProductForm: state => state,
  },
});

export const {
  resetProductForm,
  attemptProductSave,
  setProductField,
  setOptionInput,
  addOptionValues,
  removeOptionValue,
  setVariantField,
  setEveryStock,
  moveProductPhoto,
  makeCoverPhoto,
  removeProductPhoto,
  loadProductFormAsync,
  addProductPhotoAsync,
  saveProductAsync,
  setProductStatusAsync,
} = productFormSlice.actions;
export const { selectProductForm } = productFormSlice.selectors;
