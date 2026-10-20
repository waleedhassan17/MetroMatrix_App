// ═══════════════════════════════════════════════════════
// MetroMatrix — Food Court types (customers, vendors, riders)
// ═══════════════════════════════════════════════════════

import type { SubType } from './auth';
import type { HygieneStatus, KitchenStory, PauseReason, StoreSource, TiffinPlanCard, VendorBadge } from './kitchen';

export type KitchenKind = Extract<SubType, 'restaurant' | 'home_kitchen' | 'cloud_kitchen'>;

// ═══════════════════════════════════════════════════════
// Food Court vendors and riders (MetroMatrix-API, Food chunk)
// The app's words for MetroMatrix-API docs/API_FOOD.md (reconciled at
// chunk4/p8; the parity tests replay the released API's responses).
// ═══════════════════════════════════════════════════════

/** A cuisine from the API's reference list (`GET /food/cuisines`). */
export interface FoodCuisine {
  id: string;
  name: string;
  slug: string;
  /** The API's icon key (`burger`, `biryani` …); the UI maps it to a glyph. */
  icon: string;
}

/** What every food vendor's session says about it (`business.food`). */
export interface FoodVendorSession {
  brandId: string;
  brandSlug: string;
  branchStatus: string;
  isLive: boolean;
  setupComplete: boolean;
}

export type VendorSetupKey = 'profile' | 'location' | 'hours' | 'zones' | 'payment' | 'food_safety' | (string & {});

export interface VendorSetupItem {
  key: VendorSetupKey;
  label: string;
  required: boolean;
  done: boolean;
}

/** The go-live checklist (`GET /food/vendor/setup`). */
export interface VendorSetup {
  kind: KitchenKind;
  items: VendorSetupItem[];
  percent: number;
  missing: VendorSetupKey[];
  ready: boolean;
  isLive: boolean;
}

export interface OpenState {
  open: boolean;
  paused: boolean;
  /** UTC ISO; null when closed. */
  closesAt: string | null;
  opensAt: string | null;
  /** "Open until 2:00 AM", "Opens 6:00 PM", "Closed", or the pause message. */
  label: string;
}

export interface VendorBusy {
  extraMinutes: number;
  until: string | null;
  label: string;
}

export interface VendorBranch {
  id: string;
  /** `draft` until it goes live; `active` once live. */
  status: string;
  isLive: boolean;
  wentLiveAt: string | null;
  foodSafetyCheckedAt: string | null;
  isPaused: boolean;
  pauseMessage: string | null;
  /** Why the kitchen paused (only the kitchen sees it) and when the pause lifts by itself. TODO(API_KITCHEN): an addition. */
  pauseReason: PauseReason | null;
  resumeAt: string | null;
  busy: VendorBusy | null;
  openState: OpenState;
}

/** The brand as the vendor edits it (`GET/PATCH /food/vendor/profile`). */
export interface VendorProfile {
  id: string;
  businessId: string;
  kind: KitchenKind;
  name: string;
  slug: string;
  tagline: string | null;
  logoUrl: string | null;
  coverUrl: string | null;
  brandColor: string;
  onBrandColor: string;
  cuisines: FoodCuisine[];
  /** 1–3 ("Rs", "Rs Rs", "Rs Rs Rs"). */
  priceLevel: number;
  isHomeKitchen: boolean;
  ratingAvg: number;
  ratingCount: number;
  branch: VendorBranch;
}

export interface VendorProfileInput {
  name?: string;
  tagline?: string | null;
  logoUrl?: string | null;
  coverUrl?: string | null;
  cuisineIds?: string[];
  priceLevel?: number;
  brandColor?: string;
}

export interface VendorLocation {
  addressLine: string;
  area: string | null;
  city: string;
  lat: number | null;
  lng: number | null;
  phone: string | null;
  timezone: string;
}

/** How the branch works (`GET/PATCH /food/vendor/settings`). */
export interface VendorSettings {
  acceptsDelivery: boolean;
  acceptsPickup: boolean;
  acceptsCod: boolean;
  /** Rupees: cash orders above this need another payment method. */
  codLimit: number;
  /** A transfer must be confirmed before the kitchen starts. */
  transferConfirmBeforePrep: boolean;
  /** An unanswered order is rejected after this many minutes (3–10). */
  autoRejectMinutes: number;
  prepMinutes: number;
  maxRadiusKm: number;
  freeDeliveryOver: number | null;
  /** Home kitchens: take only pre-orders. */
  preorderOnly: boolean;
  location: VendorLocation;
}

