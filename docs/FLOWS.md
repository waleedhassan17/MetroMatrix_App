# Auth and onboarding flows

Every step of the FYP's sign-up, sign-in and onboarding journeys, mapped to the code that runs it and the API call behind it. Built from `navigations-maps/Auth.tsx`, `navigators/sessionGate.ts`, the screens' slices and networks, and MetroMatrix_Backend `docs/API_AUTH.md`. Paths are relative to `API_BASE_URL` (`…/api/v1`).

Data path everywhere: **screen → slice → network → serializer**. Routes are the `ROUTES` names in `navigations-maps/Base.ts`.

## 1. The gate ladder

`resolveGate()` (`navigators/sessionGate.ts`) decides which branch `BaseNavigator` mounts, and `AppContainer` mounts a role app only once the gate is cleared. Each branch is a whole navigator keyed by the gate, so Back can never re-enter another branch.

| # | Condition | Gate | Routes (`navigations-maps/Auth.ts`) | First screen |
|---|---|---|---|---|
| 1 | No session | `unauthenticated` | `Onboarding` + `UNAUTHENTICATED_ROUTES` | Onboarding, then RoleSelection |
| 2 | Staff sign-in challenge pending (no tokens yet) | `totp` | `ADMIN_TOTP_ROUTES` | AdminTwoFactorEnrol (first sign-in), otherwise AdminTotp |
| 3 | `user.isEmailVerified !== true` | `verify` | `EMAIL_VERIFY_ROUTES` | EmailVerification |
| 4 | Customer, profile incomplete and not skipped | `completeProfile` | `COMPLETE_PROFILE_ROUTES` | CompleteProfile |
| 5 | Partner with no business, or a `draft` | `partnerSetup` | `PARTNER_SETUP_ROUTES` | PersonalInfo if the service is known, otherwise ProviderSelection |
| 6 | Business `pending_approval` | `pending` | `PENDING_ROUTES` | ProviderApprovalPending |
| 7 | Business `rejected` | `rejected` | `REJECTED_ROUTES` | Rejected (then PersonalInfo to resubmit) |
| 8 | Business `suspended` | `suspended` | `SUSPENDED_ROUTES` | Suspended |
| — | Cleared | `customer` / `partner` / `admin` | the role app | — |

A rider session restores to `unauthenticated`; riders are refused at sign-in (`WRONG_APP`).

## 2. Customer

| Step | Route / screen | Slice | Network → endpoint | Success | Errors handled |
|---|---|---|---|---|---|
| Onboarding (every signed-out launch and sign-out) | `Onboarding` | — | — | — | — |
| Pick "User" | `RoleSelection` | `roleSelectionSlice` | — | — | — |
| Sign up | `SignUp` | `signUpSlice` → `shared/authThunks` | `authSignup` → `POST /auth/signup` `{email, password, displayName, phone?, role}` | 201 `AuthResult` (unverified); tokens stored; gate → `verify` | 409 `EMAIL_EXISTS`, 400 `VALIDATION_FAILED` (fields), 429 |
| Sign in | `SignIn` | `signInSlice` → `signInAndOpen` | `authSignin` → `POST /auth/signin` | 200 session | 401 `INVALID_CREDENTIALS` (also during lockout), `WRONG_PORTAL` (opens the right door from `details.accountType`; staff retried on the admin door), `WRONG_APP` (rider), 403 `ACCOUNT_DISABLED`, 429 |
| Google | `SignIn` / `SignUp` | same thunks | `authGoogle` → `POST /auth/google` `{idToken}` | 200 / 201 session | `GOOGLE_CANCELLED` (app), `WRONG_PORTAL` |
| Verify email: wait | `EmailVerification` | `emailVerificationSlice` + `useVerificationPolling` | `authMe` → `GET /auth/me` every 5 s, backing off 5/10/20/30 s on errors, and on returning to the foreground | `isEmailVerified: true` → gate moves on | network errors keep polling |
| Verify email: resend | `EmailVerification` | `emailVerificationSlice` | `authResendVerification` → `POST /auth/resend-verification` | `{retryAfter}` → cooldown | 429 `RESEND_COOLDOWN` (`details.retryAfter`) |
| Verify email: link | deep link `metromatrix://verify-email?token=…` (also `verify-success?…`, rewritten) → `VerifySuccess` | `verifySuccessSlice` | `authVerifyEmail` → `POST /auth/verify-email` `{token}` (public, works signed out); `?verified=1` → `authMe` | 200 `{user, business}` | 400 `VERIFY_LINK_INVALID` |
| Complete profile | `CompleteProfile` | `completeProfileSlice` | optional photo: `signUpload('avatar')` → `POST /media/sign-upload`, then Cloudinary; `completeProfile` → `PATCH /users/me/profile` | 200 `{user}` with `profileComplete: true` | 400 `VALIDATION_FAILED` (fields), 403 for non-customers |
| Skip profile (older customers only) | `CompleteProfile` "Skip for now" | `preferencesSlice.skipProfile` | — (device-only, per account) | gate → `customer` | — |

