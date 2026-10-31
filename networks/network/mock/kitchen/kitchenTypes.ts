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

// ── Growth (5B): tiffin and catering ──
export type MockMeal = 'breakfast' | 'lunch' | 'dinner';

/** A tiffin plan: the same meal on set weekdays, paid per period. */
export interface MockTiffinPlan {
  id: string;
  businessId: string;
  name: string;
  description: string | null;
  meal: MockMeal;
  /** ISO weekdays it is delivered (1 Monday … 7 Sunday). */
  days: number[];
  period: 'week' | 'month';
  /** Rupees per period. */
  price: number;
  mode: 'delivery' | 'pickup';
  /** "HH:mm", kitchen time. */
  windowFrom: string;
  windowTo: string;
  capacity: number;
  /** A day can be skipped until this many hours before its window. */
  skipCutoffHours: number;
  /** What is cooked on each weekday: dishes from the menu, or a note ("Daal, roti and salad"). */
  rotation: { weekday: number; itemIds: string[]; note: string | null }[];
  photoUrl: string | null;
  isActive: boolean;
  createdAt: string;
}

export type MockTiffinStatus = 'pending' | 'active' | 'paused' | 'declined' | 'ended' | 'cancelled';

export interface MockTiffinSub {
  id: string;
  code: string;
  planId: string;
  businessId: string;
  userId: string;
  status: MockTiffinStatus;
  startDate: string;
  /** The last delivery day once ended or cancelled. */
  endDate: string | null;
  address: Record<string, unknown> | null;
  paymentMethod: 'transfer' | 'cash';
  /** Paused from this day (inclusive) until resumed, or until `pausedUntil` (inclusive). */
  pausedFrom: string | null;
  pausedUntil: string | null;
  declineReason: string | null;
  endReason: string | null;
  createdAt: string;
  approvedAt: string | null;
}

/** One paid period of a subscription (a week, or four weeks). */
export interface MockTiffinPeriod {
  id: string;
  subId: string;
  businessId: string;
  from: string;
  to: string;
  meals: number;
  /** Meals skipped in the period before, taken off this one. */
  credit: number;
  amount: number;
  paymentStatus: 'unpaid' | 'awaiting_transfer' | 'proof_submitted' | 'paid' | 'void';
  payBy: string | null;
  paymentRef: string | null;
  paymentProofUrl: string | null;
  paymentRejectedReason: string | null;
  createdAt: string;
}

/** A day of a subscription that is no longer just "upcoming": skipped, or its order made. */
export interface MockTiffinDay {
  subId: string;
  date: string;
  state: 'skipped' | 'ordered';
  orderId: string | null;
  at: string;
}

export type MockCateringStatus = 'requested' | 'quoted' | 'accepted' | 'confirmed' | 'declined' | 'cancelled' | 'completed';

export interface MockCateringQuote {
  version: number;
  lines: { itemId: string | null; name: string; qty: number; unitPrice: number; total: number }[];
  subtotal: number;
  deliveryFee: number;
  total: number;
  advancePct: number;
  advance: number;
  validUntil: string;
  notes: string | null;
  createdAt: string;
}

export interface MockCateringRequest {
  id: string;
  code: string;
  businessId: string;
  userId: string;
  status: MockCateringStatus;
  /** Kitchen-local date and "HH:mm". */
  date: string;
  time: string;
  guests: number;
  eventType: string;
  dishes: { itemId: string | null; name: string; qty: number }[];
  budget: number | null;
  mode: 'delivery' | 'pickup' | 'on_site';
  address: Record<string, unknown> | null;
  notes: string | null;
  quotes: MockCateringQuote[];
  acceptedVersion: number | null;
  advanceStatus: 'none' | 'awaiting_transfer' | 'proof_submitted' | 'paid';
  advanceRef: string | null;
  advanceProofUrl: string | null;
  advanceRejectedReason: string | null;
  declineReason: string | null;
  cancelReason: string | null;
  createdAt: string;
  updatedAt: string;
}

/** Whether a kitchen takes catering requests, and its limits. */
export interface MockCateringSettings {
  businessId: string;
  open: boolean;
  minGuests: number;
  /** Days ahead an event can be asked for, at least. */
  leadDays: number;
}

// ── Growth (5B): Ramadan, demand, experiments, story, hygiene ──
/** A date that changes what kitchens offer (Ramadan; staff can correct the dates). */
export interface MockCalendarEvent {
  id: string;
  kind: 'ramadan' | 'eid' | 'other';
  name: string;
  startsOn: string;
  endsOn: string;
}

