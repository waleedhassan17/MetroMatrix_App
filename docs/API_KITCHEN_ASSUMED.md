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
    "creatorName": "Imran Qureshi",
    "removedNote": null
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

The end-of-day suggestion (`null` before 5 PM, kitchen time). From 5 PM it
is a filled-in box to check: a home kitchen's leftover portions
(`basis: "portions_left"`), else a mix of the day's popular dishes
(`basis: "end_of_day"`); pickup starts on a quarter hour, at 9 PM or 15
minutes from now if later, for two hours (ending by 1:30 AM):

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
  },
  "growth": {
    "tiffin": {
      "plans": 0,
      "active": 0,
      "pending": 0,
      "tomorrow": 0
    },
    "catering": {
      "new": 0,
      "upcoming": 0
    },
    "storefront": {
      "brought": 0
    },
    "demand": {
      "unmet": 612
    },
    "experiments": {
      "running": 0,
      "results": 0
    },
    "hygiene": "verified",
    "ramadan": {
      "state": "none",
      "enabled": false
    }
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
        "kind": "make_special",
        "label": "Make a special",
        "params": {
          "ingredientIds": ["ing_bb_chicken", "ing_bb_milk", "ing_bb_coriander"]
        }
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

### 2.9 Tiffin (5B)

A plan, as the kitchen and customers see it. `days` are ISO weekdays (1 Monday … 7 Sunday);
`price` is per period (a week, or four weeks); `perMeal` is what one meal works out at; the
`rotation` says what is cooked on each day (dishes from the menu, or a note). `nextStart` is the
earliest day a new subscription can start. Lists of plans (`GET /food/vendor/tiffin/plans`,
`GET /food/tiffin/plans?vendor=`) are `{ items: [plan] }`; creating or editing one answers the
plan.

<!-- contract: tiffinPlan -->
```json
{
  "id": "tp_nani_lunch",
  "vendor": {
    "id": "fb_nani",
    "slug": "nani-ki-handi",
    "name": "Nani ki Handi",
    "logoUrl": "https://placehold.co/256x256/7C2D12/FFFFFF/png?text=NH",
    "isHomeKitchen": true
  },
  "name": "Office lunch tiffin",
  "description": "Home-cooked lunch on weekdays, in a steel tiffin you keep. Roti and salad with every meal.",
  "meal": "lunch",
  "days": [
    1
  ],
  "period": "week",
  "price": 2300,
  "perMeal": 460,
  "mealsPerPeriod": 5,
  "mode": "delivery",
  "window": {
    "from": "12:30",
    "to": "13:30",
    "label": "12:30 PM – 1:30 PM"
  },
  "capacity": 25,
  "subscribers": 1,
  "seatsLeft": 24,
  "skipCutoffHours": 14,
  "rotation": [
    {
      "weekday": 1,
      "dishes": [
        {
          "itemId": "mi_nani_daal",
          "name": "Daal chawal with achaar",
          "photoUrl": "https://images.unsplash.com/photo-1588644525273-f37b60d78512"
        }
      ],
      "note": null
    }
  ],
  "photoUrl": "https://images.unsplash.com/photo-1588644525273-f37b60d78512",
  "isActive": true,
  "nextStart": "2026-10-16"
}
```

A subscription, as the customer sees it (`POST /food/tiffin/plans/:id/subscribe` answers it
`pending`, with no period yet). `period` is the current one and its payment: a transfer to the
kitchen's own account, or cash with the first delivery. `credit` is the meals skipped in the
period before, taken off this one. Lists are `{ items: [subscription] }`; the period's receipt
answers the subscription.

<!-- contract: tiffinSubscription -->
```json
{
  "code": "TF-2UPUXR",
  "status": "active",
  "plan": {
    "id": "tp_nani_lunch",
    "name": "Office lunch tiffin",
    "meal": "lunch",
    "days": [
      1
    ],
    "period": "week",
    "price": 2300,
    "perMeal": 460,
    "mode": "delivery",
    "window": {
      "from": "12:30",
      "to": "13:30",
      "label": "12:30 PM – 1:30 PM"
    },
    "skipCutoffHours": 14
  },
  "vendor": {
    "id": "fb_nani",
    "slug": "nani-ki-handi",
    "name": "Nani ki Handi",
    "logoUrl": "https://placehold.co/256x256/7C2D12/FFFFFF/png?text=NH",
    "phone": "+923001110010"
  },
  "startDate": "2026-10-16",
  "endDate": null,
  "nextDelivery": {
    "date": "2026-10-16",
    "dishes": [
      "Chicken pulao"
    ],
    "cutoffAt": "2026-10-15T17:30:00.000Z"
  },
  "address": {
    "line1": "House 12, Main Boulevard",
    "area": "Gulberg III",
    "city": "Lahore",
    "lat": 31.516,
    "lng": 74.342
  },
  "paymentMethod": "transfer",
  "period": {
    "id": "tpd_ygf",
    "from": "2026-10-16",
    "to": "2026-10-22",
    "meals": 5,
    "credit": 0,
    "amount": 2300,
    "payment": {
      "method": "transfer",
      "status": "awaiting_transfer",
      "payBy": "2026-10-16T18:59:00.000Z",
      "accounts": [
        {
          "kind": "easypaisa",
          "accountTitle": "Shazia Parveen",
          "accountNumber": "+923001110010",
          "bankName": null
        }
      ],
      "reference": null,
      "proofUrl": null,
      "rejectedReason": null
    }
  },
  "pausedFrom": null,
  "pausedUntil": null,
  "declineReason": null,
  "endReason": null,
  "canPause": true,
  "canResume": false,
  "canCancel": true,
  "createdAt": "2026-10-15T10:00:00.000Z"
}
```

The kitchen's view adds `customer`; approving opens the first period:

<!-- contract: tiffinApprove -->
```json
{
  "code": "TF-2UPUXR",
  "status": "active",
  "plan": {
    "id": "tp_nani_lunch",
    "name": "Office lunch tiffin",
    "meal": "lunch",
    "days": [
      1
    ],
    "period": "week",
    "price": 2300,
    "perMeal": 460,
    "mode": "delivery",
    "window": {
      "from": "12:30",
      "to": "13:30",
      "label": "12:30 PM – 1:30 PM"
    },
    "skipCutoffHours": 14
  },
  "vendor": {
    "id": "fb_nani",
    "slug": "nani-ki-handi",
    "name": "Nani ki Handi",
    "logoUrl": "https://placehold.co/256x256/7C2D12/FFFFFF/png?text=NH",
    "phone": "+923001110010"
  },
  "customer": {
    "name": "Ayesha Khan",
    "phone": "+923001234567"
  },
  "startDate": "2026-10-16",
  "endDate": null,
  "nextDelivery": {
    "date": "2026-10-16",
    "dishes": [
      "Chicken pulao"
    ],
    "cutoffAt": "2026-10-15T17:30:00.000Z"
  },
  "address": {
    "line1": "House 12, Main Boulevard",
    "area": "Gulberg III",
    "city": "Lahore",
    "lat": 31.516,
    "lng": 74.342
  },
  "paymentMethod": "transfer",
  "period": {
    "id": "tpd_ygf",
    "from": "2026-10-16",
    "to": "2026-10-22",
    "meals": 5,
    "credit": 0,
    "amount": 2300,
    "payment": {
      "method": "transfer",
      "status": "awaiting_transfer",
      "payBy": "2026-10-16T18:59:00.000Z",
      "accounts": [
        {
          "kind": "easypaisa",
          "accountTitle": "Shazia Parveen",
          "accountNumber": "+923001110010",
          "bankName": null
        }
      ],
      "reference": null,
      "proofUrl": null,
      "rejectedReason": null
    }
  },
  "pausedFrom": null,
  "pausedUntil": null,
  "declineReason": null,
  "endReason": null,
  "canPause": true,
  "canResume": false,
  "canCancel": false,
  "createdAt": "2026-10-15T10:00:00.000Z"
}
```

The kitchen's inbox (`GET /food/vendor/tiffin/subscriptions?status=pending|active|paused|ended`)
and a plan's subscribers (`GET /food/vendor/tiffin/plans/:id/subscribers`) carry counts:

<!-- contract: tiffinInbox -->
```json
{
  "counts": {
    "pending": 1,
    "active": 1,
    "paused": 0,
    "toCheck": 0
  },
  "items": []
}
```

The month calendar has every day of the month with its `state` (`before_start | off | pending |
upcoming | skipped | paused | ordered | delivered | cancelled | ended | none`), the dishes, the
cut-off, and whether it can be skipped or un-skipped now (one day shown):

<!-- contract: tiffinCalendar -->
```json
{
  "month": "2026-10",
  "days": [
    {
      "date": "2026-10-19",
      "state": "skipped",
      "dishes": [
        "Daal chawal with achaar"
      ],
      "cutoffAt": "2026-10-18T17:30:00.000Z",
      "canSkip": false,
      "canUnskip": true,
      "orderCode": null
    }
  ]
}
```

Skipping or un-skipping answers the day:

<!-- contract: tiffinSkip -->
```json
{
  "date": "2026-10-19",
  "state": "skipped",
  "dishes": [
    "Daal chawal with achaar"
  ],
  "cutoffAt": "2026-10-18T17:30:00.000Z",
  "canSkip": false,
  "canUnskip": true,
  "orderCode": null
}
```

After the day's cut-off:

<!-- contract: tiffinSkipClosed -->
```json
{
  "error": {
    "code": "TIFFIN_SKIP_CLOSED",
    "message": "The kitchen has started on this day. Changes closed at the cut-off.",
    "details": {
      "cutoffAt": "2026-10-15T17:30:00.000Z"
    }
  }
}
```

Tomorrow's tiffins for the kitchen, per plan:

<!-- contract: tiffinTomorrow -->
```json
{
  "date": "2026-10-16",
  "plans": [
    {
      "planId": "tp_nani_lunch",
      "name": "Office lunch tiffin",
      "meal": "lunch",
      "window": "12:30 PM – 1:30 PM",
      "dishes": [
        "Chicken pulao"
      ],
      "count": 2,
      "skipped": 0,
      "paused": 0,
      "cutoffAt": "2026-10-15T17:30:00.000Z",
      "deliveries": [
        {
          "code": "TF-HMZ4K2",
          "customerName": "Hamza Qureshi",
          "area": "Gulberg III",
          "state": "ordered",
          "orderCode": "FC-76Z22Z"
        }
      ]
    }
  ]
}
```

At the cut-off each day becomes an ordinary board card: accepted, scheduled for the window, paid
by the plan (`payment.method: "tiffin_plan"`), with `origin.kind: "tiffin"`:

<!-- contract: tiffinBoard -->
```json
{
  "items": [
    {
      "id": "fo_hk6",
      "code": "FC-76Z22Z",
      "status": "accepted",
      "statusLabel": "Accepted",
      "fulfilment": "delivery",
      "scheduledFor": "2026-10-16T07:30:00.000Z",
      "placedAt": "2026-10-15T19:00:00.000Z",
      "acceptBy": null,
      "promisedAt": "2026-10-16T08:30:00.000Z",
      "total": 460,
      "payment": {
        "method": "tiffin_plan",
        "status": "paid"
      },
      "itemCount": 1,
      "itemsSummary": "1× Chicken pulao",
      "customerName": "Hamza Qureshi",
      "riderId": null,
      "handedToExternal": false,
      "packedPhotoUrl": null,
      "origin": {
        "kind": "tiffin",
        "ref": "TF-HMZ4K2"
      }
    }
  ],
  "total": 2,
  "page": 1,
  "pageSize": 20
}
```

### 2.10 Catering (5B)

What a kitchen takes, and its menu to choose from (`GET /food/catering/vendors/:id`, by brand id
or slug):

<!-- contract: cateringVendor -->
```json
{
  "vendorId": "fb_resto",
  "open": true,
  "minGuests": 20,
  "leadDays": 2,
  "earliestDate": "2026-10-17",
  "modes": [
    "delivery"
  ],
  "menu": [
    {
      "itemId": "mi_chicken_biryani",
      "name": "Chicken Biryani",
      "price": 650,
      "photoUrl": "https://images.unsplash.com/photo-1559528896-c5310744cce8"
    }
  ]
}
```

A request as the customer sent it:

<!-- contract: cateringRequest -->
```json
{
  "code": "CT-WGG77A",
  "status": "requested",
  "vendor": {
    "id": "fb_resto",
    "slug": "biryani-bazaar",
    "name": "Biryani Bazaar",
    "logoUrl": "https://placehold.co/256x256/B45309/FFFFFF/png?text=BB",
    "phone": "+923001110001"
  },
  "date": "2026-10-31",
  "time": "19:30",
  "startsAt": "2026-10-31T14:30:00.000Z",
  "guests": 60,
  "eventType": "aqiqah",
  "dishes": [
    {
      "itemId": "mi_chicken_biryani",
      "name": "Chicken Biryani",
      "qty": 60
    }
  ],
  "budget": 45000,
  "mode": "delivery",
  "address": {
    "line1": "House 12, Main Boulevard",
    "area": "Gulberg III",
    "city": "Lahore",
    "lat": 31.516,
    "lng": 74.342
  },
  "notes": "Please include raita.",
  "quotes": [],
  "acceptedVersion": null,
  "advance": null,
  "balance": null,
  "declineReason": null,
  "cancelReason": null,
  "canAccept": false,
  "canCancel": true,
  "canQuote": false,
  "createdAt": "2026-10-15T10:00:00.000Z",
  "updatedAt": "2026-10-15T10:00:00.000Z"
}
```

Each quote is a version, with `state` `current | outdated | expired | accepted`. Once one is
accepted, `advance` is what to transfer to the kitchen's own account and `balance` what is left for
the day. The kitchen's view adds `customer`; every move answers the request (lists are
`{ items: [request] }`).

