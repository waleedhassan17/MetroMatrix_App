import {
  doctorRootRoute,
  foodVendorRootRoute,
  gateInputOf,
  isGateCleared,
  partnerAppFor,
  partnerSetupInitialRoute,
  resolveGate,
  totpInitialRoute,
  type GateInput,
} from '../sessionGate';
import type { Business, BusinessStatus, User, UserRole } from '../../models/auth';
import { makeUser } from '../../__fixtures__/users';

const user = (role: UserRole, isEmailVerified = true, profileComplete = true): User =>
  makeUser({ role, isEmailVerified, profileComplete });

const business = (status: BusinessStatus, extra: Partial<Business> = {}): Business =>
  ({
    id: 'b',
    subType: 'store',
    status,
    name: 'Shop',
    phone: '+924235761234',
    city: 'Lahore',
    address: 'Main Boulevard',
    documents: [],
    ...extra,
  }) as Business;

const input = (over: Partial<GateInput>): GateInput => ({
  isAuthenticated: true,
  user: null,
  business: null,
  pendingTotp: null,
  ...over,
});

describe('resolveGate — the BaseNavigator ladder, in order', () => {
  it('1. not authenticated → unauthenticated', () => {
    expect(resolveGate(input({ isAuthenticated: false }))).toBe('unauthenticated');
    expect(resolveGate(input({ isAuthenticated: true, user: null }))).toBe('unauthenticated');
  });

  it('2. a pending TOTP challenge (no tokens yet) → totp', () => {
    const pendingTotp = { challengeToken: 'c', enrolled: true, email: 'a@x.com' };
    expect(resolveGate(input({ isAuthenticated: false, pendingTotp }))).toBe('totp');
  });

  it('3. email not verified → verify, for every role and before any profile gate', () => {
    for (const role of ['customer', 'partner', 'admin'] as UserRole[]) {
      expect(resolveGate(input({ user: user(role, false, false), business: business('rejected') }))).toBe('verify');
    }
  });

  it('4. a user whose profile is incomplete → completeProfile', () => {
    expect(resolveGate(input({ user: user('customer', true, false) }))).toBe('completeProfile');
  });

  it('4b. "Skip for now" lets only a skippable customer through, and only once they skipped', () => {
    const existing = makeUser({ role: 'customer', profileComplete: false, profileSkippable: true });
    const brandNew = makeUser({ role: 'customer', profileComplete: false, profileSkippable: false });
    expect(resolveGate(input({ user: existing }))).toBe('completeProfile');
    expect(resolveGate(input({ user: existing, profileSkipped: true }))).toBe('customer');
    // A new customer can't skip, even if a skip was recorded for the id.
    expect(resolveGate(input({ user: brandNew, profileSkipped: true }))).toBe('completeProfile');
  });

  it('gateInputOf reads the skip for THIS account from the device preferences', () => {
    const u = makeUser({ id: 'u7', role: 'customer', profileComplete: false, profileSkippable: true });
    const auth = { isAuthenticated: true, user: u, business: null, pendingTotp: null };
    expect(gateInputOf(auth, { u7: true }).profileSkipped).toBe(true);
    expect(gateInputOf(auth, { someoneElse: true }).profileSkipped).toBe(false);
    expect(resolveGate(gateInputOf(auth, { u7: true }))).toBe('customer');
  });

  it('profile completion never gates providers or staff', () => {
    expect(resolveGate(input({ user: user('partner', true, false), business: business('approved') }))).toBe('partner');
    expect(resolveGate(input({ user: user('admin', true, false) }))).toBe('admin');
  });

  it('5. provider with no application or a draft → partnerSetup', () => {
    expect(resolveGate(input({ user: user('partner') }))).toBe('partnerSetup');
    expect(resolveGate(input({ user: user('partner'), business: business('draft') }))).toBe('partnerSetup');
  });

  it.each([
    ['pending_approval', 'pending'],
    ['rejected', 'rejected'],
    ['suspended', 'suspended'],
    ['approved', 'partner'],
  ] as const)('6–8. provider application %s → %s', (status, gate) => {
    expect(resolveGate(input({ user: user('partner'), business: business(status) }))).toBe(gate);
  });

  it('then the role picks the app', () => {
    expect(resolveGate(input({ user: user('customer') }))).toBe('customer');
    expect(resolveGate(input({ user: user('admin') }))).toBe('admin');
    expect(resolveGate(input({ user: user('super_admin') }))).toBe('admin');
    expect(resolveGate(input({ user: user('rider') }))).toBe('rider');
  });

  it('a rider goes straight to the rider app (the vendor made the account)', () => {
    expect(resolveGate(input({ user: user('rider', false, false) }))).toBe('rider');
    expect(resolveGate(input({ isAuthenticated: false, user: user('rider') }))).toBe('unauthenticated');
  });

  it('a customer is never gated by a stray business record', () => {
    expect(resolveGate(input({ user: user('customer'), business: business('suspended') }))).toBe('customer');
  });

  it('only role apps count as cleared', () => {
    expect(['customer', 'partner', 'rider', 'admin'].every(g => isGateCleared(g as never))).toBe(true);
    expect(['verify', 'completeProfile', 'pending', 'totp', 'partnerSetup'].some(g => isGateCleared(g as never))).toBe(false);
  });
});