## 3. Provider (partner)

| Step | Route / screen | Slice | Network → endpoint | Success | Errors handled |
|---|---|---|---|---|---|
| Pick "Provider", then service and type | `RoleSelection` → `ProviderSelection` | `providerSelectionSlice` (`pending`, persisted) | — | — | — |
| Sign up | `ProviderSignUp` | `providerSignUpSlice` → `shared/authThunks.signUpAndOpen` | `POST /auth/signup` with `role: 'partner'` (the pick is not sent) | 201; gate → `verify` | as customer; a sign-up that timed out (not offline) or a second tap told 409 `EMAIL_EXISTS` signs in with the same email and password on the same door, and carries on if it is their account |
| Sign in | `ProviderSignIn` | `providerSignInSlice` → `signInAndOpen` | `POST /auth/signin` | 200 | as customer |
| Verify email | as customer | | | gate → `partnerSetup` | |
| No service known (new device, no draft) | `ProviderSelection` (in `PARTNER_SETUP_ROUTES`) | `providerSelectionSlice` | — | → PersonalInfo | — |
| Personal info, step 1 (name, phone) | `PersonalInfo` | `personalInfoSlice.saveBasicsAsync` | `updateMe` → `PATCH /users/me` `{displayName, phone}` | 200 user | 400 fields |
| Step 2 (business: name, city, address, PMDC for doctors; no map pin) | `PersonalInfo` | `saveProfessionalAsync` | `createBusiness` → `POST /businesses` `{serviceType, subType, name, phone, city, addressLine, pmdcNumber?}` with an `Idempotency-Key` kept across a retry; later `updateMyBusiness` → `PATCH /businesses/me` | 201 / 200 `BusinessDetail` (`draft`) | 409 `BUSINESS_EXISTS` (an earlier create worked: this form is PATCHed onto it), 400 fields (shown under the field, on its step), 409 `BUSINESS_NOT_EDITABLE` |
| Step 3 on arrival with only the session's summary | `PersonalInfo` | `refreshBusinessAsync` | `fetchMyBusiness` → `GET /businesses/me` | the full business (address, documents) | any failure leaves the summary; skeleton tiles while it reads |
| Step 3: upload a document (one tile per slot) | `PersonalInfo` | `uploadDocumentAsync` (one at a time) | `signUpload('business_document')` → `POST /media/sign-upload`; direct upload to Cloudinary (photos, and images picked as files, scaled to 2048 px JPEG on native; HEIC becomes JPEG; PDFs untouched); `addDocument` → `POST /businesses/me/documents` `{kind, url, publicId}` with an `Idempotency-Key` per file, then `GET /businesses/me` | business with the document and requirement statuses | file too large / wrong format (before uploading), 400 (kind not needed, a 5th photo). Cloudinary: a refused file → `UPLOAD_FAILED` `kind: file` ("Use a clear photo (JPG or PNG) or a PDF under 10 MB"); a signature / key / outage refusal, or signing's 503 (uploads not configured) → `UPLOAD_FAILED` `kind: service` ("Uploads aren't available right now"); no answer → `NETWORK_ERROR` with `reason` and `upload: true` (offline only when the device says so). The tile turns `failed`: Retry reuses a file that already reached Cloudinary, "Choose another file" takes a new one; a refused camera / photos permission offers Settings; one picker at a time |
| Remove a document | `PersonalInfo` | `removeDocumentAsync` (after "Remove …?" is confirmed) | `removeDocument` → `DELETE /businesses/me/documents/:id`, then `GET /businesses/me` | business | 404, 409 |
| Submit | `PersonalInfo` | `submitApplicationAsync` | `submitBusiness` → `POST /businesses/me/submit` with an `Idempotency-Key` kept across a retry | 200 `pending_approval`; gate → `pending` | 422 `DOCUMENTS_MISSING` (highlights `details.missing`), 400 PMDC missing; a timeout or 409 `INVALID_TRANSITION` reads `GET /auth/me` and moves the gate on if the submit went through |
| Waiting for approval | `ProviderApprovalPending` | `providerApprovalPendingSlice` | `fetchMyBusinessStatus` → `GET /businesses/me/status` 10 s after the last answer while focused (one at a time), on returning to the foreground, and "Check now"; when it changes, `me` | status changes → gate moves on | silent retry; error shown on "Check now" (also when it lands on a quiet check) |
| Approved | role app (`sessionGate.partnerAppFor`) | — | — | Store → `StorePartnerNavigator`; doctor → `DoctorPartnerNavigator`, opening on PracticeSetup until `isListed` (`doctorRootRoute`); kitchen → `KitchenPartnerNavigator`, opening on VendorSetup until the kitchen is live (`foodVendorRootRoute`) | — |
| Rejected | `Rejected` → "Edit and resubmit" → `PersonalInfo` (step 3 with the rejected kinds highlighted, or step 2) | — (reads `auth.business`) | — (the business from `GET /auth/me` / `GET /businesses/me`) | resubmit → `pending` | — |
| Suspended | `Suspended` | — | "Check again" → `GET /auth/me` | mail to `EXPO_PUBLIC_SUPPORT_EMAIL`; reinstated → gate moves on | "Still paused" / can't reach, inline |
| Suspended mid-session | any partner screen | `network.ts` interceptor → `emitBusinessStatusStale` | the 403 `BUSINESS_SUSPENDED`, then `GET /auth/me` | gate → `suspended` | — |

