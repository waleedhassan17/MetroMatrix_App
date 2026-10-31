// Shopping slices: the rules that live in reducers (not the API).

import { checkoutSlice, newCheckoutKey, placeOrderAsync, choosePayment, toCheckoutInput } from '../checkout-screen/checkoutSlice';
import { addRecentSearch, preferencesSlice, removeRecentSearch, MAX_RECENT_SEARCHES } from '../../store/preferencesSlice';
import { resetAllState } from '../../store/resetAllState';
import { applyFilters, initList, openFilters, productListSlice, setDraft, resetDraft } from '../product-list-screen/productListSlice';
import { DEFAULT_FILTERS } from '../../models/shopping/filterModel';
import { addToBagAsync, bagSlice } from '../bag-screen/bagSlice';
import { savedSlice, setSavedAsync } from '../saved-screen/savedSlice';

describe('checkout', () => {
  const reduce = checkoutSlice.reducer;
  const input = { addressId: 'ad_1', stores: [] };

  it('keeps the Idempotency-Key across a failed attempt and renews it only on demand', () => {
    let s = reduce(undefined, newCheckoutKey());
    const key = s.idempotencyKey;
    expect(key).toMatch(/^[0-9a-f-]{36}$/i);
    s = reduce(s, placeOrderAsync.rejected(null, 'r1', { input, key }, { message: 'Network', code: 'NETWORK_ERROR' } as never));
    expect(s.idempotencyKey).toBe(key);
    expect(s.placeError.message).toBe('Network');
    s = reduce(s, newCheckoutKey());
    expect(s.idempotencyKey).not.toBe(key);
  });

  it('builds the request from the choices, cash on delivery by default', () => {
    let s = reduce(undefined, choosePayment({ storeId: 's_volt', method: 'transfer' }));
    s = reduce(s, choosePayment({ storeId: 's_volt', method: 'transfer' }));
    expect(toCheckoutInput('ad_1', ['s_lawn', 's_volt'], s.choices).stores).toEqual([
      { storeId: 's_lawn', paymentMethod: 'cod', couponCode: null, note: null },
      { storeId: 's_volt', paymentMethod: 'transfer', couponCode: null, note: null },
    ]);
  });
});

describe('recent searches', () => {
  const reduce = preferencesSlice.reducer;
  it('keeps the newest first, once each, at most ten — and forgets them on sign-out', () => {
    let s = reduce(undefined, addRecentSearch('kurta'));
    s = reduce(s, addRecentSearch('Headphones'));
    s = reduce(s, addRecentSearch('KURTA'));
    expect(s.recentSearches).toEqual(['KURTA', 'Headphones']);
    for (let i = 0; i < 20; i++) s = reduce(s, addRecentSearch(`q${i}`));
    expect(s.recentSearches).toHaveLength(MAX_RECENT_SEARCHES);
    s = reduce(s, removeRecentSearch('q19'));
    expect(s.recentSearches[0]).toBe('q18');
    s = reduce(s, resetAllState());
    expect(s.recentSearches).toEqual([]);
    expect(s.lastService).toBeDefined();
  });
});

describe('product list filters', () => {
  const reduce = productListSlice.reducer;
  it('edits a draft and applies it only on "Show results", per list', () => {
    let s = reduce(undefined, initList({ key: 'a', initial: DEFAULT_FILTERS }));
    s = reduce(s, initList({ key: 'b', initial: { ...DEFAULT_FILTERS, sort: 'trending' } }));
    s = reduce(s, openFilters('a'));
    s = reduce(s, setDraft({ key: 'a', draft: { ...DEFAULT_FILTERS, onSale: true } }));
    expect(s.byKey.a.filters.onSale).toBe(false);
    s = reduce(s, applyFilters('a'));
    expect(s.byKey.a.filters.onSale).toBe(true);
    expect(s.byKey.a.sheetOpen).toBe(false);
    expect(s.byKey.b.filters.sort).toBe('trending');
    s = reduce(s, openFilters('a'));
    s = reduce(s, setDraft({ key: 'a', draft: { ...s.byKey.a.draft, sort: 'price_asc' } }));
    s = reduce(s, resetDraft('a'));
    expect(s.byKey.a.draft).toEqual({ ...DEFAULT_FILTERS, sort: 'price_asc' });
  });
});

describe('bag and hearts', () => {
  it('keeps a refused add as the reason, leaving the bag alone', () => {
    const s = bagSlice.reducer(undefined, addToBagAsync.rejected(null, 'r', { variantId: 'v', quantity: 1 }, { message: 'Only 2 left of this option.', code: 'QUANTITY_UNAVAILABLE' } as never));
    expect(s.addError).toMatchObject({ code: 'QUANTITY_UNAVAILABLE' });
    expect(s.cart.itemCount).toBe(0);
  });

  it('flips a heart at once and back if the server refuses', () => {
    let s = savedSlice.reducer(undefined, setSavedAsync.pending('r', { productId: 'p_1', save: true }));
    expect(s.ids).toEqual(['p_1']);
    s = savedSlice.reducer(s, setSavedAsync.rejected(null, 'r', { productId: 'p_1', save: true }));
    expect(s.ids).toEqual([]);
  });
});
