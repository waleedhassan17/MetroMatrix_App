# Auth and onboarding flows

Every step of the FYP's sign-up, sign-in and onboarding journeys, mapped to the code that runs it and the API call behind it. Built from `src/navigations-maps/Auth.ts`, `src/navigators/sessionGate.ts`, the screens' slices and networks, and MetroMatrix_Backend `docs/API_AUTH.md`. Paths are relative to `API_BASE_URL` (`…/api/v1`).

Data path everywhere: **screen → slice → network → serializer**. Routes are the `ROUTES` names in `navigations-maps/Base.ts`.

## 1. The gate ladder

`resolveGate()` (`navigators/sessionGate.ts`) decides which branch `BaseNavigator` mounts, and `AppContainer` mounts a role app only once the gate is cleared. Each branch is a whole navigator keyed by the gate, so Back can never re-enter another branch.

| # | Condition | Gate | Routes (`navigations-maps/Auth.ts`) | First screen |
|---|---|---|---|---|
| 1 | No session | `unauthenticated` | `UNAUTHENTICATED_ROUTES` (+ `Onboarding` on first launch) | Onboarding, then RoleSelection |
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
| Onboarding (first launch) | `Onboarding` | auth (`hasSeenOnboarding`) | — | — | — |
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
| Sign up | `ProviderSignUp` | `providerSignUpSlice` → `shared/authThunks` | `POST /auth/signup` with `role: 'partner'` (the pick is not sent) | 201; gate → `verify` | as customer |
| Sign in | `ProviderSignIn` | `providerSignInSlice` → `signInAndOpen` | `POST /auth/signin` | 200 | as customer |
| Verify email | as customer | | | gate → `partnerSetup` | |
| No service known (new device, no draft) | `ProviderSelection` (in `PARTNER_SETUP_ROUTES`) | `providerSelectionSlice` | — | → PersonalInfo | — |
| Personal info, step 1 (name, phone) | `PersonalInfo` | `personalInfoSlice.saveBasicsAsync` | `updateMe` → `PATCH /users/me` `{displayName, phone}` | 200 user | 400 fields |
| Step 2 (business: name, city, address, pin, PMDC for doctors) | `PersonalInfo` | `saveProfessionalAsync` | `createBusiness` → `POST /businesses` `{serviceType, subType, name, phone, city, addressLine, lat?, lng?, pmdcNumber?}`; later `updateMyBusiness` → `PATCH /businesses/me` | 201 / 200 `BusinessDetail` (`draft`) | 409 `BUSINESS_EXISTS`, 400 fields, 409 `BUSINESS_NOT_EDITABLE` |
| Step 3: upload a document (one tile per slot) | `PersonalInfo` | `uploadDocumentAsync` | `signUpload('business_document')` → `POST /media/sign-upload`; direct upload to Cloudinary; `addDocument` → `POST /businesses/me/documents` `{kind, url, publicId}`, then `GET /businesses/me` | business with the document and requirement statuses | file too large / wrong format (before uploading), 400 (kind not needed, a 5th photo), Cloudinary errors (Retry) |
| Remove a document | `PersonalInfo` | `removeDocumentAsync` | `removeDocument` → `DELETE /businesses/me/documents/:id`, then `GET /businesses/me` | business | 404, 409 |
| Submit | `PersonalInfo` | `submitApplicationAsync` | `submitBusiness` → `POST /businesses/me/submit` | 200 `pending_approval`; gate → `pending` | 422 `DOCUMENTS_MISSING` (highlights `details.missing`), 400 PMDC missing, 409 `INVALID_TRANSITION` |
| Waiting for approval | `ProviderApprovalPending` | `providerApprovalPendingSlice` | `getMyBusinessStatus` → `GET /businesses/me/status` every 10 s while focused, on returning to the foreground, and "Check now"; when it changes, `authMe` | status changes → gate moves on | silent retry; error shown on "Check now" |
| Approved | role app (`sessionGate.partnerAppFor`) | — | — | Store → `StorePartnerNavigator`; doctor → `DoctorPartnerNavigator`, opening on PracticeSetup until `isListed` (`doctorRootRoute`); kitchen → `KitchenPartnerNavigator` (VendorSetup BLOCKED) | — |
| Rejected | `Rejected` → "Edit and resubmit" → `PersonalInfo` (step 3 with the rejected kinds highlighted, or step 2) | — (reads `auth.business`) | — (the business from `GET /auth/me` / `GET /businesses/me`) | resubmit → `pending` | — |
| Suspended | `Suspended` | — | — | mail to `EXPO_PUBLIC_SUPPORT_EMAIL` | — |
| Suspended mid-session | any partner screen | `apiHelpers` interceptor → `emitBusinessStatusStale` | the 403 `BUSINESS_SUSPENDED`, then `GET /auth/me` | gate → `suspended` | — |