## 4. Staff (admin, super_admin)

| Step | Route / screen | Slice | Network → endpoint | Success | Errors handled |
|---|---|---|---|---|---|
| Sign in (admin door, or retried from the user door) | `SignIn` | `signInAndOpen` | `POST /auth/signin` with `portal: 'admin'` | 200 `{challengeToken, totpEnrolled}` → gate `totp` | as above |
| First sign-in: enrol | `AdminTwoFactorEnrol` | `adminTwoFactorEnrolSlice` | `adminTotpEnrol` → `POST /admin/me/totp/enrol` (challenge as bearer, no body); `adminTotpConfirm` → `POST /admin/me/totp/confirm` `{code}` | QR from `otpauthUri` / `qrDataUrl`; then `{recoveryCodes, auth}`; tokens stored after the codes are saved | `TOTP_INVALID`, dead challenge → back to Sign In with the reason |
| Later sign-ins | `AdminTotp` | `adminTotpSlice` | `authAdminTotp` → `POST /auth/admin/totp` `{challengeToken, code}` or `{challengeToken, recoveryCode}` | session → admin app | `TOTP_INVALID`, 429 `RATE_LIMITED` (retires the challenge), `TOTP_REQUIRED` switches step |
| Review an application's documents | `BusinessReview` (and `DoctorVerification` for PMDC) | `reviewDocumentAsync` (one at a time) | `reviewBusinessDocument` → `POST /admin/businesses/:id/documents/:documentId/review` `{status: 'accepted' \| 'pending'}` | the admin detail again: the row reads Accepted / Not reviewed; Accept and Undo show only while the API sends `canReviewDocuments` (the business waits for review) | 409 `INVALID_TRANSITION` (decided meanwhile), 404; "That review didn't save" |
| View a document | `PersonalInfo`, `BusinessReview`, `DoctorVerification` | `openViewer` / `openDocument` (`pdf: true` for a PDF) | — (Cloudinary) | an image opens as it is; a PDF opens page by page (`utils/cdn` `pdfPage`: Cloudinary renders each page as a JPEG, since its plan refuses to deliver the PDF file itself, 401), and its tile shows page 1 | a page that can't be shown: "This document couldn't be shown"; Next turns off past the last page |

## 5. Password reset (signed out)

