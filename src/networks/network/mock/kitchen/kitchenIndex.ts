// ═══════════════════════════════════════════════════════
// MetroMatrix — The dummy Kitchen Intelligence API (Chunk 5, assumed)
// ═══════════════════════════════════════════════════════
// Registers the kitchen's routes on the Food route wrapper and plugs its
// rules into Food through foodHooks: stock out on accept, a dish sold out
// when its recipe can't be made, the packing photo before "ready", the
// pause's private reason and its auto-resume, where an order came from,
// tiffin days made into scheduled orders, a kitchen's tiffin plans and
// catering on its page. Everything it adds to a Food shape is listed in
// foodAdditions.ts.
// TODO(API_KITCHEN): docs/API_KITCHEN_ASSUMED.md, docs/AI_ASSUMED.md, docs/VOICE_ASSUMED.md.

import type { MockDb } from '../mockDb';
import type { MockFoodOrder, MockFoodVendor } from '../food/foodTypes';
import { installFoodHooks } from '../food/foodHooks';
import type { FoodRouteKit } from '../food/foodRoutes';
import type { ShopKit } from '../shop/shopRoutes';
import { HOUR, afterMove, beforeMove, invalid, isoNow, itemBlocked, k, orderKitchenOf } from './kitchenLogic';
import { registerKitchenRoutes } from './kitchenRoutes';
import { registerSurplusRoutes, settleSurplus } from './surplusRoutes';
import { planCardWire, registerTiffinRoutes } from './tiffinRoutes';
import { settleTiffin } from './tiffinLogic';
import { cateringSettingsOf, registerCateringRoutes } from './cateringRoutes';
import { addCardSource } from './insightCards';
import { formatPKR } from '../../../../utils/money';
import type { MockPauseInfo } from './kitchenTypes';

export const PAUSE_REASONS: NonNullable<MockPauseInfo['reason']>[] = ['gas', 'electricity', 'weather', 'staff', 'stock', 'other'];
/** A pause lifts by itself at most this far ahead. */
export const MAX_PAUSE_MS = 12 * HOUR;

const pauseOf = (db: MockDb, businessId: string) => db.kitchen?.pauses.find(p => p.businessId === businessId) ?? null;

const onPause = (db: MockDb, v: MockFoodVendor, body: Record<string, unknown>, now: number) => {
  if (!db.kitchen) return;
  const reason = body.reason ?? null;
  if (reason !== null && !PAUSE_REASONS.includes(reason as never)) throw invalid('reason', `reason must be one of ${PAUSE_REASONS.join(', ')}`);
  let resumeAt: string | null = null;
  if (body.resumeAt !== undefined && body.resumeAt !== null) {
    const at = Date.parse(String(body.resumeAt));
    if (!Number.isFinite(at) || at <= now || at - now > MAX_PAUSE_MS) throw invalid('resumeAt', 'Pick a time within the next 12 hours.');
    resumeAt = isoNow(at);
  }
  const all = k(db).pauses;
  const at = all.findIndex(p => p.businessId === v.businessId);
  const row: MockPauseInfo = { businessId: v.businessId, reason: (reason as MockPauseInfo['reason']) ?? null, resumeAt };
  if (at >= 0) all[at] = row;
  else all.push(row);
};

const onResume = (db: MockDb, v: MockFoodVendor) => {
  if (!db.kitchen) return;
  k(db).pauses = k(db).pauses.filter(p => p.businessId !== v.businessId);
};

/** The kitchen's minute jobs: a pause ends at its time; Bachat Box payments lapse and no-shows are marked. */
const settle = (db: MockDb, now: number): MockFoodOrder[] => {
  if (!db.kitchen) return [];
  for (const p of [...k(db).pauses]) {
    if (!p.resumeAt || Date.parse(p.resumeAt) > now) continue;
    const v = db.food.vendors.find(x => x.businessId === p.businessId);
    if (v) {
      v.isPaused = false;
      v.pauseMessage = null;
    }
    k(db).pauses = k(db).pauses.filter(x => x !== p);
  }
  settleSurplus(db, now);
  // Tiffin days past their cut-off become orders on the board.
  return settleTiffin(db, now);
};

