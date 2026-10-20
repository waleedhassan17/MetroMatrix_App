// ═══════════════════════════════════════════════════════
// MetroMatrix — Where Kitchen Intelligence plugs into the dummy Food API
// ═══════════════════════════════════════════════════════
// The Food mock speaks the real docs/API_FOOD.md. Chunk 5's assumed kitchen
// API (../kitchen/) adds a few things to it — stock that sells a dish out,
// a packing photo before "ready", where an order came from — through these
// hooks, so Food itself stays exactly the released contract and, with no
// kitchen installed (the defaults), behaves as it did.
// Every key a hook adds to a Food shape is listed in ../kitchen/foodAdditions.ts.

import type { MockDb } from '../mockDb';
import type { MockFoodOrder, MockFoodReview, MockFoodVendor, MockMenuItem } from './foodTypes';

type Extras = Record<string, unknown>;

export interface FoodHooks {
  /** A further reason a dish can't be sold now (stock ran out: 'ingredients'), checked after the menu's own. */
  itemBlocked: (db: MockDb, v: MockFoodVendor, i: MockMenuItem, now: number) => string | null;
  /** Before a status move is made: may refuse it (throw). */
  beforeMove: (db: MockDb, o: MockFoodOrder, to: MockFoodOrder['status'], actor: string, now: number) => void;
  /** After a status move: stock deducted on accept, given back on an early cancel. */
  afterMove: (db: MockDb, o: MockFoodOrder, from: MockFoodOrder['status'], to: MockFoodOrder['status'], actor: string, now: number) => void;
  /** An order was just placed (checkout): where it came from. */
  onPlaced: (db: MockDb, o: MockFoodOrder, body: Record<string, unknown>, now: number) => void;
  /** Keys added to a customer/vendor/rider/staff order view. */
  orderExtras: (db: MockDb, o: MockFoodOrder, viewer: string) => Extras;
  /** Keys added to a board card. */
  boardExtras: (db: MockDb, o: MockFoodOrder) => Extras;
  /** Keys added to a rider's order. */
  riderExtras: (db: MockDb, o: MockFoodOrder) => Extras;
  /** Keys added to a vendor card (lists, home rails, search). */
  cardExtras: (db: MockDb, v: MockFoodVendor, now: number) => Extras;
  /** Keys added to the vendor page. */
  pageExtras: (db: MockDb, v: MockFoodVendor, now: number) => Extras;
  /** Keys added to a dish (the menu's card and the item sheet). */
  itemExtras: (db: MockDb, v: MockFoodVendor, i: MockMenuItem, now: number) => Extras;
  /** A pause or resume (the pause's private reason and its auto-resume time); may refuse (throw). */
  onPause: (db: MockDb, v: MockFoodVendor, body: Record<string, unknown>, now: number) => void;
  onResume: (db: MockDb, v: MockFoodVendor, now: number) => void;
  /** Keys added to the vendor's own profile branch (the pause's private reason). */
  branchExtras: (db: MockDb, v: MockFoodVendor, now: number) => Extras;
  /** A search was run (anonymous demand: where, when, whether an open kitchen matched). */
  onSearch: (db: MockDb, q: { text: string; cuisine: string | null; lat: number | null; lng: number | null; foundOpen: boolean }, now: number) => void;
  /** Search filters the kitchen adds (`nutrition`): false drops the vendor or dish. */
  searchFilter: (db: MockDb, v: MockFoodVendor, i: MockMenuItem | null, query: Record<string, unknown>) => boolean;
  /** The kitchen's minute jobs; returns orders whose change should go out live. */
  settle: (db: MockDb, now: number) => MockFoodOrder[];
  /** A dish was created or edited: keys the kitchen keeps for it (`descriptionUr`); may refuse (throw). */
  onItemSaved: (db: MockDb, i: MockMenuItem, body: Record<string, unknown>) => void;
  /** Filters the kitchen adds to its own reviews list (`theme`, `week`); may refuse (throw). */
  vendorReviewFilter: (db: MockDb, v: MockFoodVendor, query: Record<string, string>, now: number) => (r: MockFoodReview) => boolean;
}

const none = (): Extras => ({});

const DEFAULTS: FoodHooks = {
  itemBlocked: () => null,
  beforeMove: () => undefined,
  afterMove: () => undefined,
  onPlaced: () => undefined,
  orderExtras: none,
  boardExtras: none,
  riderExtras: none,
  cardExtras: none,
  pageExtras: none,
  itemExtras: none,
  onPause: () => undefined,
  onResume: () => undefined,
  branchExtras: none,
  onSearch: () => undefined,
  searchFilter: () => true,
  settle: () => [],
  onItemSaved: () => undefined,
  vendorReviewFilter: () => () => true,
};

export const foodHooks: FoodHooks = { ...DEFAULTS };

export const installFoodHooks = (hooks: Partial<FoodHooks>) => {
  Object.assign(foodHooks, hooks);
};

/** Back to plain Food (tests of the released contract alone). */
export const resetFoodHooks = () => {
  Object.assign(foodHooks, DEFAULTS);
};
