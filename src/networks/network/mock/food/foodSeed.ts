// ═══════════════════════════════════════════════════════
// MetroMatrix — Dummy Food seed
// ═══════════════════════════════════════════════════════
// The API's cuisine list, three demo vendors (one of each kind) and two
// riders. Names are fictional; logos are generated placeholders standing in
// for a vendor's own upload. Accounts (password Metro2026) are listed in
// docs/MOCK_FOOD.md.

import type { MockCuisine, MockFood, MockFoodVendor, MockHoursRow, MockRider } from './foodTypes';

const DAY = 24 * 60 * 60 * 1000;
const iso = (msAgo = 0) => new Date(Date.now() - msAgo).toISOString();

/** The API's launch cuisines (migration FoodCuisinesSeed): slug, name, icon key. */
const CUISINES: [string, string, string][] = [
  ['pakistani', 'Pakistani', 'pakistani'],
  ['bbq', 'BBQ', 'bbq'],
  ['fast-food', 'Fast food', 'fast_food'],
  ['burgers', 'Burgers', 'burger'],
  ['pizza', 'Pizza', 'pizza'],
  ['chinese', 'Chinese', 'chinese'],
  ['biryani', 'Biryani', 'biryani'],
  ['karahi', 'Karahi', 'karahi'],
  ['desserts', 'Desserts', 'dessert'],
  ['bakery', 'Bakery', 'bakery'],
  ['cafe', 'Cafe', 'cafe'],
  ['healthy', 'Healthy', 'healthy'],
  ['breakfast', 'Breakfast', 'breakfast'],
  ['shawarma', 'Shawarma', 'shawarma'],
  ['rolls', 'Rolls', 'roll'],
  ['ice-cream', 'Ice cream', 'ice_cream'],
  ['home-food', 'Home food', 'home_food'],
  ['beverages', 'Beverages', 'beverage'],
];

export const cuisineId = (slug: string) => `cu_${slug.replace(/-/g, '_')}`;

const seedCuisines = (): MockCuisine[] =>
  CUISINES.map(([slug, name, icon], i) => ({ id: cuisineId(slug), slug, name, icon, sort: (i + 1) * 10, isActive: true }));

/** The partner accounts that own the demo vendors (mockDb adds the users and businesses). */
export const FOOD_SEED_USERS = [
  {
    id: 'u_resto',
    email: 'restaurant@metromatrix.app',
    name: 'Imran Qureshi',
    phone: '+923001110001',
    businessId: 'b_resto',
    subType: 'restaurant' as const,
    businessName: 'Biryani Bazaar',
    address: '12-C Main Boulevard, Gulberg III',
  },
  {
    id: 'u_cloud',
    email: 'cloudkitchen@metromatrix.app',
    name: 'Faraz Ahmed',
    phone: '+923001110003',
    businessId: 'b_cloud',
    subType: 'cloud_kitchen' as const,
    businessName: 'Smash Lab',
    address: 'Plot 4, Commercial Area, DHA Phase 6',
  },
  {
    id: 'u_homek',
    email: 'homekitchen@metromatrix.app',
    name: 'Nasreen Akhtar',
    phone: '+923001110002',
    businessId: 'b_homek',
    subType: 'home_kitchen' as const,
    businessName: 'Ammi ka Khana',
    address: 'House 21, Street 4, Johar Town',
  },
];

/** Riders the restaurant added (they sign in with the username; password Metro2026). */
export const FOOD_SEED_RIDERS = [
  { userId: 'u_rider_ali', riderId: 'rd_ali', username: 'biryani-bazaar.ali', name: 'Ali Raza', phone: '+923001112233', businessId: 'b_resto', vehicle: 'bike' as const, status: 'active' as const },
  { userId: 'u_rider_usman', riderId: 'rd_usman', username: 'biryani-bazaar.usman', name: 'Usman Tariq', phone: '+923001114455', businessId: 'b_resto', vehicle: 'bicycle' as const, status: 'on_leave' as const },
];

const everyDay = (opensAt: string, closesAt: string): MockHoursRow[] => Array.from({ length: 7 }, (_, weekday) => ({ weekday, opensAt, closesAt }));

/** A generated initials logo — a stand-in for the vendor's own upload. */
const logo = (initials: string, hex: string) => `https://placehold.co/256x256/${hex.slice(1)}/FFFFFF/png?text=${initials}`;

const base = (over: Partial<MockFoodVendor> & Pick<MockFoodVendor, 'businessId' | 'ownerId' | 'kind' | 'brandId' | 'branchId' | 'name' | 'slug'>): MockFoodVendor => ({
  tagline: null,
  logoUrl: null,
  coverUrl: null,
  brandColor: '#B4532A',
  onBrandColor: '#FFFFFF',
  cuisineIds: [],
  priceLevel: 2,
  ratingAvg: 0,
  ratingCount: 0,
  status: 'draft',
  wentLiveAt: null,
  foodSafetyCheckedAt: null,
  isPaused: false,
  pauseMessage: null,
  busyUntil: null,
  busyExtraMinutes: 0,
  acceptsDelivery: true,
  acceptsPickup: true,
  acceptsCod: true,
  codLimit: 10000,
  transferConfirmBeforePrep: true,
  autoRejectMinutes: 5,
  prepMinutes: 20,
  maxRadiusKm: 5,
  freeDeliveryOver: null,
  preorderOnly: false,
  addressLine: null,
  area: null,
  city: 'Lahore',
  lat: null,
  lng: null,
  phone: null,
  timezone: 'Asia/Karachi',
  hours: [],
  feeBands: [],
  closures: [],
  accounts: [],
  planStartedAt: iso(40 * DAY),
  ...over,
});

