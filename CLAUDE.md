# CLAUDE.md

Guidance for Claude Code (and humans) working in this repository.

MetroMatrix is a zero-commission community marketplace with three services: **Shopping**, **Healthcare** and **Food**. This app serves:
- customers, who use one app across all three services
- partners (store, doctor, kitchen), who get the partner app for their service
- admins, who approve partners

The app follows the **Consultant_Mobile app architecture** (`waleedhassan17/Consultant_Mobile`, local clone `~/Consultant-Mobile/Consultant_Mobile`; the owner's decision of 2026-10-31, replacing the FinMatrix layout): folders at the repo root with relative imports, one flat kebab-case folder per screen, `networks/network/network.ts` with the `API` request functions, and slices that serialize in `fulfilled`. Its **look and flows follow the owner's MetroMatrix FYP app** (`~/MetroMatrix/Waleed-MetroMatrix`):
- white, light-only screens in the platform system font, with the FYP icon, splash and onboarding (Health keeps the FYP's pale clinical blue);
- Role Selection → (Provider Selection) → sign in / sign up → email link → profile steps;
- the FYP's three-card user home, with no bottom bar; each service opens its own app with its own bottom tabs, as in the FYP. The app is in English: no Urdu UI copy and no language switch. Urdu appears only as content: speech and its transcript, assistant-drafted dish descriptions, spoken announcements, and recipes when Urdu is picked (Chunk 5's owner decision). Food is branded **Food Court**: a platform for food vendors. Unlike Foodpanda, MetroMatrix takes **no commission** and runs **no rider fleet**. Vendors deliver with their own riders through MetroMatrix's delivery app. Delivery details (time, fee, area) are fine to show; never imply MetroMatrix's own couriers or a cut of the order.

Food Court vendors also get **Kitchen Intelligence** (Chunk 5): stock, recipes and costs, purchases, forecast and prep, waste and the Bachat Box, tiffin and catering, Ramadan, the storefront and QR, demand and menu insights, and a voice and AI assistant whose results are always drafts. Customers get the Bachat Box, tiffins, catering, My Kitchen (pantry, recipes, groceries from Shopping) and opt-in nutrition. Staff get the console's Kitchen tools.

Copy the FYP's UX, never its code paths, Firebase setup or per-role duplicate network files. There is no Facebook login.

## Backend switch (one file)

`config/env.ts` reads `EXPO_PUBLIC_API_URL` (`.env.local`, or the `eas.json` profile). The app always talks to the real MetroMatrix API through the one client: there is no dummy fallback in any build. With no URL the build is a configuration error: `ConfigErrorScreen` replaces the app and `api` rejects every request with `CONFIG_ERROR`. Never add a silent fallback.

The dummy API (`networks/network/mock/`) is test fixtures only: the Shopping, Health, Food and Kitchen routes with their seeds and server rules (`shop/`, `health/`, `food/` see `docs/MOCK_FOOD.md`, `kitchen/` see `docs/MOCK_KITCHEN.md`), which the parity and flow tests run the app's networks against. A test installs it with `installDummyApi()` and signs in with `signInAs()` (`mock/testing.ts`), which writes a session straight into the dummy DB. It has no auth, users, media, business, approval or platform routes: those are connected to the real API (`docs/AUTH_CONTRACT.md`, `docs/openapi.json`), and `networks/__tests__/contract.test.ts` checks every request the app sends them against `docs/openapi.json`. For a service not yet verified against the real API (Shopping, Kitchen), add the mock route with a new endpoint in the same change; Shop, Health, Food and Kitchen writes in the dummy API are all-or-nothing.

## Commands

```bash
npm run android        # expo run:android — dev client build on device/emulator (not Expo Go)
npm run web            # Expo web
npm start              # Metro only
npm run type-check     # tsc --noEmit
npm run check:tokens   # design-token gate (must pass)
npm run lint           # eslint (0 errors; warnings are informational)
npm test               # jest (jest-expo preset)
npm run gates          # tsc + check:tokens + eslint + jest — run before every commit
```

Expo Go runs everything except Google sign-in and push. Those need a dev build. The code detects Expo Go and shows a message instead of crashing.

`android/` and `ios/` are generated (continuous native generation) and gitignored. `app.json` and its config plugins are the source of truth, so never hand-edit native folders.

Set environment in `.env.local`; see `.env.example`. `config/env.ts` is the only module that reads `process.env`.

## Non-negotiable rules

1. **The data path is fixed, and it is Consultant_Mobile's: Screen → Slice → Network, and the slice serializes in `fulfilled`.**
   - The path is: `screens/<name>-screen/<Name>.tsx` → co-located `<name>Slice.ts` (built with `createAppSlice`, thunks via `create.asyncThunk`) → a network function in `networks/<domain>/<thing>.ts` → the serializer in `serializers/<domain>/…`, run by the slice's `fulfilled` reducer: `fulfilled: (state, action) => { state.cart = cartSerializer(action.payload); }`.
   - **Network functions are thin**: `export const fetchCart = async (): Promise<unknown> => { try { const response = await API.GET({ URL: '/shop/cart' }); return response.data; } catch (e) { throw toApiError(e); } }`. One request per function through `API.GET/POST/PUT/PATCH/DELETE({ URL, params, data, headers })`, a plain name (reads are `fetchX`, writes keep their verb: `cancelOrder`, `createBooking`; never `getXAPI`), the raw `{ success, data }` body back, an `ApiError` on failure. A network may map the app's input to the API's body (a private `xBody` helper), but never serializes, never fans out and never caches.
   - **A thunk returns what the network answered** (`return await fetchCart();`); for several routes, a record of the raw parts (`return { profile, cuisines }` from a `Promise.all`). Its `fulfilled` reducer serializes and shapes them; a listener in another slice (`builder.addCase(x.fulfilled)`) serializes too. A thunk reads an answer through a serializer only inside `required(…)`: to decide its next call (the first open day before its slots), or to hand app shapes to another slice (`dispatch(setUser(required(userResponseSerializer(raw))))`), so other slices only ever hold app shapes.
   - **Serializers** take the envelope: they are wrapped with `fromResponse` (`serializers/serializerUtils.ts`), which opens `{ success, data }` and passes further arguments through. A malformed answer never reaches a slice: the response interceptor refuses a 2xx body that isn't the envelope (`BAD_RESPONSE`), and a serializer that finds nothing readable answers `null`, so `fulfilled` keeps what the slice has (`if (!payload) return;` after its status updates).
   - **A screen that needs what a thunk just saved** (a toast naming it, the new code to open, a row to replace) reads it from the slice, never the raw payload: `fulfilled` keeps it in state (`saved`, `created`, `placed` …) and the screen reads `selectX(appStore.getState()).saved` (`useAppStore`, `hooks/useReduxHooks.ts`).
   - Flows several slices share live in `screens/shared/` (`authThunks`, `practiceReads`, `healthReads`, `taxonomyWrites`). The doctor and patient compositions chain dependent requests and the reference index's slug lookups, which a reducer cannot run, so they answer app shapes.
   - The session layer is `networks/authcalls/`, one file per call as in Consultant_Mobile (`signin.ts` `authLogin` + `refreshAccessToken`, `signup.ts`, `me.ts` `me`, `logout.ts` `logoutUser`, `forgotPassword.ts`, `verifyEmail.ts`, `google.ts`, `changePassword.ts`, `deleteAccount.ts`, `adminTotp.ts`, and `session.ts` for the token helpers): it stores tokens and answers the session.
   - Validation lives in `models/<domain>Model.ts` as pure functions returning `{ field: message }`.
   - Screens never import axios, never call networks directly, and never shape API data.
   - One more exception: a server-paged list hands `usePagedList` (`hooks/usePagedList.ts`) its network function and the page's serializer, since its rows live in the hook: `usePagedList((page, size) => fetchStores(q, page, size), storeSummaryPageSerializer, key)`. Filters and search text still live in the screen's slice.
   - `networks/__tests__/architecture.test.ts` enforces all of this from the sources.
2. **Every folder sits at the repo root**, as in Consultant_Mobile: no `src/` and no path aliases, and imports are relative (`../../hooks/useReduxHooks`). Every screen has its own flat kebab-case folder, `screens/<name>-screen/<Name>.tsx` + `<name>Slice.ts` (a sheet that isn't a route: `screens/<name>-sheet/`), with its sheets, `.web.tsx` and helpers beside it; flows several slices share are `screens/shared/`, and screen tests are `screens/__tests__/`.
3. **Navigation.**
   - Routes are `IRoute[]` arrays in `navigations-maps/*.tsx`. Navigators are dumb mappers.
   - `AppContainer.renderNavigator()` decides which top-level navigator mounts.
   - `BaseNavigator` holds the session-gate branches.
   - Route names (`navigations-maps/Base.tsx` `ROUTES`) never change once shipped. Add new names; never rename one.
4. **Tokens are stored only in `expo-secure-store`**, via `utils/storage_utils/storageUtils.ts` (with a `localStorage` fallback on web). `redux-persist` persists only `preferences` and `auth.hasSeenOnboarding`.
5. **There is one main network file**, as in Consultant_Mobile: `networks/network/network.ts`, the only file in `networks/network/` besides the dummy API's test fixtures. It holds:
   - the API URL (`API_URL`, from `config/env.ts`) and the axios instance (`MainAxiosInstance`; the refresh call has its own `RefreshAxiosInstance`, which skips the interceptors)
   - the bearer interceptor, the envelope check (a 2xx body that isn't `{ success, … }` is `BAD_RESPONSE`), and the single-flight refresh queue with the session-ending rules (only `REFRESH_INVALID`, `REFRESH_REUSED`, `TOKEN_REVOKED` and `ACCOUNT_DISABLED` end a session)
   - the request functions every network file calls: `API.GET/POST/PUT/PATCH/DELETE({ URL, params, data, headers, …rest })`
   - the error codes (`ERROR_CODES`, `errorCopy`, `fieldErrors`), `extractErrorMessage`, `extractErrorCode`
   - `ApiError` / `toApiError`, carrying the backend `code`, `status` and `details`; `required(value)` (a value a thunk decides on, else `BAD_RESPONSE`)
   - query helpers (`clean`, `pageParams`) and the Cloudinary upload (`services/mediaUpload.ts` signs and uploads)

   `MainAxiosInstance` is exported only for the dummy API's adapter and tests. Thunks pass errors through `rejectWithValue(toRejectedValue(e))`, because RTK drops custom error fields.
6. **Root reset.**
   - `resetAllState()` (`app/RESET_ALL_STATE`) is handled at the root reducer and wipes every account-scoped slice on sign-in and sign-out.
   - `appContainer` and `preferences` survive.
   - `auth` resets itself but keeps `hasSeenOnboarding`.
   - A new slice is account-scoped by default; nobody has to add it to a list.
7. **No raw design values** in `screens`, `Components`, `Custom-Components` or `navigators`. Every colour, size, radius, font, shadow and duration comes from `useTheme()`. `npm run check:tokens` enforces this and must pass.
8. **Banned in the UI:**
   - emoji in UI copy
   - gradients as surfaces — with one exception the owner asked for: the FYP's module-page header (`PageHeader`, chosen by `theme.header`) on Shopping, Health and Food Court screens (customer, vendor and rider apps alike), and on Orders and the account pages (`PageHeaderScope`); and the Health tab bar's selected-icon pill (`ServiceTabBar`)
   - centred spinners for content (use `Skeleton` instead)
   - decorative background shapes on any screen: watermark glyphs, faint circles or "bubbles", ambient glows (the owner asked for clean white screens)
9. **Every phase ends** with its acceptance commands run, then a commit `chunk1/pN: <summary>` (later chunks use their own prefix).

## Platform switches (GET /config)

The super admin can pause sign-ups, a service, AI, or put the platform in maintenance (MetroMatrix API
`docs/ADMIN_API.md` §5). The server enforces every switch; the app only explains it:
- `store/platformConfigSlice.ts` (a shell slice: survives sign-out) is loaded at boot by AppContainer
  (`networks/config/config.ts` → `serializers/platformConfigSerializer.ts`; anything missing reads as open);
- the axios client reports 503 `MAINTENANCE`, 503 `SERVICE_PAUSED` and 403 `SIGNUPS_PAUSED` from any request through
  `utils/authEvents.ts` (`emitPlatformNotice`), so a switch flipped mid-session shows at once;
- `MaintenanceGate` replaces every navigator but the admin's; each service app (customer, partner, rider) renders through
  `Components/platform/ServicePausedGate.tsx`; the sign-up screens show `SignupsPausedNotice` and disable Create Account;
- `networks/network/__tests__/platformNotices.test.ts` pins the `/config` shape and the three refusals (the dummy API
  has no platform routes).

## Folder map

```
App.tsx                      Providers only (Redux, PersistGate, gestures) + native-splash hold
index.ts                     registerRootComponent
config/env.ts                API_BASE_URL, GOOGLE_WEB_CLIENT_ID (the only process.env reads)
Components/                  AppContainer.tsx + appContainerSlice.ts (bootstrap/refresh/push), ConfigErrorScreen,
                             MaintenanceGate, OfflineGate, PushPrePrompt, sessionEndedCopy; and the feature parts:
  auth/                      AuthChrome (frame/header/tabs/badge), AuthFields, ChoiceCard, StepFlow, AuthErrorNotice, GoogleSignInButton(.web)
  brand/                     BrandMark, BrandWordmark (splash, onboarding)
  home/                      ServiceCard + serviceCatalog (the customer home's three cards)
  food/                      FoodParts (search, promos, cuisines, kitchen cards)
  shopping/                  ShopParts (top bar + Bag, banners, product grid, SearchField), StoreParts, ReviewItem
  admin/                     AdminParts (the staff console's stat tiles, tool menus and list cards), CsvImport (pick or
                             paste, the server's dry run, import only when every row is fine)
  voice/                     VoiceEntry (mic + confirm card + type instead) and VoiceSheet (a header mic opening it)
  health/                    HealthParts (sections, rows, the trust list, banner calls to action, the appointment-action
                             hook), healthPhotos (the Health home's bundled photos)
  platform/, kitchen/        ServicePausedGate …; the Kitchen's parts
  shared/                    ErrorBoundary
Custom-Components/           the design-system components (tokens only); barrel: Custom-Components/index; shopping/ (ProductCard,
                             VariantSheet, FilterSheet, CartStoreGroup, charts/ …); health/ (DoctorCard, DateStrip, SlotGrid,
                             AppointmentCard, PrescriptionSheet, EmergencyBanner, and the home's CareCard, PhotoTile,
                             DoctorSpotlightCard, NextVisitCard, ConcernTile …); PageHeader (the FYP gradient header);
                             ServiceTabBar (the FYP per-service bottom bars); PhotoBannerCarousel (Shopping's and Health's banners);
                             kitchen/ (VoiceButton, VoiceResultCard, InsightCard, StockLevelBar, CostBreakdown, ForecastBar,
                             PrepList, SurplusCard, TiffinPlanCard, QuoteCard, DemandHeatmap, QuadrantChart, HourCurve,
                             NutritionBlock, PantryItemRow, RecipeSuggestionCard, BadgeRow …; DesignGallery's KitchenStories)
hooks/                       useReduxHooks (useAppDispatch / useAppSelector / useAppStore), useSignOut, usePagedList
                             (+ useDebouncedValue), useShop (bag count, hearts, shop navigation),
                             useServiceNav (home ↔ service apps, tabs, leaving a service),
                             useHealth (Health navigation, banner targets), useBack, useCountdown, useNow, useBarStyle,
                             useCalmMotion (reduce motion / screen reader: nothing moves by itself),
                             useRealtime (the one live connection: events, rooms, resync, polling fallback),
                             useFoodLive (useOrderChannel for one order, useVendorBoard for the kitchen's board),
                             useLayoutClass (phone or tablet)
models/                      the app's types, one file per domain (navigation param lists, auth/business, shopping, health,
                             payments, food, kitchen, myKitchen, kitchenAdmin; models/index re-exports them), and validation
                             + form schemas (<domain>Model.ts); shopping/ holds the ONE order-status map (orderStatusModel),
                             filters, variant matrix/picker, product/coupon/return/review/store rules; health/ holds the ONE
                             appointment-status map (appointmentStatusModel), booking, family, record, prescription (dose
                             patterns), availability (overlaps), review, doctor profile, filter, emergency and admin rules;
                             kitchen/ holds the ONE Chunk 5 status map (kitchenStatusModel: Bachat Box, tiffin, catering,
                             hygiene, experiments), costing (the live cost mirror), forecast, voice (an action in plain
                             words), ai (quota wording), insight cards, board, reach, assistant, admin; myKitchen/ pantry
                             and nutrition
navigations-maps/            Base.tsx (ROUTES), Auth.tsx (gate arrays), Customer.tsx (the customer root stack), Admin/
                             Approvals/Account.tsx, HealthPatient / ShoppingCustomer / FoodCustomer.tsx (each service
                             app's tabs + the pages pushed over them), StorePartner, DoctorPartner and FoodVendor.tsx
                             (tabs + stack), Rider, AdminShopping, AdminHealth, AdminFood.tsx, types.tsx
navigators/                  sessionGate.ts (the ladder + doctorRootRoute + foodVendorRootRoute), BaseNavigator, CustomerNavigator
                             (root stack), Health/Shop/FoodAppNavigator (a service's stack over its tabs),
                             Store/Doctor/KitchenPartner (the Food vendor's app)/Rider/AdminNavigator,
                             RouteTabs (partner/staff tab mapper), ServiceTabs (service tab mapper → ServiceTabBar),
                             stacks/ (AccountStack, AdminStack, AdminShopStack, AdminHealthStack, AdminFoodStack)
networks/
  network/network.ts         the main network file: API_URL, MainAxiosInstance, the API request functions, the refresh
                             queue and session rules, error codes, ApiError, query helpers, upload
  network/mock/              the dummy API, test fixtures only (axios adapter + AsyncStorage DB; testing.ts installs it
                             and signs in with signInAs): no auth, users, media, business, approval or platform routes
  network/mock/shop/         the dummy Shopping API: shopTypes, shopSeed (3 stores, 52 products, orders), shopLogic (rules), shopRoutes
  network/mock/health/       the dummy Healthcare API, in the real API's shapes: healthTypes, healthSeed (16 specialties,
                             ~40 conditions, 23 doctors, appointments in every status), healthLogic (slots, rules),
                             healthWire (rows → the API's shapes), healthRoutes
  network/mock/food/         the dummy Food API, in the real API's shapes: foodTypes, foodSeed (cuisines, 3 demo vendors,
                             2 riders) + foodMenuSeed (their menus), foodLogic (open state, go-live checklist, plan, rider
                             usernames, portions), foodDiscovery (quotes, cards), foodOrders (deals, the checkout planner,
                             the order and payment machines, the minute jobs), foodWire, foodRoutes + foodMenuRoutes +
                             foodDiscoveryRoutes + foodOrderRoutes, foodRealtime (the gateway on the dummy socket)
  network/mock/kitchen/      the dummy Kitchen Intelligence API (docs/MOCK_KITCHEN.md): kitchenSeed (4 demo kitchens' stock,
                             recipes and 10 weeks of sales; city prices, nutrition foods, words), kitchenLogic (FIFO, costing,
                             auto sell-out), forecastLogic, insightCards, tiffin/growth/ai/assistant/myKitchen logic,
                             voiceStandIn + aiStandIns (no network), one routes file per area (+ adminKitchenRoutes),
                             foodAdditions (the keys added to API_FOOD shapes), kitchenIndex (registers it, Food's hooks)
  network/mock/mockRealtime  the in-process stand-in for the Food socket in tests (same surface as the real client)
  authcalls/                 the session layer, one file per /auth call (signin, signup, me, logout, forgotPassword,
                             verifyEmail, google, changePassword, deleteAccount, adminTotp; session.ts)
  <domain>/<thing>.ts        one thin function per endpoint through API (fetchCart, cancelOrder): the raw body back
  shopping/                  catalogue, wishlist, cart, checkout, orders, returns, reviews; shopping/partner/ the store app's
  health/                    discovery, availability, appointments, family, records, prescriptions, reviews, video, symptom;
                             referenceIndex (specialty and condition slug ↔ id); health/doctor/ the doctor app's;
                             admin/adminHealth the Health console, admin/adminFood the Food console,
                             admin/adminKitchen its Kitchen tools
  kitchen/, foodGrowth/      the vendor's Kitchen (stock, recipes, costing, purchases, forecast, waste, surplus, packing,
                             kitchenAi, insightsCards) and growth (tiffin, catering, ramadan, storefront, demand,
                             experiments, story, batching); ai/voice (voice → a proposed action, never a write)
  myKitchen/                 the customer's pantry, recipes and nutrition
notifications/               push (registration, the pre-prompt's ask, push-tap routing)
screens/<name>-screen/       <Name>.tsx + <name>Slice.ts, one flat folder per screen (232), e.g. sign-in-screen,
                             health-home-screen, food-checkout-screen; book-appointment-sheet (a sheet over DoctorProfile);
                             shared/ (authThunks, formStatus, totpChallenge, healthReads, practiceReads, taxonomyWrites,
                             photoUploads); __tests__/
serializers/                 defensive backend → app mapping, one file per domain (shopping/ and health/ per resource;
                             health/healthCommon holds every Health wire map); __tests__/fixtures/health/ real API responses;
                             kitchen/ (kitchenCommon the shared readers), myKitchen/, ai/
services/                    device/SDK adapters: googleAuth(.web), location, calendar,
                             prescriptionPdf (expo-print + sharing; the print dialog on web), voice/recorder(.web)
                             (expo-audio, MediaRecorder on web, 30 s), announcer (expo-speech, else ttsUrl, else the ring),
                             orderAlert, storefront/ (QR to a file and the share sheet), csvFile (pick a CSV, read its text),
                             mediaUpload (sign, then upload straight to Cloudinary), realtime/ (the Food socket)
store/
  createAppSlice.ts          buildCreateSlice with asyncThunk — every slice uses it
  store.ts                   combineReducers, RESET_ALL_STATE root handling, persist config
  resetAllState.ts           the RESET_ALL_STATE action
  authSlice.ts               the session (user, business, gate) every screen reads
  preferencesSlice.ts        lastService, pushPromptSeen, recentSearches, recentHealthSearches (persisted; searches cleared on sign-out)
theme/                       tokens, services, typography, ThemeProvider/useTheme, StoreBrandScope — the ONLY place raw values live
utils/<name>/                one folder per util: storage_utils/storageUtils (tokens), auth-events, phone, alert (web-safe),
                             haptics, pickers, form-errors, money (formatPKR — the only way money is shown), cdn (image
                             sizing), dates, ids, health-time (every Health time, shown in the practice's timezone), maps,
                             prescription-html, units (base units g/ml/pc, "7.5 kg", "2 dozen", custom units), script (Urdu
                             script → RTL), share-text, store-card-html (the printable QR card)
__live__/, __fixtures__/     the live suite against a running API; shared test fixtures
scripts/check-design-tokens.js, capture-health-fixtures.js and capture-food-fixtures.js (real responses → the
                             serializer fixtures)
docs/                        API_CONTRACT_ASSUMED.md, API_SHOPPING_ASSUMED.md, API_HEALTH.md and API_FOOD.md (copies of
                             the backend's), MOCK_HEALTH.md, MOCK_FOOD.md, MOCK_IMAGES.md, GOOGLE_SIGNIN.md,
                             PLAY_BACKGROUND_LOCATION.md, FOOD_DEVICE_CHECKS.md; API_KITCHEN_ASSUMED.md, AI_ASSUMED.md,
                             VOICE_ASSUMED.md (Chunk 5's assumed contract), MOCK_KITCHEN.md, KITCHEN_DEVICE_CHECKS.md
assets/images/               FYP icon + splash mark; services/ and health/ (card photos — sources in each CREDITS.md)
```

Stateless screens have no slice. Their state is global (`auth`, `preferences`) or they only navigate. These are Rejected, Suspended, CustomerHome, ServicePreview, OrderPlaced, FoodOrderPlaced, Saved, StoreMore, BookingConfirmed, PrescriptionList, DoctorMore, VendorMore, FoodReviews (a paged list), RiderProfile (reads `riderHome`), and the tab lists HealthAppointments, ShopOrders and FoodOrders (they read `ordersSlice`, and share their lists with Orders via `screens/orders-screen/OrdersLists.tsx`). Slices other screens read (`bag`, `foodBag`, `foodOrder`, `foodFavourites`, `saved`, `addressBook`, `orderDetail`, `notifications`, `family`, `appointmentDetail`) live beside the screen that owns them. BookAppointment is a sheet over DoctorProfile (`BookAppointmentSheet` + its slice), not a route. AdminKitchenHygieneReview reads `adminKitchenHygiene` (beside AdminKitchenHygiene).

## How to add a screen

1. Create `screens/<name>-screen/<Name>.tsx` and `<name>Slice.ts` (kebab-case folder, e.g. `screens/food-checkout-screen/FoodCheckout.tsx`).
   - Build the slice with `createAppSlice`, with state, reducers, thunks and `selectors` in one place.
   - A thunk calls a thin network function and returns what it answered (`return await fetchX(…)`); its `fulfilled` reducer serializes it (`state.x = xSerializer(action.payload)`). On failure it returns `rejectWithValue(toRejectedValue(e))`.
   - Form validation calls `models/<domain>Model.ts`.
2. Register the slice in `store/store.ts` under "Per-screen slices" (`<name>: <name>Slice.reducer`).
3. Add the route name to `ROUTES` in `navigations-maps/Base.tsx` and its params to `RootStackParamList` (`models/navigation.ts`), or to the relevant navigator's param list.
4. Add an `IRoute` entry to the right array in `navigations-maps/*.tsx`. Never register a screen inside a navigator file directly.
   - A back button calls `back` from `useBack({ name: '<parent>' })` (`hooks/useBack.ts`), never `navigation.goBack()`. With no history (a link, a push tap, a web refresh) it lands on the parent instead of doing nothing, and it answers Android's hardware back too.
   - A jump into another tab passes `initial: false`, so that tab's first screen stays underneath.
5. Style only through the theme (see below), then run `npm run gates`.

## Styling pattern

```tsx
import { useStyles, type Theme } from '../../theme';

const makeStyles = ({ colors, space, type }: Theme) => StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.canvas, padding: space.s24 },
  title: { ...type.h1, color: colors.ink },
});

const styles = useStyles(makeStyles); // memoised on the active theme (mode + service)
```

- Service accents come from `useTheme().service` (`accent`, `accentDeep`, `accentSoft`, `accentLine`, `onAccent`).
- Wrap a subtree in `<ServiceScope service="food">` to switch its accent.
- Auth, admin and the customer shell (home, profile, orders) use `neutral` (MetroMatrix emerald). Each service app scopes its own accent: Food pink (Foodpanda-like), Healthcare blue, Shopping orange.
- Inside a store (its page, its products) `<StoreBrandScope brand onBrand>` swaps the accent for the store's own colour, with AA-safe text and darker brand-coloured text.
- Page headers follow the module, never the screen (`theme.header`): Shopping, Health and Food Court pages wear the FYP's gradient `PageHeader` (one look across services, the owner's request) (the service's accent sweeping to its deep step, a radius-24 foot, a bold `pageTitle`, actions in white), which `ScreenShell` and `ShopTopBar` pick automatically; screens with their own top (the Food home, Food search) build it with `PageHeader` and put the search pill inside it. Inside a store, or on a Food vendor's page, the top stays white (a full-bleed photo, or a white bar with the store's colour as a rule under it). Controls in the header's trailing slot or `headerContent` paint themselves for the gradient (`OnGradientContext`; `Avatar` too).
- The customer shell's own pages wear it as well, in the colour of the scope they open in: Orders, Profile, Change password, Addresses, Address form and Notifications wrap themselves in `PageHeaderScope` (emerald in the customer and admin apps, the service's colour in the store and doctor apps). A new account page does the same.
- The staff console wears it on every page (`AdminNavigator` wraps its tabs in `PageHeaderScope`) and is built from `Components/admin/AdminParts`: numbers on raised `StatGrid` tiles with tinted icon wells, `ToolSection` menus ("Needs you", "Manage") whose rows take the categorical icon colours, and lists as raised `RowCard`s (a mark, lines, a status pill, an amount). Search, tabs and filter chips sit inside the header (`SearchField`, `SegmentTabs` and `ChoiceChip` paint themselves for the gradient).
- `InlineNotice` is a white card with a hairline border, ink text and the tone only in a small tinted icon well: never a tinted fill or a coloured strip down its side (the owner finds those generated-looking).
- Profile is the FYP's account screen: a hero that scrolls away (`ScreenShell headerScrolls`), Overview · Addresses · Settings, count tiles, and menu groups under `overline` titles whose rows take the FYP's categorical icon colours (`ListRow tint`, `theme.rowTint`).
- Every screen stands on pure white (`colors.canvas`, pinned by `theme/__tests__/canvas.test.ts`), except Digital Health: the FYP's healthcare ground `#F8FBFF` under white cards, with slate ink (`HEALTH_PALETTE`). Only full-screen media (the video call, the photo viewer) are dark.
- Neutrals are the FYP's cool slate (`surfaceSunk #F1F5F9`, `line #E2E8F0`, ink `#0F172A`), pinned by `theme/__tests__/contrast.test.ts`. Never warm stone, cream or beige greys: the owner asked for clean white screens that don't look generated.
- Healthcare uses the FYP's type like every service; its touch targets stay 48 and dynamic type goes to 150% (`theme.maxFontScale`).
- The Health home is photo-led: a bento of three soft cards (`CareCard`, `theme.careTint`) whose photos fade into their ground, photo tiles for Health's own services, staff banners, a specialty grid in categorical colours (`theme.specialtyTint`), the city's top doctors, and the trust list. Every photo shows what its card does and is licensed: bundled ones are listed in `assets/images/health/CREDITS.md`, remote ones (banners, demo portraits) in `docs/MOCK_IMAGES.md`. Demo doctors are fictional; their stock portraits say so in the profile. Nothing on the page moves by itself under reduced motion or a screen reader (`useCalmMotion`).
- Cards are the FYP card by default (`Card`, `elevation.card`: a `lineSoft` border and a soft slate shadow, radius 16). Section heads use `sectionTitle` (19/800). The side gutter is the FYP's 20.
- Bottom tabs: a service app's bar is `ServiceTabBar`, in the look its theme names (`theme.tabBar`: Health's gradient pill, Shopping's lifted tint bar, Food's soft pill). A service's Home tab back leaves the service (`useServiceNav().leaveService`); other tab roots get `{ asTab: true }` and hide their back (`useIsTabRoot`). Jumps between the home and a service app go through `useServiceNav`, never a hard-coded parent.
- Health copy: calm and plain, no exclamation marks; red only for emergencies (`appointmentStatusModel` never uses `danger`); appointment and payment wording only from `appointmentStatusModel`; every time through `healthTime` in the practice's timezone; "Recorded fees" (never earnings); the symptom checker names areas to discuss, never a diagnosis.
- Shopping copy: "Bag" (never cart), "Recorded sales" (never revenue or income), money only through `formatPKR`, order/payment/return wording only from `orderStatusModel`, every remote image through `cdn()`.
- Food copy: "bag" too (one kitchen at a time), money only through `formatPKR`, order/payment/rider wording only from `foodStatusModel`, totals only the server's (subtotal − the deal + the kitchen's delivery fee; there is no other fee). Say that customers pay the kitchen directly and that riders are the kitchen's own.
- Food live screens (the customer's order, the kitchen's board and order page) go through `useOrderChannel` / `useVendorBoard`, never the socket. REST is the truth: events are hints, every reconnect reads again, and polling covers a dropped connection. The board rings (`services/orderAlert`) while a new order is unopened, keeps the screen awake, and shows four columns from tablet width (`useLayoutClass`).
- Kitchen copy (Chunk 5):
  - Costs say "Cost to make" and "You keep" (never profit or margin, never revenue); money only through `formatPKR`; quantities only through `utils/units` (`formatQty`).
  - Every number the app works out is "estimated" (forecasts, calories, a dish's numbers), and every assistant result is a draft: voice proposes an action in plain words (`voiceModel`), and nothing is written until the cook taps Confirm, which calls the ordinary endpoint.
  - `AI_UNAVAILABLE` and `AI_QUOTA_REACHED` are never fatal: the screen shows the manual path inline, with the reset date (`aiModel`).
  - Bachat Box, tiffin, catering, hygiene and experiment wording only from `kitchenStatusModel`.
  - Urdu content reads right to left (`utils/script`) and carries `accessibilityLanguage="ur"`.
  - The demand map never shows an area under 10 searches and never ties a search to a person.
  - Nutrition is off until the customer turns it on, kitchens never see it, its wording never praises or blames, and "Delete my nutrition data" removes all of it.
  - Insight cards are the `InlineNotice` look (a tinted icon well, no side strip), at most five, ranked by severity.
- Onboarding: everything on a slide, including the primary button, wears that slide's colour.
- Platform-specific files (`X.web.tsx`) must never import `./X`; on web that path resolves to the file itself. Put shared code in a third module (see `sheetShared.ts`, `dateFieldShared.ts`).

## Session gates (BaseNavigator branch order)

The order matters. It lives in ONE pure function, `resolveGate()` in `navigators/sessionGate.ts`, which has its own unit test. BaseNavigator and AppContainer both call it:

1. not authenticated → Onboarding (first launch only) + Role Selection, Provider Selection, SignIn/SignUp, ProviderSignIn/ProviderSignUp, ForgotPassword → ResetPasswordOTP → ResetPassword
2. pending TOTP (staff sign in on the ordinary SignIn; the API answers `WRONG_PORTAL` there and `signInAndOpen` retries on the admin portal) → AdminTotp, or AdminTwoFactorEnrol on a first sign-in
3. email not verified → EmailVerification (a link: the screen polls /auth/me; VerifySuccess handles metromatrix://verify-email?token=… and ?verified=1, also registered while signed out)
4. customer whose profile is incomplete → CompleteProfile (3 steps)
5. provider with no business, or a `draft` one → PersonalInfo (3 steps, resumes at the unfinished one)
6. `pending_approval` → ProviderApprovalPending
7. `rejected` → Rejected (+ PersonalInfo to resubmit)
8. `suspended` → Suspended

A rider (Role Selection → Rider → RiderSignIn: the username their vendor issued, on the partner portal as `identifier`) skips 3–8: the vendor made the account, and its email is a never-mailed placeholder.

The splash plays on every launch as an overlay in AppContainer. It lifts only once both its animation and `bootstrapSession` are done.

Once the gate is cleared, `AppContainer.renderNavigator()` mounts the navigator for the role:
- `customer` → `CustomerNavigator`: a root stack (`CustomerStack`) with the three-card home (no bottom bar; its side menu opens Orders, Profile, Saved, Addresses…) and one app per service: Health (Home · Appointments · Records · Profile), Shopping (Home · Bag · Saved · Orders), Food Court (Home · Orders · Profile)
- approved `partner` → `Store`/`Doctor`/`KitchenPartnerNavigator`, chosen by `serviceType`. The store app is a stack over Today · Orders · Products · More. The doctor app is a stack over Today · Calendar · Patients · More; it opens on PracticeSetup until the doctor is listed (`doctorRootRoute(business)`). The Food vendor's app (`KitchenPartnerNavigator`, `navigations-maps/FoodVendor.ts`) is a stack over Orders · Menu · Kitchen · Riders · More (a home kitchen has Today · Orders · Kitchen · More, with Menu and Riders in More; Today holds portions, the weekly menu and pre-order slots); it opens on Kitchen setup until the kitchen is live (`foodVendorRootRoute(business)`, from the session's `business.food`). The Kitchen tab is the hub of Chunk 5's tools (stock, recipes and costs, purchases, forecast and prep, waste and Bachat Box, growth, the assistant).
- `rider` → `RiderNavigator`: a stack over Deliveries · Cash · Profile, with each delivery pushed over them (`RiderOrder`: one big button per step, cash at the door). Going on duty asks for location after a plain explanation; the rider's location is shared only on duty or on a delivery (`services/location/riderLocation`, sent by `riderTransport`: the socket, else the REST batch).
- `admin` / `super_admin` → `AdminNavigator` (Approvals · Shopping · Health · Food · Profile). A doctor is approved only after staff check the PMDC number (Health → Doctor verification); the server answers `422 PMDC_NOT_VERIFIED` otherwise. A home kitchen goes live only after staff record a passed food-safety check (Food → Vendors).
- Food Court reviews: one per order once it arrived (`FoodRateOrder`, from the order page); the vendor page shows the rating block and `FoodReviews`; the kitchen replies (`VendorReviews`) and reads `VendorInsights` (recorded sales). Staff hide reviews, feature and suspend vendors, change a vendor's plan, and run cuisines and the home's banners. The Food tab's Kitchen tools (`screens/admin-kitchen-*-screen`, from the overview) run the assistant (use, the switch, limits), city prices and nutrition foods (CSV with a dry run), the words voice understands, the calendar (Ramadan's dates), hygiene checks, signature dishes, the city demand map and a tiffin or catering code lookup.

## API contract

Every network call is built from MetroMatrix-API `docs/API_AUTH.md` / `docs/API_SHOPPING.md` / `docs/API_HEALTH.md`, never from guesses.

- **Healthcare is on the real contract** (`health/sync-1`). Paths are `/health`, `/health/doctor` (appointments by **code**) and `/admin/health`; uploads go through `/media/sign-upload`.
  - `docs/API_HEALTH.md` is a copy of the backend's; the backend repository is the source of truth.
  - Serializers map the wire to the app's own words in `models/health.ts`: offset times become UTC, icon keys become glyphs, `booked`/`in_consultation` become `confirmed`/`in_progress`, `unpaid` becomes `pay_at_visit`. Every map lives in `serializers/health/healthCommon.ts`.
  - Networks map the app's input to the real bodies. When one screen needs several routes, the thunk (or a `screens/Health/*/shared` composition) calls the thin functions together.
  - Values the API doesn't send yet are derived and marked `TODO(API_HEALTH)`.
  - When the backend's document changes: copy it, update the networks, serializers, models and the dummy API, refresh the fixture (`scripts/capture-health-fixtures.js`), and run the gates. The parity test fails on any key the two disagree on (`docs/MOCK_HEALTH.md`).
- **Food Court is on the real contract** (`chunk4/p8`): `docs/API_FOOD.md` is a copy of the backend's. Paths are `/food` (discovery, customer), `/food/vendor`, `/food/rider` and `/admin/food`, plus the `/food` socket.io namespace (§5).
  - The vendor id everywhere is the brand id; riders sign in with a username on the partner portal.
  - Serializers map the wire to `models/food.ts` (`lastGeo` becomes `lastPosition`, `etaRange` becomes `eta`, minor units become rupees). Every limit in `models/food` is the API's own DTO limit.
  - When the backend's document changes: copy it, update the networks, serializers, models and the dummy API, capture again (`scripts/capture-food-fixtures.js`, see `docs/MOCK_FOOD.md`), and run the gates. The parity tests fail on any key or error code the two disagree on.
  - What the API doesn't send yet is marked `TODO(API_FOOD)` (today: `isFeatured` on a staff vendor's detail).
