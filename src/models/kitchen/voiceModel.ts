// ═══════════════════════════════════════════════════════
// MetroMatrix — Voice: what a proposed action says before it is confirmed
// ═══════════════════════════════════════════════════════
// Every voice result is a draft: the card says in plain words what will
// happen ("Accept order FC-NBNWXT · ready in 20 min"), and nothing happens
// until the cook taps Confirm. Below CONFIDENT the card asks "Did you mean…".

import type { VoiceAction, VoiceContext, VoiceLanguage, VoiceResult } from '../../types/kitchen';
import { formatIn } from '../../utils/units';
import { formatPKR } from '../../utils/money';
import { rejectReasonLabel } from '../food/foodStatusModel';
import { WASTE_REASON_LABEL } from './kitchenStatusModel';

/** Under this, the card offers the alternatives first. */
export const CONFIDENT = 0.7;
/** The longest clip, and when the ring warns. */
export const MAX_CLIP_MS = 30_000;
export const WARN_CLIP_MS = 25_000;

export const LANGUAGE_CHOICES: { key: VoiceLanguage; label: string }[] = [
  { key: 'ur', label: 'Urdu' },
  { key: 'en', label: 'English' },
  { key: 'auto', label: 'Auto' },
];

/** What to say into the mic, per context (one example each). */
export const VOICE_HINTS: Record<VoiceContext, string> = {
  board: 'Try “pehla order accept karo, 20 minute”',
  stock: 'Try “5 kilo tamatar 1200 rupay”',
  purchases: 'Try “dhai kilo murghi 1550 rupay”',
  today: 'Try “aaj 20 qorma”',
  search: 'Say a dish or a kitchen',
  pantry: 'Try “do kilo aloo, expiry agle hafte”',
};

const lines = (xs: { qty: number; unit: Parameters<typeof formatIn>[1]; name: string }[]) => xs.map(l => `${formatIn(l.qty, l.unit)} ${l.name.toLowerCase()}`).join(', ');

/** The action in plain words, as the confirm card's title. */
export const actionTitle = (a: VoiceAction): string => {
  switch (a.kind) {
    case 'order.accept':
      return `Accept order ${a.code}${a.etaMinutes ? ` · ready in ${a.etaMinutes} min` : ''}`;
    case 'order.reject':
      return `Decline order ${a.code} · ${rejectReasonLabel(a.reason).toLowerCase()}`;
    case 'order.ready':
      return `Mark order ${a.code} ready`;
    case 'item.unavailable':
      return `Mark ${a.name} as finished for now`;
    case 'vendor.busy':
      return `Add ${a.extraMinutes} min to every order`;
    case 'purchase.add': {
      const total = a.lines.reduce((n, l) => n + (l.total ?? 0), 0);
      return `Add a purchase: ${lines(a.lines)}${total ? ` · ${formatPKR(total)}` : ''}`;
    }
    case 'waste.log':
      return `Log waste: ${lines(a.lines)} · ${WASTE_REASON_LABEL[a.reason].toLowerCase()}`;
    case 'stock.count':
      return `Set stock: ${lines(a.lines)}`;
    case 'portions.set':
      return `Today: ${a.lines.map(l => `${l.portions} ${l.name.toLowerCase()}`).join(', ')}`;
    case 'search':
      return `Search for “${a.query}”`;
    case 'pantry.add':
      return `Add to your pantry: ${lines(a.lines)}`;
  }
};

/** Lines the cook should look at before confirming (an unknown name, a missing price). */
export const actionWarnings = (a: VoiceAction): string[] => {
  const out: string[] = [];
  if (a.kind === 'purchase.add' || a.kind === 'waste.log' || a.kind === 'stock.count') {
    for (const l of a.lines) if (!l.ingredientId) out.push(`${l.name} isn’t in your stock yet. Confirming adds it.`);
    if (a.kind === 'purchase.add' && a.lines.some(l => l.total === null)) out.push('Add what it cost before saving.');
  }
  return out;
};

/** The result shows "Did you mean…" first when unsure, or when it heard nothing it could act on. */
export const isUnsure = (r: VoiceResult) => !r.action || r.confidence < CONFIDENT;

/** Seconds left on a recording, for the ring's spoken label. */
export const secondsLeft = (elapsedMs: number) => Math.max(0, Math.ceil((MAX_CLIP_MS - elapsedMs) / 1000));
