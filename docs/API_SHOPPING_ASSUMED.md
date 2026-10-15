# Assumed API contract: Shopping (Chunk 2)

`MetroMatrix-API/docs/API_SHOPPING.md` does not exist yet; the NestJS backend (`~/MetroMatix-NestJS`) has Chunk 1 only. This file is the contract the app is built on. It was written from three sources: the Chunk 2 brief, the FYP app's shopping flows, and the conventions the real backend already uses.

Every app file that depends on it carries `TODO(API_SHOPPING)` (`grep -rn "TODO(API_SHOPPING)" src`). When the real document arrives:
1. Diff it against this file.
2. Fix the network, serializer or model in question, and delete its `TODO`.

Screens and slices should not change.

**No backend yet?** Leave `BACKEND_URL` in `src/config/env.ts` empty. The dummy API (`src/networks/network/mock/shop/`) then implements every endpoint below, and every rule in [Server rules](#server-rules). See [Mock mode](#mock-mode).

## Conventions

These are the NestJS backend's own conventions (`src/common/*` in the API repo).

| Item | Rule |
|---|---|
| Base | `/api/v1` |
| Envelope | Success `{ success: true, data }`. Failure `{ success: false, error: { code, message, details? } }`. The app also reads a bare `{ data }`. |
| Validation | `400 VALIDATION_FAILED`, with `details.fields = { field: [message, …] }`. Forms show these under the field. |
| Transitions | `409 INVALID_TRANSITION`, with `details = { from, to }`. A button the server would refuse is never shown, but a stale screen can still hit this. |
| Preconditions | `422` with a specific code (`ADDRESS_REQUIRED`, `RETURN_WINDOW_CLOSED`, `PAYMENT_ACCOUNT_REQUIRED`, `PUBLISH_BLOCKED`, …). |
| Pagination | `?page=1&pageSize=20` (max 100). Returns `{ items, total, page, pageSize }`. |
| IDs and slugs | IDs are UUIDs (the dummy API uses short ids). Slugs are `name-5hex`. |
| JSON | camelCase fields; snake_case enum values; ISO-8601 UTC times named `…At`; flat `lat`/`lng`; phones `+92…`. |
| Money | **Integer rupees** everywhere. Never floats, never paisa. The app formats only through `formatPKR`. |
| Idempotency | `POST /shop/checkout` takes `Idempotency-Key: <uuid>`. A repeat with the same key (per user) replays the first response, status included. A repeat while the first request is still running gets `409 IDEMPOTENCY_IN_PROGRESS`. |
| Uploads | `POST /media/sign` with `purpose` set to `product_image`, `store_logo`, `store_cover`, `review_photo`, `return_photo`, `payment_proof` or (staff) `banner_image`. The app sends only the resulting `{ url, publicId }`. |
| Atomic writes | A request that fails changes nothing. |

The response types are in `src/types/shopping.ts`. The table cells below name those types; the serializers in `src/serializers/shopping/` map the wire shapes onto them.

## Status values

The app shows these only through `src/models/shopping/orderStatusModel.ts`, never raw.

| Kind | Values |
|---|---|
| Order (per store) | `placed → confirmed → packed → shipped → delivered`; `cancellation_requested` (customer asked after confirmation); `cancelled`; `returned` (every item refunded) |
| Payment | `cod_pending → cash_collected`; `awaiting_transfer → proof_submitted → paid`, or `proof_rejected` (back to the customer); `refunded` |
| Return | `requested → approved \| rejected`; `approved → received → refunded` |
| Customer order segments | `active`, `completed`, `cancelled` (by the group's orders) |
| Partner order segments | `new` (`placed`, `cancellation_requested`), `to_pack` (`confirmed`), `to_ship` (`packed`), `shipped`, `done` (`delivered`, `returned`), `cancelled` |

One checkout makes an **order group** (`MM-XXXXXX`), with one **store order** (`MM-XXXXXX-n`) per store in the bag. Each store order moves on its own.

## Catalogue: public (a token, if sent, personalises `isSaved`)

| Function (`catalogNetwork`) | Method + path | 2xx `data` | Errors |
|---|---|---|---|
| `getShopHome` | `GET /shop/home` | `ShopHome { banners (live now, by position), categories (tree), featuredStores, newThisWeek }` | — |
| `getCategories` | `GET /shop/categories` | `ShopCategory[]` tree. Each has `icon` (an Ionicons name), `productCount`, and `children`. | — |
| `listStores` | `GET /shop/stores?q&city&page&pageSize` | `Paged<StoreSummary>`, featured first | — |
| `getStore` | `GET /shop/stores/:slug` | `StoreDetail` (brand colours, `isPaused`, `pauseMessage`, policies, collections, socials, phone/WhatsApp) | `404 NOT_FOUND` |
| `listProducts` / `countProducts` | `GET /shop/products?q&storeId&categoryId&collectionId&sort&minPrice&maxPrice&minRating&inStock&onSale&page&pageSize` | `Paged<ProductSummary>`. Sorts: `relevance`, `newest`, `price_asc`, `price_desc`, `rating`, `trending`. `categoryId` includes its children. `q` tolerates typos. `countProducts` sends `pageSize=1` and reads `total`. | — |
| `suggestProducts` | `GET /shop/products/suggest?q` (2+ characters) | `SearchSuggestion[]`: categories, then stores, then up to 5 products | — |
| `getProduct` | `GET /shop/products/:id` | `ProductDetail`: images; option1/option2 with colour swatches; variants `{ id, option1, option2, sku, stock, price, compareAtPrice }`; review summary; related products; store; `isSaved` | `404` for a draft or removed product |
| `listReviews` | `GET /shop/products/:id/reviews?rating&withPhotos&page` | `Paged<Review> & { summary: ReviewSummary }`. Reviews carry the store's `reply`. | — |
| `reportProduct` | `POST /shop/products/:id/report` (bearer) `{ reason, details? }` | `{ reported: true }` (201) | `VALIDATION_FAILED` |

## Saved (wishlist)

| Function (`wishlistNetwork`) | Method + path | 2xx `data` |
|---|---|---|
| `listWishlist` | `GET /shop/wishlist?page` | `Paged<ProductSummary>`, newest first |
| `getWishlistIds` | `GET /shop/wishlist/ids` | `string[]` (hearts on cards) |
| `saveProduct` | `PUT /shop/wishlist/:productId` | `{ saved: true }`. Idempotent. |
| `unsaveProduct` | `DELETE /shop/wishlist/:productId` | `{ removed: true }` |

## Bag

| Function (`cartNetwork`) | Method + path | Body | 2xx `data` | Errors |
|---|---|---|---|---|
| `getCart` | `GET /shop/cart` | — | `Cart` (below) | — |
| `addToCart` | `POST /shop/cart/items` | `{ variantId, quantity }` | `Cart`. Merges with an existing line. | `409 OUT_OF_STOCK`, `409 QUANTITY_UNAVAILABLE { available }`, `409 STORE_PAUSED`, `404` |
| `updateCartLine` | `PATCH /shop/cart/items/:id` | `{ quantity }` (1 or more) | `Cart` | `409 QUANTITY_UNAVAILABLE` |
| `removeCartLine` | `DELETE /shop/cart/items/:id` | — | `Cart` | — |
| `acknowledgeCart` | `POST /shop/cart/acknowledge` | `{ lineIds }` (empty = all) | `Cart`, with each line's seen price reset to the current price | — |

**`Cart`** is `{ groups: CartGroup[], itemCount, itemsTotal, shippingTotal, total, blocking }`.
- A `CartGroup` is one store: `{ store, isPaused, lines, subtotal, shippingFee, freeShippingOver, toFreeShipping, warnings }`.
- Each line carries `warnings`:
  - `PRICE_CHANGED { previousPrice, currentPrice }`
  - `OUT_OF_STOCK { available: 0 }`
  - `LOW_STOCK { available }`, when the quantity is above the stock
- A group carries `STORE_PAUSED`.
- `blocking` is true while any warning stands. Checkout stays disabled until the customer fixes or acknowledges them.

## Checkout

| Function (`checkoutNetwork`) | Method + path | Body | 2xx `data` | Errors |
|---|---|---|---|---|
| `previewCheckout` | `POST /shop/cart/preview` | `CheckoutInput { addressId, stores: [{ storeId, paymentMethod: 'cod'\|'transfer', couponCode?, note? }] }` | `CheckoutPreview` (below) | `422 ADDRESS_REQUIRED` |
| `listAvailableCoupons` | `GET /shop/stores/:id/coupons/available` | — | `AvailableCoupon[] { code, label, minOrder, endsAt, shortBy }`. `shortBy` is the rupees still needed to reach `minOrder`. | — |
| `placeOrder` | `POST /shop/checkout` + `Idempotency-Key` | same as the preview | `OrderGroup` (201). The bag lines that were ordered are removed. | `409 OUT_OF_STOCK { lineIds }`, `422 CHECKOUT_BLOCKED { stores: [{ storeId, code, message }] }`, `422 BAG_EMPTY`, `409 IDEMPOTENCY_IN_PROGRESS` |

**`CheckoutPreview`** is `{ stores: PreviewStore[], itemsTotal, shippingTotal, discountTotal, total, canPlace }`.

Each `PreviewStore` carries:
- **Totals:** `itemsTotal`, `shippingFee`, `discount`, `total`.
- **Coupon:** `couponCode` and `couponError`, one of:
  - `COUPON_NOT_FOUND`, `COUPON_INACTIVE`, `COUPON_NOT_STARTED`, `COUPON_EXPIRED`
  - `COUPON_USED_UP`, `COUPON_ALREADY_USED`, `COUPON_MIN_ORDER`
- **Payment:** `paymentOptions: [{ method, available, reason }]`. The COD limit and a store with no transfer account appear here. `paymentMethod` is the method actually used, which falls back if the requested one isn't available.
- **Delivery:** `dispatchMinDays`, `dispatchMaxDays`.
- **Store-level `error`:** `STORE_PAUSED`, `BAG_NEEDS_ATTENTION`, `CITY_NOT_SERVED` or `NO_PAYMENT_METHOD`.

## Customer orders, returns and reviews

| Function | Method + path | Body | 2xx `data` | Errors |
|---|---|---|---|---|
| `listOrders` | `GET /shop/orders?segment=active\|completed\|cancelled&page` | — | `Paged<OrderGroupSummary>` | — |
| `getOrderGroup` | `GET /shop/orders/:groupCode` | — | `OrderGroup` | `404` |
| `cancelOrder` | `POST /shop/orders/:id/cancel` | `{ reason }` | `OrderGroup`. Only while `placed`; stock and coupon use are given back. | `409 INVALID_TRANSITION` |
| `requestCancellation` | `POST /shop/orders/:id/cancel-request` | `{ reason }` | `OrderGroup`. While `confirmed` or `packed`. | `409` |
| `confirmReceived` | `POST /shop/orders/:id/received` | — | `OrderGroup`. While `shipped`. | `409` |
| `submitPaymentProof` | `POST /shop/orders/:id/payment-proof` | `{ transactionId, imageUrl? }` | `OrderGroup` (`proof_submitted`) | `409` unless `awaiting_transfer` or `proof_rejected`; `VALIDATION_FAILED` |
| `requestReturn` (`returnsNetwork`) | `POST /shop/orders/:id/returns` | `ReturnInput { reason, details, photos[], items: [{ orderItemId, quantity }] }` | `ReturnRequest` (201) | `409` unless delivered; `422 RETURN_WINDOW_CLOSED`; `409 RETURN_EXISTS`; `VALIDATION_FAILED` |
| `listReturns` | `GET /shop/returns?page` | — | `Paged<ReturnRequest>` | — |
| `writeReview` (`reviewsNetwork`) | `POST /shop/orders/:id/items/:itemId/review` | `ReviewInput { rating 1–5, title?, body, photos[] }` | `Review` (201) | `409 NOT_DELIVERED`, `409 ALREADY_REVIEWED`, `VALIDATION_FAILED` (10+ characters, or a photo) |

**`StoreOrder`** carries the flags the UI shows buttons from: `canCancel`, `canRequestCancel`, `canConfirmReceived`, `canReturn`, `canReview`.
- It also carries `events` (the timeline), `shipment { courier, courierName, trackingRef }` and `returnWindowEndsAt`.
- For transfers it adds `paymentInstructions { kind, accountTitle, accountNumber, bankName, amount, payBy }` and `paymentProof`.
- On `OrderItem`: `reviewed` and `returnableQuantity`.

## Addresses and notifications (core, shared with Food later)

| Function | Method + path | Body | 2xx `data` |
|---|---|---|---|
| `listAddresses` | `GET /addresses` | — | `Address[]`, default first |
| `createAddress` | `POST /addresses` | `AddressInput { label, fullName, phone, city, area, line1, landmark?, lat?, lng?, isDefault? }` | `Address` (201). The first address becomes the default. |
| `updateAddress` | `PATCH /addresses/:id` | the same, partial | `Address` |
| `deleteAddress` | `DELETE /addresses/:id` | — | `{ removed: true }`. If it was the default, the next address takes over. |
| `setDefaultAddress` | `POST /addresses/:id/default` | — | `Address` |
| `listNotifications` | `GET /notifications?page` | — | `Paged<AppNotification { id, type, title, body, data { groupCode?, orderId?, productId?, returnId? }, isRead, createdAt }>` |
| `getUnreadCount` | `GET /notifications/unread-count` | — | `{ count }` |
| `markNotificationsRead` | `POST /notifications/read` | `{ ids }` or `{ all: true }` | `{ read: true }` |

Notification `type` is one of:
- `order_placed`, `order_update`, `payment_update`, `return_update`, `review_reply` (customer)
- `new_order`, `payment_proof`, `return_requested`, `low_stock` (store)

Address validation (`400 VALIDATION_FAILED`):
- `phone` must be `+923XXXXXXXXX`
- `line1` needs at least 5 characters
- `area` needs at least 2

## Store partner (`/partner/shop/*`, partner bearer, approved shopping business)

A newly approved store owner gets a storefront on first call. It starts with sensible defaults: shipping Rs 250, the business city as its delivery city, 7-day returns, and COD up to Rs 15,000. A business that is not approved gets `403 BUSINESS_NOT_APPROVED`.

| Network | Method + path | Body | 2xx `data` | Errors |
|---|---|---|---|---|
| `storeNetwork.getPartnerSummary` | `GET /summary` | — | `PartnerSummary { storeName, storeSlug, isPaused, pauseMessage, counts { newOrders, toShip, paymentsToConfirm, returnsOpen, lowStock }, sales7d [{ date, amount }], recordedSales7d }` | — |
| `getStoreProfile` / `updateStoreProfile` | `GET`/`PATCH /store` | `{ tagline, about, logoUrl, coverUrl, brandColor, onBrandColor, socials, phone, whatsapp }` | `StoreProfile` | `400 BRAND_CONTRAST_LOW { ratio }` (below AA 4.5:1) |
| `getStoreSettings` / `updateStoreSettings` | `GET`/`PATCH /store/settings` | `StoreSettings { shippingFee, freeShippingOver, nationwide, deliveryCities[], dispatchMinDays, dispatchMaxDays, returnWindowDays (0–30), codEnabled, codLimit, isPaused, pauseMessage }` | `StoreSettings` | `422 PAYMENT_ACCOUNT_REQUIRED` (turning COD off with no active account); `VALIDATION_FAILED` |
| `pauseStore` / `resumeStore` | `POST /store/pause` `{ message }`, `POST /store/resume` | — | `StoreSettings` | — |
| `list/create/update/deletePaymentAccount` | `GET`/`POST /payment-accounts`, `PATCH`/`DELETE /payment-accounts/:id` | `{ kind: raast\|jazzcash\|easypaisa\|bank, title, number, bankName?, isActive }` | `PaymentAccount` | `VALIDATION_FAILED` (IBAN `PK…` 24 characters; wallet `03XXXXXXXXX`); `422 PAYMENT_ACCOUNT_REQUIRED` (the last active account while COD is off) |
| `partnerOrdersNetwork.listPartnerOrders` | `GET /orders?segment&q&payment&page` (`payment=proof_submitted`: every order with a transfer to check, whatever its segment) | — | `Paged<PartnerOrderRow> & { segmentCounts }` | — |
| `getPartnerOrder` | `GET /orders/:id` | — | `PartnerOrderDetail` (`StoreOrder` plus `customer { name, phone }`, `address`, `allowedActions[]`, `shipBlockedReason`, `internalNote`) | — |
| `saveInternalNote` | `PATCH /orders/:id` | `{ internalNote }` | `PartnerOrderDetail` | — |
| `confirm`, `pack`, `deliver`, `approveCancellation`, `markCashCollected` | `POST /orders/:id/{confirm,pack,deliver,approve-cancellation,cash-collected}` | — | `PartnerOrderDetail` | `409 INVALID_TRANSITION` |
| `shipOrder` | `POST /orders/:id/ship` | `{ courier: tcs\|leopards\|mnp\|postex\|trax\|own_rider\|other, trackingRef }` | `PartnerOrderDetail` | `409 PAYMENT_NOT_CONFIRMED` (transfer not yet `paid`); `VALIDATION_FAILED` (reference of 4+ characters) |
| `cancelPartnerOrder` | `POST /orders/:id/cancel` | `{ reason }` (5+ characters) | `PartnerOrderDetail`. Restocks and gives back coupon use. | `409` once shipped |
| `confirmPayment` / `rejectPayment` | `POST /orders/:id/payment/confirm`, `POST /orders/:id/payment/reject` `{ reason }` | — | `PartnerOrderDetail`. A rejection gives the customer 24 h more. | `409` unless `proof_submitted` |
| `productsNetwork.listPartnerProducts` | `GET /products?status=active\|draft\|archived&q&lowStock&page` | — | `Paged<PartnerProductRow>`. `q` matches name or SKU. | — |
| `get/create/updatePartnerProduct` | `GET /products/:id`, `POST /products`, `PATCH /products/:id` | `PartnerProductInput { name, description, categoryId, collectionId, price, salePrice, status, images[{ url, publicId }] (8 max, first = cover), option1, option2, variants[{ id?, option1, option2, sku, stock, priceDelta }] }` | `PartnerProduct` (201 on create) | `422 PUBLISH_BLOCKED { fields }` (status `active` without a price, category, photo or stock); `VALIDATION_FAILED` (sale ≥ price, duplicate SKU) |
| `setPartnerProductStatus` | `POST /products/:id/status` | `{ status }` | `PartnerProduct` | `422 PUBLISH_BLOCKED` |
| `list/create/rename/delete/reorderCollections` | `GET`/`POST /collections`, `PATCH`/`DELETE /collections/:id`, `POST /collections/reorder { ids }` | `{ name }` | `Collection[]` or `Collection` (with `productCount`) | `409 COLLECTION_NOT_EMPTY { productCount }` |
| `inventoryNetwork.listInventory` | `GET /inventory?q&lowStock&page` | — | `Paged<InventoryRow>`, lowest stock first | — |
| `setStock` | `PATCH /inventory/:variantId` | `{ stock, note? }` | `InventoryRow` | `VALIDATION_FAILED` |
| `bulkSetStock` | `POST /inventory/bulk` | `{ variantIds, stock }` | `InventoryRow[]` | — |
| `listMovements` | `GET /inventory/:variantId/movements` | — | `InventoryMovement[] { delta, stockAfter, reason: initial\|manual\|bulk\|order\|cancel\|return_restock, note, createdAt }` | — |
| `couponsNetwork` | `GET`/`POST /coupons`, `PATCH`/`DELETE /coupons/:id` | `CouponInput { code (4–16, A–Z 0–9), type: percent\|fixed, value, minOrder, maxDiscount (percent only), startsAt, endsAt, usageLimit, perCustomerLimit, isActive }` | `Coupon` (with `usedCount` and `status: active\|scheduled\|expired\|used_up\|inactive`) | `409 COUPON_CODE_TAKEN`; `VALIDATION_FAILED` (percent of 90 at most) |
| `partnerReturnsNetwork` | `GET /returns?status=open\|…&page`, `GET /returns/:id`, `POST /returns/:id/{approve { note? }, reject { note }, receive { restock: { [orderItemId]: boolean } }, refund { amount, reference }}` | — | `ReturnRequest` | `409 INVALID_TRANSITION`; `VALIDATION_FAILED` (refund between Rs 1 and the items' value) |
| `partnerReviewsNetwork` | `GET /reviews?rating&unreplied&page`, `PUT /reviews/:id/reply { body }` | — | `PartnerReview` | `409 REPLY_LOCKED` (a reply can be edited for 24 h) |
| `insightsNetwork.getInsights` | `GET /insights?range=7d\|30d\|90d` | — | `Insights { range, orders [{ date, count }], sales [{ date, amount }], recordedSales, orderCount, topProducts[], repeatCustomerPct, deliveredRatePct }`. **Delivered orders only.** | — |

The UI calls a store's figures "Recorded sales" and states that MetroMatrix does not hold or process the money.

## Admin (`/admin/shop/*`, staff bearer)

| Function (`adminShopNetwork`) | Method + path | Body | 2xx `data` | Errors |
|---|---|---|---|---|
| `getShopOverview` | `GET /overview` | — | `ShopOverview { stores, activeProducts, openReports, ordersToday }` | — |
| `listAdminCategories`, `create/update/deleteCategory`, `reorderCategories` | `GET`/`POST /categories`, `PATCH`/`DELETE /categories/:id`, `POST /categories/reorder { ids }` | `{ name, icon, parentId? }` (two levels) | `ShopCategory` / tree | `409 CATEGORY_IN_USE { productCount }` |
| `list/create/update/deleteBanner` | `GET`/`POST /banners`, `PATCH`/`DELETE /banners/:id` | `AdminBannerInput { imageUrl, headline, subhead?, target { kind: store\|category\|product, slug\|id }, startsAt, endsAt?, position, isActive }` | `AdminBanner` | `VALIDATION_FAILED` |
| `listReports` | `GET /reports?status=open\|dismissed\|removed&page` | — | `Paged<ProductReport { productName, productImage, storeName, reason, details, reportCount, status }>` | — |
| `dismissReport` / `removeReportedProduct` | `POST /reports/:id/dismiss`, `POST /reports/:id/remove { reason }` (10+ characters) | — | `ProductReport`. Removal hides the product everywhere and tells the store why. | — |
| `lookupOrder` | `GET /orders/:groupCode` | — | `AdminOrderLookup { group: OrderGroup, customer { name, email } }` | `404` |
| `listAdminStores` / `setStoreFeatured` | `GET /stores?q&page`, `POST /stores/:id/featured { featured }` | — | `StoreSummary` | — |

## Server rules

These are enforced by the dummy API and assumed of the real one. QA rows 10–31 depend on them, and `src/networks/network/mock/__tests__/mockShopFlows.test.ts` checks them.

1. **Bag:**
   - Prices are re-read on every bag read; a change raises `PRICE_CHANGED` until acknowledged.
   - Sold-out and over-stock lines block checkout.
   - A paused store blocks its group.
2. **Delivery:** a store delivers nationwide or to its `deliveryCities`. Any other address city gets `CITY_NOT_SERVED`.
3. **Coupons:**
   - Coupons are per store.
   - The window, the usage limit across all customers, the per-customer limit and the minimum order are all checked on preview and again at checkout.
   - Usage is counted at checkout and given back on cancel.
4. **COD:**
   - Offered only when the store has it on and the store's total is within `codLimit`.
   - A transfer needs an active payment account.
5. **Checkout:**
   - Stock is checked again at the moment of placing, and is taken at placing (`order` movements).
   - The `Idempotency-Key` replay means a retry never places twice.
6. **Shipping:** a transfer order cannot ship until the store confirms the payment (`PAYMENT_NOT_CONFIRMED`). COD orders ship freely, and cash is marked collected after delivery.
7. **Cancellation:**
   - The customer cancels while `placed`, or requests cancellation while `confirmed` or `packed`.
   - The store cancels before `shipped`.
   - Every cancellation restores stock (`cancel` movements).
8. **Returns:**
   - Only after `delivered`, within the store's `returnWindowDays` of the delivery, one open return per order, and up to the quantity not yet returned.
   - Restocking is chosen per item on receipt.
   - Once every item is refunded the order becomes `returned` and the payment `refunded`.
9. **Reviews:**
   - One per order item, after delivery.
   - The store replies once and can edit the reply for 24 h.
10. **Insights** count delivered (and later returned) orders only. Recorded sales are never called revenue or income.

## Mock mode

The dummy API keeps the same envelope, status codes and error codes as Chunk 1 (see `API_CONTRACT_ASSUMED.md` → Mock mode), with 300–700 ms of latency.
- **Persistence:** the shop is persisted on the device with the rest of the dummy database.
- **Existing installs:** on load, any collection or seed account an install is missing is filled in, so you keep your account and gain the shop.
- **Photos:** product photos come from Unsplash (see `docs/MOCK_IMAGES.md`); uploads stay on the device.

Seeded shop accounts (password **`Metro2026`**; staff `Admin2026` + TOTP `123456`). Store owners sign in as Service Provider → Vendor Registration → Sign In.

| Account | Who | What to try |
|---|---|---|
| `customer@metromatrix.app` | Ayesha Khan, customer, Lahore | Addresses in Lahore (default) and **Quetta** (`CITY_NOT_SERVED` for Urban Thread and Volt Gadgets). Orders: `MM-24A7Q2` (delivered: review, return), `MM-31KX8D` (shipped + confirmed), `MM-40BN5T` (**payment needed**, transfer), `MM-18ZC3W` (cancelled). Three saved products, one of them sold out. |
| `hamza@metromatrix.app` | Hamza, a second customer | Orders in the stores' New / To pack / To ship queues, a transfer awaiting the store's check, and a delivered order with an open return |
| `store@metromatrix.app` | **Lawn & Loom**, Lahore, maroon `#7A1F3D`. The busiest seeded store: start here | Nationwide delivery; COD up to Rs 15,000; Raast and bank accounts; coupons `LAWN10`, `WELCOME500`, `SPRING15` (expired); a sold-out bag |
| `urban@metromatrix.app` | **Urban Thread**, Karachi, near-black `#111827` | Delivers to Karachi, Lahore, Islamabad and Rawalpindi; coupon `URBAN300` (one use in total) |
| `volt@metromatrix.app` | **Volt Gadgets**, Lahore, teal `#0F766E` | Delivers to Lahore, Islamabad, Rawalpindi and Faisalabad; coupon `VOLT5`; 14-day returns; a reported product (`p_v18`) for the admin queue |
| `admin@metromatrix.app` | Super admin | Shopping console: overview, categories, banners, the reports queue, order lookup, featured stores |

`vendor@metromatrix.app` stays a **rejected** store application, which tests the gate.
