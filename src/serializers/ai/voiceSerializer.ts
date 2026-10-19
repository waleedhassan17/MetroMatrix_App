// MetroMatrix — The voice result: what was heard and the one action it proposes.
// An action the app can't read (an unknown kind, a missing order or line)
// is dropped, so the card falls back to "Did you mean…" or the manual way.
// docs/VOICE_ASSUMED.md §3.

import type { VoiceAction, VoiceQtyLine, VoiceResult } from '../../types/kitchen';
import { isObject, num, str, strOrNull } from '../serializerUtils';
import { WASTE_REASONS } from '../kitchen/wasteSerializer';
import { dateOrNull, list, standardUnit } from '../kitchen/kitchenCommon';
import { oneOf } from '../serializerUtils';

const qtyLine = (raw: unknown): VoiceQtyLine | null =>
  isObject(raw) && str(raw.name) && num(raw.qty) > 0
    ? {
        ingredientId: strOrNull(raw.ingredientId),
        key: strOrNull(raw.key),
        name: str(raw.name),
        qty: num(raw.qty),
        unit: standardUnit(raw.unit),
        total: raw.total === null || raw.total === undefined ? null : Math.max(0, Math.round(num(raw.total))),
      }
    : null;

export const voiceActionSerializer = (raw: unknown): VoiceAction | null => {
  if (!isObject(raw)) return null;
  const order = str(raw.orderId) && str(raw.code) ? { orderId: str(raw.orderId), code: str(raw.code) } : null;
  switch (raw.kind) {
    case 'order.accept':
      return order ? { kind: 'order.accept', ...order, etaMinutes: raw.etaMinutes === null || raw.etaMinutes === undefined ? null : Math.max(1, Math.round(num(raw.etaMinutes))) } : null;
    case 'order.reject':
      return order ? { kind: 'order.reject', ...order, reason: str(raw.reason, 'too_busy') } : null;
    case 'order.ready':
      return order ? { kind: 'order.ready', ...order } : null;
    case 'item.unavailable':
      return str(raw.itemId) ? { kind: 'item.unavailable', itemId: str(raw.itemId), name: str(raw.name) } : null;
    case 'vendor.busy':
      return num(raw.extraMinutes) > 0 ? { kind: 'vendor.busy', extraMinutes: Math.round(num(raw.extraMinutes)) } : null;
    case 'purchase.add':
    case 'stock.count': {
      const lines = list(raw.lines, qtyLine);
      return lines.length ? { kind: raw.kind, lines } : null;
    }
    case 'waste.log': {
      const lines = list(raw.lines, qtyLine);
      return lines.length ? { kind: 'waste.log', reason: oneOf(raw.reason, WASTE_REASONS, 'other'), lines } : null;
    }
    case 'portions.set': {
      const lines = list(raw.lines, l => (isObject(l) && str(l.itemId) ? { itemId: str(l.itemId), name: str(l.name), portions: Math.max(0, Math.round(num(l.portions))) } : null));
      return lines.length ? { kind: 'portions.set', lines } : null;
    }
    case 'search':
      return str(raw.query).trim() ? { kind: 'search', query: str(raw.query).trim() } : null;
    case 'pantry.add': {
      const lines = list(raw.lines, l =>
        isObject(l) && str(l.name) && num(l.qty) > 0 ? { key: strOrNull(l.key), name: str(l.name), qty: num(l.qty), unit: standardUnit(l.unit), expiresOn: dateOrNull(l.expiresOn) } : null,
      );
      return lines.length ? { kind: 'pantry.add', lines } : null;
    }
    default:
      return null;
  }
};

export const voiceResultSerializer = (raw: unknown): VoiceResult | null => {
  if (!isObject(raw)) return null;
  return {
    id: str(raw.id),
    transcript: str(raw.transcript),
    language: raw.language === 'ur' ? 'ur' : 'en',
    confidence: Math.max(0, Math.min(1, num(raw.confidence))),
    action: voiceActionSerializer(raw.action),
    alternatives: list(raw.alternatives, a => {
      const action = isObject(a) ? voiceActionSerializer(a.action) : null;
      return action && isObject(a) ? { transcript: str(a.transcript), action } : null;
    }).slice(0, 3),
    heard: raw.heard === 'text' ? 'text' : 'audio',
  };
};
