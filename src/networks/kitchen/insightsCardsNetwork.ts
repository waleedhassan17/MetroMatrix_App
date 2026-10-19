// MetroMatrix — Kitchen: the hub's numbers and its insight cards.
// docs/API_KITCHEN_ASSUMED.md §4.1 (TODO(API_KITCHEN): an assumed contract).

import { api } from '../network/apiHelpers';
import { request, requestAll } from '../shopping/http';
import { aiUsageSerializer, insightCardsSerializer, kitchenSummarySerializer } from '../../serializers/kitchen/insightSerializer';
import { isObject, str } from '../../serializers/serializerUtils';

const enc = encodeURIComponent;

/** The hub: its tiles' numbers, the cards and the assistant's meter, read together. */
export const getKitchenHub = () =>
  requestAll(
    {
      summary: () => api.get('/food/vendor/kitchen/summary'),
      cards: () => api.get('/food/vendor/kitchen/insights/cards'),
      usage: () => api.get('/food/vendor/ai/usage'),
    },
    parts => {
      const summary = kitchenSummarySerializer(parts.summary);
      return summary ? { summary, cards: insightCardsSerializer(parts.cards), usage: aiUsageSerializer(parts.usage) } : null;
    },
  );

export const listInsightCards = () => request(() => api.get('/food/vendor/kitchen/insights/cards'), insightCardsSerializer);

export const snoozeInsightCard = (id: string) =>
  request(() => api.post(`/food/vendor/kitchen/insights/cards/${enc(id)}/snooze`), raw => (isObject(raw) ? { id: str(raw.id), snoozedUntil: str(raw.snoozedUntil) } : null));