<!-- contract: cateringAccept -->
```json
{
  "code": "CT-WGG77A",
  "status": "accepted",
  "vendor": {
    "id": "fb_resto",
    "slug": "biryani-bazaar",
    "name": "Biryani Bazaar",
    "logoUrl": "https://placehold.co/256x256/B45309/FFFFFF/png?text=BB",
    "phone": "+923001110001"
  },
  "date": "2026-10-31",
  "time": "19:30",
  "startsAt": "2026-10-31T14:30:00.000Z",
  "guests": 60,
  "eventType": "aqiqah",
  "dishes": [
    {
      "itemId": "mi_chicken_biryani",
      "name": "Chicken Biryani",
      "qty": 60
    }
  ],
  "budget": 45000,
  "mode": "delivery",
  "address": {
    "line1": "House 12, Main Boulevard",
    "area": "Gulberg III",
    "city": "Lahore",
    "lat": 31.516,
    "lng": 74.342
  },
  "notes": "Please include raita.",
  "quotes": [
    {
      "version": 1,
      "lines": [
        {
          "itemId": "mi_chicken_biryani",
          "name": "Chicken Biryani",
          "qty": 60,
          "unitPrice": 520,
          "total": 31200
        }
      ],
      "subtotal": 37800,
      "deliveryFee": 1500,
      "total": 39300,
      "advancePct": 30,
      "advance": 11790,
      "validUntil": "2026-10-22T18:59:00.000Z",
      "notes": "Raita included.",
      "createdAt": "2026-10-15T10:00:00.000Z",
      "state": "outdated"
    }
  ],
  "acceptedVersion": 2,
  "advance": {
    "amount": 11070,
    "status": "awaiting_transfer",
    "payBy": "2026-10-17T10:00:00.000Z",
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
  "balance": 25830,
  "declineReason": null,
  "cancelReason": null,
  "canAccept": false,
  "canCancel": true,
  "canQuote": false,
  "createdAt": "2026-10-15T10:00:00.000Z",
  "updatedAt": "2026-10-15T10:00:00.000Z"
}
```

Accepting a quote a newer one has replaced:

<!-- contract: quoteOutdated -->
```json
{
  "error": {
    "code": "QUOTE_OUTDATED",
    "message": "Biryani Bazaar has sent a newer quote. Look at version 2.",
    "details": {
      "latest": 2
    }
  }
}
```

The kitchen's inbox (`?status=new|quoted|confirmed|past`), its calendar of events and its catering
settings:

<!-- contract: cateringInbox -->
```json
{
  "counts": {
    "new": 1,
    "quoted": 1,
    "confirmed": 0,
    "past": 0
  },
  "items": []
}
```

<!-- contract: cateringCalendar -->
```json
{
  "month": "2026-10",
  "days": [
    {
      "date": "2026-10-31",
      "events": [
        {
          "code": "CT-WGG77A",
          "time": "19:30",
          "guests": 60,
          "eventType": "aqiqah",
          "status": "confirmed",
          "customerName": "Ayesha Khan"
        }
      ]
    }
  ]
}
```

<!-- contract: cateringSettings -->
```json
{
  "open": true,
  "minGuests": 20,
  "leadDays": 2
}
```


### 2.11 Ramadan (5B)

The event comes from the staff calendar (`/admin/kitchen/calendar-events`). A kitchen can turn
Ramadan mode on from 30 days before the first fast (`opensOn`) to the last.

<!-- contract: ramadan -->
```json
{
  "event": {
    "name": "Ramadan 1448",
    "startsOn": "2027-02-08",
    "endsOn": "2027-03-09"
  },
  "state": "none",
  "opensOn": "2027-01-09",
  "enabled": false,
  "sehri": {
    "from": "02:30",
    "to": "04:30",
    "label": "2:30 AM – 4:30 AM"
  },
  "iftar": {
    "from": "17:30",
    "to": "19:00",
    "label": "5:30 PM – 7:00 PM"
  },
  "iftarPreorderOnly": true
}
```

Turned on in Ramadan (`PUT` answers the same shape):

<!-- contract: ramadanOn -->
```json
{
  "event": {
    "name": "Ramadan 1448",
    "startsOn": "2027-02-08",
    "endsOn": "2027-03-09"
  },
  "state": "active",
  "opensOn": "2027-01-09",
  "enabled": true,
  "sehri": {
    "from": "02:30",
    "to": "04:30",
    "label": "2:30 AM – 4:30 AM"
  },
  "iftar": {
    "from": "17:45",
    "to": "19:15",
    "label": "5:45 PM – 7:15 PM"
  },
  "iftarPreorderOnly": true
}
```

Outside that window:

