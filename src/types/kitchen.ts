// ═══════════════════════════════════════════════════════
// MetroMatrix — Kitchen Intelligence (Chunk 5): the app's own shapes
// ═══════════════════════════════════════════════════════
// What the serializers make of docs/API_KITCHEN_ASSUMED.md, docs/AI_ASSUMED.md
// and docs/VOICE_ASSUMED.md. Quantities stay in base units (g, ml, pieces)
// and are worded only by utils/units; money is whole rupees, shown only
// through formatPKR. TODO(API_KITCHEN): an assumed contract.

import type { BaseUnit, CustomUnit, StandardUnit } from '../utils/units';
import type { FoodPaymentStatus, FoodTransferAccount } from './food';

export type IngredientCategory =
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

export type StockState = 'ok' | 'low' | 'out' | 'negative';
export type StockSegment = 'all' | 'low' | 'expiring' | 'negative';

/** How an ingredient is counted: its base unit, dozens, the kitchen's own units. */
export interface Counting {
  baseUnit: BaseUnit;
  dozens: boolean;
  customUnits: CustomUnit[];
}

export interface Ingredient extends Counting {
  id: string;
  name: string;
  category: IngredientCategory;
  onHand: number;
  parLevel: number | null;
  state: StockState;
  /** Rupees per base unit: the average of what is in stock, and the latest price paid. */
  costPerBase: number;
  latestCostPerBase: number;
  /** The soonest stock expiring within two days. */
  expiring: { on: string; qty: number } | null;
  priceRefKey: string | null;
  nutritionFoodId: string | null;
  updatedAt: string;
}

export type MovementKind = 'purchase' | 'usage' | 'waste' | 'count' | 'return';

export interface IngredientDetail extends Ingredient {
  batches: { id: string; qty: number; receivedQty: number; costPerBase: number; receivedAt: string; expiresOn: string | null; purchaseId: string | null; supplierName: string | null }[];
  movements: { id: string; kind: MovementKind; qty: number; at: string; note: string | null; orderCode: string | null; purchaseId: string | null }[];
  usedIn: { itemId: string; variantId: string | null; name: string; qtyPerServing: number }[];
}

export interface StockList {
  items: Ingredient[];
  counts: Record<StockSegment, number>;
}

export interface IngredientInput {
  name: string;
  category: IngredientCategory;
  baseUnit: BaseUnit;
  dozens?: boolean;
  customUnits?: CustomUnit[];
  parLevel?: number | null;
  priceRefKey?: string | null;
  nutritionFoodId?: string | null;
}

export interface StockTakeResult {
  id: string;
  at: string;
  adjusted: number;
  lines: (Counting & { ingredientId: string; name: string; before: number; counted: number; change: number })[];
}

export interface Supplier {
  id: string;
  name: string;
  phone: string | null;
  note: string | null;
  purchaseCount: number;
  lastPurchaseOn: string | null;
}

export type PurchaseSource = 'manual' | 'receipt' | 'voice';

export interface Purchase {
  id: string;
  date: string;
  supplier: { id: string; name: string } | null;
  source: PurchaseSource;
  receiptUrl: string | null;
  total: number;
  lines: { id: string; ingredientId: string; name: string; baseUnit: BaseUnit; dozens: boolean; qty: number; total: number; costPerBase: number; expiresOn: string | null }[];
  createdAt: string;
}

/** A purchase line as entered: in a unit the cook picked (kg, dozen, "crate"). */
export interface PurchaseLineInput {
  ingredientId?: string;
  newIngredient?: { name: string; category: IngredientCategory; baseUnit: BaseUnit };
  qty: number;
  unit: StandardUnit | string;
  total: number;
  expiresOn?: string | null;
}

export interface PurchaseInput {
  date?: string;
  supplierId?: string | null;
  supplierName?: string | null;
  source: PurchaseSource;
  receiptUrl?: string | null;
  lines: PurchaseLineInput[];
}

export interface PriceWatchItem {
  ingredientId: string;
  name: string;
  baseUnit: BaseUnit;
  yourCostPerBase: number;
  cityCostPerBase: number;
  diffPct: number;
  trend: { week: string; costPerBase: number }[];
}

