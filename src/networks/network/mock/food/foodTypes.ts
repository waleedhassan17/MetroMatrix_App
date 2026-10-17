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

export interface MockFood {
  cuisines: MockCuisine[];
  vendors: MockFoodVendor[];
  riders: MockRider[];
  /** Ids for new rows. */
  seq: number;
}
