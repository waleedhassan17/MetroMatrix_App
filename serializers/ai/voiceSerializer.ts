// MetroMatrix — The voice result: what was heard and the one action it proposes.
// docs/VOICE.md: `intent` and `slots` say what was understood; `proposedAction` is the exact
// request to send once the cook confirms, and `draft` the lines it read. An intent the app
// can't show (or one without what it needs) is dropped, so the card falls back to the
// API's note or the manual way.

import type { VoiceAction, VoiceQtyLine, VoiceRequest, VoiceResult } from '../../models/kitchen';
import { arr, isObject, num, oneOf, str, strOrNull, fromResponse } from '../serializerUtils';
import { WASTE_REASONS } from '../kitchen/wasteSerializer';
import { dateOrNull, list, standardUnit } from '../kitchen/kitchenCommon';

const METHODS = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'] as const;

const requestOf = (raw: unknown): VoiceRequest | null =>
  isObject(raw) && str(raw.path).startsWith('/')
    ? { method: oneOf(str(raw.method).toUpperCase(), METHODS, 'POST'), path: str(raw.path), body: raw.body ?? null, summary: str(raw.summary) }
    : null;

/** A line the API read: matched to an ingredient (`ok`), or a name the kitchen doesn't stock yet. */
const qtyLine = (raw: unknown): VoiceQtyLine | null => {
  if (!isObject(raw) || !(str(raw.name) || str(raw.spoken)) || !(num(raw.qty) > 0)) return null;
  const ok = raw.status === undefined || raw.status === 'ok';
  return {
    ingredientId: ok ? strOrNull(raw.ingredientId) : null,
    key: strOrNull(raw.suggestedName),
    name: ok ? str(raw.name) || str(raw.spoken) : str(raw.suggestedName) || str(raw.spoken) || str(raw.name),
    qty: num(raw.qty),
    unit: standardUnit(raw.unit === 'piece' ? 'pc' : raw.unit),
    total: raw.totalPrice === null || raw.totalPrice === undefined ? null : Math.max(0, Math.round(num(raw.totalPrice))),
  };
};

const draftLines = (raw: Record<string, unknown>) => list(isObject(raw.draft) ? raw.draft.lines : [], qtyLine);

/** `/food/vendor/orders/{id}/accept` → the order id. */
const orderIdOf = (r: VoiceRequest | null) => r?.path.match(/^\/food\/vendor\/orders\/([^/]+)\//)?.[1] ?? null;
/** "Accept 7KQ2PX (…)" → the order's code. */
const codeOf = (r: VoiceRequest | null) => r?.summary.match(/^(?:Accept|Reject|Mark) (\S+)/)?.[1] ?? r?.summary.match(/^(\S+) isn’t being prepared/)?.[1] ?? '';

const actionOf = (raw: Record<string, unknown>, request: VoiceRequest | null): VoiceAction | null => {
  const slots = isObject(raw.slots) ? raw.slots : {};
  const body = request && isObject(request.body) ? request.body : {};
  const orderId = orderIdOf(request);
  const code = codeOf(request);
  const action = ((): VoiceAction | null => {
    switch (raw.intent) {
      case 'accept':
        return orderId ? { kind: 'order.accept', orderId, code, etaMinutes: num(slots.etaMinutes) > 0 ? Math.round(num(slots.etaMinutes)) : null } : null;
      case 'reject':
        return orderId ? { kind: 'order.reject', orderId, code, reason: str(body.reason, 'too_busy') } : null;
      case 'mark_ready':
        return orderId ? { kind: 'order.ready', orderId, code } : null;
      case 'mark_unavailable': {
        const item = arr(body.items).find(isObject);
        return item && str(item.itemId) ? { kind: 'item.unavailable', itemId: str(item.itemId), name: request?.summary.match(/^Mark (.+) sold out$/)?.[1] ?? str(slots.dish) } : null;
      }
      case 'busy':
        return num(body.extraMinutes) > 0 ? { kind: 'vendor.busy', extraMinutes: Math.round(num(body.extraMinutes)) } : null;
      case 'add_purchase': {
        const lines = draftLines(raw);
        return lines.length ? { kind: 'purchase.add', lines } : null;
      }
      case 'count': {
        const lines = draftLines(raw);
        return lines.length ? { kind: 'stock.count', lines } : null;
      }
      case 'log_waste': {
        const lines = draftLines(raw);
        return lines.length ? { kind: 'waste.log', reason: oneOf(slots.reason, WASTE_REASONS, 'other'), lines } : null;
      }
      case 'set_portions':
      case 'cooking_today': {
        const name = request?.summary.match(/^(.+?): /)?.[1] ?? str(slots.dish);
        const lines = list(body.items, l => (isObject(l) && str(l.itemId) && l.portions !== undefined ? { itemId: str(l.itemId), name, portions: Math.max(0, Math.round(num(l.portions))) } : null));
        return lines.length ? { kind: 'portions.set', lines } : null;
      }
      case 'search':
        return str(slots.query).trim() ? { kind: 'search', query: str(slots.query).trim() } : null;
      case 'add_pantry': {
        const lines = list(body.items ?? raw.draft, l =>
          isObject(l) && str(l.name) && num(l.qty) > 0 ? { key: str(l.name), name: str(l.name), qty: num(l.qty), unit: standardUnit(l.unit === 'piece' ? 'pc' : l.unit), expiresOn: dateOrNull(l.expiresOn) } : null,
        );
        return lines.length ? { kind: 'pantry.add', lines } : null;
      }
      default:
        return null;
    }
  })();
  return action ? { ...action, request } : null;
};

export const voiceResultSerializer = fromResponse((raw: unknown, heard: 'audio' | 'text' = 'audio'): VoiceResult | null => {
  if (!isObject(raw)) return null;
  const request = requestOf(raw.proposedAction);
  return {
    id: str(raw.voiceLogId),
    transcript: str(raw.transcript),
    language: raw.language === 'en' ? 'en' : 'ur',
    confidence: Math.max(0, Math.min(1, num(raw.confidence))),
    action: actionOf(raw, request),
    alternatives: [],
    heard,
    note: strOrNull(raw.note),
  };
});