- **Auth is on the real contract** (merged from the `ammar` branch, 2026-10-30): `docs/AUTH_CONTRACT.md` (the same file is in the backend) and `docs/openapi.json` (a copy of the backend's `openapi.json`, `npm run openapi:export` there). `networks/__tests__/contract.test.ts` checks every auth, users, media, business and approval request against it; copy the file again when the API changes. Error codes the app branches on live in the main network file (`ERROR_CODES` in `networks/network/network.ts`), with the rule that only `REFRESH_INVALID`, `REFRESH_REUSED`, `TOKEN_REVOKED` and `ACCOUNT_DISABLED` end a session. Riders sign in on the partner portal with `identifier` (their username).
- **Shopping still runs on an assumed document**: `docs/API_SHOPPING_ASSUMED.md` (NestJS conventions: `{ success, data }`, `VALIDATION_FAILED`, `page/pageSize`, integer rupees, `Idempotency-Key` on checkout and booking). The app now calls the real API for it too, so reconcile it with the backend's `API_SHOPPING.md`. Every dependency is marked `TODO(API_SHOPPING)` (`grep -rn "TODO(API_" src`).

- **Kitchen Intelligence runs on an assumed contract** (Chunk 5, owner's decision 2026-10-19): `docs/API_KITCHEN_ASSUMED.md`, `docs/AI_ASSUMED.md` and `docs/VOICE_ASSUMED.md`, written in API_FOOD's conventions (whole rupees; quantities in base units g/ml/pc; branch-local dates; `Idempotency-Key` on reservations and subscriptions). No backend module exists yet.
  - Paths: `/food/vendor/kitchen`, `/food/vendor/{surplus,tiffin,catering,ramadan,storefront,demand,menu-insights,experiments,story,hygiene,ai,nutrition}`, `/food/{surplus,tiffin,catering,ramadan}`, `/ai/voice/interpret`, `/my-kitchen`, `/admin/kitchen`.
  - Voice never writes: it answers a proposed action, and the app's Confirm calls the ordinary endpoint.
  - Keys added to API_FOOD shapes live in one list (`mock/kitchen/foodAdditions.ts`, doc §5); the Food parity tests leave them out and assert they're absent from the real capture.
  - `kitchenContract.test.ts` keeps the three documents and the dummy API one thing: every `<!-- contract: name -->` example has the answer's keys, and every request it runs is documented. Add an example whenever you add a route.
  - Dependencies are marked `TODO(API_KITCHEN)`, `TODO(API_AI)` or `TODO(API_VOICE)`; Daily Basket's grocery `netQuantity` is `TODO(API_SHOPPING)`.

When a real document arrives, reconcile it in one pass:
- update the networks, serializers and models (and the dummy API);
- leave screens and slices alone.

## Testing on Expo / web

- **Expo Go** (`npm start`): runs the whole app except native Google sign-in and push, against `EXPO_PUBLIC_API_URL` (a local API: `http://<LAN IP>:3000/api/v1` on a phone, `http://localhost:3000/api/v1` on web; the API's `CORS_ORIGINS` must list the web origin). Accounts come from the API's seeds (`npm run seed:superadmin`, `seed:shopping`, `seed:health`, `seed:food`, `seed:kitchen` in the backend). Video consultations open public meet.jit.si rooms in a WebView; on web they open in a new tab.
- **Web** (`npm run web`):
  - Google sign-in uses Google Identity Services and needs `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID`.
  - Deep paths work, e.g. `/get-started`, `/sign-in`, `/provider/sign-in`, `/home/food`, `/shop`, `/shop/store/lawn-and-loom-7a1f3`, `/shop/product/p_l1`, `/orders/MM-24A7Q2`, `/store/orders/:id`, `/admin/shop`, `/health`, `/health/appointments`, `/health/doctor/:id`, `/health/appointment/:code`, `/shop/orders`, `/shop/bag`, `/profile/records`, `/doctor/appointments/:code`, `/admin/health`, `/vendor/orders`, `/vendor/menu`, `/vendor/menu/dish/:id`, `/vendor/today`, `/vendor/setup`, `/vendor/riders/:id`, `/rider/sign-in`, `/rider/deliveries`, `/food/vendor/:slug`, `/food/bag`, `/food/checkout`, `/food/order/:code`, `/food/saved`, `/vendor/deals`, `/vendor/orders/:id`, `/rider/deliveries/:id`, `/rider/cash`, `/food/order/:code/rate`, `/food/reviews/:id`, `/vendor/reviews`, `/vendor/insights`, `/admin/food` (+ `/vendors/:id`, `/orders/:id`, `/reviews`, `/cuisines`, `/banners`, `/kitchen/{assistant,prices,nutrition,words,calendar,hygiene,signatures,demand,lookup}`), and Chunk 5's `/vendor/kitchen` (+ `/stock`, `/recipes/:itemId`, `/purchases`, `/forecast`, `/waste`, `/settings`), `/vendor/assistant`, `/food/bachat-box`, `/food/tiffins`, `/food/my-kitchen` (+ `/recipes`), `/food/nutrition` (+ `/week`), `/s/:slug` (a kitchen's link: the public page signed out). The staff Profile tab is `/account`.
  - After adding new folders or `.web.tsx` files, restart Metro with `--clear` (its watcher can miss them). Don't start it with `CI=1`: that turns watch mode off and the browser keeps the old bundle.
  - Bottom sheets render as a `Modal` (`Sheet.web.tsx`), because `@gorhom/bottom-sheet` never presents in a browser.
  - `/dev/gallery` exists only in development builds.