export interface PriceWatch {
  city: string;
  week: string | null;
  items: PriceWatchItem[];
}

// ── Recipes and costs ──
export interface Cost {
  toMake: number;
  sellPrice: number;
  keep: number;
  keepPct: number;
  foodCostPct: number;
  overTarget: boolean;
}

export type RecipeStatus = 'complete' | 'partial' | 'missing';

export interface RecipeRow {
  itemId: string;
  name: string;
  photoUrl: string | null;
  categoryName: string | null;
  status: RecipeStatus;
  variantId: string | null;
  variantName: string | null;
  variantCount: number;
  sellPrice: number;
  cost: Cost | null;
  servingsLeft: number | null;
  signature: boolean;
}

export interface RecipeList {
  targetFoodCostPct: number;
  avgFoodCostPct: number | null;
  counts: { all: number; missing: number; overTarget: number };
  items: RecipeRow[];
}

export interface RecipeLine {
  ingredientId: string;
  name: string;
  baseUnit: BaseUnit;
  dozens: boolean;
  /** Base units for the whole batch (ingredients) or per serving (add-ons, packaging). */
  qty: number;
  costPerBase: number;
  /** Rupees per serving (two decimals). */
  cost: number;
}

export interface Recipe {
  itemId: string;
  itemName: string;
  photoUrl: string | null;
  variantId: string | null;
  variants: { id: string; name: string; price: number; hasRecipe: boolean }[];
  sellPrice: number;
  yield: number;
  lines: RecipeLine[];
  addOns: { optionId: string; optionName: string; groupName: string; lines: RecipeLine[] }[];
  options: { optionId: string; name: string; groupName: string }[];
  packaging: RecipeLine[];
  signature: { on: boolean; creatorName: string | null };
  cost: Cost | null;
  servingsLeft: number | null;
  targetFoodCostPct: number;
  updatedAt: string | null;
}

export interface RecipeInput {
  yield: number;
  lines: { ingredientId: string; qty: number }[];
  addOns: { optionId: string; lines: { ingredientId: string; qty: number }[] }[];
  packaging: { ingredientId: string; qty: number }[];
  signature: { on: boolean; creatorName: string | null };
}

export type PackingPhotoRule = 'off' | 'optional' | 'required';

export interface KitchenSettings {
  targetFoodCostPct: number;
  autoSellOut: boolean;
  packingPhoto: PackingPhotoRule;
}

// ── Hub, insight cards, the board ──
export type InsightSeverity = 'critical' | 'warning' | 'info';

export type InsightActionKind =
  | 'open_stock'
  | 'open_ingredient'
  | 'add_purchase'
  | 'stock_take'
  | 'open_recipe'
  | 'open_recipes'
  | 'open_prep'
  | 'create_surplus'
  | 'apply_portions'
  | 'make_special'
  | 'open_demand'
  | 'open_experiment'
  | 'open_review_insights'
  | 'open_tiffin'
  | 'open_catering';

export interface InsightCard {
  id: string;
  kind: string;
  severity: InsightSeverity;
  title: string;
  why: string;
  action: { kind: InsightActionKind; label: string; params: Record<string, string | number | string[]> };
}

export interface KitchenSummary {
  date: string;
  /** Tiffin and catering at a glance (5B). */
  growth: {
    tiffin: { plans: number; active: number; pending: number; tomorrow: number };
    catering: { new: number; upcoming: number };
    /** This month's orders through the kitchen's own link or QR. */
    storefront: { brought: number };
    /** Searches nearby in the last 30 days that found nothing open. */
    demand: { unmet: number };
    experiments: { running: number; results: number };
    hygiene: HygieneStatus;
    ramadan: { state: RamadanState; enabled: boolean };
  };
  stock: { total: number; low: number; negative: number; expiring: number };
  recipes: { avgFoodCostPct: number | null; targetFoodCostPct: number; missing: number; overTarget: number };
  purchases: { weekTotal: number; weekCount: number };
  forecast: { date: string; dishes: number; orders: number; learning: boolean };
  waste: { weekCost: number; mealsRescued: number };
}

