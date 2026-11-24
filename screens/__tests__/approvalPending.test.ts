// Approval Pending on a slow link: one status check on the wire at a time,
// Check Now during a quiet check makes that one report, and a decision that
// lands after sign-out never brings the session back.

import { combineReducers, configureStore } from '@reduxjs/toolkit';
import authReducer from '../../store/authSlice';
import {
  checkStatusAsync,
  markManualCheck,
  providerApprovalPendingSlice,
} from '../provider-approval-pending-screen/providerApprovalPendingSlice';
import { ApiError } from '../../networks/network/network';
import { clearTokens, setTokens } from '../../utils/storage_utils/storageUtils';
import { makeUser } from '../../__fixtures__/users';

jest.mock('../../networks/businesses/business', () => ({ fetchMyBusinessStatus: jest.fn() }));
jest.mock('../../networks/authcalls/me', () => ({ me: jest.fn() }));
const { fetchMyBusinessStatus } = jest.requireMock('../../networks/businesses/business') as { fetchMyBusinessStatus: jest.Mock };
const { me } = jest.requireMock('../../networks/authcalls/me') as { me: jest.Mock };

const statusBody = (status: string) => ({ success: true, data: { id: 'b1', status } });
const makeStore = () =>
  configureStore({
    reducer: combineReducers({ auth: authReducer, providerApprovalPending: providerApprovalPendingSlice.reducer }),
  });

beforeEach(async () => {
  jest.clearAllMocks();
  await clearTokens();
});

describe('checkStatusAsync', () => {
  it('never puts a second check on the wire while one is waiting', async () => {
    const store = makeStore();
    let release!: (v: unknown) => void;
    fetchMyBusinessStatus.mockReturnValue(new Promise(r => (release = r)));
    const a = store.dispatch(checkStatusAsync({ manual: false }));
    const b = store.dispatch(checkStatusAsync({ manual: false }));
    release(statusBody('pending_approval'));
    await Promise.all([a, b]);
    expect(fetchMyBusinessStatus).toHaveBeenCalledTimes(1);
    expect(store.getState().providerApprovalPending).toMatchObject({ checking: false, checks: 1 });
  });

  it('Check Now during a quiet check makes that check report its failure', async () => {
    const store = makeStore();
    let fail!: (e: unknown) => void;
    fetchMyBusinessStatus.mockReturnValue(new Promise((_r, j) => (fail = j)));
    const quiet = store.dispatch(checkStatusAsync({ manual: false }));
    store.dispatch(markManualCheck());
    fail(new ApiError('x', 'NETWORK_ERROR', undefined, { reason: 'timeout' }));
    await quiet;
    const { error } = store.getState().providerApprovalPending;
    expect(error.message).toMatch(/taking longer than usual/);
  });

  it('a decision opens the app by reading the session again', async () => {
    const store = makeStore();
    await setTokens('a', 'r');
    fetchMyBusinessStatus.mockResolvedValue(statusBody('approved'));
    me.mockResolvedValue({ user: makeUser({ role: 'partner' }), business: { id: 'b1', status: 'approved' } });
    await store.dispatch(checkStatusAsync({ manual: false }));
    expect(store.getState().auth.business?.status).toBe('approved');
  });

  it('a decision that lands after sign-out does not bring the session back', async () => {
    const store = makeStore();
    fetchMyBusinessStatus.mockResolvedValue(statusBody('approved'));
    me.mockResolvedValue({ user: makeUser({ role: 'partner' }), business: { id: 'b1', status: 'approved' } });
    await store.dispatch(checkStatusAsync({ manual: false }));
    expect(store.getState().auth.isAuthenticated).toBe(false);
  });
});
