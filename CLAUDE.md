# CLAUDE.md

Guidance for Claude Code (and humans) working in this repository.

MetroMatrix is a zero-commission community marketplace with three services: **Shopping**, **Healthcare** and **Food**. This app serves:
- customers, who use one app across all three services
- partners (store, doctor, kitchen), who get the partner app for their service
- admins, who approve partners

The app follows the **FinMatrix app architecture exactly**. Its **look and flows follow the owner's MetroMatrix FYP app** (`~/MetroMatrix/Waleed-MetroMatrix`):
- white, light-only screens in the platform system font, with the FYP icon, splash and onboarding;
- Role Selection → (Provider Selection) → sign in / sign up → email link → profile steps;
- the FYP's three-card user home. Food is branded **Food Court**: a platform for food vendors. Unlike Foodpanda, MetroMatrix takes **no commission** and runs **no rider fleet**. Vendors deliver with their own riders through MetroMatrix's delivery app. Delivery details (time, fee, area) are fine to show; never imply MetroMatrix's own couriers or a cut of the order.

Copy the FYP's UX, never its code paths, Firebase setup or per-role duplicate network files. There is no Facebook login.

## Backend switch (one file)

`src/config/env.ts` → `BACKEND_URL` (or `EXPO_PUBLIC_API_URL`). While it is empty, `api` uses the dummy API (`src/networks/network/mock/`: `mockServer.ts` routes, `mockDb.ts` seeded accounts, `mockConfig.ts` rules, `mockFood.ts` catalogue). The dummy API answers exactly what `docs/API_CONTRACT_ASSUMED.md` specifies, so nothing else changes when the real URL is set. When you add an endpoint, add its mock route in the same change.

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
   - gradients as surfaces
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
    preferencesSlice.ts      lastService, pushPromptSeen (device-scoped, persisted)
  hooks/                     useAppDispatch / useAppSelector, useSignOut, …
  networks/
    network/apiHelpers.ts    the axios client, refresh queue, AuthError, unwrap
    network/mock/            the dummy API (axios adapter + AsyncStorage DB) used while no backend URL is set
    <domain>/<x>Network.ts   one function per endpoint (auth, users, media, businesses, admin, food)
  serializers/               defensive backend → app mapping, one file per domain
  models/                    validation + form schemas, one file per domain
  types/                     shared types (navigation param lists, auth/business types)
  utils/                     storageUtils, authEvents, phone, alert (web-safe), haptics, pickers, formErrors
  services/                  device/SDK adapters: googleAuth(.web), push, location
  theme/                     tokens, services, typography, ThemeProvider/useTheme — the ONLY place raw values live
  Custom-Components/         the design-system components (tokens only); barrel: @custom/index
  components/app-container/  AppContainer, appContainerSlice (bootstrap/refresh/push), OfflineGate, PushPrePrompt
  components/auth/           AuthChrome (frame/header/tabs/badge), AuthFields, ChoiceCard, StepFlow, AuthErrorNotice, GoogleSignInButton(.web)
  components/brand/          BrandMark, BrandWordmark (splash, onboarding)
  components/home/           ServiceCard + serviceCatalog (the customer home's three cards)
  components/food/           FoodParts (search, promos, cuisines, kitchen cards)
  components/shared/         ErrorBoundary
  navigations-maps/          Base.ts (ROUTES), Auth.ts (gate arrays), Customer/Home/Partner/Admin/Approvals/Account.ts, types.ts
  navigators/                sessionGate.ts (the ladder), BaseNavigator, Customer/Store/Doctor/Kitchen/AdminNavigator,
                             RouteTabs (tab mapper), stacks/ (HomeStack, AccountStack, AdminStack)
  screens/<Area>/<Name>/     NameScreen.tsx + nameSlice.ts
                             Areas: Onboarding (+ Splash), RoleSelection, ProviderSelection, Auth, Partner,
                             Admin, Customer, Account, Dev
scripts/check-design-tokens.js
docs/                        API_CONTRACT_ASSUMED.md, GOOGLE_SIGNIN.md
assets/images/               FYP icon + splash mark; services/ (card photos — sources in CREDITS.md)
```

Stateless screens have no slice. Their state is global (`auth`, `preferences`) or they only navigate. These are Rejected, Suspended, CustomerHome, ServicePreview, Orders and PartnerHome.

## How to add a screen

1. Create `src/screens/<Area>/<Name>/<Name>Screen.tsx` and `<name>Slice.ts`.
   - Build the slice with `createAppSlice`, with state, reducers, thunks and `selectors` in one place.
   - A thunk calls a network function and returns serialized data. On failure it returns `rejectWithValue(toRejectedValue(e))`.
   - Form validation calls `src/models/<domain>Model.ts`.
2. Register the slice in `src/store/store.ts` under "Per-screen slices" (`<name>: <name>Slice.reducer`).
3. Add the route name to `ROUTES` in `src/navigations-maps/Base.ts` and its params to `RootStackParamList` (`src/types/navigation.ts`), or to the relevant navigator's param list.
4. Add an `IRoute` entry to the right array in `src/navigations-maps/*.ts`. Never register a screen inside a navigator file directly.
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
- Auth, admin and the customer shell (home, tabs, profile) use `neutral` (MetroMatrix emerald). Each service screen scopes its own accent: Food pink (Foodpanda-like), Healthcare blue, Shopping orange.
- Onboarding: everything on a slide, including the primary button, wears that slide's colour.
- Platform-specific files (`X.web.tsx`) must never import `./X`; on web that path resolves to the file itself. Put shared code in a third module (see `sheetShared.ts`, `dateFieldShared.ts`).

## Session gates (BaseNavigator branch order)

The order matters. It lives in ONE pure function, `resolveGate()` in `src/navigators/sessionGate.ts`, which has its own unit test. BaseNavigator and AppContainer both call it:

1. not authenticated → Onboarding (first launch only) + Role Selection, Provider Selection, SignIn/SignUp, ProviderSignIn/ProviderSignUp, ForgotPassword → ResetPasswordOTP → ResetPassword
2. pending TOTP (staff sign in on the ordinary SignIn) → AdminTotp, or AdminTwoFactorEnrol on a first sign-in
3. email not verified → EmailVerification (a link; VerifySuccess handles the deep link)
4. customer whose profile is incomplete → CompleteProfile (3 steps)
5. provider with no business, or a `draft` one → PersonalInfo (3 steps, resumes at the unfinished one)
6. `pending_approval` → ProviderApprovalPending
7. `rejected` → Rejected (+ PersonalInfo to resubmit)
8. `suspended` → Suspended

The splash plays on every launch as an overlay in AppContainer. It lifts only once both its animation and `bootstrapSession` are done.

Once the gate is cleared, `AppContainer.renderNavigator()` mounts the navigator for the role:
- `customer` → `CustomerNavigator`
- approved `partner` → `Store`/`Doctor`/`KitchenPartnerNavigator`, chosen by `serviceType`
- `admin` / `super_admin` → `AdminNavigator`

## API contract

Every network call is built from MetroMatrix-API `docs/API_AUTH.md`, never from guesses. That document was unavailable, so the app runs on `docs/API_CONTRACT_ASSUMED.md`, which the dummy API implements. Every dependency on it is marked `TODO(API_AUTH)` or `TODO(API_FOOD)` (`grep -rn "TODO(API_" src`).

When the real document arrives, reconcile it in one pass:
- update the networks, serializers and models;
- leave screens and slices alone.

## Testing on Expo / web

- **Expo Go** (`npm start`): runs the whole app except native Google sign-in and push, against the dummy API. Seeded accounts and codes are in `docs/API_CONTRACT_ASSUMED.md` → "Mock mode".
- **Web** (`npm run web`):
  - Google sign-in uses Google Identity Services and needs `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID`.
  - Deep paths work, e.g. `/get-started`, `/sign-in`, `/provider/sign-in`, `/home/food`.
  - Bottom sheets render as a `Modal` (`Sheet.web.tsx`), because `@gorhom/bottom-sheet` never presents in a browser.
  - `/dev/gallery` exists only in development builds.
