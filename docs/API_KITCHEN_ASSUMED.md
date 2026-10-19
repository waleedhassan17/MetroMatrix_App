# MetroMatrix API — Chunk 5 contract, ASSUMED (Kitchen Intelligence)

> **Assumed, not released.** The backend (`~/MetroMatix-NestJS`) has no kitchen module yet. The
> owner chose to build the app first on this contract (2026-10-19), as Shopping was. The app's
> dummy API (`src/networks/network/mock/kitchen/`) implements every route here. Each place the
> app depends on it is marked `TODO(API_KITCHEN)`. When the real `docs/API_KITCHEN.md` lands,
> copy it to this folder and reconcile networks, serializers, models and the dummy API in one
> pass (§10). Screens and slices do not change.
>
> Companion documents: `docs/AI_ASSUMED.md` (the assistant: drafts, usage, quotas) and
> `docs/VOICE_ASSUMED.md` (voice entry, spoken announcements, the 40 test phrases).
>
> Every JSON example below marked `contract:` is checked key by key against the dummy API by
> `src/networks/network/mock/__tests__/kitchenContract.test.ts`.

**What this adds.**
- Tools for a Food Court kitchen: stock, recipe costs, purchases, forecasts, the prep sheet,
  waste.
- Tonight's surplus sold as a **Bachat Box**.
- From milestone 5B: tiffin plans, catering, Ramadan, the storefront link and QR, demand, menu
  insights and experiments, the kitchen's story and hygiene.
- From 5C: the assistant's drafts, nutrition, and My Kitchen for customers.

**The Food Court rules still hold.**
- Zero commission.
- MetroMatrix never holds money: a Bachat Box, a tiffin period or a catering advance is paid to
  the kitchen directly, at pickup or by transfer to its own account.
- Riders are the kitchen's own.

---

## 1. Conventions

Everything in `docs/API_FOOD.md` §1 applies:
- the `{ success, data | error }` envelope;
- lists as `{ items, total, page, pageSize }`;
- **404 for anything that isn't yours**;
- `Idempotency-Key` on the writes named below;
- rate limits;
- `/media/sign-upload` for files.

Examples show `data` (or `error`).

### 1.1 Who

