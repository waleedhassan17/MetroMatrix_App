import { validateAddress } from '../addressModel';
import { appendUnique, hasMorePages } from '../pagingModel';
import { couponValueLabel, emptyCouponForm, normaliseCode, validateCouponForm } from '../shopping/couponFormModel';
import { activeFilterCount, DEFAULT_FILTERS, filterContextKey, toProductQuery, validatePriceRange } from '../shopping/filterModel';
import {
  COURIERS,
  eventLabel,
  groupHeadline,
  needsPayment,
  ORDER_STATUS,
  orderTimeline,
  partnerSegmentOf,
  PAYMENT_STATUS,
  RETURN_STATUS,
} from '../shopping/orderStatusModel';
import { normaliseTransactionId, validatePaymentProof } from '../shopping/paymentProofModel';
import { emptyProductForm, makeCover, movePhoto, salePreviewPercent, skuBaseFromName, syncVariants, validateProductForm } from '../shopping/productFormModel';
import { returnDaysLeft, validateReturn } from '../shopping/returnFormModel';
import { validateReview } from '../shopping/reviewFormModel';
import { brandContrast, validatePaymentAccount, validateStoreSettings } from '../shopping/storeModel';
import { buildMatrix, setAllStock, skuFor, totalStock } from '../shopping/variantMatrixModel';
import { pushTapUrl } from '../../notifications/push';
import { choose, initialChoice, isValueAvailable, stockNote, variantFor } from '../shopping/variantPickerModel';
import { ORDER_STATUSES, PAYMENT_STATUSES } from '../../serializers/shopping/orderSerializer';
import type { StoreSettings } from '../shopping';

describe('orderStatusModel', () => {
  it('has a label, a tone and a line of copy for every status', () => {
    for (const s of ORDER_STATUSES) expect(ORDER_STATUS[s]).toEqual(expect.objectContaining({ label: expect.any(String), tone: expect.any(String) }));
    for (const s of PAYMENT_STATUSES) expect(PAYMENT_STATUS[s].label.length).toBeGreaterThan(0);
    for (const meta of [...Object.values(ORDER_STATUS), ...Object.values(PAYMENT_STATUS), ...Object.values(RETURN_STATUS)]) {
      expect(meta.description.length).toBeGreaterThan(0);
      // Sentence case: only the first letter is a capital.
      expect(meta.label.slice(1)).toBe(meta.label.slice(1).toLowerCase());
    }
    expect(eventLabel('payment_confirmed')).toBe('Payment confirmed');
    expect(COURIERS.map(c => c.key)).toContain('own_rider');
  });

  it('heads a group with the payment the customer owes, then the least advanced order', () => {
    const o = (status: any, paymentStatus: any = 'cod_pending', paymentMethod: any = 'cod') => ({ status, paymentStatus, paymentMethod }) as any;
    expect(groupHeadline([o('shipped'), o('placed', 'awaiting_transfer', 'transfer')]).label).toBe('Payment needed');
    expect(groupHeadline([o('delivered'), o('shipped')]).label).toBe('Shipped');
    expect(groupHeadline([o('cancelled'), o('delivered')]).label).toBe('Delivered');
    expect(needsPayment(o('cancelled', 'awaiting_transfer', 'transfer'))).toBe(false);
  });

  it('draws the journey, with the courier on Shipped and a failed step on cancel', () => {
    const at = (type: string, h: number) => ({ type, note: null, createdAt: `2026-10-0${h}T10:00:00.000Z` }) as any;
    const fmt = (iso: string) => iso.slice(0, 10);
    const shipped = orderTimeline(
      {
        status: 'shipped',
        events: [at('placed', 1), at('confirmed', 2), at('packed', 3), at('shipped', 4)],
        shipment: { courier: 'tcs', courierName: 'TCS', trackingRef: 'TCS123' },
      },
      fmt,
    );
    expect(shipped.map(s => s.state)).toEqual(['done', 'done', 'done', 'current', 'upcoming']);
    expect(shipped[3].description).toBe('TCS · TCS123 · 2026-10-04');

    const cancelled = orderTimeline({ status: 'cancelled', events: [at('placed', 1), at('cancelled', 2)], shipment: null }, fmt);
    expect(cancelled.map(s => [s.label, s.state])).toEqual([
      ['Order placed', 'done'],
      ['Cancelled', 'failed'],
    ]);

    const delivered = orderTimeline({ status: 'delivered', events: [], shipment: null }, fmt);
    expect(delivered[4].state).toBe('done');
  });

  it('files partner orders in the API segments', () => {
    expect(partnerSegmentOf('cancellation_requested')).toBe('new');
    expect(partnerSegmentOf('packed')).toBe('to_ship');
    expect(partnerSegmentOf('returned')).toBe('done');
  });
});

