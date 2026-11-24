// Personal Info on a slow link (the 2026-11-24 QA). Every write is safe to
// repeat: the create adopts a business an earlier create made, a submit that
// went through moves the gate on, a retried upload whose file reached
// Cloudinary only records it, uploads run one at a time, and the server's
// field errors land on their own step.

import { combineReducers, configureStore } from '@reduxjs/toolkit';
import authReducer from '../../store/authSlice';
import {
  fillKey,
  nextCreateKey,
  personalInfoSlice,
  refreshBusinessAsync,
  retryUploadFor,
  saveBasicsAsync,
  saveProfessionalAsync,
  submitApplicationAsync,
  uploadDocumentAsync,
} from '../personal-info-screen/personalInfoSlice';
import { emptyBusinessProfile } from '../../models/businessModel';
import { ApiError } from '../../networks/network/network';
import { setTokens, clearTokens } from '../../utils/storage_utils/storageUtils';
import { makeUser } from '../../__fixtures__/users';

jest.mock('../../networks/businesses/business', () => ({
  createBusiness: jest.fn(),
  updateMyBusiness: jest.fn(),
  fetchMyBusiness: jest.fn(),
  addDocument: jest.fn(),
  removeDocument: jest.fn(),
  submitBusiness: jest.fn(),
}));
jest.mock('../../networks/users/users', () => ({ updateMe: jest.fn() }));
jest.mock('../../networks/authcalls/me', () => ({ me: jest.fn() }));
jest.mock('../../services/mediaUpload', () => ({ signUpload: jest.fn(async () => ({ apiKey: 'k' })) }));
jest.mock('../../networks/network/network', () => ({
  ...jest.requireActual('../../networks/network/network'),
  uploadToCloudinary: jest.fn(),
}));

const biz = jest.requireMock('../../networks/businesses/business') as Record<string, jest.Mock>;
const { me } = jest.requireMock('../../networks/authcalls/me') as { me: jest.Mock };
const { updateMe } = jest.requireMock('../../networks/users/users') as { updateMe: jest.Mock };
const { uploadToCloudinary } = jest.requireMock('../../networks/network/network') as { uploadToCloudinary: jest.Mock };

const envelope = (data: unknown) => ({ success: true, data });
const rawBusiness = (over: Record<string, unknown> = {}) => ({
  id: 'b1',
  serviceType: 'shopping',
  subType: 'store',
  name: 'Lawn and Loom',
  phone: '+923001234567',
  city: 'Lahore',
  addressLine: '12 Main Boulevard, Gulberg',
  status: 'draft',
  documents: [],
  ...over,
});

const provider = makeUser({ id: 'u1', role: 'partner', name: 'Sana', phone: '+923001234567', isEmailVerified: true });
const form = { ...emptyBusinessProfile(), name: 'Lawn and Loom', city: 'Lahore', address: '12 Main Boulevard, Gulberg' };

const makeStore = () =>
  configureStore({
    reducer: combineReducers({ auth: authReducer, personalInfo: personalInfoSlice.reducer }),
    middleware: getDefault => getDefault({ serializableCheck: false }),
  });

beforeEach(async () => {
  jest.clearAllMocks();
  await setTokens('a', 'r');
});
afterAll(async () => clearTokens());

