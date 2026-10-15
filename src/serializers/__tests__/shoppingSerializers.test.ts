// Every shopping serializer: the dummy API's real payloads map cleanly, and
// malformed ones (wrong types, missing ids, junk) never throw or leak through.

import * as admin from '../shopping/adminShopSerializer';
import * as cart from '../shopping/cartSerializer';
import * as catalog from '../shopping/catalogSerializer';
import * as orders from '../shopping/orderSerializer';
import * as partner from '../shopping/partnerSerializer';
import { paged, storeRefSerializer } from '../shopping/common';
import { addressSerializer } from '../addressSerializer';
import { notificationSerializer } from '../notificationSerializer';
import { seedShop } from '../../networks/network/mock/shop/shopSeed';
import {
  cartView,
  groupView,
  productDetailView,
  productSummaryView,
  storeDetailView,
} from '../../networks/network/mock/shop/shopLogic';

const JUNK: unknown[] = [null, undefined, 0, 42, '', 'text', true, [], [1, 2], {}, { id: 7 }, { id: '' }, { items: 'nope' }];

const ALL = { ...admin, ...cart, ...catalog, ...orders, ...partner, addressSerializer, notificationSerializer } as Record<string, unknown>;
const serializers = Object.entries(ALL).filter(
  (e): e is [string, (raw: unknown) => unknown] => typeof e[1] === 'function' && e[0].endsWith('Serializer'),
);

describe('malformed payloads', () => {
  it.each(serializers.map(([name, fn]) => [name, fn] as const))('%s never throws', (_name, fn) => {
    for (const raw of JUNK) expect(() => fn(raw)).not.toThrow();
  });

  it('drops records without an id instead of inventing one', () => {
    expect(catalog.productSummarySerializer({ name: 'No id' })).toBeNull();
    expect(orders.storeOrderSerializer({ id: 'o1' })).toBeNull(); // no store
    expect(orders.orderGroupSerializer({ code: 'MM-1', orders: [] })).toBeNull();
    expect(addressSerializer({ id: 'a1' })).toBeNull();
  });

  it('coerces amounts to integer rupees and rejects bad colours and statuses', () => {
    const p = catalog.productSummarySerializer({ id: 'p', name: 'Kurta', price: '2490.6', compareAtPrice: 1000, rating: 9 })!;
    expect(p.price).toBe(2491);
    expect(p.compareAtPrice).toBeNull(); // not above the price
    expect(p.rating).toBe(5);

    const ref = storeRefSerializer({ id: 's', brandColor: 'tomato', onBrandColor: '#fff' })!;
    expect(ref.brandColor).toMatch(/^#[0-9A-F]{6}$/i);
    expect(ref.onBrandColor).toMatch(/^#[0-9A-F]{6}$/i);

    const o = orders.storeOrderSerializer({ id: 'o', store: { id: 's' }, status: 'teleported', paymentStatus: 42, items: [{ id: 'i', quantity: -3 }] })!;
    expect(o.status).toBe('placed');
    expect(o.paymentStatus).toBe('cod_pending');
    expect(o.items[0].quantity).toBe(1);
  });

  it('reads pages, bare arrays and nonsense alike', () => {
    expect(paged({ items: [{ id: 'p', name: 'A' }, { bad: 1 }], total: '7', page: 2, pageSize: 1 }, catalog.productSummarySerializer)).toMatchObject({
      total: 7,
      page: 2,
      pageSize: 1,
    });
    expect(paged([{ id: 'p', name: 'A' }], catalog.productSummarySerializer).items).toHaveLength(1);
    expect(paged('nope', catalog.productSummarySerializer)).toEqual({ items: [], total: 0, page: 1, pageSize: 20 });
    expect(cart.cartSerializer(null)).toEqual(cart.EMPTY_CART);
  });
});

describe('the dummy API payloads', () => {
  const shop = seedShop();
  const json = <T,>(v: T): unknown => JSON.parse(JSON.stringify(v));

  it('map a product, its variants and its store', () => {
    const p = shop.products.find(x => x.id === 'p_l3')!;
    const detail = catalog.productDetailSerializer(json(productDetailView(shop, p, 'u_customer')))!;
    expect(detail.variants).toHaveLength(p.variants.length);
    expect(detail.option2?.swatches.Plum).toBe('#5B2A6E');
    expect(catalog.productSummarySerializer(json(productSummaryView(shop, p)))?.storeName).toBe('Lawn & Loom');
    const store = catalog.storeDetailSerializer(json(storeDetailView(shop, shop.stores[1])))!;
    expect(store.brandColor).toBe('#111827');
    expect(store.collections.length).toBeGreaterThan(0);
  });

  it('map every seeded order group', () => {
    for (const g of shop.groups) {
      const group = orders.orderGroupSerializer(json(groupView(shop, g)));
      expect(group?.code).toBe(g.code);
      expect(group!.total).toBe(group!.orders.reduce((s, o) => s + o.total, 0));
    }
  });

  it('map a bag', () => {
    const line = { id: 'cl_1', userId: 'u_customer', productId: 'p_l1', variantId: 'p_l1_v0', quantity: 1, priceSeen: 1, addedAt: new Date().toISOString() };
    shop.cart.push(line);
    const bag = cart.cartSerializer(json(cartView(shop, 'u_customer')));
    expect(bag.groups[0].lines[0].warnings[0].code).toBe('PRICE_CHANGED');
    expect(bag.blocking).toBe(true);
  });
});
