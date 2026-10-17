// ═══════════════════════════════════════════════════════
// MetroMatrix — Dummy Food database rows
// ═══════════════════════════════════════════════════════
// One brand and one branch per food business (the API's design), its
// riders, and the cuisine list. Stored as rows, sent through foodWire in the
// API's shapes. TODO(API_FOOD): mirrors the API's committed vendor and rider
// routes; reconcile with docs/API_FOOD.md when it is published.

export type MockKitchenKind = 'restaurant' | 'home_kitchen' | 'cloud_kitchen';
export type MockBranchStatus = 'draft' | 'active' | 'suspended';
export type MockRiderStatus = 'active' | 'inactive' | 'on_leave' | 'plan_locked';
export type MockRiderVehicle = 'bike' | 'bicycle' | 'car' | 'on_foot';

export interface MockCuisine {
  id: string;
  slug: string;
  name: string;
  icon: string;
  sort: number;
  isActive: boolean;
}

export interface MockHoursRow {
  weekday: number;
  opensAt: string;
  closesAt: string;
}

export interface MockFeeBand {
  fromKm: number;
  toKm: number;
  fee: number;
  minOrder: number;
}

export interface MockClosure {
  id: string;
  startsAt: string;
  endsAt: string;
  reason: string | null;
}

export interface MockVendorAccount {
  id: string;
  kind: 'raast' | 'jazzcash' | 'easypaisa' | 'bank';
  accountTitle: string;
  accountNumber: string;
  bankName: string | null;
  isActive: boolean;
  createdAt: string;
}

/** A food business's brand + its one branch. */
export interface MockFoodVendor {
  businessId: string;
  ownerId: string;
  kind: MockKitchenKind;
  // ── brand ──
  brandId: string;
  name: string;
  slug: string;
  tagline: string | null;
  logoUrl: string | null;
  coverUrl: string | null;
  brandColor: string;
  onBrandColor: string;
  cuisineIds: string[];
  priceLevel: number;
  ratingAvg: number;
  ratingCount: number;
  // ── branch ──
  branchId: string;
  status: MockBranchStatus;
  wentLiveAt: string | null;
  foodSafetyCheckedAt: string | null;
  isPaused: boolean;
  pauseMessage: string | null;
  busyUntil: string | null;
  busyExtraMinutes: number;
  acceptsDelivery: boolean;
  acceptsPickup: boolean;
  acceptsCod: boolean;
  codLimit: number;
  transferConfirmBeforePrep: boolean;
  autoRejectMinutes: number;
  prepMinutes: number;
  maxRadiusKm: number;
  freeDeliveryOver: number | null;
  preorderOnly: boolean;
  addressLine: string | null;
  area: string | null;
  city: string | null;
  lat: number | null;
  lng: number | null;
  phone: string | null;
  timezone: string;
  hours: MockHoursRow[];
  feeBands: MockFeeBand[];
  closures: MockClosure[];
  accounts: MockVendorAccount[];
  planStartedAt: string;
}

export interface MockRider {
  id: string;
  userId: string;
  businessId: string;
  fullName: string;
  phone: string | null;
  vehicle: MockRiderVehicle;
  status: MockRiderStatus;
  onDuty: boolean;
  activeOrderCount: number;
  lastGeo: { lat: number; lng: number } | null;
  locationUpdatedAt: string | null;
  createdAt: string;
}

export type MockItemTag = 'spicy' | 'veg' | 'bestseller' | 'new' | 'contains_nuts';

export interface MockMenuCategory {
  id: string;
  businessId: string;
  name: string;
  sort: number;
  availableFrom: string | null;
  availableTo: string | null;
  isActive: boolean;
}

/** The branch's own switches for a dish (the API's branch_item_overrides). */
export interface MockItemOverride {
  isAvailable: boolean;
  unavailableUntil: string | null;
  dailyLimit: number | null;
  remainingToday: number | null;
  /** The kitchen-local date `remainingToday` belongs to (reset to the limit each new day). */
  portionsDate: string | null;
}

export interface MockMenuItem {
  id: string;
  businessId: string;
  categoryId: string;
  name: string;
  description: string | null;
  photoUrl: string | null;
  basePrice: number;
  tags: MockItemTag[];
  isDeal: boolean;
  serves: number | null;
  days: number[];
  isActive: boolean;
  sort: number;
  sold30d: number;
  variants: { id: string; name: string; price: number; sort: number }[];
  links: { groupId: string; variantId: string | null; sort: number }[];
  override: MockItemOverride | null;
}