export interface BoardHints {
  lowStock: { itemId: string; name: string; servingsLeft: number }[];
  soldOutByStock: { itemId: string; name: string }[];
  prepHint: { minutes: number; label: string } | null;
  packingPhoto: PackingPhotoRule;
}

// ── Forecast and prep ──
export interface ForecastItem {
  itemId: string;
  name: string;
  photoUrl: string | null;
  expected: number;
  low: number;
  high: number;
  learning: boolean;
  adjusted: number | null;
  fixed: { tiffin: number; catering: number };
  planned: number;
}

export interface Forecast {
  date: string;
  learning: boolean;
  basisDays: number;
  dishes: number;
  orders: { expected: number; low: number; high: number };
  items: ForecastItem[];
}

export interface ForecastAccuracy {
  days: number;
  accuracyPct: number | null;
  learning: boolean;
  note: string;
}

export interface PrepSheet {
  date: string;
  dishes: { itemId: string; name: string; servings: number }[];
  groups: { key: IngredientCategory; title: string; lines: { ingredientId: string; name: string; qty: number; baseUnit: BaseUnit; dozens: boolean; forItems: string[] }[] }[];
  shareText: string;
}

export interface ShoppingList {
  date: string;
  lines: { ingredientId: string; name: string; baseUnit: BaseUnit; dozens: boolean; need: number; onHand: number; toBuy: number; estCost: number }[];
  estTotal: number;
  shareText: string;
}

// ── Waste, donations ──
export type WasteReason = 'expired' | 'spoiled' | 'burnt' | 'dropped' | 'leftover' | 'other';

export interface WasteEntry {
  id: string;
  at: string;
  lines: { ingredientId: string | null; itemId: string | null; name: string; qty: number; baseUnit: BaseUnit | null; cost: number; reason: WasteReason }[];
  cost: number;
  note: string | null;
}

export interface WasteLineInput {
  ingredientId?: string;
  itemId?: string;
  qty: number;
  unit?: StandardUnit | string;
  reason: WasteReason;
}

export interface WasteSummary {
  range: '7d' | '30d';
  from: string;
  to: string;
  cost: number;
  entries: number;
  topReasons: { reason: WasteReason; cost: number }[];
  topItems: { name: string; cost: number }[];
  mealsRescued: { total: number; inRange: number };
}

export interface Donation {
  id: string;
  at: string;
  meals: number;
  to: string;
  note: string | null;
}

export interface Donations {
  items: Donation[];
  mealsRescued: { total: number; week: number };
}

// ── Bachat Box ──
export type BoxStatus = 'live' | 'sold_out' | 'ended' | 'cancelled';
export type ReservationStatus = 'reserved' | 'collected' | 'no_show' | 'cancelled';
export type BoxPaymentMethod = 'pay_at_pickup' | 'transfer';

export interface SurplusBox {
  id: string;
  title: string;
  contentsHint: string;
  photoUrl: string | null;
  value: number;
  price: number;
  quantity: number;
  reserved: number;
  collected: number;
  left: number;
  pickupFrom: string;
  pickupTo: string;
  pickupLabel: string;
  status: BoxStatus;
  createdAt: string;
}

export interface SurplusReservation {
  code: string;
  status: ReservationStatus;
  quantity: number;
  total: number;
  box: { id: string; title: string; photoUrl: string | null; value: number; price: number };
  vendor: { id: string; slug: string; name: string; logoUrl: string | null; phone: string | null; location: { addressLine: string | null; area: string | null; city: string | null; lat: number | null; lng: number | null } };
  pickupFrom: string;
  pickupTo: string;
  pickupLabel: string;
  payment: { method: BoxPaymentMethod; status: FoodPaymentStatus; payBy: string | null; accounts: FoodTransferAccount[] | null; reference: string | null; proofUrl: string | null; rejectedReason: string | null };
  customerName: string | null;
  canCancel: boolean;
  reservedAt: string;
  collectedAt: string | null;
}

export interface SurplusBoxDetail extends SurplusBox {
  reservations: SurplusReservation[];
}

export interface SurplusBoxInput {
  title: string;
  contentsHint: string;
  value: number;
  price: number;
  quantity: number;
  pickupFrom: string;
  pickupTo: string;
  photoUrl?: string | null;
}