| Prefix | Account |
|---|---|
| `/food/vendor/kitchen`, `/food/vendor/surplus`, `/food/vendor/ai`, the board additions under `/food/vendor/orders/:id` | an approved Food partner (the vendor's brand), as `/food/vendor` |
| `/food/surplus` (and from 5B `/food/tiffin`, `/food/catering`, `/food/ramadan`) | discovery reads signed out; reserving, subscribing and requesting need a customer |
| `/my-kitchen` (5C) | a customer |
| `/ai/voice/interpret` | the vendor (kitchen contexts) or a customer (search, pantry) — `docs/VOICE_ASSUMED.md` |
| `/admin/kitchen` | staff (TOTP), every write audited |

### 1.2 Quantities: base units

Stock and recipes count in **base units**: grams (`g`), millilitres (`ml`) or pieces (`pc`).
Every ingredient names three things:
- its `baseUnit`;
- whether its pieces are counted in dozens (`dozens`);
- its own units (`customUnits`, e.g. `{ "name": "crate", "base": 30 }`).

A client sends what the cook typed, with a unit, and the server converts. The unit is either
standard (`g`, `kg`, `pao` = 250 g, `ml`, `l`, `pc`, `dozen`) or one of the ingredient's own.

The app words quantities only through `src/utils/units.ts`, the mirror of the API's
`units.ts`: `7500` g is "7.5 kg", never "7500 g".

### 1.3 Money

Whole rupees, computed by the server, as in Food. Two exceptions carry decimals:
- `costPerBase`: rupees per base unit, four decimals;
- a recipe line's `cost` per serving: two decimals (2 g of salt costs 12 paisa).

### 1.4 Uploads

New `/media/sign-upload` purposes:
- `voice_clip` (m4a, aac, webm, ogg, wav, mp3);
- `kitchen_receipt`, `food_packing`, `food_surplus`;
- from 5B, `food_story` (photos and one short video, mp4/mov) and `hygiene_evidence`.

### 1.5 Plan

The Community plan (Rs 0) allows:
- 300 ingredients (`409 PLAN_LIMIT_REACHED { key: "ingredients" }`);
- 5 live Bachat Boxes at a time (`409 SURPLUS_LIMIT`);
- 300 assistant actions a month (`docs/AI_ASSUMED.md`).

Nothing is paywalled.

---

## 2. Shared shapes

### 2.1 Ingredient (`GET /food/vendor/kitchen/stock` items)

`onHand` can be **below zero**. Orders are never refused for the records' sake, so using more
than was recorded leaves a deficit until a purchase or a count covers it.

`state` is one of:
- `ok`;
- `low` (under `parLevel`);
- `out` (0);
- `negative`.

`expiring` is the soonest stock expiring within two days.

<!-- contract: stock -->
```json
{
  "items": [
    {
      "id": "ing_bb_beef",
      "name": "Beef (boneless)",
      "category": "meat_poultry",
      "baseUnit": "g",
      "dozens": false,
      "customUnits": [],
      "onHand": 9000,
      "parLevel": 6000,
      "state": "ok",
      "costPerBase": 1.1,
      "latestCostPerBase": 1.1,
      "expiring": null,
      "priceRefKey": "beef",
      "nutritionFoodId": "nf_beef",
      "updatedAt": "2026-10-14T10:00:00.000Z"
    }
  ],
  "counts": {
    "all": 31,
    "low": 2,
    "expiring": 4,
    "negative": 1
  }
}
```

`GET /food/vendor/kitchen/ingredients/:id` adds three lists: its live batches (first-expiring
first), its last 50 movements, and the recipes that use it.

<!-- contract: ingredient -->
```json
{
  "id": "ing_bb_chicken",
  "name": "Chicken (curry cut)",
  "category": "meat_poultry",
  "baseUnit": "g",
  "dozens": false,
  "customUnits": [],
  "onHand": 16000,
  "parLevel": 10000,
  "state": "ok",
  "costPerBase": 0.6141,
  "latestCostPerBase": 0.62,
  "expiring": {
    "on": "2026-10-16",
    "qty": 4000
  },
  "priceRefKey": "chicken",
  "nutritionFoodId": "nf_chicken",
  "updatedAt": "2026-10-14T10:00:00.000Z",
  "batches": [
    {
      "id": "bt_seed1",
      "qty": 4000,
      "receivedQty": 4000,
      "costPerBase": 0.5962,
      "receivedAt": "2026-10-11T05:00:00.000Z",
      "expiresOn": "2026-10-16",
      "purchaseId": "pu_seed2",
      "supplierName": "Gulberg Cash & Carry"
    }
  ],
  "movements": [
    {
      "id": "mv_seed8",
      "kind": "purchase",
      "qty": 12000,
      "at": "2026-10-14T05:00:00.000Z",
      "note": null,
      "orderCode": null,
      "purchaseId": "pu_seed6"
    }
  ],
  "usedIn": [
    {
      "itemId": "mi_chicken_biryani",
      "variantId": "mi_chicken_biryani_v1",
      "name": "Chicken Biryani (Single)",
      "qtyPerServing": 150
    }
  ]
}
```

### 2.2 Stock take

<!-- contract: stockTake -->
```json
{
  "id": "st_4ys",
  "at": "2026-10-15T10:00:00.000Z",
  "lines": [
    {
      "ingredientId": "ing_bb_cream",
      "name": "Cream",
      "baseUnit": "g",
      "dozens": false,
      "before": -200,
      "counted": 500,
      "change": 700
    }
  ],
  "adjusted": 1
}
```

### 2.3 Purchases, suppliers, price watch

<!-- contract: purchaseCreate -->
```json
{
  "id": "pu_53t",
  "date": "2026-10-15",
  "supplier": {
    "id": "sp_bb_2",
    "name": "Anwar Sabzi Wala"
  },
  "source": "voice",
  "receiptUrl": null,
  "total": 1480,
  "lines": [
    {
      "id": "pl_83f",
      "ingredientId": "ing_bb_tomato",
      "name": "Tomato",
      "baseUnit": "g",
      "dozens": false,
      "qty": 5000,
      "total": 1200,
      "costPerBase": 0.24,
      "expiresOn": null
    }
  ],
  "createdAt": "2026-10-15T10:00:00.000Z"
}
```

`GET /food/vendor/kitchen/purchases` is a page of these plus `weekTotal` (the last seven days):

<!-- contract: purchases -->
```json
{
  "items": [
    {
      "id": "pu_seed6",
      "date": "2026-10-14",
      "supplier": {
        "id": "sp_bb_1",
        "name": "Shah Poultry, Ichhra"
      },
      "source": "manual",
      "receiptUrl": null,
      "total": 36340,
      "lines": [
        {
          "id": "pl_seed7",
          "ingredientId": "ing_bb_chicken",
          "name": "Chicken (curry cut)",
          "baseUnit": "g",
          "dozens": false,
          "qty": 12000,
          "total": 7440,
          "costPerBase": 0.62,
          "expiresOn": "2026-10-20"
        }
      ],
      "createdAt": "2026-10-14T05:00:00.000Z"
    }
  ],
  "total": 10,
  "page": 1,
  "pageSize": 2,
  "weekTotal": 97960
}
```

<!-- contract: suppliers -->
```json
[
  {
    "id": "sp_bb_2",
    "name": "Anwar Sabzi Wala",
    "phone": "+923004441102",
    "note": null,
    "purchaseCount": 4,
    "lastPurchaseOn": "2026-10-14"
  }
]
```

The price watch lists the kitchen's ingredients whose **latest** price is at least 10% over
the city's price list this week, with the city's last eight weeks:

<!-- contract: priceWatch -->
```json
{
  "city": "Lahore",
  "week": "2026-10-12",
  "items": [
    {
      "ingredientId": "ing_bb_tomato",
      "name": "Tomato",
      "baseUnit": "g",
      "yourCostPerBase": 0.24,
      "cityCostPerBase": 0.171,
      "diffPct": 40,
      "trend": [
        {
          "week": "2026-08-24",
          "costPerBase": 0.1163
        }
      ]
    }
  ]
}
```

### 2.4 Recipes and costs

A recipe card belongs to a dish and one of its sizes (`variantId`). `variantId` is `null` for a
dish without sizes, or for one card that every size shares.
- `lines` are for the whole batch of `yield` servings.
- `addOns` (what an option uses) and `packaging` are per serving.

<!-- contract: recipe -->
```json
{
  "itemId": "mi_chicken_biryani",
  "itemName": "Chicken Biryani",
  "photoUrl": "https://images.unsplash.com/photo-1559528896-c5310744cce8",
  "variantId": "mi_chicken_biryani_v1",
  "variants": [
    {
      "id": "mi_chicken_biryani_v1",
      "name": "Single",
      "price": 650,
      "hasRecipe": true
    }
  ],
  "sellPrice": 650,
  "yield": 1,
  "lines": [
    {
      "ingredientId": "ing_bb_chicken",
      "name": "Chicken (curry cut)",
      "baseUnit": "g",
      "dozens": false,
      "qty": 150,
      "costPerBase": 0.6141,
      "cost": 92.11
    }
  ],
  "addOns": [
    {
      "optionId": "og_raita_1",
      "optionName": "Raita",
      "groupName": "Add raita or salad",
      "lines": [
        {
          "ingredientId": "ing_bb_yoghurt",
          "name": "Yoghurt",
          "baseUnit": "g",
          "dozens": false,
          "qty": 80,
          "costPerBase": 0.2524,
          "cost": 20.19
        }
      ]
    }
  ],
  "options": [
    {
      "optionId": "og_spice_1",
      "name": "Mild",
      "groupName": "Spice level"
    }
  ],
  "packaging": [
    {
      "ingredientId": "ing_bb_box_biryani",
      "name": "Biryani box",
      "baseUnit": "pc",
      "dozens": false,
      "qty": 1,
      "costPerBase": 25,
      "cost": 25
    }
  ],
  "signature": {
    "on": true,
    "creatorName": "Imran Qureshi"
  },
  "cost": {
    "toMake": 226,
    "sellPrice": 650,
    "keep": 424,
    "keepPct": 65,
    "foodCostPct": 35,
    "overTarget": false
  },
  "servingsLeft": 50,
  "targetFoodCostPct": 40,
  "updatedAt": "2026-10-05T10:00:00.000Z"
}
```

The list has one row per dish, costed on its first size, plus the kitchen's target and its
average:

<!-- contract: recipes -->
```json
{
  "targetFoodCostPct": 40,
  "avgFoodCostPct": 36,
  "counts": {
    "all": 15,
    "missing": 5,
    "overTarget": 1
  },
  "items": [
    {
      "itemId": "mi_chicken_biryani",
      "name": "Chicken Biryani",
      "photoUrl": "https://images.unsplash.com/photo-1559528896-c5310744cce8",
      "categoryName": "Biryani",
      "status": "complete",
      "variantId": "mi_chicken_biryani_v1",
      "variantName": "Single",
      "variantCount": 3,
      "sellPrice": 650,
      "cost": {
        "toMake": 226,
        "sellPrice": 650,
        "keep": 424,
        "keepPct": 65,
        "foodCostPct": 35,
        "overTarget": false
      },
      "servingsLeft": 50,
      "signature": true
    }
  ]
}
```

<!-- contract: settings -->
```json
{
  "targetFoodCostPct": 40,
  "autoSellOut": true,
  "packingPhoto": "optional"
}
```

### 2.5 Forecast, accuracy, prep sheet, shopping list

<!-- contract: forecast -->
```json
{
  "date": "2026-10-16",
  "learning": false,
  "basisDays": 70,
  "dishes": 104,
  "orders": {
    "expected": 69,
    "low": 51,
    "high": 89
  },
  "items": [
    {
      "itemId": "mi_chicken_biryani",
      "name": "Chicken Biryani",
      "photoUrl": "https://images.unsplash.com/photo-1559528896-c5310744cce8",
      "expected": 17,
      "low": 13,
      "high": 20,
      "learning": false,
      "adjusted": null,
      "fixed": {
        "tiffin": 0,
        "catering": 0
      },
      "planned": 17
    }
  ]
}
```

<!-- contract: accuracy -->
```json
{
  "days": 7,
  "accuracyPct": 87,
  "learning": false,
  "method": "wmape",
  "note": "Over the last 7 days, expected dishes were 87% close to what sold."
}
```

<!-- contract: prep -->
```json
{
  "date": "2026-10-16",
  "dishes": [
    {
      "itemId": "mi_chicken_biryani",
      "name": "Chicken Biryani",
      "servings": 30
    }
  ],
  "groups": [
    {
      "key": "meat_poultry",
      "title": "Meat and poultry",
      "lines": [
        {
          "ingredientId": "ing_bb_beef",
          "name": "Beef (boneless)",
          "qty": 1040,
          "baseUnit": "g",
          "dozens": false,
          "forItems": [
            "Beef Biryani"
          ]
        }
      ]
    }
  ],
  "shareText": "Prep for Fri 16 Oct · Biryani Bazaar\nDishes: Chicken Biryani 30, Beef Biryani 8, Sindhi Biryani 2, Chicken Karahi 6, Mutton Karahi (half) 2, Seekh Kebab (4 pcs) 10, Chicken Tikka (leg) 8, Malai Boti 4, Family deal 4, Solo deal 8, Naan 9, Roghni naan 9, Lassi 6, Soft drink (345 ml) 8, Kheer 3\n\nMeat and poultry\n- Beef (boneless): 1.04 kg\n- Beef mince: 2.6 kg\n- Chicken (curry cut): 9.34 kg\n- Chicken boneless: 1 kg\n- Mutton: 1 kg\n\nVegetables\n- Coriander: 160 g\n- Green chilli: 150 g\n- Mint: 110 g\n- Onion: 2.3 kg\n- Tomato: 3.2 kg\n\nFruit\n- Aloo bukhara (dried plums): 80 g\n- Lemon: 8 pieces\n\nDairy and eggs\n- Cream: 240 g\n- Milk: 510 ml\n- Yoghurt: 3.27 kg\n\nRice, flour and daal\n- Basmati rice: 5.32 kg\n- Maida (white flour): 2.16 kg\n\nSpices\n- Biryani masala: 228 g\n- Black pepper: 24 g\n- Ginger garlic paste: 520 g\n- Red chilli powder: 136 g\n- Salt: 312 g\n\nOil and ghee\n- Cooking oil: 1.44 L\n- Desi ghee: 245 g\n\nPackaging\n- Biryani box: 38 pieces\n- Foil tray: 30 pieces\n\nOther\n- Sugar: 120 g"
}
```

<!-- contract: shoppingList -->
```json
{
  "date": "2026-10-16",
  "lines": [
    {
      "ingredientId": "ing_bb_yoghurt",
      "name": "Yoghurt",
      "baseUnit": "g",
      "dozens": false,
      "need": 3270,
      "onHand": 1500,
      "toBuy": 1770,
      "estCost": 447
    }
  ],
  "estTotal": 447,
  "shareText": "To buy for Fri 16 Oct · Biryani Bazaar\n- Yoghurt: 1.77 kg"
}
```

The server builds `shareText` as plain lines that a phone shares as text; WhatsApp reads it
well.

### 2.6 Waste and donations

<!-- contract: waste -->
```json
{
  "id": "ws_e8c",
  "at": "2026-10-15T10:00:00.000Z",
  "lines": [
    {
      "ingredientId": "ing_bb_onion",
      "itemId": null,
      "name": "Onion",
      "qty": 2000,
      "baseUnit": "g",
      "cost": 300,
      "reason": "spoiled"
    }
  ],
  "cost": 300,
  "note": null
}
```

<!-- contract: wasteSummary -->
```json
{
  "range": "7d",
  "from": "2026-10-09",
  "to": "2026-10-15",
  "cost": 2400,
  "entries": 4,
  "topReasons": [
    {
      "reason": "leftover",
      "cost": 1350
    }
  ],
  "topItems": [
    {
      "name": "Chicken Biryani",
      "cost": 1350
    }
  ],
  "mealsRescued": {
    "total": 12,
    "inRange": 12
  }
}
```

<!-- contract: donations -->
```json
{
  "items": [
    {
      "id": "dn_seed1",
      "at": "2026-10-12T10:00:00.000Z",
      "meals": 12,
      "to": "Edhi centre, Gulberg",
      "note": null
    }
  ],
  "mealsRescued": {
    "total": 12,
    "week": 12
  }
}
```

### 2.7 Bachat Box

The kitchen's box:

<!-- contract: boxCreate -->
```json
{
  "id": "sb_g3p",
  "title": "Chef’s mix box",
  "contentsHint": "Biryani and kebabs from today",
  "photoUrl": null,
  "value": 1200,
  "price": 450,
  "quantity": 3,
  "reserved": 0,
  "collected": 0,
  "left": 3,
  "pickupFrom": "2026-10-15T11:00:00.000Z",
  "pickupTo": "2026-10-15T13:00:00.000Z",
  "pickupLabel": "Today, 4:00 PM – 6:00 PM",
  "status": "live",
  "createdAt": "2026-10-15T10:00:00.000Z"
}
```

`GET /food/vendor/surplus/:id` adds its reservations:

<!-- contract: boxDetail -->
```json
{
  "id": "sb_g3p",
  "title": "Chef’s mix box",
  "contentsHint": "Biryani and kebabs from today",
  "photoUrl": null,
  "value": 1200,
  "price": 450,
  "quantity": 3,
  "reserved": 3,
  "collected": 0,
  "left": 0,
  "pickupFrom": "2026-10-15T11:00:00.000Z",
  "pickupTo": "2026-10-15T13:00:00.000Z",
  "pickupLabel": "Today, 4:00 PM – 6:00 PM",
  "status": "sold_out",
  "createdAt": "2026-10-15T10:00:00.000Z",
  "reservations": [
    {
      "code": "BB-C6YJBC",
      "status": "reserved",
      "quantity": 1,
      "total": 450,
      "box": {
        "id": "sb_g3p",
        "title": "Chef’s mix box",
        "photoUrl": null,
        "value": 1200,
        "price": 450
      },
      "vendor": {
        "id": "fb_resto",
        "slug": "biryani-bazaar",
        "name": "Biryani Bazaar",
        "logoUrl": "https://placehold.co/256x256/B45309/FFFFFF/png?text=BB",
        "phone": "+923001110001",
        "location": {
          "addressLine": "12-C Main Boulevard, Gulberg III",
          "area": "Gulberg III",
          "city": "Lahore",
          "lat": 31.5102,
          "lng": 74.3441
        }
      },
      "pickupFrom": "2026-10-15T11:00:00.000Z",
      "pickupTo": "2026-10-15T13:00:00.000Z",
      "pickupLabel": "Today, 4:00 PM – 6:00 PM",
      "payment": {
        "method": "transfer",
        "status": "proof_submitted",
        "payBy": null,
        "accounts": [
          {
            "kind": "jazzcash",
            "accountTitle": "Imran Qureshi",
            "accountNumber": "+923001110001",
            "bankName": null
          }
        ],
        "reference": "RAAST-88231",
        "proofUrl": "https://res.cloudinary.com/demo/proof.jpg",
        "rejectedReason": null
      },
      "customerName": "Ayesha Khan",
      "canCancel": false,
      "reservedAt": "2026-10-15T10:00:00.000Z",
      "collectedAt": null
    }
  ]
}
```

A reservation, in the customer's view (the kitchen's adds `customerName`):

