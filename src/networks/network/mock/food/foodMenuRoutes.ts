// ═══════════════════════════════════════════════════════
// MetroMatrix — Dummy Food menu routes (the vendor's menu)
// ═══════════════════════════════════════════════════════
// Categories (with a daily window), dishes with sizes, the reusable add-on
// group library, what is off and until when, and a home kitchen's day:
// portions, the weekly menu and pre-order slots. As the API answers them.
// Mirrors the API's menu routes (docs/API_FOOD.md §4.3 Menu).

import type { ShopCtx, ShopKit } from '../shop/shopRoutes';
import { EVERY_DAY, FoodError, ITEM_TAGS, assertWithinPlan, invalid, isoNow, kitchenToday, menuItemCount, nextId, notFound, overrideOf, text } from './foodLogic';
import { availabilityWire, categoriesWire, categoryWire, groupWire, groupsWire, itemWire, itemsWire, slotsWire, todayWire, weeklyWire } from './foodWire';
import type { MockFoodVendor, MockItemTag, MockMenuItem, MockOptionGroup } from './foodTypes';
import { foodHooks } from './foodHooks';

const HHMM = /^([01]\d|2[0-3]):[0-5]\d$/;
const isInt = (v: unknown) => typeof v === 'number' && Number.isInteger(v);
const between = (v: number, lo: number, hi: number) => v >= lo && v <= hi;
const dec = decodeURIComponent;

const daysOf = (v: unknown, field = 'days'): number[] => {
  if (!Array.isArray(v) || v.length < 1 || v.length > 7 || !v.every(d => isInt(d) && between(d, 0, 6))) {
    throw invalid(field, 'days must be 1 to 7 weekdays (0 = Sunday)');
  }
  return [...new Set(v as number[])].sort((a, b) => a - b);
};

