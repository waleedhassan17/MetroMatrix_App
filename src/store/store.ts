import { configureStore, combineReducers } from '@reduxjs/toolkit';
import {
  persistStore,
  persistReducer,
  FLUSH,
  REHYDRATE,
  PAUSE,
  PERSIST,
  PURGE,
  REGISTER,
} from 'redux-persist';
import autoMergeLevel2 from 'redux-persist/lib/stateReconciler/autoMergeLevel2';
import AsyncStorage from '@react-native-async-storage/async-storage';

import { resetAllState } from './resetAllState';

// ── Global slices ──
import authReducer from '../screens/Auth/authSlice';
import { preferencesSlice } from './preferencesSlice';

// ── App-level slices ──
import { appContainerSlice } from '../components/app-container/appContainerSlice';

// ── Per-screen slices ──
// (register each screen's slice here — see CLAUDE.md "How to add a screen")
import { designGallerySlice } from '../screens/Dev/DesignGallery/designGallerySlice';
import { roleSelectionSlice } from '../screens/RoleSelection/roleSelectionSlice';
import { providerSelectionSlice } from '../screens/ProviderSelection/providerSelectionSlice';
import { signInSlice } from '../screens/Auth/SignIn/signInSlice';
import { signUpSlice } from '../screens/Auth/SignUp/signUpSlice';
import { providerSignInSlice } from '../screens/Auth/ProviderSignIn/providerSignInSlice';
import { providerSignUpSlice } from '../screens/Auth/ProviderSignUp/providerSignUpSlice';
import { forgotPasswordSlice } from '../screens/Auth/ForgotPassword/forgotPasswordSlice';
import { resetPasswordOtpSlice } from '../screens/Auth/ResetPasswordOTP/resetPasswordOtpSlice';
import { resetPasswordSlice } from '../screens/Auth/ResetPassword/resetPasswordSlice';
import { emailVerificationSlice } from '../screens/Auth/EmailVerification/emailVerificationSlice';
import { verifySuccessSlice } from '../screens/Auth/VerifySuccess/verifySuccessSlice';
import { completeProfileSlice } from '../screens/Auth/CompleteProfile/completeProfileSlice';
import { personalInfoSlice } from '../screens/Partner/PersonalInfo/personalInfoSlice';
import { providerApprovalPendingSlice } from '../screens/Partner/ProviderApprovalPending/providerApprovalPendingSlice';
import { foodHomeSlice } from '../screens/Customer/FoodHome/foodHomeSlice';
import { profileSlice } from '../screens/Account/Profile/profileSlice';
import { changePasswordSlice } from '../screens/Account/ChangePassword/changePasswordSlice';
import { adminTotpSlice } from '../screens/Admin/AdminTotp/adminTotpSlice';
import { adminTwoFactorEnrolSlice } from '../screens/Admin/AdminTwoFactorEnrol/adminTwoFactorEnrolSlice';
import { approvalQueueSlice } from '../screens/Admin/ApprovalQueue/approvalQueueSlice';
import { businessReviewSlice } from '../screens/Admin/BusinessReview/businessReviewSlice';

// `auth` is persisted through its OWN persistReducer so that exactly one
// field reaches disk. The session (user, business, tokens) is never
// persisted: tokens live in secure-store and the user is re-fetched from
// /auth/me by bootstrapSession on every cold start.
const authPersistConfig = {
  key: 'auth',
  storage: AsyncStorage,
  whitelist: ['hasSeenOnboarding'],
};

const rootReducer = combineReducers({
  auth: persistReducer(authPersistConfig, authReducer),
  preferences: preferencesSlice.reducer,
  appContainer: appContainerSlice.reducer,
  designGallery: designGallerySlice.reducer,
  roleSelection: roleSelectionSlice.reducer,
  providerSelection: providerSelectionSlice.reducer,
  signIn: signInSlice.reducer,
  signUp: signUpSlice.reducer,
  providerSignIn: providerSignInSlice.reducer,
  providerSignUp: providerSignUpSlice.reducer,
  forgotPassword: forgotPasswordSlice.reducer,
  resetPasswordOtp: resetPasswordOtpSlice.reducer,
  resetPassword: resetPasswordSlice.reducer,
  emailVerification: emailVerificationSlice.reducer,
  verifySuccess: verifySuccessSlice.reducer,
  completeProfile: completeProfileSlice.reducer,
  personalInfo: personalInfoSlice.reducer,
  providerApprovalPending: providerApprovalPendingSlice.reducer,
  foodHome: foodHomeSlice.reducer,
  profile: profileSlice.reducer,
  changePassword: changePasswordSlice.reducer,
  adminTotp: adminTotpSlice.reducer,
  adminTwoFactorEnrol: adminTwoFactorEnrolSlice.reducer,
  approvalQueue: approvalQueueSlice.reducer,
  businessReview: businessReviewSlice.reducer,
});

type RootReducerState = ReturnType<typeof rootReducer>;

// Slices that describe the app process / the device rather than the account.
// They survive every RESET_ALL_STATE.
//
// `appContainer` MUST survive: AppContainer dispatches bootstrapSession()
// once, on mount. Resetting the slice to its initialState (isAppReady: false)
// while AppContainer stays mounted would leave the app on the native splash
// forever, on every sign-out AND on the 401 session-expired bridge.
//
// `auth` is passed through as well, but it is NOT a survivor: authSlice
// handles RESET_ALL_STATE itself (back to signed-out, keeping
// hasSeenOnboarding) — passing it through also keeps its `_persist` marker.
const SHELL_SLICES = ['appContainer', 'preferences', 'auth'] as const;

// Applied at the root so a slice added later is account-scoped by default —
// nobody has to remember to add it to a reset list.
const appReducer: typeof rootReducer = (state, action) => {
  if (state && action.type === resetAllState.type) {
    const kept: Partial<RootReducerState> = {};
    for (const key of SHELL_SLICES) {
      (kept as Record<string, unknown>)[key] = state[key];
    }
    return rootReducer(kept as RootReducerState, action);
  }
  return rootReducer(state, action);
};

const persistConfig = {
  key: 'metromatrix-root',
  storage: AsyncStorage,
  // Only device preferences at the root. `auth` persists its one field via
  // its nested config above; everything else is refetched from the API.
  whitelist: ['preferences'],
  stateReconciler: autoMergeLevel2 as any,
};

const persistedReducer = persistReducer(persistConfig, appReducer);

export const store = configureStore({
  reducer: persistedReducer,
  middleware: getDefaultMiddleware =>
    getDefaultMiddleware({
      immutableCheck: { warnAfter: 128 },
      serializableCheck: {
        warnAfter: 128,
        ignoredActions: [FLUSH, REHYDRATE, PAUSE, PERSIST, PURGE, REGISTER],
      },
    }),
});

export const persistor = persistStore(store);
export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