export interface SurplusSuggestion extends Omit<SurplusBoxInput, 'photoUrl'> {
  basis: string;
}

/** A Bachat Box as customers see it. */
export interface SurplusCard {
  id: string;
  title: string;
  contentsHint: string;
  photoUrl: string | null;
  value: number;
  price: number;
  left: number;
  status: BoxStatus;
  pickupFrom: string;
  pickupTo: string;
  pickupLabel: string;
  vendor: { id: string; slug: string; name: string; logoUrl: string | null; area: string | null; isHomeKitchen: boolean; distanceKm: number | null };
}

export interface SurplusDetail extends SurplusCard {
  whatToExpect: string;
  pickup: { addressLine: string | null; area: string | null; city: string | null; lat: number | null; lng: number | null; phone: string | null };
  paymentMethods: BoxPaymentMethod[];
  maxPerCustomer: number;
  myReservations: string[];
}

// ── Packing, announcements ──
export interface PackingResult {
  orderId: string;
  packedPhotoUrl: string;
  check: { ok: boolean; note: string } | null;
}

export type VoiceLanguage = 'ur' | 'en' | 'auto';

export interface Announcement {
  orderId: string;
  text: string;
  language: 'ur' | 'en';
  ttsUrl: string | null;
}

export type PauseReason = 'gas' | 'electricity' | 'weather' | 'staff' | 'stock' | 'other';

// ── The assistant ──
export interface AiUsage {
  enabled: boolean;
  limit: number;
  used: number;
  left: number;
  resetsAt: string;
  voice: { limit: number; used: number; left: number; resetsAt: string };
}

export interface ReceiptDraft {
  supplierName: string | null;
  date: string | null;
  imageUrl: string;
  total: number;
  lines: { name: string; qty: number; unit: string; total: number; match: { ingredientId: string; name: string; confidence: number } | null }[];
}

// ── Voice ──
export type VoiceContext = 'board' | 'stock' | 'purchases' | 'today' | 'search' | 'pantry';

export interface VoiceQtyLine {
  ingredientId: string | null;
  key: string | null;
  name: string;
  qty: number;
  unit: StandardUnit;
  total: number | null;
}

export type VoiceAction =
  | { kind: 'order.accept'; orderId: string; code: string; etaMinutes: number | null }
  | { kind: 'order.reject'; orderId: string; code: string; reason: string }
  | { kind: 'order.ready'; orderId: string; code: string }
  | { kind: 'item.unavailable'; itemId: string; name: string }
  | { kind: 'vendor.busy'; extraMinutes: number }
  | { kind: 'purchase.add'; lines: VoiceQtyLine[] }
  | { kind: 'waste.log'; reason: WasteReason; lines: VoiceQtyLine[] }
  | { kind: 'stock.count'; lines: VoiceQtyLine[] }
  | { kind: 'portions.set'; lines: { itemId: string; name: string; portions: number }[] }
  | { kind: 'search'; query: string }
  | { kind: 'pantry.add'; lines: { key: string | null; name: string; qty: number; unit: StandardUnit; expiresOn: string | null }[] };

export interface VoiceResult {
  id: string;
  transcript: string;
  language: 'ur' | 'en';
  confidence: number;
  action: VoiceAction | null;
  alternatives: { transcript: string; action: VoiceAction }[];
  heard: 'audio' | 'text';
}

// ── Growth (5B): tiffin ──
export type Meal = 'breakfast' | 'lunch' | 'dinner';
export type TiffinPeriodKind = 'week' | 'month';
export type TiffinMode = 'delivery' | 'pickup';

/** "HH:mm" in kitchen time, and the words ("12:30 PM – 1:30 PM"). */
export interface TiffinWindow {
  from: string;
  to: string;
  label: string;
}

