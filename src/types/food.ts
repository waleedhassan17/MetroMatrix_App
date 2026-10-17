// ═══════════════════════════════════════════════════════
// MetroMatrix — Food discovery types (customer Food home)
// ═══════════════════════════════════════════════════════

import type { SubType } from './auth';

export type KitchenKind = Extract<SubType, 'restaurant' | 'home_kitchen' | 'cloud_kitchen'>;

export interface Cuisine {
  /** Stable key — the UI picks the glyph from it. */
  slug: string;
  name: string;
}

export interface Kitchen {
  id: string;
  name: string;
  kind: KitchenKind;
  cuisines: string[];
  area: string;
  rating: number;
  ratingCount: number;
  /** Delivery window in minutes. */
  etaMin: number;
  etaMax: number;
  /** Rupees; 0 is free delivery. */
  deliveryFee: number;
  minOrder: number;
  /** 1–3 ("Rs", "Rs Rs", "Rs Rs Rs"). */
  priceLevel: number;
  distanceKm: number;
  /** A short promotion ("20% off", "Free dessert"), or null. */
  deal: string | null;
  isNew: boolean;
  imageUrl: string | null;
}

export interface FoodPromo {
  id: string;
  title: string;
  subtitle: string;
  code: string | null;
}

export interface FoodHome {
  /** The delivery area the list was built for. */
  area: string;
  promos: FoodPromo[];
  cuisines: Cuisine[];
  kitchens: Kitchen[];
}

// ═══════════════════════════════════════════════════════
// Food Court vendors and riders (MetroMatrix-API, Food chunk)
// TODO(API_FOOD): shapes from the Food API's committed routes; check them
// against docs/API_FOOD.md when it is published.
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

/** The vendor's plan: always the free Community plan, with what it allows and what is used. */
export interface VendorPlan {
  key: string;
  label: string;
  /** 0: the Community plan is free. */
  price: number;
  limits: Record<PlanLimitKey, number>;
  usage: Record<PlanLimitKey, number>;
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
