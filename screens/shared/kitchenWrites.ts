// ═══════════════════════════════════════════════════════
// MetroMatrix — The Kitchen's writes, composed
// ═══════════════════════════════════════════════════════
// A purchase can name a supplier or an ingredient the kitchen hasn't added
// yet; the API's purchase takes ids, so they are created first (each answer
// is read only for its id), then the purchase. The answer stays raw: the
// slices' fulfilled reducers serialize it.

import { required } from '../../networks/network/network';
import { createPurchase, createSupplier } from '../../networks/kitchen/purchases';
import { createIngredient } from '../../networks/kitchen/stock';
import type { PurchaseInput } from '../../models/kitchen';
import { ingredientSerializer, supplierSerializer } from '../../serializers/kitchen/stockSerializer';
import { fromResponse } from '../../serializers/serializerUtils';

const ingredientOf = fromResponse(ingredientSerializer);

/** New supplier and ingredients first, then the purchase. */
export const savePurchase = async (input: PurchaseInput): Promise<unknown> => {
  const supplierId = input.supplierId ?? (input.supplierName?.trim() ? required(supplierSerializer(await createSupplier({ name: input.supplierName.trim() }))).id : null);
  const lines = [];
  for (const l of input.lines) {
    if (l.ingredientId || !l.newIngredient) lines.push(l);
    else {
      const made = required(ingredientOf(await createIngredient({ name: l.newIngredient.name, category: l.newIngredient.category, baseUnit: l.newIngredient.baseUnit })));
      lines.push({ ...l, ingredientId: made.id, newIngredient: undefined });
    }
  }
  return createPurchase({ ...input, supplierId, supplierName: null, lines });
};
