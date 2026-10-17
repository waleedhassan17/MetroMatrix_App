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
| Rider | `GET /food/rider/me` |
| Staff | `POST /admin/food/branches/:id/food-safety-check` |
| Session | `business.food { brandId, brandSlug, branchStatus, isLive, setupComplete }` on a food vendor's `/auth/me` and sign-in |
| Sign-in | `identifier` (an email, or a rider's username) on the partner portal |

Each later backend phase (menu, discovery, ordering, deliveries, admin) adds its routes here in the same change as the app screens that use them.

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

Seeded names are fictional. The logos are generated initials that stand in for a vendor's own upload.

## Tests

- `src/serializers/__tests__/foodVendorRealResponses.test.ts` and `foodMenuRealResponses.test.ts`: real API responses (`fixtures/food/vendor.json` and `menu.json`, captured from a local backend with three demo vendors; tokens and passwords say "redacted") through the Food serializers.
- `src/networks/network/mock/__tests__/mockFoodParity.test.ts`: every captured response has the same keys as the dummy API's answer to the same request.
- `src/networks/network/mock/__tests__/mockFoodVendorFlows.test.ts` and `mockFoodMenuFlows.test.ts`: the rules above, driven through the app's real Food networks.