describe('variant matrix', () => {
  it('builds option1 × option2 and keeps what was typed when options change', () => {
    const rows = buildMatrix(['S', 'M'], ['Black', 'Rust'], [], 'KUR-01');
    expect(rows.map(r => r.sku)).toEqual(['KUR-01-S-BLAC', 'KUR-01-S-RUST', 'KUR-01-M-BLAC', 'KUR-01-M-RUST']);
    const typed = rows.map((r, i) => ({ ...r, stock: String(i + 1) }));
    const grown = buildMatrix(['S', 'M', 'L'], ['Black', 'Rust'], typed, 'KUR-01');
    expect(grown).toHaveLength(6);
    expect(grown.slice(0, 4).map(r => r.stock)).toEqual(['1', '2', '3', '4']);
    expect(grown[4].stock).toBe('0');
    expect(totalStock(setAllStock(grown, 5))).toBe(30);
    expect(skuFor('', null, null)).toBe('SKU');
  });
});

describe('product form', () => {
  const ready = () => {
    const f = emptyProductForm();
    return {
      ...f,
      name: 'Teal silk dupatta',
      price: '2,500',
      categoryId: 'cat_w_dupattas',
      images: [{ url: 'https://example.com/a.jpg', publicId: 'a' }],
      variants: [{ ...f.variants[0], stock: '4' }],
    };
  };

  it('saves a half-done draft but publishes only a buyable product', () => {
    expect(validateProductForm({ ...emptyProductForm(), name: 'Draft' }, 'draft')).toEqual({});
    const blocked = validateProductForm({ ...emptyProductForm(), name: 'Draft' }, 'publish');
    expect(Object.keys(blocked).sort()).toEqual(['categoryId', 'images', 'price', 'variants']);
    expect(validateProductForm(ready(), 'publish')).toEqual({});
  });

  it('checks the sale price and duplicate SKUs', () => {
    expect(validateProductForm({ ...ready(), salePrice: '2500' }, 'draft').salePrice).toBe('The sale price must be below the price');
    expect(salePreviewPercent({ price: '2000', salePrice: '1500' })).toBe(25);
    const f = { ...ready(), hasOptions: true, option1Values: ['S', 'M'] };
    const rows = syncVariants(f).map(r => ({ ...r, sku: 'SAME' }));
    expect(validateProductForm({ ...f, variants: rows }, 'draft').variants).toBe('Each variant needs its own SKU');
  });

  it('reorders photos and sets the cover', () => {
    const imgs = ['a', 'b', 'c'].map(id => ({ url: id, publicId: id }));
    expect(movePhoto(imgs, 0, 1).map(i => i.url)).toEqual(['b', 'a', 'c']);
    expect(movePhoto(imgs, 0, -1).map(i => i.url)).toEqual(['a', 'b', 'c']);
    expect(makeCover(imgs, 2).map(i => i.url)).toEqual(['c', 'a', 'b']);
  });
});

describe('coupon form', () => {
  it('normalises codes and checks values and dates', () => {
    expect(normaliseCode(' eid-sale 25! ')).toBe('EIDSALE25');
    const f = { ...emptyCouponForm(), code: 'EID25', value: '95', startsAt: '2026-10-15' };
    expect(validateCouponForm(f).value).toBe('Up to 90% off');
    expect(validateCouponForm({ ...f, value: '25', endsAt: '2026-10-01' }).endsAt).toBe('The end date is before the start');
    expect(validateCouponForm({ ...f, value: '25' })).toEqual({});
    expect(couponValueLabel({ type: 'percent', value: 10, maxDiscount: 500 })).toContain('Rs 500');
  });
});

