// MetroMatrix — Food Court: the bag (one vendor at a time) and its preview.
// docs/API_FOOD.md §4.2: /food/cart (+ /items, /preview).

import { api } from '../network/apiHelpers';
import { foodCartSerializer, foodPreviewSerializer, foodSlotsSerializer } from '../../serializers/food/orderSerializer';
import type { FoodCheckoutInput, FoodFulfilment } from '../../types/food';
import { request } from '../shopping/http';

const enc = encodeURIComponent;

export const getFoodCart = () => request(() => api.get('/food/cart'), foodCartSerializer);

/** A vendor's pre-order slots for the next week, with places left (vendor id or slug). */
export const getVendorSlots = (vendor: string) => request(() => api.get(`/food/vendors/${enc(vendor)}/slots`), foodSlotsSerializer);

export const clearFoodCart = () => request(() => api.delete('/food/cart'), () => true);

/** Delivery or pick-up, and when (null: as soon as possible). */
export const setFoodCartMode = (input: { fulfilment?: FoodFulfilment; scheduledFor?: string | null }) =>
  request(() => api.patch('/food/cart', input), foodCartSerializer);

/**
 * Add a dish. Another vendor's dishes in the bag → 409 CART_OTHER_VENDOR
 * (details.currentVendor); `replace` starts a new bag instead.
 */
export const addToFoodCart = (
  input: { vendorId: string; itemId: string; variantId: string | null; optionIds: string[]; quantity: number; notes: string | null },
  replace = false,
) =>
  request(
    () =>
      api.post(
        '/food/cart/items',
        { vendorId: input.vendorId, itemId: input.itemId, variantId: input.variantId, optionIds: input.optionIds, quantity: input.quantity, ...(input.notes ? { notes: input.notes } : null) },
        { params: replace ? { replace: 'true' } : undefined },
      ),
    foodCartSerializer,
  );

export const updateFoodCartLine = (lineId: string, input: { quantity?: number; notes?: string | null }) =>
  request(() => api.patch(`/food/cart/items/${enc(lineId)}`, input), foodCartSerializer);

export const removeFoodCartLine = (lineId: string) => request(() => api.delete(`/food/cart/items/${enc(lineId)}`), foodCartSerializer);

const orderDetails = (input: Partial<FoodCheckoutInput>) => ({
  ...(input.addressId ? { addressId: input.addressId } : null),
  ...(input.paymentMethod ? { paymentMethod: input.paymentMethod } : null),
  ...(input.promoCode ? { promoCode: input.promoCode.trim() } : null),
  ...(input.cutlery !== undefined ? { cutlery: input.cutlery } : null),
  ...(input.note ? { note: input.note } : null),
  ...(input.building ? { building: input.building } : null),
  ...(input.floor ? { floor: input.floor } : null),
  ...(input.riderInstructions ? { riderInstructions: input.riderInstructions } : null),
});

/** Totals exactly as checkout would charge them, with every issue to fix. */
export const previewFoodCart = (input: Partial<FoodCheckoutInput>) => request(() => api.post('/food/cart/preview', orderDetails(input)), foodPreviewSerializer);

export { orderDetails };