<!-- contract: reserve -->
```json
{
  "code": "BB-C6YJBC",
  "status": "reserved",
  "quantity": 1,
  "total": 450,
  "box": {
    "id": "sb_g3p",
    "title": "Chef’s mix box",
    "photoUrl": null,
    "value": 1200,
    "price": 450
  },
  "vendor": {
    "id": "fb_resto",
    "slug": "biryani-bazaar",
    "name": "Biryani Bazaar",
    "logoUrl": "https://placehold.co/256x256/B45309/FFFFFF/png?text=BB",
    "phone": "+923001110001",
    "location": {
      "addressLine": "12-C Main Boulevard, Gulberg III",
      "area": "Gulberg III",
      "city": "Lahore",
      "lat": 31.5102,
      "lng": 74.3441
    }
  },
  "pickupFrom": "2026-10-15T11:00:00.000Z",
  "pickupTo": "2026-10-15T13:00:00.000Z",
  "pickupLabel": "Today, 4:00 PM – 6:00 PM",
  "payment": {
    "method": "transfer",
    "status": "awaiting_transfer",
    "payBy": "2026-10-15T10:10:00.000Z",
    "accounts": [
      {
        "kind": "jazzcash",
        "accountTitle": "Imran Qureshi",
        "accountNumber": "+923001110001",
        "bankName": null
      }
    ],
    "reference": null,
    "proofUrl": null,
    "rejectedReason": null
  },
  "canCancel": true,
  "reservedAt": "2026-10-15T10:00:00.000Z",
  "collectedAt": null
}
```