export type VendorSettingsInput = Partial<Omit<VendorSettings, 'location'>> &
  Partial<Pick<VendorLocation, 'addressLine' | 'area' | 'city' | 'lat' | 'lng' | 'phone'>>;

/** One opening range; `weekday` 0 = Sunday. A `closesAt` before `opensAt` runs past midnight. */
export interface HoursRange {
  weekday: number;
  opensAt: string;
  closesAt: string;
  overnight: boolean;
}

/** A delivery band by distance: from 0 km, back to back, at most 6. */
export interface FeeBand {
  fromKm: number;
  toKm: number;
  fee: number;
  minOrder: number;
}

export interface VendorClosure {
  id: string;
  startsAt: string;
  endsAt: string;
  reason: string | null;
}

export type PlanLimitKey = 'brands' | 'branches' | 'riders' | 'menu_items' | 'promotions_active' | (string & {});
export type PlanEntitlementKey = 'riders' | 'promotions' | 'insights' | 'preorders' | (string & {});

/** Staff changes on top of the plan (limits and entitlements only). */
export interface PlanOverrides {
  limits?: Partial<Record<PlanLimitKey, number>>;
  entitlements?: Partial<Record<PlanEntitlementKey, boolean>>;
}

/** The vendor's plan: always the free Community plan, with what it allows and what is used. */
export interface VendorPlan {
  key: string;
  label: string;
  /** 0: the Community plan is free. */
  price: number;
  limits: Record<PlanLimitKey, number>;
  usage: Record<PlanLimitKey, number>;
  /** What the plan includes (every one is on in Community). */
  entitlements: Record<PlanEntitlementKey, boolean>;
  overrides: PlanOverrides;
  startedAt: string | null;
}

export type RiderStatus = 'active' | 'inactive' | 'on_leave' | 'plan_locked' | (string & {});

export interface FoodRider {
  id: string;
  fullName: string;
  phone: string | null;
  vehicle: string | null;
  status: RiderStatus;
  onDuty: boolean;
  username: string | null;
  activeOrderCount: number;
  lastPosition: { lat: number; lng: number } | null;
  locationUpdatedAt: string | null;
  /** The phone reported in the last 2 minutes (kept apart from being on duty). */
  locationLive: boolean;
  createdAt: string;
}

/** Shown once, when a rider is added or their password is reset. */
export interface RiderCredential {
  username: string;
  password: string;
}

export interface RiderInput {
  fullName: string;
  phone: string | null;
  vehicle: string | null;
}

/** `GET /food/rider/me`: the rider and the vendor they deliver for. */
export interface RiderHome {
  rider: FoodRider;
  vendor: {
    id: string;
    name: string;
    logoUrl: string | null;
    phone: string | null;
    addressLine: string | null;
    area: string | null;
    city: string | null;
  };
}

// ─── Riders on orders ──────────────────────────────────
/** A delivery as the rider sees it: where to collect, where to drop, what to collect. */
export interface RiderOrder {
  id: string;
  code: string;
  status: FoodOrderStatus;
  statusLabel: string;
  riderStep: RiderStep | null;
  /** The steps the rider can take now (the server's). */
  nextSteps: RiderStep[];
  pickup: { name: string; phone: string | null; addressLine: string | null; area: string | null; city: string | null; lat: number | null; lng: number | null };
  drop: {
    name: string | null;
    phone: string | null;
    line1: string | null;
    area: string | null;
    city: string | null;
    landmark: string | null;
    building: string | null;
    floor: string | null;
    riderInstructions: string | null;
    lat: number | null;
    lng: number | null;
  } | null;
  items: { name: string; variant: string | null; options: string[]; quantity: number }[];
  itemCount: number;
  cutlery: boolean;
  note: string | null;
  payment: { method: FoodPaymentMethod; status: FoodPaymentStatus };
  total: number;
  /** Cash to take at the door (0 when it's paid already). */
  cashToCollect: number;
  codCollected: number | null;
  readyAt: string | null;
  promisedAt: string | null;
  /** On a run of two or more of the kitchen's orders (§5; TODO(API_KITCHEN)). */
  dropOrder: { position: number; of: number } | null;
}

/** Cash a rider holds for their vendor, and its entries (newest first). */
export interface RiderCash {
  riderId: string;
  balance: number;
  entries: { id: string; kind: 'cod_collected' | 'handover'; amount: number; orderCode: string | null; note: string | null; at: string }[];
}

