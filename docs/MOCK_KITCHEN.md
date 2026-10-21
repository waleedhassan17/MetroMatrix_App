# The dummy Kitchen Intelligence API

While `BACKEND_URL` is empty, everything Chunk 5 calls is answered in the app by the dummy API in `src/networks/network/mock/kitchen/`. It covers:

- the vendor's Kitchen: stock, recipes and costs, purchases, forecast and prep, waste, Bachat Box;
- growth: tiffin, catering, Ramadan, the storefront and QR, demand, menu insights and tests, story and hygiene, batching;
- the assistant: voice and the AI drafts;
- the customer's My Kitchen and nutrition;
- the staff console's Kitchen tools.

The contract it answers is assumed: no backend document exists yet. The documents are `docs/API_KITCHEN_ASSUMED.md`, `docs/AI_ASSUMED.md` and `docs/VOICE_ASSUMED.md`. Every place that depends on them is marked `TODO(API_KITCHEN)`, `TODO(API_AI)` or `TODO(API_VOICE)` (`grep -rn "TODO(API_KITCHEN\|TODO(API_AI\|TODO(API_VOICE" src`). When the real documents arrive, reconcile them in one pass, as Food was:

1. Copy the documents.
2. Update the networks, serializers, models and this dummy API.
3. Run the gates.

Screens and slices stay as they are.

## Files

Logic and seed:

| File | What it holds |
|---|---|
| `kitchenTypes.ts` | The DB rows (`MockDb.kitchen`, merged on load like `food`) |
| `kitchenSeed.ts` | Seeded-random demo data, described in "What is seeded" below |
| `kitchenLogic.ts` | FIFO batches, deductions on accept, costing, auto sell-out, settings |
| `forecastLogic.ts` | Expected / low / high per dish, "learning", prep sheet, shopping list |
| `insightCards.ts` | The hub's cards: at most 5, ranked by severity, snoozed for 24 h |
| `tiffinLogic.ts` | Tiffin cut-offs, periods, the next day's tickets |
| `growthLogic.ts` | Ramadan state, demand cells (`demandParts`, never under 10 searches), menu quadrants, experiments, hygiene, badges, batching, the storefront |
| `aiLogic.ts` | Limits (300 a month per kitchen, 30 per customer, 200 voice clips a day), staff overrides, `AI_UNAVAILABLE` / `AI_QUOTA_REACHED` |
| `aiStandIns.ts` | Rule-based stand-ins for the AI drafts (no network) |
| `voiceStandIn.ts` | A rule parser for Urdu script, Roman Urdu and English, with numbers ("dhai", "pao", "darjan") |
| `assistantLogic.ts` | Descriptions, specials, combos, photo tips, review themes |
| `myKitchenLogic.ts` | Pantry state, recipes (9, English and Urdu), missing items, nutrition targets and summaries, healthy tags |
| `kitchenWire.ts` | Rows → the documented shapes |
| `foodAdditions.ts` | The one list of keys Chunk 5 adds to API_FOOD shapes |

Routes and wiring:

| File | What it holds |
|---|---|
| `kitchenRoutes.ts` | `/food/vendor/kitchen/*`, `/ai/voice/interpret`, `/food/vendor/ai/usage` |
| `surplusRoutes.ts` | `/food/vendor/surplus`, `/food/surplus` |
| `tiffinRoutes.ts` | `/food/vendor/tiffin`, `/food/tiffin` |
| `cateringRoutes.ts` | `/food/vendor/catering`, `/food/catering` |
| `growthRoutes.ts` | Ramadan, storefront, demand, menu insights, experiments, story, hygiene, batching, and the staff hygiene queue |
| `assistantRoutes.ts` | `/food/vendor/ai/*` drafts, review insights, vendor nutrition |
| `myKitchenRoutes.ts` | `/my-kitchen/*`, `/food/healthy-picks`, search's `?nutrition=` |
| `adminKitchenRoutes.ts` | `/admin/kitchen/*`: AI usage and limits, city prices and nutrition foods (CSV with a dry run, all or nothing), aliases, calendar events, signatures, platform demand, code lookup |
| `kitchenIndex.ts` | Registers it all, after Food's routes (the router takes the first match) |

`kitchenIndex.ts` also plugs into the Food dummy API through its hooks, so Food runs unchanged without them:

- Stock is deducted on `accepted` and put back on a cancel before `preparing`.
- Auto sell-out gives `ITEM_UNAVAILABLE` with `unavailableReason: 'ingredients'`.
- A pause with a reason and `resumeAt` ends on its own.
- The packing-photo rule applies on `/ready`.
- Checkout's `source` becomes the order's `origin`.
- Badges, nutrition, `descriptionUr`, `dropOrder`.
- Searches are logged for the demand map.

