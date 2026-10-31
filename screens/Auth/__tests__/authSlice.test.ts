import reducer, {
  authSlice,
  setBusiness,
  setOnboardingSeen,
  setPendingTotp,
  setSession,
  setUser,
  signOut,
  type AuthSliceState,
} from '../authSlice';
import { resetAllState } from '../../../store/resetAllState';
import type { Business, User } from '../../../types/auth';
import { makeUser } from '../../../__fixtures__/users';

const user: User = makeUser({ id: 'u1', email: 'a@x.com', name: 'Ayesha', phone: null, role: 'partner' });

const business = { id: 'b1', status: 'pending_approval', serviceType: 'food' } as Business;

const initial = reducer(undefined, { type: '@@init' });

describe('authSlice reducers', () => {
  it('starts signed out and onboarding unseen', () => {
    expect(initial).toEqual({
      user: null,
      business: null,
      isAuthenticated: false,
      hasSeenOnboarding: false,
      pendingTotp: null,
      signedOutLanding: null,
    });
  });

  it('setSession opens a session, clears a pending TOTP and marks onboarding seen', () => {
    const withTotp = reducer(initial, setPendingTotp({ challengeToken: 'c', enrolled: true, email: 'a@x.com' }));
    const state = reducer(withTotp, setSession({ user, business }));
    expect(state).toEqual({
      user,
      business,
      isAuthenticated: true,
      hasSeenOnboarding: true,
      pendingTotp: null,
      signedOutLanding: null,
    });
  });

  it('setUser and setBusiness replace their part only', () => {
    const session = reducer(initial, setSession({ user, business: null }));
    const renamed = reducer(session, setUser({ ...user, name: 'Bilal' }));
    expect(renamed.user?.name).toBe('Bilal');
    expect(renamed.isAuthenticated).toBe(true);
    expect(reducer(renamed, setBusiness(business)).business).toBe(business);
  });

  it('setPendingTotp sets and clears the challenge without authenticating', () => {
    const state = reducer(initial, setPendingTotp({ challengeToken: 'c', enrolled: false, email: 'a@x.com' }));
    expect(state.pendingTotp).toEqual({ challengeToken: 'c', enrolled: false, email: 'a@x.com' });
    expect(state.isAuthenticated).toBe(false);
    expect(reducer(state, setPendingTotp(null)).pendingTotp).toBeNull();
  });

  it.each([
    ['signOut', signOut()],
    ['RESET_ALL_STATE', resetAllState()],
  ])('%s wipes the session but keeps hasSeenOnboarding', (_name, action) => {
    const session = reducer(reducer(initial, setOnboardingSeen()), setSession({ user, business }));
    expect(reducer(session, action)).toEqual({
      user: null,
      business: null,
      isAuthenticated: false,
      hasSeenOnboarding: true,
      pendingTotp: null,
      signedOutLanding: null,
    });
  });

  it('"Use a different account" signs out onto Sign In; the next session clears it', () => {
    const session = reducer(initial, setSession({ user, business }));
    const out = reducer(session, signOut({ landing: 'SignIn' }));
    expect(out).toMatchObject({ isAuthenticated: false, signedOutLanding: 'SignIn' });
    expect(reducer(out, setSession({ user, business })).signedOutLanding).toBeNull();
  });
});

describe('authSlice selectors', () => {
  const wrap = (auth: AuthSliceState) => ({ auth });
  const s = authSlice.selectors;

  it('derive role, verification, business status and service', () => {
    const state = wrap(reducer(initial, setSession({ user, business })));
    expect(s.selectRole(state)).toBe('partner');
    expect(s.selectIsEmailVerified(state)).toBe(true);
    expect(s.selectBusinessStatus(state)).toBe('pending_approval');
    expect(s.selectServiceType(state)).toBe('food');
  });

  it('are null-safe when signed out', () => {
    const state = wrap(initial);
    expect(s.selectRole(state)).toBeNull();
    expect(s.selectIsEmailVerified(state)).toBe(false);
    expect(s.selectBusinessStatus(state)).toBeNull();
    expect(s.selectServiceType(state)).toBeNull();
  });
});