/** A rider on the vendor's live list. */
export interface LiveRider {
  id: string;
  fullName: string;
  phone: string | null;
  vehicle: string | null;
  onDuty: boolean;
  locationLive: boolean;
  location: { lat: number; lng: number; at: string | null } | null;
  lastSeenAt: string | null;
  activeOrders: { id: string; code: string; status: FoodOrderStatus; riderStep: RiderStep | null }[];
}

/** Who to give an order to: fewest deliveries, then nearest. */
export interface RiderSuggestion {
  riderId: string;
  fullName: string;
  vehicle: string | null;
  phone: string | null;
  activeOrders: number;
  locationLive: boolean;
  distanceKm: number | null;
}

// ─── The vendor's menu (GET/POST /food/vendor/menu/…) ─────────────────────
export type ItemTag = 'spicy' | 'veg' | 'bestseller' | 'new' | 'contains_nuts';

export interface MenuCategory {
  id: string;
  name: string;
  sort: number;
  /** A daily window ("18:00"–"23:30", local), or both null for all day. */
  availableFrom: string | null;
  availableTo: string | null;
  isActive: boolean;
  itemCount: number;
}

export interface ItemVariant {
  id: string;
  name: string;
  price: number;
}

/** An add-on group on a dish, in display order; `variantId` limits it to one size. */
export interface ItemGroupLink {
  groupId: string;
  variantId: string | null;
  sort: number;
}

export interface VendorMenuItem {
  id: string;
  categoryId: string;
  name: string;
  description: string | null;
  photoUrl: string | null;
  /** Rupees. With sizes, each size has its own price. */
  basePrice: number;
  tags: ItemTag[];
  isDeal: boolean;
  serves: number | null;
  /** Weekdays it is on the menu (0 = Sunday). */
  days: number[];
  isActive: boolean;
  sort: number;
  sold30d: number;
  variants: ItemVariant[];
  optionGroups: ItemGroupLink[];
}

export interface MenuOption {
  id: string;
  name: string;
  priceDelta: number;
  isDefault: boolean;
  isActive: boolean;
}

/** A reusable add-on group (the library): required when minSelect ≥ 1. */
export interface OptionGroup {
  id: string;
  name: string;
  minSelect: number;
  maxSelect: number;
  required: boolean;
  usedByItems: number;
  options: MenuOption[];
}

export interface MenuItemInput {
  categoryId: string;
  name: string;
  description: string | null;
  photoUrl: string | null;
  basePrice: number;
  tags: ItemTag[];
  isDeal: boolean;
  serves: number | null;
  days: number[];
  isActive: boolean;
}

export interface OptionGroupInput {
  name: string;
  minSelect: number;
  maxSelect: number;
  options: { id?: string; name: string; priceDelta: number; isDefault: boolean; isActive: boolean }[];
}

export interface AvailabilityItem {
  itemId: string;
  name: string;
  category: string;
  isAvailable: boolean;
  /** Off until this time, then back on its own. */
  unavailableUntil: string | null;
  dailyLimit: number | null;
  remainingToday: number | null;
}

export interface AvailabilityOption {
  optionId: string;
  name: string;
  group: string;
  isAvailable: boolean;
}

export interface MenuAvailability {
  items: AvailabilityItem[];
  options: AvailabilityOption[];
}

/** A home kitchen's day: which dishes are cooking and how many portions are left. */
export interface TodayItem {
  itemId: string;
  name: string;
  onTodaysMenu: boolean;
  cooking: boolean;
  dailyLimit: number | null;
  remainingToday: number | null;
  sold: number | null;
}

export interface TodayMenu {
  date: string;
  weekday: number;
  items: TodayItem[];
}

export interface PreorderSlot {
  id: string;
  weekday: number;
  slotStart: string;
  cutoffMinutesBefore: number;
  maxOrders: number;
}

export interface WeeklyMenuEntry {
  itemId: string;
  name: string;
  days: number[];
}

// ─── Discovery: what a customer can order from where they are ─────────────
/** Where the customer wants food: a saved address, or where they are. */
export interface FoodPoint {
  lat: number;
  lng: number;
  /** "Home · Gulberg III", "Current location". */
  label: string;
  addressId: string | null;
}

export interface EtaRange {
  min: number;
  max: number;
  /** "27–37 min". */
  label: string;
}

