// ═══════════════════════════════════════════════════════
// MetroMatrix — A product
// ═══════════════════════════════════════════════════════
// The FYP's product page, in the store's colours: the photos full bleed under
// white circles (back; share, the heart, the Bag), then what a buyer needs
// to decide: the store, the name, the rating, the price and the one saving,
// the sizes and colours to choose right here, and when it ships, what
// delivery costs and the returns. Description and reviews sit in tabs. The
// bar at the foot keeps the price in view and adds the chosen size and
// colour to the Bag in one tap. Once the photos scroll away the white bar
// with the store's rule takes over from the circles.

import React, { useEffect, useState } from 'react';
import { Pressable, ScrollView, Share, StyleSheet, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import Toast from 'react-native-toast-message';
import { useAppDispatch, useAppSelector } from '../../hooks/useReduxHooks';
import { useBack } from '../../hooks/useBack';
import { useSaved, useShopBootstrap, useShopNav } from '../../hooks/useShop';
import { policyHighlights } from '../../models/shopping/storePolicyModel';
import { choose, initialChoice, stockNote, variantFor, type VariantChoice } from '../../models/shopping/variantPickerModel';
import { ServiceScope, StoreBrandScope, useStyles, useTheme, type Theme } from '../../theme/index';
import {
  AppText,
  Button,
  ChoiceChip,
  CtaBar,
  Divider,
  EmptyState,
  IconButton,
  ImageGallery,
  ImageViewer,
  InlineNotice,
  IonIcon,
  PhotoScrim,
  PriceTag,
  ProductCard,
  ProductDetailSkeleton,
  QuantityStepper,
  RatingBreakdown,
  SegmentTabs,
  Sheet,
  Stars,
  StickyCTA,
  StoreMark,
  TextField,
  VariantOptions,
} from '../../Custom-Components/index';
import { ReviewItem } from '../../Components/shopping/ReviewItem';
import { PhotoTopBar, PolicyStrip, SectionError, ShopSection, ShopTopBar } from '../../Components/shopping/ShopParts';
import type { ProductDetail, ShopBrowseParamList } from '../../models';
import { haptics } from '../../utils/haptics/haptics';
import { addToBagAsync, selectBag } from '../bag-screen/bagSlice';
import {
  REPORT_REASONS,
  closeReport,
  loadProductAsync,
  openReport,
  reportProductAsync,
  selectProductEntry,
  selectReport,
  setReportDetails,
  setReportReason,
} from './productDetailSlice';

type Props = NativeStackScreenProps<ShopBrowseParamList, 'ProductDetail'>;

const makeStyles = ({ colors, space, size, gutter }: Theme) =>
  StyleSheet.create({
    root: { flex: 1, backgroundColor: colors.canvas },
    content: { paddingBottom: space.s40, gap: space.s24 },
    body: { paddingHorizontal: gutter, gap: space.s12 },
    facts: { paddingHorizontal: gutter, paddingTop: space.s20, gap: space.s8 },
    store: { flexDirection: 'row', alignItems: 'center', gap: space.s8, minHeight: size.touch, alignSelf: 'flex-start' },
    rating: { flexDirection: 'row', alignItems: 'center', gap: space.s8, minHeight: size.touch, alignSelf: 'flex-start' },
    qty: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    chips: { flexDirection: 'row', flexWrap: 'wrap', gap: space.s8 },
    rail: { paddingHorizontal: gutter, paddingBottom: space.s4, gap: space.s12 },
    group: { gap: space.s12 },
    report: { alignSelf: 'center', minHeight: size.touch, justifyContent: 'center' },
    fade: { position: 'absolute', top: space.s0, left: space.s0, right: space.s0 },
    bar: { position: 'absolute', top: space.s0, left: space.s0, right: space.s0 },
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

type Tab = 'about' | 'reviews';

const ProductDetailContent: React.FC<Props> = props => {
  const { back } = useBack({ name: 'ShoppingHome' });
  const dispatch = useAppDispatch();
  const styles = useStyles(makeStyles);
  const { id } = props.route.params;
  const e = useAppSelector(s => selectProductEntry(s, id));
  useShopBootstrap();

  useEffect(() => {
    void dispatch(loadProductAsync(id));
  }, [dispatch, id]);

  if (!e.product) {
    return (
      <View style={styles.root}>
        <ShopTopBar onBack={back} />
        {e.status === 'failed' ? (
          <SectionError message={e.error.message} onRetry={() => void dispatch(loadProductAsync(id))} />
        ) : (
          <ProductDetailSkeleton />
        )}
      </View>
    );
  }
  // Keyed by product: a related product pushed over this one starts its own choice.
  return <ProductBody key={e.product.id} {...props} product={e.product} back={back} />;
};

const ProductBody: React.FC<Props & { product: ProductDetail; back: () => void }> = ({ navigation, product: p, back }) => {
  const dispatch = useAppDispatch();
  const styles = useStyles(makeStyles);
  const { service, size, opacity, space } = useTheme();
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const report = useAppSelector(selectReport);
  const bag = useAppSelector(selectBag);
  const nav = useShopNav();
  const saved = useSaved();
  const [photo, setPhoto] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>('about');
  // The choice is the page's own (as the sheet's was): the first size and colour in stock.
  const [choice, setChoice] = useState<VariantChoice>(() => initialChoice(p));
  const [quantity, setQuantity] = useState(1);
  // The photos have scrolled away: the white bar takes over from the circles.
  const [pastPhotos, setPastPhotos] = useState(false);

  const variant = variantFor(p, choice);
  const stock = variant?.stock ?? 0;
  const qty = Math.min(quantity, Math.max(1, stock));
  const price = variant?.price ?? p.price;
  const was = variant?.compareAtPrice ?? p.compareAtPrice;
  const note = stockNote(variant);
  const paused = p.store.isPaused;
  const canAdd = !!variant && stock > 0 && !paused;
  const handOver = width / size.productPhotoAspect - insets.top - size.headerBar;

  const add = async () => {
    if (!variant) return;
    const r = await dispatch(addToBagAsync({ variantId: variant.id, quantity: qty }));
    if (addToBagAsync.fulfilled.match(r)) {
      haptics.success();
      Toast.show({ type: 'success', text1: 'Added to your bag', text2: 'Tap to view your bag.', onPress: () => { Toast.hide(); nav.openBag(); } });
    } else {
      haptics.warning();
      Toast.show({ type: 'error', text1: "Couldn't add it", text2: (r.payload as { message?: string } | undefined)?.message ?? 'Try again.' });
    }
  };

  const share = () => {
    void Share.share({ message: `${p.name} from ${p.store.name}, on MetroMatrix: metromatrix://shop/product/${p.id}` });
  };

  const sendReport = async () => {
    if (!report.reason) return;
    const r = await dispatch(reportProductAsync({ id: p.id, reason: report.reason, details: report.details }));
    if (reportProductAsync.fulfilled.match(r)) {
      Toast.show({ type: 'success', text1: 'Thanks for telling us', text2: 'MetroMatrix will review this product.' });
    }
  };

  const isSaved = saved.isSaved(p.id);
  const actions = (appearance: 'circle' | undefined) => (
    <>
      <IconButton icon="share-outline" appearance={appearance} onPress={share} accessibilityLabel="Share" />
      <IconButton
        icon={isSaved ? 'heart' : 'heart-outline'}
        appearance={appearance}
        onPress={() => void saved.toggle(p.id)}
        accessibilityLabel={isSaved ? 'Remove from Saved' : 'Save'}
      />
    </>
  );
  const openReviews = () => navigation.push('ProductReviews', { productId: p.id, name: p.name });
  const reviews = p.reviewSummary.count;

  return (
    <View style={styles.root}>
      <ScrollView
        contentContainerStyle={styles.content}
        onScroll={ev => setPastPhotos(ev.nativeEvent.contentOffset.y > handOver)}
        scrollEventThrottle={32}>
        <View>
          <ImageGallery images={p.images} title={p.name} />
          <View style={[styles.fade, { height: insets.top + size.headerWell + space.s24 }]} pointerEvents="none">
            <PhotoScrim edge="top" />
          </View>
        </View>

        <View style={styles.facts}>
          <Pressable
            onPress={() => nav.openStore(p.store.slug, p.store.name)}
            style={({ pressed }) => [styles.store, pressed && { opacity: opacity.pressed }]}
            accessibilityRole="link"
            accessibilityLabel={`Sold by ${p.store.name}. Visit the store`}>
            <StoreMark store={p.store} size="sm" />
            <AppText variant="overline" tone="accentDeep">
              {p.store.name}
            </AppText>
            <IonIcon name="chevron-forward" size="sm" color={service.accentDeep} />
          </Pressable>
          <AppText variant="cardTitle" accessibilityRole="header">
            {p.name}
          </AppText>
          {reviews ? (
            <Pressable
              onPress={openReviews}
              style={styles.rating}
              accessibilityRole="link"
              accessibilityLabel={`Rated ${p.reviewSummary.average.toFixed(1)} from ${reviews} reviews. Read them`}>
              <Stars rating={p.reviewSummary.average} />
              <AppText variant="small" tone="muted">
                {p.reviewSummary.average.toFixed(1)} · {reviews} {reviews === 1 ? 'review' : 'reviews'}
              </AppText>
            </Pressable>
          ) : null}
          <PriceTag price={price} compareAtPrice={was} size="lg" />
          {note.tone !== 'muted' ? (
            <AppText variant="small" tone={note.tone}>
              {note.text}
            </AppText>
          ) : null}
        </View>

        {p.option1 || p.option2 || stock > 1 ? (
          <View style={styles.body}>
            <VariantOptions product={p} choice={choice} onChoose={(which, value) => setChoice(c => choose(p, c, which, value))} />
            {stock > 0 ? (
              <View style={styles.qty}>
                <AppText variant="label">Quantity</AppText>
                <QuantityStepper value={qty} onChange={setQuantity} max={Math.max(1, stock)} label={`Quantity of ${p.name}`} />
              </View>
            ) : null}
          </View>
        ) : null}

        <View style={styles.body}>
          {paused ? (
            <InlineNotice
              tone="warning"
              title={`${p.store.name} is taking a break`}
              message={p.store.pauseMessage ?? "You can't order from this store right now."}
            />
          ) : null}
          <PolicyStrip lines={policyHighlights(p.store.policies)} />
        </View>

        <View style={styles.body}>
          <SegmentTabs<Tab>
            options={[
              { key: 'about', label: 'Description' },
              { key: 'reviews', label: reviews ? `Reviews (${reviews})` : 'Reviews' },
            ]}
            value={tab}
            onChange={setTab}
            accessibilityLabel="About this product"
          />
          {tab === 'about' ? (
            <AppText variant="body" tone="muted">
              {p.description || `${p.store.name} hasn't added a description yet.`}
            </AppText>
          ) : reviews ? (
            <View style={styles.group}>
              <RatingBreakdown summary={p.reviewSummary} />
              {p.topReviews.map((r, i) => (
                <View key={r.id}>
                  {i > 0 ? <Divider /> : null}
                  <ReviewItem review={r} storeName={p.store.name} onPhoto={setPhoto} />
                </View>
              ))}
              <Button label={`See all ${reviews} reviews`} variant="secondary" onPress={openReviews} fullWidth />
            </View>
          ) : (
            <EmptyState ion="chatbubble-ellipses-outline" title="No reviews yet" body="Buyers can review it once it's delivered." />
          )}
        </View>

        {p.related.length ? (
          <View style={styles.group}>
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

      {pastPhotos ? (
        <View style={styles.bar}>
          <ShopTopBar title={p.name} onBack={back} right={actions(undefined)} />
        </View>
      ) : (
        <PhotoTopBar onBack={back} right={actions('circle')} />
      )}

      <StickyCTA>
        <CtaBar
          label={qty > 1 ? `Total for ${qty}` : 'Price'}
          amount={price * qty}
          compareAt={was && was > price ? was * qty : null}
          action={{
            label: paused ? 'Taking a break' : stock > 0 ? 'Add to bag' : 'Sold out',
            leftIcon: canAdd ? 'bag-add-outline' : undefined,
            onPress: () => void add(),
            disabled: !canAdd,
            loading: bag.adding,
          }}
        />
      </StickyCTA>

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