describe('step 2: the create', () => {
  const save = (store: ReturnType<typeof makeStore>, createKey: string) =>
    store.dispatch(
      saveProfessionalAsync({ business: null, serviceType: 'shopping', subType: 'store', form, phone: '+923001234567', createKey }),
    );

  it('sends its Idempotency-Key, keeps it when nothing came back, and reuses it on the retry', async () => {
    const store = makeStore();
    biz.createBusiness.mockRejectedValueOnce(new ApiError('slow', 'NETWORK_ERROR', undefined, { reason: 'timeout' }));
    await save(store, 'key-1');
    expect(biz.createBusiness).toHaveBeenLastCalledWith(expect.objectContaining({ subType: 'store' }), 'key-1');
    expect(nextCreateKey(store.getState().personalInfo)).toBe('key-1');

    biz.createBusiness.mockResolvedValueOnce(envelope(rawBusiness()));
    await save(store, nextCreateKey(store.getState().personalInfo));
    expect(biz.createBusiness).toHaveBeenLastCalledWith(expect.anything(), 'key-1');
    expect(store.getState().personalInfo).toMatchObject({ step: 3, createKey: null });
    expect(store.getState().auth.business?.id).toBe('b1');
  });

  it('BUSINESS_EXISTS (an earlier create worked) saves this form onto that business and moves on', async () => {
    const store = makeStore();
    biz.createBusiness.mockRejectedValue(new ApiError('exists', 'BUSINESS_EXISTS', 409));
    biz.updateMyBusiness.mockResolvedValue(envelope(rawBusiness({ name: 'Lawn and Loom' })));
    const r = await save(store, 'key-2');
    expect(saveProfessionalAsync.fulfilled.match(r)).toBe(true);
    expect(biz.updateMyBusiness).toHaveBeenCalledWith(expect.objectContaining({ name: 'Lawn and Loom', addressLine: form.address }));
    expect(store.getState().personalInfo.step).toBe(3);
    expect(store.getState().auth.business?.id).toBe('b1');
  });

  it("the server's field errors land on their field and step", async () => {
    const store = makeStore();
    biz.createBusiness.mockRejectedValue(
      new ApiError('Invalid', 'VALIDATION_FAILED', 400, { fields: { addressLine: ['addressLine must be shorter'] } }),
    );
    await save(store, 'key-3');
    expect(store.getState().personalInfo).toMatchObject({
      step: 2,
      serverErrors: { address: 'addressLine must be shorter' },
      error: { message: 'Check the highlighted fields.' },
      createKey: null,
    });
  });
});

describe('step 1', () => {
  it("a rejected phone goes back to step 1 with the server's words under the field", async () => {
    const store = makeStore();
    updateMe.mockRejectedValue(new ApiError('Invalid', 'VALIDATION_FAILED', 400, { fields: { phone: ['Use a mobile number'] } }));
    await store.dispatch(saveBasicsAsync({ user: provider, fullName: 'Sana Two', phone: '3001234567' }));
    expect(store.getState().personalInfo).toMatchObject({ step: 1, serverErrors: { phone: 'Use a mobile number' } });
  });
});

describe('submit', () => {
  it('a submit that timed out but went through moves the gate to Approval Pending', async () => {
    const store = makeStore();
    biz.submitBusiness.mockRejectedValue(new ApiError('slow', 'NETWORK_ERROR', undefined, { reason: 'timeout' }));
    me.mockResolvedValue({ user: provider, business: { id: 'b1', status: 'pending_approval' } });
    const r = await store.dispatch(submitApplicationAsync({ key: 'sub-1' }));
    expect(submitApplicationAsync.fulfilled.match(r)).toBe(true);
    expect(biz.submitBusiness).toHaveBeenCalledWith('sub-1');
    expect(store.getState().auth.business?.status).toBe('pending_approval');
  });

  it('a second tap told INVALID_TRANSITION does the same', async () => {
    const store = makeStore();
    biz.submitBusiness.mockRejectedValue(new ApiError('Already', 'INVALID_TRANSITION', 409));
    me.mockResolvedValue({ user: provider, business: { id: 'b1', status: 'pending_approval' } });
    const r = await store.dispatch(submitApplicationAsync({ key: 'sub-2' }));
    expect(submitApplicationAsync.fulfilled.match(r)).toBe(true);
  });

  it('a timeout that did not go through keeps its key for the retry and says MetroMatrix is slow', async () => {
    const store = makeStore();
    biz.submitBusiness.mockRejectedValue(new ApiError('slow', 'NETWORK_ERROR', undefined, { reason: 'timeout' }));
    me.mockResolvedValue({ user: provider, business: { id: 'b1', status: 'draft' } });
    await store.dispatch(submitApplicationAsync({ key: 'sub-3' }));
    const s = store.getState().personalInfo;
    expect(s.submitKey).toBe('sub-3');
    expect(s.error.message).toMatch(/taking longer than usual/);
  });
});