/** A vendor as cards show it, with the quote for the customer's point. */
export interface VendorCard {
  id: string;
  slug: string;
  name: string;
  tagline: string | null;
  logoUrl: string | null;
  coverUrl: string | null;
  brandColor: string;
  onBrandColor: string;
  cuisines: { name: string; slug: string }[];
  priceLevel: number;
  ratingAvg: number;
  ratingCount: number;
  isHomeKitchen: boolean;
  isFeatured: boolean;
  isNew: boolean;
  distanceKm: number | null;
  eta: EtaRange;
  /** Rupees; 0 is free delivery. */
  deliveryFee: number;
  minOrder: number;
  freeDeliveryOver: number | null;
  /** The best live deal, e.g. "20% off". */
  dealLabel: string | null;
  fulfilment: { delivery: boolean; pickup: boolean };
  preorderOnly: boolean;
  openState: { open: boolean; paused: boolean; label: string; opensAt: string | null };
  /** Kitchen Intelligence's addition (§5; TODO(API_KITCHEN)). */
  badges: VendorBadge[];
}

export interface FoodHome {
  coverage: { delivering: boolean; message: string | null; pickupNearby: number };
  cuisines: FoodCuisine[];
  /** Staff banners live now whose target still exists. */
  banners: FoodHomeBanner[];
  orderAgain: VendorCard[];
  offers: VendorCard[];
  homeKitchens: VendorCard[];
  topRated: VendorCard[];
  fastest: VendorCard[];
  newOnFoodCourt: VendorCard[];
  freeDelivery: VendorCard[];
}

export type VendorSort = 'recommended' | 'distance' | 'rating' | 'delivery_time' | 'delivery_fee';

export interface VendorListQuery {
  lat: number;
  lng: number;
  q?: string;
  cuisine?: string;
  sort?: VendorSort;
  freeDelivery?: boolean;
  offers?: boolean;
  minRating?: number;
  pickup?: boolean;
  homeKitchen?: boolean;
  openNow?: boolean;
  priceLevel?: number;
}

/** Why a dish can't be ordered right now (null: it can). */
export type DishUnavailableReason = 'outside_hours' | 'sold_out' | 'unavailable' | 'not_today' | 'not_on_menu' | string;

/** A dish in a vendor's menu, as customers see it. */
export interface DishCard {
  id: string;
  name: string;
  description: string | null;
  photoUrl: string | null;
  fromPrice: number;
  hasVariants: boolean;
  hasOptions: boolean;
  tags: ItemTag[];
  isDeal: boolean;
  serves: number | null;
  available: boolean;
  unavailableReason: DishUnavailableReason | null;
  soldOut: boolean;
  remainingToday: number | null;
  /** "6 left today" when few remain. */
  remainingLabel: string | null;
  sold30d: number;
}

export interface MenuSection {
  id: string;
  name: string;
  availableFrom: string | null;
  availableTo: string | null;
  /** Inside its daily window right now. */
  availableNow: boolean;
  items: DishCard[];
}

export interface FoodDeal {
  id: string;
  title: string;
  label: string;
  freeDelivery: boolean;
}

/** A vendor's own page. */
export interface VendorPage extends VendorCard {
  paused: boolean;
  pauseMessage: string | null;
  location: { addressLine: string | null; area: string | null; city: string | null; lat: number | null; lng: number | null; phone: string | null };
  /** For the customer's point; null when none was sent. */
  delivery: { available: boolean; outOfZone: boolean; fee: number; minOrder: number; eta: EtaRange } | null;
  pickup: { readyIn: EtaRange } | null;
  acceptsCod: boolean;
  deals: FoodDeal[];
  /** null until the vendor has a rating. */
  ratingSummary: FoodRatingSummary | null;
  menu: MenuSection[];
  popular: DishCard[];
  /** Kitchen Intelligence's additions (docs/API_KITCHEN_ASSUMED.md §5; TODO(API_KITCHEN)). */
  tiffinPlans: TiffinPlanCard[];
  catering: { open: boolean; minGuests: number; leadDays: number } | null;
  story: Omit<KitchenStory, 'updatedAt'> | null;
  hygiene: { status: HygieneStatus; checkedAt: string | null };
  signatureItemIds: string[];
  /** While the kitchen keeps Ramadan hours. */
  ramadan: { sehri: { from: string; to: string }; iftar: { from: string; to: string }; iftarPreorderOnly: boolean } | null;
}

export interface SheetOption {
  id: string;
  name: string;
  priceDelta: number;
  isDefault: boolean;
  available: boolean;
}

export interface SheetGroup {
  id: string;
  name: string;
  minSelect: number;
  maxSelect: number;
  required: boolean;
  /** Only for this size; null for every size. */
  variantId: string | null;
  options: SheetOption[];
}

