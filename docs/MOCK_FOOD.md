# Dummy Food API

While `config/env.ts` has no backend URL, the Food Court routes are answered by `networks/network/mock/food/`. They follow the Food API's committed routes in MetroMatrix-API (`src/modules/food`), with the same bodies, statuses, error codes and shapes.

`docs/API_FOOD.md` is a copy of the backend's contract (chunk4/p8). The parity tests replay real responses against the dummy API: the per-phase captures (`fixtures/food/vendor.json`, `menu.json`, `discovery.json`, `orders.json`) and the released API on its `seed:food` demo (`fixtures/food/p8.json`, made by `scripts/capture-food-fixtures.js`).

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
| Reviews | `POST /food/orders/:code/review`, `GET /food/vendors/:id/reviews`, the vendor page's `ratingSummary`; the kitchen's `GET /food/vendor/reviews?unreplied`, `POST /food/vendor/reviews/:id/reply` |
| Insights | `GET /food/vendor/insights?range=today\|7d\|30d` (or `from`/`to`, at most 92 days) |
| Staff | `GET /admin/food/overview`; vendors (`GET /admin/food/vendors?type&status&city&q`, `GET /:id`, `POST /:id/{feature,unfeature,suspend,reinstate}`, `GET/PATCH /:id/plan`); `POST /admin/food/branches/:id/food-safety-check`; orders (`GET /admin/food/orders?code&vendorId&status`, `GET /:id`); reviews (`GET /admin/food/reviews?vendorId&hidden&maxRating`, `POST /:id/{hide,unhide}`); cuisines (`GET/POST /admin/food/cuisines`, `PATCH/DELETE /:id`); banners (`GET/POST /admin/food/banners`, `PATCH/DELETE /:id`) and the live ones on `GET /food/home` |
| Session | `business.food { brandId, brandSlug, branchStatus, isLive, setupComplete }` on a food vendor's `/auth/me` and sign-in |
| Sign-in | `identifier` (an email, or a rider's username) on the partner portal |

Every route the backend has committed is here, through its P8 (`docs/API_FOOD.md`).

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
  - The plan allows 25 active riders (staff can change it; see Plan).
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
- **Reviews.** One per order, once it was delivered or collected (`409 REVIEW_NOT_ALLOWED { status }`, then `REVIEW_EXISTS`). Food stars 1–5; delivery stars only on a delivery; tags from the seven; words up to 1,000; up to 4 photos. Others see the author's first name; staff see the full name. The kitchen replies (2–1,000 characters) and can edit the reply.
- **Ratings.** The API averages the visible reviews. Seeded vendors arrive with ratings the dummy API has no reviews for, so their seeded average and count stand for those, and each new visible review is added to them. A hidden review leaves the rating, the page and every list at once.
- **Insights.** Branch-local days in Pakistan. Recorded sales are the orders marked delivered or collected; the acceptance rate counts only the orders the kitchen had to answer; rates are 0–1, or null with no data.
- **Staff.**
  - Suspending needs an approved business and a reason (3–500 characters); the vendor leaves Food Court at once (its page answers 404, its banners stop showing). Reinstating needs a suspended one.
  - Featuring puts `isFeatured` on the vendor's cards.
  - A cuisine's link is 2–40 lowercase letters, digits or dashes and unique (`409 CONFLICT`); one any vendor lists can't be deleted (`409 CONFLICT { vendors }`), only turned off.
  - A banner opens a vendor, a cuisine or a search, which must exist; it shows between its dates, in its city or everywhere, while its target is still on Food Court. The API takes only the staff member's own `banner` uploads; the dummy API takes any uploaded file.
  - Orders are read-only, with every event and the customer's contact.
- **Plan.** Community: 1 brand, 1 branch, 25 active riders, 1,000 dishes, 10 running deals, and riders, deals, insights and scheduled orders all included. Staff overrides (`PATCH /admin/food/vendors/:id/plan { overrides }`, `null` clears them) take effect at once:
  - over a limit: `409 PLAN_LIMIT_REACHED { key, limit, used, planKey }`;
  - a feature turned off: `409 PLAN_LIMIT_REACHED { entitlement }` (new riders, new deals, insights), or `400 SLOT_INVALID { preorders: false }` for a time;
  - riders beyond a lowered limit become `plan_locked` (signed out, off duty): riders mid-delivery keep their seat, then the longest serving. Raising it brings them back first.
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

Customers order as `customer@metromatrix.app` (Ayesha Khan, with a pinned home address in Gulberg). Staff sign in as `admin@metromatrix.app` (password `Admin2026`, code `123456`) and use the Food tab. Biryani Bazaar and Smash Lab arrive with three fictional reviews (one with the kitchen's reply). Biryani Bazaar has two deals: 10% off over Rs 500 (automatic) and Rs 150 off over Rs 1,500 with the code `BAZAAR150`; Slice Theory has free delivery.

Seeded names are fictional. The logos are generated initials that stand in for a vendor's own upload.

## Tests

- `serializers/__tests__/foodVendorRealResponses.test.ts` and `foodMenuRealResponses.test.ts`: real API responses (`fixtures/food/vendor.json` and `menu.json`, captured from a local backend with three demo vendors; tokens and passwords say "redacted") through the Food serializers.
- `networks/network/mock/__tests__/mockFoodParity.test.ts`: every captured response has the same keys as the dummy API's answer to the same request.
- `foodDiscoveryRealResponses.test.ts` and `foodOrdersRealResponses.test.ts`: the discovery and ordering captures (`discovery.json`, `orders.json`).
- `networks/network/mock/__tests__/mockFoodOrderParity.test.ts`: the captured ordering run (bag, deals, preview, checkout, the kitchen's moves, a transfer, cancels) replayed against the dummy API, key for key.
- `networks/network/mock/__tests__/mockFoodVendorFlows.test.ts`, `mockFoodMenuFlows.test.ts`, `mockFoodDiscoveryFlows.test.ts` and `mockFoodOrderFlows.test.ts`: the rules above, driven through the app's real Food networks.
- `mockFoodRiderFlows.test.ts`: riders on orders (assignment, steps, cash and handover, handing back, location).
- `mockFoodLive.test.ts`: the live channel (board sync, a new order, who may join an order's room, nothing from a failed write, the minute jobs).
- `mockFoodReviewAdminFlows.test.ts`: reviews (once, after it arrived; replies; hidden reviews leave the rating), insights, and the staff console (feature, suspend, orders, cuisines in use, banners whose target is gone, plan overrides: seats, scheduled orders, insights).
- `serializers/__tests__/foodReviewAdminRealResponses.test.ts`: the captured reviews, insights and staff-console responses through their serializers. `mockFoodOrderParity.test.ts` replays them too.
- `serializers/__tests__/foodP8RealResponses.test.ts`: the released API's run (`p8.json`) through every Food serializer, with the contract's rules checked in what came back (the total is subtotal − deal + the kitchen's delivery fee and nothing else; a plan change takes effect at once).

## Refreshing the real capture

When the backend's `docs/API_FOOD.md` changes: copy it to `docs/`, update the networks, serializers, models and the dummy API, then capture again from a local backend seeded with `npm run seed:food` (the run changes that database; re-seed afterwards):

```bash
BACKEND=~/MetroMatix-NestJS API=http://localhost:3000/api/v1 \
  node scripts/capture-food-fixtures.js serializers/__tests__/fixtures/food/p8.json
npm run gates
```

The parity tests fail on any key or error code the two disagree on. Run the capture while Smash Theory Burgers is open (it takes orders until 2 AM).
- `serializers/__tests__/foodLiveSerializer.test.ts`: the socket's events through the live serializers.