export interface MockRamadanSettings {
  businessId: string;
  enabled: boolean;
  sehriFrom: string;
  sehriTo: string;
  iftarFrom: string;
  iftarTo: string;
  iftarPreorderOnly: boolean;
}

/** One anonymous search: where (to about a kilometre), when, what, and whether an open kitchen matched. */
export interface MockSearchLog {
  at: string;
  lat: number;
  lng: number;
  hour: number;
  cuisine: string | null;
  text: string;
  foundOpen: boolean;
}

export type MockExperimentChange = { kind: 'price'; price: number; oldPrice: number } | { kind: 'photo'; photoUrl: string; oldPhotoUrl: string | null };

export interface MockExperiment {
  id: string;
  businessId: string;
  itemId: string;
  change: MockExperimentChange;
  days: number;
  startedAt: string;
  endsAt: string;
  status: 'running' | 'done' | 'kept' | 'adjusted' | 'dropped' | 'stopped';
  decidedAt: string | null;
}

export interface MockStory {
  businessId: string;
  text: string;
  cookName: string;
  photoUrls: string[];
  videoUrl: string | null;
  updatedAt: string;
}

export type MockHygieneStatus = 'none' | 'self_declared' | 'pending' | 'verified' | 'rejected';

export interface MockHygiene {
  businessId: string;
  status: MockHygieneStatus;
  note: string | null;
  items: { key: string; done: boolean; evidenceUrl: string | null }[];
  requestedAt: string | null;
  reviewedAt: string | null;
}

/** Staff looked at a signature dish: kept it, or took the label off with a note. */
export interface MockSignatureReview {
  itemId: string;
  businessId: string;
  status: 'approved' | 'removed';
  note: string | null;
  at: string;
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
  /** Reserve's and subscribe's Idempotency-Key → what it made. */
  idempotency: Record<string, string>;
  tiffinPlans: MockTiffinPlan[];
  tiffinSubs: MockTiffinSub[];
  tiffinPeriods: MockTiffinPeriod[];
  tiffinDays: MockTiffinDay[];
  catering: MockCateringRequest[];
  cateringSettings: MockCateringSettings[];
  calendarEvents: MockCalendarEvent[];
  ramadan: MockRamadanSettings[];
  searches: MockSearchLog[];
  experiments: MockExperiment[];
  stories: MockStory[];
  hygiene: MockHygiene[];
  /** The last day the demo kitchens' everyday sales were filled in (they keep selling as the clock moves). */
  salesThrough: Record<string, string>;
  // The assistant (5C)
  /** A dish's Urdu description (Food's dish keeps the English one). */
  itemTexts?: { itemId: string; descriptionUr: string | null }[];
  /** Dishes whose nutrition the kitchen hides from customers. */
  nutritionHidden?: string[];
  /** Drafts already counted (`review_insights:<business>:<week>`, `nutrition_estimate:<item>`), so a view doesn't count twice. */
  aiCounted?: string[];
  /** Staff's reviews of signature dishes (5C console). */
  signatureReviews?: MockSignatureReview[];
  // My Kitchen (5C): the customer's own; never shown to a kitchen.
  pantry?: MockPantryItem[];
  pantryReminders?: MockPantryReminders[];
  nutritionSettings?: MockNutritionSettings[];
  seq: number;
}

// ── My Kitchen (5C) ──
export interface MockPantryItem {
  id: string;
  userId: string;
  name: string;
  /** The canonical ingredient (aliases), or null when unknown. */
  key: string | null;
  /** Base units. */
  qty: number;
  unit: BaseUnit;
  expiresOn: string | null;
  addedAt: string;
  source: 'manual' | 'voice' | 'shopping';
  /** in the kitchen, used up, or thrown away. */
  status: 'in' | 'used' | 'thrown';
  doneAt: string | null;
  /** Used before it expired (counted as saved from waste). */
  savedFromWaste: boolean;
}

export interface MockPantryReminders {
  userId: string;
  enabled: boolean;
  time: string;
  daysBefore: number;
}

export interface MockNutritionSettings {
  userId: string;
  enabled: boolean;
  showCalories: boolean;
  goal: 'eat_better' | 'maintain' | 'lose' | 'gain';
  metrics: { sex: 'female' | 'male'; age: number; heightCm: number; weightKg: number; activity: 'low' | 'moderate' | 'high' } | null;
  manualTargetKcal: number | null;
  updatedAt: string;
}