| Step | Route / screen | Slice | Network → endpoint | Success | Errors handled |
|---|---|---|---|---|---|
| Email | `ForgotPassword` | `forgotPasswordSlice` | `authForgotPassword` → `POST /auth/forgot-password` `{email}` | always 200 `{delivered: true}`; the App's own 60 s resend timer (Send again within it goes straight on to the code) | 429 ("Try again in N") |
| Code | `ResetPasswordOTP` | `resetPasswordOtpSlice` | `authVerifyResetOtp` → `POST /auth/verify-otp` `{email, otp}` | `{resetToken}` | `OTP_INVALID` (`attemptsLeft`), `OTP_EXPIRED`, `OTP_LOCKED`; the copy never says whether an account exists ("If an account exists for this email…", "Wrong email?"); opened without an email → the email step |
| New password | `ResetPassword` | `resetPasswordSlice` | `authResetPassword` → `POST /auth/reset-password` `{resetToken, password}` | tokens cleared, toast, stack reset to Sign In | `RESET_TOKEN_INVALID`, 400 password policy; a reset that got no answer and is then refused says "Your password may already be changed" (Sign in) |

## 6. Signed-in account actions

| Action | Where | Network → endpoint | Result |
|---|---|---|---|
| Change password | `ChangePassword` (`changePasswordSlice`) | `authChangePassword` → `POST /auth/change-password` `{currentPassword, newPassword}`, or `{idToken, newPassword}` for a Google-only account | `{changed, tokens}`: the new pair is stored, then `GET /auth/me`; every other session ends |
| Delete account | `Profile` (`profileSlice`) | `authDeleteAccount` → `DELETE /auth/account` `{password}` or `{idToken}` | `{deleted: true}` → signed out |
| Push device | app start / sign-out | `PUT /users/me/devices {expoPushToken, platform}`; `DELETE /users/me/devices/:token` | `{removed}` |
| Sign out | `useSignOut` (try/finally) | tokens cleared first, then (best effort) the device is unregistered, `authLogout` → `POST /auth/logout` (bearer, no body), and the Google account forgotten | `resetAllState` → Onboarding |
| Session refresh | `network.ts` interceptor (single flight) | `POST /auth/refresh-token` `{refreshToken}` | new pair. `REFRESH_INVALID`, `REFRESH_REUSED`, `TOKEN_REVOKED`, `ACCOUNT_DISABLED`, no refresh token, and any other 4xx but 408/429 (a 200 without tokens too) end the session; no answer, 408, 429 and 5xx keep it |
| Session ended | `AppContainer` (session-expired handler) | — | toast, then the person's own sign-in (User, provider or rider) with the email filled in; the local push token is forgotten |
| Back in the foreground | `AppContainer` (`AppState`) | `GET /auth/me` at most every 5 min | an approval, suspension or verification made meanwhile shows at once |
| Cold start | `bootstrapSession` | `GET /auth/me` (+ refresh), capped at 25 s | the splash says "Still connecting…" after 8 s; past the cap `OfflineGate` (Try again, Sign out) |
| Staff with a temporary password | gate `staffPassword` → `ChangePassword` | `POST /auth/change-password` | the console opens once `admin.mustChangePassword` is false |

## 7. Riders

| Step | Route / screen | Slice | Network → endpoint | Success | Errors handled |
|---|---|---|---|---|---|
| Sign in with the username their vendor issued | `RoleSelection` → `RiderSignIn` | `riderSignInSlice` → `riderSignInAndOpen` | `POST /auth/signin` `{identifier, password, portal: 'partner'}` (username trimmed, lower-cased) | the rider app (no email verification, no approval) | `INVALID_CREDENTIALS`, 429 `RATE_LIMITED` (the button waits it out), staff → User sign-in |

## 8. When a request gets no answer

Every no-response failure is `NETWORK_ERROR` with `details.reason`: `offline` (the device reports no connection, expo-network), `timeout`, or `unreachable`. Only `offline` says "You're offline"; a timeout says MetroMatrix is taking longer than usual, and an unreachable server says we can't reach MetroMatrix. A `GET` that never reached the server is tried once more; writes never are, and the onboarding writes carry an `Idempotency-Key` so the person's own retry is safe. Polls and re-reads apply a session only while tokens are still stored (`screens/shared/sessionGuard.ts`), so a reply after sign-out can't restore it. Sign-in screens wait out a 429 `RATE_LIMITED` before the button works again.
