// ═══════════════════════════════════════════════════════
// MetroMatrix — Design Gallery: the Shopping components
// ═══════════════════════════════════════════════════════
// Every Shopping component on demo values (local on purpose: nothing here is
// app data), and StoreBrandScope switching between three store colours.

import React, { useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { StoreBrandScope, useStyles, type Theme } from '@theme/index';
import {
  AppText,
  BarChart,
  Button,
  CartStoreGroup,
  CategoryTile,
  ChoiceChip,
  CountIconButton,
  FilterSheet,
  ImageGallery,
  LineChart,
  OrderTimeline,
  PaymentInstructionsCard,
  PaymentMethodPicker,
  PriceTag,
  ProductCard,
  ProductCardSkeleton,
  QuantityStepper,
  RatingBreakdown,
  Sparkline,
  Stars,
  StoreCard,
  VariantSheet,
} from '@custom/index';
import { DEFAULT_FILTERS, type ProductFilters } from '@models/shopping/filterModel';
import type { CartGroup, PaymentMethod, ProductDetail, ProductSummary, StoreSummary } from '@/types';
import { formatPKR } from '@utils/money';

const photo = (id: string) => `https://images.unsplash.com/photo-${id}`;

const PRODUCT: ProductSummary = {
  id: 'demo_1',
  storeId: 'demo_store',
  storeSlug: 'demo-store',
  storeName: 'Lawn & Loom',
  name: 'Rouge embroidered kurta set',
  imageUrl: photo('1733470381571-c3d082e68457'),
  price: 7190,
  compareAtPrice: 8990,
  rating: 4.6,
  ratingCount: 23,
  inStock: true,
  isNew: false,
};

const SOLD_OUT: ProductSummary = {
  ...PRODUCT,
  id: 'demo_2',
  name: 'Studded silver bag',
  imageUrl: photo('1559563458-527698bf5295'),
  price: 8990,
  compareAtPrice: null,
  inStock: false,
  ratingCount: 0,
};

const STORE: StoreSummary = {
  id: 'demo_store',
  slug: 'demo-store',
  name: 'Lawn & Loom',
  tagline: 'Hand-finished eastern wear from Lahore',
  about: 'Every kurta is cut in-house and embroidered by artisans we know by name.',
  categories: ['Kurtas & sets', 'Formals', 'Bags'],
  logoUrl: null,
  coverUrl: photo('1733470381591-c5dfb9df3c3d'),
  brandColor: '#7A1F3D',
  onBrandColor: '#FFFFFF',
  city: 'Lahore',
  rating: 4.7,
  ratingCount: 112,
  freeShippingOver: 6000,
  isFeatured: true,
  isPaused: false,
  productCount: 18,
};

const DETAIL: ProductDetail = {
  ...PRODUCT,
  description: '',
  images: [PRODUCT.imageUrl!, photo('1733470381591-c5dfb9df3c3d')],
  categoryId: 'cat',
  collectionId: null,
  option1: { name: 'Size', values: ['S', 'M', 'L'], swatches: {} },
  option2: { name: 'Colour', values: ['Rouge', 'Ink'], swatches: { Rouge: '#9F1239', Ink: '#1E293B' } },
  variants: [
    { id: 'v1', option1: 'S', option2: 'Rouge', sku: 'S-R', stock: 0, price: 7190, compareAtPrice: 8990 },
    { id: 'v2', option1: 'S', option2: 'Ink', sku: 'S-I', stock: 2, price: 7190, compareAtPrice: 8990 },
    { id: 'v3', option1: 'M', option2: 'Rouge', sku: 'M-R', stock: 6, price: 7190, compareAtPrice: 8990 },
    { id: 'v4', option1: 'M', option2: 'Ink', sku: 'M-I', stock: 0, price: 7190, compareAtPrice: 8990 },
    { id: 'v5', option1: 'L', option2: 'Rouge', sku: 'L-R', stock: 0, price: 7190, compareAtPrice: 8990 },
    { id: 'v6', option1: 'L', option2: 'Ink', sku: 'L-I', stock: 0, price: 7190, compareAtPrice: 8990 },
  ],
  lowStock: true,
  store: {
    ...STORE,
    about: '',
    socials: { instagram: null, facebook: null, tiktok: null, website: null },
    phone: null,
    whatsapp: null,
    pauseMessage: null,
    policies: {
      shippingFee: 250,
      freeShippingOver: 6000,
      nationwide: true,
      deliveryCities: [],
      dispatchMinDays: 2,
      dispatchMaxDays: 4,
      returnWindowDays: 7,
      codEnabled: true,
      codLimit: 15000,
      paymentMethods: ['cod', 'transfer'],
    },
    collections: [],
  },
  reviewSummary: { average: 4.6, count: 23, counts: [0, 1, 2, 6, 14], withPhotos: 4 },
  topReviews: [],
  related: [],
  wishlisted: false,
};

const GROUP: CartGroup = {
  store: { id: STORE.id, slug: STORE.slug, name: STORE.name, logoUrl: null, brandColor: STORE.brandColor, onBrandColor: STORE.onBrandColor, phone: null, whatsapp: null },
  isPaused: false,
  lines: [
    {
      id: 'l1', productId: 'demo_1', variantId: 'v3', name: PRODUCT.name, variantLabel: 'M / Rouge', imageUrl: PRODUCT.imageUrl,
      unitPrice: 6990, quantity: 1, lineTotal: 6990, available: 6,
      warnings: [{ code: 'PRICE_CHANGED', message: 'The price changed from Rs 7,190 to Rs 6,990.', lineId: 'l1', previousPrice: 7190, currentPrice: 6990, available: null }],
    },
    {
      id: 'l2', productId: 'demo_2', variantId: 'v9', name: SOLD_OUT.name, variantLabel: 'Silver', imageUrl: SOLD_OUT.imageUrl,
      unitPrice: 8990, quantity: 1, lineTotal: 8990, available: 0,
      warnings: [{ code: 'OUT_OF_STOCK', message: 'Sold out. Remove it to continue.', lineId: 'l2', previousPrice: null, currentPrice: null, available: 0 }],
    },
  ],
  subtotal: 6990,
  shippingFee: 250,
  freeShippingOver: 10000,
  toFreeShipping: 3010,
  warnings: [],
};

/** Five hours from when the gallery opens. */
const PAY_BY = new Date(Date.now() + 5 * 3600 * 1000).toISOString();

const WEEK = ['9 Oct', '10 Oct', '11 Oct', '12 Oct', '13 Oct', '14 Oct', '15 Oct'];
const SALES = [0, 7190, 4990, 0, 12500, 6390, 9480];

const BRANDS = [
  { label: 'Maroon', brand: '#7A1F3D', onBrand: '#FFFFFF' },
  { label: 'Near-black', brand: '#111827', onBrand: '#FFFFFF' },
  { label: 'Yellow', brand: '#F5D90A', onBrand: '#FFFFFF' },
];

const makeStyles = ({ space }: Theme) =>
  StyleSheet.create({
    section: { gap: space.s12, paddingTop: space.s16 },
    row: { flexDirection: 'row', flexWrap: 'wrap', gap: space.s8, alignItems: 'center' },
    grid: { flexDirection: 'row', gap: space.s12 },
    cell: { flex: 1 },
    rail: { gap: space.s12 },
  });

const Section: React.FC<{ title: string; children: React.ReactNode }> = ({ title, children }) => {
  const styles = useStyles(makeStyles);
  return (
    <View style={styles.section}>
      <AppText variant="micro" tone="muted">
        {title}
      </AppText>
      {children}
    </View>
  );
};

export const ShoppingStories: React.FC = () => {
  const styles = useStyles(makeStyles);
  const [brand, setBrand] = useState(BRANDS[0]);
  const [saved, setSaved] = useState(false);
  const [qty, setQty] = useState(1);
  const [method, setMethod] = useState<PaymentMethod>('cod');
  const [rating, setRating] = useState<number | null>(null);
  const [variantOpen, setVariantOpen] = useState(false);
  const [filterOpen, setFilterOpen] = useState(false);
  const [filters, setFilters] = useState<ProductFilters>(DEFAULT_FILTERS);

  return (
    <>
      <Section title="Shopping · cards">
        <View style={styles.grid}>
          <View style={styles.cell}>
            <ProductCard product={PRODUCT} onPress={() => undefined} saved={saved} onToggleSave={() => setSaved(s => !s)} />
          </View>
          <View style={styles.cell}>
            <ProductCard product={SOLD_OUT} onPress={() => undefined} onToggleSave={() => undefined} />
          </View>
        </View>
        <View style={styles.grid}>
          <View style={styles.cell}>
            <ProductCardSkeleton />
          </View>
          <View style={styles.cell}>
            <ProductCardSkeleton />
          </View>
        </View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.rail}>
          <StoreCard store={STORE} onPress={() => undefined} />
          <StoreCard store={{ ...STORE, id: 'b', name: 'Urban Thread', brandColor: '#111827', isFeatured: false, isPaused: true }} onPress={() => undefined} />
        </ScrollView>
        <StoreCard store={STORE} variant="row" onPress={() => undefined} />
      </Section>

      <Section title="Shopping · price, rating, controls">
        <PriceTag price={7190} compareAtPrice={8990} size="lg" />
        <PriceTag price={12500} size="md" />
        <View style={styles.row}>
          <Stars rating={4.5} size="md" />
          <CountIconButton icon="bag-outline" count={3} onPress={() => undefined} label="Bag" />
          <QuantityStepper value={qty} onChange={setQty} max={4} />
        </View>
        <View style={styles.row}>
          <ChoiceChip label="M" selected onPress={() => undefined} />
          <ChoiceChip label="L" onPress={() => undefined} />
          <ChoiceChip label="XL" disabled onPress={() => undefined} />
          <ChoiceChip label="Rouge" swatch="#9F1239" onPress={() => undefined} />
        </View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.rail}>
          <CategoryTile name="Kurtas & sets" icon="shirt-outline" onPress={() => undefined} />
          <CategoryTile name="Audio" icon="headset-outline" selected onPress={() => undefined} />
          <CategoryTile name="Bags" icon="bag-handle-outline" onPress={() => undefined} />
          <CategoryTile name="Unknown icon" icon="not-a-glyph" onPress={() => undefined} />
        </ScrollView>
        <RatingBreakdown summary={DETAIL.reviewSummary} selected={rating} onSelect={setRating} />
      </Section>

      <Section title="Shopping · Bag and payment">
        <CartStoreGroup group={GROUP} onQuantity={() => undefined} onRemove={() => undefined} onOpenStore={() => undefined} onOpenProduct={() => undefined} />
        <PaymentMethodPicker
          options={[
            { method: 'cod', available: true, reason: null },
            { method: 'transfer', available: false, reason: 'This store takes cash on delivery only.' },
          ]}
          value={method}
          onChange={setMethod}
        />
        <PaymentInstructionsCard
          instructions={{ kind: 'raast', accountTitle: 'Lawn and Loom', accountNumber: '03001112233', bankName: null, amount: 7440, payBy: PAY_BY }}
          status="proof_rejected"
          proof={{ transactionId: 'RX99887766', imageUrl: null, submittedAt: '2026-10-15T08:00:00Z', rejectionReason: 'No transfer with this ID reached our account.' }}
          onPaid={() => undefined}
        />
      </Section>

      <Section title="Shopping · order and charts">
        <OrderTimeline
          order={{
            status: 'shipped',
            shipment: { courier: 'tcs', courierName: 'TCS', trackingRef: 'TCS-778812' },
            events: [
              { type: 'placed', note: null, createdAt: '2026-10-12T09:10:00Z' },
              { type: 'confirmed', note: null, createdAt: '2026-10-12T11:40:00Z' },
              { type: 'packed', note: null, createdAt: '2026-10-13T08:05:00Z' },
              { type: 'shipped', note: null, createdAt: '2026-10-13T16:20:00Z' },
            ],
          }}
        />
        <AppText variant="title">{formatPKR(SALES.reduce((s, v) => s + v, 0))} recorded this week</AppText>
        <Sparkline values={SALES} accessibilityLabel="Recorded sales over the last 7 days" />
        <BarChart data={WEEK.map((label, i) => ({ label, value: [0, 2, 1, 0, 3, 1, 2][i] }))} />
        <LineChart data={WEEK.map((label, i) => ({ label, value: SALES[i] }))} format={formatPKR} />
      </Section>

      <Section title="Shopping · store colours (StoreBrandScope)">
        <View style={styles.row}>
          {BRANDS.map(b => (
            <ChoiceChip key={b.label} label={b.label} swatch={b.brand} selected={brand.label === b.label} onPress={() => setBrand(b)} />
          ))}
        </View>
        <StoreBrandScope brand={brand.brand} onBrand={brand.onBrand}>
          <ImageGallery images={DETAIL.images} title={DETAIL.name} badge="−20%" width={320} />
          <Button label="Add to bag" leftIcon="bag-add-outline" onPress={() => setVariantOpen(true)} fullWidth />
          <Button label="Sort and filter" variant="secondary" leftIcon="options-outline" onPress={() => setFilterOpen(true)} fullWidth />
          <View style={styles.row}>
            <ChoiceChip label="Selected" selected onPress={() => undefined} />
            <AppText variant="bodyStrong" tone="accentDeep">
              Brand-coloured text
            </AppText>
          </View>
          <VariantSheet product={DETAIL} visible={variantOpen} onClose={() => setVariantOpen(false)} onConfirm={() => setVariantOpen(false)} />
        </StoreBrandScope>
      </Section>

      <FilterSheet
        visible={filterOpen}
        onClose={() => setFilterOpen(false)}
        draft={filters}
        onChange={setFilters}
        resultCount={24}
        onApply={() => setFilterOpen(false)}
        onReset={() => setFilters(DEFAULT_FILTERS)}
      />
    </>
  );
};

export default ShoppingStories;
