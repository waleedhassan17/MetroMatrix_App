// ═══════════════════════════════════════════════════════
// MetroMatrix — Dummy kitchen rows → the assumed API's shapes
// ═══════════════════════════════════════════════════════
// Quantities go out in base units with the unit they are counted in; the
// app words them (utils/units/units). Money is whole rupees, except unit costs
// (rupees per base unit, four decimals) and a recipe line's cost per
// serving (two decimals: 2 g of salt is 12 paisa).
// TODO(API_KITCHEN): docs/API_KITCHEN_ASSUMED.md §2 (shared shapes).

import type { MockDb } from '../mockDb';
import type { MockMenuItem } from '../food/foodTypes';
import { formatSlot } from '../../../../utils/health-time/healthTime';
import type {
  MockDonation,
  MockIngredient,
  MockKitchenSettings,
  MockPurchase,
  MockRecipe,
  MockRecipeLine,
  MockSupplier,
  MockSurplusBox,
  MockSurplusReservation,
  MockWaste,
} from './kitchenTypes';
import {
  costOf,
  defaultVariantOf,
  expiringOf,
  itemServingsLeft,
  k,
  latestCostOf,
  onHandOf,
  perServing,
  recipeCost,
  recipeFor,
  recipeStatusOf,
  sellPriceOf,
  servingsLeft,
  settingsOf,
  stateOf,
  todayOf,
  vendorOf,
} from './kitchenLogic';

const r4 = (n: number) => Math.round(n * 10000) / 10000;
const r2 = (n: number) => Math.round(n * 100) / 100;

export const kitchenSettingsWire = (s: MockKitchenSettings) => ({
  targetFoodCostPct: s.targetFoodCostPct,
  autoSellOut: s.autoSellOut,
  packingPhoto: s.packingPhoto,
});

export const ingredientWire = (db: MockDb, i: MockIngredient, today: string) => {
  const exp = expiringOf(db, i, today);
  return {
    id: i.id,
    name: i.name,
    category: i.category,
    baseUnit: i.baseUnit,
    dozens: i.dozens,
    customUnits: i.customUnits.map(u => ({ ...u })),
    onHand: onHandOf(db, i),
    parLevel: i.parLevel,
    state: stateOf(db, i),
    costPerBase: r4(costOf(db, i)),
    latestCostPerBase: r4(latestCostOf(db, i)),
    expiring: exp ? { on: exp.on, qty: exp.qty } : null,
    priceRefKey: i.priceRefKey,
    nutritionFoodId: i.nutritionFoodId,
    updatedAt: i.updatedAt,
  };
};

export const ingredientDetailWire = (db: MockDb, i: MockIngredient, today: string) => ({
  ...ingredientWire(db, i, today),
  batches: k(db)
    .batches.filter(b => b.ingredientId === i.id && b.qty > 0)
    .sort((a, b) => (a.expiresOn ?? '9999').localeCompare(b.expiresOn ?? '9999'))
    .map(b => {
      const p = b.purchaseId ? k(db).purchases.find(x => x.id === b.purchaseId) : undefined;
      const s = p?.supplierId ? k(db).suppliers.find(x => x.id === p.supplierId) : undefined;
      return { id: b.id, qty: b.qty, receivedQty: b.receivedQty, costPerBase: r4(b.costPerBase), receivedAt: b.receivedAt, expiresOn: b.expiresOn, purchaseId: b.purchaseId, supplierName: s?.name ?? null };
    }),
  movements: k(db)
    .movements.filter(m => m.ingredientId === i.id)
    .sort((a, b) => b.at.localeCompare(a.at))
    .slice(0, 50)
    .map(m => ({ id: m.id, kind: m.kind, qty: m.qty, at: m.at, note: m.note, orderCode: m.orderCode, purchaseId: m.purchaseId })),
  usedIn: k(db)
    .recipes.filter(r => r.businessId === i.businessId && (r.lines.some(l => l.ingredientId === i.id) || r.packaging.some(l => l.ingredientId === i.id)))
    .map(r => {
      const item = db.food.items.find(x => x.id === r.itemId);
      const per = perServing(r).find(l => l.ingredientId === i.id);
      return { itemId: r.itemId, variantId: r.variantId, name: item ? `${item.name}${r.variantId ? ` (${item.variants.find(v => v.id === r.variantId)?.name ?? ''})` : ''}` : r.itemId, qtyPerServing: Math.round((per?.qty ?? 0) * 100) / 100 };
    }),
});

export const supplierWire = (db: MockDb, s: MockSupplier) => {
  const mine = k(db).purchases.filter(p => p.supplierId === s.id);
  return {
    id: s.id,
    name: s.name,
    phone: s.phone,
    note: s.note,
    purchaseCount: mine.length,
    lastPurchaseOn: mine.map(p => p.date).sort().pop() ?? null,
  };
};

