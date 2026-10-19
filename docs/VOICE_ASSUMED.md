# MetroMatrix API — voice entry and spoken announcements, ASSUMED (Chunk 5)

> **Assumed, not released.** Built by the app ahead of the backend (owner's decision,
> 2026-10-19). Every dependency is marked `TODO(API_VOICE)`.
>
> The real API will do two things: turn a clip into words (speech to text, Urdu and English),
> and turn the words into one proposed action. The dummy API does the second with a rule reader
> (`mock/kitchen/voiceStandIn.ts`) for typed words. It can't hear, so it answers a recording
> with the context's next sample phrase, and the app says so on the result card.

## 1. Where voice is used

| Context | Who | Says, for example | Proposes |
|---|---|---|---|
| `board` | the kitchen | "pehla order accept karo, 20 minute" | `order.accept`, `order.reject`, `order.ready`, `item.unavailable`, `vendor.busy` |
| `stock` | the kitchen | "5 kilo tamatar 1200 rupay", "2 kilo pyaz kharab ho gaya" | `purchase.add`, `waste.log`, `stock.count` |
| `purchases` | the kitchen | "dhai kilo murghi 1550 rupay" | `purchase.add` |
| `today` | a home kitchen | "aaj 20 qorma" | `portions.set` |
| `search` | customers | "mujhe karahi chahiye" | `search` |
| `pantry` | customers (5C) | "do kilo aloo, expiry agle hafte" | `pantry.add` |

Languages:
- Urdu, as Urdu script or Roman Urdu, and English;
- `language: ur | en | auto` is a hint; the result says what it heard;
- the app remembers the chip's choice on the device.

## 2. The clip

The clip:
- 30 seconds at most;
- one channel, as m4a (AAC) on phones and webm/opus in browsers;
- uploaded with `/media/sign-upload { purpose: "voice_clip" }`, then sent by URL.

The microphone records only while the button is held, or between two taps. Clips are deleted
after 24 hours.

## 3. `POST /ai/voice/interpret`

```json
{ "context": "stock", "language": "auto", "audioUrl": "https://res.cloudinary.com/…/voice_clip/….m4a", "durationMs": 4200 }
```

or, typed (the "Type instead" path, and for accessibility):

```json
{ "context": "stock", "language": "auto", "text": "5 kilo tamatar 1200 rupay" }
```

<!-- contract: voice -->
```json
{
  "id": "vc_f7d",
  "transcript": "5 kilo tamatar 1200 rupay",
  "language": "ur",
  "confidence": 0.9,
  "action": {
    "kind": "purchase.add",
    "lines": [
      {
        "ingredientId": "ing_bb_tomato",
        "key": "tomato",
        "name": "Tomato",
        "qty": 5,
        "unit": "kg",
        "total": 1200
      }
    ]
  },
  "alternatives": [],
  "heard": "text"
}
```

**It never writes.** The app shows a confirm card: what was heard, the action in plain words,
and Confirm / Edit / Try again. On Confirm it calls the ordinary endpoint:

| Action | Fields | The app then calls |
|---|---|---|
| `order.accept` | `orderId, code, etaMinutes \| null` | `POST /food/vendor/orders/:id/accept { etaMinutes }` |
| `order.reject` | `orderId, code, reason` (`too_busy`, `item_unavailable`, `closing_soon`, `out_of_area`) | `POST /food/vendor/orders/:id/reject { reason }` |
| `order.ready` | `orderId, code` | `POST /food/vendor/orders/:id/ready` (or `/preparing` first) |
| `item.unavailable` | `itemId, name` | `PATCH /food/vendor/availability` |
| `vendor.busy` | `extraMinutes` (5–60) | `POST /food/vendor/busy` |
| `purchase.add` | `lines [{ ingredientId \| null, key, name, qty, unit, total \| null }]` | `POST /food/vendor/kitchen/purchases` (`source: "voice"`; unknown names as new ingredients, after the cook checks them) |
| `waste.log` | `reason, lines` | `POST /food/vendor/kitchen/waste` |
| `stock.count` | `lines` | `POST /food/vendor/kitchen/stock-takes` |
| `portions.set` | `lines [{ itemId, name, portions }]` | `PATCH /food/vendor/today` |
| `search` | `query` | `GET /food/search` |
| `pantry.add` | `lines [{ key, name, qty, unit, expiresOn \| null }]` | `POST /my-kitchen/pantry` |