/** The dish sheet: sizes, and the add-on groups each size offers. */
export interface ItemSheet {
  id: string;
  name: string;
  description: string | null;
  photoUrl: string | null;
  tags: ItemTag[];
  isDeal: boolean;
  serves: number | null;
  basePrice: number;
  fromPrice: number;
  category: { id: string; name: string };
  available: boolean;
  unavailableReason: DishUnavailableReason | null;
  remainingToday: number | null;
  variants: { id: string; name: string; price: number; groupIds: string[] }[];
  groups: SheetGroup[];
}

export interface DishHit {
  id: string;
  name: string;
  photoUrl: string | null;
  fromPrice: number;
  tags: ItemTag[];
}

export interface FoodSearchResult {
  vendors: VendorCard[];
  dishes: { vendor: VendorCard; items: DishHit[] }[];
}

// ─── Ordering: the bag, checkout, orders (customer and vendor) ─────────────
export type FoodFulfilment = 'delivery' | 'pickup';
/** Customers always pay the vendor directly. */
/** `tiffin_plan`: a tiffin day, paid with its period (Kitchen Intelligence; TODO(API_KITCHEN)). */
export type FoodPaymentMethod = 'cod' | 'transfer' | 'pay_at_pickup' | 'tiffin_plan';
export type FoodOrderStatus = 'placed' | 'accepted' | 'preparing' | 'ready' | 'on_the_way' | 'delivered' | 'picked_up' | 'rejected' | 'auto_rejected' | 'cancelled';
export type FoodPaymentStatus = 'cod_pending' | 'unpaid' | 'awaiting_transfer' | 'proof_submitted' | 'paid' | 'void' | 'refund_due' | 'refunded';
/** Where an assigned rider is with an order. */
export type RiderStep = 'assigned' | 'accepted_by_rider' | 'arrived_at_branch' | 'picked_up' | 'arrived_at_customer' | 'delivered' | 'declined' | string;

/** Something to fix before checkout (the API's own words). */
export interface FoodIssue {
  code: string;
  message: string;
  details: Record<string, unknown> | null;
}

export interface FoodCartVendor {
  id: string;
  name: string;
  slug: string;
  logoUrl: string | null;
  openState: { open: boolean; paused: boolean; label: string };
  acceptsDelivery: boolean;
  acceptsPickup: boolean;
  preorderOnly: boolean;
}

export interface FoodCartLine {
  id: string;
  itemId: string;
  name: string;
  photoUrl: string | null;
  variant: { id: string; name: string } | null;
  options: { id: string; name: string; group: string; priceDelta: number }[];
  quantity: number;
  unitPrice: number;
  lineTotal: number;
  notes: string | null;
  priceChanged: boolean;
  error: FoodIssue | null;
}

/** A bag scheduled for later: the time, how it reads, and the pre-order slot it takes. */
export interface FoodScheduled {
  at: string;
  label: string;
  slotId: string | null;
}

export interface FoodCart {
  empty: boolean;
  vendor: FoodCartVendor | null;
  fulfilment: FoodFulfilment | null;
  scheduledFor: FoodScheduled | null;
  lines: FoodCartLine[];
  itemCount: number;
  subtotal: number;
  warnings: FoodIssue[];
  issues: FoodIssue[];
}

/** A vendor's pre-order slots over the next week (home kitchens). */
export interface FoodSlots {
  timezone: string;
  preorderOnly: boolean;
  usesSlots: boolean;
  slots: { slotId: string; startsAt: string; cutoffAt: string; label: string; maxOrders: number; remaining: number; full: boolean }[];
}

export interface FoodTotals {
  subtotal: number;
  discount: number;
  deliveryFee: number;
  total: number;
}

/** A vendor's account a transfer goes to. */
export interface FoodTransferAccount {
  kind: string;
  title: string;
  number: string;
  bankName: string | null;
}

/** Totals exactly as checkout would charge them, with every issue. */
export interface FoodPreview {
  ok: boolean;
  issues: FoodIssue[];
  warnings: FoodIssue[];
  vendor: FoodCartVendor | null;
  fulfilment: FoodFulfilment;
  scheduledFor: FoodScheduled | null;
  lines: FoodCartLine[];
  totals: FoodTotals;
  deal: { id: string; title: string; kind: string; code: string | null; discount: number } | null;
  minOrder: number;
  shortfall: number;
  freeDeliveryOver: number | null;
  distanceKm: number | null;
  /** As soon as possible only; a scheduled bag has its time instead. */
  eta: EtaRange | null;
  payment: {
    method: FoodPaymentMethod | null;
    available: Record<FoodPaymentMethod, boolean>;
    codLimit: number;
    accounts: FoodTransferAccount[];
  };
}