## 4. Staff (admin, super_admin)

| Step | Route / screen | Slice | Network → endpoint | Success | Errors handled |
|---|---|---|---|---|---|
| Sign in (admin door, or retried from the user door) | `SignIn` | `signInAndOpen` | `POST /auth/signin` with `portal: 'admin'` | 200 `{challengeToken, totpEnrolled}` → gate `totp` | as above |
| First sign-in: enrol | `AdminTwoFactorEnrol` | `adminTwoFactorEnrolSlice` | `adminTotpEnrol` → `POST /admin/me/totp/enrol` (challenge as bearer, no body); `adminTotpConfirm` → `POST /admin/me/totp/confirm` `{code}` | QR from `otpauthUri` / `qrDataUrl`; then `{recoveryCodes, auth}`; tokens stored after the codes are saved | `TOTP_INVALID`, dead challenge → back to Sign In with the reason |
| Later sign-ins | `AdminTotp` | `adminTotpSlice` | `authAdminTotp` → `POST /auth/admin/totp` `{challengeToken, code}` or `{challengeToken, recoveryCode}` | session → admin app | `TOTP_INVALID`, 429 `RATE_LIMITED` (retires the challenge), `TOTP_REQUIRED` switches step |

## 5. Password reset (signed out)

| Step | Route / screen | Slice | Network → endpoint | Success | Errors handled |
|---|---|---|---|---|---|
| Email | `ForgotPassword` | `forgotPasswordSlice` | `authForgotPassword` → `POST /auth/forgot-password` `{email}` | always 200 `{delivered: true}`; the App's own 60 s resend timer | 429 |
| Code | `ResetPasswordOTP` | `resetPasswordOtpSlice` | `authVerifyResetOtp` → `POST /auth/verify-otp` `{email, otp}` | `{resetToken}` | `OTP_INVALID` (`attemptsLeft`), `OTP_EXPIRED`, `OTP_LOCKED` |
| New password | `ResetPassword` | `resetPasswordSlice` | `authResetPassword` → `POST /auth/reset-password` `{resetToken, password}` | tokens cleared, toast, stack reset to Sign In | `RESET_TOKEN_INVALID`, 400 password policy |

## 6. Signed-in account actions

| Action | Where | Network → endpoint | Result |
|---|---|---|---|
| Change password | `ChangePassword` (`changePasswordSlice`) | `authChangePassword` → `POST /auth/change-password` `{currentPassword, newPassword}`, or `{idToken, newPassword}` for a Google-only account | `{changed, tokens}`: the new pair is stored, then `GET /auth/me`; every other session ends |
| Delete account | `Profile` (`profileSlice`) | `authDeleteAccount` → `DELETE /auth/account` `{password}` or `{idToken}` | `{deleted: true}` → signed out |
| Push device | app start / sign-out | `PUT /users/me/devices {expoPushToken, platform}`; `DELETE /users/me/devices/:token` | `{removed}` |
| Sign out | `useSignOut` | tokens cleared first, then (best effort) the device is unregistered and `authLogout` → `POST /auth/logout` (bearer, no body) | `resetAllState` → RoleSelection |
| Session refresh | `apiHelpers` interceptor (single flight) | `POST /auth/refresh-token` `{refreshToken}` | new pair. Only `REFRESH_INVALID`, `REFRESH_REUSED`, `TOKEN_REVOKED`, `ACCOUNT_DISABLED` or no refresh token end the session; network errors and 5xx keep it |

## 7. Known gaps (tracked in `D:\MetroMatrix\AUTH_PROGRESS.md`)

- Rider sign-in is BLOCKED (no rider sign-in on the API); kitchen VendorSetup is BLOCKED (no Food module).
