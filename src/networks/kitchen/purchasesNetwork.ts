// MetroMatrix — Kitchen: purchases, suppliers, the price watch.
// docs/API_KITCHEN_ASSUMED.md §4.1 (TODO(API_KITCHEN): an assumed contract).

import { api } from '../network/apiHelpers';
import { clean, pageParams, request } from '../shopping/http';
import { priceWatchSerializer, purchaseSerializer, purchasesPageSerializer, supplierSerializer, suppliersSerializer } from '../../serializers/kitchen/stockSerializer';
import type { PurchaseInput } from '../../types/kitchen';

const enc = encodeURIComponent;

export const listPurchases = (page: number, pageSize: number) =>
  request(() => api.get('/food/vendor/kitchen/purchases', { params: pageParams(page, pageSize) }), purchasesPageSerializer);

export const getPurchase = (id: string) => request(() => api.get(`/food/vendor/kitchen/purchases/${enc(id)}`), purchaseSerializer);

export const createPurchase = (input: PurchaseInput) => request(() => api.post('/food/vendor/kitchen/purchases', input), purchaseSerializer);

export const listSuppliers = () => request(() => api.get('/food/vendor/kitchen/suppliers'), suppliersSerializer);

export const createSupplier = (input: { name: string; phone?: string | null; note?: string | null }) =>
  request(() => api.post('/food/vendor/kitchen/suppliers', clean(input)), supplierSerializer);

export const updateSupplier = (id: string, patch: { name?: string; phone?: string | null; note?: string | null }) =>
  request(() => api.patch(`/food/vendor/kitchen/suppliers/${enc(id)}`, patch), supplierSerializer);

export const deleteSupplier = (id: string) => request(() => api.delete(`/food/vendor/kitchen/suppliers/${enc(id)}`), () => true as const);

export const getPriceWatch = () => request(() => api.get('/food/vendor/kitchen/price-watch'), priceWatchSerializer);