What customers browse:

<!-- contract: surplusNearby -->
```json
{
  "items": [
    {
      "id": "sb_g3p",
      "title": "Chef’s mix box",
      "contentsHint": "Biryani and kebabs from today",
      "photoUrl": "https://images.unsplash.com/photo-1559528896-c5310744cce8",
      "value": 1200,
      "price": 450,
      "left": 3,
      "status": "live",
      "pickupFrom": "2026-10-15T11:00:00.000Z",
      "pickupTo": "2026-10-15T13:00:00.000Z",
      "pickupLabel": "Today, 4:00 PM – 6:00 PM",
      "vendor": {
        "id": "fb_resto",
        "slug": "biryani-bazaar",
        "name": "Biryani Bazaar",
        "logoUrl": "https://placehold.co/256x256/B45309/FFFFFF/png?text=BB",
        "area": "Gulberg III",
        "isHomeKitchen": false,
        "distanceKm": 0
      }
    }
  ]
}
```

<!-- contract: surplusDetail -->
```json
{
  "id": "sb_g3p",
  "title": "Chef’s mix box",
  "contentsHint": "Biryani and kebabs from today",
  "photoUrl": "https://images.unsplash.com/photo-1559528896-c5310744cce8",
  "value": 1200,
  "price": 450,
  "left": 3,
  "status": "live",
  "pickupFrom": "2026-10-15T11:00:00.000Z",
  "pickupTo": "2026-10-15T13:00:00.000Z",
  "pickupLabel": "Today, 4:00 PM – 6:00 PM",
  "vendor": {
    "id": "fb_resto",
    "slug": "biryani-bazaar",
    "name": "Biryani Bazaar",
    "logoUrl": "https://placehold.co/256x256/B45309/FFFFFF/png?text=BB",
    "area": "Gulberg III",
    "isHomeKitchen": false,
    "distanceKm": 0
  },
  "whatToExpect": "A surprise selection of today’s food from this kitchen, packed fresh tonight. What is inside depends on what is left.",
  "pickup": {
    "addressLine": "12-C Main Boulevard, Gulberg III",
    "area": "Gulberg III",
    "city": "Lahore",
    "lat": 31.5102,
    "lng": 74.3441,
    "phone": "+923001110001"
  },
  "paymentMethods": [
    "pay_at_pickup"
  ],
  "maxPerCustomer": 2,
  "myReservations": []
}
```

The end-of-day suggestion (`null` before 5 PM, kitchen time):

<!-- contract: suggestion -->
```json
{
  "suggestion": null
}
```

### 2.8 The hub, insight cards, the board

<!-- contract: summary -->
```json
{
  "date": "2026-10-15",
  "stock": {
    "total": 31,
    "low": 2,
    "negative": 1,
    "expiring": 4
  },
  "recipes": {
    "avgFoodCostPct": 36,
    "targetFoodCostPct": 40,
    "missing": 5,
    "overTarget": 1
  },
  "purchases": {
    "weekTotal": 97960,
    "weekCount": 7
  },
  "forecast": {
    "date": "2026-10-16",
    "dishes": 104,
    "orders": 69,
    "learning": false
  },
  "waste": {
    "weekCost": 2100,
    "mealsRescued": 12
  }
}
```

Up to five insight cards, most urgent first (`critical`, `warning`, `info`), each with one
action (§3.8):

<!-- contract: cards -->
```json
{
  "items": [
    {
      "id": "expiring_stock:ing_bb_chicken:2026-10-16",
      "kind": "expiring_stock",
      "severity": "warning",
      "title": "4 kg chicken (curry cut) expires tomorrow",
      "why": "Milk and Coriander too. Use them before they go to waste.",
      "action": {
        "kind": "create_surplus",
        "label": "Make a Bachat Box",
        "params": {}
      }
    }
  ],
  "generatedAt": "2026-10-15T10:00:00.000Z"
}
```

