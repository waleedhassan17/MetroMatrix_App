// ═══════════════════════════════════════════════════════
// MetroMatrix — The board's kitchen side, in plain words
// ═══════════════════════════════════════════════════════
// What stock says about a ticket ("Recipe stock low: Karahi, 2 left"), the
// time to quote when accepting (the usual prep time now, snapped to a
// chip), whether "Ready" waits for a packing photo, and a pause's private
// reason with when it lifts. Pure: the board screen renders what this says.

import type { BoardCard, VendorBranch } from '../food';
import type { BoardHints, PauseReason } from '../kitchen';
import { ETA_CHOICES } from '../food/foodStatusModel';
import { PAUSE_REASON_LABEL } from './kitchenStatusModel';
import { addDays, dateInZone, formatDayShort, formatSlot } from '../../utils/health-time/healthTime';

/** Fewer servings than this left of a dish's recipe: the ticket says so. */
export const LOW_SERVINGS = 3;

const inTicket = (card: Pick<BoardCard, 'itemsSummary'>, name: string) => card.itemsSummary.split(', ').some(part => part.replace(/^\d+×\s*/, '') === name);

/** A note on a ticket from stock, or null. */
export const ticketStockNote = (card: Pick<BoardCard, 'itemsSummary' | 'status'>, hints: BoardHints | null): { label: string; tone: 'warning' | 'danger' } | null => {
  if (!hints || !['placed', 'accepted', 'preparing'].includes(card.status)) return null;
  const out = hints.soldOutByStock.filter(i => inTicket(card, i.name));
  if (out.length) return { label: `Out of stock (ingredients): ${out.map(i => i.name).join(', ')}`, tone: 'danger' };
  const low = hints.lowStock.filter(i => i.servingsLeft < LOW_SERVINGS && inTicket(card, i.name));
  if (low.length) return { label: `Recipe stock low: ${low.map(i => `${i.name}, ${i.servingsLeft} left`).join(' · ')}`, tone: 'warning' };
  return null;
};

const snap = (minutes: number) => ETA_CHOICES.reduce((best, m) => (Math.abs(m - minutes) < Math.abs(best - minutes) ? m : best), ETA_CHOICES[0]);

/** The time quoted at checkout, snapped to the nearest chip. */
export const quotedEta = (c: Pick<BoardCard, 'promisedAt' | 'placedAt'>) => snap(c.promisedAt ? Math.round((Date.parse(c.promisedAt) - Date.parse(c.placedAt)) / 60_000) : 30);

/** The chip to offer first: the kitchen's usual prep time right now if it is known, else the quoted time. */
export const suggestedEta = (c: Pick<BoardCard, 'promisedAt' | 'placedAt'>, hints: BoardHints | null) => (hints?.prepHint ? snap(hints.prepHint.minutes) : quotedEta(c));

/** "Ready" waits for a packing photo on this ticket. */
export const needsPackingPhoto = (c: Pick<BoardCard, 'packedPhotoUrl'>, rule: BoardHints['packingPhoto'] | null | undefined) => rule === 'required' && !c.packedPhotoUrl;

/** When a pause of `minutes` lifts (null: until the kitchen resumes). */
export const resumeAtOf = (minutes: number | null, now: number) => (minutes === null ? null : new Date(now + minutes * 60_000).toISOString());

/** The kitchen's own line for a pause: "Gas · back by itself at 9:30 PM". Customers never see the reason. */
export const pauseLine = (b: Pick<VendorBranch, 'pauseReason' | 'resumeAt'>, timezone: string) => {
  const why = b.pauseReason ? PAUSE_REASON_LABEL[b.pauseReason as PauseReason] : null;
  const when = b.resumeAt ? `back by itself at ${formatSlot(b.resumeAt, timezone)}` : 'until you resume';
  return why ? `${why} · ${when}` : when.charAt(0).toUpperCase() + when.slice(1);
};

/** A dish's line in the kitchen's menu from stock, or null. */
export const menuStockNote = (itemId: string, hints: BoardHints | null): string | null => {
  if (!hints) return null;
  if (hints.soldOutByStock.some(i => i.itemId === itemId)) return 'Out of stock (ingredients): a purchase brings it back';
  const low = hints.lowStock.find(i => i.itemId === itemId && i.servingsLeft < LOW_SERVINGS);
  return low ? `Recipe stock low: ${low.servingsLeft} left` : null;
};

/** The paused board's whole note: why, when it lifts, and what customers see. */
export const pausedNote = (b: Pick<VendorBranch, 'pauseReason' | 'resumeAt' | 'pauseMessage'>, timezone: string) => {
  const seen = b.pauseMessage ? `Customers see: “${b.pauseMessage}”` : b.resumeAt ? 'Until then, your kitchen is hidden from lists.' : 'Your kitchen is hidden from lists until you resume.';
  return `${pauseLine(b, timezone)}. ${seen}`;
};

/** "For 12:30 PM" today, "For tomorrow, 12:30 PM", "For Fri 16 Oct, 12:30 PM". */
export const scheduledLabel = (iso: string, now: number, timezone: string) => {
  const day = dateInZone(iso, timezone);
  const today = dateInZone(new Date(now).toISOString(), timezone);
  const time = formatSlot(iso, timezone);
  return day === today ? `For ${time}` : day === addDays(today, 1) ? `For tomorrow, ${time}` : `For ${formatDayShort(day)}, ${time}`;
};

/** Where an order came from, when it isn't the app: "Tiffin TF-2UPUXR", "Catering", "From your link". */
export const originLabel = (o: Pick<BoardCard, 'origin'>) =>
  o.origin.kind === 'tiffin' ? `Tiffin${o.origin.ref ? ` ${o.origin.ref}` : ''}` : o.origin.kind === 'catering' ? 'Catering' : o.origin.kind === 'link' ? 'From your link' : o.origin.kind === 'qr' ? 'From your QR' : null;