describe('returns, reviews and payment proof', () => {
  it('counts the return window in whole days', () => {
    const now = new Date('2026-10-15T10:00:00Z');
    expect(returnDaysLeft('2026-10-18T09:00:00Z', now)).toBe(3);
    expect(returnDaysLeft('2026-10-14T09:00:00Z', now)).toBeLessThan(0);
    expect(returnDaysLeft(null, now)).toBeNull();
  });

  it('limits a return to what was received', () => {
    const items = [{ id: 'oi_1', returnableQuantity: 1 }];
    const input = { reason: 'damaged' as const, details: 'The strap arrived torn.', photos: [], items: [{ orderItemId: 'oi_1', quantity: 2 }] };
    expect(validateReturn(input, items).items).toBeDefined();
    expect(validateReturn({ ...input, items: [{ orderItemId: 'oi_1', quantity: 1 }] }, items)).toEqual({});
  });

  it('needs ten characters or a photo for a review', () => {
    expect(validateReview({ rating: 5, title: null, body: 'Lovely', photos: [] }).body).toBeDefined();
    expect(validateReview({ rating: 5, title: null, body: '', photos: ['https://example.com/p.jpg'] })).toEqual({});
    expect(validateReview({ rating: 0, title: null, body: 'Lovely fabric, true to size.', photos: [] }).rating).toBeDefined();
  });

  it('accepts a transaction ID in any spacing or case', () => {
    expect(normaliseTransactionId(' rx 9988 7766 ')).toBe('RX99887766');
    expect(validatePaymentProof('rx 9988 7766')).toEqual({});
    expect(validatePaymentProof('12').transactionId).toBeDefined();
  });
});

describe('store settings and accounts', () => {
  const settings: StoreSettings = {
    shippingFee: 250,
    freeShippingOver: null,
    nationwide: false,
    deliveryCities: ['Lahore'],
    dispatchMinDays: 1,
    dispatchMaxDays: 3,
    returnWindowDays: 7,
    codEnabled: true,
    codLimit: 15000,
    isPaused: false,
    pauseMessage: null,
  };

  it('needs a payment account before cash on delivery goes off', () => {
    expect(validateStoreSettings(settings, { hasActiveAccount: false })).toEqual({});
    expect(validateStoreSettings({ ...settings, codEnabled: false }, { hasActiveAccount: false }).codEnabled).toBeDefined();
    expect(validateStoreSettings({ ...settings, deliveryCities: [] }, { hasActiveAccount: true }).deliveryCities).toBeDefined();
  });

  it('checks IBANs and wallet numbers', () => {
    const iban = { kind: 'bank' as const, title: 'Lawn and Loom', number: 'PK36 SCBL 0000 0011 2345 6702', bankName: 'Standard Chartered', isActive: true };
    expect(validatePaymentAccount(iban)).toEqual({});
    expect(validatePaymentAccount({ ...iban, number: 'PK36' }).number).toBeDefined();
    expect(validatePaymentAccount({ ...iban, kind: 'jazzcash', number: '0300-1234567', bankName: null })).toEqual({});
  });

  it('applies the AA test to brand colours', () => {
    expect(brandContrast('#7A1F3D', '#FFFFFF').passes).toBe(true);
    expect(brandContrast('#F5D90A', '#FFFFFF').passes).toBe(false);
    expect(brandContrast('red', '#FFFFFF').passes).toBe(false);
  });
});

