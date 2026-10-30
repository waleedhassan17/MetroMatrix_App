# The dummy Healthcare API

The app talks to the real API. In tests, Health requests are answered by the dummy API in `src/networks/network/mock/health/` (installed with `installDummyApi()`, `mock/testing.ts`). It speaks the **real** contract, MetroMatrix-API `docs/API_HEALTH.md` (copied in `docs/API_HEALTH.md`):

- the same paths (`/health`, `/health/doctor`, `/admin/health`);
- the same request bodies and `Idempotency-Key` rules;
- the same status codes and error codes, with the same `details`;
- the same response shapes, down to times with a `+05:00` offset and the server's `can.*` flags.

So the app's networks and serializers run the same code against the dummy API and the backend, and pointing the app at a server changes nothing else.

## Files

| File | What it holds |
|---|---|
| `healthTypes.ts` | The dummy database's rows. They keep the app's own words (`confirmed`, `pay_at_visit`, Monday-first days), so the rules read naturally. |
| `healthSeed.ts` | The demo catalogue, doctors, patients and appointments (below). |
| `healthLogic.ts` | The server rules: slots from weekly hours, notice, window and time off; cancel cutoffs; the join window; the 24-hour prescription lock; the symptom checker's red flags; what each side may do. |
| `healthWire.ts` | Rows → the API's shapes: the status and payment names, timeline events, icon keys, offset times and `can.*`. |
| `healthRoutes.ts` | One route per endpoint the app calls, with the real validation and errors. Writes are all-or-nothing: a request that fails leaves the database as it was. |

`mockConfig.ts` names the browser storage key (`metromatrix.mock-db.v2`). Data stored under an older key is ignored, so the seed is rebuilt on the next launch.

## How it stays honest

Three Jest suites guard the match. `npm run gates` runs them all.

| Test | What it checks |
|---|---|
| `src/serializers/__tests__/healthRealResponses.test.ts` | Real responses from the backend go through the app's serializers. |
| `src/networks/network/mock/__tests__/mockHealthParity.test.ts` | The dummy API answers each captured request with the same keys as the real one, at the top level and in the nested objects the app reads. A difference fails unless it is listed with its reason. An empty list or a `null` in the seed counts as data, not shape, so it is skipped. |
| `src/networks/network/mock/__tests__/mockHealthFlows.test.ts` | The rules QA relies on, run through the real networks: booking, the slot race, reschedule, cancel, prepaid video, the doctor's queue, the prescription lock, reviews, overlaps, time off and the PMDC gate. |

The real responses are `src/serializers/__tests__/fixtures/health/real.json`. They were captured from a local backend on the demo seed, then scrubbed and shortened. To refresh them after the backend changes:

```bash
# in the backend: docker compose up -d --wait && npm run seed:health && npm run start:dev
BACKEND=~/MetroMatix-NestJS node scripts/capture-health-fixtures.js src/serializers/__tests__/fixtures/health/real.json
npm run gates
```

The script signs in with the demo accounts from the backend's git-ignored Postman environment. It books, moves, completes and cancels a few demo appointments in that local database. Before writing, it removes tokens, signatures, the cloud name, IBANs and emails.

## Where it differs from the real backend

- **Stats update immediately.** Ratings, satisfaction and waits are worked out on every read. The real nightly job can lag a day.
- **Jobs don't run on a timer.** No reminder pushes are sent. An unpaid transfer past its deadline is cancelled when the dummy API next handles a request, not every 5 minutes. Notifications appear in the in-app list with the real `health.*` types, and tapping one routes as a push would.
- **The demo video consultation never runs out.** `customer@` always has a video consultation with Dr. Bilal Ahmed that starts within 15 minutes, so two-device video can be tested at any time. Sign in as `customer@` on one phone and `doctor@` on the other. The room is a public `meet.jit.si` room, and the first person in may be asked to sign in to start it.
- **One slot is always "taken" first.** At Dr. Bilal Ahmed's Gulberg Heart Clinic, the first booking of a day's earliest free time fails: another patient takes it a moment before you confirm (once per day). Use it to see the "Someone booked this time" message and its three alternatives.
- **Images stay on the device.** Uploads keep their local URI, so files uploaded on web disappear on reload. Private files (records, consultation notes) have no expiring link.
- **IDs are readable** (`d_ayesha`, `loc_bilal_2`, `rx_acne`) rather than UUIDs, and staff doctor rows use the business's id.
- **Not served**, because the app doesn't call them yet:
  - staff banner editing (`/admin/health/banners`);
  - staff appointment search and cancel;
  - doctor unlist and clear-unlist;
  - PMDC unverify.

  The backend has all of them, and its Postman collection covers them.

## Seeded accounts

Password `Metro2026` for every account below except staff:

| Account | Who | What it shows |
|---|---|---|
| `customer@metromatrix.app` | Ayesha Khan, patient | <ul><li>**Family:** Hassan (spouse) and Zara (child).</li><li>**Records:** includes a PDF and a 2-page card.</li><li>**Upcoming:** a clinic visit with Dr. Bilal tomorrow, and Zara's prepaid video with Dr. Ayesha (proof sent).</li><li>**Past:** an acne visit with a prescription, still to be rated; a rated GP visit; a cancelled visit; a missed one.</li></ul> |
| `doctor@metromatrix.app` | Dr. Bilal Ahmed, cardiologist | 3 clinics plus video, today's queue, the demo video consultation |
| `derm@metromatrix.app` | Dr. Ayesha Siddiqui, dermatologist | Prepaid video plus a clinic; today's queue (one patient checked in, the next ones booked); a payment to confirm |
| `newdoctor@metromatrix.app` | Dr. Hamza Rauf | Approved but not listed: opens on Practice setup |
| `pmdc@metromatrix.app` | Dr. Sana Iqbal | Waiting for approval with the PMDC number unchecked (admin → Health → Doctor verification) |
| `admin@metromatrix.app` | Staff | The Health tab. Password `Admin2026`, code `123456` |

**Catalogue:** 16 specialties and 40 conditions (18 common, each with its own icon key), and 23 fictional doctors in Lahore, Karachi and Islamabad.

**Portraits:** each demo doctor wears a licensed stock portrait from Unsplash (listed in `docs/MOCK_IMAGES.md`), and each profile's `about` ends with "(Demo profile: this doctor is fictional.)". A real doctor's own photo replaces the portrait.

**Banners:** the home has five, for video consultation, skin specialists, the symptom checker, paediatricians (Lahore only) and family records.

The real backend's demo seed (`npm run seed:health`) is larger: 30 doctors and `demo.*@metromatrix.test` accounts. See its `docs/API_HEALTH.md` §9.
