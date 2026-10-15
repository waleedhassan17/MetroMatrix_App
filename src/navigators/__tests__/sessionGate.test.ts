import { isGateCleared, partnerSetupInitialRoute, resolveGate, type GateInput } from '../sessionGate';
import type { Business, BusinessStatus, User, UserRole } from '../../types/auth';
import { makeUser } from '../../__fixtures__/users';

const user = (role: UserRole, isEmailVerified = true): User => makeUser({ role, isEmailVerified });

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

  it('3. email not verified → verify, for every role and before any partner gate', () => {
    for (const role of ['customer', 'partner', 'admin'] as UserRole[]) {
      expect(resolveGate(input({ user: user(role, false), business: business('rejected') }))).toBe('verify');
    }
  });

  it('4. partner with no business or a draft → partnerSetup', () => {
    expect(resolveGate(input({ user: user('partner') }))).toBe('partnerSetup');
    expect(resolveGate(input({ user: user('partner'), business: business('draft') }))).toBe('partnerSetup');
  });

  it.each([
    ['pending_approval', 'pending'],
    ['rejected', 'rejected'],
    ['suspended', 'suspended'],
    ['approved', 'partner'],
  ] as const)('5–7. partner business %s → %s', (status, gate) => {
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
    expect(['verify', 'pending', 'totp', 'partnerSetup'].some(g => isGateCleared(g as never))).toBe(false);
  });
});

describe('partnerSetupInitialRoute — draft resume (QA 15)', () => {
  it('no business → ServiceSelect', () => {
    expect(partnerSetupInitialRoute(null)).toBe('ServiceSelect');
  });
  it('incomplete profile → BusinessProfile', () => {
    expect(partnerSetupInitialRoute(business('draft', { address: '' }))).toBe('BusinessProfile');
  });
  it('profile saved, documents missing → Documents', () => {
    expect(partnerSetupInitialRoute(business('draft'))).toBe('Documents');
  });
  it('everything uploaded → ReviewSubmit', () => {
    const documents = ['cnic', 'business_license'].map(kind => ({ kind, status: 'pending' }));
    expect(partnerSetupInitialRoute(business('draft', { documents } as never))).toBe('ReviewSubmit');
  });
});
