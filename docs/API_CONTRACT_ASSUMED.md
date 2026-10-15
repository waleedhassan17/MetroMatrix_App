# Assumed API contract (Chunk 1)

MetroMatrix-API `docs/API_AUTH.md` was not available while Chunk 1 was built. Everything the app sends and expects is listed here, derived from the Chunk 1 brief: its endpoint names, error codes and flows.

Every line of app code that depends on an item below carries `TODO(API_AUTH)`. When the real document arrives:
1. Diff it against this file.
2. Fix the network, serializer or model named in the **Where** column.
3. Delete the matching `TODO(API_AUTH)`.

Screens and slices should not need to change.

Base URL: `API_BASE_URL` (`src/config/env.ts`), e.g. `https://<heroku-app>.herokuapp.com/api/v1`.

**No backend yet?** Leave `BACKEND_URL` in `src/config/env.ts` empty. Every request is then answered by the dummy API in `src/networks/network/mock/`, which implements this whole contract (see [Mock mode](#mock-mode)). Setting the URL is the only change needed to go live.

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
| `DocumentKind` | `cnic \| medical_license \| degree_certificate \| business_license \| food_license \| kitchen_photo` | ″ |
| `User` | `{ id, email, name, phone \| null, role, avatarUrl \| null, isEmailVerified, hasPassword, providers: ('password' \| 'google')[], createdAt, profileComplete, dateOfBirth \| null, gender: 'male' \| 'female' \| 'other' \| null, streetAddress \| null, city \| null, postalCode \| null, providerServiceType \| null, providerSubType \| null }` | `authSerializer.userSerializer` |
| `BusinessDocument` | `{ id, kind, url, publicId, mimeType, status: 'pending' \| 'accepted' \| 'rejected', reviewerNote \| null, uploadedAt }` | `businessSerializer` |
| `Business` | `{ id, ownerId, serviceType, subType, name, phone, city, address, location: { lat, lng } \| null, details: Record<string,string>, status, documents[], requiredDocuments: DocumentKind[], missingDocuments: DocumentKind[], rejectionReason \| null, suspensionReason \| null, submittedAt \| null, reviewedAt \| null, createdAt, updatedAt }` | `businessSerializer` |
| `AuthResult` | `{ user, business \| null, tokens }` | `authSerializer.authResultSerializer` |
| `TotpChallenge` | `{ challengeToken, totpEnrolled: boolean }` | `authSerializer.totpChallengeSerializer` |

## Auth (`/auth`)

| Function | Method + path | Body | 2xx `data` | Notable errors |
|---|---|---|---|---|
| `authSignup` | `POST /auth/signup` | `{ name, email, phone, password, portal: 'customer'\|'partner', subType? (providers), acceptedTerms: true }` | `AuthResult` (user unverified; a verification LINK is emailed). Providers get `providerServiceType` / `providerSubType` from `subType`. | `EMAIL_TAKEN` 409, validation 400 |
| `authSignin` | `POST /auth/signin` | `{ email, password, portal }` | customer/partner: `AuthResult`. **Staff accounts on the customer portal** (they sign in from the User sign-in, as in the FYP app): `TotpChallenge`, no tokens. | `INVALID_CREDENTIALS` 401, `WRONG_PORTAL` 403 `details: { portal }` |
| `authAdminTotp` | `POST /auth/admin/totp` | `{ challengeToken, code }` or `{ challengeToken, recoveryCode }` | `AuthResult` | `TOTP_INVALID` 401, `RECOVERY_CODE_USED` 401, `CHALLENGE_EXPIRED` 401 |
| `adminTotpEnrol` | `POST /auth/admin/totp/enrol` | `{ challengeToken }` | `{ secret, otpauthUrl }` | `CHALLENGE_EXPIRED` |
| `adminTotpConfirm` | `POST /auth/admin/totp/confirm` | `{ challengeToken, code }` | `AuthResult & { recoveryCodes: string[] }` | `TOTP_INVALID` |
| `authGoogle` | `POST /auth/google` | `{ idToken, portal: 'customer' }` | `AuthResult` (email verified) | `GOOGLE_TOKEN_INVALID` 401, `WRONG_PORTAL` |
| `authVerificationStatus` | `GET /auth/verification-status` (bearer) | — | `{ isEmailVerified }`. Polled by "I Verified My Email". | 401 |
| `authVerifyEmail` | `POST /auth/verify-email` | `{ token }` (from the link `metromatrix://verify-success?token=…`) | `{ user }` | `VERIFY_TOKEN_INVALID` 400 |
| `authResendVerification` | `POST /auth/resend-verification` (bearer) | — | `{ retryAfter }` (seconds until the next resend) | `RESEND_TOO_SOON` 429 `details: { retryAfter }` |
| `authRefresh` | `POST /auth/refresh` | `{ refreshToken }` | token pair (rotated) | 401 → session over |
| `authLogout` | `POST /auth/logout` (bearer) | `{ refreshToken? }` | — | ignored |
| `authMe` | `GET /auth/me` (bearer) | — | `{ user, business \| null }` | 401 |
| `authForgotPassword` | `POST /auth/forgot-password` | `{ email }` | `{ retryAfter }` (always 200, so the endpoint can't be used to check whether an email exists) | `RESEND_TOO_SOON` |
| `authVerifyResetOtp` | `POST /auth/verify-reset-otp` | `{ email, code }` | `{ resetToken }` | `INVALID_OTP { attemptsLeft }`, `OTP_LOCKED`, `OTP_EXPIRED` |
| `authResetPassword` | `POST /auth/reset-password` | `{ resetToken, password }` | — | `RESET_TOKEN_INVALID` |
| `authChangePassword` | `POST /auth/change-password` (bearer) | `{ currentPassword?, newPassword }` (`currentPassword` omitted when `user.hasPassword` is false, i.e. Google-only) | `{ user }` | `INVALID_CREDENTIALS` |
| `authDeleteAccount` | `DELETE /auth/account` (bearer) | `{ password }` (Google-only: `{ confirm: 'DELETE' }`) | — | `INVALID_CREDENTIALS` |

**Password policy** (`authModel.PASSWORD_POLICY`): 8–72 characters, with at least one letter and one number.

**OTP:** 6 digits, 5 attempts, then `OTP_LOCKED`.

## Users (`/users`)

| Function | Method + path | Body | 2xx `data` |
|---|---|---|---|
| `updateMe` | `PATCH /users/me` | `{ name?, phone?, avatarUrl? }` | `{ user }` |
| `completeProfile` | `PATCH /users/me/profile` | `{ dateOfBirth (YYYY-MM-DD), gender, streetAddress, city, postalCode?, avatarUrl? }` | `{ user }` with `profileComplete: true` |
| `registerDevice` | `POST /users/me/devices` | `{ token, platform: 'android' \| 'ios' \| 'web' }` | — |
| `unregisterDevice` | `DELETE /users/me/devices/:token` | — | — |

## Media (`/media`) and Cloudinary

| Function | Method + path | Body | 2xx `data` |
|---|---|---|---|
| `signUpload` | `POST /media/sign` | `{ purpose: 'avatar' \| 'business_document' }` | `{ cloudName, apiKey, timestamp, signature, folder, uploadUrl? }` |
| `uploadToCloudinary` | `POST https://api.cloudinary.com/v1_1/<cloudName>/auto/upload` (multipart: `file, api_key, timestamp, signature, folder`) | — | `{ secure_url, public_id, resource_type, format, bytes }` |

## Businesses (`/businesses`) — partner, bearer

| Function | Method + path | Body | 2xx `data` | Errors |
|---|---|---|---|---|
| `createBusiness` | `POST /businesses` | `{ serviceType, subType, name, phone, city, address, location?, details }` | `Business` (draft) | `BUSINESS_EXISTS` 409 |
| `getMyBusiness` | `GET /businesses/me` | — | `Business` | `NOT_FOUND` 404 → app treats as `null` |
| `updateMyBusiness` | `PATCH /businesses/me` | any subset of the create body | `Business` | — |
| `addDocument` | `POST /businesses/me/documents` | `{ kind, url, publicId, mimeType }` (replaces an existing doc of that kind) | `Business` | — |
| `removeDocument` | `DELETE /businesses/me/documents/:id` | — | `Business` | — |
| `submitBusiness` | `POST /businesses/me/submit` | — | `Business` (`pending_approval`) | `DOCUMENTS_MISSING` 422 `details: { missing: DocumentKind[] }` |
| `getMyBusinessStatus` | `GET /businesses/me/status` | — | `{ status, rejectionReason, suspensionReason, documents: [{ id, kind, status, reviewerNote }] }` | — |

Any partner request may return **403 `BUSINESS_SUSPENDED`**. The client then re-reads `/auth/me` and routes to the Suspended screen.

### Required documents (`businessModel.REQUIRED_DOCUMENTS`, mirrors the API's `required-documents.ts`)

| Sub-type | Documents |
|---|---|
| doctor | `cnic`, `medical_license`, `degree_certificate` |
| store (vendor) | `cnic`, `business_license` |
| restaurant | `cnic`, `food_license` |
| cloud_kitchen | `cnic`, `food_license` |
| home_kitchen | `cnic`, `kitchen_photo` |

### Per-sub-type `details` (`businessModel.BUSINESS_FORM_SCHEMA`)

| Sub-type | Extra fields |
|---|---|
| doctor | `specialty`, `pmdcNumber`, `experience`, `briefDescription` |
| store (vendor) | `storeCategory`, `experience`, `briefDescription` |
| restaurant / cloud_kitchen | `cuisine`, `experience`, `briefDescription` |
| home_kitchen | `cuisine`, `dailyCapacity`, `experience`, `briefDescription` |

The business `phone` is the provider's own phone, captured at sign-up.

## Admin (`/admin/businesses`) — admin / super_admin, bearer

| Function | Method + path | Body / query | 2xx `data` |
|---|---|---|---|
| `listBusinesses` | `GET /admin/businesses` | `?status=pending_approval&serviceType=food&cursor=` | `{ items: BusinessSummary[], nextCursor \| null }` where `BusinessSummary = { id, name, serviceType, subType, city, status, submittedAt, owner: { name, email } }` |
| `getBusiness` | `GET /admin/businesses/:id` | — | `Business & { owner: { id, name, email, phone } }` |
| `approveBusiness` | `POST /admin/businesses/:id/approve` | — | `Business` |
| `rejectBusiness` | `POST /admin/businesses/:id/reject` | `{ reason, documentNotes: { [documentId]: note } }` | `Business` |
| `suspendBusiness` | `POST /admin/businesses/:id/suspend` | `{ reason }` | `Business` |
| `reinstateBusiness` | `POST /admin/businesses/:id/reinstate` | — | `Business` |

## Food (`/food`) — customer, bearer

`TODO(API_FOOD)`: assumed for the customer Food home, not yet in any backend document.

| Function | Method + path | Query | 2xx `data` |
|---|---|---|---|
| `getFoodHome` | `GET /food/home` | `?city=Lahore` (the customer's profile city) | `FoodHome` |

```
FoodHome = { area, promos: FoodPromo[], cuisines: Cuisine[], kitchens: Kitchen[] }
FoodPromo = { id, title, subtitle, code | null }
Cuisine   = { slug, name }
Kitchen   = { id, name, kind: 'restaurant' | 'home_kitchen' | 'cloud_kitchen', cuisines: string[], area,
              rating (0–5), ratingCount, etaMin, etaMax (minutes), deliveryFee (Rs, 0 = free), minOrder (Rs),
              priceLevel (1–3), distanceKm, deal | null, isNew, imageUrl | null }
```

Kitchens arrive nearest first. Search and the cuisine filter run on the device (`foodModel.filterKitchens`).

## Admin sign-in flow

1. `POST /auth/signin` (from the User sign-in) returns `{ challengeToken, totpEnrolled }` for a staff account. **No tokens are issued.**
2. If `totpEnrolled` is true, go to step 3. Otherwise go to the enrol branch below.
3. `POST /auth/admin/totp` with a code or a recovery code returns `AuthResult`.

Enrol branch:
1. `POST /auth/admin/totp/enrol` returns the QR material.
2. `POST /auth/admin/totp/confirm` returns `AuthResult` and `recoveryCodes`. The codes are shown once.

## Mock mode

When `src/config/env.ts` has no backend URL, `src/networks/network/mock/mockServer.ts` answers every request above. It uses the same envelope, status codes and error codes, with 300–700 ms of simulated latency. Data persists on the device (AsyncStorage), so kill-and-reopen keeps you signed in.

Rules (`mock/mockConfig.ts`):

| What | Rule |
|---|---|
| Email verification link | Counts as opened **5 s** after it is sent. Tapping "I Verified My Email" after that signs you in. The deep link `metromatrix://verify-success?token=mock-verify-<userId>` also works. |
| Password-reset code | **123456**, with 5 attempts and then a lock. |
| Staff authenticator code | **123456**. New staff accounts see the secret `JBSWY3DPEHPK3PXP`. |
| Provider application | Approves itself **30 s** after you submit, or an admin approves it in the console. |
| Uploads | Accepted with simulated progress. The file stays on the device. |
| Access token | Expires after 15 minutes and is refreshed silently. |
| Food home | A fixed, fictional catalogue led by local fast-food brands (`mock/mockFood.ts`), with the customer's own address as the delivery area. |

Seeded accounts (`mock/mockDb.ts`):

| Account | Password | State |
|---|---|---|
| `customer@metromatrix.app` | `Metro2026` | Customer, verified, profile complete |
| `doctor@metromatrix.app` | `Metro2026` | Doctor, **approved** → Doctor app |
| `kitchen@metromatrix.app` | `Metro2026` | Home kitchen, **pending** review |
| `vendor@metromatrix.app` | `Metro2026` | Vendor, **rejected** with notes |
| `admin@metromatrix.app` | `Admin2026` | Super admin. TOTP `123456`; recovery codes `MM7K-Q2PX`, `MM4D-8LNA`, `MM9R-3VWE`, `MM2H-6TZC` |
| `newadmin@metromatrix.app` | `Admin2026` | Admin who has not set up an authenticator yet (enrol flow) |

Any new sign-up works too, as a customer or a provider.

Shopping adds the store owners `store@` (Lawn & Loom), `urban@` and `volt@metromatrix.app`, a second shopper `hamza@metromatrix.app`, and orders, coupons and reports for them: see [API_SHOPPING_ASSUMED.md → Mock mode](API_SHOPPING_ASSUMED.md#mock-mode).
