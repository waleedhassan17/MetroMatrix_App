// ═══════════════════════════════════════════════════════
// MetroMatrix — A product
// ═══════════════════════════════════════════════════════
// Photos first, in the store's colours. Then what a buyer needs to decide:
// price and saving, the options in stock, how and when it arrives, what it
// is, and what other buyers said — and one way to act: Add to bag.

import React, { useEffect, useState } from 'react';
import { Pressable, ScrollView, Share, StyleSheet, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import Toast from 'react-native-toast-message';
import { useAppDispatch, useAppSelector } from '@hooks/useReduxHooks';
import { useBack } from '@hooks/useBack';
import { useSaved, useShopBootstrap, useShopNav } from '@hooks/useShop';
import { policyLines } from '@models/shopping/storePolicyModel';
import { stockNote } from '@models/shopping/variantPickerModel';
import { ServiceScope, StoreBrandScope, useStyles, useTheme, type Theme } from '@theme/index';
import {
  AppText,
  Button,
  Card,
  ChoiceChip,
  Divider,
  IconButton,
  ImageGallery,
  ImageViewer,
  InlineNotice,
  IonIcon,
  PriceTag,
  ProductCard,
  RatingBreakdown,
  Sheet,
  Skeleton,
  SkeletonLines,
  Stars,
  StickyCTA,
  StoreMark,
  TextField,
  VariantSheet,
} from '@custom/index';
import { ReviewItem } from '@components/shopping/ReviewItem';
import { SectionError, ShopSection, ShopTopBar } from '@components/shopping/ShopParts';
import type { ProductDetail, ShopBrowseParamList } from '@/types';
import { haptics } from '@utils/haptics';
import { discountPercent } from '@utils/money';
import { addToBagAsync, selectBag } from '../Bag/bagSlice';
import {
  REPORT_REASONS,
  closeReport,
  closeVariantSheet,
  loadProductAsync,
  openReport,
  openVariantSheet,
  reportProductAsync,
  selectProductEntry,
  selectReport,
  selectVariantSheetFor,
  setReportDetails,
  setReportReason,
} from './productDetailSlice';

type Props = NativeStackScreenProps<ShopBrowseParamList, 'ProductDetail'>;

const makeStyles = ({ colors, space, size, gutter }: Theme) =>
  StyleSheet.create({
    root: { flex: 1, backgroundColor: colors.canvas },
    content: { paddingBottom: space.s40, gap: space.s24 },
    body: { paddingHorizontal: gutter, gap: space.s12 },
    store: { flexDirection: 'row', alignItems: 'center', gap: space.s8, minHeight: size.touch, alignSelf: 'flex-start' },
    rating: { flexDirection: 'row', alignItems: 'center', gap: space.s8, minHeight: size.touch, alignSelf: 'flex-start' },
    options: { gap: space.s8 },
    chips: { flexDirection: 'row', flexWrap: 'wrap', gap: space.s8 },
    policy: { flexDirection: 'row', alignItems: 'center', gap: space.s12 },
    rail: { paddingHorizontal: gutter, gap: space.s12 },
    report: { alignSelf: 'center', minHeight: size.touch, justifyContent: 'center' },
    skeleton: { gap: space.s16 },
    skeletonPad: { paddingHorizontal: gutter, gap: space.s12 },
  });

const ProductDetailScreen: React.FC<Props> = props => {
  const entry = useAppSelector(s => selectProductEntry(s, props.route.params.id));
  const store = entry.product?.store;
  return (
    <ServiceScope service="shopping">
      <StoreBrandScope brand={store?.brandColor} onBrand={store?.onBrandColor}>
        <ProductDetailContent {...props} />
      </StoreBrandScope>
    </ServiceScope>
  );
};

const OptionsPreview: React.FC<{ product: ProductDetail; onOpen: () => void }> = ({ product, onOpen }) => {
  const styles = useStyles(makeStyles);
  const options = [product.option1, product.option2].filter(Boolean) as NonNullable<ProductDetail['option1']>[];
  if (!options.length) return null;
  return (
    <View style={styles.options}>
      {options.map(o => (
        <View key={o.name} style={styles.options}>
          <AppText variant="label">
            {o.name} · {o.values.length} {o.values.length === 1 ? 'option' : 'options'}
          </AppText>
          <View style={styles.chips}>
            {o.values.map(v => {
              const any = product.variants.some(x => (o === product.option1 ? x.option1 : x.option2) === v && x.stock > 0);
              return <ChoiceChip key={v} label={v} swatch={o.swatches[v]} disabled={!any} onPress={onOpen} />;
            })}
          </View>
        </View>
      ))}
    </View>
  );
};

const ProductDetailContent: React.FC<Props> = ({ navigation, route }) => {
  const { back } = useBack({ name: 'ShoppingHome' });
  const dispatch = useAppDispatch();
  const styles = useStyles(makeStyles);
  const { service, size, opacity } = useTheme();
  const { id } = route.params;
  const e = useAppSelector(s => selectProductEntry(s, id));
  const sheetFor = useAppSelector(selectVariantSheetFor);
  const report = useAppSelector(selectReport);
  const bag = useAppSelector(selectBag);
  const nav = useShopNav();
  const saved = useSaved();
  const [aboutOpen, setAboutOpen] = useState(false);
  const [photo, setPhoto] = useState<string | null>(null);
  useShopBootstrap();

  useEffect(() => {
    void dispatch(loadProductAsync(id));
  }, [dispatch, id]);

  const p = e.product;

  const add = async (variantId: string, quantity: number) => {
    const r = await dispatch(addToBagAsync({ variantId, quantity }));
    if (addToBagAsync.fulfilled.match(r)) {
      haptics.success();
      dispatch(closeVariantSheet());
      Toast.show({ type: 'success', text1: 'Added to your bag', text2: 'Tap to view your bag.', onPress: () => { Toast.hide(); nav.openBag(); } });
    } else {
      haptics.warning();
      Toast.show({ type: 'error', text1: "Couldn't add it", text2: (r.payload as { message?: string } | undefined)?.message ?? 'Try again.' });
    }
  };

  const share = () => {
    if (!p) return;
    void Share.share({ message: `${p.name} from ${p.store.name}, on MetroMatrix: metromatrix://shop/product/${p.id}` });
  };

  const sendReport = async () => {
    if (!p || !report.reason) return;
    const r = await dispatch(reportProductAsync({ id: p.id, reason: report.reason, details: report.details }));
    if (reportProductAsync.fulfilled.match(r)) {
      Toast.show({ type: 'success', text1: 'Thanks for telling us', text2: 'MetroMatrix will review this product.' });
    }
  };

  const right = p ? (
    <>
      <IconButton icon="share-outline" onPress={share} accessibilityLabel="Share" />
      <IconButton
        icon={saved.isSaved(p.id) ? 'heart' : 'heart-outline'}
        onPress={() => void saved.toggle(p.id)}
        accessibilityLabel={saved.isSaved(p.id) ? 'Remove from Saved' : 'Save'}
      />
    </>
  ) : null;

  if (!p) {
    return (
      <View style={styles.root}>
        <ShopTopBar onBack={back} />
        {e.status === 'failed' ? (
          <SectionError message={e.error.message} onRetry={() => void dispatch(loadProductAsync(id))} />
        ) : (
          <View style={styles.skeleton}>
            <Skeleton height={size.storeCard} shape="sm" />
            <View style={styles.skeletonPad}>
              <SkeletonLines lines={5} />
            </View>
          </View>
        )}
      </View>
    );
  }

  const off = discountPercent(p.price, p.compareAtPrice);
  const inStock = p.variants.some(v => v.stock > 0);
  const lowest = p.variants.filter(v => v.stock > 0).sort((a, b) => a.stock - b.stock)[0] ?? null;
  const note = inStock ? (p.lowStock ? stockNote(lowest) : null) : stockNote(null);
  const paused = p.store.isPaused;

  return (
    <View style={styles.root}>
      <ShopTopBar onBack={back} right={right} />
      <ScrollView contentContainerStyle={styles.content}>
        <ImageGallery images={p.images} title={p.name} badge={off ? `−${off}%` : null} />

        <View style={styles.body}>
          <Pressable
            onPress={() => nav.openStore(p.store.slug, p.store.name)}
            style={({ pressed }) => [styles.store, pressed && { opacity: opacity.pressed }]}
            accessibilityRole="link"
            accessibilityLabel={`Sold by ${p.store.name}. Visit the store`}>
            <StoreMark store={p.store} small />
            <AppText variant="small" tone="accentDeep">
              {p.store.name}
            </AppText>
            <IonIcon name="chevron-forward" size="sm" color={service.accentDeep} />
          </Pressable>
          <AppText variant="h1" accessibilityRole="header">
            {p.name}
          </AppText>
          {p.reviewSummary.count ? (
            <Pressable
              onPress={() => navigation.push('ProductReviews', { productId: p.id, name: p.name })}
              style={styles.rating}
              accessibilityRole="link"
              accessibilityLabel={`Rated ${p.reviewSummary.average.toFixed(1)} from ${p.reviewSummary.count} reviews. Read them`}>
              <Stars rating={p.reviewSummary.average} />
              <AppText variant="small" tone="muted">
                {p.reviewSummary.average.toFixed(1)} · {p.reviewSummary.count} {p.reviewSummary.count === 1 ? 'review' : 'reviews'}
              </AppText>
            </Pressable>
          ) : null}
          <PriceTag price={p.price} compareAtPrice={p.compareAtPrice} size="lg" />
          {note ? (
            <AppText variant="small" tone={note.tone}>
              {note.text}
            </AppText>
          ) : null}
        </View>

        <View style={styles.body}>
          <OptionsPreview product={p} onOpen={() => dispatch(openVariantSheet(p.id))} />
        </View>

        <View style={styles.body}>
          {paused ? (
            <InlineNotice
              tone="warning"
              title={`${p.store.name} is taking a break`}
              message={p.store.pauseMessage ?? "You can't order from this store right now."}
            />
          ) : null}
          <Card>
            {policyLines(p.store.policies).map(l => (
              <View key={l.icon} style={styles.policy}>
                <IonIcon name={l.icon} size="md" color={service.accentDeep} />
                <AppText variant="small">{l.text}</AppText>
              </View>
            ))}
          </Card>
        </View>

        {p.description ? (
          <View style={styles.body}>
            <AppText variant="h2">About this product</AppText>
            <AppText variant="body" tone="muted" numberOfLines={aboutOpen ? undefined : 4}>
              {p.description}
            </AppText>
            {p.description.length > 180 ? (
              <Pressable onPress={() => setAboutOpen(o => !o)} accessibilityRole="button" style={styles.rating}>
                <AppText variant="small" tone="accentDeep">
                  {aboutOpen ? 'Show less' : 'Read more'}
                </AppText>
              </Pressable>
            ) : null}
          </View>
        ) : null}

        <View style={styles.body}>
          <AppText variant="h2">Reviews</AppText>
          {p.reviewSummary.count ? (
            <>
              <RatingBreakdown summary={p.reviewSummary} />
              {p.topReviews.map((r, i) => (
                <View key={r.id}>
                  {i > 0 ? <Divider /> : null}
                  <ReviewItem review={r} storeName={p.store.name} onPhoto={setPhoto} />
                </View>
              ))}
              <Button
                label={`See all ${p.reviewSummary.count} reviews`}
                variant="secondary"
                onPress={() => navigation.push('ProductReviews', { productId: p.id, name: p.name })}
                fullWidth
              />
            </>
          ) : (
            <AppText variant="body" tone="muted">
              No reviews yet. Buyers can review it once it’s delivered.
            </AppText>
          )}
        </View>

        {p.related.length ? (
          <View style={styles.options}>
            <ShopSection title="You may also like" />
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.rail}>
              {p.related.map(r => (
                <ProductCard
                  key={r.id}
                  product={r}
                  width={size.railCard}
                  onPress={() => nav.openProduct(r.id, r.name)}
                  saved={saved.isSaved(r.id)}
                  onToggleSave={() => void saved.toggle(r.id)}
                />
              ))}
            </ScrollView>
          </View>
        ) : null}

        <Pressable onPress={() => dispatch(openReport(p.id))} style={styles.report} accessibilityRole="button">
          <AppText variant="small" tone="muted">
            Report this product
          </AppText>
        </Pressable>
      </ScrollView>

      <StickyCTA>
        <Button
          label={paused ? 'Store is taking a break' : inStock ? 'Add to bag' : 'Sold out'}
          leftIcon={inStock && !paused ? 'bag-add-outline' : undefined}
          onPress={() => dispatch(openVariantSheet(p.id))}
          disabled={!inStock || paused}
          fullWidth
        />
      </StickyCTA>

      <VariantSheet
        product={p}
        visible={sheetFor === p.id}
        onClose={() => dispatch(closeVariantSheet())}
        onConfirm={(variantId, qty) => void add(variantId, qty)}
        busy={bag.adding}
      />

      <Sheet
        visible={report.productId === p.id}
        onClose={() => dispatch(closeReport())}
        title="Report this product"
        subtitle="MetroMatrix reviews every report. The store isn't told who sent it."
        footer={
          <Button
            label="Send report"
            variant="destructive"
            onPress={() => void sendReport()}
            disabled={!report.reason}
            loading={report.status === 'loading'}
            fullWidth
          />
        }>
        <View style={styles.chips}>
          {REPORT_REASONS.map(r => (
            <ChoiceChip key={r} label={r} selected={report.reason === r} onPress={() => dispatch(setReportReason(r))} />
          ))}
        </View>
        <TextField
          label="Anything to add (optional)"
          value={report.details}
          onChangeText={t => dispatch(setReportDetails(t))}
          multiline
          maxLength={500}
        />
        {report.error.message ? <InlineNotice message={report.error.message} /> : null}
      </Sheet>

      <ImageViewer visible={!!photo} uri={photo} title="Review photo" onClose={() => setPhoto(null)} />
    </View>
  );
};

export default ProductDetailScreen;
