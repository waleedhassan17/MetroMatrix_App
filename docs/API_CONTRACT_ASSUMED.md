# Assumed API contract (Chunk 1)

This was first written from the Chunk 1 brief, before the API existed. The auth, users, media, business and admin-business sections have since been checked against MetroMatrix_Backend (`docs/API_AUTH.md` and the controllers and DTOs) and corrected, and the `TODO(API_AUTH)` markers removed (Oct 2026). Shopping, healthcare and food still carry their own `TODO(API_SHOPPING)` / `TODO(API_HEALTH)` / `TODO(API_FOOD)` markers.

If the API changes, fix the network, serializer or model named in the **Where** column; screens and slices should not need to change.

Base URL: `API_BASE_URL` (`src/config/env.ts`), e.g. `https://<heroku-app>.herokuapp.com/api/v1`.

**Superseded for auth:** the auth, users, media, business and approval calls are connected to the real API: their contract is `docs/AUTH_CONTRACT.md` and `docs/openapi.json` (checked by `src/networks/__tests__/contract.test.ts`). The tables below are kept as history.

## Conventions

| Item | Assumed | Where |
|---|---|---|
| Success envelope | `{ "data": <payload> }` (a bare payload is also accepted) | `apiHelpers.unwrap` |
| Error envelope | `{ "error": { "code": "SOME_CODE", "message": "Readable text", "details": { … } } }`. NestJS `{ message }` / `{ message: [] }` is also read. | `apiHelpers.extractErrorMessage/Code`, `toAuthError` |
| Auth header | `Authorization: Bearer <accessToken>` | `apiHelpers` request interceptor |
| Token pair | `{ "accessToken": "…", "refreshToken": "…" }`, either at the top level or under `tokens` | `apiHelpers.refreshTokens`, `authSerializer.tokensSerializer` |
| Dates | ISO-8601 strings | serializers |
| Ids | strings | serializers |

## Types

