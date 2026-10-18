# CLAUDE.md

Guidance for Claude Code (and humans) working in this repository.

MetroMatrix is a zero-commission community marketplace with three services: **Shopping**, **Healthcare** and **Food**. This app serves:
- customers, who use one app across all three services
- partners (store, doctor, kitchen), who get the partner app for their service
- admins, who approve partners

The app follows the **FinMatrix app architecture exactly**. Its **look and flows follow the owner's MetroMatrix FYP app** (`~/MetroMatrix/Waleed-MetroMatrix`):
- white, light-only screens in the platform system font, with the FYP icon, splash and onboarding (Health keeps the FYP's pale clinical blue);
- Role Selection → (Provider Selection) → sign in / sign up → email link → profile steps;
- the FYP's three-card user home, with no bottom bar; each service opens its own app with its own bottom tabs, as in the FYP. The app is in English: no Urdu text or language switch. Food is branded **Food Court**: a platform for food vendors. Unlike Foodpanda, MetroMatrix takes **no commission** and runs **no rider fleet**. Vendors deliver with their own riders through MetroMatrix's delivery app. Delivery details (time, fee, area) are fine to show; never imply MetroMatrix's own couriers or a cut of the order.

Copy the FYP's UX, never its code paths, Firebase setup or per-role duplicate network files. There is no Facebook login.

## Backend switch (one file)

`src/config/env.ts` → `BACKEND_URL` (or `EXPO_PUBLIC_API_URL`). While it is empty, `api` uses the dummy API (`src/networks/network/mock/`: `mockServer.ts` routes, `mockDb.ts` seeded accounts, `mockConfig.ts` rules, `mockFood.ts` catalogue, `shop/` the whole Shopping API with its seed and server rules, `health/` the whole Healthcare API with its seed and server rules, `food/` the Food API's routes as the backend commits them, see `docs/MOCK_FOOD.md`). The dummy API answers exactly what `docs/API_CONTRACT_ASSUMED.md` and `docs/API_SHOPPING_ASSUMED.md` specify, and for Health the real `docs/API_HEALTH.md` (see `docs/MOCK_HEALTH.md`), so nothing else changes when the real URL is set. When you add an endpoint, add its mock route in the same change. Shop, Health and Food writes are all-or-nothing (a failed request leaves the dummy DB as it was).

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

Set environment in `.env.local`; see `.env.example`. `src/config/env.ts` is the only module that reads `process.env`.

## Non-negotiable rules

1. **The data path is fixed.**
   - The path is: `XScreen.tsx` → co-located `xSlice.ts` (built with `createAppSlice`, thunks via `create.asyncThunk`) → `src/networks/<domain>/<x>Network.ts` → `src/serializers/<domain>Serializer.ts`.
   - Validation lives in `src/models/<domain>Model.ts` as pure functions returning `{ field: message }`.
   - Screens never import axios, never call networks directly, and never shape API data.
   - The one exception, as in FinMatrix: a server-paged list hands its network function to `usePagedList` (`src/hooks/usePagedList.ts`), which receives serialized `Paged<T>` pages. Filters and search text still live in the screen's slice.
2. **The folder root is `src/`**, with aliases defined identically in `tsconfig.json` and `babel.config.js`: `@`, `@screens`, `@components`, `@custom`, `@store`, `@networks`, `@models`, `@serializers`, `@hooks`, `@theme`, `@utils`, `@navigators`, `@assets`.
3. **Navigation.**
   - Routes are `IRoute[]` arrays in `src/navigations-maps/*.ts`. Navigators are dumb mappers.
   - `AppContainer.renderNavigator()` decides which top-level navigator mounts.
   - `BaseNavigator` holds the session-gate branches.
   - Route names (`navigations-maps/Base.ts` `ROUTES`) never change once shipped. Add new names; never rename one.
4. **Tokens are stored only in `expo-secure-store`**, via `src/utils/storageUtils.ts` (with a `localStorage` fallback on web). `redux-persist` persists only `preferences` and `auth.hasSeenOnboarding`.
5. **There is one axios client**, `src/networks/network/apiHelpers.ts`. It provides:
   - the bearer interceptor
   - the single-flight refresh queue
   - `AuthError` carrying the backend `code`, `status` and `details`
   - envelope unwrapping (`unwrap`)
   - `extractErrorMessage`

   Thunks pass errors through `rejectWithValue(toRejectedValue(e))`, because RTK drops custom error fields.
6. **Root reset.**
   - `resetAllState()` (`app/RESET_ALL_STATE`) is handled at the root reducer and wipes every account-scoped slice on sign-in and sign-out.
   - `appContainer` and `preferences` survive.
   - `auth` resets itself but keeps `hasSeenOnboarding`.
   - A new slice is account-scoped by default; nobody has to add it to a list.
7. **No raw design values** in `src/screens`, `src/components`, `src/Custom-Components` or `src/navigators`. Every colour, size, radius, font, shadow and duration comes from `useTheme()`. `npm run check:tokens` enforces this and must pass.
8. **Banned in the UI:**
   - emoji in UI copy
   - gradients as surfaces — with one exception the owner asked for: the FYP's module-page header (`PageHeader`, chosen by `theme.header`) on Shopping, Health and Food Court screens (customer, vendor and rider apps alike), and on Orders and the account pages (`PageHeaderScope`); and the Health tab bar's selected-icon pill (`ServiceTabBar`)
   - centred spinners for content (use `Skeleton` instead)
   - decorative background shapes on any screen: watermark glyphs, faint circles or "bubbles", ambient glows (the owner asked for clean white screens)
9. **Every phase ends** with its acceptance commands run, then a commit `chunk1/pN: <summary>` (later chunks use their own prefix).

## Folder map

```
App.tsx                      Providers only (Redux, PersistGate, gestures) + native-splash hold
index.js                     registerRootComponent
src/
  config/env.ts              API_BASE_URL, GOOGLE_WEB_CLIENT_ID (the only process.env reads)
  store/
    createAppSlice.ts        buildCreateSlice with asyncThunk — every slice uses it
    store.ts                 combineReducers, RESET_ALL_STATE root handling, persist config
    resetAllState.ts         the RESET_ALL_STATE action
    preferencesSlice.ts      lastService, pushPromptSeen, recentSearches, recentHealthSearches (persisted; searches cleared on sign-out)
  hooks/                     useAppDispatch / useAppSelector, useSignOut, usePagedList (+ useDebouncedValue), useShop (bag count, hearts, shop navigation),
                             useServiceNav (home ↔ service apps, tabs, leaving a service),
                             useHealth (Health navigation, banner targets), useBack, useCountdown, useNow, useBarStyle,
                             useCalmMotion (reduce motion / screen reader: nothing moves by itself),
                             useRealtime (the one live connection: events, rooms, resync, polling fallback),
                             useFoodLive (useOrderChannel for one order, useVendorBoard for the kitchen's board),
                             useLayoutClass (phone or tablet)
  networks/
    network/apiHelpers.ts    the axios client, refresh queue, AuthError, unwrap
    network/mock/            the dummy API (axios adapter + AsyncStorage DB) used while no backend URL is set
    network/mock/shop/       the dummy Shopping API: shopTypes, shopSeed (3 stores, 52 products, orders), shopLogic (rules), shopRoutes
    network/mock/health/     the dummy Healthcare API, in the real API's shapes: healthTypes, healthSeed (16 specialties,
                             ~40 conditions, 23 doctors, appointments in every status), healthLogic (slots, rules),
                             healthWire (rows → the API's shapes), healthRoutes
    network/mock/food/       the dummy Food API, in the real API's shapes: foodTypes, foodSeed (cuisines, 3 demo vendors,
                             2 riders) + foodMenuSeed (their menus), foodLogic (open state, go-live checklist, plan, rider
                             usernames, portions), foodDiscovery (quotes, cards), foodOrders (deals, the checkout planner,
                             the order and payment machines, the minute jobs), foodWire, foodRoutes + foodMenuRoutes +
                             foodDiscoveryRoutes + foodOrderRoutes, foodRealtime (the gateway on the dummy socket)
    network/mock/mockRealtime the in-process stand-in for the Food socket (same surface as the real client)
    <domain>/<x>Network.ts   one function per endpoint (auth, users, media, businesses, admin, food, addresses, notifications)
    shopping/                catalogue, wishlist, cart, checkout, orders, returns, reviews; shopping/partner/ the store app's
    health/                  discovery, availability, appointments, family, records, prescriptions, reviews, video, symptom;
                             referenceIndex (specialty and condition slug ↔ id); health/doctor/ the doctor app's;
                             admin/adminHealthNetwork the Health console, admin/adminFoodNetwork the Food console
  serializers/               defensive backend → app mapping, one file per domain (shopping/ and health/ per resource;
                             health/healthCommon holds every Health wire map); __tests__/fixtures/health/ real API responses
  models/                    validation + form schemas, one file per domain; shopping/ holds the ONE order-status map
                             (orderStatusModel), filters, variant matrix/picker, product/coupon/return/review/store rules;
                             health/ holds the ONE appointment-status map (appointmentStatusModel), booking, family, record,
                             prescription (dose patterns), availability (overlaps), review, doctor profile, filter, emergency
                             and admin rules
  types/                     shared types (navigation param lists, auth/business, shopping, health, payments)
  utils/                     storageUtils, authEvents, phone, alert (web-safe), haptics, pickers, formErrors,
                             money (formatPKR — the only way money is shown), cdn (image sizing), dates, ids,
                             healthTime (every Health time, shown in the practice's timezone), maps, prescriptionHtml
  services/                  device/SDK adapters: googleAuth(.web), push (+ push-tap routing), location, calendar,
                             prescriptionPdf (expo-print + sharing; the print dialog on web)
  theme/                     tokens, services, typography, ThemeProvider/useTheme, StoreBrandScope — the ONLY place raw values live
  Custom-Components/         the design-system components (tokens only); barrel: @custom/index; shopping/ (ProductCard,
                             VariantSheet, FilterSheet, CartStoreGroup, charts/ …); health/ (DoctorCard, DateStrip, SlotGrid,
                             AppointmentCard, PrescriptionSheet, EmergencyBanner, and the home's CareCard, PhotoTile,
                             DoctorSpotlightCard, NextVisitCard, ConcernTile …); PageHeader (the FYP gradient header);
                             ServiceTabBar (the FYP per-service bottom bars); PhotoBannerCarousel (Shopping's and Health's banners)
  components/app-container/  AppContainer, appContainerSlice (bootstrap/refresh/push), OfflineGate, PushPrePrompt
  components/auth/           AuthChrome (frame/header/tabs/badge), AuthFields, ChoiceCard, StepFlow, AuthErrorNotice, GoogleSignInButton(.web)
  components/brand/          BrandMark, BrandWordmark (splash, onboarding)
  components/home/           ServiceCard + serviceCatalog (the customer home's three cards)
  components/food/           FoodParts (search, promos, cuisines, kitchen cards)
  components/shopping/       ShopParts (top bar + Bag, banners, product grid, SearchField), StoreParts, ReviewItem
  components/health/         HealthParts (sections, rows, the trust list, banner calls to action, the appointment-action
                             hook), healthPhotos (the Health home's bundled photos)
  components/shared/         ErrorBoundary
  navigations-maps/          Base.ts (ROUTES), Auth.ts (gate arrays), Customer.ts (the customer root stack), Admin/
                             Approvals/Account.ts, HealthPatient.ts / ShoppingCustomer.ts / FoodCustomer.ts (each service
                             app's tabs + the pages pushed over them), StorePartner.ts, DoctorPartner.ts and FoodVendor.ts
                             (tabs + stack), Rider.ts, AdminShopping.ts, AdminHealth.ts, AdminFood.ts, types.ts
  navigators/                sessionGate.ts (the ladder + doctorRootRoute + foodVendorRootRoute), BaseNavigator, CustomerNavigator
                             (root stack), Health/Shop/FoodAppNavigator (a service's stack over its tabs),
                             Store/Doctor/KitchenPartner (the Food vendor's app)/Rider/AdminNavigator,
                             RouteTabs (partner/staff tab mapper), ServiceTabs (service tab mapper → ServiceTabBar),
                             stacks/ (AccountStack, AdminStack, AdminShopStack, AdminHealthStack, AdminFoodStack)
  screens/<Area>/<Name>/     NameScreen.tsx + nameSlice.ts
                             Areas: Onboarding (+ Splash), RoleSelection, ProviderSelection, Auth, Partner,
                             Admin (+ Admin/Shopping, Admin/Health, Admin/Food), Customer, Account, Shopping/Customer, Shopping/Store,
                             Health/Patient, Health/Doctor, Food/Vendor, Food/Rider, Dev
scripts/check-design-tokens.js, capture-health-fixtures.js (real Health responses → the serializer fixture)
docs/                        API_CONTRACT_ASSUMED.md, API_SHOPPING_ASSUMED.md, API_HEALTH.md (a copy of the backend's),
                             MOCK_HEALTH.md, MOCK_FOOD.md, MOCK_IMAGES.md, GOOGLE_SIGNIN.md
assets/images/               FYP icon + splash mark; services/ and health/ (card photos — sources in each CREDITS.md)
```

Stateless screens have no slice. Their state is global (`auth`, `preferences`) or they only navigate. These are Rejected, Suspended, CustomerHome, ServicePreview, OrderPlaced, FoodOrderPlaced, Saved, StoreMore, BookingConfirmed, PrescriptionList, DoctorMore, VendorMore, FoodReviews (a paged list), RiderProfile (reads `riderHome`), and the tab lists HealthAppointments, ShopOrders and FoodOrders (they read `ordersSlice`, and share their lists with Orders via `Orders/OrdersLists.tsx`). Slices other screens read (`bag`, `foodBag`, `foodOrder`, `foodFavourites`, `saved`, `addressBook`, `orderDetail`, `notifications`, `family`, `appointmentDetail`) live beside the screen that owns them. BookAppointment is a sheet over DoctorProfile (`BookAppointmentSheet` + its slice), not a route.

## How to add a screen

1. Create `src/screens/<Area>/<Name>/<Name>Screen.tsx` and `<name>Slice.ts`.
   - Build the slice with `createAppSlice`, with state, reducers, thunks and `selectors` in one place.
   - A thunk calls a network function and returns serialized data. On failure it returns `rejectWithValue(toRejectedValue(e))`.
   - Form validation calls `src/models/<domain>Model.ts`.
2. Register the slice in `src/store/store.ts` under "Per-screen slices" (`<name>: <name>Slice.reducer`).
3. Add the route name to `ROUTES` in `src/navigations-maps/Base.ts` and its params to `RootStackParamList` (`src/types/navigation.ts`), or to the relevant navigator's param list.
4. Add an `IRoute` entry to the right array in `src/navigations-maps/*.ts`. Never register a screen inside a navigator file directly.
   - A back button calls `back` from `useBack({ name: '<parent>' })` (`src/hooks/useBack.ts`), never `navigation.goBack()`. With no history (a link, a push tap, a web refresh) it lands on the parent instead of doing nothing, and it answers Android's hardware back too.
   - A jump into another tab passes `initial: false`, so that tab's first screen stays underneath.
5. Style only through the theme (see below), then run `npm run gates`.

## Styling pattern

```tsx
import { useStyles, type Theme } from '@theme/index';

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
- Onboarding: everything on a slide, including the primary button, wears that slide's colour.
- Platform-specific files (`X.web.tsx`) must never import `./X`; on web that path resolves to the file itself. Put shared code in a third module (see `sheetShared.ts`, `dateFieldShared.ts`).

## Session gates (BaseNavigator branch order)

The order matters. It lives in ONE pure function, `resolveGate()` in `src/navigators/sessionGate.ts`, which has its own unit test. BaseNavigator and AppContainer both call it:

1. not authenticated → Onboarding (first launch only) + Role Selection, Provider Selection, SignIn/SignUp, ProviderSignIn/ProviderSignUp, ForgotPassword → ResetPasswordOTP → ResetPassword
2. pending TOTP (staff sign in on the ordinary SignIn; the API answers `WRONG_PORTAL` there and `signInAndOpen` retries on the admin portal) → AdminTotp, or AdminTwoFactorEnrol on a first sign-in
3. email not verified → EmailVerification (a link; VerifySuccess handles the deep link)
4. customer whose profile is incomplete → CompleteProfile (3 steps)
5. provider with no business, or a `draft` one → PersonalInfo (3 steps, resumes at the unfinished one)
6. `pending_approval` → ProviderApprovalPending
7. `rejected` → Rejected (+ PersonalInfo to resubmit)
8. `suspended` → Suspended

A rider (Role Selection → Rider → RiderSignIn: the username their vendor issued, on the partner portal as `identifier`) skips 3–8: the vendor made the account, and its email is a never-mailed placeholder.

The splash plays on every launch as an overlay in AppContainer. It lifts only once both its animation and `bootstrapSession` are done.

Once the gate is cleared, `AppContainer.renderNavigator()` mounts the navigator for the role:
- `customer` → `CustomerNavigator`: a root stack (`CustomerStack`) with the three-card home (no bottom bar; its side menu opens Orders, Profile, Saved, Addresses…) and one app per service: Health (Home · Appointments · Records · Profile), Shopping (Home · Bag · Saved · Orders), Food Court (Home · Orders · Profile)
- approved `partner` → `Store`/`Doctor`/`KitchenPartnerNavigator`, chosen by `serviceType`. The store app is a stack over Today · Orders · Products · More. The doctor app is a stack over Today · Calendar · Patients · More; it opens on PracticeSetup until the doctor is listed (`doctorRootRoute(business)`). The Food vendor's app (`KitchenPartnerNavigator`, `navigations-maps/FoodVendor.ts`) is a stack over Orders · Menu · Riders · More (a home kitchen has Today first: portions, the weekly menu, pre-order slots); it opens on Kitchen setup until the kitchen is live (`foodVendorRootRoute(business)`, from the session's `business.food`).
- `rider` → `RiderNavigator`: a stack over Deliveries · Cash · Profile, with each delivery pushed over them (`RiderOrder`: one big button per step, cash at the door). Going on duty asks for location after a plain explanation; the rider's location is shared only on duty or on a delivery (`services/location/riderLocation`, sent by `riderTransport`: the socket, else the REST batch).
- `admin` / `super_admin` → `AdminNavigator` (Approvals · Shopping · Health · Food · Profile). A doctor is approved only after staff check the PMDC number (Health → Doctor verification); the server answers `422 PMDC_NOT_VERIFIED` otherwise. A home kitchen goes live only after staff record a passed food-safety check (Food → Vendors).
- Food Court reviews: one per order once it arrived (`FoodRateOrder`, from the order page); the vendor page shows the rating block and `FoodReviews`; the kitchen replies (`VendorReviews`) and reads `VendorInsights` (recorded sales). Staff hide reviews, feature and suspend vendors, change a vendor's plan, and run cuisines and the home's banners.

## API contract

Every network call is built from MetroMatrix-API `docs/API_AUTH.md` / `docs/API_SHOPPING.md` / `docs/API_HEALTH.md`, never from guesses.

- **Healthcare is on the real contract** (`health/sync-1`). Paths are `/health`, `/health/doctor` (appointments by **code**) and `/admin/health`; uploads go through `/media/sign-upload`.
  - `docs/API_HEALTH.md` is a copy of the backend's; the backend repository is the source of truth.
  - Serializers map the wire to the app's own words in `types/health.ts`: offset times become UTC, icon keys become glyphs, `booked`/`in_consultation` become `confirmed`/`in_progress`, `unpaid` becomes `pay_at_visit`. Every map lives in `serializers/health/healthCommon.ts`.
  - Networks map the app's input to the real bodies. When one screen needs several routes, `requestAll` (`networks/shopping/http.ts`) calls them together.
  - Values the API doesn't send yet are derived and marked `TODO(API_HEALTH)`.
  - When the backend's document changes: copy it, update the networks, serializers, models and the dummy API, refresh the fixture (`scripts/capture-health-fixtures.js`), and run the gates. The parity test fails on any key the two disagree on (`docs/MOCK_HEALTH.md`).
- **Auth, Shopping and Food still run on assumed documents**: `docs/API_CONTRACT_ASSUMED.md` and `docs/API_SHOPPING_ASSUMED.md`. They follow NestJS conventions: `{ success, data }`, `VALIDATION_FAILED`, `page/pageSize`, integer rupees, `Idempotency-Key` on checkout and booking. The dummy API implements them. Every dependency is marked `TODO(API_AUTH)`, `TODO(API_FOOD)` or `TODO(API_SHOPPING)` (`grep -rn "TODO(API_" src`).

When a real document arrives, reconcile it in one pass:
- update the networks, serializers and models (and the dummy API);
- leave screens and slices alone.

## Testing on Expo / web

- **Expo Go** (`npm start`): runs the whole app except native Google sign-in and push, against the dummy API. Seeded accounts and codes are in `docs/API_CONTRACT_ASSUMED.md` → "Mock mode" (doctors and patients in `docs/MOCK_HEALTH.md`). Video consultations open public meet.jit.si rooms in a WebView; on web they open in a new tab.
- **Web** (`npm run web`):
  - Google sign-in uses Google Identity Services and needs `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID`.
  - Deep paths work, e.g. `/get-started`, `/sign-in`, `/provider/sign-in`, `/home/food`, `/shop`, `/shop/store/lawn-and-loom-7a1f3`, `/shop/product/p_l1`, `/orders/MM-24A7Q2`, `/store/orders/:id`, `/admin/shop`, `/health`, `/health/appointments`, `/health/doctor/:id`, `/health/appointment/:code`, `/shop/orders`, `/shop/bag`, `/profile/records`, `/doctor/appointments/:code`, `/admin/health`, `/vendor/orders`, `/vendor/menu`, `/vendor/menu/dish/:id`, `/vendor/today`, `/vendor/setup`, `/vendor/riders/:id`, `/rider/sign-in`, `/rider/deliveries`, `/food/vendor/:slug`, `/food/bag`, `/food/checkout`, `/food/order/:code`, `/food/saved`, `/vendor/deals`, `/vendor/orders/:id`, `/rider/deliveries/:id`, `/rider/cash`, `/food/order/:code/rate`, `/food/reviews/:id`, `/vendor/reviews`, `/vendor/insights`, `/admin/food` (+ `/vendors/:id`, `/orders/:id`, `/reviews`, `/cuisines`, `/banners`). The staff Profile tab is `/account`.
  - After adding new folders or `.web.tsx` files, restart Metro with `--clear` (its watcher can miss them). Don't start it with `CI=1`: that turns watch mode off and the browser keeps the old bundle.
  - Bottom sheets render as a `Modal` (`Sheet.web.tsx`), because `@gorhom/bottom-sheet` never presents in a browser.
  - `/dev/gallery` exists only in development builds.
