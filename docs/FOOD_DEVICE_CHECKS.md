# Food Court: checks on a phone

The gates, the parity tests and the web walks cover what a browser can show. The checks below need a real phone. The ones marked **build** also need a development or store build: Expo Go can't do background location, custom notification sounds or remote push.

Use the seeded accounts in `docs/MOCK_FOOD.md` (dummy API) or the backend's `seed:food` demo (`docs/API_FOOD.md` §10).

## Customer

- [ ] Food Court opens on the photo-led home with the address bar; "Use my location" asks for permission once and finds kitchens nearby.
- [ ] A kitchen's page: the category tabs follow the scroll and jump on tap; the rating block opens all reviews.
- [ ] A dish sheet won't add until the required choices are made, and the price follows the choices.
- [ ] Checkout with cash places the order; the order page moves on its own as the kitchen accepts and cooks (no pull to refresh needed).
- [ ] With the kitchen's rider on the way, the map shows the rider moving. Turn the phone's data off for a minute: "Reconnecting…" shows, and the page catches up when data is back.
- [ ] Rate a delivered order: stars, a tag, a photo from the gallery.
- [ ] **Build:** a push for an accepted order, tapped with the app closed, opens that order.

## Vendor (kitchen)

- [ ] A new order rings and vibrates on the board until it's opened; the screen stays on while the board is open.
- [ ] On a tablet in landscape, the board shows four columns; on a phone, tabs with counts.
- [ ] Accept with a time, start cooking, ready, give it to a rider; the customer's phone follows along.
- [ ] Reviews: reply to one; Insights: switch Today, 7 days, 30 days.
- [ ] **Build:** with the app closed, a new order arrives as a high-priority push in the "New orders" channel with the order sound (`new_order.wav`); tapping it opens the order.

## Rider

- [ ] Sign in with the username the vendor issued (Role Selection → Rider).
- [ ] Tap **On duty**: the explanation sheet shows before the system prompt. In Expo Go, the screen then reads "Sharing your location while this app is open. Keep it open on deliveries."
- [ ] Walk the steps on a delivery (accept, at the kitchen, picked up, at the customer, delivered with the cash taken); the vendor's live map follows.
- [ ] Sign-out is blocked while a delivery is open.
- [ ] **Build:** go on duty, choose "Allow all the time", lock the phone and walk: the "MetroMatrix — on duty" notification stays, and the vendor's map keeps moving. Off duty removes it.
- [ ] **Build:** kill the app while on duty and walk: positions still reach the vendor (the background task sends through the REST batch).
- [ ] **Build:** a push for a new delivery opens it.

## Staff

- [ ] Admin → Food: the overview, a vendor (feature, suspend and reinstate, the plan's limits), an order's history, hiding a review, a new cuisine, a banner with a photo from the gallery.

Background-location review on Google Play: see `docs/PLAY_BACKGROUND_LOCATION.md`.
