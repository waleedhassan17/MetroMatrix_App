# Kitchen Intelligence: checks on a phone

The gates, the contract and flow tests and the web walks cover what a browser can show. The web walks use a fake microphone, a typed phrase or a sample recording, and the dummy API's stand-ins for speech and AI.

The checks below need a real phone:

- The ones marked **build** also need a development or store build. Expo Go can't register universal links or remote push.
- The ones marked **API** need the real Kitchen, AI and voice APIs. The dummy API answers a recording with a sample phrase, and has no server voice (`ttsUrl` is `null`).

Use the seeded accounts in `docs/MOCK_FOOD.md` and `docs/MOCK_KITCHEN.md`. Staff are `admin@metromatrix.app` (`Admin2026`, code `123456`).

## Voice

- [ ] The first tap on a mic shows the plain explanation, then the system's microphone prompt. Saying no shows "The microphone is off for MetroMatrix…" and "Type instead" still works.
- [ ] Hold to talk: the ring fills over 30 s, turns amber at 25 s and stops at 30 s. Tap to start and tap to stop works too.
- [ ] The level meter moves with your voice and stays still in silence.
- [ ] The language chip (Urdu, English, Auto) is remembered after the app restarts.
- [ ] In Expo Go on Android and iOS, a recording uploads and the confirm card appears. After it, music or a call from another app comes back as normal (the audio session is released).
- [ ] **API:** speak five of the 40 phrases in `docs/VOICE_ASSUMED.md` in a busy kitchen: one in Urdu script, two in Roman Urdu, two in English. Check each card's action before Confirm. Below the confidence line, "Did you mean…" offers the alternatives.
- [ ] **API:** an Urdu transcript reads right to left on the card.

## Announcements

- [ ] Settings → Announcements: Urdu, English or Off. With Urdu on a phone that has an Urdu voice, a new order is spoken after the first ring ("نیا آرڈر…").
- [ ] On a phone without an Urdu voice, Settings says "This phone has no Urdu voice", and new orders only ring. English still speaks.
- [ ] **API:** with a server `ttsUrl`, Urdu is spoken even on a phone without an Urdu voice.

## Camera and files

- [ ] Purchases → Scan receipt: the camera opens, and a clear receipt gives draft lines to confirm. An unknown item offers "Create it".
- [ ] Packing photo set to Required: Ready asks for a photo first. Retake works, and the customer's order page shows the thumbnail.
- [ ] Story and hygiene: add photos from the gallery and a short video; hygiene evidence from the camera.
- [ ] Staff → Kitchen tools → City prices: "Choose a CSV file" opens the file picker, and a CSV from Files or Drive gives the dry run.

## Storefront, QR and links

- [ ] Your link and QR: Share opens the share sheet with the link and WhatsApp text, and the QR image shares as a picture on Android and iOS.
- [ ] Print the card: the print dialog shows the QR and "Order on Food Court — no commission".
- [ ] Scan the QR with another phone's camera: it opens the kitchen's page, signed out in the browser or in the app.
- [ ] **Build:** with `metromatrix.app` set up for universal links (Android App Links, iOS associated domains), `https://metromatrix.app/s/<slug>` opens the app straight on the kitchen's page. An order placed from it shows "From your link" on the kitchen's board.

## The kitchen's day

- [ ] A new order rings, is announced, and shows "Recipe stock low" when fewer than 3 servings are left. Accepting it takes the stock down (Stock shows the movement).
- [ ] Selling the last servings marks the dish "Sold out for now" by itself on the menu and for customers.
- [ ] Forecast and prep: share the prep sheet to WhatsApp.
- [ ] Bachat Box: a customer reserves the last box on one phone while another tries. One gets the code; the other is told it sold out.
- [ ] On a tablet in landscape: the hub shows two columns, the forecast its bars, the board four columns.

## Customers

- [ ] My Kitchen → Speak: "do kilo aloo, expiry agle hafte" gives a draft with a use-by date, saved only on Confirm.
- [ ] A recipe's "Cook step by step" keeps the screen on until Done, and the Urdu steps read right to left.
- [ ] Missing items → Add to bag → View bag opens Shopping's bag with Daily Basket's items.
- [ ] Nutrition stays off until turned on. With calories on, dish sheets show them; "Delete my nutrition data" removes it all.
- [ ] **Build:** a pantry reminder push opens My Kitchen (`metromatrix://mykitchen/pantry`).

## Accessibility

- [ ] TalkBack (Android) and VoiceOver (iOS):
  - The voice button says "Speak: hold to talk, or tap to start", and a double tap starts and stops it.
  - A header mic says what can be spoken there ("Speak a purchase, waste or a count").
  - Stock rows read the ingredient, its level and its state.
  - Prep sheet rows read the dish and the amount.
- [ ] Text at 130% (Settings → Display → Font size) on the hub, stock, forecast, the board and My Kitchen: nothing is cut off or overlaps, and no screen scrolls sideways.
- [ ] Reduce motion on: no Kitchen screen moves by itself.

## Staff

- [ ] Admin → Food → Kitchen tools, one action on each tool:
  - the assistant: the switch, and a kitchen's limit;
  - a city-price CSV: a dry run with an error, then a clean import;
  - a nutrition food, and a word for voice;
  - Ramadan's dates moved;
  - a hygiene check sent back, then verified;
  - a signature label taken off (the kitchen sees the note on its recipe);
  - the city demand map;
  - a TF- and a CT- code looked up.