export const purchaseWire = (db: MockDb, p: MockPurchase) => {
  const s = p.supplierId ? k(db).suppliers.find(x => x.id === p.supplierId) : undefined;
  return {
    id: p.id,
    date: p.date,
    supplier: s ? { id: s.id, name: s.name } : null,
    source: p.source,
    receiptUrl: p.receiptUrl,
    total: p.total,
    lines: p.lines.map(l => {
      const i = k(db).ingredients.find(x => x.id === l.ingredientId);
      return { id: l.id, ingredientId: l.ingredientId, name: i?.name ?? 'Ingredient', baseUnit: i?.baseUnit ?? 'g', dozens: i?.dozens ?? false, qty: l.qty, total: l.total, costPerBase: r4(l.qty ? l.total / l.qty : 0), expiresOn: l.expiresOn };
    }),
    createdAt: p.createdAt,
  };
};

const lineWire = (db: MockDb, l: MockRecipeLine, perServingQty: number) => {
  const i = k(db).ingredients.find(x => x.id === l.ingredientId);
  const cost = i ? costOf(db, i) : 0;
  return {
    ingredientId: l.ingredientId,
    name: i?.name ?? 'Ingredient',
    baseUnit: i?.baseUnit ?? 'g',
    dozens: i?.dozens ?? false,
    qty: l.qty,
    costPerBase: r4(cost),
    cost: r2(perServingQty * cost),
  };
};

const optionsOf = (db: MockDb, item: MockMenuItem) =>
  item.links
    .map(l => db.food.groups.find(g => g.id === l.groupId))
    .filter((g): g is NonNullable<typeof g> => !!g)
    .flatMap(g => g.options.filter(o => o.isActive).map(o => ({ optionId: o.id, name: o.name, groupName: g.name })));

export const recipeWire = (db: MockDb, item: MockMenuItem, variantId: string | null) => {
  const r = recipeFor(db, item.businessId, item.id, variantId);
  const exact = r && r.variantId === variantId ? r : null;
  // Staff took the signature label off (5C console): their note, while it stays off.
  const review = [...(k(db).signatureReviews ?? [])].reverse().find(x => x.itemId === item.id);
  const removedNote = exact && !exact.signature.on && review?.status === 'removed' ? review.note : null;
  const yieldN = Math.max(1, exact?.yield ?? 1);
  const options = optionsOf(db, item);
  return {
    itemId: item.id,
    itemName: item.name,
    photoUrl: item.photoUrl,
    variantId,
    variants: [...item.variants].sort((a, b) => a.sort - b.sort).map(v => ({ id: v.id, name: v.name, price: v.price, hasRecipe: !!recipeFor(db, item.businessId, item.id, v.id) })),
    sellPrice: sellPriceOf(item, variantId),
    yield: yieldN,
    lines: (exact?.lines ?? []).map(l => lineWire(db, l, l.qty / yieldN)),
    addOns: (exact?.addOns ?? []).map(a => {
      const o = options.find(x => x.optionId === a.optionId);
      return { optionId: a.optionId, optionName: o?.name ?? 'Add-on', groupName: o?.groupName ?? '', lines: a.lines.map(l => lineWire(db, l, l.qty)) };
    }),
    options,
    packaging: (exact?.packaging ?? []).map(l => lineWire(db, l, l.qty)),
    signature: { on: exact?.signature.on ?? false, creatorName: exact?.signature.creatorName ?? null, removedNote },
    cost: exact ? recipeCost(db, exact, item) : null,
    servingsLeft: servingsLeft(db, exact),
    targetFoodCostPct: settingsOf(db, item.businessId).targetFoodCostPct,
    updatedAt: exact?.updatedAt ?? null,
  };
};

export const recipeRowWire = (db: MockDb, item: MockMenuItem) => {
  const v = defaultVariantOf(item);
  const r = recipeFor(db, item.businessId, item.id, v?.id ?? null);
  const category = db.food.categories.find(c => c.id === item.categoryId);
  return {
    itemId: item.id,
    name: item.name,
    photoUrl: item.photoUrl,
    categoryName: category?.name ?? null,
    status: recipeStatusOf(db, item),
    variantId: v?.id ?? null,
    variantName: v?.name ?? null,
    variantCount: item.variants.length,
    sellPrice: sellPriceOf(item, v?.id ?? null),
    cost: r ? recipeCost(db, r, item) : null,
    servingsLeft: itemServingsLeft(db, item),
    signature: !!r?.signature.on,
  };
};

export const recipesListWire = (db: MockDb, businessId: string, items: MockMenuItem[], needsOnly: boolean) => {
  const rows = items.map(i => recipeRowWire(db, i));
  const costed = rows.filter(r => r.cost);
  const target = settingsOf(db, businessId).targetFoodCostPct;
  return {
    targetFoodCostPct: target,
    avgFoodCostPct: costed.length ? Math.round(costed.reduce((n, r) => n + r.cost!.foodCostPct, 0) / costed.length) : null,
    counts: { all: rows.length, missing: rows.filter(r => r.status !== 'complete').length, overTarget: costed.filter(r => r.cost!.overTarget).length },
    items: needsOnly ? rows.filter(r => r.status !== 'complete') : rows,
  };
};