describe('documents', () => {
  const file = { uri: 'file:///cnic.jpg', name: 'cnic.jpg', mimeType: 'image/jpeg' };

  it('a retry after the file reached Cloudinary only records it, with the same key', async () => {
    const store = makeStore();
    uploadToCloudinary.mockResolvedValue({ url: 'https://res.cloudinary.com/x/cnic.jpg', publicId: 'x/cnic' });
    biz.addDocument.mockRejectedValueOnce(new ApiError('slow', 'NETWORK_ERROR', undefined, { reason: 'timeout' }));
    await store.dispatch(uploadDocumentAsync({ slot: 'cnic_front', kind: 'cnic_front', file, replacing: null }));
    expect(store.getState().personalInfo.uploads.cnic_front?.status).toBe('failed');
    const retry = retryUploadFor('cnic_front');
    expect(retry?.uploaded?.publicId).toBe('x/cnic');

    biz.addDocument.mockResolvedValueOnce(envelope({ id: 'd1' }));
    biz.fetchMyBusiness.mockResolvedValue(envelope(rawBusiness()));
    await store.dispatch(uploadDocumentAsync(retry!));
    expect(uploadToCloudinary).toHaveBeenCalledTimes(1);
    expect(biz.addDocument).toHaveBeenCalledTimes(2);
    expect(biz.addDocument.mock.calls[0][1]).toBe(biz.addDocument.mock.calls[1][1]);
    expect(store.getState().personalInfo.uploads.cnic_front).toBeUndefined();
  });

  it('runs one upload at a time, so an older business read never lands last', async () => {
    const store = makeStore();
    const order: string[] = [];
    let releaseFirst!: () => void;
    uploadToCloudinary.mockImplementation(async (f: { name: string }) => {
      order.push(`start ${f.name}`);
      if (f.name === 'a.jpg') await new Promise<void>(r => (releaseFirst = r));
      order.push(`end ${f.name}`);
      return { url: `https://res.cloudinary.com/x/${f.name}`, publicId: `x/${f.name}` };
    });
    biz.addDocument.mockResolvedValue(envelope({ id: 'd' }));
    biz.fetchMyBusiness.mockResolvedValue(envelope(rawBusiness()));
    const a = store.dispatch(uploadDocumentAsync({ slot: 'cnic_front', kind: 'cnic_front', file: { ...file, name: 'a.jpg' }, replacing: null }));
    const b = store.dispatch(uploadDocumentAsync({ slot: 'cnic_back', kind: 'cnic_back', file: { ...file, name: 'b.jpg' }, replacing: null }));
    await new Promise(r => setTimeout(r, 0));
    expect(order).toEqual(['start a.jpg']);
    releaseFirst();
    await Promise.all([a, b]);
    expect(order).toEqual(['start a.jpg', 'end a.jpg', 'start b.jpg', 'end b.jpg']);
  });
});

describe('arriving with only the session summary', () => {
  it('reads the full business, so saved documents show instead of "0 of 4 added"', async () => {
    const store = makeStore();
    biz.fetchMyBusiness.mockResolvedValue(
      envelope(rawBusiness({ documents: [{ id: 'd1', kind: 'cnic_front', url: 'https://res.cloudinary.com/x/a.jpg', status: 'pending' }] })),
    );
    const pending = store.dispatch(refreshBusinessAsync());
    expect(store.getState().personalInfo.businessStatus).toBe('loading');
    await pending;
    expect(store.getState().personalInfo.businessStatus).toBe('succeeded');
    expect(store.getState().auth.business?.documents.map(d => d.kind)).toEqual(['cnic_front']);
    expect(store.getState().auth.business?.address).toBe('12 Main Boulevard, Gulberg');
  });

  it('reads once at a time, and a failure leaves the summary as it was', async () => {
    const store = makeStore();
    biz.fetchMyBusiness.mockRejectedValue(new ApiError('slow', 'NETWORK_ERROR', undefined, { reason: 'timeout' }));
    await Promise.all([store.dispatch(refreshBusinessAsync()), store.dispatch(refreshBusinessAsync())]);
    expect(biz.fetchMyBusiness).toHaveBeenCalledTimes(1);
    expect(store.getState().personalInfo.businessStatus).toBe('failed');
    expect(store.getState().auth.business).toBeNull();
  });
});

describe('the fill key', () => {
  it('changes when the full business arrives after a summary, so the form fills again', () => {
    expect(fillKey({ id: 'u1' }, { id: 'b1', address: '' })).not.toBe(fillKey({ id: 'u1' }, { id: 'b1', address: '12 Main' }));
    expect(fillKey({ id: 'u1' }, null)).toBe('u1:new:none');
  });
});