Its minute jobs run before every request, as Food's do:

- tiffin cut-offs make the next day's tickets;
- Bachat Box windows close and no-shows are marked;
- quotes expire;
- tests end.

Writes are all or nothing.

## What is seeded

The data is fictional. Prices are ordinary Lahore market rates in rupees.

**Biryani Bazaar** (`restaurant@`, b_resto):
- Ingredients with batches, and recipes for its menu (biryani and seekh are signature dishes by Imran Qureshi).
- Suppliers, and ten weeks of daily sales.
- The hub opens on 4 kg of chicken expiring tomorrow, yoghurt running low, cream below zero (Malai Boti sells out by itself), tomatoes up on last month, Mutton Karahi over the 40% food-cost target, and dishes without a recipe card.
- Hygiene is verified.

**Smash Lab** (`cloudkitchen@`, b_cloud): a cloud kitchen's stock, recipes and history.

**Ammi ka Khana** (`homekitchen@`, b_homek):
- A home kitchen with portions and weekly dishes.
- It asked staff to verify its hygiene checklist two days ago, so the staff console has one waiting.

**Nani ki Handi** (`nani@`, b_nani):
- A newer home kitchen with nine days of history, so its forecast says "learning".
- Its cook's story, and hygiene self-declared.
- A weekday office-lunch tiffin and a monthly dinner.

**Growth**:
- Hamza (`hamza@`) has had the lunch tiffin (`TF-HMZ4K2`) for a week.
- He has asked Biryani Bazaar to cater a mehndi (`CT-MHD7Q4`), and it has sent a first quote.
- Ayesha (`customer@`) has neither, for the walks.

**Reference data**:
- 51 ingredients (`CANON`), each with nutrition per 100 g, ml or piece.
- 92 words for them in Roman Urdu, Urdu and English.
- City prices for Lahore, Karachi and Islamabad over 8 weeks: tomatoes up about a third, onions a quarter.
- An approximate Ramadan 1448 and Eid ul-Fitr. Staff move them in the console.
- 2,400 anonymous searches over the last 30 days, mostly Lahore.

**The assistant**:
- Use over the last nine days of the previous month (voice, receipt scans, packing checks, drafts, a few failures), so the staff console has numbers.
- This month's limits start untouched.

**My Kitchen**:
- Ayesha's pantry: beef mince, milk and yoghurt to use tomorrow, coriander gone off, potatoes, tomatoes.
- Two things saved from waste this month.

**Shopping**: Daily Basket (`s_basket`), a fictional grocery store with 24 staples in pack sizes, each with its `netQuantity` and ingredient (`TODO(API_SHOPPING)`). Photos are credited in `docs/MOCK_IMAGES.md`.

Demo accounts and passwords are in `docs/MOCK_FOOD.md` ("Seeded accounts"). Staff sign in as `admin@metromatrix.app` (`Admin2026`, code `123456`).

## Voice and the assistant

- **Typed words** ("Type instead") are parsed by the stand-in. A **recording** is answered with the context's next demo phrase in turn, and the result card says "Dummy API: a sample phrase stands in for your recording".
- **Nothing is written** until Confirm: the app then calls the ordinary endpoint.
- **`ttsUrl` is always `null`**, so announcements use the phone's own voice (`expo-speech`) or fall back to the ring (`TODO(API_VOICE)`).
- **Walk switches**, in a development build or the web: `globalThis.__MM_MOCK__ = { aiOff: true }` turns the assistant off, and `{ aiUsedUp: true }` uses up every limit. Staff can do the same for real in the console (the switch, a kitchen's monthly limit).
- **Walks can act as another person**: `globalThis.__MM_MOCK_DB__.request(method, url, body, token, headers)`.

## Tests

| Test | What it checks |
|---|---|
| `__tests__/kitchenContract.test.ts` | Every `<!-- contract: name -->` example in the three assumed documents has the same keys as the dummy API's answer (at every level, the first item of each list), and every request it makes is documented. `DUMP_CONTRACT=<file>` writes the answers out, to refresh an example. |
| `__tests__/mockKitchenFlows.test.ts` | The QA matrix's flows end to end, plus the staff console. |
| `__tests__/voicePhrases.test.ts` | The 40 test phrases of `docs/VOICE_ASSUMED.md` through the voice stand-in. |
| `models/__tests__/` `kitchenModels`, `kitchenBoardModels`, `growthModels`, `assistantModel`, `myKitchenModels`, `adminKitchenModels`, `units` | Wording, forms and units. |
| Food's parity tests | Leave the keys in `foodAdditions.ts` out of the comparison and assert they are absent from the real capture. When the backend ships one, the test names it for reconciling. |
