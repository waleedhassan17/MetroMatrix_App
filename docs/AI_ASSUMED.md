# MetroMatrix API — the assistant, ASSUMED (Chunk 5)

> **Assumed, not released.** Built by the app ahead of the backend (owner's decision,
> 2026-10-19). The dummy API answers from rules and templates (`mock/kitchen/aiStandIns.ts`):
> the same input always gives the same draft. No model is called. Every dependency is marked
> `TODO(API_AI)`. Read with `docs/API_KITCHEN_ASSUMED.md` (conventions) and
> `docs/VOICE_ASSUMED.md` (voice).

## 1. The rule: drafts, never actions

Everything the assistant returns is a **draft**:
- a scanned receipt's lines;
- a dish description in English and Urdu;
- today's specials, combo ideas, photo tips;
- review themes, a nutrition estimate, recipe ideas;
- what a voice clip asked for.

Nothing is saved or done until the person checks it and confirms. Confirming calls the
**ordinary endpoint**, the one a person would have used by hand:
- `POST /food/vendor/kitchen/purchases`;
- `PATCH /food/vendor/menu/items/:id`;
- `POST /food/vendor/promotions`.

So the assistant can never do something a person couldn't, and its numbers are always the
server's.

When the assistant can't help, the screen keeps its manual form and says why (§2). It never
shows a blocking error.

Privacy:
- Customers' nutrition data and pantry never reach a vendor.
- Prompts carry no names, phone numbers or addresses.
- Clips and photos are kept only as long as the drafts need (voice: 24 hours).

## 2. Switch, quota and usage

| | |
|---|---|
| The switch | Staff turn the assistant off for everyone with `PATCH /admin/kitchen/ai/settings { enabled }`. Off: every assistant route answers `503 AI_UNAVAILABLE`. |
| Kitchens | 300 **assistant actions** a month on the Community plan (receipt scans, packing checks, descriptions, specials, combos, photo checks, review insights, nutrition estimates). Reset on the 1st, 00:00 Pakistan time. |
| Voice | Its own cap: 200 clips a day per kitchen or customer (`docs/VOICE_ASSUMED.md`). |
| Customers | 30 recipe-idea actions a month. |
| Overrides | Staff: `PUT /admin/kitchen/ai/quotas/:ownerId { limit \| null }` (a business id or a user id; `null` = the plan's). |
| Over the limit | `429 AI_QUOTA_REACHED { feature, limit, used, resetsAt }`. |

`GET /food/vendor/ai/usage`:

<!-- contract: usage -->
```json
{
  "enabled": true,
  "limit": 300,
  "used": 0,
  "left": 300,
  "resetsAt": "2026-10-31T19:00:00.000Z",
  "voice": {
    "limit": 200,
    "used": 0,
    "left": 200,
    "resetsAt": "2026-10-15T19:00:00.000Z"
  }
}
```

<!-- contract: quotaReached -->
```json
{
  "error": {
    "code": "AI_QUOTA_REACHED",
    "message": "You have used this month’s assistant actions. You can still do this by hand.",
    "details": {
      "feature": "receipt_scan",
      "limit": 1,
      "used": 2,
      "resetsAt": "2026-10-31T19:00:00.000Z"
    }
  }
}
```

The app turns these into a plain note beside the form ("Assistant actions used up. You can
still do this by hand. Your actions reset on 1 Nov 2026."): `src/models/kitchen/aiModel.ts`.

## 3. Drafts

| Feature | Endpoint | Draft | Confirmed through |
|---|---|---|---|
| Receipt scan (5A) | `POST /food/vendor/ai/receipt-scan { imageUrl }` (upload purpose `kitchen_receipt`) | `{ supplierName, date, lines [{ name, qty, unit, total, match { ingredientId, name, confidence } \| null }], total }`; unmatched names are offered as new ingredients | `POST /food/vendor/kitchen/purchases` |
| Packing check (5A) | inside `POST /food/vendor/orders/:id/packing-photo` | `check { ok, note }`, advice only | — |
| Descriptions (5C) | `POST /food/vendor/ai/descriptions { itemIds (≤ 10) }` | `{ items [{ itemId, en, ur }] }` | `PATCH /food/vendor/menu/items/:id { description, descriptionUr }` |
| Today's specials (5C) | `POST /food/vendor/ai/specials { ingredientIds? }` (default: what expires soonest) | `{ items [{ title, description, uses [ingredient names], suggestedPrice, cost: Cost }] }` | `POST /food/vendor/menu/items` (unavailable until the cook turns it on) |
| Combo ideas (5C) | `POST /food/vendor/ai/combos` | `{ items [{ itemIds, names, orderedTogether, bundlePrice, cost: Cost }] }` | `POST /food/vendor/promotions` (an item deal) |
| Photo check (5C) | `POST /food/vendor/ai/photo-check { imageUrl }` | `{ score (0–100), tips [{ kind: light\|framing\|background\|focus, text }] }` | — |
| Review insights (5C) | `GET /food/vendor/reviews/insights?week` | `{ week, themes [{ key, label, tone: positive\|negative, count, snippets }] }` (snippets anonymised); `GET /food/vendor/reviews?theme=` lists a theme's reviews | — |
| Nutrition estimate (5C) | inside `GET /food/vendor/nutrition` for dishes without a mapped recipe | `method: ai_estimate, confidence` | — |
| Recipe ideas (5C) | `POST /my-kitchen/recipes/suggest { language: ur\|en, maxMinutes?, servings? }` | `{ items [{ id, title, minutes, servings, have, missing, usesExpiring, nutrition? }] }`; expiring pantry items first | — |

A receipt scan:

<!-- contract: receipt -->
```json
{
  "supplierName": "Anwar Sabzi Wala",
  "date": "2026-10-15",
  "lines": [
    {
      "name": "Tomato",
      "qty": 5,
      "unit": "kg",
      "total": 1150,
      "match": {
        "ingredientId": "ing_bb_tomato",
        "name": "Tomato",
        "confidence": 0.92
      }
    }
  ],
  "total": 2000,
  "imageUrl": "https://res.cloudinary.com/demo/receipt.jpg"
}
```

## 4. Urdu

Urdu appears only as content:
- the Urdu description beside the English one;
- recipes when the person picks Urdu;
- what someone said in Urdu.

It is in Urdu script, read right to left. The app's own words stay English (owner's decision,
2026-10-19).

## 5. When the real document arrives

Copy it to `docs/AI.md`, then update `src/networks/kitchen/kitchenAiNetwork.ts`,
`src/serializers/kitchen/insightSerializer.ts` (`aiUsageSerializer`, `receiptDraftSerializer`),
`src/models/kitchen/aiModel.ts` and the dummy API. The drafts' confirm paths stay as they are.