export interface TiffinPlan {
  id: string;
  vendor: { id: string; slug: string; name: string; logoUrl: string | null; isHomeKitchen: boolean };
  name: string;
  description: string | null;
  meal: Meal;
  /** ISO weekdays (1 Monday … 7 Sunday). */
  days: number[];
  period: TiffinPeriodKind;
  /** Rupees per period. */
  price: number;
  perMeal: number;
  mealsPerPeriod: number;
  mode: TiffinMode;
  window: TiffinWindow;
  capacity: number;
  subscribers: number;
  seatsLeft: number;
  skipCutoffHours: number;
  rotation: { weekday: number; dishes: { itemId: string; name: string; photoUrl: string | null }[]; note: string | null }[];
  photoUrl: string | null;
  isActive: boolean;
  /** The earliest day a new subscription can start. */
  nextStart: string | null;
}

/** A plan on the vendor page. */
export interface TiffinPlanCard {
  id: string;
  name: string;
  meal: Meal;
  days: number[];
  period: TiffinPeriodKind;
  price: number;
  perMeal: number;
  window: string;
  seatsLeft: number;
  photoUrl: string | null;
}

export interface TiffinPlanInput {
  name: string;
  description?: string | null;
  meal: Meal;
  days: number[];
  period: TiffinPeriodKind;
  price: number;
  mode: TiffinMode;
  window: { from: string; to: string };
  capacity: number;
  skipCutoffHours: number;
  rotation: { weekday: number; itemIds: string[]; note: string | null }[];
  photoUrl?: string | null;
  isActive?: boolean;
}

export type TiffinStatus = 'pending' | 'active' | 'paused' | 'declined' | 'ended' | 'cancelled';
export type TiffinPayMethod = 'transfer' | 'cash';

export interface TransferPayment<M extends string = string> {
  method: M;
  status: FoodPaymentStatus;
  payBy: string | null;
  accounts: FoodTransferAccount[] | null;
  reference: string | null;
  proofUrl: string | null;
  rejectedReason: string | null;
}

export interface TiffinPeriod {
  id: string;
  from: string;
  to: string;
  meals: number;
  /** Meals skipped in the period before, taken off this one. */
  credit: number;
  amount: number;
  payment: TransferPayment<TiffinPayMethod>;
}

export interface TiffinSubscription {
  code: string;
  status: TiffinStatus;
  plan: { id: string; name: string; meal: Meal; days: number[]; period: TiffinPeriodKind; price: number; perMeal: number; mode: TiffinMode; window: TiffinWindow; skipCutoffHours: number };
  vendor: { id: string; slug: string; name: string; logoUrl: string | null; phone: string | null };
  /** The kitchen's view only. */
  customer: { name: string; phone: string | null } | null;
  startDate: string;
  endDate: string | null;
  nextDelivery: { date: string; dishes: string[]; cutoffAt: string | null } | null;
  address: { line1: string | null; area: string | null; city: string | null; lat: number | null; lng: number | null } | null;
  paymentMethod: TiffinPayMethod;
  period: TiffinPeriod | null;
  pausedFrom: string | null;
  pausedUntil: string | null;
  declineReason: string | null;
  endReason: string | null;
  canPause: boolean;
  canResume: boolean;
  canCancel: boolean;
  createdAt: string;
}

export interface TiffinInbox {
  counts: { pending: number; active: number; paused: number; toCheck: number };
  items: TiffinSubscription[];
}

export type TiffinDayState = 'before_start' | 'off' | 'pending' | 'upcoming' | 'skipped' | 'paused' | 'ordered' | 'delivered' | 'cancelled' | 'ended' | 'none';

export interface TiffinDay {
  date: string;
  state: TiffinDayState;
  dishes: string[];
  cutoffAt: string | null;
  canSkip: boolean;
  canUnskip: boolean;
  orderCode: string | null;
}

export interface TiffinCalendar {
  month: string;
  days: TiffinDay[];
}

export interface TiffinTomorrow {
  date: string;
  plans: {
    planId: string;
    name: string;
    meal: Meal;
    window: string;
    dishes: string[];
    count: number;
    skipped: number;
    paused: number;
    cutoffAt: string;
    deliveries: { code: string; customerName: string; area: string | null; state: TiffinDayState; orderCode: string | null }[];
  }[];
}

