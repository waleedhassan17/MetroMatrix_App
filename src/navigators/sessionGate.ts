// ═══════════════════════════════════════════════════════
// MetroMatrix — Session gate (the ONE place the ladder lives)
// ═══════════════════════════════════════════════════════
// AppContainer.renderNavigator() asks resolveGate() which app to mount;
// BaseNavigator asks it which gate branch to show. One pure function, so the
// order is written once and unit-tested (navigators/__tests__/sessionGate).
//
// ORDER MATTERS — each step assumes the ones above it have passed:
//   1. not authenticated   → onboarding + sign-in. A pending admin TOTP
//                            challenge is a sub-state of this: no tokens
//                            exist until the second factor is accepted.
//   2. pending TOTP        → the TOTP step (or first-time enrolment)
//   3. email not verified  → verify. Before any partner gate: an unverified
//                            partner must not start a business draft.
//   4. partner, no business or a draft → partner setup
//   5. pending_approval    → pending. After setup: a submitted draft moves
//                            here, never back into the form.
//   6. rejected            → rejected (with the setup routes, to resubmit)
//   7. suspended           → suspended
// Only then does the role pick the app.

import type { Business, BusinessStatus, User } from '../types/auth';
import type { PendingTotp } from '../screens/Auth/authSlice';
import { isProfileComplete, missingDocuments } from '../models/businessModel';

export type Gate =
  | 'unauthenticated'
  | 'totp'
  | 'verify'
  | 'partnerSetup'
  | 'pending'
  | 'rejected'
  | 'suspended'
  | 'customer'
  | 'partner'
  | 'admin';

export interface GateInput {
  isAuthenticated: boolean;
  user: User | null;
  business: Business | null;
  pendingTotp: PendingTotp | null;
}

const PARTNER_GATES: Partial<Record<BusinessStatus, Gate>> = {
  pending_approval: 'pending',
  rejected: 'rejected',
  suspended: 'suspended',
};

export const resolveGate = ({ isAuthenticated, user, business, pendingTotp }: GateInput): Gate => {
  if (!isAuthenticated || !user) return pendingTotp ? 'totp' : 'unauthenticated';
  if (!user.isEmailVerified) return 'verify';

  switch (user.role) {
    case 'partner': {
      if (!business || business.status === 'draft') return 'partnerSetup';
      return PARTNER_GATES[business.status] ?? 'partner';
    }
    case 'admin':
    case 'super_admin':
      return 'admin';
    case 'customer':
      return 'customer';
    default:
      // Riders are refused at sign-in; a restored rider session lands back
      // on Welcome rather than in an app built for someone else.
      return 'unauthenticated';
  }
};

/** True once a role app may mount (no gate left to clear). */
export const isGateCleared = (gate: Gate): boolean =>
  gate === 'customer' || gate === 'partner' || gate === 'admin';

export type PartnerSetupRoute = 'ServiceSelect' | 'BusinessProfile' | 'Documents' | 'ReviewSubmit';

/**
 * Where partner setup resumes (QA 15: kill the app mid-setup, reopen, land
 * where you left off with your data intact).
 */
export const partnerSetupInitialRoute = (business: Business | null): PartnerSetupRoute => {
  if (!business) return 'ServiceSelect';
  if (!isProfileComplete(business)) return 'BusinessProfile';
  return missingDocuments(business.subType, business.documents).length ? 'Documents' : 'ReviewSubmit';
};