<!-- contract: snooze -->
```json
{
  "id": "running_low:2026-10-15",
  "snoozedUntil": "2026-10-16T10:00:00.000Z"
}
```

The board's kitchen side, read with every board read:

<!-- contract: board -->
```json
{
  "lowStock": [],
  "soldOutByStock": [
    {
      "itemId": "mi_malai",
      "name": "Malai Boti"
    }
  ],
  "prepHint": {
    "minutes": 20,
    "label": "Usually ready in 20 min at this hour",
    "basis": "prep_time"
  },
  "packingPhoto": "optional"
}
```

---

## 3. Rules

### 3.1 Stock moves first-expiring first

- **In.** Stock comes in as batches: a purchase line, or a count that found more.
- **Out.** It goes out first-expiring first, then oldest.
- **Deficit.** Taking more than there is leaves a deficit: `onHand` goes below zero, the
  ingredient is `negative`, and the next stock in covers the deficit first.
- **Movements** record every change: `purchase`, `usage` (an order), `waste`, `count` and
  `return`.

### 3.2 Orders and stock

- **Accepting** an order takes from stock (`usage`, with the order code):
  - each line's recipe (its size's, else the shared one) × quantity;
  - the chosen add-ons' lines.
- A **cancel or decline before cooking** gives it back to the same batches (`return`).
- A **cancel after cooking started** leaves it used and records the cost as waste
  ("Order FC-… cancelled after cooking").
- A delivered or collected order adds to the day's sales (the forecast's history).

### 3.3 Cost to make

- `toMake` is rounded to whole rupees:
  - Σ line `qty` ÷ `yield` × the ingredient's average cost in stock (the latest price when none
    is left);
  - plus Σ packaging `qty` × cost.
- `sellPrice` is the size's price.
- `keep` = `sellPrice − toMake`.
- `keepPct` and `foodCostPct` are whole percents of `sellPrice`.
- `overTarget` is true when `foodCostPct` is over the kitchen's `targetFoodCostPct` (10–80,
  default 40).

Add-ons are costed separately and never change the dish's own card.

### 3.4 Selling out by stock

`autoSellOut` is on by default. With it on, a dish whose recipe can't make one more serving
from the stock on hand is unavailable to customers:
- only ingredient lines count (a missing box never sells a dish out);
- the dish shows `unavailableReason: "ingredients"` (§5);
- checkout answers `409 ITEM_UNAVAILABLE`, as for any unavailable dish.

Stock coming in makes it available again.

The board lists dishes under 3 servings (`lowStock`) and the ones sold out (`soldOutByStock`).

### 3.5 Forecast and accuracy

