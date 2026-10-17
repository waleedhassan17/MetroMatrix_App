# MetroMatrix API — Healthcare contract (retired)

The app no longer runs on an assumed Healthcare contract. MetroMatrix-API published the real one, and the app was reconciled with it in `health/sync-1`. Two documents replace this one:

- **The contract:** `docs/API_HEALTH.md`, a copy of MetroMatrix-API `docs/API_HEALTH.md` (the backend repository is the source of truth). Health lives under `/health`, `/health/doctor` and `/admin/health`.
- **Mock mode** (seeded accounts, demo behaviours, how the dummy API is checked against the real one): `docs/MOCK_HEALTH.md`.

The assumed version is in git history (`git show e3767c5:docs/API_HEALTH_ASSUMED.md`).
