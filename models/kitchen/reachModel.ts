// ═══════════════════════════════════════════════════════
// MetroMatrix — Reaching customers (5B) in plain words, and their forms
// ═══════════════════════════════════════════════════════
// Ramadan mode (why the switch is off outside the month), the storefront's
// "Orders you brought", demand in a sentence, a menu test's rules and its
// result, the kitchen's story and hygiene checklist, batching ("Drop 1 of
// 2"). Checked against the API's rules (§3.11–3.13) before they are sent.

import type { BatchSuggestion, Experiment, Hygiene, KitchenStory, MenuInsightItem, RamadanSettings, StoreSource, Storefront } from '../kitchen';
import type { ValidationErrors } from '../authModel';
import { formatDayShort } from '../../utils/health-time/healthTime';
import { formatPKR, parseRupees } from '../../utils/money/money';
import { timeLabel } from './cateringModel';

// ── Ramadan ──
/** Whether the switch can move, and if not, why (QA 32). */
export const ramadanSwitch = (r: Pick<RamadanSettings, 'state' | 'event' | 'opensOn'>): { disabled: boolean; reason: string | null } => {
  if (r.state === 'active' || r.state === 'upcoming') return { disabled: false, reason: null };
  if (!r.event) return { disabled: true, reason: 'No Ramadan dates are set yet. MetroMatrix adds them each year.' };
  return {
    disabled: true,
    reason: `Ramadan mode opens on ${formatDayShort(r.opensOn ?? r.event.startsOn)}, a month before the first fast (${formatDayShort(r.event.startsOn)}).`,
  };
};

export const ramadanDatesLine = (r: Pick<RamadanSettings, 'event'>) => (r.event ? `${r.event.name}: ${formatDayShort(r.event.startsOn)} to ${formatDayShort(r.event.endsOn)}` : null);

/** Half-hour steps across the night for sehri, and the evening for iftar. */
const steps = (fromMin: number, toMin: number) =>
  Array.from({ length: Math.floor((toMin - fromMin) / 30) + 1 }, (_, n) => {
    const m = fromMin + n * 30;
    return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
  });
export const SEHRI_TIMES = steps(0, 6 * 60);
export const IFTAR_TIMES = steps(16 * 60, 21 * 60);

export const windowText = (w: { from: string; to: string }) => `${timeLabel(w.from)} – ${timeLabel(w.to)}`;

export const validateRamadanWindows = (f: { sehri: { from: string; to: string }; iftar: { from: string; to: string } }): ValidationErrors => {
  const errors: ValidationErrors = {};
  if (!(f.sehri.from < f.sehri.to)) errors.sehri = 'Sehri ends after it starts';
  if (!(f.iftar.from < f.iftar.to)) errors.iftar = 'Iftar ends after it starts';
  return errors;
};

// ── Storefront ──
/** "Orders you brought": the ones through the kitchen's own link or QR (QA 34). */
export const broughtCount = (s: Pick<Storefront, 'stats'>) => s.stats.link + s.stats.qr;

export const storefrontStatLines = (s: Pick<Storefront, 'stats'>) => [
  { key: 'link', label: 'Through your link', value: s.stats.link },
  { key: 'qr', label: 'From your QR code', value: s.stats.qr },
  { key: 'tiffin', label: 'Tiffin deliveries', value: s.stats.tiffin },
  { key: 'app', label: 'Found you in the app', value: s.stats.app },
];

/** A link or QR counts for an order from that kitchen within a week of the visit. */
export const STORE_SOURCE_DAYS = 7;

export const storeSourceFor = (saved: (StoreSource & { at: number }) | null, vendorSlug: string | null | undefined, now: number): StoreSource | null =>
  saved && vendorSlug && saved.slug === vendorSlug && now - saved.at <= STORE_SOURCE_DAYS * 86_400_000 ? { kind: saved.kind, slug: saved.slug } : null;

/** A signed-out visit whose kitchen page hasn't opened yet, from the last hour (opened after sign-in). */
export const storeToOpen = (saved: (StoreSource & { at: number; opened?: boolean }) | null, now: number) =>
  saved && !saved.opened && now - saved.at <= 3_600_000 ? saved.slug : null;

