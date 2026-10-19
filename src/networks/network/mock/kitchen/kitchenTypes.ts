// ═══════════════════════════════════════════════════════
// MetroMatrix — Dummy kitchen database rows (Chunk 5, assumed contract)
// ═══════════════════════════════════════════════════════
// Stock in base units (g, ml, pieces), recipes per dish and size, purchases,
// forecasts from daily sales, waste, Bachat Box, the assistant's usage — for
// each Food vendor (keyed by businessId, as the Food rows are). Sent through
// kitchenWire in the shapes docs/API_KITCHEN_ASSUMED.md gives.

import type { BaseUnit, CustomUnit } from '../../../../utils/units';

export type MockIngredientCategory =
  | 'meat_poultry'
  | 'vegetables'
  | 'fruit'
  | 'dairy'
  | 'grains_flour'
  | 'spices'
  | 'oils_ghee'
  | 'bakery'
  | 'drinks'
  | 'packaging'
  | 'other';

export interface MockIngredient {
  id: string;
  businessId: string;
  name: string;
  category: MockIngredientCategory;
  baseUnit: BaseUnit;
  /** Pieces shown in dozens (eggs). */
  dozens: boolean;
  customUnits: CustomUnit[];
  /** Restock below this (base units); null: no par level. */
  parLevel: number | null;
  /** The canonical name (tomato, chicken): the city price list's key, the aliases' and the nutrition match's; null when unknown. */
  priceRefKey: string | null;
  nutritionFoodId: string | null;
  /** Used more than was recorded (base units): on hand goes below zero. */
  deficit: number;
  createdAt: string;
  updatedAt: string;
}

/** One delivery of an ingredient: used first in, first out. */
export interface MockBatch {
  id: string;
  businessId: string;
  ingredientId: string;
  /** What is left of it (base units). */
  qty: number;
  receivedQty: number;
  /** Rupees per base unit. */
  costPerBase: number;
  receivedAt: string;
  expiresOn: string | null;
  purchaseId: string | null;
}

export type MockMovementKind = 'purchase' | 'usage' | 'waste' | 'count' | 'return';

export interface MockMovement {
  id: string;
  businessId: string;
  ingredientId: string;
  kind: MockMovementKind;
  /** Signed base units: + in, − out. */
  qty: number;
  at: string;
  note: string | null;
  orderId: string | null;
  orderCode: string | null;
  purchaseId: string | null;
}

export interface MockRecipeLine {
  ingredientId: string;
  /** Base units for the whole batch (`yield` servings). */
  qty: number;
}

export interface MockRecipe {
  businessId: string;
  itemId: string;
  /** null: the dish without sizes, or every size alike. */
  variantId: string | null;
  /** Servings the lines make. */
  yield: number;
  lines: MockRecipeLine[];
  /** What an add-on (an option) uses, per serving. */
  addOns: { optionId: string; lines: MockRecipeLine[] }[];
  /** Boxes, bags, foil: per serving. */
  packaging: MockRecipeLine[];
  signature: { on: boolean; creatorName: string | null };
  updatedAt: string;
}

export interface MockSupplier {
  id: string;
  businessId: string;
  name: string;
  phone: string | null;
  note: string | null;
  createdAt: string;
}

export interface MockPurchase {
  id: string;
  businessId: string;
  /** Kitchen-local date. */
  date: string;
  supplierId: string | null;
  source: 'manual' | 'receipt' | 'voice';
  receiptUrl: string | null;
  lines: { id: string; ingredientId: string; qty: number; total: number; expiresOn: string | null; batchId: string }[];
  total: number;
  createdAt: string;
}

export interface MockKitchenSettings {
  businessId: string;
  targetFoodCostPct: number;
  autoSellOut: boolean;
  packingPhoto: 'off' | 'optional' | 'required';
}

/** Dishes sold on a kitchen-local day (the forecast's history). */
export interface MockDailySale {
  businessId: string;
  itemId: string;
  date: string;
  qty: number;
}

export interface MockForecastAdjustment {
  businessId: string;
  date: string;
  itemId: string;
  adjusted: number;
}

export type MockWasteReason = 'expired' | 'spoiled' | 'burnt' | 'dropped' | 'leftover' | 'other';