- **Expected count.** For a day, each dish's expected count is the weighted mean of the same
  weekday over the last eight weeks (weight 0.85ⁿ, most recent first).
  - The range is ± 1.28 standard deviations (at least ±1).
  - A dish not cooked that weekday (a home kitchen's `days`) is left out.
- **Learning.** With under 14 days of history the kitchen is still learning: each dish gets its
  plain average with a wide range (half to one and a half times, plus one).
- **The cook's own number** for a dish and day (`adjusted`) replaces the expected count in the
  prep sheet and the shopping list.
- Tiffin and catering demand are added as `fixed` (5B).
- `orders` ≈ dishes ÷ 1.5.
- **Accuracy** = 100 − the weighted mean absolute percentage error over the last 7 days, each
  day forecast from the days before it. It is `null` until there are 21 days of history.
- Forecasts, prep sheets and shopping lists cover today and the next seven days (default:
  tomorrow).

### 3.6 Bachat Box

A box is food that would otherwise go to waste tonight, sold for pickup only.

- **The box.**
  - At least **20% under its `value`**.
  - `price` ≥ Rs 50; `quantity` 1–50.
  - The pickup window is at least 30 minutes, ends after now, and ends by 2 AM kitchen time
    (tonight's food).
- **Reserving** (customer) needs an `Idempotency-Key`; a retry replays the first answer.
  - Up to 2 a person per box (`422 SURPLUS_LIMIT { max, held }`).
  - The last one goes to one customer only (`409 SURPLUS_SOLD_OUT { left }`).
  - An ended box: `409 SURPLUS_CLOSED`.
- **Payment.**
  - Pay at pickup: `unpaid`, then `paid` when collected.
  - Or a transfer to the kitchen's own account: `awaiting_transfer` (10 minutes to pay), then
    `proof_submitted`, then `paid` once the kitchen confirms. An unpaid transfer lapses at
    `payBy`.
- **Collecting.** The kitchen collects by the customer's code (`BB-XXXXXX`). A transfer must be
  confirmed first (`409 PAYMENT_NOT_CONFIRMED`).
- **No-shows.** Once the window has started, the kitchen can mark a no-show. Uncollected
  reservations become `no_show` by themselves an hour after the window.
- **Cancelling.** A customer can cancel before the window starts, unless paid.
- **Meals rescued** = Bachat Box boxes collected + meals donated.

### 3.7 Pausing with a reason

Food's `POST /food/vendor/pause` also takes two fields:
- `reason`: `gas | electricity | weather | staff | stock | other`, never shown to customers;
- `resumeAt`: up to 12 hours ahead, when the pause lifts by itself.

The vendor's own profile `branch` shows both (§5).

### 3.8 Insight cards

| `kind` | When | Action (`action.kind`) |
|---|---|---|
| `expiring_stock` | stock expires today (critical) or tomorrow (warning) | `create_surplus` (5C: `make_special`) |
| `negative_stock` | an ingredient is below zero | `stock_take` `{ ingredientIds }` |
| `running_low` | ingredients under their par level | `add_purchase` |
| `price_rise` | the latest price is ≥ 15% over what the kitchen paid before | `open_recipe` `{ itemId }` (the dish it hurts most) |
| `food_cost_high` | a dish over the target | `open_recipe` `{ itemId }` |
| `recipes_missing` | dishes without a complete recipe card | `open_recipes` `{ needs: "recipe" }` |
| `prep_ready` / `portions_suggested` (home kitchens) | from 3 PM | `open_prep` / `apply_portions` `{ date }` |
| `surplus_suggested` | from 8 PM, no box yet today | `create_surplus` |

- 5B and 5C add `unmet_demand`, `experiment_done`, `review_theme`, `tiffin_pending` and
  `catering_new`.
- A snoozed card stays away for 24 hours.
- At most five are sent.

---

## 4. Endpoints

### 4.1 Kitchen (`/food/vendor/kitchen`)

| Method | Path | Notes |
|---|---|---|
| GET / PATCH | `/settings` | `{ targetFoodCostPct (10–80), autoSellOut, packingPhoto: off \| optional \| required }` |
| GET | `/summary` | the hub's numbers (§2.8) |
| GET | `/insights/cards` | §2.8, §3.8 |
| POST | `/insights/cards/:id/snooze` | 24 h → `{ id, snoozedUntil }` |
| GET | `/board` | `{ lowStock, soldOutByStock, prepHint, packingPhoto }` |
| GET | `/stock?segment=all\|low\|expiring\|negative&q` | `{ items: Ingredient[], counts }`; `q` matches names and the ingredient words (tamatar, ٹماٹر) |
| POST | `/ingredients` | `{ name (2–60), category, baseUnit, dozens?, customUnits? (≤ 4), parLevel?, priceRefKey?, nutritionFoodId? }` → IngredientDetail (201). `409 INGREDIENT_EXISTS { ingredientId }`, `409 PLAN_LIMIT_REACHED` |
| GET / PATCH / DELETE | `/ingredients/:id` | PATCH can't change `baseUnit` once there is stock (`409 BASE_UNIT_LOCKED`); DELETE refuses one a recipe uses (`409 INGREDIENT_IN_USE { items }`) |
| POST | `/stock-takes` | `{ lines: [{ ingredientId, counted (base units) }] (1–200), note? }` (201) |
| GET / POST | `/suppliers` | `{ name (2–80), phone?, note? }` |
| PATCH / DELETE | `/suppliers/:id` | past purchases keep the name |
| GET | `/purchases?page&pageSize` | newest first, plus `weekTotal` |
| GET | `/purchases/:id` | |
| POST | `/purchases` | `{ date? (≤ 60 days back), supplierId? \| supplierName?, source: manual \| receipt \| voice, receiptUrl?, lines: [{ ingredientId \| newIngredient { name, category, baseUnit }, qty, unit, total, expiresOn? }] (1–40) }` (201). A unit of the wrong kind: `400` on `lines.N.unit` |
| GET | `/price-watch` | §2.3 |

### 4.2 Recipes (`/food/vendor/kitchen/recipes`)

| Method | Path | Notes |
|---|---|---|
| GET | `?needs=recipe` | §2.4; `needs=recipe` lists only the dishes without a complete card |
| GET | `/:itemId?variantId` | a size's card (default: the first size; `variantId=null` the shared card) |
| PUT | `/:itemId?variantId` | `{ yield (1–500), lines [{ ingredientId, qty }] (≥ 1), addOns [{ optionId, lines }], packaging [...], signature { on, creatorName (required when on) } }` → the card |
| DELETE | `/:itemId?variantId` | |

### 4.3 Forecast, prep, waste (`/food/vendor/kitchen`)

| Method | Path | Notes |
|---|---|---|
| GET | `/forecast?date` | today to 7 days ahead (default tomorrow) |
| PUT | `/forecast/:date/items/:itemId` | `{ adjusted: number \| null }` → the item. A dish not cooked that day: `409 NOT_COOKED_THAT_DAY` |
| GET | `/forecast/accuracy` | §2.5 |
| GET | `/prep-sheet?date`, `/shopping-list?date` | §2.5 |
| POST | `/waste` | `{ lines: [{ ingredientId, qty, unit, reason } \| { itemId, qty (servings), reason }] (1–30), note? }` (201). A wasted dish takes its recipe out of stock. Reasons: `expired, spoiled, burnt, dropped, leftover, other` |
| GET | `/waste?page`, `/waste/summary?range=7d\|30d` | §2.6 |
| GET / POST | `/donations` | `{ meals (1–1000), to (2–80), note? }` |

### 4.4 Bachat Box

Kitchen (`/food/vendor/surplus`):

| Method | Path | Notes |
|---|---|---|
| GET | `?scope=live\|past` | `{ items }` |
| GET | `/suggestion` | §2.7 |
| POST | `/` | `{ title (3–60), contentsHint (3–200), value, price, quantity, pickupFrom, pickupTo, photoUrl? }` (201) |
| GET / PATCH | `/:id` | PATCH `{ quantity (≥ reserved), pickupTo }` |
| POST | `/:id/end` | no new reservations; made ones can still be collected |
| POST | `/reservations/:code/collect`, `/no-show`, `/payment/confirm`, `/payment/reject { reason }` | §3.6 |

Customers (`/food/surplus`):

| Method | Path | Notes |
|---|---|---|
| GET | `?lat&lng` | live boxes of visible kitchens within 25 km, nearest first (≤ 20) |
| GET | `/:id?lat&lng` | §2.7 |
| POST | `/:id/reserve` | `Idempotency-Key` required. `{ quantity (1–2), paymentMethod: pay_at_pickup \| transfer }` (201) |
| GET | `/reservations`, `/reservations/:code` | |
| POST | `/reservations/:code/cancel` | |
| POST | `/reservations/:code/payment-proof` | `{ transactionId (4–40), imageUrl? }` |

<!-- contract: reserveSoldOut -->
```json
{
  "code": "BB-6465UV",
  "status": "reserved",
  "quantity": 2,
  "total": 900,
  "box": {
    "id": "sb_g3p",
    "title": "Chef’s mix box",
    "photoUrl": null,
    "value": 1200,
    "price": 450
  },
  "vendor": {
    "id": "fb_resto",
    "slug": "biryani-bazaar",
    "name": "Biryani Bazaar",
    "logoUrl": "https://placehold.co/256x256/B45309/FFFFFF/png?text=BB",
    "phone": "+923001110001",
    "location": {
      "addressLine": "12-C Main Boulevard, Gulberg III",
      "area": "Gulberg III",
      "city": "Lahore",
      "lat": 31.5102,
      "lng": 74.3441
    }
  },
  "pickupFrom": "2026-10-15T11:00:00.000Z",
  "pickupTo": "2026-10-15T13:00:00.000Z",
  "pickupLabel": "Today, 4:00 PM – 6:00 PM",
  "payment": {
    "method": "pay_at_pickup",
    "status": "unpaid",
    "payBy": null,
    "accounts": null,
    "reference": null,
    "proofUrl": null,
    "rejectedReason": null
  },
  "canCancel": true,
  "reservedAt": "2026-10-15T10:00:00.000Z",
  "collectedAt": null
}
```

### 4.5 The board

| Method | Path | Notes |
|---|---|---|
| POST | `/food/vendor/orders/:id/packing-photo` | `{ imageUrl }` (upload purpose `food_packing`), accepted to ready. The assistant's look (`check`) is advice only, `null` when it is off or used up |
| GET | `/food/vendor/orders/:id/announcement?language=ur\|en` | `docs/VOICE_ASSUMED.md` §5 |

<!-- contract: packing -->
```json
{
  "orderId": "fo_29zun",
  "packedPhotoUrl": "https://res.cloudinary.com/demo/packed.jpg",
  "check": {
    "ok": true,
    "note": "Lid closed and the order slip is visible."
  }
}
```

With `packingPhoto: required`, Food's `POST /food/vendor/orders/:id/ready` answers without a
photo:

<!-- contract: readyNoPhoto -->
```json
{
  "error": {
    "code": "PACKING_PHOTO_REQUIRED",
    "message": "Take a photo of the packed order before marking it ready.",
    "details": {
      "orderId": "fo_29zun"
    }
  }
}
```

### 4.6 Growth (5B)

**Tiffin, for the kitchen** (`/food/vendor/tiffin`):

| Method | Path | Notes |
|---|---|---|
| CRUD | `/plans` | `name`, `meal: breakfast\|lunch\|dinner`, `days`, `period: week\|month`, `price`, `mode: delivery\|pickup`, `window`, `capacity`, `skipCutoffHours`, `rotation [{ weekday, itemIds \| note }]` |
| GET | `/plans/:id/subscribers` | |
| POST | `/subscriptions/:code/{approve,decline,pause,end}` | |
| POST | `/periods/:id/payment/{confirm,reject}` | period payments |
| GET | `/tomorrow` | |

**Tiffin, for customers** (`/food/tiffin`):

| Method | Path | Notes |
|---|---|---|
| GET | `/plans?vendor`, `/plans/:id` | |
| POST | `/plans/:id/subscribe` | Idempotency-Key; `{ startDate, addressId?, paymentMethod }` |
| GET | `/subscriptions`, `/subscriptions/:code` | |
| GET | `/subscriptions/:code/calendar?month` | |
| POST | `/subscriptions/:code/days/:date/{skip,unskip}` | `409 TIFFIN_SKIP_CLOSED { cutoffAt }` |
| POST | `/subscriptions/:code/pause`, `/subscriptions/:code/cancel` | |
| POST | `/periods/:id/payment-proof` | |

At the skip cut-off, the next day's tiffins become scheduled orders (`origin.kind: "tiffin"`,
payment `tiffin_plan`).

**Catering, for customers** (`/food/catering`):

| Method | Path | Notes |
|---|---|---|
| POST | `/requests` | `{ vendorId, date, time, guests, eventType, dishes [{ itemId \| name, qty }], budget?, mode: delivery\|pickup\|on_site, notes? }` |
| GET | `/requests`, `/requests/:code` | |
| POST | `/requests/:code/quotes/:version/accept` | `409 QUOTE_OUTDATED`, `409 QUOTE_EXPIRED` |
| POST | `/requests/:code/advance-proof`, `/requests/:code/cancel` | |

**Catering, for the kitchen** (`/food/vendor/catering`):

| Method | Path | Notes |
|---|---|---|
| GET | `/requests?status`, `/requests/:code` | |
| POST | `/requests/:code/quotes` | `{ lines [{ itemId? \| name, qty, unitPrice }], deliveryFee, advancePct, validUntil, notes? }` → version n |
| POST | `/requests/:code/{decline,advance/confirm,advance/reject}` | |
| GET | `/calendar?month` | |

**Everything else in 5B:**

| Area | Routes |
|---|---|
| Ramadan | `GET/PUT /food/vendor/ramadan` (`{ enabled, sehri { from, to }, iftar { from, to }, iftarPreorderOnly }`; `409 RAMADAN_NOT_ACTIVE` outside an event or 30 days before it); `GET /food/ramadan/iftar?lat&lng` |
| Storefront | `GET /food/vendor/storefront` → `{ url, slug, shareText, stats { month, link, qr, app } }`; checkout's `source` (§5) counts orders by channel |
| Demand | `GET /food/vendor/demand?cuisine&hour` → `{ city, minCount, cells [{ geohash, sw, ne, searches, unmetShare }], topUnmet [{ query, hour, unmetShare, searches }], hourCurve { area[24], own[24] } }`; cells under `minCount` (10) are never sent |
| Menu insights | `GET /food/vendor/menu-insights?range=30d` → items with `popularity`, `profit` (0–1 against the menu), `quadrant: star\|plowhorse\|puzzle\|dog`, `suggestion` |
| Experiments | `GET/POST /food/vendor/experiments` (`{ itemId, change: { kind: price, price } \| { kind: photo, photoUrl }, days (3–14) }`), `GET /experiments/:id` (progress, `result { verdict: keep\|adjust\|drop, before, during }`), `POST /experiments/:id/{keep,adjust,drop}` |
| Story and hygiene | `GET/PUT /food/vendor/story` (`{ text, cookName, photoUrls ≤ 6, videoUrl? }`); `GET /food/vendor/hygiene` (`{ status: self_declared\|pending\|verified\|rejected, note, items [{ key, label, done, evidenceUrl }] }`), `PUT /hygiene/items/:key`, `POST /hygiene/request-verification` |
| Batching | `GET /food/vendor/orders/:id/batch-suggestions` → `[{ orderId, code, extraKm, sameDirection, readyAt }]`; rider orders carry `dropOrder` (§5) |

### 4.7 The assistant, nutrition, My Kitchen (5C)

The assistant's routes are in `docs/AI_ASSUMED.md`.

Vendor nutrition:
- `GET /food/vendor/nutrition`: per dish `kcal, protein, carbs, fat, method: recipe\|ai_estimate,
  confidence, hidden`, plus the `unmapped` ingredients with suggestions;
- `PATCH /food/vendor/nutrition/:itemId { hidden }`.

Customers (`/my-kitchen`):

| Area | Routes |
|---|---|
| Pantry | `GET /pantry?segment=all\|use_soon\|expired`, `POST /pantry { lines }`, `PATCH/DELETE /pantry/:id`, `POST /pantry/:id/use`, `POST /pantry/from-shopping-order { orderId, lineIds }`, `GET/PUT /pantry/reminders`, `GET /stats?month` |
| Recipes | `POST /recipes/suggest { language: ur\|en, maxMinutes?, servings? }`, `GET /recipes/:id`, `GET /recipes/:id/missing-items` (Shopping products with `pricePerUnit`) |
| Nutrition | `GET/PUT /nutrition/settings` (`{ enabled, showCalories (default false), goal, metrics?, manualTargetKcal? }` → computed `targetKcal`), `DELETE /nutrition` (all of it), `GET /nutrition/summary?days=7` (ordered Food Court food only) |

### 4.8 Staff (`/admin/kitchen`)

| Method | Path | Notes |
|---|---|---|
| PATCH | `/ai/settings` | `{ enabled }`: the assistant's switch for everyone |
| PUT | `/ai/quotas/:ownerId` | `{ limit \| null }`: a kitchen's (business id) or customer's monthly actions; `null` = the plan's |
| GET | `/ai/usage?from&to` | by feature and business: actions, failures, latency (5C console) |
| GET / POST | `/reference-prices?dryRun=true` | CSV `key,city,week,pricePerKg`: preview with row errors, then import |
| GET / POST / PATCH | `/nutrition-foods` (+ CSV import) | per 100 g / 100 ml / piece |
| GET / POST / DELETE | `/aliases` | `{ word, language: ur\|roman_ur\|en, key }` |
| GET / POST / PATCH / DELETE | `/calendar-events` | `{ kind: ramadan\|eid\|holiday, name, startsOn, endsOn, city? }` |
| GET | `/hygiene?status=pending`; POST `/hygiene/:vendorId/{verify,reject} { note }` | |
| GET | `/signatures`; POST `/signatures/:itemId/{approve,remove} { note }` | |
| GET | `/demand?city&cuisine&hour` | platform-wide, the same anonymity rule |
| GET | `/lookup?code` | a tiffin (`TF-`) or catering (`CT-`) code |

<!-- contract: adminQuota -->
```json
{
  "ownerId": "b_resto",
  "limit": 1
}
```

---

## 5. Additions to API_FOOD shapes

These are listed once in the app (`src/networks/network/mock/kitchen/foodAdditions.ts`). The
Food parity tests leave these keys out of their comparison. They **fail the day a real Food
capture carries one**: it has shipped then, and is reconciled.

| Shape | Key | Meaning |
|---|---|---|
| Vendor profile `branch` | `pauseReason`, `resumeAt` | §3.7 (the vendor's own view only) |
| `CustomerOrder`, vendor order, `BoardCard` | `packedPhotoUrl` | the packing photo (§4.5) |
| ″ | `origin { kind: app\|link\|qr\|tiffin\|catering, ref }` | where it came from |
| Dish `unavailableReason` | new value `ingredients` | §3.4 |
| Checkout body | `source { kind: link\|qr, slug }` | the storefront link or QR it came through (5B) |
| `RiderOrder` | `dropOrder { position, of }` | a batched delivery (5B) |
| `VendorCard` | `badges[]` | `signature, hygiene_verified, hygiene_self_declared, home_kitchen, bachat_today` (5B), `under_600, high_protein` (5C) |
| `VendorPage` | `story`, `hygiene`, `signatureItemIds`, `tiffinPlans`, `cateringOpen` | 5B |
| Dish (menu card, item sheet, search) | `nutrition`, `descriptionUr`, `isSignature` | 5B–5C |
| `GET /food/search` | `?nutrition=under_600\|high_protein` | 5C |
| Payment method | `tiffin_plan` | an order a tiffin period paid for (5B) |
| `GET /food/vendor/reviews` | `?theme=` | 5C |

---

## 6. Error codes added

| Code | Status | `details` |
|---|---|---|
| `INGREDIENT_EXISTS` | 409 | `ingredientId` |
| `INGREDIENT_IN_USE` | 409 | `items` |
| `BASE_UNIT_LOCKED` | 409 | |
| `NOT_COOKED_THAT_DAY` | 409 | |
| `PACKING_PHOTO_REQUIRED` | 422 | `orderId` |
| `SURPLUS_SOLD_OUT` | 409 | `left` |
| `SURPLUS_CLOSED` | 409 | |
| `SURPLUS_LIMIT` | 409 / 422 | `max` (`held`) |
| `TOO_EARLY`, `CANCEL_NOT_ALLOWED` | 409 | |
| `TIFFIN_SKIP_CLOSED` | 409 | `cutoffAt` (5B) |
| `QUOTE_OUTDATED`, `QUOTE_EXPIRED` | 409 | `currentVersion` (5B) |
| `RAMADAN_NOT_ACTIVE` | 409 | `event` (5B) |
| `AI_UNAVAILABLE`, `AI_QUOTA_REACHED`, `CLIP_TOO_LONG` | 503 / 429 / 413 | `docs/AI_ASSUMED.md`, `docs/VOICE_ASSUMED.md` |

Reused codes:
- `VALIDATION_FAILED`, `NOT_FOUND`, `INVALID_TRANSITION`;
- `PLAN_LIMIT_REACHED`, `IDEMPOTENCY_KEY_REQUIRED`;
- `PAYMENT_NOT_CONFIRMED`, `PAYMENT_METHOD_UNAVAILABLE`;
- `ITEM_UNAVAILABLE`.

---

## 7. Notifications (`type`)

For the kitchen:
- `kitchen.stock.expiring` (the morning of);
- `kitchen.surplus.reserved`, `kitchen.surplus.proof`;
- `kitchen.tiffin.subscribed`, `kitchen.catering.requested`, `kitchen.hygiene.verified` (5B).

For customers:
- `food.surplus.confirmed`, `food.surplus.reminder` (the window opens);
- `food.tiffin.approved`, `food.catering.quoted` (5B);
- `mykitchen.pantry.expiring` (5C).

`data` carries the code, as in Food.

## 8. Jobs (every minute, as Food's)

- A pause ends at its `resumeAt`.
- Unpaid Bachat Box transfers lapse at `payBy`.
- Reservations are marked `no_show` an hour after the window.
- From 5B:
  - the next day's tiffins become scheduled orders at the cut-off;
  - catering quotes expire;
  - experiments end.

## 9. Demo data (the dummy API)

**Biryani Bazaar** (`restaurant@metromatrix.app`) is the main demo kitchen:
- 31 ingredients with batches, recipes for its menu, three suppliers, and purchases over three
  weeks;
- 10 weeks of daily sales;
- 4 kg of chicken expiring tomorrow, yoghurt running low, cream recorded below zero (so Malai
  Boti sells out by itself);
- tomatoes up 32% on what it paid before, Mutton Karahi over the 40% target, and five dishes
  without a recipe card.

The other demo kitchens:
- **Smash Lab** (`cloudkitchen@`) requires a packing photo.
- **Ammi ka Khana** (`homekitchen@`) is a home kitchen.
- **Nani ki Handi** (`nani@`) has 9 days of history, so it is still learning.

City prices cover Lahore, Karachi and Islamabad for 8 weeks.

## 10. When the real document arrives

1. Copy it to `docs/API_KITCHEN.md`. Delete this file, and the `foodAdditions.ts` entries the
   real Food document now has.
2. Update `src/networks/kitchen/*`, `src/serializers/kitchen/*`, `src/models/kitchen/*` and the
   dummy API (`mock/kitchen/*`).
3. Capture real responses into fixtures, and replace `kitchenContract.test.ts` with a parity
   test, as Food's.
4. Run `grep -rn "TODO(API_KITCHEN)" src` and resolve each one; run the gates.