describe('filters, addresses and paging', () => {
  it('counts active filters and builds the query', () => {
    const f = { ...DEFAULT_FILTERS, maxPrice: 5000, onSale: true, categoryId: 'cat_w' };
    expect(activeFilterCount(f)).toBe(3);
    expect(activeFilterCount(f, { ignoreCategory: true })).toBe(2);
    expect(toProductQuery({ storeId: 's_lawn' }, f)).toMatchObject({ storeId: 's_lawn', categoryId: 'cat_w', maxPrice: 5000, onSale: true });
    expect(validatePriceRange(5000, 1000).price).toBeDefined();
    expect(filterContextKey({ storeId: 's_lawn', q: 'Kurta' })).toBe('storeId:s_lawn|q:kurta');
    expect(filterContextKey({})).toBe('all');
  });

  it('validates an address', () => {
    const a = { label: 'home' as const, fullName: 'Ayesha Khan', phone: '+923001234567', city: 'Lahore', area: 'Gulberg III', line1: '12 Main Boulevard', landmark: null, lat: null, lng: null };
    expect(validateAddress(a)).toEqual({});
    expect(Object.keys(validateAddress({ ...a, phone: '123', line1: '' })).sort()).toEqual(['line1', 'phone']);
  });

  it('appends pages without duplicates and knows when to stop', () => {
    expect(appendUnique([{ id: 'a' }, { id: 'b' }], [{ id: 'b' }, { id: 'c' }]).map(r => r.id)).toEqual(['a', 'b', 'c']);
    expect(hasMorePages({ page: 1, pageSize: 20, total: 21 })).toBe(true);
    expect(hasMorePages({ page: 2, pageSize: 20, total: 40 })).toBe(false);
  });
});

describe('variant picker', () => {
  const v = (id: string, option1: string, option2: string, stock: number) => ({ id, option1, option2, sku: id, stock, price: 1000, compareAtPrice: null });
  const p = {
    option1: { name: 'Size', values: ['S', 'M', 'L'], swatches: {} },
    option2: { name: 'Colour', values: ['Black', 'Rust'], swatches: {} },
    variants: [v('a', 'S', 'Black', 0), v('b', 'S', 'Rust', 2), v('c', 'M', 'Black', 5), v('d', 'M', 'Rust', 0), v('e', 'L', 'Black', 0), v('f', 'L', 'Rust', 0)],
  };

  it('starts on the first variant in stock', () => {
    expect(initialChoice(p)).toEqual({ option1: 'S', option2: 'Rust' });
    expect(initialChoice(p, 'c')).toEqual({ option1: 'M', option2: 'Black' });
  });

  it('offers only buyable values, given the other choice', () => {
    expect(isValueAvailable(p, 1, 'L', { option1: null, option2: null })).toBe(false);
    expect(isValueAvailable(p, 2, 'Black', { option1: 'S', option2: null })).toBe(false);
    expect(isValueAvailable(p, 2, 'Black', { option1: 'M', option2: null })).toBe(true);
  });

  it('moves the other option when a choice would be sold out', () => {
    expect(choose(p, { option1: 'S', option2: 'Rust' }, 1, 'M')).toEqual({ option1: 'M', option2: 'Black' });
    expect(variantFor(p, { option1: 'M', option2: 'Black' })?.id).toBe('c');
    expect(stockNote(variantFor(p, { option1: 'S', option2: 'Rust' })).text).toBe('Only 2 left');
    expect(stockNote(null).tone).toBe('danger');
  });
});

describe('push taps', () => {
  it('opens the order for a customer and the store order or return for a store', () => {
    expect(pushTapUrl({ groupCode: 'MM-24A7Q2', orderId: 'o_1' }, 'customer')).toBe('metromatrix://orders/MM-24A7Q2');
    expect(pushTapUrl({ productId: 'p_1' }, 'customer')).toBe('metromatrix://shop/product/p_1');
    expect(pushTapUrl({ groupCode: 'MM-1', orderId: 'o_1' }, 'partner')).toBe('metromatrix://store/orders/o_1');
    expect(pushTapUrl({ returnId: 'rt_1', orderId: 'o_1' }, 'partner')).toBe('metromatrix://store/returns/rt_1');
    expect(pushTapUrl({}, 'customer')).toBeNull();
    expect(pushTapUrl(null, 'partner')).toBeNull();
  });
});

describe('SKU prefix', () => {
  it('comes from the name when the store sets none', () => {
    expect(skuBaseFromName('Braided leather watch strap')).toBe('BLWS');
    expect(skuBaseFromName('  ')).toBe('SKU');
  });
});