`qty` is in the `unit` heard (`kg`, `pao`, `dozen` …); the confirm path converts it to base
units (`docs/API_KITCHEN_ASSUMED.md` §1.2).

**Confidence.** `confidence` runs from 0 to 1:
- under 0.7, the card leads with "Did you mean…" and the `alternatives` (other orders, closer
  names);
- `action: null` means nothing was understood, and the card offers to try again or type.

**The order an utterance means.** On the board, "pehla / first" is the oldest new order and
"naya / latest" the newest. A code ("FC-NBNWXT") names one. With no hint, the oldest is
proposed, with the others as alternatives.

**Errors.**
- `413 CLIP_TOO_LONG { maxMs }`.
- `429 AI_QUOTA_REACHED { feature: "voice", limit, used, resetsAt }` (200 clips a day).
- `503 AI_UNAVAILABLE` (the assistant is off).

None of these are fatal: the screen's form stays.

## 4. The 40 test phrases

The release gate for voice. Each phrase must propose the action shown, with quantities
converted to base units. The dummy API's reader runs all 40 in jest
(`mock/__tests__/voicePhrases.test.ts`). The real speech to text is checked by saying them on a
phone (`docs/KITCHEN_DEVICE_CHECKS.md`).

The board phrases assume two new orders and one cooking. Stock and purchases use Biryani
Bazaar's stock; Today uses Ammi ka Khana's menu.