describe('totpInitialRoute', () => {
  it('a first sign-in enrols an authenticator; afterwards, the code step', () => {
    expect(totpInitialRoute({ challengeToken: 'c', enrolled: false, email: 'a@x.com' })).toBe('AdminTwoFactorEnrol');
    expect(totpInitialRoute({ challengeToken: 'c', enrolled: true, email: 'a@x.com' })).toBe('AdminTotp');
    expect(totpInitialRoute(null)).toBe('AdminTotp');
  });
});

describe('partnerSetupInitialRoute — never guess the service', () => {
  const partner = user('partner');
  it('opens Personal Info when the draft business or the saved pick names the service', () => {
    expect(partnerSetupInitialRoute(business('draft', { subType: 'doctor' }), null, partner)).toBe('PersonalInfo');
    expect(partnerSetupInitialRoute(null, 'home_kitchen', partner)).toBe('PersonalInfo');
  });
  it('opens Provider Selection on a new device with no business and no saved pick', () => {
    expect(partnerSetupInitialRoute(null, null, partner)).toBe('ProviderSelection');
  });
});

describe('doctorRootRoute — Practice setup until listed', () => {
  it('opens a new doctor on Practice setup', () => {
    expect(doctorRootRoute({ isListed: false })).toBe('PracticeSetup');
    expect(doctorRootRoute({ isListed: null })).toBe('PracticeSetup');
    expect(doctorRootRoute(null)).toBe('PracticeSetup');
  });
  it('opens a listed doctor on the tabs', () => {
    expect(doctorRootRoute({ isListed: true })).toBe('DoctorTabs');
  });
});

describe('foodVendorRootRoute — Kitchen setup until live', () => {
  const food = (isLive: boolean) => ({ brandId: 'br', brandSlug: 'x', branchStatus: 'draft', isLive, setupComplete: isLive });
  it('opens a kitchen that is not live on Kitchen setup', () => {
    expect(foodVendorRootRoute({ food: food(false) })).toBe('VendorSetup');
    expect(foodVendorRootRoute({ food: null })).toBe('VendorSetup');
    expect(foodVendorRootRoute(null)).toBe('VendorSetup');
  });
  it('opens a live kitchen on the tabs', () => {
    expect(foodVendorRootRoute({ food: food(true) })).toBe('VendorTabs');
  });
});

describe('partnerAppFor — routing after approval', () => {
  it('opens the app for the business’s service once the gate clears', () => {
    const approved = (serviceType: Business['serviceType']) => business('approved', { serviceType });
    expect(resolveGate(input({ user: user('partner'), business: approved('shopping') }))).toBe('partner');
    expect(partnerAppFor(approved('shopping'))).toBe('store');
    expect(partnerAppFor(approved('healthcare'))).toBe('doctor');
    expect(partnerAppFor(approved('food'))).toBe('kitchen');
  });

  it('a doctor’s app then opens on Practice setup until listed', () => {
    const doctor = business('approved', { serviceType: 'healthcare', subType: 'doctor', isListed: false });
    expect(partnerAppFor(doctor)).toBe('doctor');
    expect(doctorRootRoute(doctor)).toBe('PracticeSetup');
  });

  it('defaults to the store app when the service is unknown', () => {
    expect(partnerAppFor(null)).toBe('store');
  });
});