export interface MockMenuOption {
  id: string;
  name: string;
  priceDelta: number;
  isDefault: boolean;
  isActive: boolean;
  sort: number;
  /** The branch's switch (the API's branch_option_overrides). */
  available: boolean;
}

export interface MockOptionGroup {
  id: string;
  businessId: string;
  name: string;
  minSelect: number;
  maxSelect: number;
  options: MockMenuOption[];
}

export interface MockPreorderSlot {
  id: string;
  businessId: string;
  weekday: number;
  slotStart: string;
  cutoffMinutesBefore: number;
  maxOrders: number;
}

export interface MockCartLine {
  id: string;
  itemId: string;
  variantId: string | null;
  optionIds: string[];
  quantity: number;
  notes: string | null;
  /** The price the customer saw when adding it (a change is a warning). */
  unitPriceSeen: number;
  createdAt: string;
}

/** One bag per customer, from one vendor. */
export interface MockFoodCart {
  userId: string;
  businessId: string;
  fulfilment: 'delivery' | 'pickup';
  scheduledFor: string | null;
  lines: MockCartLine[];
}

export interface MockPromotion {
  id: string;
  businessId: string;
  title: string;
  kind: 'percent_off_order' | 'percent_off_items' | 'flat_off' | 'free_delivery';
  value: number;
  itemIds: string[];
  minOrder: number;
  maxDiscount: number | null;
  code: string | null;
  startsAt: string;
  endsAt: string | null;
  weekdays: number[];
  timeFrom: string | null;
  timeTo: string | null;
  usageLimit: number | null;
  perUserLimit: number | null;
  usedCount: number;
  firstOrderOnly: boolean;
  isActive: boolean;
}

export interface MockFoodOrderEvent {
  kind: string;
  from: string | null;
  to: string | null;
  actorRole: string;
  note: string | null;
  at: string;
}

export interface MockFoodOrder {
  id: string;
  code: string;
  userId: string;
  businessId: string;
  fulfilment: 'delivery' | 'pickup';
  scheduledFor: string | null;
  /** The pre-order slot it holds a place in. */
  slotId: string | null;
  /** The kitchen day its portions were taken from (they go back on a cancel that day). */
  portionDate: string | null;
  status: 'placed' | 'accepted' | 'preparing' | 'ready' | 'on_the_way' | 'delivered' | 'picked_up' | 'rejected' | 'auto_rejected' | 'cancelled';
  paymentMethod: 'cod' | 'transfer' | 'pay_at_pickup';
  paymentStatus: 'cod_pending' | 'unpaid' | 'awaiting_transfer' | 'proof_submitted' | 'paid' | 'void' | 'refund_due' | 'refunded';
  payBy: string | null;
  accounts: { kind: string; accountTitle: string; accountNumber: string; bankName: string | null }[] | null;
  paymentRef: string | null;
  paymentProofUrl: string | null;
  paymentRejectedReason: string | null;
  address: Record<string, unknown> | null;
  distanceKm: number | null;
  items: { id: string; itemId: string; name: string; variantId: string | null; variant: string | null; options: { id: string; name: string; group: string; priceDelta: number }[]; quantity: number; unitPrice: number; lineTotal: number; notes: string | null; portions: number }[];
  subtotal: number;
  discount: number;
  deliveryFee: number;
  total: number;
  promotion: { id: string; title: string; kind: string; code: string | null } | null;
  cutlery: boolean;
  note: string | null;
  etaMinutes: number | null;
  promisedAt: string | null;
  acceptBy: string | null;
  riderId: string | null;
  riderStep: string | null;
  handedToExternal: boolean;
  codCollected: number | null;
  cancelledBy: string | null;
  cancelReason: string | null;
  placedAt: string;
  acceptedAt: string | null;
  preparingAt: string | null;
  readyAt: string | null;
  pickedUpAt: string | null;
  deliveredAt: string | null;
  cancelledAt: string | null;
  events: MockFoodOrderEvent[];
  updatedAt: string;
}

export interface MockFood {
  cuisines: MockCuisine[];
  vendors: MockFoodVendor[];
  riders: MockRider[];
  categories: MockMenuCategory[];
  items: MockMenuItem[];
  groups: MockOptionGroup[];
  slots: MockPreorderSlot[];
  carts: MockFoodCart[];
  orders: MockFoodOrder[];
  promotions: MockPromotion[];
  favourites: { userId: string; businessId: string; savedAt: string }[];
  /** Checkout's Idempotency-Key → the order it placed. */
  idempotency: Record<string, string>;
  /** Ids for new rows. */
  seq: number;
}