/** The vendor page: tiffin plans on offer, and whether it takes catering (with its limits). */
const pageExtras = (db: MockDb, v: MockFoodVendor) => {
  if (!db.kitchen) return {};
  const c = cateringSettingsOf(db, v.businessId);
  return {
    tiffinPlans: k(db).tiffinPlans.filter(p => p.businessId === v.businessId && p.isActive).map(p => planCardWire(db, p)),
    catering: { open: c.open, minGuests: c.minGuests, leadDays: c.leadDays },
  };
};

const orderExtras = (db: MockDb, o: MockFoodOrder) => {
  const row = db.kitchen?.orders.find(x => x.orderId === o.id);
  return { packedPhotoUrl: row?.packedPhotoUrl ?? null, origin: row?.origin ?? { kind: 'app', ref: null } };
};

let installed = false;

export function registerKitchen(food: FoodRouteKit, kit: Pick<ShopKit, 'requireUser' | 'optionalUser' | 'requireAdmin'>) {
  if (!installed) {
    installed = true;
    // Tiffin requests to answer, and new catering requests (5B).
    addCardSource((db, businessId) => {
      const pending = (k(db).tiffinSubs ?? []).filter(x => x.businessId === businessId && x.status === 'pending');
      const fresh = (k(db).catering ?? []).filter(x => x.businessId === businessId && x.status === 'requested');
      return [
        ...(pending.length
          ? [
              {
                id: `tiffin_pending:${pending.map(x => x.code).join(',')}`,
                kind: 'tiffin_pending',
                severity: 'warning' as const,
                title: pending.length === 1 ? 'A tiffin request to answer' : `${pending.length} tiffin requests to answer`,
                why: 'Approve to start their deliveries, or decline with a reason.',
                action: { kind: 'open_tiffin' as const, label: 'See the requests', params: { status: 'pending' } },
              },
            ]
          : []),
        ...fresh.slice(0, 2).map(r => ({
          id: `catering_new:${r.code}`,
          kind: 'catering_new',
          severity: 'info' as const,
          title: `Catering request: ${r.guests} guests on ${r.date}`,
          why: r.budget ? `Budget about ${formatPKR(r.budget)}. Send a quote while they are deciding.` : 'Send a quote while they are deciding.',
          action: { kind: 'open_catering' as const, label: 'Send a quote', params: { code: r.code } },
        })),
      ];
    });
    installFoodHooks({
      itemBlocked: (db, v, i) => itemBlocked(db, v, i),
      beforeMove: (db, o, to) => beforeMove(db, o, to),
      afterMove: (db, o, from, to, _actor, now) => afterMove(db, o, from, to, now),
      onPlaced: (db, o, body) => {
        if (!db.kitchen) return;
        const src = body.source as { kind?: unknown; slug?: unknown } | undefined;
        if (src && (src.kind === 'link' || src.kind === 'qr')) orderKitchenOf(db, o.id).origin = { kind: src.kind, ref: typeof src.slug === 'string' ? src.slug : null };
      },
      orderExtras: (db, o) => orderExtras(db, o),
      boardExtras: (db, o) => orderExtras(db, o),
      onPause,
      onResume,
      branchExtras: (db, v) => {
        const p = v.isPaused ? pauseOf(db, v.businessId) : null;
        return { pauseReason: p?.reason ?? null, resumeAt: p?.resumeAt ?? null };
      },
      pageExtras: (db, v) => pageExtras(db, v),
      settle,
    });
  }
  const deps = { route: food.route, myVendor: food.myVendor, ...kit };
  registerKitchenRoutes(deps);
  registerSurplusRoutes(deps);
  registerTiffinRoutes(deps);
  registerCateringRoutes(deps);
}
