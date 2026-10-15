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
