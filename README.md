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

## Trying it against a local API

As in FinMatrix, the app always talks to the real MetroMatrix API: there is no dummy fallback in any build.

1. Run the backend (MetroMatrix API repo): `docker compose up -d --wait`, `npm run migration:run`, `npm run seed:superadmin`, then optionally `seed:shopping`, `seed:health`, `seed:food`, `seed:kitchen` (their accounts share `SEED_DEMO_PASSWORD`), then `npm run start:dev`. Its `CORS_ORIGINS` must list the web origin (`http://localhost:8081`).
2. In `.env.local` here: `EXPO_PUBLIC_API_URL=http://localhost:3000/api/v1` for web, or `http://<your LAN IP>:3000/api/v1` for a phone. Then `npm run start:clear`.
3. Emails (the verification link, reset codes) land in Mailpit at http://localhost:8025. Staff sign in on the ordinary Sign In with the super admin from `seed:superadmin`, then set up an authenticator app.

The auth requests are checked against the API's OpenAPI document (`docs/openapi.json`, `networks/__tests__/contract.test.ts`). With a running API, `__live__/live.test.ts` walks the auth flows against it.

The dummy API in `networks/network/mock/` is test fixtures only: the Shopping, Health, Food and Kitchen routes the parity and flow tests run the networks against (`mock/testing.ts`).

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