| Type | Shape | Where |
|---|---|---|
| `UserRole` | `customer \| partner \| rider \| admin \| super_admin` | `src/types/auth.ts` |
| `Portal` | `customer \| partner \| admin` | ″ |
| `ServiceType` | `shopping \| healthcare \| food` | ″ |
| `SubType` | `store` (shopping) · `doctor` (healthcare) · `restaurant \| home_kitchen \| cloud_kitchen` (food) | ″ |
| `BusinessStatus` | `draft \| pending_approval \| approved \| rejected \| suspended` | ″ |
| `DocumentKind` | `cnic_front \| cnic_back \| pmdc_certificate \| degree_certificate \| ntn_certificate \| shop_photo \| pfa_licence \| storefront_photo \| kitchen_photo` (the API's `DOCUMENT_KINDS`) | ″ |
| `User` | `{ id, email, name, phone \| null, role, avatarUrl \| null, isEmailVerified, hasPassword, providers: ('password' \| 'google')[], createdAt, profileComplete, dateOfBirth \| null, gender: 'male' \| 'female' \| 'other' \| null, streetAddress \| null, city \| null, postalCode \| null, providerServiceType \| null, providerSubType \| null }` | `authSerializer.userSerializer` |
| `BusinessDocument` | API `DocumentView { id, kind, url, publicId, status, reviewNote, createdAt }` → app `{ …, mimeType (from the URL), reviewerNote, uploadedAt }` | `businessSerializer` |
| `Business` | API `BusinessDetail { id, name, slug, serviceType, subType, phone, city, addressLine, lat, lng, pmdcNumber, status, …, documents[], requiredDocuments: RequirementStatus[], missingDocuments: string[] }` → app `{ …, address, location: { lat, lng } \| null, pmdcNumber }`. `RequirementStatus = { kind? \| anyOf?, min, have, satisfied }`; a missing key is the kind, or `a\|b` for an any-of | `businessSerializer` |
| `AuthResult` | `{ user, business \| null, tokens }` | `authSerializer.authResultSerializer` |
| `TotpChallenge` | `{ totpRequired: true, enrolmentRequired: boolean, challengeToken }` (the real API's shape; the older `totpEnrolled` is still read) | `authSerializer.totpChallengeSerializer` |

## Auth (`/auth`)

| Function | Method + path | Body | 2xx `data` | Notable errors |
|---|---|---|---|---|
| `authSignup` | `POST /auth/signup` | `{ email, password, displayName, phone?, role: 'customer'\|'partner' }` (the API's `SignupDto`; a blank phone is left out) | `AuthResult` (user unverified; a verification LINK is emailed). The provider's picked type is not sent: `providerSelection.pending` keeps it (persisted) for `POST /businesses`. | `EMAIL_TAKEN` 409, validation 400 |
| `authSignin` | `POST /auth/signin` | `{ email, password, portal }` | customer/partner: `AuthResult`. **Staff accounts on the customer portal** (they sign in from the User sign-in, as in the FYP app): `TotpChallenge`, no tokens. | `INVALID_CREDENTIALS` 401, `WRONG_PORTAL` 403 `details: { portal }` |
| `authAdminTotp` | `POST /auth/admin/totp` | `{ challengeToken, code }` or `{ challengeToken, recoveryCode }` | `AuthResult` | `TOTP_INVALID` 401, `RECOVERY_CODE_USED` 401, `CHALLENGE_EXPIRED` 401 |
| `adminTotpEnrol` | `POST /auth/admin/totp/enrol` | `{ challengeToken }` | `{ secret, otpauthUrl }` | `CHALLENGE_EXPIRED` |
| `adminTotpConfirm` | `POST /auth/admin/totp/confirm` | `{ challengeToken, code }` | `AuthResult & { recoveryCodes: string[] }` | `TOTP_INVALID` |
| `authGoogle` | `POST /auth/google` | `{ idToken, portal: 'customer' }` | `AuthResult` (email verified) | `GOOGLE_TOKEN_INVALID` 401, `WRONG_PORTAL` |
| (verification check) | `GET /auth/me` (bearer) | — | `{ user, business }`; the verify screen polls it (5 s, backing off to 30 s on errors, and on returning to the foreground) until `user.isEmailVerified` | — |
| `authVerifyEmail` | `POST /auth/verify-email` (**public**) | `{ token }` (from the app link `metromatrix://verify-email?token=…`) | `{ user, business }` of the token's owner. A spent link for a verified owner succeeds. | `VERIFY_LINK_INVALID` 400 |
| `authResendVerification` | `POST /auth/resend-verification` (bearer) | — | `{ sent, alreadyVerified, retryAfter }` | `RESEND_COOLDOWN` 429 `details: { retryAfter }` |
| `authRefresh` | `POST /auth/refresh-token` | `{ refreshToken }` | `{ accessToken, refreshToken, expiresIn }` (rotated) | 401 → session over |
| `authLogout` | `POST /auth/logout` (bearer, may be expired) | — (no body: the API revokes the bearer's whole session, refresh family included) | `{ signedOut: true }` | ignored |
| `authMe` | `GET /auth/me` (bearer) | — | `{ user, business \| null }` | 401 |
| `authForgotPassword` | `POST /auth/forgot-password` | `{ email }` | `{ delivered: true }` (always 200, so the endpoint can't be used to check whether an email exists). No cooldown: the app waits 60 s before offering Resend, which calls this again. | `RATE_LIMITED` 429 (throttle) |
| `authVerifyResetOtp` | `POST /auth/verify-otp` | `{ email, otp }` | `{ resetToken }` | `OTP_INVALID { attemptsLeft }`, `OTP_EXPIRED`, `OTP_LOCKED` (all 400; the last two need a new code) |
| `authResetPassword` | `POST /auth/reset-password` | `{ resetToken, password }` | `{ reset: true }`; every session ends, so the app clears its tokens and returns to sign-in | `OTP_INVALID` (token spent/expired: start again), `VALIDATION_FAILED` |
| `authChangePassword` | `POST /auth/change-password` (bearer) | `{ currentPassword, newPassword }`, or Google-only (`user.hasPassword` false): `{ idToken, newPassword }` with a fresh Google ID token | `{ changed: true, tokens }`. Every session ends, this one too: the new pair is stored, then `/auth/me` replaces the session. | `INVALID_CREDENTIALS` 403 |
| `authDeleteAccount` | `DELETE /auth/account` (bearer) | `{ password }`, or Google-only: `{ idToken }` (a fresh Google sign-in after typing DELETE) | `{ deleted: true }` | `INVALID_CREDENTIALS` 403 |

**Password policy** (`authModel.PASSWORD_POLICY`, the API's `IsStrongPassword`): 8–72 characters, with at least one lower-case letter, one upper-case letter and one number. The dummy API applies the same rule.

**Errors** (`src/networks/network/errorCodes.ts`): screens compare against `ERROR_CODES`, never an inline string. `errorCopy(code, details)` is the person-facing text. `VALIDATION_FAILED` carries `details.fields` (`{ field: [messages] }`, read with `fieldErrors`). A 429's wait is in `details.retryAfter`, taken from the body or the `Retry-After` header.

**OTP:** 6 digits, 5 attempts, then `OTP_LOCKED`.

## Users (`/users`)

| Function | Method + path | Body | 2xx `data` |
|---|---|---|---|
| `updateMe` | `PATCH /users/me` | `{ displayName?, phone?, avatarUrl? }` | the user (`AuthUser`, not wrapped) |
| `completeProfile` | `PATCH /users/me/profile` (customers only) | `{ dateOfBirth (YYYY-MM-DD, age 13+), gender, streetAddress, city, postalCode?, avatarUrl? }` | `{ user }` with `profileComplete: true` |
| `registerDevice` | `PUT /users/me/devices` | `{ expoPushToken, platform: 'android' \| 'ios' \| 'web' }` | `{ registered: true }` |
| `unregisterDevice` | `DELETE /users/me/devices/:token` (URL-encoded) | — | `{ removed: boolean }` |

`User` carries `profileComplete` (always true for non-customers) and `profileSkippable` (customers from before Complete Profile existed). The gate sends an incomplete customer to Complete Profile; a skippable one may tap "Skip for now", remembered on the device per account (`preferences.skippedProfile`).

## Media (`/media`) and Cloudinary

| Function | Method + path | Body | 2xx `data` |
|---|---|---|---|
| `signUpload` | `POST /media/sign-upload` | `{ purpose }` (`avatar`, `business_document`, …: the API's `UPLOAD_PURPOSES`) | `{ cloudName, apiKey, timestamp, signature, folder, publicIdPrefix, uploadUrl, allowedFormats, maxBytes, type? }` |
| `uploadToCloudinary` | `POST <uploadUrl>` (multipart: `file, api_key, timestamp, signature, folder, allowed_formats`, and `type` when given) | — | `{ secure_url, public_id, resource_type, format, bytes }` |

Everything but `file` and `api_key` is signed, so `folder`, `timestamp`, `allowed_formats` and `type` are sent exactly as given. The app refuses a file over `maxBytes` or of a format not in `allowedFormats` before uploading (`uploadProblem`).

## Businesses (`/businesses`) — partner, bearer

| Function | Method + path | Body | 2xx `data` | Errors |
|---|---|---|---|---|
| `createBusiness` | `POST /businesses` | `{ serviceType, subType, name, phone, city, addressLine, lat?, lng?, pmdcNumber? }` (the API's `CreateBusinessDto`; other fields are dropped) | `BusinessDetail` (draft) | `BUSINESS_EXISTS` 409, `VALIDATION_FAILED` 400 |
| `getMyBusiness` | `GET /businesses/me` | — | `BusinessDetail` | `NOT_FOUND` 404 → app treats as `null` |
| `updateMyBusiness` | `PATCH /businesses/me` | any subset of the create body | `BusinessDetail` | `BUSINESS_NOT_EDITABLE` 409 |
| `addDocument` | `POST /businesses/me/documents` | `{ kind, url, publicId }` (a `business_document` upload). A single-copy kind replaces the earlier one; `kitchen_photo` / `shop_photo` add up, at most 4 | `DocumentView`; the app then reads `GET /businesses/me` | `VALIDATION_FAILED` 400 (a kind the sub-type doesn't need, a 5th photo), `BUSINESS_NOT_EDITABLE` 409 |
| `removeDocument` | `DELETE /businesses/me/documents/:id` | — | `{ removed: true }`; the app then reads `GET /businesses/me` | `NOT_FOUND` 404, `BUSINESS_NOT_EDITABLE` 409 |
| `submitBusiness` | `POST /businesses/me/submit` | — | `BusinessDetail` (`pending_approval`) | `DOCUMENTS_MISSING` 422 `details: { missing: string[], requirements }`; `VALIDATION_FAILED` 400 (doctor with no PMDC number); `INVALID_TRANSITION` 409 |
| `getMyBusinessStatus` | `GET /businesses/me/status` | — | `{ status, rejectionReason, suspensionReason }` (no documents; `GET /businesses/me` has them) | `NOT_FOUND` 404 |

Any partner request may return **403 `BUSINESS_SUSPENDED`**. The client then re-reads `/auth/me` and routes to the Suspended screen.

### Required documents (`businessModel.DOCUMENT_REQUIREMENTS`, the API's `required-documents.ts`)

| Sub-type | Documents |
|---|---|
| doctor | `cnic_front`, `cnic_back`, `pmdc_certificate`, `degree_certificate` |
| store (vendor) | `cnic_front`, `cnic_back`, one of `ntn_certificate` / `shop_photo` |
| restaurant | `cnic_front`, `cnic_back`, `pfa_licence`, `storefront_photo` |
| cloud_kitchen | `cnic_front`, `cnic_back`, `pfa_licence` |
| home_kitchen | `cnic_front`, `cnic_back`, `kitchen_photo` × 2 |

PersonalInfo shows one tile per slot (`businessModel.documentSlots`): two kitchen-photo tiles, and one "NTN certificate or Shop photo" tile where the partner says which it is.

### Professional info (`businessModel.BUSINESS_FORM_SCHEMA`)

Only what the API stores: name, city, address, map pin, and the PMDC number for doctors (`PMDC_PATTERN`, upper-cased). The FYP form's specialty, category, cuisine, experience, description and daily capacity are not asked for, as the API has nowhere to keep them (decision, 30 Oct 2026).

The business `phone` is the provider's own phone, captured at sign-up.

## Admin (`/admin/businesses`) — admin / super_admin, bearer

| Function | Method + path | Body / query | 2xx `data` |
|---|---|---|---|
| `listBusinesses` | `GET /admin/businesses` | `?status=&serviceType=&q=&page=&pageSize=` (the API's `AdminBusinessQueryDto`) | `{ items, total, page, pageSize }`, each item `BusinessView & { owner: { id, email, displayName, phone, … } \| null }`. The app's "load more" cursor is the next page number. |
| `getBusiness` | `GET /admin/businesses/:id` | — | `BusinessDetail & { owner, history }` |
| `approveBusiness` | `POST /admin/businesses/:id/approve` | — | `BusinessDetail` |
| `rejectBusiness` | `POST /admin/businesses/:id/reject` | `{ reason (3–1000), documentNotes?: [{ documentId, note (2–500) }] }` | `BusinessDetail` |
| `suspendBusiness` | `POST /admin/businesses/:id/suspend` | `{ reason }` | `BusinessDetail` |
| `reinstateBusiness` | `POST /admin/businesses/:id/reinstate` | `{ reason }` (required) | `BusinessDetail` |

## Food

Food Court runs on the real contract, `docs/API_FOOD.md` (a copy of the backend's). The dummy API's Food routes and rules are in `docs/MOCK_FOOD.md`.

## Admin sign-in flow

1. `POST /auth/signin` with `portal: 'admin'` (the app retries there after the User sign-in's `WRONG_PORTAL`) returns `{ totpRequired, enrolmentRequired, challengeToken }` for a staff account. **No tokens are issued.**
2. If `enrolmentRequired` is false, go to step 3. Otherwise go to the enrol branch below.
3. `POST /auth/admin/totp` with a code or a recovery code returns `AuthResult`.

Enrol branch:
1. `POST /auth/admin/totp/enrol` returns the QR material.
2. `POST /auth/admin/totp/confirm` returns `AuthResult` and `recoveryCodes`. The codes are shown once.

## Mock mode

Retired for auth (2026-10-30). The app always talks to the real API; the dummy API in `src/networks/network/mock/` is test fixtures for Shopping, Health, Food and Kitchen only, and has no auth, users, media, business, approval or platform routes. A test signs in with `signInAs()` (`mock/testing.ts`), which writes a session for a seeded account (`mock/mockDb.ts`) straight into the dummy DB.