export interface MockWaste {
  id: string;
  businessId: string;
  at: string;
  lines: { ingredientId: string | null; itemId: string | null; name: string; qty: number; baseUnit: BaseUnit | null; cost: number; reason: MockWasteReason }[];
  cost: number;
  note: string | null;
}

export interface MockDonation {
  id: string;
  businessId: string;
  at: string;
  meals: number;
  to: string;
  note: string | null;
}

export interface MockSurplusBox {
  id: string;
  businessId: string;
  title: string;
  contentsHint: string;
  photoUrl: string | null;
  value: number;
  price: number;
  quantity: number;
  pickupFrom: string;
  pickupTo: string;
  status: 'live' | 'ended' | 'cancelled';
  createdAt: string;
}

export interface MockSurplusReservation {
  id: string;
  code: string;
  boxId: string;
  businessId: string;
  userId: string;
  quantity: number;
  total: number;
  status: 'reserved' | 'collected' | 'no_show' | 'cancelled';
  paymentMethod: 'pay_at_pickup' | 'transfer';
  paymentStatus: 'unpaid' | 'awaiting_transfer' | 'proof_submitted' | 'paid' | 'void';
  payBy: string | null;
  paymentRef: string | null;
  paymentProofUrl: string | null;
  paymentRejectedReason: string | null;
  reservedAt: string;
  collectedAt: string | null;
  cancelledAt: string | null;
}

/** The private side of a pause: why, and when it lifts by itself. */
export interface MockPauseInfo {
  businessId: string;
  reason: 'gas' | 'electricity' | 'weather' | 'staff' | 'stock' | 'other' | null;
  resumeAt: string | null;
}

/** An order's kitchen side: what it took from stock, its packing photo, where it came from. */
export interface MockOrderKitchen {
  orderId: string;
  /** What it took from stock, batch by batch (null: beyond the records), so a cancel can give it back. */
  deducted: { ingredientId: string; batchId: string | null; qty: number; costPerBase: number }[];
  packedPhotoUrl: string | null;
  packingCheck: { ok: boolean; note: string } | null;
  origin: { kind: 'app' | 'link' | 'qr' | 'tiffin' | 'catering'; ref: string | null };
}

export interface MockAiUse {
  /** A business (vendor) or a user (customer). */
  ownerId: string;
  feature: string;
  at: string;
  ok: boolean;
  ms: number;
}

/** A food's nutrition per 100 g or 100 ml (per piece for pieces): the reference staff keep. */
export interface MockNutritionFood {
  id: string;
  key: string;
  name: string;
  per: 'g100' | 'ml100' | 'piece';
  kcal: number;
  protein: number;
  carbs: number;
  fat: number;
  updatedAt: string;
}

/** A word for an ingredient (Roman Urdu, Urdu, English) → its canonical key. */
export interface MockAlias {
  id: string;
  word: string;
  language: 'ur' | 'roman_ur' | 'en';
  key: string;
}

export interface MockKitchen {
  ingredients: MockIngredient[];
  batches: MockBatch[];
  movements: MockMovement[];
  recipes: MockRecipe[];
  suppliers: MockSupplier[];
  purchases: MockPurchase[];
  settings: MockKitchenSettings[];
  sales: MockDailySale[];
  adjustments: MockForecastAdjustment[];
  waste: MockWaste[];
  donations: MockDonation[];
  boxes: MockSurplusBox[];
  reservations: MockSurplusReservation[];
  pauses: MockPauseInfo[];
  orders: MockOrderKitchen[];
  /** Insight cards snoozed until (businessId:cardId → ISO). */
  snoozed: Record<string, string>;
  aiUses: MockAiUse[];
  /** Staff overrides of the monthly assistant limit (ownerId → limit). */
  aiLimits: Record<string, number>;
  /** Staff's switch for the whole assistant (voice and AI drafts). */
  aiEnabled: boolean;
  nutritionFoods: MockNutritionFood[];
  aliases: MockAlias[];
  /** City price list: per key, city and week (Monday), rupees per base unit. */
  priceRefs: { key: string; name: string; city: string; week: string; costPerBase: number }[];
  /** Voice stand-in: the next demo phrase per context. */
  voiceCursor: Record<string, number>;
  /** Reserve's Idempotency-Key → the reservation it made. */
  idempotency: Record<string, string>;
  seq: number;
}