export function registerMenuRoutes(route: ShopKit['route'], myVendor: (ctx: ShopCtx) => MockFoodVendor) {
  const ownCategory = (ctx: ShopCtx, v: MockFoodVendor, id: string) => {
    const c = ctx.db.food.categories.find(x => x.id === id && x.businessId === v.businessId);
    if (!c) throw notFound('Category');
    return c;
  };
  const ownItem = (ctx: ShopCtx, v: MockFoodVendor, id: string) => {
    const i = ctx.db.food.items.find(x => x.id === id && x.businessId === v.businessId);
    if (!i) throw notFound('Item');
    return i;
  };
  const ownGroup = (ctx: ShopCtx, v: MockFoodVendor, id: string) => {
    const g = ctx.db.food.groups.find(x => x.id === id && x.businessId === v.businessId);
    if (!g) throw notFound('Option group');
    return g;
  };

  const windowOf = (b: Record<string, any>) => {
    const from = b.availableFrom ?? null;
    const to = b.availableTo ?? null;
    if ((from === null) !== (to === null)) throw invalid('availableFrom', 'Send both availableFrom and availableTo, or neither.');
    if (from !== null && (!HHMM.test(from) || !HHMM.test(to))) throw invalid('availableFrom', 'availableFrom must match HH:MM');
    if (from && from === to) throw invalid('availableTo', 'The window must have a length.');
    return { from, to };
  };

  // ── Categories ──
  route('GET', '/food/vendor/menu/categories', ctx => categoriesWire(ctx.db, myVendor(ctx)));

  route('POST', '/food/vendor/menu/categories', ctx => {
    const v = myVendor(ctx);
    const name = text(ctx.body.name);
    if (!between(name.length, 1, 80)) throw invalid('name', 'name must be 1 to 80 characters');
    const { from, to } = windowOf(ctx.body);
    const mine = ctx.db.food.categories.filter(c => c.businessId === v.businessId);
    const c = {
      id: nextId(ctx.db, 'mc'),
      businessId: v.businessId,
      name,
      sort: Math.max(0, ...mine.map(x => x.sort)) + 10,
      availableFrom: from,
      availableTo: to,
      isActive: ctx.body.isActive !== false,
    };
    ctx.db.food.categories.push(c);
    ctx.setStatus(201);
    return categoryWire(ctx.db, c);
  });

  route('PUT', '/food/vendor/menu/categories/reorder', ctx => {
    const v = myVendor(ctx);
    const ids: string[] = Array.isArray(ctx.body.ids) ? ctx.body.ids.map(String) : [];
    if (new Set(ids).size !== ids.filter(id => ctx.db.food.categories.some(c => c.id === id && c.businessId === v.businessId)).length) throw notFound('Category');
    ids.forEach((id, i) => {
      ctx.db.food.categories.find(c => c.id === id)!.sort = (i + 1) * 10;
    });
    return categoriesWire(ctx.db, v);
  });

  route('PATCH', '/food/vendor/menu/categories/:id', ctx => {
    const v = myVendor(ctx);
    const c = ownCategory(ctx, v, dec(ctx.params[0]));
    const b = ctx.body;
    if (b.name !== undefined) {
      if (!between(text(b.name).length, 1, 80)) throw invalid('name', 'name must be 1 to 80 characters');
      c.name = text(b.name);
    }
    if (b.availableFrom !== undefined || b.availableTo !== undefined) {
      const { from, to } = windowOf({ availableFrom: b.availableFrom ?? c.availableFrom, availableTo: b.availableTo ?? c.availableTo, ...b });
      c.availableFrom = from;
      c.availableTo = to;
    }
    if (typeof b.isActive === 'boolean') c.isActive = b.isActive;
    return categoryWire(ctx.db, c);
  });

  route('DELETE', '/food/vendor/menu/categories/:id', ctx => {
    const v = myVendor(ctx);
    const c = ownCategory(ctx, v, dec(ctx.params[0]));
    const n = ctx.db.food.items.filter(i => i.categoryId === c.id).length;
    if (n) throw new FoodError(409, 'CONFLICT', 'Move or delete this category’s items first.', { items: n });
    ctx.db.food.categories = ctx.db.food.categories.filter(x => x.id !== c.id);
    return { removed: true };
  });

  // ── Dishes ──
  const variantRows = (v: unknown) => {
    if (!Array.isArray(v)) throw invalid('variants', 'variants must be a list');
    if (v.length > 10) throw invalid('variants', 'variants must contain no more than 10 elements');
    return v.map((x: any, i: number) => {
      if (!between(text(x?.name).length, 1, 60)) throw invalid(`variants.${i}.name`, 'name must be 1 to 60 characters');
      if (!isInt(x.price) || !between(x.price, 0, 500000)) throw invalid(`variants.${i}.price`, 'price must be 0 to 500000');
      return { id: x.id ? String(x.id) : undefined, name: text(x.name), price: x.price as number };
    });
  };

  const writeVariants = (ctx: ShopCtx, item: MockMenuItem, rows: ReturnType<typeof variantRows>) => {
    if (rows.some(r => r.id && !item.variants.some(e => e.id === r.id))) throw notFound('Variant');
    const kept = new Set(rows.filter(r => r.id).map(r => r.id));
    item.links = item.links.filter(l => !l.variantId || kept.has(l.variantId));
    item.variants = rows.map((r, sort) => ({ id: r.id ?? nextId(ctx.db, 'iv'), name: r.name, price: r.price, sort }));
  };

  const itemFields = (b: Record<string, any>, creating: boolean) => {
    if (creating || b.name !== undefined) if (!between(text(b.name).length, 2, 120)) throw invalid('name', 'name must be 2 to 120 characters');
    if (b.description !== undefined && b.description !== null && text(b.description).length > 1000) throw invalid('description', 'description must be at most 1000 characters');
    if (b.photoUrl !== undefined && b.photoUrl !== null && !/^https:\/\//.test(String(b.photoUrl))) throw invalid('photoUrl', 'Upload the photo first.');
    if (creating || b.basePrice !== undefined) if (!isInt(b.basePrice) || !between(b.basePrice, 0, 500000)) throw invalid('basePrice', 'basePrice must be 0 to 500000');
    if (b.tags !== undefined) {
      if (!Array.isArray(b.tags) || b.tags.length > 5 || !b.tags.every((t: unknown) => (ITEM_TAGS as readonly unknown[]).includes(t))) {
        throw invalid('tags', `each value in tags must be one of the following values: ${ITEM_TAGS.join(', ')}`);
      }
    }
    if (b.serves !== undefined && b.serves !== null && (!isInt(b.serves) || !between(b.serves, 1, 50))) throw invalid('serves', 'serves must be 1 to 50');
  };

  route('GET', '/food/vendor/menu/items', ctx => itemsWire(ctx.db, myVendor(ctx), ctx.query.categoryId ? String(ctx.query.categoryId) : undefined));

  route('POST', '/food/vendor/menu/items', ctx => {
    const v = myVendor(ctx);
    const b = ctx.body;
    itemFields(b, true);
    const days = b.days !== undefined ? daysOf(b.days) : EVERY_DAY;
    const variants = b.variants !== undefined ? variantRows(b.variants) : [];
    assertWithinPlan(v, 'menu_items', menuItemCount(ctx.db, v.businessId) + 1);
    const category = ownCategory(ctx, v, String(b.categoryId ?? ''));
    const siblings = ctx.db.food.items.filter(i => i.categoryId === category.id);
    const item: MockMenuItem = {
      id: nextId(ctx.db, 'mi'),
      businessId: v.businessId,
      categoryId: category.id,
      name: text(b.name),
      description: text(b.description) || null,
      photoUrl: b.photoUrl ?? null,
      basePrice: b.basePrice,
      tags: [...new Set((b.tags ?? []) as MockItemTag[])],
      isDeal: b.isDeal === true,
      serves: b.serves ?? null,
      days,
      isActive: b.isActive !== false,
      sort: Math.max(0, ...siblings.map(x => x.sort)) + 10,
      sold30d: 0,
      variants: [],
      links: [],
      override: null,
    };
    writeVariants(ctx, item, variants);
    ctx.db.food.items.push(item);
    foodHooks.onItemSaved(ctx.db, item, b);
    ctx.setStatus(201);
    return itemWire(item);
  });

  route('PUT', '/food/vendor/menu/items/reorder', ctx => {
    const v = myVendor(ctx);
    const ids: string[] = Array.isArray(ctx.body.ids) ? ctx.body.ids.map(String) : [];
    if (new Set(ids).size !== ids.filter(id => ctx.db.food.items.some(i => i.id === id && i.businessId === v.businessId)).length) throw notFound('Item');
    ids.forEach((id, i) => {
      ctx.db.food.items.find(x => x.id === id)!.sort = (i + 1) * 10;
    });
    return itemsWire(ctx.db, v);
  });

  route('GET', '/food/vendor/menu/items/:id', ctx => itemWire(ownItem(ctx, myVendor(ctx), dec(ctx.params[0]))));

  route('PATCH', '/food/vendor/menu/items/:id', ctx => {
    const v = myVendor(ctx);
    const i = ownItem(ctx, v, dec(ctx.params[0]));
    const b = ctx.body;
    itemFields(b, false);
    if (b.categoryId !== undefined && b.categoryId !== i.categoryId) i.categoryId = ownCategory(ctx, v, String(b.categoryId)).id;
    if (b.name !== undefined) i.name = text(b.name);
    if (b.description !== undefined) i.description = b.description === null ? null : text(b.description) || null;
    if (b.photoUrl !== undefined) i.photoUrl = b.photoUrl;
    if (b.basePrice !== undefined) i.basePrice = b.basePrice;
    if (b.tags !== undefined) i.tags = [...new Set(b.tags as MockItemTag[])];
    if (typeof b.isDeal === 'boolean') i.isDeal = b.isDeal;
    if (b.serves !== undefined) i.serves = b.serves;
    if (b.days !== undefined) i.days = daysOf(b.days);
    if (typeof b.isActive === 'boolean') i.isActive = b.isActive;
    foodHooks.onItemSaved(ctx.db, i, b);
    return itemWire(i);
  });

  /** Orders keep their own snapshot, so a dish can always be deleted. */
  route('DELETE', '/food/vendor/menu/items/:id', ctx => {
    const v = myVendor(ctx);
    const i = ownItem(ctx, v, dec(ctx.params[0]));
    ctx.db.food.items = ctx.db.food.items.filter(x => x.id !== i.id);
    return { removed: true };
  });

  route('POST', '/food/vendor/menu/items/:id/duplicate', ctx => {
    const v = myVendor(ctx);
    const o = ownItem(ctx, v, dec(ctx.params[0]));
    assertWithinPlan(v, 'menu_items', menuItemCount(ctx.db, v.businessId) + 1);
    const siblings = ctx.db.food.items.filter(i => i.categoryId === o.categoryId);
    const variants = o.variants.map(x => ({ ...x, id: nextId(ctx.db, 'iv') }));
    const map = new Map(o.variants.map((x, i) => [x.id, variants[i].id]));
    const copy: MockMenuItem = {
      ...JSON.parse(JSON.stringify(o)),
      id: nextId(ctx.db, 'mi'),
      name: `${o.name} (copy)`.slice(0, 120),
      isActive: false,
      sort: Math.max(0, ...siblings.map(x => x.sort)) + 10,
      sold30d: 0,
      variants,
      links: o.links.map(l => ({ ...l, variantId: l.variantId ? map.get(l.variantId) ?? null : null })),
      override: null,
    };
    ctx.db.food.items.push(copy);
    ctx.setStatus(201);
    return itemWire(copy);
  });

  route('PUT', '/food/vendor/menu/items/:id/variants', ctx => {
    const v = myVendor(ctx);
    const i = ownItem(ctx, v, dec(ctx.params[0]));
    writeVariants(ctx, i, variantRows(ctx.body));
    return itemWire(i);
  });

  route('PUT', '/food/vendor/menu/items/:id/option-groups', ctx => {
    const v = myVendor(ctx);
    const i = ownItem(ctx, v, dec(ctx.params[0]));
    const links: { groupId: string; variantId?: string }[] = Array.isArray(ctx.body) ? ctx.body : [];
    for (const l of links) ownGroup(ctx, v, String(l.groupId));
    if (links.some(l => l.variantId && !i.variants.some(x => x.id === l.variantId))) throw notFound('Variant');
    const keys = links.map(l => `${l.groupId}|${l.variantId ?? ''}`);
    if (new Set(keys).size !== keys.length) throw invalid('groups', 'Each group can be linked once per variant.');
    i.links = links.map((l, sort) => ({ groupId: String(l.groupId), variantId: l.variantId ? String(l.variantId) : null, sort }));
    return itemWire(i);
  });

  // ── Add-on groups ──
  const groupRules = (b: Record<string, any>) => {
    if (!between(text(b.name).length, 1, 80)) throw invalid('name', 'name must be 1 to 80 characters');
    if (!isInt(b.minSelect) || !between(b.minSelect, 0, 20)) throw invalid('minSelect', 'minSelect must be 0 to 20');
    if (!isInt(b.maxSelect) || !between(b.maxSelect, 1, 20)) throw invalid('maxSelect', 'maxSelect must be 1 to 20');
    if (!Array.isArray(b.options) || b.options.length < 1 || b.options.length > 40) throw invalid('options', 'options must have 1 to 40 elements');
    b.options.forEach((o: any, i: number) => {
      if (!between(text(o?.name).length, 1, 80)) throw invalid(`options.${i}.name`, 'name must be 1 to 80 characters');
      if (!isInt(o.priceDelta) || !between(o.priceDelta, 0, 100000)) throw invalid(`options.${i}.priceDelta`, 'priceDelta must be 0 to 100000');
    });
    if (b.minSelect > b.maxSelect) throw invalid('minSelect', 'minSelect can’t be more than maxSelect.');
    if (b.maxSelect > b.options.length) throw invalid('maxSelect', 'maxSelect can’t be more than the number of options.');
  };

  const writeOptions = (ctx: ShopCtx, g: MockOptionGroup, rows: any[]) => {
    if (rows.some(r => r.id && !g.options.some(o => o.id === r.id))) throw notFound('Option');
    g.options = rows.map((r, sort) => {
      const was = g.options.find(o => o.id === r.id);
      return {
        id: r.id ?? nextId(ctx.db, 'op'),
        name: text(r.name),
        priceDelta: r.priceDelta,
        isDefault: r.isDefault === true,
        isActive: r.isActive !== false,
        sort,
        available: was?.available ?? true,
      };
    });
  };

  route('GET', '/food/vendor/menu/option-groups', ctx => groupsWire(ctx.db, myVendor(ctx)));

  route('POST', '/food/vendor/menu/option-groups', ctx => {
    const v = myVendor(ctx);
    groupRules(ctx.body);
    const g: MockOptionGroup = { id: nextId(ctx.db, 'og'), businessId: v.businessId, name: text(ctx.body.name), minSelect: ctx.body.minSelect, maxSelect: ctx.body.maxSelect, options: [] };
    writeOptions(ctx, g, ctx.body.options);
    ctx.db.food.groups.push(g);
    ctx.setStatus(201);
    return groupWire(ctx.db, g);
  });

  route('GET', '/food/vendor/menu/option-groups/:id', ctx => groupWire(ctx.db, ownGroup(ctx, myVendor(ctx), dec(ctx.params[0]))));

  route('PUT', '/food/vendor/menu/option-groups/:id', ctx => {
    const v = myVendor(ctx);
    const g = ownGroup(ctx, v, dec(ctx.params[0]));
    groupRules(ctx.body);
    g.name = text(ctx.body.name);
    g.minSelect = ctx.body.minSelect;
    g.maxSelect = ctx.body.maxSelect;
    writeOptions(ctx, g, ctx.body.options);
    return groupWire(ctx.db, g);
  });

  /** Removing a group takes it off every dish that offers it. */
  route('DELETE', '/food/vendor/menu/option-groups/:id', ctx => {
    const v = myVendor(ctx);
    const g = ownGroup(ctx, v, dec(ctx.params[0]));
    ctx.db.food.groups = ctx.db.food.groups.filter(x => x.id !== g.id);
    for (const i of ctx.db.food.items) i.links = i.links.filter(l => l.groupId !== g.id);
    return { removed: true };
  });

  // ── Availability (86) ──
  route('GET', '/food/vendor/availability', ctx => availabilityWire(ctx.db, myVendor(ctx), ctx.now));

  route('PATCH', '/food/vendor/availability', ctx => {
    const v = myVendor(ctx);
    const items: any[] = Array.isArray(ctx.body.items) ? ctx.body.items : [];
    const options: any[] = Array.isArray(ctx.body.options) ? ctx.body.options : [];
    const rows = items.map(x => ({ x, item: ownItem(ctx, v, String(x.itemId)) }));
    const opts = options.map(x => {
      const o = ctx.db.food.groups.filter(g => g.businessId === v.businessId).flatMap(g => g.options).find(op => op.id === String(x.optionId));
      if (!o) throw notFound('Option');
      return { x, o };
    });
    for (const { x, item } of rows) {
      if (typeof x.isAvailable !== 'boolean') throw invalid('items', 'isAvailable must be a boolean value');
      const until = x.isAvailable ? null : x.unavailableUntil ?? null;
      if (until !== null && Number.isNaN(Date.parse(until))) throw invalid('items', 'unavailableUntil must be a valid ISO 8601 date string');
      const o = overrideOf(item, v, ctx.now);
      // Off "until" a time: available after it, so it is stored switched on with the until.
      o.isAvailable = x.isAvailable || !!until;
      o.unavailableUntil = until ? isoNow(Date.parse(until)) : null;
      item.override = o;
    }
    for (const { x, o } of opts) {
      if (typeof x.isAvailable !== 'boolean') throw invalid('options', 'isAvailable must be a boolean value');
      o.available = x.isAvailable;
    }
    return availabilityWire(ctx.db, v, ctx.now);
  });

  // ── Home kitchens ──
  route('GET', '/food/vendor/today', ctx => todayWire(ctx.db, myVendor(ctx), ctx.now));

  route('PATCH', '/food/vendor/today', ctx => {
    const v = myVendor(ctx);
    const rows: any[] = Array.isArray(ctx.body.items) ? ctx.body.items : [];
    if (!rows.length) throw invalid('items', 'items must contain at least 1 elements');
    const pairs = rows.map(x => ({ x, item: ownItem(ctx, v, String(x.itemId)) }));
    for (const { x, item } of pairs) {
      const o = overrideOf(item, v, ctx.now);
      if (x.portions !== undefined) {
        if (x.portions !== null && (!isInt(x.portions) || !between(x.portions, 0, 5000))) throw invalid('portions', 'portions must be 0 to 5000');
        // Portions reset what is left today.
        o.dailyLimit = x.portions;
        o.remainingToday = x.portions;
        o.portionsDate = x.portions === null ? null : kitchenToday(v, ctx.now).date;
      }
      if (x.cooking !== undefined) {
        o.isAvailable = x.cooking === true;
        o.unavailableUntil = null;
      }
      item.override = o;
    }
    return todayWire(ctx.db, v, ctx.now);
  });

  route('GET', '/food/vendor/preorder-slots', ctx => slotsWire(ctx.db, myVendor(ctx)));

  route('PUT', '/food/vendor/preorder-slots', ctx => {
    const v = myVendor(ctx);
    if (v.kind !== 'home_kitchen') throw new FoodError(400, 'VALIDATION_FAILED', 'Pre-order slots are for home kitchens.');
    const rows: any[] = Array.isArray(ctx.body) ? ctx.body : [];
    rows.forEach((s, i) => {
      if (!isInt(s?.weekday) || !between(s.weekday, 0, 6)) throw invalid(`${i}.weekday`, 'weekday must be 0 to 6');
      if (!HHMM.test(String(s.slotStart))) throw invalid(`${i}.slotStart`, 'slotStart must match HH:MM');
      if (!isInt(s.cutoffMinutesBefore) || !between(s.cutoffMinutesBefore, 0, 2880)) throw invalid(`${i}.cutoffMinutesBefore`, 'cutoffMinutesBefore must be 0 to 2880');
      if (!isInt(s.maxOrders) || !between(s.maxOrders, 1, 500)) throw invalid(`${i}.maxOrders`, 'maxOrders must be 1 to 500');
    });
    const keys = rows.map(s => `${s.weekday}|${s.slotStart}`);
    if (new Set(keys).size !== keys.length) throw new FoodError(400, 'VALIDATION_FAILED', 'Two slots at the same time.');
    ctx.db.food.slots = [
      ...ctx.db.food.slots.filter(s => s.businessId !== v.businessId),
      ...rows.map(s => ({ id: nextId(ctx.db, 'ps'), businessId: v.businessId, weekday: s.weekday, slotStart: s.slotStart, cutoffMinutesBefore: s.cutoffMinutesBefore, maxOrders: s.maxOrders })),
    ];
    return slotsWire(ctx.db, v);
  });

  route('PUT', '/food/vendor/weekly-menu', ctx => {
    const v = myVendor(ctx);
    const rows: any[] = Array.isArray(ctx.body) ? ctx.body : [];
    const pairs = rows.map((e, i) => ({ item: ownItem(ctx, v, String(e?.itemId)), days: daysOf(e?.days, `${i}.days`) }));
    for (const { item, days } of pairs) item.days = days;
    return weeklyWire(ctx.db, v);
  });
}
