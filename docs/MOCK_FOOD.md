# Dummy Food API

While `src/config/env.ts` has no backend URL, the Food Court routes are answered by `src/networks/network/mock/food/`. They follow the Food API's committed routes in MetroMatrix-API (`src/modules/food`), with the same bodies, statuses, error codes and shapes.

`docs/API_FOOD.md` arrives with the backend's final phase. Until then, every Food network, serializer and mock file is marked `TODO(API_FOOD)`.

## What it covers so far

| Area | Routes |
|---|---|
| Reference | `GET /food/cuisines` |
| Vendor setup | `GET /food/vendor/setup`, `POST /food/vendor/go-live` |
| Vendor profile | `GET/PATCH /food/vendor/profile`, `POST /food/vendor/{pause,resume,busy}` |
| Vendor settings | `GET/PATCH /food/vendor/settings`, `GET/PUT /food/vendor/hours`, `GET/PUT /food/vendor/fee-bands`, closures, payment accounts |
| Plan | `GET /food/vendor/plan` (the Community plan: free, no commission) |
| Riders (vendor) | `GET/POST /food/vendor/riders`, `GET/PATCH /:id`, `PATCH /:id/status`, `POST /:id/reset-password`, `GET /:id/credential` |
| Menu | categories (`GET/POST /food/vendor/menu/categories`, `PATCH/DELETE /:id`, `PUT /reorder`), dishes (`GET/POST /menu/items`, `GET/PATCH/DELETE /:id`, `POST /:id/duplicate`, `PUT /:id/variants`, `PUT /:id/option-groups`, `PUT /reorder`), add-on groups (`GET/POST /menu/option-groups`, `GET/PUT/DELETE /:id`) |
| Availability | `GET/PATCH /food/vendor/availability` (dishes off, optionally until a time; add-ons out of stock) |
| Home kitchens | `GET/PATCH /food/vendor/today` (portions, cooking today), `GET/PUT /food/vendor/preorder-slots`, `PUT /food/vendor/weekly-menu` |
| Discovery (signed in or not) | `GET /food/home?lat&lng`, `GET /food/vendors` (rails, cuisine, filters, sorts, pages), `GET /food/vendors/:slug`, `GET /food/items/:id`, `GET /food/search?q` |
| The bag | `GET/DELETE/PATCH /food/cart` (delivery or pick-up, a time), `POST /food/cart/items` (`?replace=true` starts a new bag), `PATCH/DELETE /food/cart/items/:id`, `POST /food/cart/preview` |
| Checkout | `POST /food/checkout` (Idempotency-Key), `GET /food/vendors/:id/slots` |
| Customer orders | `GET /food/orders?status=active\|past`, `GET /food/orders/:code` (+ `/tracking`), `POST /:code/cancel`, `/payment-proof`, `/reorder` |
| The kitchen's board | `GET /food/vendor/orders?status=new\|active\|done\|<status>&scheduled`, `GET /:id`, `POST /:id/{accept,reject,preparing,ready,handed-external,picked-up,delivered,cancel}`, `POST /:id/payment/{confirm,reject}` |
| Deals | `GET/POST /food/vendor/promotions`, `GET/PATCH/DELETE /:id`, `POST /:id/deactivate` |
| Saved kitchens | `GET /food/favourites`, `POST/DELETE /food/favourites/:vendorId` |
| Live channel | the dummy socket (`mockRealtime` + `food/foodRealtime.ts`): `board.sync` to a kitchen on connect, `subscribe`/`unsubscribe { orderId }`, `order.new`, `order.updated`, `order.payment` |
| Rider | `GET /food/rider/me`, `PATCH /food/rider/duty`, `GET /food/rider/orders?scope=active\|history` (+ `/:id`), `POST /:id/{accept,decline,arrived-branch,picked-up,arrived-customer,delivered}`, `POST /food/rider/location`, `GET /food/rider/cash` |
| Riders on orders (vendor) | `POST /food/vendor/orders/:id/assign`, `GET /food/vendor/riders/suggest?orderId`, `GET /food/vendor/riders/live`, `GET /food/vendor/riders/:id/cash`, `POST /food/vendor/riders/:id/handover` |
| Staff | `POST /admin/food/branches/:id/food-safety-check` |
| Session | `business.food { brandId, brandSlug, branchStatus, isLive, setupComplete }` on a food vendor's `/auth/me` and sign-in |
| Sign-in | `identifier` (an email, or a rider's username) on the partner portal |

Each later backend phase (deliveries, reviews, admin) adds its routes here in the same change as the app screens that use them.

## The rules it enforces

- **Go-live checklist.** Brand (logo and at least one cuisine); address, pin and phone; opening hours; fee bands, required only when the kitchen delivers; a way to be paid. Home kitchens also need MetroMatrix's food-safety check.
  - A missing step: `422 PROFILE_INCOMPLETE` with `details.missing`.
  - Only the safety check missing: `422 FOOD_SAFETY_CHECK_REQUIRED`.
- **Open state.** Weekly ranges in Pakistan time. A range that closes before it opens runs past midnight. Closures are cut out and pause wins. Labels read "Open until 2:00 AM", "Opens tomorrow 12:00 PM" or the pause message.
- **Hours.**
  - At most 4 ranges a day.
  - No overlaps anywhere in the week, overnight spill included: `400 VALIDATION_FAILED` with `details.conflict`.
- **Fee bands.** At most 6, starting at 0 km, back to back.
- **Brand colour.** Refused unless white or ink text on it reaches 4.5:1.
- **Payment accounts.**
  - Wallet numbers are normalised to `+92…`.
  - IBANs must pass their check digits.
  - At most 4 active accounts; the same number can't be added twice.
- **Riders.**
  - The username is `<brand-slug>.<first-name>`, then `2`, `3`… on a clash. The 10-character password is shown once, at creation or reset.
  - Riders sign in with the username on the partner portal.
  - Inactive or on leave: signed out, and rider routes answer `403 RIDER_INACTIVE`.
  - A reset ends every session.
  - The plan allows 25 active riders.
- **Menu.**
  - A category's daily window is both times or neither, and it is refused while it still holds dishes (`409 CONFLICT`, `details.items`).
  - A dish has up to 10 sizes and 5 tags (spicy, veg, bestseller, new, contains_nuts). It is on chosen weekdays, and it counts against the plan's 1,000 dishes.
  - A copy starts hidden, with the same sizes and add-on groups.
  - An add-on group needs least ≤ most ≤ number of choices. Deleting a group takes it off every dish.
- **Availability.** A dish switched off "until" a time comes back on its own; off without a time stays off.
- **Home kitchens.**
  - Setting portions resets what is left, and a new day resets it to the day's portions.
  - Slots are for home kitchens only, and no two can be at the same time.
  - The checklist adds the menu, and today's portions (or, for pre-order-only kitchens, slots).
- **The bag.**
  - One kitchen at a time: another kitchen's dish is `409 CART_OTHER_VENDOR` (`details.currentVendor`, `itemCount`) unless `?replace=true`.
  - The same dish with the same size, add-ons and note goes on one line (at most 50 of a dish, 40 lines).
  - Sizes and add-on rules are checked as a dish goes in (`OPTION_REQUIRED`, `OPTION_LIMIT`, `OPTION_INVALID`), and so are today's portions (`PORTIONS_SOLD_OUT`).
  - Every read re-prices the bag; whatever changed is a warning on its line.
- **Scheduling.** A home kitchen with slots takes orders for a slot's start until its cutoff, up to its places (`SLOT_FULL`); anyone else at least 30 minutes ahead (or the prep time), at most 7 days, inside opening hours. A time that can't be used is refused and not kept.
- **The planner** (bag, preview and checkout share it): the kitchen, the address (a saved one with a map pin), the time, each line, the minimum order, the deal, the way to pay — in that order, every problem listed, the first one first.
- **Money.** Total = subtotal − the deal + the kitchen's delivery fee. No other fee. The fee is the band for the straight-line distance, and nothing over the kitchen's free-delivery amount or for pick-up.
- **Deals.** One per order: the best for the customer. A coded deal applies only when its code is typed (`PROMO_INVALID`, `PROMO_EXPIRED`, `PROMO_LIMIT_REACHED`). Days, a daily window (past midnight allowed), first orders only, and limits in all and per customer. A used deal can't be deleted, only switched off. The plan allows 10 running deals.
- **Paying.** Cash on delivery (up to the kitchen's limit), pay at pick-up, or a transfer to the kitchen's own account within 10 minutes (then a receipt; the kitchen confirms or rejects it). MetroMatrix never holds the money.
- **Checkout.** Needs an Idempotency-Key (`400 IDEMPOTENCY_KEY_REQUIRED`); the same key returns the same order. It takes the slot place, today's portions and the deal use, or nothing.
- **The order.** The API's status machine and who may make each move (`409 INVALID_TRANSITION`): the customer cancels only before the kitchen answers; a transfer must be paid before cooking when the kitchen asks for that (`409 PAYMENT_NOT_CONFIRMED`); cash is settled when the food changes hands. A cancel or decline gives back today's portions and the deal use, and settles the payment.
- **The minute jobs** run before every Food request: an order not answered by `acceptBy` (the kitchen's auto-reject minutes) is declined, and a transfer not paid by `payBy` is cancelled. Both say so on the live channel.
- **Riders on orders.** The kitchen gives a delivery only to its own rider who is active and on duty (`409 RIDER_NOT_AVAILABLE`), after accepting and before it leaves; it can give it to another before pickup. Suggestions: fewest deliveries, then nearest (live positions only). The rider's steps follow the API's machine (assigned → accepted → at the kitchen → picked up → at the customer → delivered, or handed back before pickup); picked up needs the order ready and moves it on the way. Delivered with cash records what was taken (≤ the total) on the rider's ledger; the kitchen's handover can't be more than they hold.
- **Location.** Only on duty (`409 RIDER_NOT_AVAILABLE`) and only for their own orders (`409 RIDER_NOT_ASSIGNED`); the newest fix is their position, fanned out as `rider.location` to each order's room at most once every 4 s. A position is shown for two minutes; after that it isn't.
- **The live channel** is the gateway's: a kitchen's owner joins `branch:{id}` and gets `board.sync` (its active orders) on connect; an active rider joins `rider:{userId}`; only an order's customer, kitchen or rider may `subscribe` to `order:{id}` (else `{ ok: false, code: 'NOT_FOUND' }`). After a write, `order.new` goes to the kitchen, `order.updated` carries the customer's view to the order's room and a board card to the kitchen, and `order.payment` goes to both. Events go out only when the write succeeds.
- **All-or-nothing.** A write that fails part-way leaves the dummy database as it was.

## Seeded accounts (password `Metro2026`)

| Sign in as | Where | What it shows |
|---|---|---|
| `restaurant@metromatrix.app` | Service Provider | Biryani Bazaar, a live restaurant: lunch and dinner hours, two fee bands, a JazzCash account, two riders, and a menu of 15 dishes (sizes, spice level, raita, BBQ from 6 PM) |
| `cloudkitchen@metromatrix.app` | Service Provider | Smash Lab, a live cloud kitchen (delivery only, open to 3 AM) |
| `homekitchen@metromatrix.app` | Service Provider | Ammi ka Khana, a home kitchen that is set up and waiting for the food-safety check (opens on Kitchen setup). Its Today tab has qorma portions and dishes on set weekdays. |
| `kitchen@metromatrix.app` | Service Provider | Sana's Kitchen, an application still pending approval |
| `biryani-bazaar.ali` | Rider | Ali Raza, an active rider for Biryani Bazaar |
| `biryani-bazaar.usman` | Rider | Usman Tariq, on leave (rider routes answer `RIDER_INACTIVE`) |

Customers order as `customer@metromatrix.app` (Ayesha Khan, with a pinned home address in Gulberg). Biryani Bazaar has two deals: 10% off over Rs 500 (automatic) and Rs 150 off over Rs 1,500 with the code `BAZAAR150`; Slice Theory has free delivery.

Seeded names are fictional. The logos are generated initials that stand in for a vendor's own upload.

## Tests

- `src/serializers/__tests__/foodVendorRealResponses.test.ts` and `foodMenuRealResponses.test.ts`: real API responses (`fixtures/food/vendor.json` and `menu.json`, captured from a local backend with three demo vendors; tokens and passwords say "redacted") through the Food serializers.
- `src/networks/network/mock/__tests__/mockFoodParity.test.ts`: every captured response has the same keys as the dummy API's answer to the same request.
- `foodDiscoveryRealResponses.test.ts` and `foodOrdersRealResponses.test.ts`: the discovery and ordering captures (`discovery.json`, `orders.json`).
- `src/networks/network/mock/__tests__/mockFoodOrderParity.test.ts`: the captured ordering run (bag, deals, preview, checkout, the kitchen's moves, a transfer, cancels) replayed against the dummy API, key for key.
- `src/networks/network/mock/__tests__/mockFoodVendorFlows.test.ts`, `mockFoodMenuFlows.test.ts`, `mockFoodDiscoveryFlows.test.ts` and `mockFoodOrderFlows.test.ts`: the rules above, driven through the app's real Food networks.
- `mockFoodRiderFlows.test.ts`: riders on orders (assignment, steps, cash and handover, handing back, location).
- `mockFoodLive.test.ts`: the live channel (board sync, a new order, who may join an order's room, nothing from a failed write, the minute jobs).
- `src/serializers/__tests__/foodLiveSerializer.test.ts`: the socket's events through the live serializers.
