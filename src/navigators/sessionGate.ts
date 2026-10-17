// ═══════════════════════════════════════════════════════
// MetroMatrix — Session gate (the ONE place the ladder lives)
// ═══════════════════════════════════════════════════════
// AppContainer.renderNavigator() asks resolveGate() which app to mount;
// BaseNavigator asks it which gate branch to show. One pure function, so the
// order is written once and unit-tested (navigators/__tests__/sessionGate).
//
// ORDER MATTERS — each step assumes the ones above it have passed:
//   1. not authenticated   → onboarding (first launch) + Role Selection and
//                            sign-in. A pending staff TOTP challenge is a
//                            sub-state of this: no tokens exist until the
//                            second factor is accepted.
//   2. pending TOTP        → the TOTP step (or first-time enrolment)
//   3. email not verified  → Email Verification. Before any profile gate: an
//                            unverified account must not start a profile.
//   4. user, profile incomplete      → Complete Profile
//   5. provider, no application or a draft → Personal Info
//   6. pending_approval    → Provider Approval Pending. After setup: a
//                            submitted application moves here, never back.
//   7. rejected            → Rejected (with Personal Info, to resubmit)
//   8. suspended           → Suspended
// Only then does the role pick the app. Riders skip 3–8: a vendor created the
// account (its email is a never-mailed placeholder) and the vendor's own
// approval covers it, so a signed-in rider goes straight to the rider app.

import type { Business, BusinessStatus, User } from '../types/auth';
import type { PendingTotp } from '../screens/Auth/authSlice';

export type Gate =
  | 'unauthenticated'
  | 'totp'
  | 'verify'
  | 'completeProfile'
  | 'partnerSetup'
  | 'pending'
  | 'rejected'
  | 'suspended'
  | 'customer'
  | 'partner'
  | 'rider'
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
  if (user.role === 'rider') return 'rider';
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
      return user.profileComplete ? 'customer' : 'completeProfile';
    default:
      // An unknown role lands back on Role Selection rather than in an app
      // built for someone else.
      return 'unauthenticated';
  }
};

/** True once a role app may mount (no gate left to clear). */
export const isGateCleared = (gate: Gate): boolean =>
  gate === 'customer' || gate === 'partner' || gate === 'rider' || gate === 'admin';

/** The TOTP branch opens on enrolment for a staff member's first sign-in. */
export const totpInitialRoute = (pendingTotp: PendingTotp | null): 'AdminTotp' | 'AdminTwoFactorEnrol' =>
  pendingTotp && !pendingTotp.enrolled ? 'AdminTwoFactorEnrol' : 'AdminTotp';

/**
 * The doctor's app opens on Practice setup until the doctor is listed for
 * patients (the checklist, then Publish); after that, on the tabs.
 */
export const doctorRootRoute = (business: Pick<Business, 'isListed'> | null): 'PracticeSetup' | 'DoctorTabs' =>
  business?.isListed ? 'DoctorTabs' : 'PracticeSetup';

/**
 * The Food vendor's app opens on Kitchen setup until the kitchen is live for
 * customers (the checklist, then Go live); after that, on the tabs.
 */
export const foodVendorRootRoute = (business: Pick<Business, 'food'> | null): 'VendorSetup' | 'VendorTabs' =>
  business?.food?.isLive ? 'VendorTabs' : 'VendorSetup';
