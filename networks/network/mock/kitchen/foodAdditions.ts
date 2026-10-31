// ═══════════════════════════════════════════════════════
// MetroMatrix — What Kitchen Intelligence adds to the released Food shapes
// ═══════════════════════════════════════════════════════
// docs/API_FOOD.md is the backend's released contract; the assumed kitchen
// API (docs/API_KITCHEN_ASSUMED.md §5) adds these keys to its shapes. The
// Food parity tests leave them out of the comparison, and fail the day a
// real capture carries one: then the backend has shipped it, and it is
// reconciled (this list shrinks, the TODO(API_KITCHEN) goes).

export const FOOD_ADDITIONS: Record<string, string> = {
  // The vendor's own profile (branch): a pause's private reason and when it lifts by itself.
  pauseReason: 'branch: why the kitchen paused (never shown to customers)',
  resumeAt: 'branch: when the pause lifts by itself',
  // Orders (customer, vendor, staff, board cards).
  packedPhotoUrl: 'order: the packing photo taken before handover',
  origin: 'order: where it came from (app, link, qr, tiffin, catering)',
  // Rider orders (5B).
  dropOrder: 'rider order: "drop 1 of 2" when the kitchen batches deliveries',
  // Vendor cards and the vendor page (5B–5C).
  badges: 'vendor card: signature, hygiene verified, home kitchen, Bachat Box today, healthy picks',
  story: 'vendor page: the kitchen’s story, cook and photos',
  hygiene: 'vendor page: self-declared or verified hygiene',
  signatureItemIds: 'vendor page: dishes marked as signature recipes',
  tiffinPlans: 'vendor page: tiffin plans on offer',
  catering: 'vendor page: whether it takes catering requests, the fewest guests and days ahead',
  ramadan: 'vendor page: sehri and iftar hours while Ramadan mode is on',
  // Dishes (menu card, item sheet, search) (5C).
  nutrition: 'dish: estimated calories and macros',
  descriptionUr: 'dish: the Urdu description',
  isSignature: 'dish: a signature recipe',
};

export const FOOD_ADDITION_KEYS = Object.keys(FOOD_ADDITIONS);

/** "fixture:path +key" diffs that are one of these additions. */
export const isAddition = (diff: string) => {
  const m = diff.match(/ \+([A-Za-z]+)$/);
  return !!m && FOOD_ADDITION_KEYS.includes(m[1]);
};

/** Every addition key the real capture already sends (each one is a reconcile to do). */
export const shippedAdditions = (captured: unknown): string[] => {
  const found = new Set<string>();
  const walk = (v: unknown) => {
    if (Array.isArray(v)) v.forEach(walk);
    else if (v && typeof v === 'object') {
      for (const [key, value] of Object.entries(v)) {
        if (FOOD_ADDITION_KEYS.includes(key)) found.add(key);
        walk(value);
      }
    }
  };
  walk(captured);
  return [...found].sort();
};
