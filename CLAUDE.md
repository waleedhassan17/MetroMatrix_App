# CLAUDE.md

Guidance for Claude Code (and humans) working in this repository.

MetroMatrix is a zero-commission community marketplace with three services: **Shopping**, **Healthcare** and **Food**. This app serves:
- customers, who use one app across all three services
- partners (store, doctor, kitchen), who get the partner app for their service
- admins, who approve partners

The app follows the **FinMatrix app architecture exactly**. The old MetroMatrix FYP app is a UX reference only. Never copy its code paths, Firebase setup, or per-role duplicate network files.

## Commands

```bash
npm run android        # expo run:android — dev client build on device/emulator (not Expo Go)
npm run web            # Expo web
npm start              # Metro only
npm run type-check     # tsc --noEmit
npm run check:tokens   # design-token gate (must pass)
npm test               # jest
npm run gates          # tsc + check:tokens + jest — run before every commit
```

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
    preferencesSlice.ts      themeMode, lastService (device-scoped, persisted)
  hooks/                     useAppDispatch / useAppSelector, useSignOut, …
  networks/
    network/apiHelpers.ts    the axios client, refresh queue, AuthError, unwrap
    <domain>/<x>Network.ts   one function per endpoint
  serializers/               defensive backend → app mapping, one file per domain
  models/                    validation + form schemas, one file per domain
  types/                     shared types (navigation param lists, auth/business types)
  utils/                     storageUtils, authEvents, phone, alert (web-safe), haptics
  theme/                     tokens, services, typography, ThemeProvider/useTheme — the ONLY place raw values live
  Custom-Components/         the design-system components (tokens only)
  components/app-container/  AppContainer + appContainerSlice (bootstrapSession)
  navigations-maps/          Base.ts (ROUTES), Auth.ts (gate route arrays), <Nav>.ts, types.ts (IRoute)
  navigators/                BaseNavigator + per-role navigators (dumb mappers)
  screens/<Area>/<Name>/     NameScreen.tsx + nameSlice.ts
scripts/check-design-tokens.js
docs/                        integration notes (Google sign-in, …)
```

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
- Auth and admin use `neutral`.

## Session gates (BaseNavigator branch order)

The order matters; each branch is commented in `BaseNavigator.tsx`:

1. not authenticated → onboarding (if not yet seen) + unauthenticated
2. pending TOTP → admin TOTP
3. email not verified → verify
4. partner with no business, or a `draft` one → partner setup
5. `pending_approval` → pending
6. `rejected` → rejected
7. `suspended` → suspended

Once the gate is cleared, `AppContainer.renderNavigator()` mounts the navigator for the role:
- `customer` → `CustomerNavigator`
- approved `partner` → `Store`/`Doctor`/`KitchenPartnerNavigator`, chosen by `serviceType`
- `admin` / `super_admin` → `AdminNavigator`

## API contract

Every network call is built from MetroMatrix-API `docs/API_AUTH.md`, never from guesses. Values not yet confirmed against that document are marked `TODO(API_AUTH)`.
