# MetroMatrix

MetroMatrix is a zero-commission community marketplace covering Shopping, Healthcare and Food.

This repository is the React Native (Expo SDK 54) app. It has three faces:
- **Customer app:** one app for all three services.
- **Partner apps:** a store, doctor or kitchen app, chosen by the partner's service.
- **Admin console:** where staff approve partners.

Architecture and rules are in [CLAUDE.md](CLAUDE.md).

## Run it

```bash
npm install
npm start                         # Expo Go: scan the QR code
npm run web                       # browser
npm run gates                     # tsc + design-token gate + eslint + jest
```

No backend is needed: until one is configured, every request is answered by the **dummy API** inside the network layer (`src/networks/network/mock/`), with the same endpoints, responses and errors the real API will have.

## Connecting the real backend (one line)

Open [src/config/env.ts](src/config/env.ts) and set `BACKEND_URL`:

```ts
const BACKEND_URL = 'https://your-api.example.com/api/v1';
```

Or set `EXPO_PUBLIC_API_URL` in `.env.local`. That is the whole switch. The networks, serializers, slices and screens don't change.

## Trying it on the dummy API

| Try | How |
|---|---|
| New user | Role Selection → User → Sign Up → wait ~5 s → "I Verified My Email" → Complete Profile → home |
| New provider | Role Selection → Service Provider → pick a service → Sign Up → verify → Personal Info (3 steps) → submit; approval arrives ~30 s later |
| Existing accounts | `customer@` / `doctor@` / `kitchen@` / `vendor@metromatrix.app`, password `Metro2026` |
| Staff | `admin@metromatrix.app` / `Admin2026` on the ordinary Sign In, then code `123456` |
| Password reset | Forgot Password → code `123456` |

The full rules and seeded accounts are in [docs/API_CONTRACT_ASSUMED.md → Mock mode](docs/API_CONTRACT_ASSUMED.md#mock-mode).

## Status

- **Look and flow:** the MetroMatrix FYP app's. That means a white, light-only UI in the platform system font, the FYP icon and splash, onboarding, Role Selection → Provider Selection, and the full user and provider authentication flows. There is no Facebook login.
- **Customer home:** the FYP's three service cards. The **Food Court** is live. It's MetroMatrix's food-vendor platform: zero commission, with vendors delivering through their own riders on MetroMatrix's delivery app. It appears as a Foodpanda-style page led by local fast-food brands. Health and Shopping show what is coming.
- **Partner apps:** store, doctor and kitchen landing screens. Their tools arrive in the next chunk.
- **Admin console:** the approval queue and business review.
- **The API contract is assumed.** See [docs/API_CONTRACT_ASSUMED.md](docs/API_CONTRACT_ASSUMED.md). Every dependency on it is marked `TODO(API_AUTH)` or `TODO(API_FOOD)`.
- **Before release:**
  - confirm the support email
  - set the iOS Google URL scheme (`app.json`)
  - Google sign-in setup: [docs/GOOGLE_SIGNIN.md](docs/GOOGLE_SIGNIN.md)
- **Photos:** service-card sources and licences are in [assets/images/services/CREDITS.md](assets/images/services/CREDITS.md).