/** "metromatrix.app/s/biryani-bazaar" for print and small spaces. */
export const shortUrl = (url: string) => url.replace(/^https?:\/\//, '');

// ── Demand ──
export const hourLabel = (h: number) => `${((h + 11) % 12) + 1} ${h < 12 ? 'AM' : 'PM'}`;

export const HOUR_CHOICES: { hour: number | null; label: string }[] = [
  { hour: null, label: 'All day' },
  { hour: 8, label: 'Breakfast' },
  { hour: 13, label: 'Lunch' },
  { hour: 17, label: 'Evening' },
  { hour: 20, label: 'Dinner' },
  { hour: 23, label: 'Late night' },
];

export const pct = (share: number) => `${Math.round(share * 100)}%`;

/** "“sushi” · 116 searches, 91% found nothing open · most at 10 PM". */
export const unmetLine = (x: { query: string; searches: number; unmetShare: number; hour: number }) =>
  `${x.searches} searches, ${pct(x.unmetShare)} found nothing open · most at ${hourLabel(x.hour)}`;

/** The hour the area searches most that the kitchen's own orders don't match. */
export const busiestGap = (curve: { area: number[]; own: number[] }) => {
  let best = -1;
  let gap = 0.25;
  curve.area.forEach((a, h) => {
    const g = a - (curve.own[h] ?? 0);
    if (g > gap) {
      gap = g;
      best = h;
    }
  });
  return best < 0 ? null : best;
};

// ── Menu insights and experiments ──
export const EXPERIMENT_DAY_CHOICES = [3, 7, 14];
export const PRICE_RANGE = 0.4;

export const priceBounds = (price: number) => ({ min: Math.ceil(price * (1 - PRICE_RANGE)), max: Math.floor(price * (1 + PRICE_RANGE)) });

export const canTestPrice = (i: Pick<MenuInsightItem, 'hasSizes' | 'experimentRunning'>) => !i.hasSizes && !i.experimentRunning;

export const validateTestPrice = (raw: string, current: number): string | null => {
  const p = parseRupees(raw);
  const { min, max } = priceBounds(current);
  if (p === null) return 'A price in whole rupees';
  if (p === current) return `That is today’s price (${formatPKR(current)})`;
  if (p < min || p > max) return `Between ${formatPKR(min)} and ${formatPKR(max)}`;
  return null;
};

/** "Orders a day 7 → 7.3 · Recorded sales a day Rs 6,300 → Rs 7,227". */
export const resultLines = (e: Pick<Experiment, 'result' | 'change'>) => {
  if (!e.result) return [];
  const { before, during } = e.result;
  const n = (x: number) => (Number.isInteger(x) ? String(x) : x.toFixed(1));
  return [
    { label: 'Orders a day', before: n(before.perDay), during: n(during.perDay) },
    { label: 'Recorded sales a day', before: formatPKR(before.salesPerDay), during: formatPKR(during.salesPerDay) },
  ];
};

export const changeLine = (e: Pick<Experiment, 'change'>) =>
  e.change.kind === 'price' ? `${formatPKR(e.change.oldPrice)} → ${formatPKR(e.change.price)}` : 'A new photo';

export const progressLine = (e: Pick<Experiment, 'progress' | 'endsAt'>) =>
  e.progress.daysIn >= e.progress.days ? 'Finished' : `Day ${Math.max(1, e.progress.daysIn)} of ${e.progress.days}`;

// ── Story ──
export const STORY_MIN = 20;
export const STORY_MAX = 600;
export const MAX_STORY_PHOTOS = 6;

export const validateStory = (s: Pick<KitchenStory, 'text' | 'cookName' | 'photoUrls'>): ValidationErrors => {
  const errors: ValidationErrors = {};
  const t = s.text.trim().length;
  if (t < STORY_MIN) errors.text = `Tell it in at least ${STORY_MIN} characters`;
  else if (t > STORY_MAX) errors.text = `Up to ${STORY_MAX} characters`;
  const c = s.cookName.trim().length;
  if (c < 2 || c > 60) errors.cookName = 'Who cooks? 2 to 60 characters';
  if (s.photoUrls.length > MAX_STORY_PHOTOS) errors.photoUrls = `Up to ${MAX_STORY_PHOTOS} photos`;
  return errors;
};

// ── Hygiene ──
export const hygieneProgress = (h: Pick<Hygiene, 'items'>) => ({ done: h.items.filter(i => i.done).length, of: h.items.length });

/** Why "Request verification" is unavailable, or null when it can be sent. */
export const requestBlocker = (h: Pick<Hygiene, 'status' | 'items' | 'canRequest'>) => {
  if (h.status === 'pending') return 'Staff are looking at it. You’ll hear back here.';
  if (h.status === 'verified') return null;
  const left = h.items.filter(i => !i.done).length;
  if (left) return `Tick ${left === 1 ? 'the last item' : `the ${left} items left`} first.`;
  return h.canRequest ? null : 'Not available right now.';
};

// ── Batching ──
/** "Same way · 0.4 km further" or "0.9 km away". */
export const batchLine = (b: Pick<BatchSuggestion, 'extraKm' | 'sameDirection'>) =>
  `${b.sameDirection ? 'Same way · ' : ''}${b.extraKm < 0.1 ? 'next door' : `${b.extraKm.toFixed(1)} km from this drop`}`;

export const dropOrderLabel = (d: { position: number; of: number } | null) => (d ? `Drop ${d.position} of ${d.of}` : null);
