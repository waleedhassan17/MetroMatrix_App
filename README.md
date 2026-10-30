# MetroMatrix

MetroMatrix is a zero-commission community marketplace covering Shopping, Healthcare and Food.

This repository is the React Native (Expo SDK 54) app. It has three faces:
- **Customer app:** one app for all three services.
- **Partner apps:** a store, doctor or kitchen app, chosen by the partner's service.
- **Admin console:** where staff approve partners and look after the shop.

Architecture and rules are in [CLAUDE.md](CLAUDE.md).

## Run it

```bash
npm install
npm start                         # Expo Go: scan the QR code
npm run web                       # browser
npm run gates                     # tsc + design-token gate + eslint + jest
```

## Connecting the backend

Copy [.env.example](.env.example) to `.env.local` and set `EXPO_PUBLIC_API_URL` (including `/api/v1`), then `npm run start:clear`. Release builds take the URL from their profile in [eas.json](eas.json) (`development`, `preview`, `production`; replace the placeholder hosts before building).

A build with no URL doesn't fall back to anything. It shows a configuration-error screen and sends no requests.

## Trying it on the dummy API

For a development build only, `EXPO_PUBLIC_USE_MOCK_API=1` in `.env.local` answers every request from the **dummy API** in the network layer (`src/networks/network/mock/`) instead of a backend. Release builds ignore the flag and don't contain the dummy API.

| Try | How |
|---|---|
| New user | Role Selection → User → Sign Up → wait ~5 s → "I Verified My Email" → Complete Profile → home |
| New provider | Role Selection → Service Provider → pick a service → Sign Up → verify → Personal Info (3 steps) → submit; approval arrives ~30 s later |
| Existing accounts | `customer@` / `doctor@` / `kitchen@` / `vendor@metromatrix.app`, password `Metro2026` |
| Shopping | `customer@metromatrix.app`: Home → Smart Shopping. Stores: `store@` (Lawn & Loom, the busiest), `urban@`, `volt@metromatrix.app` (sign in as Service Provider → Vendor Registration). Second shopper: `hamza@metromatrix.app`. All `Metro2026` |
| Staff | `admin@metromatrix.app` / `Admin2026` on the ordinary Sign In, then code `123456` |
| Password reset | Forgot Password → code `123456` |

The full rules and seeded accounts are in [docs/API_CONTRACT_ASSUMED.md → Mock mode](docs/API_CONTRACT_ASSUMED.md#mock-mode) and, for Shopping, [docs/API_SHOPPING_ASSUMED.md → Mock mode](docs/API_SHOPPING_ASSUMED.md#mock-mode).

## Status

- **Look and flow:** the MetroMatrix FYP app's. That means a white, light-only UI in the platform system font, the FYP icon and splash, onboarding, Role Selection → Provider Selection, and the full user and provider authentication flows. There is no Facebook login.
- **Customer home:** the FYP's three service cards. The **Food Court** is live. It's MetroMatrix's food-vendor platform: zero commission, with vendors delivering through their own riders on MetroMatrix's delivery app. It appears as a Foodpanda-style page led by local fast-food brands. **Smart Shopping** is live (Chunk 2). Health shows what is coming.
- **Shopping (Chunk 2):**
  - customers browse stores in their own colours, search, filter, save, fill one Bag from several stores and check out once (cash on delivery or a transfer straight to the store)
  - they follow each store's part of the order, pay, return and review
  - Orders, Saved, Addresses and Notifications are in the tabs and side menu
- **Store app:** Today, orders (payment check, ship with tracking), products with sizes and colours, inventory, collections, coupons, returns, reviews, insights, store profile, settings and payment accounts. MetroMatrix never holds a store's money: "Recorded sales" are records only.
- **Partner apps:** doctor and kitchen landing screens; their tools arrive with Health and Food.
- **Admin console:** the approval queue and business review, plus a Shopping tab (reports, categories, banners, featured stores, order lookup).
- **The API contracts are assumed.** See [docs/API_CONTRACT_ASSUMED.md](docs/API_CONTRACT_ASSUMED.md) and [docs/API_SHOPPING_ASSUMED.md](docs/API_SHOPPING_ASSUMED.md). Every dependency is marked `TODO(API_AUTH)`, `TODO(API_FOOD)` or `TODO(API_SHOPPING)`.
- **Before release:**
  - confirm the support email
  - set the iOS Google URL scheme (`app.json`)
  - Google sign-in setup: [docs/GOOGLE_SIGNIN.md](docs/GOOGLE_SIGNIN.md)
- **Photos:** service-card sources and licences are in [assets/images/services/CREDITS.md](assets/images/services/CREDITS.md); the dummy catalogue's in [docs/MOCK_IMAGES.md](docs/MOCK_IMAGES.md).
# MetroMatrix_App
