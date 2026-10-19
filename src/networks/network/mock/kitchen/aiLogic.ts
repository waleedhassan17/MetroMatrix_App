// ═══════════════════════════════════════════════════════
// MetroMatrix — Dummy assistant switch, quotas and usage
// ═══════════════════════════════════════════════════════
// Every assistant action (a draft description, a scanned receipt, a
// packing check, recipe ideas) counts against a monthly limit — 300 for a
// kitchen on the Community plan, 30 for a customer — that staff can
// change; voice clips have their own daily cap. With the assistant off, or
// the limit used, the API answers 503 AI_UNAVAILABLE or 429
// AI_QUOTA_REACHED and the app shows the manual way inline. Never fatal.
// TODO(API_AI): docs/AI_ASSUMED.md §2.

import type { MockDb } from '../mockDb';
import { addDays, zonedToIso } from '../../../../utils/healthTime';
import { KitchenError, isoNow, nextId } from './kitchenLogic';
import { dateInZone } from '../../../../utils/healthTime';

const TZ = 'Asia/Karachi';
export const VENDOR_MONTHLY_ACTIONS = 300;
export const CUSTOMER_MONTHLY_ACTIONS = 30;
export const VOICE_DAILY_CLIPS = 200;

export type AiFeature =
  | 'voice'
  | 'receipt_scan'
  | 'packing_check'
  | 'descriptions'
  | 'specials'
  | 'combos'
  | 'photo_check'
  | 'review_insights'
  | 'nutrition_estimate'
  | 'recipe_suggestions';

export const AI_FEATURES: AiFeature[] = ['voice', 'receipt_scan', 'packing_check', 'descriptions', 'specials', 'combos', 'photo_check', 'review_insights', 'nutrition_estimate', 'recipe_suggestions'];

const monthOf = (now: number) => dateInZone(isoNow(now), TZ).slice(0, 7);
const dayOf = (now: number) => dateInZone(isoNow(now), TZ);
const nextMonthStart = (now: number) => {
  const [y, m] = monthOf(now).split('-').map(Number);
  const next = m === 12 ? `${y + 1}-01-01` : `${y}-${String(m + 1).padStart(2, '0')}-01`;
  return zonedToIso(next, '00:00', TZ);
};

export const limitOf = (db: MockDb, ownerId: string, kind: 'vendor' | 'customer') =>
  db.kitchen.aiLimits[ownerId] ?? (kind === 'vendor' ? VENDOR_MONTHLY_ACTIONS : CUSTOMER_MONTHLY_ACTIONS);

const usedThisMonth = (db: MockDb, ownerId: string, now: number) => {
  const month = monthOf(now);
  return db.kitchen.aiUses.filter(u => u.ownerId === ownerId && u.ok && u.feature !== 'voice' && dateInZone(u.at, TZ).startsWith(month)).length;
};

const voiceToday = (db: MockDb, ownerId: string, now: number) => {
  const day = dayOf(now);
  return db.kitchen.aiUses.filter(u => u.ownerId === ownerId && u.ok && u.feature === 'voice' && dateInZone(u.at, TZ) === day).length;
};

export const usageWire = (db: MockDb, ownerId: string, kind: 'vendor' | 'customer', now: number) => {
  const limit = limitOf(db, ownerId, kind);
  const used = usedThisMonth(db, ownerId, now);
  const clips = voiceToday(db, ownerId, now);
  return {
    enabled: db.kitchen.aiEnabled,
    limit,
    used,
    left: Math.max(0, limit - used),
    resetsAt: nextMonthStart(now),
    voice: { limit: VOICE_DAILY_CLIPS, used: clips, left: Math.max(0, VOICE_DAILY_CLIPS - clips), resetsAt: zonedToIso(addDays(dayOf(now), 1), '00:00', TZ) },
  };
};

/** Refuses when the assistant is off or this owner's limit is used; else lets the action run. */
export const aiGate = (db: MockDb, ownerId: string, kind: 'vendor' | 'customer', feature: AiFeature, now: number) => {
  if (!db.kitchen.aiEnabled) {
    throw new KitchenError(503, 'AI_UNAVAILABLE', 'The assistant is off right now. You can do this by hand below.', { feature });
  }
  const u = usageWire(db, ownerId, kind, now);
  if (feature === 'voice' && u.voice.left <= 0) {
    throw new KitchenError(429, 'AI_QUOTA_REACHED', 'You have used today’s voice entries. Type it instead, or try again tomorrow.', {
      feature,
      limit: u.voice.limit,
      used: u.voice.used,
      resetsAt: u.voice.resetsAt,
    });
  }
  if (feature !== 'voice' && u.left <= 0) {
    throw new KitchenError(429, 'AI_QUOTA_REACHED', 'You have used this month’s assistant actions. You can still do this by hand.', {
      feature,
      limit: u.limit,
      used: u.used,
      resetsAt: u.resetsAt,
    });
  }
};

/** Counts one action (the staff console reads `ms` and failures). */
export const recordAiUse = (db: MockDb, ownerId: string, feature: AiFeature, now: number, ok = true, ms = 900) => {
  db.kitchen.aiUses.push({ ownerId, feature, at: isoNow(now), ok, ms });
  // Keep the dummy database small: the last 2,000 uses.
  if (db.kitchen.aiUses.length > 2000) db.kitchen.aiUses.splice(0, db.kitchen.aiUses.length - 2000);
};

export { nextId };