export interface FoodCheckoutInput {
  addressId: string | null;
  paymentMethod: FoodPaymentMethod;
  promoCode: string | null;
  cutlery: boolean;
  note: string | null;
  building: string | null;
  floor: string | null;
  riderInstructions: string | null;
  /** The kitchen's own link or QR the order came through (§5; TODO(API_KITCHEN)). */
  source?: StoreSource | null;
}

export interface FoodOrderSummary {
  id: string;
  code: string;
  status: FoodOrderStatus;
  statusLabel: string;
  fulfilment: FoodFulfilment;
  vendor: { id: string; name: string; slug: string; logoUrl: string | null };
  itemCount: number;
  total: number;
  placedAt: string;
  scheduledFor: string | null;
}

export interface FoodOrderRider {
  name: string;
  phone: string | null;
  vehicle: string | null;
  step: RiderStep;
  locationLive: boolean;
  lastPosition: { lat: number; lng: number } | null;
  at: string | null;
}

export interface FoodOrderEvent {
  kind: string;
  from: string | null;
  to: string | null;
  actorRole: string | null;
  note: string | null;
  at: string;
}

export interface FoodOrder {
  id: string;
  code: string;
  status: FoodOrderStatus;
  statusLabel: string;
  fulfilment: FoodFulfilment;
  scheduledFor: string | null;
  placedAt: string;
  /** The vendor must answer by then, or the order is declined for them. */
  acceptBy: string | null;
  vendor: {
    id: string;
    name: string;
    slug: string;
    logoUrl: string | null;
    phone: string | null;
    location: { addressLine: string | null; area: string | null; city: string | null; lat: number | null; lng: number | null };
  };
  items: { id: string; itemId: string; name: string; variant: string | null; options: { name: string; group: string; priceDelta: number }[]; quantity: number; unitPrice: number; lineTotal: number; notes: string | null }[];
  totals: FoodTotals;
  deal: { id: string; code: string | null; kind: string; title: string } | null;
  payment: {
    method: FoodPaymentMethod;
    status: FoodPaymentStatus;
    payBy: string | null;
    accounts: FoodTransferAccount[] | null;
    reference: string | null;
    proofUrl: string | null;
    rejectedReason: string | null;
    instructions: string | null;
  };
  address: {
    label: string | null;
    fullName: string | null;
    phone: string | null;
    line1: string | null;
    area: string | null;
    city: string | null;
    landmark: string | null;
    building: string | null;
    floor: string | null;
    riderInstructions: string | null;
    lat: number | null;
    lng: number | null;
  } | null;
  distanceKm: number | null;
  cutlery: boolean;
  note: string | null;
  eta: { minutes: number | null; promisedAt: string | null };
  rider: FoodOrderRider | null;
  handedToExternal: boolean;
  /** Vendor view: cash the rider or counter took. */
  codCollected: number | null;
  cancelledBy: string | null;
  cancelReason: string | null;
  timestamps: Record<'acceptedAt' | 'preparingAt' | 'readyAt' | 'pickedUpAt' | 'deliveredAt' | 'cancelledAt', string | null>;
  events: FoodOrderEvent[];
  canCancel: boolean;
  canReview: boolean;
  canReorder: boolean;
  /** Kitchen Intelligence's additions (docs/API_KITCHEN_ASSUMED.md §5; TODO(API_KITCHEN)). */
  packedPhotoUrl: string | null;
  origin: FoodOrderOrigin;
}

/** Where an order came from: the app, the kitchen's own link or QR, a tiffin plan, a catering event. */
export interface FoodOrderOrigin {
  kind: 'app' | 'link' | 'qr' | 'tiffin' | 'catering';
  ref: string | null;
}

/** The live view of an order on its way. */
export interface FoodTracking {
  code: string;
  status: FoodOrderStatus;
  statusLabel: string;
  fulfilment: FoodFulfilment;
  eta: { promisedAt: string | null; minutesLeft: number | null };
  branch: { name: string; phone: string | null; lat: number | null; lng: number | null };
  drop: { lat: number; lng: number } | null;
  rider: FoodOrderRider | null;
  handedToExternal: boolean;
  updatedAt: string | null;
}

