// Staff accept a partner's documents one at a time (the owner's review of
// 2026-11-25: every document stayed "Pending" until the decision).

import { combineReducers, configureStore } from '@reduxjs/toolkit';
import { businessReviewSlice, loadBusinessAsync, reviewDocumentAsync } from '../business-review-screen/businessReviewSlice';
import { approvalQueueSlice } from '../approval-queue-screen/approvalQueueSlice';

jest.mock('../../networks/admin/adminBusiness', () => ({
  fetchBusiness: jest.fn(),
  reviewBusinessDocument: jest.fn(),
  approveBusiness: jest.fn(),
  rejectBusiness: jest.fn(),
  suspendBusiness: jest.fn(),
  reinstateBusiness: jest.fn(),
}));
const net = jest.requireMock('../../networks/admin/adminBusiness') as Record<string, jest.Mock>;

const doc = (id: string, kind: string, status = 'pending') => ({
  id,
  kind,
  url: `https://res.cloudinary.com/x/image/upload/v1/${id}.jpg`,
  publicId: `x/${id}`,
  status,
  reviewNote: null,
  createdAt: '2026-11-25T00:00:00Z',
});
const detail = (documents: unknown[], over: Record<string, unknown> = {}) => ({
  success: true,
  data: {
    id: 'b1',
    serviceType: 'healthcare',
    subType: 'doctor',
    name: 'Malik Family Clinic',
    phone: '+923001234567',
    city: 'Lahore',
    addressLine: 'Garden Town',
    status: 'pending_approval',
    documents,
    owner: { id: 'u1', displayName: 'Dr Sana', email: 'sana@example.com' },
    canReviewDocuments: true,
    ...over,
  },
});

const makeStore = () =>
  configureStore({
    reducer: combineReducers({ businessReview: businessReviewSlice.reducer, approvalQueue: approvalQueueSlice.reducer }),
  });

beforeEach(() => jest.clearAllMocks());

describe('reviewDocumentAsync', () => {
  it('accepts a document and takes the whole application the API answers', async () => {
    const store = makeStore();
    net.fetchBusiness.mockResolvedValue(detail([doc('d1', 'cnic_front'), doc('d2', 'cnic_back')]));
    await store.dispatch(loadBusinessAsync('b1'));
    expect(store.getState().businessReview.business?.canReviewDocuments).toBe(true);

    net.reviewBusinessDocument.mockResolvedValue(detail([doc('d1', 'cnic_front', 'accepted'), doc('d2', 'cnic_back')]));
    await store.dispatch(reviewDocumentAsync({ id: 'b1', documentId: 'd1', status: 'accepted' }));
    expect(net.reviewBusinessDocument).toHaveBeenCalledWith('b1', 'd1', 'accepted');
    const s = store.getState().businessReview;
    expect(s.reviewing).toBeNull();
    expect(s.business?.documents.map(d => d.status)).toEqual(['accepted', 'pending']);
    expect(s.business?.owner.name).toBe('Dr Sana');
  });

  it('one review at a time: a second tap while one is on the wire does nothing', async () => {
    const store = makeStore();
    let release!: (v: unknown) => void;
    net.reviewBusinessDocument.mockReturnValue(new Promise(r => (release = r)));
    const first = store.dispatch(reviewDocumentAsync({ id: 'b1', documentId: 'd1', status: 'accepted' }));
    expect(store.getState().businessReview.reviewing).toBe('d1');
    await store.dispatch(reviewDocumentAsync({ id: 'b1', documentId: 'd2', status: 'accepted' }));
    release(detail([doc('d1', 'cnic_front', 'accepted')]));
    await first;
    expect(net.reviewBusinessDocument).toHaveBeenCalledTimes(1);
  });

  it('a refusal says the review did not save, and keeps the application', async () => {
    const store = makeStore();
    net.fetchBusiness.mockResolvedValue(detail([doc('d1', 'cnic_front')]));
    await store.dispatch(loadBusinessAsync('b1'));
    net.reviewBusinessDocument.mockRejectedValue(Object.assign(new Error('Documents are reviewed while the business waits for review.'), { code: 'INVALID_TRANSITION' }));
    await store.dispatch(reviewDocumentAsync({ id: 'b1', documentId: 'd1', status: 'accepted' }));
    const s = store.getState().businessReview;
    expect(s.reviewing).toBeNull();
    expect(s.error.message).toMatch(/waits for review/);
    expect(s.business?.documents[0]?.status).toBe('pending');
  });
});
