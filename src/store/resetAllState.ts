// ═══════════════════════════════════════════════════════
// MetroMatrix — RESET_ALL_STATE
// ═══════════════════════════════════════════════════════
// Dispatched on sign-in and sign-out to wipe every account-scoped slice back
// to its initial state. Applied ONCE, at the root reducer (store.ts), rather
// than by resetting slices one by one — a hand-maintained list of
// "account-scoped slices" would inevitably miss the next one added.
//
// What survives (SHELL_SLICES in store.ts): `appContainer` and `preferences`,
// which describe the app process and the device, not the account. `auth`
// handles the action itself so `hasSeenOnboarding` outlives every session.

import { createAction } from '@reduxjs/toolkit';

export const resetAllState = createAction('app/RESET_ALL_STATE');
