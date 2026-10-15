// ═══════════════════════════════════════════════════════
// MetroMatrix — Product form (store partner)
// ═══════════════════════════════════════════════════════
// A draft can be saved half-done at any time. Publishing needs the things a
// customer cannot buy without: a name, a price, a category, at least one
// photo and at least one variant in stock.

import type { PartnerProduct, PartnerProductInput, PartnerProductStatus, ProductImage } from '../../types/shopping';
import type { ValidationErrors } from '../authModel';
import { discountPercent, parseRupees } from '../../utils/money';
import { buildMatrix, rowKey, skuFor, toInt, totalStock, type VariantRow } from './variantMatrixModel';

export const MAX_PRODUCT_PHOTOS = 8;
export const MAX_OPTION_VALUES = 12;

export interface ProductForm {
  name: string;
  description: string;
  categoryId: string | null;
  collectionId: string | null;
  price: string;
  salePrice: string;
  images: ProductImage[];
  hasOptions: boolean;
  option1Name: string;
  option1Values: string[];
  option2Name: string;
  option2Values: string[];
  swatches: Record<string, string>;
  baseSku: string;
  /** One row when there are no options; the matrix otherwise. */
  variants: VariantRow[];
  status: PartnerProductStatus;
}

export const emptyProductForm = (): ProductForm => ({
  name: '',
  description: '',
  categoryId: null,
  collectionId: null,
  price: '',
  salePrice: '',
  images: [],
  hasOptions: false,
  option1Name: 'Size',
  option1Values: [],
  option2Name: 'Colour',
  option2Values: [],
  swatches: {},
  baseSku: '',
  variants: [{ key: rowKey(null, null), id: null, option1: null, option2: null, sku: '', stock: '0', priceDelta: '0' }],
  status: 'draft',
});

/** The variant rows the current options imply (keeps typed stock/SKU). */
export const syncVariants = (form: ProductForm): VariantRow[] =>
  form.hasOptions
    ? buildMatrix(form.option1Values, form.option2Values, form.variants, form.baseSku)
    : buildMatrix([], [], form.variants.filter(v => !v.option1 && !v.option2), form.baseSku);

export const salePreviewPercent = (form: Pick<ProductForm, 'price' | 'salePrice'>): number => {
  const price = parseRupees(form.price);
  const sale = parseRupees(form.salePrice);
  return price && sale ? discountPercent(sale, price) : 0;
};

export const validateProductForm = (form: ProductForm, intent: 'draft' | 'publish'): ValidationErrors => {
  const errors: ValidationErrors = {};
  if (!form.name.trim()) errors.name = 'Give the product a name';
  else if (form.name.trim().length > 80) errors.name = 'Keep the name under 80 characters';

  const price = parseRupees(form.price);
  const sale = parseRupees(form.salePrice);
  if (form.price && (price === null || price <= 0)) errors.price = 'Enter a price in rupees';
  if (form.salePrice && (sale === null || sale <= 0)) errors.salePrice = 'Enter a sale price in rupees';
  else if (sale !== null && price !== null && sale >= price) errors.salePrice = 'The sale price must be below the price';

  if (form.hasOptions) {
    if (!form.option1Name.trim() || !form.option1Values.length) errors.option1 = 'Add at least one value, or turn options off';
    if (form.option2Values.length && !form.option2Name.trim()) errors.option2 = 'Name the second option';
    if (form.option1Values.length > MAX_OPTION_VALUES || form.option2Values.length > MAX_OPTION_VALUES) {
      errors.option1 = `Up to ${MAX_OPTION_VALUES} values per option`;
    }
  }
  const skus = form.variants.map(v => v.sku.trim().toUpperCase()).filter(Boolean);
  if (new Set(skus).size !== skus.length) errors.variants = 'Each variant needs its own SKU';
  if (form.variants.some(v => toInt(v.stock) < 0)) errors.variants = 'Stock cannot be negative';

  if (intent === 'publish') {
    if (!form.price) errors.price = 'Add a price before publishing';
    if (!form.categoryId) errors.categoryId = 'Choose a category before publishing';
    if (!form.images.length) errors.images = 'Add at least one photo before publishing';
    if (totalStock(form.variants) < 1) errors.variants = 'At least one variant must be in stock to publish';
  }
  return errors;
};

export const toProductInput = (form: ProductForm, status: PartnerProductStatus): PartnerProductInput => ({
  name: form.name.trim(),
  description: form.description.trim(),
  categoryId: form.categoryId,
  collectionId: form.collectionId,
  price: parseRupees(form.price) ?? 0,
  salePrice: parseRupees(form.salePrice),
  status,
  images: form.images,
  option1: form.hasOptions && form.option1Values.length ? { name: form.option1Name.trim(), values: form.option1Values } : null,
  option2:
    form.hasOptions && form.option2Values.length
      ? { name: form.option2Name.trim(), values: form.option2Values, swatches: form.swatches }
      : null,
  variants: form.variants.map(v => ({
    id: v.id,
    option1: v.option1,
    option2: v.option2,
    sku: v.sku.trim().toUpperCase() || skuFor(form.baseSku, v.option1, v.option2),
    stock: Math.max(0, toInt(v.stock)),
    priceDelta: toInt(v.priceDelta),
  })),
});

export const fromPartnerProduct = (p: PartnerProduct): ProductForm => ({
  name: p.name,
  description: p.description,
  categoryId: p.categoryId,
  collectionId: p.collectionId,
  price: p.price ? String(p.price) : '',
  salePrice: p.salePrice ? String(p.salePrice) : '',
  images: p.images,
  hasOptions: !!p.option1,
  option1Name: p.option1?.name ?? 'Size',
  option1Values: p.option1?.values ?? [],
  option2Name: p.option2?.name ?? 'Colour',
  option2Values: p.option2?.values ?? [],
  swatches: p.option2?.swatches ?? {},
  baseSku: (p.variants[0]?.sku ?? '').split('-').slice(0, 2).join('-'),
  variants: p.variants.map(v => ({
    key: rowKey(v.option1, v.option2),
    id: v.id,
    option1: v.option1,
    option2: v.option2,
    sku: v.sku,
    stock: String(v.stock),
    priceDelta: String(v.priceDelta),
  })),
  status: p.status,
});

/** Has the form moved away from what was loaded? (unsaved-changes guard) */
export const isFormDirty = (a: ProductForm, b: ProductForm): boolean => JSON.stringify(a) !== JSON.stringify(b);

/** Move a photo one place left (-1) or right (+1); index 0 is the cover. */
export const movePhoto = (images: ProductImage[], index: number, by: -1 | 1): ProductImage[] => {
  const to = index + by;
  if (to < 0 || to >= images.length) return images;
  const next = [...images];
  [next[index], next[to]] = [next[to], next[index]];
  return next;
};

export const makeCover = (images: ProductImage[], index: number): ProductImage[] =>
  index <= 0 || index >= images.length ? images : [images[index], ...images.filter((_, i) => i !== index)];
