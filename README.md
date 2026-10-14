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
cp .env.example .env.local        # set EXPO_PUBLIC_API_URL (and the Google web client ID)
npm start                         # Expo Go: scan the QR code
npm run web                       # browser
npm run android                   # dev build (needed for Google sign-in and push)
npm run gates                     # tsc + design-token gate + eslint + jest
```

## Status (Chunk 1)

- Foundation, the Quiet Metro design system (`/dev/gallery` in development), and all customer, partner and admin authentication and onboarding flows.
- **The API contract is assumed.** MetroMatrix-API `docs/API_AUTH.md` wasn't available, so every endpoint follows [docs/API_CONTRACT_ASSUMED.md](docs/API_CONTRACT_ASSUMED.md) and is marked `TODO(API_AUTH)`. Flows that call the server work only against an API that matches it.
- **Placeholders to replace before release:**
  - app icon and splash (`assets/images/`)
  - onboarding photos (`assets/onboarding/`)
  - the Heroku URL (`src/config/env.ts`)
  - the support email
  - the iOS Google URL scheme (`app.json`)
- **Google sign-in setup:** [docs/GOOGLE_SIGNIN.md](docs/GOOGLE_SIGNIN.md).
