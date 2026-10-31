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
still do this by hand. Your actions reset on 1 Nov 2026."): `models/kitchen/aiModel.ts`.

## 3. Drafts

| Feature | Endpoint | Draft | Confirmed through |
|---|---|---|---|
| Receipt scan (5A) | `POST /food/vendor/ai/receipt-scan { imageUrl }` (upload purpose `kitchen_receipt`) | `{ supplierName, date, lines [{ name, qty, unit, total, match { ingredientId, name, confidence } \| null }], total }`; unmatched names are offered as new ingredients | `POST /food/vendor/kitchen/purchases` |
| Packing check (5A) | inside `POST /food/vendor/orders/:id/packing-photo` | `check { ok, note }`, advice only | — |
| Descriptions (5C) | `POST /food/vendor/ai/descriptions { itemIds (≤ 10) }` | `{ items [{ itemId, en, ur }] }` | `PATCH /food/vendor/menu/items/:id { description, descriptionUr }` |
| Today's specials (5C) | `POST /food/vendor/ai/specials { ingredientIds? }` (default: what expires soonest) | `{ items [{ id, title, description, uses, usesExpiring, lines, suggestedPrice, cost: Cost }], category }` | `POST /food/vendor/menu/items { isActive: false }` (hidden until the cook turns it on), then its recipe card (`PUT /food/vendor/kitchen/recipes/:itemId`) |
| Combo ideas (5C) | `POST /food/vendor/ai/combos` | `{ items [{ id, itemIds, names, orderedTogether, regularPrice, bundlePrice, cost: Cost \| null }], category }` | `POST /food/vendor/menu/items { isDeal: true }`: a deal on the menu at the bundle price (API_FOOD's promotions have no fixed-price bundle) |
| Photo check (5C) | `POST /food/vendor/ai/photo-check { imageUrl, itemId? }` | `{ imageUrl, score (0–100), verdict: good\|ok\|retake, tips [{ kind: light\|framing\|background\|focus, text }] }` | — |
| Review insights (5C) | `GET /food/vendor/reviews/insights?week` | `{ week, from, to, reviewCount, weeks [{ week, count }], themes [{ key, label, tone: positive\|negative, count, snippets }] }` (snippets anonymised); `GET /food/vendor/reviews?theme=&week=` lists a theme's reviews | — |
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

### 3.1 The 5C drafts

Descriptions, two dishes at a time (`current` is what the menu says now):

<!-- contract: descriptions -->
```json
{
  "items": [
    {
      "itemId": "mi_chicken_biryani",
      "name": "Chicken Biryani",
      "current": {
        "en": "Long-grain rice, slow-cooked chicken, fried onions and mint.",
        "ur": null
      },
      "en": "Chicken Biryani: chicken (curry cut), basmati rice and onion, cooked with our own spice mix. One of our best sellers. Spicy. Made fresh every day.",
      "ur": "چکن بریانی: مرغی، چاول، پیاز اور ہمارے اپنے مصالحوں سے تیار کردہ۔ ہمارے سب سے پسندیدہ پکوانوں میں سے۔ مصالحے دار۔ روزانہ تازہ۔"
    },
    {
      "itemId": "mi_naan",
      "name": "Naan",
      "current": {
        "en": null,
        "ur": null
      },
      "en": "Naan: maida (white flour) and yoghurt. Made fresh every day.",
      "ur": "نان: میدہ اور دہی سے تیار کردہ۔ روزانہ تازہ۔"
    }
  ]
}
```

Saving one is the ordinary menu edit, with the Urdu beside the English
(`PATCH /food/vendor/menu/items/:id { description, descriptionUr }`; `descriptionUr` is an addition to
API_FOOD's dish, at most 1,000 characters).

Today's specials, from what expires soonest (or the `ingredientIds` sent). `lines` are a serving's
ingredients in base units; `category` is where the dish would go:

<!-- contract: specials -->
```json
{
  "items": [
    {
      "id": "sp_chicken",
      "title": "Chicken tikka plate",
      "description": "Chargrilled chicken tikka with naan, raita and salad.",
      "uses": [
        "Chicken (curry cut)",
        "Yoghurt"
      ],
      "usesExpiring": [
        "Chicken (curry cut)",
        "Yoghurt"
      ],
      "lines": [
        {
          "ingredientId": "ing_bb_chicken",
          "qty": 220
        },
        {
          "ingredientId": "ing_bb_yoghurt",
          "qty": 40
        }
      ],
      "suggestedPrice": 870,
      "cost": {
        "toMake": 305,
        "sellPrice": 870,
        "keep": 565,
        "keepPct": 65,
        "foodCostPct": 35,
        "overTarget": false
      }
    },
    {
      "id": "sp_milk",
      "title": "Kheer",
      "description": "Slow-cooked rice pudding with almonds and cardamom.",
      "uses": [
        "Milk",
        "Basmati rice"
      ],
      "usesExpiring": [
        "Milk"
      ],
      "lines": [
        {
          "ingredientId": "ing_bb_milk",
          "qty": 250
        },
        {
          "ingredientId": "ing_bb_rice",
          "qty": 25
        }
      ],
      "suggestedPrice": 200,
      "cost": {
        "toMake": 69,
        "sellPrice": 200,
        "keep": 131,
        "keepPct": 66,
        "foodCostPct": 35,
        "overTarget": false
      }
    }
  ],
  "category": {
    "id": "mc_resto_biryani",
    "name": "Biryani"
  }
}
```

Combo ideas: a main with what is most often ordered beside it, at about 10% off both:

<!-- contract: combos -->
```json
{
  "items": [
    {
      "id": "cb_mi_chicken_biryani_mi_naan",
      "itemIds": [
        "mi_chicken_biryani",
        "mi_naan"
      ],
      "names": [
        "Chicken Biryani",
        "Naan"
      ],
      "orderedTogether": 71,
      "regularPrice": 710,
      "bundlePrice": 630,
      "cost": {
        "toMake": 248,
        "sellPrice": 630,
        "keep": 382,
        "keepPct": 61,
        "foodCostPct": 39,
        "overTarget": false
      }
    },
    {
      "id": "cb_mi_seekh_mi_naan",
      "itemIds": [
        "mi_seekh",
        "mi_naan"
      ],
      "names": [
        "Seekh Kebab (4 pcs)",
        "Naan"
      ],
      "orderedTogether": 71,
      "regularPrice": 1050,
      "bundlePrice": 940,
      "cost": {
        "toMake": 329,
        "sellPrice": 940,
        "keep": 611,
        "keepPct": 65,
        "foodCostPct": 35,
        "overTarget": false
      }
    }
  ],
  "category": {
    "id": "mc_resto_deals",
    "name": "Deals"
  }
}
```

A photo check:

<!-- contract: photoCheck -->
```json
{
  "imageUrl": "https://res.cloudinary.com/demo/kebab.jpg",
  "score": 67,
  "verdict": "retake",
  "tips": [
    {
      "kind": "background",
      "text": "Clear the bottles and packets from the edges of the photo."
    },
    {
      "kind": "light",
      "text": "Shoot by a window in daylight; the tube light makes the rice look grey."
    }
  ]
}
```

The week's review themes (`GET /food/vendor/reviews/insights?week=`, a Monday; without it, the
latest of the last eight weeks with a review). Snippets carry no names or numbers. A week is
counted once however often it is read. `GET /food/vendor/reviews?theme=late&week=2026-10-12`
lists the reviews behind a theme:

<!-- contract: reviewInsights -->
```json
{
  "week": "2026-10-12",
  "from": "2026-10-12",
  "to": "2026-10-18",
  "reviewCount": 5,
  "weeks": [
    {
      "week": "2026-10-19",
      "count": 0
    },
    {
      "week": "2026-10-12",
      "count": 5
    }
  ],
  "themes": [
    {
      "key": "late",
      "label": "Took too long",
      "tone": "negative",
      "count": 3,
      "snippets": [
        "Generous portions. Took a little longer than the time shown.",
        "Took almost an hour and arrived late. The food was good once it came."
      ]
    },
    {
      "key": "cold",
      "label": "Arrived cold",
      "tone": "negative",
      "count": 2,
      "snippets": [
        "The karahi arrived cold, we had to heat it again.",
        "Food was lukewarm when it reached us."
      ]
    }
  ]
}
```

Themes: `taste`, `fresh`, `portion`, `packing`, `value` (positive) and `late`, `cold`, `spice`,
`small`, `spill` (negative), from the review's tags and words.

## 4. Urdu

Urdu appears only as content:
- the Urdu description beside the English one;
- recipes when the person picks Urdu;
- what someone said in Urdu.

It is in Urdu script, read right to left. The app's own words stay English (owner's decision,
2026-10-19).

## 5. When the real document arrives

Copy it to `docs/AI.md`, then update `networks/kitchen/kitchenAi.ts`,
`serializers/kitchen/insightSerializer.ts` (`aiUsageSerializer`, `receiptDraftSerializer`),
`models/kitchen/aiModel.ts` and the dummy API. The drafts' confirm paths stay as they are.