/** A kitchen the customer saved. */
export interface FoodFavourite {
  id: string;
  slug: string;
  name: string;
  logoUrl: string | null;
  coverUrl: string | null;
  ratingAvg: number;
  ratingCount: number;
  openState: { open: boolean; paused: boolean; label: string };
  savedAt: string;
}

/** The kitchen's view of an order: the customer's contact and the moves it can make now. */
export interface VendorFoodOrder extends FoodOrder {
  customer: { name: string; phone: string | null };
  actions: { status: FoodOrderStatus[]; payment: FoodPaymentStatus[] };
}

/** Live events (hints only: REST stays the truth). */
export interface FoodLiveHead {
  orderId: string;
  code: string;
  status: FoodOrderStatus;
}
export interface FoodLiveCustomerUpdate extends FoodLiveHead {
  order: FoodOrder | null;
}
export interface FoodLiveBoardUpdate extends FoodLiveHead {
  order: BoardCard | null;
}
export interface FoodLivePayment extends FoodLiveHead {
  paymentStatus: FoodPaymentStatus;
  paymentMethod: FoodPaymentMethod;
}
export interface FoodBoardSync {
  at: string;
  orders: BoardCard[];
}
export interface FoodRiderFix {
  orderId: string;
  lat: number;
  lng: number;
  heading: number | null;
  at: string;
}

/** An order on the vendor's board. */
export interface BoardCard {
  id: string;
  code: string;
  status: FoodOrderStatus;
  statusLabel: string;
  fulfilment: FoodFulfilment;
  scheduledFor: string | null;
  placedAt: string;
  acceptBy: string | null;
  promisedAt: string | null;
  total: number;
  payment: { method: FoodPaymentMethod; status: FoodPaymentStatus };
  itemCount: number;
  itemsSummary: string;
  customerName: string | null;
  riderId: string | null;
  handedToExternal: boolean;
  /** Kitchen Intelligence's additions (TODO(API_KITCHEN)). */
  packedPhotoUrl: string | null;
  origin: FoodOrderOrigin;
}

export type PromotionKind = 'percent_off_order' | 'percent_off_items' | 'flat_off' | 'free_delivery';
export type PromotionState = 'live' | 'scheduled' | 'ended' | 'inactive';

export interface FoodPromotion {
  id: string;
  title: string;
  kind: PromotionKind;
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
  state: PromotionState;
  /** "10% off over Rs 500" — what customers see on cards. */
  label: string;
}

export interface PromotionInput {
  title: string;
  kind: PromotionKind;
  value: number;
  /** percent_off_items: the dishes it applies to. */
  itemIds: string[];
  minOrder: number;
  maxDiscount: number | null;
  code: string | null;
  endsAt: string | null;
  weekdays: number[];
  timeFrom: string | null;
  timeTo: string | null;
  usageLimit: number | null;
  perUserLimit: number | null;
  firstOrderOnly: boolean;
}

// ─── Reviews, the kitchen's insights, home banners ─────────────────────────
export type FoodReviewTag = 'tasty' | 'hot_and_fresh' | 'good_portion' | 'well_packed' | 'on_time' | 'polite_rider' | 'value_for_money';

/** One customer's review of one order. */
export interface FoodReview {
  id: string;
  /** The first name (staff see the full name); null on the customer's own copy. */
  author: string | null;
  foodRating: number;
  /** Delivery orders only. */
  deliveryRating: number | null;
  tags: FoodReviewTag[];
  text: string | null;
  photos: string[];
  vendorReply: string | null;
  repliedAt: string | null;
  createdAt: string;
}

/** The kitchen's own list: which order each review is about. */
export interface VendorReview extends FoodReview {
  orderCode: string | null;
}

export interface FoodReviewInput {
  foodRating: number;
  deliveryRating: number | null;
  tags: FoodReviewTag[];
  text: string;
  photos: string[];
}

/** The vendor page's rating block. */
export interface FoodRatingSummary {
  ratingAvg: number;
  ratingCount: number;
  /** Visible reviews by stars, 5 to 1. */
  distribution: Record<1 | 2 | 3 | 4 | 5, number>;
  topTags: { tag: FoodReviewTag; count: number }[];
  recent: FoodReview[];
}

export type FoodInsightsRange = 'today' | '7d' | '30d';