// ── Growth (5B): catering ──
export type EventType = 'mehndi' | 'baraat' | 'walima' | 'birthday' | 'aqiqah' | 'milad' | 'quran_khwani' | 'office' | 'family' | 'other';
export type CateringMode = 'delivery' | 'pickup' | 'on_site';
export type CateringStatus = 'requested' | 'quoted' | 'accepted' | 'confirmed' | 'declined' | 'cancelled' | 'completed';
export type QuoteState = 'current' | 'outdated' | 'expired' | 'accepted';

export interface QuoteLine {
  itemId: string | null;
  name: string;
  qty: number;
  unitPrice: number;
  total: number;
}

export interface CateringQuote {
  version: number;
  lines: QuoteLine[];
  subtotal: number;
  deliveryFee: number;
  total: number;
  advancePct: number;
  advance: number;
  validUntil: string;
  notes: string | null;
  createdAt: string;
  state: QuoteState;
}

export interface CateringRequest {
  code: string;
  status: CateringStatus;
  vendor: { id: string; slug: string; name: string; logoUrl: string | null; phone: string | null };
  customer: { name: string; phone: string | null } | null;
  date: string;
  time: string;
  startsAt: string;
  guests: number;
  eventType: EventType;
  dishes: { itemId: string | null; name: string; qty: number }[];
  budget: number | null;
  mode: CateringMode;
  address: { line1: string | null; area: string | null; city: string | null; lat: number | null; lng: number | null } | null;
  notes: string | null;
  quotes: CateringQuote[];
  acceptedVersion: number | null;
  advance: (Omit<TransferPayment, 'method'> & { amount: number }) | null;
  balance: number | null;
  declineReason: string | null;
  cancelReason: string | null;
  canAccept: boolean;
  canCancel: boolean;
  canQuote: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CateringVendor {
  vendorId: string;
  open: boolean;
  minGuests: number;
  leadDays: number;
  earliestDate: string;
  modes: CateringMode[];
  menu: { itemId: string; name: string; price: number; photoUrl: string | null }[];
}

export interface CateringRequestInput {
  vendorId: string;
  date: string;
  time: string;
  guests: number;
  eventType: EventType;
  dishes: { itemId?: string | null; name?: string; qty: number }[];
  budget?: number | null;
  mode: CateringMode;
  addressId?: string | null;
  notes?: string | null;
}

export interface QuoteInput {
  lines: { itemId?: string | null; name?: string; qty: number; unitPrice: number }[];
  deliveryFee: number;
  advancePct: number;
  validUntil: string;
  notes?: string | null;
}

export interface CateringInbox {
  counts: { new: number; quoted: number; confirmed: number; past: number };
  items: CateringRequest[];
}

export interface CateringCalendar {
  month: string;
  days: { date: string; events: { code: string; time: string; guests: number; eventType: EventType; status: CateringStatus; customerName: string }[] }[];
}

export interface CateringSettings {
  open: boolean;
  minGuests: number;
  leadDays: number;
}

// ── Growth (5B): Ramadan ──
export type RamadanState = 'active' | 'upcoming' | 'none';

/** Kitchen-local "HH:MM" times, and "5:30 PM – 7:00 PM". */
export interface TimeWindow {
  from: string;
  to: string;
  label: string;
}

export interface RamadanEvent {
  name: string;
  startsOn: string;
  endsOn: string;
}

export interface RamadanSettings {
  event: RamadanEvent | null;
  state: RamadanState;
  /** The first day the kitchen can turn it on (30 days before the first fast). */
  opensOn: string | null;
  enabled: boolean;
  sehri: TimeWindow;
  iftar: TimeWindow;
  iftarPreorderOnly: boolean;
}

export interface RamadanInput {
  enabled?: boolean;
  sehri?: { from: string; to: string };
  iftar?: { from: string; to: string };
  iftarPreorderOnly?: boolean;
}

export interface IftarKitchen {
  vendorId: string;
  slug: string;
  name: string;
  logoUrl: string | null;
  coverUrl: string | null;
  distanceKm: number | null;
  iftar: TimeWindow;
  preorderOnly: boolean;
}

export interface IftarNearby {
  state: RamadanState;
  event: RamadanEvent | null;
  items: IftarKitchen[];
}

// ── Growth (5B): storefront ──
export interface Storefront {
  url: string;
  qrUrl: string;
  slug: string;
  name: string;
  shareText: string;
  /** This month's orders by where they came from. */
  stats: { month: string; link: number; qr: number; app: number; tiffin: number };
}

/** The kitchen's link or QR a signed-out visitor came through (kept until checkout). */
export interface StoreSource {
  kind: 'link' | 'qr';
  slug: string;
}

// ── Growth (5B): demand ──
export interface DemandCell {
  geohash: string;
  sw: { lat: number; lng: number };
  ne: { lat: number; lng: number };
  searches: number;
  /** 0–1: the share that found no open kitchen. */
  unmetShare: number;
}

export interface DemandMap {
  city: string | null;
  /** The kitchen, where the map opens. */
  center: { lat: number; lng: number } | null;
  radiusKm: number;
  /** Cells with fewer searches are never sent. */
  minCount: number;
  total: number;
  /** Searches in cells too small to show. */
  hidden: number;
  cells: DemandCell[];
  topUnmet: { query: string; searches: number; unmetShare: number; hour: number }[];
  /** 24 values 0–1 by kitchen-local hour. */
  hourCurve: { area: number[]; own: number[] };
}

// ── Growth (5B): menu insights and experiments ──
export type Quadrant = 'star' | 'plowhorse' | 'puzzle' | 'dog' | 'unknown';
export type SuggestionKind = 'keep' | 'price' | 'photo' | 'drop' | 'recipe';

export interface MenuInsightItem {
  itemId: string;
  name: string;
  photoUrl: string | null;
  price: number;
  hasSizes: boolean;
  sold: number;
  /** Rupees kept per serving; null without a recipe card. */
  keep: number | null;
  keepPct: number | null;
  /** 0–1 against the menu's best. */
  popularity: number;
  profit: number | null;
  quadrant: Quadrant;
  suggestion: { kind: SuggestionKind; text: string; price: number | null };
  experimentRunning: boolean;
}

export interface MenuInsights {
  range: string;
  medians: { sold: number; keep: number };
  items: MenuInsightItem[];
}

export type ExperimentStatus = 'running' | 'done' | 'kept' | 'adjusted' | 'dropped' | 'stopped';
export type ExperimentVerdict = 'keep' | 'adjust' | 'drop';
export type ExperimentChange = { kind: 'price'; price: number; oldPrice: number } | { kind: 'photo'; photoUrl: string; oldPhotoUrl: string | null };

export interface Experiment {
  id: string;
  itemId: string;
  itemName: string;
  change: ExperimentChange;
  days: number;
  startedAt: string;
  endsAt: string;
  status: ExperimentStatus;
  progress: { daysIn: number; days: number };
  result: { verdict: ExperimentVerdict | null; before: { perDay: number; salesPerDay: number }; during: { perDay: number; salesPerDay: number } } | null;
  decidedAt: string | null;
}

export interface ExperimentInput {
  itemId: string;
  change: { kind: 'price'; price: number } | { kind: 'photo'; photoUrl: string };
  days: number;
}

// ── Growth (5B): story, hygiene, batching ──
export interface KitchenStory {
  text: string;
  cookName: string;
  photoUrls: string[];
  videoUrl: string | null;
  updatedAt: string | null;
}

export type HygieneStatus = 'none' | 'self_declared' | 'pending' | 'verified' | 'rejected';

export interface HygieneItem {
  key: string;
  label: string;
  done: boolean;
  evidenceUrl: string | null;
}

export interface Hygiene {
  status: HygieneStatus;
  /** Staff's note on a rejection. */
  note: string | null;
  items: HygieneItem[];
  requestedAt: string | null;
  reviewedAt: string | null;
  canRequest: boolean;
}

export interface BatchSuggestion {
  orderId: string;
  code: string;
  extraKm: number;
  sameDirection: boolean;
  readyAt: string | null;
}

/** A vendor card's badges (docs/API_KITCHEN_ASSUMED.md §3.13). */
export type VendorBadge = 'signature' | 'hygiene_verified' | 'hygiene_self_declared' | 'home_kitchen' | 'bachat_today' | 'under_600' | 'high_protein';