export const wasteWire = (w: MockWaste) => ({
  id: w.id,
  at: w.at,
  lines: w.lines.map(l => ({ ...l })),
  cost: w.cost,
  note: w.note,
});

export const donationWire = (d: MockDonation) => ({ id: d.id, at: d.at, meals: d.meals, to: d.to, note: d.note });

// ── Bachat Box ──
const counts = (db: MockDb, b: MockSurplusBox) => {
  const live = k(db).reservations.filter(r => r.boxId === b.id && r.status !== 'cancelled');
  const reserved = live.reduce((n, r) => n + r.quantity, 0);
  const collected = live.filter(r => r.status === 'collected').reduce((n, r) => n + r.quantity, 0);
  return { reserved, collected, left: Math.max(0, b.quantity - reserved) };
};

export const boxStatusOf = (db: MockDb, b: MockSurplusBox, now: number): 'live' | 'sold_out' | 'ended' | 'cancelled' => {
  if (b.status !== 'live') return b.status;
  if (Date.parse(b.pickupTo) <= now) return 'ended';
  return counts(db, b).left <= 0 ? 'sold_out' : 'live';
};

export const pickupLabel = (b: Pick<MockSurplusBox, 'pickupFrom' | 'pickupTo'>, timezone: string) =>
  `Today, ${formatSlot(b.pickupFrom, timezone)} – ${formatSlot(b.pickupTo, timezone)}`;

export const boxWire = (db: MockDb, b: MockSurplusBox, now: number) => {
  const v = vendorOf(db, b.businessId);
  return {
    id: b.id,
    title: b.title,
    contentsHint: b.contentsHint,
    photoUrl: b.photoUrl,
    value: b.value,
    price: b.price,
    quantity: b.quantity,
    ...counts(db, b),
    pickupFrom: b.pickupFrom,
    pickupTo: b.pickupTo,
    pickupLabel: pickupLabel(b, v.timezone),
    status: boxStatusOf(db, b, now),
    createdAt: b.createdAt,
  };
};

export const reservationWire = (db: MockDb, r: MockSurplusReservation, viewer: 'customer' | 'vendor', now: number) => {
  const b = k(db).boxes.find(x => x.id === r.boxId)!;
  const v = vendorOf(db, r.businessId);
  const u = db.users.find(x => x.id === r.userId);
  return {
    code: r.code,
    status: r.status,
    quantity: r.quantity,
    total: r.total,
    box: { id: b.id, title: b.title, photoUrl: b.photoUrl, value: b.value, price: b.price },
    vendor: { id: v.brandId, slug: v.slug, name: v.name, logoUrl: v.logoUrl, phone: v.phone, location: { addressLine: v.addressLine, area: v.area, city: v.city, lat: v.lat, lng: v.lng } },
    pickupFrom: b.pickupFrom,
    pickupTo: b.pickupTo,
    pickupLabel: pickupLabel(b, v.timezone),
    payment: {
      method: r.paymentMethod,
      status: r.paymentStatus,
      payBy: r.paymentStatus === 'awaiting_transfer' ? r.payBy : null,
      accounts: r.paymentMethod === 'transfer' ? v.accounts.filter(a => a.isActive).map(a => ({ kind: a.kind, accountTitle: a.accountTitle, accountNumber: a.accountNumber, bankName: a.bankName })) : null,
      reference: r.paymentRef,
      proofUrl: r.paymentProofUrl,
      rejectedReason: r.paymentRejectedReason,
    },
    ...(viewer === 'vendor' ? { customerName: u?.name ?? 'Customer' } : null),
    canCancel: viewer === 'customer' && r.status === 'reserved' && Date.parse(b.pickupFrom) > now,
    reservedAt: r.reservedAt,
    collectedAt: r.collectedAt,
  };
};

/** A box on the customer's side: the box and its kitchen (no reservations). */
export const surplusCardWire = (db: MockDb, b: MockSurplusBox, distanceKm: number | null, now: number) => {
  const v = vendorOf(db, b.businessId);
  const w = boxWire(db, b, now);
  return {
    id: b.id,
    title: b.title,
    contentsHint: b.contentsHint,
    photoUrl: b.photoUrl ?? v.coverUrl,
    value: b.value,
    price: b.price,
    left: w.left,
    status: w.status,
    pickupFrom: b.pickupFrom,
    pickupTo: b.pickupTo,
    pickupLabel: w.pickupLabel,
    vendor: { id: v.brandId, slug: v.slug, name: v.name, logoUrl: v.logoUrl, area: v.area, isHomeKitchen: v.kind === 'home_kitchen', distanceKm },
  };
};

export { todayOf };
export type RecipeOf = MockRecipe;