| # | Context | Phrase | Proposes |
|---|---|---|---|
| 1 | `board` | pehla order accept karo, 20 minute | kind: order.accept, order: oldest, etaMinutes: 20 |
| 2 | `board` | پہلا آرڈر قبول کرو، بیس منٹ | kind: order.accept, order: oldest, etaMinutes: 20 |
| 3 | `board` | accept the latest order, ready in 15 minutes | kind: order.accept, order: newest, etaMinutes: 15 |
| 4 | `board` | naya order reject karo, item khatam hai | kind: order.reject, order: newest, reason: item_unavailable |
| 5 | `board` | reject the first order, we are too busy | kind: order.reject, order: oldest, reason: too_busy |
| 6 | `board` | pehla order tayyar hai | kind: order.ready, order: cooking |
| 7 | `board` | chicken biryani khatam ho gayi | kind: item.unavailable, itemId: mi_chicken_biryani |
| 8 | `board` | seekh kebab is finished for today | kind: item.unavailable, itemId: mi_seekh |
| 9 | `board` | hum masroof hain, 15 minute extra | kind: vendor.busy, extraMinutes: 15 |
| 10 | `board` | we are busy, add 20 minutes | kind: vendor.busy, extraMinutes: 20 |
| 11 | `stock` | 5 kilo tamatar 1200 rupay | kind: purchase.add, lines: [key: tomato, base: 5000, total: 1200] |
| 12 | `stock` | 2 kilo pyaz kharab ho gaya | kind: waste.log, reason: spoiled, lines: [key: onion, base: 2000] |
| 13 | `stock` | ۵ کلو ٹماٹر ۱۲۰۰ روپے | kind: purchase.add, lines: [key: tomato, base: 5000, total: 1200] |
| 14 | `stock` | دو کلو پیاز خراب ہو گیا | kind: waste.log, reason: spoiled, lines: [key: onion, base: 2000] |
| 15 | `stock` | bought 10 kg chicken for 6200 rupees | kind: purchase.add, lines: [key: chicken, base: 10000, total: 6200] |
| 16 | `stock` | 3 litres of milk expired | kind: waste.log, reason: expired, lines: [key: milk, base: 3000] |
| 17 | `stock` | dahi 4 kilo bacha hai | kind: stock.count, lines: [key: yoghurt, base: 4000] |
| 18 | `stock` | we have 12 kilo rice left | kind: stock.count, lines: [key: rice, base: 12000] |
| 19 | `purchases` | dhai kilo murghi 1550 rupay | kind: purchase.add, lines: [key: chicken, base: 2500, total: 1550] |
| 20 | `purchases` | do darjan anday 720 rupay | kind: purchase.add, lines: [name: Eggs, base: 24, total: 720] |
| 21 | `purchases` | آدھا کلو ادرک لہسن ۳۰۰ روپے | kind: purchase.add, lines: [key: ginger_garlic, base: 500, total: 300] |
| 22 | `purchases` | 5 kilo aloo 450 aur 3 kilo pyaz 390 | kind: purchase.add, lines: [key: potato, base: 5000, total: 450, key: onion, base: 3000, total: 390] |
| 23 | `purchases` | 20 litre cooking oil for 11200 | kind: purchase.add, lines: [key: oil, base: 20000, total: 11200] |
| 24 | `purchases` | sawa kilo dhania 200 rupay | kind: purchase.add, lines: [key: coriander, base: 1250, total: 200] |
| 25 | `today` | aaj 20 qorma | kind: portions.set, lines: [itemId: mi_qorma, portions: 20] |
| 26 | `today` | aaj 15 daal chawal aur 10 kheer | kind: portions.set, lines: [itemId: mi_daal, portions: 15, itemId: mi_homek_kheer, portions: 10] |
| 27 | `today` | آج بیس قورمہ | kind: portions.set, lines: [itemId: mi_qorma, portions: 20] |
| 28 | `today` | make 12 pulao today | kind: portions.set, lines: [itemId: mi_pulao, portions: 12] |
| 29 | `today` | set aloo keema to 8 portions | kind: portions.set, lines: [itemId: mi_aloo_keema, portions: 8] |
| 30 | `search` | biryani | kind: search, query: biryani |
| 31 | `search` | mujhe karahi chahiye | kind: search, query: karahi |
| 32 | `search` | بریانی | kind: search, query: biryani |
| 33 | `search` | shawarma near me | kind: search, query: shawarma |
| 34 | `search` | chicken tikka pizza | kind: search, query: chicken tikka pizza |
| 35 | `pantry` | do kilo aloo, expiry agle hafte | kind: pantry.add, lines: [key: potato, base: 2000, expiresInDays: 7] |
| 36 | `pantry` | ایک درجن انڈے | kind: pantry.add, lines: [key: egg, base: 12] |
| 37 | `pantry` | 1 litre milk expires tomorrow | kind: pantry.add, lines: [key: milk, base: 1000, expiresInDays: 1] |
| 38 | `pantry` | aadha kilo dahi kal tak | kind: pantry.add, lines: [key: yoghurt, base: 500, expiresInDays: 1] |
| 39 | `pantry` | 3 kilo chawal | kind: pantry.add, lines: [key: rice, base: 3000] |
| 40 | `pantry` | two kilos of tomatoes, use in 3 days | kind: pantry.add, lines: [key: tomato, base: 2000, expiresInDays: 3] |

## 5. Spoken announcements (the board)

`GET /food/vendor/orders/:id/announcement?language=ur|en`:

<!-- contract: announcementUr -->
```json
{
  "orderId": "fo_29zun",
  "text": "نیا آرڈر، FC-Y633DM۔ 2 Chicken Biryani۔ ڈیلیوری۔",
  "language": "ur",
  "ttsUrl": null
}
```

<!-- contract: announcementEn -->
```json
{
  "orderId": "fo_29zun",
  "text": "New order, F C - Y 6 3 3 D M. 2 Chicken Biryani. Delivery.",
  "language": "en",
  "ttsUrl": null
}
```

The kitchen picks Off / Urdu / English in its Settings, on each device. After the new-order
chime's first ring, the board does the first of these that it can:
1. speaks `text` with the phone's own voice (`ur-PK` / `en-US`);
2. without an Urdu voice, plays `ttsUrl` (a recorded clip from the API);
3. without either, rings only, and Settings says "This phone has no Urdu voice".

The dummy API sends `ttsUrl: null`.

## 6. When the real document arrives

Copy it to `docs/VOICE.md`, then update `src/networks/ai/voiceNetwork.ts`,
`src/serializers/ai/voiceSerializer.ts`, `src/models/kitchen/voiceModel.ts` and the dummy API.
Run the 40 phrases on a phone against the real API.