const seedVendors = (): MockFoodVendor[] => [
  base({
    businessId: 'b_resto',
    ownerId: 'u_resto',
    kind: 'restaurant',
    brandId: 'fb_resto',
    branchId: 'br_resto',
    name: 'Biryani Bazaar',
    slug: 'biryani-bazaar',
    tagline: 'Karachi-style biryani, slow-cooked every morning',
    logoUrl: logo('BB', '#B45309'),
    brandColor: '#B45309',
    cuisineIds: [cuisineId('pakistani'), cuisineId('biryani'), cuisineId('bbq')],
    ratingAvg: 4.6,
    ratingCount: 312,
    status: 'active',
    wentLiveAt: iso(30 * DAY),
    codLimit: 5000,
    maxRadiusKm: 6,
    freeDeliveryOver: 2500,
    addressLine: '12-C Main Boulevard, Gulberg III',
    area: 'Gulberg III',
    lat: 31.5102,
    lng: 74.3441,
    phone: '+923001110001',
    hours: [...everyDay('12:00', '15:30'), ...everyDay('18:00', '02:00')],
    feeBands: [
      { fromKm: 0, toKm: 3, fee: 99, minOrder: 500 },
      { fromKm: 3, toKm: 6, fee: 149, minOrder: 800 },
    ],
    accounts: [
      { id: 'va_resto_jc', kind: 'jazzcash', accountTitle: 'Imran Qureshi', accountNumber: '+923001110001', bankName: null, isActive: true, createdAt: iso(30 * DAY) },
    ],
  }),
  base({
    businessId: 'b_cloud',
    ownerId: 'u_cloud',
    kind: 'cloud_kitchen',
    brandId: 'fb_cloud',
    branchId: 'br_cloud',
    name: 'Smash Lab',
    slug: 'smash-lab',
    tagline: 'Smash burgers and loaded fries, delivery only',
    logoUrl: logo('SL', '#1D4ED8'),
    brandColor: '#1D4ED8',
    cuisineIds: [cuisineId('burgers'), cuisineId('fast-food')],
    priceLevel: 2,
    ratingAvg: 4.4,
    ratingCount: 158,
    status: 'active',
    wentLiveAt: iso(20 * DAY),
    acceptsPickup: false,
    prepMinutes: 15,
    addressLine: 'Plot 4, Commercial Area, DHA Phase 6',
    area: 'DHA Phase 6',
    lat: 31.4697,
    lng: 74.4559,
    phone: '+923001110003',
    hours: everyDay('13:00', '03:00'),
    feeBands: [
      { fromKm: 0, toKm: 2, fee: 79, minOrder: 400 },
      { fromKm: 2, toKm: 5, fee: 129, minOrder: 600 },
    ],
  }),
  base({
    businessId: 'b_homek',
    ownerId: 'u_homek',
    kind: 'home_kitchen',
    brandId: 'fb_homek',
    branchId: 'br_homek',
    name: 'Ammi ka Khana',
    slug: 'ammi-ka-khana',
    tagline: 'Home-cooked salan and roti, made fresh each day',
    logoUrl: logo('AK', '#047857'),
    brandColor: '#047857',
    cuisineIds: [cuisineId('home-food'), cuisineId('pakistani')],
    priceLevel: 1,
    // Set up, waiting for MetroMatrix's food-safety check before going live.
    addressLine: 'House 21, Street 4, Johar Town',
    area: 'Johar Town',
    lat: 31.4697,
    lng: 74.2728,
    phone: '+923001110002',
    maxRadiusKm: 4,
    hours: Array.from({ length: 6 }, (_, i) => ({ weekday: i + 1, opensAt: '12:00', closesAt: '21:00' })),
    feeBands: [{ fromKm: 0, toKm: 4, fee: 120, minOrder: 600 }],
  }),
];

const seedRiders = (): MockRider[] =>
  FOOD_SEED_RIDERS.map(r => ({
    id: r.riderId,
    userId: r.userId,
    businessId: r.businessId,
    fullName: r.name,
    phone: r.phone,
    vehicle: r.vehicle,
    status: r.status,
    onDuty: false,
    activeOrderCount: 0,
    lastGeo: null,
    locationUpdatedAt: null,
    createdAt: iso(25 * DAY),
  }));

export const seedFood = (): MockFood => ({
  cuisines: seedCuisines(),
  vendors: seedVendors(),
  riders: seedRiders(),
  seq: 0,
});