/** The kitchen's numbers over branch-local days. Rates are 0–1, null with no data. */
export interface FoodInsights {
  range: { from: string; to: string; timezone: string };
  /** "Recorded sales are the orders you marked delivered…" — the server's wording. */
  note: string | null;
  totals: { orders: number; completed: number; recordedSales: number; averageOrderValue: number };
  days: { date: string; orders: number; completed: number; cancelled: number; recordedSales: number }[];
  acceptanceRate: number | null;
  autoRejected: number;
  avgAcceptSeconds: number | null;
  avgPrepMinutes: number | null;
  onTimeRate: number | null;
  cancelReasons: { status: FoodOrderStatus; reason: string; count: number }[];
  topItems: { name: string; quantity: number; recordedSales: number }[];
  repeatCustomers: { customers: number; repeat: number; rate: number | null };
}

export type FoodBannerTarget =
  | { type: 'vendor'; id: string; slug: string; name: string }
  | { type: 'cuisine'; id: string; slug: string; name: string }
  | { type: 'search'; query: string };

/** A staff banner on the Food home, with what it opens. */
export interface FoodHomeBanner {
  id: string;
  imageUrl: string;
  title: string;
  subtitle: string | null;
  target: FoodBannerTarget;
}

// ─── The staff console (/admin/food) ───────────────────────────────────────
export interface AdminFoodOverview {
  date: string;
  activeVendors: Record<KitchenKind | 'total', number>;
  ordersToday: number;
  activeOrders: number;
  acceptanceRateToday: number | null;
  autoRejectsToday: number;
  topCuisines: { slug: string; name: string; orders: number }[];
  waiting: { approvals: number; foodSafetyChecks: number };
}

export type AdminVendorStatus = 'live' | 'draft' | 'paused' | 'suspended';

export interface AdminFoodVendorQuery {
  type?: KitchenKind;
  status?: AdminVendorStatus;
  city?: string;
  q?: string;
}

export interface AdminFoodVendorRow {
  id: string;
  businessId: string;
  name: string;
  slug: string;
  subType: KitchenKind;
  subTypeLabel: string;
  city: string | null;
  businessStatus: string;
  branchStatus: string;
  isPaused: boolean;
  isFeatured: boolean;
  ratingAvg: number;
  ratingCount: number;
  orders30d: number;
  wentLiveAt: string | null;
  foodSafetyCheckedAt: string | null;
  ownerEmail: string | null;
  planKey: string;
}

export interface AdminFoodReview extends FoodReview {
  vendorId: string | null;
  orderCode: string | null;
  isHidden: boolean;
  hiddenReason: string | null;
}

/** Everything staff see about one vendor (read-only, except feature / suspend / plan). */
export interface AdminFoodVendor {
  id: string;
  businessId: string;
  subType: KitchenKind;
  subTypeLabel: string;
  businessStatus: string;
  suspensionReason: string | null;
  ownerEmail: string | null;
  profile: VendorProfile | null;
  settings: VendorSettings | null;
  hours: HoursRange[];
  feeBands: FeeBand[];
  setup: VendorSetup | null;
  plan: VendorPlan | null;
  menu: { id: string; name: string; isActive: boolean; items: { id: string; name: string; basePrice: number; isActive: boolean }[] }[];
  recentOrders: BoardCard[];
  ratings: FoodRatingSummary | null;
  /** Reviews of 2 stars or fewer. */
  complaints: AdminFoodReview[];
}

export interface AdminFoodOrderRow extends BoardCard {
  vendorId: string | null;
}

export interface AdminFoodOrderQuery {
  code?: string;
  vendorId?: string;
  status?: FoodOrderStatus;
}

/** An order with every event, for disputes. */
export interface AdminFoodOrder extends FoodOrder {
  customer: { userId: string; name: string | null; email: string | null; phone: string | null };
}

export interface AdminFoodReviewQuery {
  vendorId?: string;
  hidden?: boolean;
  maxRating?: number;
}

export interface AdminCuisine extends FoodCuisine {
  sort: number;
  isActive: boolean;
  /** Vendors listing it; a cuisine in use can only be turned off. */
  vendors: number;
}

export interface AdminCuisineInput {
  name: string;
  slug: string;
  icon: string;
  sort: number;
}

export type FoodBannerTargetType = 'vendor' | 'cuisine' | 'search';

export interface AdminFoodBanner {
  id: string;
  imageUrl: string;
  title: string;
  subtitle: string | null;
  targetType: FoodBannerTargetType;
  targetId: string | null;
  targetQuery: string | null;
  /** null: every city. */
  city: string | null;
  startsAt: string;
  endsAt: string | null;
  sort: number;
  isActive: boolean;
}

export type AdminFoodBannerInput = Omit<AdminFoodBanner, 'id'>;