<!-- contract: ramadanClosed -->
```json
{
  "error": {
    "code": "RAMADAN_NOT_ACTIVE",
    "message": "Ramadan mode opens on 2027-01-09, a month before the first fast.",
    "details": {
      "event": {
        "name": "Ramadan 1448",
        "startsOn": "2027-02-08"
      },
      "opensOn": "2027-01-09"
    }
  }
}
```

"Iftar near you" (`GET /food/ramadan/iftar?lat&lng`): kitchens within 10 km with Ramadan mode
on, nearest first. Outside Ramadan `items` is empty and `state` says why.

<!-- contract: iftarOpen -->
```json
{
  "state": "active",
  "event": {
    "name": "Ramadan 1448",
    "startsOn": "2027-02-08",
    "endsOn": "2027-03-09"
  },
  "items": [
    {
      "vendorId": "fb_resto",
      "slug": "biryani-bazaar",
      "name": "Biryani Bazaar",
      "logoUrl": "https://placehold.co/256x256/B45309/FFFFFF/png?text=BB",
      "coverUrl": "https://images.unsplash.com/photo-1559528896-c5310744cce8",
      "distanceKm": 0,
      "iftar": {
        "from": "17:45",
        "to": "19:15",
        "label": "5:45 PM – 7:15 PM"
      },
      "preorderOnly": true
    }
  ]
}
```

### 2.12 Storefront and demand (5B)

<!-- contract: storefront -->
```json
{
  "url": "https://metromatrix.app/s/biryani-bazaar",
  "qrUrl": "https://metromatrix.app/s/biryani-bazaar?via=qr",
  "slug": "biryani-bazaar",
  "name": "Biryani Bazaar",
  "shareText": "Order from Biryani Bazaar on Food Court: https://metromatrix.app/s/biryani-bazaar\nYou pay the kitchen directly; no commission is taken.",
  "stats": {
    "month": "2026-10",
    "link": 0,
    "qr": 0,
    "app": 1,
    "tiffin": 0
  }
}
```

`stats` counts this month's orders by where they came from (`origin.kind`, §5).

<!-- contract: demand -->
```json
{
  "city": "Lahore",
  "center": {
    "lat": 31.5102,
    "lng": 74.3441
  },
  "radiusKm": 8,
  "minCount": 10,
  "total": 1593,
  "hidden": 97,
  "cells": [
    {
      "geohash": "ttsg7c",
      "sw": {
        "lat": 31.51428,
        "lng": 74.34448
      },
      "ne": {
        "lat": 31.51978,
        "lng": 74.35547
      },
      "searches": 53,
      "unmetShare": 0.23
    },
    {
      "geohash": "ttsg5z",
      "sw": {
        "lat": 31.5033,
        "lng": 74.34448
      },
      "ne": {
        "lat": 31.50879,
        "lng": 74.35547
      },
      "searches": 52,
      "unmetShare": 0.44
    }
  ],
  "topUnmet": [
    {
      "query": "sushi",
      "searches": 116,
      "unmetShare": 0.91,
      "hour": 22
    },
    {
      "query": "halwa puri",
      "searches": 118,
      "unmetShare": 0.75,
      "hour": 0
    }
  ],
  "hourCurve": {
    "area": [0.77, 0.7, 0.28, 0, 0, 0, 0, 0, 0.4, 0.35, 0.39, 0, 0.34, 0.66, 0.33, 0.3, 0, 0.38, 0, 0.37, 0.7, 0.73, 0.81, 1],
    "own": [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0]
  }
}
```

### 2.13 Menu insights and experiments (5B)

<!-- contract: menuInsights -->
```json
{
  "range": "30d",
  "medians": {
    "sold": 174,
    "keep": 431.5
  },
  "items": [
    {
      "itemId": "mi_chicken_biryani",
      "name": "Chicken Biryani",
      "photoUrl": "https://images.unsplash.com/photo-1559528896-c5310744cce8",
      "price": 650,
      "hasSizes": true,
      "sold": 449,
      "keep": 424,
      "keepPct": 65,
      "popularity": 1,
      "profit": 0.38,
      "quadrant": "plowhorse",
      "suggestion": {
        "kind": "price",
        "text": "Popular but earns little. Look at its recipe card for savings.",
        "price": null
      },
      "experimentRunning": false
    },
    {
      "itemId": "mi_seekh",
      "name": "Seekh Kebab (4 pcs)",
      "photoUrl": "https://images.unsplash.com/photo-1626323109697-df55d20f06a8",
      "price": 900,
      "hasSizes": false,
      "sold": 237,
      "keep": 593,
      "keepPct": 66,
      "popularity": 0.53,
      "profit": 0.53,
      "quadrant": "star",
      "suggestion": {
        "kind": "keep",
        "text": "Sells well and earns well. Keep it where people see it first.",
        "price": null
      },
      "experimentRunning": false
    }
  ]
}
```

<!-- contract: experimentStart -->
```json
{
  "id": "ex_12bj",
  "itemId": "mi_seekh",
  "itemName": "Seekh Kebab (4 pcs)",
  "change": {
    "kind": "price",
    "price": 990,
    "oldPrice": 900
  },
  "days": 3,
  "startedAt": "2026-10-15T10:00:00.000Z",
  "endsAt": "2026-10-18T10:00:00.000Z",
  "status": "running",
  "progress": {
    "daysIn": 0,
    "days": 3
  },
  "result": null,
  "decidedAt": null
}
```

When it ends:

<!-- contract: experimentDone -->
```json
{
  "id": "ex_12bj",
  "itemId": "mi_seekh",
  "itemName": "Seekh Kebab (4 pcs)",
  "change": {
    "kind": "price",
    "price": 990,
    "oldPrice": 900
  },
  "days": 3,
  "startedAt": "2026-10-15T10:00:00.000Z",
  "endsAt": "2026-10-18T10:00:00.000Z",
  "status": "done",
  "progress": {
    "daysIn": 3,
    "days": 3
  },
  "result": {
    "verdict": "keep",
    "before": {
      "perDay": 7,
      "salesPerDay": 6300
    },
    "during": {
      "perDay": 7.3,
      "salesPerDay": 7227
    }
  },
  "decidedAt": null
}
```

### 2.14 Story, hygiene, batching (5B)

<!-- contract: storyPut -->
```json
{
  "text": "Three brothers from Gujranwala, cooking biryani the way our father did since 1998.",
  "cookName": "Imran Qureshi",
  "photoUrls": [
    "https://res.cloudinary.com/demo/kitchen.jpg"
  ],
  "videoUrl": null,
  "updatedAt": "2026-10-15T10:00:00.000Z"
}
```

<!-- contract: hygiene -->
```json
{
  "status": "self_declared",
  "note": null,
  "items": [
    {
      "key": "clean_kitchen",
      "label": "Kitchen and counters cleaned every day",
      "done": true,
      "evidenceUrl": null
    },
    {
      "key": "water",
      "label": "Filtered or boiled water for cooking",
      "done": true,
      "evidenceUrl": null
    }
  ],
  "requestedAt": null,
  "reviewedAt": null,
  "canRequest": true
}
```

After `POST /food/vendor/hygiene/request-verification`:

<!-- contract: hygieneRequest -->
```json
{
  "status": "pending",
  "note": null,
  "items": [
    {
      "key": "clean_kitchen",
      "label": "Kitchen and counters cleaned every day",
      "done": true,
      "evidenceUrl": null
    },
    {
      "key": "water",
      "label": "Filtered or boiled water for cooking",
      "done": true,
      "evidenceUrl": "https://res.cloudinary.com/demo/filter.jpg"
    }
  ],
  "requestedAt": "2026-10-15T10:00:00.000Z",
  "reviewedAt": null,
  "canRequest": false
}
```

Orders that could ride with this one (`GET /food/vendor/orders/:id/batch-suggestions`):

<!-- contract: batch -->
```json
{
  "items": [
    {
      "orderId": "fo_2w2dv",
      "code": "FC-Y9H2X6",
      "extraKm": 0,
      "sameDirection": true,
      "readyAt": "2026-10-15T10:00:00.000Z"
    }
  ]
}
```


### 2.15 My Kitchen (5C)

The customer's own kitchen. None of it ever reaches a kitchen on Food Court. The pantry, in base
units; `state` is `use_soon` within 3 days of `expiresOn` and `expired` after it:

<!-- contract: pantry -->
```json
{
  "counts": {
    "all": 9,
    "use_soon": 1,
    "expired": 5
  },
  "items": [
    {
      "id": "pn_seed_9",
      "name": "Coriander",
      "key": "coriander",
      "qty": 100,
      "unit": "g",
      "expiresOn": "2026-10-14",
      "state": "expired",
      "source": "manual",
      "addedAt": "2026-10-11T10:00:00.000Z"
    },
    {
      "id": "pn_seed_8",
      "name": "Beef mince",
      "key": "beef_mince",
      "qty": 500,
      "unit": "g",
      "expiresOn": "2026-10-16",
      "state": "expired",
      "source": "manual",
      "addedAt": "2026-10-11T10:00:00.000Z"
    }
  ]
}
```

Adding lines (a form, a voice draft, a receipt). `unit` is one people use (`kg`, `pao`, `dozen` …);
`key` is matched from the name when not sent; without `expiresOn` fresh food gets a usual shelf
life (meat 2 days, dairy 4, vegetables 7):

