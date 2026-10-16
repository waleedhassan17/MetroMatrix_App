import { doctorRootRoute, isGateCleared, resolveGate, totpInitialRoute, type GateInput } from '../sessionGate';
import type { Business, BusinessStatus, User, UserRole } from '../../types/auth';
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
    expect(resolveGate(input({ user: user('rider') }))).toBe('unauthenticated');
  });

  it('a customer is never gated by a stray business record', () => {
    expect(resolveGate(input({ user: user('customer'), business: business('suspended') }))).toBe('customer');
  });

  it('only role apps count as cleared', () => {
    expect(['customer', 'partner', 'admin'].every(g => isGateCleared(g as never))).toBe(true);
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
