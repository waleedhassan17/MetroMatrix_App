// MetroMatrix — My Kitchen and the customer's nutrition (Kitchen Intelligence, 5C).
// docs/API_KITCHEN_ASSUMED.md §2.15 (TODO(API_KITCHEN): an assumed contract).
// The customer's own: none of it ever reaches a kitchen.

import type { BaseUnit, StandardUnit } from '../utils/units/units';

export type PantryState = 'fresh' | 'use_soon' | 'expired';
export type PantrySegment = 'all' | 'use_soon' | 'expired';

export interface PantryItem {
  id: string;
  name: string;
  /** The ingredient it is (matched from its name), or null. */
  key: string | null;
  /** Base units. */
  qty: number;
  unit: BaseUnit;
  expiresOn: string | null;
  state: PantryState;
  source: 'manual' | 'voice' | 'shopping';
  addedAt: string;
}

export interface PantryList {
  counts: Record<PantrySegment, number>;
  items: PantryItem[];
}

export interface PantryLineInput {
  name: string;
  key?: string | null;
  qty: number;
  unit: StandardUnit;
  expiresOn?: string | null;
}

export interface PantryStats {
  month: string;
  used: number;
  savedFromWaste: number;
  wasted: number;
  inKitchen: number;
}

export interface PantryReminders {
  enabled: boolean;
  time: string;
  daysBefore: number;
}

export interface GroceryOrder {
  orderId: string;
  code: string;
  storeName: string;
  placedAt: string;
  status: string;
  lines: { lineId: string; name: string; quantity: number; netQuantity: { qty: number; unit: BaseUnit }; alreadyAdded: boolean }[];
}

export interface Macros {
  kcal: number;
  protein: number;
  carbs: number;
  fat: number;
}

export interface RecipeIdea {
  id: string;
  title: string;
  /** English words to find it on Food Court. */
  searchTerm: string;
  minutes: number;
  servings: number;
  have: string[];
  missing: string[];
  usesExpiring: string[];
  /** A serving. */
  nutrition: Macros | null;
}

export interface HomeRecipe {
  id: string;
  title: string;
  searchTerm: string;
  language: 'en' | 'ur';
  minutes: number;
  servings: number;
  ingredients: { key: string; name: string; qty: number; unit: BaseUnit; have: boolean; usesExpiring: boolean }[];
  steps: string[];
  nutrition: Macros | null;
}

export interface GroceryOption {
  productId: string;
  variantId: string | null;
  name: string;
  store: { id: string; name: string };
  price: number;
  netQuantity: { qty: number; unit: BaseUnit };
  /** Rupees per kg, litre or piece. */
  pricePerUnit: { amount: number; per: 'kg' | 'litre' | 'piece' };
  packsNeeded: number;
  inStock: boolean;
}

export interface MissingItem {
  key: string;
  name: string;
  need: { qty: number; unit: BaseUnit };
  options: GroceryOption[];
}

export type NutritionGoal = 'eat_better' | 'maintain' | 'lose' | 'gain';
export type Activity = 'low' | 'moderate' | 'high';

export interface BodyMetrics {
  sex: 'female' | 'male';
  age: number;
  heightCm: number;
  weightKg: number;
  activity: Activity;
}

export interface NutritionSettings {
  enabled: boolean;
  showCalories: boolean;
  goal: NutritionGoal;
  metrics: BodyMetrics | null;
  manualTargetKcal: number | null;
  /** Worked out (or the person's own); null without either. */
  targetKcal: number | null;
  updatedAt: string | null;
}

export interface NutritionDay extends Macros {
  date: string;
  orders: number;
}

export interface NutritionSummary {
  from: string;
  to: string;
  days: NutritionDay[];
  averageOnOrderDays: Macros;
  topDishes: { name: string; count: number }[];
  /** Dishes ordered that have no numbers. */
  uncounted: number;
  targetKcal: number | null;
}

export interface HealthyPick {
  itemId: string;
  name: string;
  photoUrl: string | null;
  price: number;
  /** A person's share. */
  kcal: number;
  protein: number;
  serves: number;
  tags: ('under_600' | 'high_protein')[];
  vendor: { id: string; slug: string; name: string };
}

/** A dish's numbers (per order as sold), shown only to customers who turned calories on. */
export interface DishFacts extends Macros {
  method: 'recipe' | 'ai_estimate';
  /** How many people the dish as sold is for: a person's share is the numbers ÷ serves. */
  serves: number;
}