<!-- contract: pantryAdd -->
```json
{
  "items": [
    {
      "id": "pn_18l0",
      "name": "aloo",
      "key": "potato",
      "qty": 2000,
      "unit": "g",
      "expiresOn": "2026-10-22",
      "state": "use_soon",
      "source": "voice",
      "addedAt": "2026-10-19T10:00:00.000Z"
    }
  ]
}
```

Using something up (`{}` for all of it, or `{ qty, unit }`). Used within its last 3 days, it counts
as saved from waste:

<!-- contract: pantryUse -->
```json
{
  "item": null,
  "usedUp": true,
  "savedFromWaste": false
}
```

<!-- contract: pantryStats -->
```json
{
  "month": "2026-10",
  "used": 3,
  "savedFromWaste": 2,
  "wasted": 0,
  "inKitchen": 9
}
```

Grocery lines from the person's Shopping orders of the last 45 days (`GET
/my-kitchen/pantry/shopping-orders`), then adding them (`POST /my-kitchen/pantry/from-shopping-order
{ orderId, lineIds }`: each pack's net quantity × how many):

<!-- contract: pantryOrders -->
```json
{
  "items": [
    {
      "orderId": "o_rtk9ae",
      "code": "MM-IJR6GK-1",
      "storeName": "Daily Basket",
      "placedAt": "2026-10-19T10:00:00.000Z",
      "status": "placed",
      "lines": [
        {
          "lineId": "oi_ruwlpt",
          "name": "Tomatoes (1 kg)",
          "quantity": 1,
          "netQuantity": {
            "qty": 1000,
            "unit": "g"
          },
          "alreadyAdded": false
        }
      ]
    }
  ]
}
```

<!-- contract: pantryFromOrder -->
```json
{
  "items": [
    {
      "id": "pn_19du",
      "name": "Tomatoes (1 kg)",
      "key": "tomato",
      "qty": 1000,
      "unit": "g",
      "expiresOn": "2026-10-26",
      "state": "fresh",
      "source": "shopping",
      "addedAt": "2026-10-19T10:00:00.000Z"
    }
  ]
}
```

Recipe ideas (an assistant action, 30 a month for customers): recipes that use what is in the
pantry, those using what expires soonest first, then the fewest missing:

<!-- contract: recipeSuggest -->
```json
{
  "language": "en",
  "items": [
    {
      "id": "rc_aloo_bhujia",
      "title": "Aloo ki bhujia",
      "searchTerm": "bhujia",
      "minutes": 25,
      "servings": 4,
      "have": [
        "Potato",
        "Onion"
      ],
      "missing": [
        "Red chilli powder",
        "Cooking oil"
      ],
      "usesExpiring": [
        "Potato"
      ],
      "nutrition": {
        "kcal": 299,
        "protein": 5,
        "carbs": 42,
        "fat": 13
      }
    },
    {
      "id": "rc_aloo_paratha",
      "title": "Aloo paratha with dahi",
      "minutes": 35,
      "servings": 4,
      "have": [
        "Potato"
      ],
      "missing": [
        "Atta (wholewheat flour)",
        "Green chilli"
      ],
      "usesExpiring": [
        "Potato"
      ],
      "nutrition": {
        "kcal": 768,
        "protein": 23,
        "carbs": 117,
        "fat": 27
      }
    }
  ]
}
```

A recipe in the language asked for, scaled to `servings`:

<!-- contract: homeRecipe -->
```json
{
  "id": "rc_aloo_keema",
  "title": "آلو قیمہ",
  "searchTerm": "keema",
  "language": "ur",
  "minutes": 40,
  "servings": 4,
  "ingredients": [
    {
      "key": "beef_mince",
      "name": "قیمہ",
      "qty": 500,
      "unit": "g",
      "have": false,
      "usesExpiring": false
    },
    {
      "key": "potato",
      "name": "آلو",
      "qty": 400,
      "unit": "g",
      "have": true,
      "usesExpiring": true
    }
  ],
  "steps": [
    "پیاز کو تیل میں سنہری ہونے تک بھونیں۔",
    "ادرک لہسن اور قیمہ ڈال کر بھونیں۔"
  ],
  "nutrition": {
    "kcal": 570,
    "protein": 25,
    "carbs": 28,
    "fat": 40
  }
}
```

Its missing items from Shopping's grocers, cheapest per kilo, litre or piece first
(`packsNeeded` covers the recipe):

<!-- contract: missingItems -->
```json
{
  "items": [
    {
      "key": "beef_mince",
      "name": "Beef mince",
      "need": {
        "qty": 500,
        "unit": "g"
      },
      "options": [
        {
          "productId": "p_g20",
          "variantId": "p_g20_v0",
          "name": "Beef mince (500 g)",
          "store": {
            "id": "s_basket",
            "name": "Daily Basket"
          },
          "price": 650,
          "netQuantity": {
            "qty": 500,
            "unit": "g"
          },
          "pricePerUnit": {
            "amount": 1300,
            "per": "kg"
          },
          "packsNeeded": 1,
          "inStock": true
        }
      ]
    },
    {
      "key": "ginger_garlic",
      "name": "Ginger garlic paste",
      "need": {
        "qty": 30,
        "unit": "g"
      },
      "options": [
        {
          "productId": "p_g24",
          "variantId": "p_g24_v0",
          "name": "Ginger garlic paste (300 g)",
          "store": {
            "id": "s_basket",
            "name": "Daily Basket"
          },
          "price": 240,
          "netQuantity": {
            "qty": 300,
            "unit": "g"
          },
          "pricePerUnit": {
            "amount": 800,
            "per": "kg"
          },
          "packsNeeded": 1,
          "inStock": true
        }
      ]
    }
  ]
}
```

Nutrition settings. Off by default; `showCalories` is off until the person turns it on, and
off whenever nutrition is. `targetKcal` is the person's own number, else worked out from their
metrics and goal (Mifflin–St Jeor × activity, −400 to lose, +300 to gain):

<!-- contract: nutritionOff -->
```json
{
  "enabled": false,
  "showCalories": false,
  "goal": "eat_better",
  "metrics": null,
  "manualTargetKcal": null,
  "targetKcal": null,
  "updatedAt": null
}
```

<!-- contract: nutritionOn -->
```json
{
  "enabled": true,
  "showCalories": true,
  "goal": "maintain",
  "metrics": {
    "sex": "female",
    "age": 31,
    "heightCm": 163,
    "weightKg": 62,
    "activity": "moderate"
  },
  "manualTargetKcal": null,
  "targetKcal": 1920,
  "updatedAt": "2026-10-19T10:00:00.000Z"
}
```

The last `days` days of the person's delivered or collected Food Court orders (`409 NUTRITION_OFF`
while nutrition is off). `uncounted` dishes have no numbers (hidden by their kitchen, or never
worked out):

<!-- contract: nutritionSummary -->
```json
{
  "from": "2026-10-13",
  "to": "2026-10-19",
  "scope": "food_court_orders",
  "days": [
    {
      "date": "2026-10-13",
      "kcal": 0,
      "protein": 0,
      "carbs": 0,
      "fat": 0,
      "orders": 0
    },
    {
      "date": "2026-10-14",
      "kcal": 0,
      "protein": 0,
      "carbs": 0,
      "fat": 0,
      "orders": 0
    }
  ],
  "averageOnOrderDays": {
    "kcal": 0,
    "protein": 0,
    "carbs": 0,
    "fat": 0
  },
  "topDishes": [],
  "uncounted": 0,
  "targetKcal": 1920
}
```

`DELETE /my-kitchen/nutrition` removes the settings and metrics (the summary is worked out, never
stored):

<!-- contract: nutritionDelete -->
```json
{
  "deleted": true,
  "settings": {
    "enabled": false,
    "showCalories": false,
    "goal": "eat_better",
    "metrics": null,
    "manualTargetKcal": null,
    "targetKcal": null,
    "updatedAt": null
  }
}
```

Healthy picks nearby (`GET /food/healthy-picks?lat&lng`): meals under 600 kcal a person, or high
in protein (25 g or more, at least a fifth of the calories) at up to 800 kcal a person, from open
kitchens and only dishes that can be ordered now (empty when none are):

<!-- contract: healthyPicks -->
```json
{
  "items": [
    {
      "itemId": "mi_tikka",
      "name": "Chicken Tikka (leg)",
      "photoUrl": "https://images.unsplash.com/photo-1773419808002-bab9e1f840a0",
      "price": 550,
      "kcal": 494,
      "protein": 49,
      "serves": 1,
      "tags": [
        "under_600",
        "high_protein"
      ],
      "vendor": {
        "id": "fb_resto",
        "slug": "biryani-bazaar",
        "name": "Biryani Bazaar"
      }
    },
    {
      "itemId": "mi_malai",
      "name": "Malai Boti",
      "photoUrl": null,
      "price": 980,
      "kcal": 538,
      "protein": 61,
      "serves": 1,
      "tags": [
        "under_600",
        "high_protein"
      ],
      "vendor": {
        "id": "fb_resto",
        "slug": "biryani-bazaar",
        "name": "Biryani Bazaar"
      }
    }
  ]
}
```

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
| `expiring_stock` | stock expires today (critical) or tomorrow (warning) | `make_special` while the assistant is on (its ingredients as `ingredientIds`), else `create_surplus` |
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

### 3.9 Tiffin

- **A plan.** `name` 3–60 characters; `meal` `breakfast | lunch | dinner`; `days` 1–7 weekdays;
  `period` `week | month` (a month is four weeks, so every period has the same meals); `price`
  ≥ Rs 100 a period; `capacity` 1–500 (never under the subscribers it has); `skipCutoffHours`
  2–48; a `rotation` entry per day: up to four dishes from the kitchen's menu, or a note. Up to 6
  active plans (`409 TIFFIN_PLAN_LIMIT`). A plan with subscribers can't be deleted
  (`409 TIFFIN_HAS_SUBSCRIBERS`); without any it is deleted, or deactivated if it had some once.
- **Subscribing** needs an `Idempotency-Key`. The start is a plan day within 30 days whose
  cut-off hasn't passed. Delivery plans need a pinned address (`422 ADDRESS_LOCATION_REQUIRED`).
  Payment is `transfer` (needs a kitchen account, else `422 PAYMENT_METHOD_UNAVAILABLE`) or
  `cash`. One subscription a person per plan (`409 TIFFIN_ALREADY_SUBSCRIBED`); a full plan
  answers `409 TIFFIN_FULL`. It starts `pending`.
- **The kitchen** approves (`active`; a start whose cut-off passed while it waited moves to the
  next open day; the first period opens) or declines with a reason. It can pause, resume and end
  a subscription; the customer can pause, resume and cancel.
- **Periods.** Each period's amount is the plan's price less `credit`: the meals skipped in the
  period before, at `perMeal`. A transfer is due by the end of the period's first day
  (`awaiting_transfer`, then `proof_submitted`, then `paid` when the kitchen confirms); cash is
  `unpaid` until the kitchen confirms it. A new period opens when one ends.
- **Days.** A day can be skipped (or un-skipped) until its cut-off: `skipCutoffHours` before the
  window starts. After that, `409 TIFFIN_SKIP_CLOSED { cutoffAt }`. Pausing starts at the first
  day still open, and lasts until resumed or until `until`.
- **At the cut-off** each day becomes an order on the kitchen's board: `accepted`, scheduled for
  the window's start, promised for its end, `payment.method: "tiffin_plan"` (status `paid`), the
  rotation's dishes, `origin { kind: "tiffin", ref: code }`. It is taken from stock like any
  accepted order and moves along the board as usual.
- **Ending** (customer cancel or kitchen end) keeps the days already closed; unpaid periods after
  them are void.

### 3.10 Catering

- **A request**: a date at least `leadDays` ahead (and within 180 days), a time, `guests` from the
  kitchen's `minGuests` to 2,000, an `eventType` (`mehndi | baraat | walima | birthday | aqiqah |
  milad | quran_khwani | office | family | other`), 1–20 dishes (from the menu, or named), an
  optional budget, and `mode` `delivery | pickup | on_site` (an address unless pickup:
  `422 ADDRESS_REQUIRED`). A kitchen not taking requests answers `409 CATERING_CLOSED`.
- **Quotes.** The kitchen sends lines (menu dishes or named lines, `qty × unitPrice`), a delivery
  fee, `advancePct` 0–100 and `validUntil` (before the event). Each quote is a new version; the
  request is `quoted`.
- **Accepting.** Only the latest version, before it expires: else `409 QUOTE_OUTDATED { latest }`
  or `409 QUOTE_EXPIRED { validUntil }`. With an advance the request is `accepted` and the advance
  is due within 48 hours (a transfer to the kitchen's own account, then the receipt); without one
  it is `confirmed` at once.
- **The advance.** The kitchen confirms it (`confirmed`) or rejects the receipt with a reason (back
  to awaiting). The balance is settled with the kitchen on the day.
- **Declining and cancelling.** The kitchen declines a request it can't take (with a reason); the
  customer cancels before paying the advance. A confirmed event is `completed` once its day has
  passed.

### 3.11 Ramadan

- `state` is `active` from `startsOn` to `endsOn`, `upcoming` from `opensOn` (30 days before),
  else `none`. `PUT` outside `upcoming | active` answers `409 RAMADAN_NOT_ACTIVE { event,
  opensOn }`.
- Windows are kitchen-local `HH:MM`, `from` before `to`. With `iftarPreorderOnly` the kitchen
  takes orders for the iftar window only as scheduled orders (Food's `scheduledFor`).
- The vendor page carries `ramadan { sehri, iftar, iftarPreorderOnly }` while it is on, else `null` (§5).

### 3.12 Demand, menu insights, experiments

- **Demand** is built from anonymous searches (geohash-6 cell, hour, cuisine, whether an open
  kitchen was found), the last 30 days, within 8 km of the kitchen. A cell with fewer than
  `minCount` (10) searches is never sent; `hidden` counts the searches left out. No search is
  ever tied to a person. `unmetShare` is the share of searches that found no open kitchen.
  `hourCurve.area` is the area's searches by kitchen-local hour; `own` is this kitchen's orders.
- **Menu insights** compare the last 30 days. `popularity` and `profit` are 0–1 against the
  menu's best; a dish is a `star` (sold and `keep` both at or above the menu's medians), a
  `plowhorse` (sells, earns little), a `puzzle` (earns, sells little), a `dog` (neither), or
  `unknown` without a recipe card (`keep` is null).
- **Experiments**: one change to one dish, for 3–14 days: a new price (dishes without sizes,
  within 40% of today's; with sizes `422 EXPERIMENT_NOT_SUPPORTED`) or a new photo. One at a time
  per dish (`409 EXPERIMENT_RUNNING`), three at a time per kitchen (`409 EXPERIMENT_LIMIT { max }`).
  The change applies at once (the menu shows it). At the end `result` compares the same number of
  days before and during: for a price, sales per day (`salesPerDay`, orders × price) up 3% or more
  is `keep`, within 3% `adjust`, else `drop`; for a photo, orders per day up 5% is `keep`, within
  5% `adjust`, else `drop`. The kitchen settles it with `keep`, `adjust { price }` (prices only,
  within 40% of the old one) or `drop` (the old price or photo comes back); `stop` ends a running
  test early, also putting the old one back.

### 3.13 Story, hygiene, badges, batching

- **Story**: 20–600 characters, a cook's name (2–60), up to 6 photos and one short video,
  uploaded with the purpose `food_story`; checklist evidence uses `hygiene_evidence`.
- **Hygiene**: the kitchen ticks the six checklist items (a photo is optional evidence); with all
  six it is `self_declared` (before that `none`). `request-verification` needs all six
  (`422 HYGIENE_INCOMPLETE { missing }`) and makes it `pending`; staff verify it, or reject it with
  a note (`rejected`, which can be requested again). The vendor page shows only `status` and
  `checkedAt`.
- **Badges** on vendor cards: `signature` (a dish the kitchen marks as its signature on its recipe card; staff can remove it), `hygiene_verified`,
  `hygiene_self_declared` (also while `pending`), `home_kitchen`, `bachat_today` (a Bachat Box
  open today).
- **Batching**: the kitchen's other delivery orders that are accepted, preparing or ready, with no
  rider yet (or this order's rider), whose drop is within 3 km of this one's (`extraKm`).
  `sameDirection` when the two drops lie within 45° of each other as seen from the kitchen; those
  come first, then the nearest. A rider carrying two or more of the kitchen's orders gets
  `dropOrder { position, of }` on each, nearest the kitchen first.

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
| GET, POST | `/plans` | `{ name, description?, meal, days, period, price, mode, window { from, to }, capacity, skipCutoffHours, rotation [{ weekday, itemIds, note }], photoUrl? }` (§3.9) |
| GET, PATCH, DELETE | `/plans/:id` | DELETE answers `{ removed, deactivated }` |
| GET | `/plans/:id/subscribers` | `{ counts, items }` |
| GET | `/subscriptions?status=pending\|active\|paused\|ended` | `{ counts { pending, active, paused, toCheck }, items }` |
| POST | `/subscriptions/:code/{approve,decline,pause,resume,end}` | decline `{ reason }`; pause `{ until? }`; end `{ reason? }` |
| POST | `/periods/:id/payment/{confirm,reject}` | reject `{ reason }` |
| GET | `/tomorrow` | §2.9 |

**Tiffin, for customers** (`/food/tiffin`):

| Method | Path | Notes |
|---|---|---|
| GET | `/plans?vendor=`, `/plans/:id` | `vendor`: brand id or slug |
| POST | `/plans/:id/subscribe` | Idempotency-Key; `{ startDate, addressId?, paymentMethod: transfer\|cash }` |
| GET | `/subscriptions`, `/subscriptions/:code` | |
| GET | `/subscriptions/:code/calendar?month=YYYY-MM` | |
| POST | `/subscriptions/:code/days/:date/{skip,unskip}` | `409 TIFFIN_SKIP_CLOSED { cutoffAt }` |
| POST | `/subscriptions/:code/{pause,resume,cancel}` | pause `{ until? }` |
| POST | `/periods/:id/payment-proof` | `{ transactionId, imageUrl? }` |

At the cut-off, the next day's tiffins become scheduled orders (`origin.kind: "tiffin"`,
payment `tiffin_plan`).

**Catering, for customers** (`/food/catering`):

| Method | Path | Notes |
|---|---|---|
| GET | `/vendors/:id` | what the kitchen takes, its menu (§2.10) |
| POST | `/requests` | `{ vendorId, date, time, guests, eventType, dishes [{ itemId \| name, qty }], budget?, mode, addressId?, notes? }` |
| GET | `/requests`, `/requests/:code` | |
| POST | `/requests/:code/quotes/:version/accept` | `409 QUOTE_OUTDATED`, `409 QUOTE_EXPIRED` |
| POST | `/requests/:code/advance-proof`, `/requests/:code/cancel` | proof `{ transactionId, imageUrl? }` |

**Catering, for the kitchen** (`/food/vendor/catering`):

| Method | Path | Notes |
|---|---|---|
| GET, PATCH | `/settings` | `{ open, minGuests, leadDays }` |
| GET | `/requests?status=new\|quoted\|confirmed\|past`, `/requests/:code` | |
| POST | `/requests/:code/quotes` | `{ lines [{ itemId? \| name, qty, unitPrice }], deliveryFee, advancePct, validUntil, notes? }` → version n |
| POST | `/requests/:code/{decline,advance/confirm,advance/reject}` | decline and reject `{ reason }` |
| GET | `/calendar?month=YYYY-MM` | |

**Everything else in 5B:**

| Area | Routes |
|---|---|
| Ramadan | `GET/PUT /food/vendor/ramadan` (`{ enabled, sehri { from, to }, iftar { from, to }, iftarPreorderOnly }`; `409 RAMADAN_NOT_ACTIVE` outside an event or 30 days before it); `GET /food/ramadan/iftar?lat&lng` |
| Storefront | `GET /food/vendor/storefront` → `{ url, qrUrl, slug, name, shareText, stats { month, link, qr, app, tiffin } }` (§2.12); checkout's `source` (§5) counts orders by channel |
| Demand | `GET /food/vendor/demand?cuisine&hour` → `{ city, center, radiusKm, minCount, total, hidden, cells [{ geohash, sw, ne, searches, unmetShare }], topUnmet [{ query, searches, unmetShare, hour }], hourCurve { area[24], own[24] } }`; cells under `minCount` (10) are never sent |
| Menu insights | `GET /food/vendor/menu-insights?range=30d` → items with `popularity`, `profit` (0–1 against the menu), `quadrant: star\|plowhorse\|puzzle\|dog`, `suggestion` |
| Experiments | `GET/POST /food/vendor/experiments` (`{ itemId, change: { kind: price, price } \| { kind: photo, photoUrl }, days (3–14) }`), `GET /experiments/:id` (progress, `result { verdict: keep\|adjust\|drop, before, during }`), `POST /experiments/:id/{keep,adjust,drop}` |
| Story and hygiene | `GET/PUT /food/vendor/story` (`{ text, cookName, photoUrls ≤ 6, videoUrl? }`); `GET /food/vendor/hygiene` (`{ status: self_declared\|pending\|verified\|rejected, note, items [{ key, label, done, evidenceUrl }] }`), `PUT /hygiene/items/:key`, `POST /hygiene/request-verification` |
| Batching | `GET /food/vendor/orders/:id/batch-suggestions` → `{ items [{ orderId, code, extraKm, sameDirection, readyAt }] }`; rider orders carry `dropOrder` (§5) |

### 4.7 The assistant, nutrition, My Kitchen (5C)

The assistant's routes are in `docs/AI_ASSUMED.md`.

Vendor nutrition (`GET /food/vendor/nutrition`). Per dish as it is sold (its recipe card ÷ its
yield): `method: recipe` from mapped ingredients (`confidence` falls 0.12 for each unmapped one,
named in `missing`); a dish without a card gets `ai_estimate` from its name (counted once, as an
assistant action), or `none` while the assistant is off or used up. `unmapped` lists ingredients
without a nutrition food, the dishes they are in, and up to three suggestions:

<!-- contract: nutrition -->
```json
{
  "counts": {
    "recipe": 10,
    "estimate": 5,
    "none": 0,
    "hidden": 0
  },
  "items": [
    {
      "itemId": "mi_chicken_biryani",
      "name": "Chicken Biryani",
      "hidden": false,
      "kcal": 973,
      "protein": 43,
      "carbs": 118,
      "fat": 35,
      "method": "recipe",
      "confidence": 0.83,
      "missing": [
        "House biryani masala"
      ]
    },
    {
      "itemId": "mi_beef_biryani",
      "name": "Beef Biryani",
      "hidden": false,
      "kcal": 1058,
      "protein": 46,
      "carbs": 115,
      "fat": 44,
      "method": "recipe",
      "confidence": 0.71,
      "missing": [
        "Aloo bukhara (dried plums)",
        "House biryani masala"
      ]
    }
  ],
  "unmapped": [
    {
      "ingredientId": "ing_bb_biryani_masala",
      "name": "House biryani masala",
      "usedIn": [
        "Chicken Biryani",
        "Beef Biryani"
      ],
      "suggestions": [
        {
          "foodId": "nf_biryani_masala",
          "name": "Biryani masala",
          "per": "g100"
        },
        {
          "foodId": "nf_garam_masala",
          "name": "Garam masala",
          "per": "g100"
        }
      ]
    },
    {
      "ingredientId": "ing_bb_aloo_bukhara",
      "name": "Aloo bukhara (dried plums)",
      "usedIn": [
        "Beef Biryani"
      ],
      "suggestions": [
        {
          "foodId": "nf_aloo_bukhara",
          "name": "Aloo bukhara (dried plums)",
          "per": "g100"
        }
      ]
    }
  ]
}
```

Hiding a dish's numbers from customers (`PATCH /food/vendor/nutrition/:itemId { hidden }`) answers
its row:

<!-- contract: nutritionHide -->
```json
{
  "itemId": "mi_kheer",
  "name": "Kheer",
  "hidden": true,
  "kcal": 330,
  "protein": 8,
  "carbs": 48,
  "fat": 12,
  "method": "ai_estimate",
  "confidence": 0.55,
  "missing": []
}
```

Mapping an ingredient is the ordinary ingredient edit (`PATCH /food/vendor/kitchen/ingredients/:id
{ nutritionFoodId }`), from `GET /food/vendor/kitchen/nutrition-foods?q=`:

<!-- contract: nutritionFoods -->
```json
{
  "items": [
    {
      "id": "nf_aloo_bukhara",
      "name": "Aloo bukhara (dried plums)",
      "per": "g100",
      "kcal": 240,
      "protein": 2,
      "carbs": 64,
      "fat": 0.4
    }
  ]
}
```


Customers (`/my-kitchen`):

| Area | Routes |
|---|---|
| Pantry | `GET /pantry?segment=all\|use_soon\|expired`, `POST /pantry { lines [{ name, key?, qty, unit, expiresOn? }] (1–30), source? }`, `PATCH /pantry/:id { qty, unit, expiresOn }`, `DELETE /pantry/:id` (thrown away), `POST /pantry/:id/use { qty?, unit? }`, `GET /pantry/shopping-orders`, `POST /pantry/from-shopping-order { orderId, lineIds }`, `GET/PUT /pantry/reminders { enabled, time, daysBefore (0–3) }`, `GET /stats?month` (§2.15) |
| Recipes | `POST /recipes/suggest { language: ur\|en, maxMinutes? (5–240), servings? (1–20) }`, `GET /recipes/:id?language&servings`, `GET /recipes/:id/missing-items?servings` (Shopping's grocery packs with `pricePerUnit`) |
| Nutrition | `GET/PUT /nutrition/settings` (`{ enabled, showCalories, goal: eat_better\|maintain\|lose\|gain, metrics { sex, age, heightCm, weightKg, activity: low\|moderate\|high } \| null, manualTargetKcal (1,000–5,000) \| null }` → computed `targetKcal`), `DELETE /nutrition` (all of it), `GET /nutrition/summary?days=7` (1–30; ordered Food Court food only) |
| Food | `GET /food/healthy-picks?lat&lng`; search's `?nutrition=under_600\|high_protein` (per person) |

Groceries are Shopping products with a `netQuantity { qty, unit }` and the ingredient they are
(an assumed Shopping addition, `TODO(API_SHOPPING)`); the dummy API's are Daily Basket's.

### 4.8 Staff (`/admin/kitchen`)

Staff only (`admin`, `super_admin`); anyone else gets `403 FORBIDDEN`. Every list is the whole
platform's.

| Method | Path | Notes |
|---|---|---|
| PATCH | `/ai/settings` | `{ enabled }`: the assistant's switch for everyone |
| PUT | `/ai/quotas/:ownerId` | `{ limit \| null }`: a kitchen's (business id) or customer's monthly actions; `null` = the plan's |
| GET | `/ai/usage?from&to` | by feature and by kitchen or customer (dates in Pakistan time; the last 30 days by default, up to 93) |
| GET | `/reference-prices?city&q` | the city's latest week, per kg, litre or piece, with the change over four weeks |
| POST | `/reference-prices?dryRun=true` | `{ csv }` with the columns `key,city,week,price`: the dry run checks every row; without `dryRun` it imports, all or nothing |
| GET / POST / PATCH | `/nutrition-foods?q&page&pageSize`, `/nutrition-foods/:id` | per 100 g (`g100`), 100 ml (`ml100`) or piece; `usedBy` counts the kitchens' ingredients mapped to it |
| POST | `/nutrition-foods/import?dryRun=true` | `{ csv }` with `key,name,per,kcal,protein,carbs,fat`; adds new keys, updates the rest |
| GET | `/ingredient-keys?q` | the ingredients an alias can point at (up to 50) |
| GET / POST / DELETE | `/aliases?q`, `/aliases/:id` | `{ word, language: ur\|roman_ur\|en, key }`: what voice and receipts understand |
| GET / POST / PATCH / DELETE | `/calendar-events`, `/calendar-events/:id` | `{ kind: ramadan\|eid\|other, name, startsOn, endsOn }` (up to 40 days); Ramadan events never overlap |
| GET | `/hygiene?status=pending\|verified\|rejected`; POST `/hygiene/:businessId/{verify,reject} { note }` | a note (3–300) is required to reject (§2.13) |
| GET | `/signatures?status=new\|approved\|removed`; POST `/signatures/:itemId/{approve,remove} { note }` | removing needs a note (3–300), which the kitchen sees, and turns the label off |
| GET | `/demand?city&cuisine&hour` | a city's searches (30 km), under the same anonymity rule as a kitchen's map |
| GET | `/lookup?code` | a tiffin (`TF-`) or catering (`CT-`) code, as its kitchen sees it |

Rules:

- **CSV.** UTF-8, the first row names the columns (in any order), up to 2,000 rows. A dry run
  answers every problem by row (the first 50) and imports nothing. An import with any problem is
  refused whole with `422 CSV_HAS_ERRORS { errors }`, so a file is never half imported. A price is
  rupees per kg, litre or piece, for the week starting on its Monday.
- **Aliases.** Roman Urdu and English words are kept in lower case. The same word in the same
  language means one thing: `409 ALIAS_EXISTS { key }`.
- **Calendar.** Kitchens' Ramadan mode follows the Ramadan event (§3.9). Its dates are approximate
  until the moon is sighted, so staff move them here.
- **Signatures.** A new signature dish (or one changed since it was approved) is `new` until staff
  look at it. Taking the label off turns it off on every size of the dish; the kitchen reads the
  note on the recipe (`signature.removedNote`, while the label stays off) and as an insight card
  (`signature_removed`) for two weeks. Turning it on again makes it `new` again.

The assistant's use (`GET /ai/usage`):

<!-- contract: adminAiUsage -->
```json
{
  "from": "2026-09-20",
  "to": "2026-10-19",
  "enabled": true,
  "totals": {
    "actions": 228,
    "failures": 4,
    "avgMs": 1208,
    "failureRate": 0.02,
    "p50Ms": 932,
    "p95Ms": 2893
  },
  "byFeature": [
    {
      "feature": "voice",
      "actions": 139,
      "failures": 2,
      "avgMs": 807
    }
  ],
  "byOwner": [
    {
      "ownerId": "b_resto",
      "kind": "kitchen",
      "name": "Biryani Bazaar",
      "actions": 106,
      "failures": 1,
      "avgMs": 1000,
      "usedThisMonth": 12,
      "limit": 300,
      "override": null
    }
  ]
}
```

The city price list (`GET /reference-prices?city=Lahore&q=tom`), a dry run, and an import refused:

<!-- contract: adminPrices -->
```json
{
  "city": "Lahore",
  "cities": [
    "Islamabad",
    "Karachi",
    "Lahore"
  ],
  "week": "2026-10-12",
  "items": [
    {
      "key": "tomato",
      "name": "Tomato",
      "price": 171,
      "unit": "kg",
      "changePct": 22
    }
  ]
}
```

<!-- contract: adminPricePreview -->
```json
{
  "dryRun": true,
  "rows": 3,
  "valid": 1,
  "errors": [
    {
      "row": 3,
      "field": "week",
      "message": "The Monday the week starts, as YYYY-MM-DD"
    },
    {
      "row": 4,
      "field": "key",
      "message": "No ingredient \"shimla\""
    }
  ],
  "preview": [
    {
      "row": 2,
      "key": "tomato",
      "name": "Tomato",
      "city": "Lahore",
      "week": "2026-10-19",
      "price": 190,
      "unit": "kg",
      "previous": null
    },
    {
      "row": 3,
      "key": "onion",
      "name": "Onion",
      "city": "Lahore",
      "week": "2026-10-20",
      "price": 150,
      "unit": "kg",
      "previous": null
    }
  ],
  "imported": 0
}
```

<!-- contract: adminPriceRefused -->
```json
{
  "error": {
    "code": "CSV_HAS_ERRORS",
    "message": "2 rows have problems. Fix them and try again; nothing was imported.",
    "details": {
      "errors": [
        {
          "row": 3,
          "field": "week",
          "message": "The Monday the week starts, as YYYY-MM-DD"
        },
        {
          "row": 4,
          "field": "key",
          "message": "No ingredient \"shimla\""
        }
      ]
    }
  }
}
```

Nutrition foods, a new one, and an import's dry run (`change: new | update | same`):

<!-- contract: adminFoods -->
```json
{
  "items": [
    {
      "id": "nf_tomato",
      "key": "tomato",
      "name": "Tomato",
      "per": "g100",
      "kcal": 18,
      "protein": 0.9,
      "carbs": 3.9,
      "fat": 0.2,
      "usedBy": 3,
      "updatedAt": "2026-08-16T10:00:00.000Z"
    }
  ],
  "total": 1,
  "page": 1,
  "pageSize": 30
}
```

<!-- contract: adminFoodCreate -->
```json
{
  "id": "nf_1aw9",
  "key": "shimla_mirch",
  "name": "Shimla mirch (capsicum)",
  "per": "g100",
  "kcal": 20,
  "protein": 0.9,
  "carbs": 4.6,
  "fat": 0.2,
  "usedBy": 0,
  "updatedAt": "2026-10-19T10:00:00.000Z"
}
```

<!-- contract: adminFoodImport -->
```json
{
  "dryRun": true,
  "rows": 2,
  "valid": 2,
  "errors": [],
  "preview": [
    {
      "row": 2,
      "key": "shimla_mirch",
      "name": "Shimla mirch (capsicum)",
      "per": "g100",
      "kcal": 21,
      "protein": 0.9,
      "carbs": 4.6,
      "fat": 0.2,
      "change": "same"
    },
    {
      "row": 3,
      "key": "khoya",
      "name": "Khoya",
      "per": "g100",
      "kcal": 421,
      "protein": 14.6,
      "carbs": 25,
      "fat": 30,
      "change": "new"
    }
  ],
  "imported": 0
}
```

Aliases (`GET /aliases?q=tamatar`), the keys they point at, a new one, and a word that already
means something:

<!-- contract: adminAliases -->
```json
{
  "items": [
    {
      "id": "al_1",
      "word": "tamatar",
      "language": "roman_ur",
      "key": "tomato",
      "keyName": "Tomato"
    }
  ],
  "total": 1
}
```

<!-- contract: adminKeys -->
```json
{
  "items": [
    {
      "key": "tomato",
      "name": "Tomato"
    }
  ]
}
```

<!-- contract: adminAliasCreate -->
```json
{
  "id": "al_1bk1",
  "word": "tomatar",
  "language": "roman_ur",
  "key": "tomato",
  "keyName": "Tomato"
}
```

<!-- contract: adminAliasExists -->
```json
{
  "error": {
    "code": "ALIAS_EXISTS",
    "message": "“tomatar” already means Tomato.",
    "details": {
      "key": "tomato"
    }
  }
}
```

Calendar events, a new one, and a Ramadan that overlaps another:

<!-- contract: adminEvents -->
```json
{
  "items": [
    {
      "id": "ev_ramadan_1448",
      "kind": "ramadan",
      "name": "Ramadan 1448",
      "startsOn": "2027-02-08",
      "endsOn": "2027-03-09",
      "days": 30,
      "state": "upcoming"
    }
  ]
}
```

<!-- contract: adminEventCreate -->
```json
{
  "id": "ev_1cbo",
  "kind": "other",
  "name": "Basant",
  "startsOn": "2027-02-05",
  "endsOn": "2027-02-06",
  "days": 2,
  "state": "upcoming"
}
```

<!-- contract: adminEventOverlap -->
```json
{
  "error": {
    "code": "EVENT_OVERLAP",
    "message": "It overlaps Ramadan 1448.",
    "details": {
      "id": "ev_ramadan_1448"
    }
  }
}
```

Signature dishes (`?status=new`, with the counts of each) and one taken off:

<!-- contract: adminSignatures -->
```json
{
  "items": [
    {
      "itemId": "mi_chicken_biryani",
      "name": "Chicken Biryani",
      "photoUrl": "https://images.unsplash.com/photo-1559528896-c5310744cce8",
      "vendor": {
        "id": "fb_resto",
        "name": "Biryani Bazaar",
        "slug": "biryani-bazaar"
      },
      "creatorName": "Imran Qureshi",
      "status": "new",
      "note": null,
      "reviewedAt": null
    }
  ],
  "counts": {
    "new": 4,
    "approved": 0,
    "removed": 0
  }
}
```

<!-- contract: adminSignatureRemove -->
```json
{
  "itemId": "mi_seekh",
  "name": "Seekh Kebab (4 pcs)",
  "photoUrl": "https://images.unsplash.com/photo-1626323109697-df55d20f06a8",
  "vendor": {
    "id": "fb_resto",
    "name": "Biryani Bazaar",
    "slug": "biryani-bazaar"
  },
  "creatorName": "Imran Qureshi",
  "status": "removed",
  "note": "The same seekh is sold next door; a signature dish should be your own.",
  "reviewedAt": "2026-10-19T10:00:00.000Z"
}
```

The platform's demand map (`GET /demand?city=Lahore`; `hourCurve` has the area only):

<!-- contract: adminDemand -->
```json
{
  "city": "Lahore",
  "cities": [
    "Lahore",
    "Karachi",
    "Islamabad"
  ],
  "center": {
    "lat": 31.5204,
    "lng": 74.3587
  },
  "radiusKm": 30,
  "minCount": 10,
  "total": 2064,
  "hidden": 159,
  "cells": [
    {
      "geohash": "ttsg5h",
      "sw": {
        "lat": 31.48682,
        "lng": 74.31152
      },
      "ne": {
        "lat": 31.49231,
        "lng": 74.32251
      },
      "searches": 45,
      "unmetShare": 0.38
    }
  ],
  "topUnmet": [
    {
      "query": "sushi",
      "searches": 159,
      "unmetShare": 0.91,
      "hour": 22
    }
  ],
  "hourCurve": {
    "area": [
      0.76,
      0.74,
      0.31,
      0,
      0,
      0,
      0,
      0,
      0.39,
      0.42,
      0.44,
      0,
      0.41,
      0.71,
      0.37,
      0.37,
      0,
      0.38,
      0,
      0.41,
      0.81,
      0.73,
      0.82,
      1
    ]
  }
}
```

A code looked up (`GET /lookup?code=TF-HMZ4K2`); a catering code answers `{ kind: "catering",
tiffin: null, catering }` with the request as its kitchen sees it (§3.6):

<!-- contract: adminLookup -->
```json
{
  "kind": "tiffin",
  "tiffin": {
    "code": "TF-HMZ4K2",
    "status": "active",
    "plan": {
      "id": "tp_nani_lunch",
      "name": "Office lunch tiffin",
      "meal": "lunch",
      "days": [
        1,
        2,
        3,
        4,
        5
      ],
      "period": "week",
      "price": 2300,
      "perMeal": 460,
      "mode": "delivery",
      "window": {
        "from": "12:30",
        "to": "13:30",
        "label": "12:30 PM – 1:30 PM"
      },
      "skipCutoffHours": 14
    },
    "vendor": {
      "id": "fb_nani",
      "slug": "nani-ki-handi",
      "name": "Nani ki Handi",
      "logoUrl": "https://placehold.co/256x256/7C2D12/FFFFFF/png?text=NH",
      "phone": "+923001110010"
    },
    "customer": {
      "name": "Hamza Qureshi",
      "phone": "+923451234567"
    },
    "startDate": "2026-10-12",
    "endDate": null,
    "nextDelivery": {
      "date": "2026-10-19",
      "dishes": [
        "Daal chawal with achaar"
      ],
      "cutoffAt": "2026-10-18T17:30:00.000Z"
    },
    "address": {
      "line1": "Office 4, Siddiq Trade Centre, Main Boulevard",
      "area": "Gulberg III",
      "city": "Lahore",
      "lat": 31.5137,
      "lng": 74.3502
    },
    "paymentMethod": "transfer",
    "period": {
      "id": "tpd_17h5",
      "from": "2026-10-19",
      "to": "2026-10-25",
      "meals": 5,
      "credit": 0,
      "amount": 2300,
      "payment": {
        "method": "transfer",
        "status": "awaiting_transfer",
        "payBy": "2026-10-19T18:59:00.000Z",
        "accounts": [
          {
            "kind": "easypaisa",
            "accountTitle": "Shazia Parveen",
            "accountNumber": "+923001110010",
            "bankName": null
          }
        ],
        "reference": null,
        "proofUrl": null,
        "rejectedReason": null
      }
    },
    "pausedFrom": null,
    "pausedUntil": null,
    "declineReason": null,
    "endReason": null,
    "canPause": true,
    "canResume": false,
    "canCancel": false,
    "createdAt": "2026-10-06T10:00:00.000Z"
  },
  "catering": null
}
```

A kitchen's monthly limit raised or lowered (`PUT /ai/quotas/b_resto { limit: 1 }`):

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
| `VendorPage` | `story`, `hygiene { status, checkedAt }`, `signatureItemIds`, `ramadan`, `tiffinPlans [{ id, name, meal, days, period, price, perMeal, window, seatsLeft, photoUrl }]`, `catering { open, minGuests, leadDays }` | 5B |
| Dish (menu card, item sheet, search) | `nutrition { kcal, protein, carbs, fat, method, serves }` (per order as sold, for `serves` people; null when the kitchen hides it or it was never worked out), `descriptionUr`, `isSignature` | 5B–5C |
| `GET /food/search` | `?nutrition=under_600\|high_protein` | 5C |
| Payment method | `tiffin_plan` | an order a tiffin period paid for (5B) |
| `GET /food/vendor/reviews` | `?theme=`, `?week=` (a Monday) | a review theme's reviews (5C) |
| Dish body (`POST`/`PATCH /food/vendor/menu/items`) | `descriptionUr` | the Urdu description beside the English one (5C) |

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
| `TIFFIN_FULL` | 409 | `capacity` (5B) |
| `TIFFIN_ALREADY_SUBSCRIBED`, `TIFFIN_HAS_SUBSCRIBERS` | 409 | (`subscribers`) (5B) |
| `TIFFIN_PLAN_LIMIT` | 409 | `max` (5B) |
| `QUOTE_OUTDATED` | 409 | `latest` (5B) |
| `QUOTE_EXPIRED` | 409 | `validUntil` (5B) |
| `CATERING_CLOSED` | 409 | (5B) |
| `ADDRESS_REQUIRED`, `ADDRESS_LOCATION_REQUIRED` | 422 | (5B) |
| `RAMADAN_NOT_ACTIVE` | 409 | `event`, `opensOn` (5B) |
| `NUTRITION_OFF` | 409 | (5C) |
| `PANTRY_FULL` | 409 | `max` (5C) |
| `EXPERIMENT_RUNNING` | 409 | (5B) |
| `EXPERIMENT_LIMIT` | 409 | `max` (5B) |
| `EXPERIMENT_NOT_SUPPORTED` | 422 | (5B) |
| `HYGIENE_INCOMPLETE` | 422 | `missing` (5B) |
| `CSV_HAS_ERRORS` | 422 | `errors [{ row, field, message }]` (5C staff) |
| `NUTRITION_FOOD_EXISTS` | 409 | `key` (5C staff) |
| `ALIAS_EXISTS` | 409 | `key` (5C staff) |
| `EVENT_OVERLAP` | 409 | `id` (5C staff) |
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
  - a tiffin day becomes a scheduled order at its cut-off;
  - a paused subscription resumes after its last paused day, and a new period opens when one
    ends;
  - quotes past `validUntil` read as `expired`, and a confirmed event as `completed` once its day
    has passed (worked out when read, not stored);
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
- **Nani ki Handi** (`nani@`) has 9 days of history, so it is still learning. It offers two
  tiffin plans (a weekday office lunch, a monthly dinner); Hamza (`hamza@`) has had the lunch for a
  week.
- **Biryani Bazaar** takes catering: Hamza has asked it to cater his sister's mehndi and it has
  sent a first quote.

City prices cover Lahore, Karachi and Islamabad for 8 weeks.

Reaching customers (5B):
- **Ramadan 1448** is on the staff calendar from 8 February to 9 March 2027 (approximate, editable
  by staff), with Eid ul-Fitr after it; kitchens can turn Ramadan mode on from 9 January.
- **2,400 anonymous searches** over the last 30 days across nine Lahore neighbourhoods. Halwa puri,
  haleem and sushi go unfound most often, mostly late at night.
- The demo kitchens keep selling in the dummy API as its clock moves, so a menu test reports a
  result when it ends (a price change moves orders by about −1.3× its size; a new photo adds about
  12%).
- **Nani ki Handi** has a story (Shazia Parveen) and a self-declared hygiene checklist, ready to
  ask for verification; **Biryani Bazaar** is verified.
- A kitchen's link is `https://metromatrix.app/s/<slug>`, and its QR adds `?via=qr`.

My Kitchen (5C):
- **Ayesha** (`customer@`) has nine things in her kitchen at home (tomatoes, yoghurt, milk and beef
  mince to use soon, coriander gone off) and two used this month before they expired.
- **Daily Basket** (`basket@metromatrix.app`, password `Metro2026`) is a fictional Lahore grocer
  in Shopping with 24 staples, each with its net quantity, for "Get missing items".
- Biryani Bazaar's house biryani masala and aloo bukhara aren't matched to nutrition foods yet (the
  kitchen's nutrition screen lists them); about 30 earlier reviews feed its review themes.

## 10. When the real document arrives

1. Copy it to `docs/API_KITCHEN.md`. Delete this file, and the `foodAdditions.ts` entries the
   real Food document now has.
2. Update `src/networks/kitchen/*`, `src/serializers/kitchen/*`, `src/models/kitchen/*` and the
   dummy API (`mock/kitchen/*`).
3. Capture real responses into fixtures, and replace `kitchenContract.test.ts` with a parity
   test, as Food's.
4. Run `grep -rn "TODO(API_KITCHEN)" src` and resolve each one; run the gates.
