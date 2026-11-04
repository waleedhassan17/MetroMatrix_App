// ═══════════════════════════════════════════════════════
// MetroMatrix — Food Court: a vendor's page
// ═══════════════════════════════════════════════════════
// The kitchen's food photo under floating circles (the white bar takes over
// once it scrolls away), its mark and name in its own colour
// (StoreBrandScope on Food), the facts strip (time, fee, minimum), ONE
// notice, its deals, "Popular here", what else it offers (tiffins, dawat,
// Ramadan), then the menu by category with tabs that follow the scroll and
// stay under the bar. Reviews and the kitchen's story come after the menu.
// A dish opens its sheet. The fee is the vendor's own: MetroMatrix takes nothing.

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Linking, Pressable, ScrollView, SectionList, StyleSheet, View, useWindowDimensions, type LayoutChangeEvent, type NativeScrollEvent, type NativeSyntheticEvent, type ViewToken } from 'react-native';
import { Image } from 'expo-image';
import { useFocusEffect } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Toast from 'react-native-toast-message';
import { useAppDispatch, useAppSelector } from '../../hooks/useReduxHooks';
import { lineInput } from '../../models/food/bagModel';
import { useBack } from '../../hooks/useBack';
import { categoryWindowLabel } from '../../models/food/menuModel';
import { cuisineLine, feeLabel, ratingLabel, vendorFacts } from '../../models/food/discoveryModel';
import { customerTrustLine } from '../../models/food/trustModel';
import { ServiceScope, StoreBrandScope, useStyles, useTheme, type Theme } from '../../theme/index';
import { AppText, BadgeRow, Button, Card, ChoiceChip, CountIconButton, Divider, EmptyState, IconButton, IonIcon, InlineNotice, ListRow, PhotoScrim, SectionCard, Sheet, TextAction, TiffinPlanCard, storeInitials } from '../../Custom-Components/index';
import { VendorPageSkeleton } from '../../Custom-Components/food/FoodSkeletons';
import { DealRail, DishRail, FoodSection, TrustNote, type DishTileData } from '../../Components/food/FoodParts';
import { PhotoTopBar, PolicyStrip, ShopSection } from '../../Components/shopping/ShopParts';
import { planCardData } from '../../models/kitchen/tiffinModel';
import { windowText } from '../../models/kitchen/reachModel';
import { HYGIENE_STATUS } from '../../models/kitchen/kitchenStatusModel';
import { formatOn } from '../../utils/health-time/healthTime';
import { MenuDishRow } from '../../Custom-Components/food/MenuDishRow';
import { BagBar } from '../../Custom-Components/food/BagBar';
import { FoodReviewItem } from '../../Custom-Components/food/FoodReviewItem';
import { RatingSummary } from '../../Custom-Components/food/RatingSummary';
import type { DishCard, FoodAppParamList, MenuSection, VendorPage } from '../../models';
import { callNumber, navigateTo } from '../../utils/maps/maps';
import { cdn } from '../../utils/cdn/cdn';
import { formatPKR } from '../../utils/money/money';
import { formatPkPhoneForDisplay } from '../../utils/phone/phone';
import { selectFoodPoint, setStoreSource } from '../../store/preferencesSlice';
import { loadVendorPageAsync, selectVendorPage } from './foodVendorSlice';
import { openItemSheetAsync } from './itemSheetSlice';
import { ItemSheetView } from './ItemSheetView';
import { addToFoodBagAsync, clearFoodBagErrors, dismissOtherVendor, loadFoodBagAsync, selectFoodBag } from '../food-bag-screen/foodBagSlice';
import { loadFavouritesAsync, selectFoodFavourites, toggleFavouriteAsync } from '../food-favourites-screen/foodFavouritesSlice';

type Props = NativeStackScreenProps<FoodAppParamList, 'FoodVendor'>;

const VIEWABILITY = { itemVisiblePercentThreshold: 40 };

const makeStyles = ({ colors, space, size, radius, gutter, elevation }: Theme) =>
  StyleSheet.create({
    root: { flex: 1, backgroundColor: colors.canvas },
    cover: { width: '100%', aspectRatio: size.vendorCoverAspect, backgroundColor: colors.surfaceSunk },
    fill: { ...StyleSheet.absoluteFillObject },
    fade: { position: 'absolute', top: space.s0, left: space.s0, right: space.s0 },
    // The white bar once the cover has gone: the kitchen's colour as a rule under it.
    bar: { position: 'absolute', top: space.s0, left: space.s0, right: space.s0, backgroundColor: colors.surface, borderBottomWidth: size.focusBorder },
    barRow: { flexDirection: 'row', alignItems: 'center', minHeight: size.headerBar, paddingHorizontal: space.s8 },
    barTitle: { flex: 1, paddingHorizontal: space.s4 },
    identity: { paddingHorizontal: gutter, marginTop: -size.avatar.lg / 2 },
    logo: {
      width: size.avatar.lg,
      height: size.avatar.lg,
      borderRadius: radius.pill,
      overflow: 'hidden',
      borderWidth: size.focusBorder,
      borderColor: colors.surface,
      backgroundColor: colors.surface,
      alignItems: 'center',
      justifyContent: 'center',
      ...elevation.raised,
    },
    head: { gap: space.s20, paddingTop: space.s12, paddingBottom: space.s8 },
    padded: { paddingHorizontal: gutter, gap: space.s12 },
    fact: { flexDirection: 'row', alignItems: 'center', gap: space.s8 },
    rating: { flexDirection: 'row', alignItems: 'center', gap: space.s4, alignSelf: 'flex-start' },
    ratingText: { flexShrink: 1 },
    rail: { paddingHorizontal: gutter, gap: space.s12 },
    planRail: { gap: space.s12 },
    storyPhoto: { width: size.railCard, height: size.railCard, borderRadius: radius.lg, overflow: 'hidden', backgroundColor: colors.surfaceSunk },
    tabs: { paddingHorizontal: gutter, gap: space.s8, paddingVertical: space.s8 },
    sectionHead: { paddingHorizontal: gutter, paddingTop: space.s24, gap: space.s4 },
    item: { paddingHorizontal: gutter },
    after: { gap: space.s24, paddingTop: space.s32 },
    list: { paddingBottom: space.s56 },
    listWithBar: { paddingBottom: size.control.lg + space.s56 + space.s24 },
    confirmButtons: { flexDirection: 'row', gap: space.s12 },
    half: { flex: 1 },
    failed: { paddingHorizontal: gutter, paddingTop: space.s20 },
  });

const FoodVendor: React.FC<Props> = props => {
  const entry = useAppSelector(st => selectVendorPage(st, props.route.params.slug));
  return (
    <ServiceScope service="food">
      <StoreBrandScope brand={entry.page?.brandColor} onBrand={entry.page?.onBrandColor} base="food">
        <FoodVendorContent {...props} />
      </StoreBrandScope>
    </ServiceScope>
  );
};

/** Why ordering is closed here right now, or null. */
const blockedReasonOf = (p: VendorPage): string | null => {
  if (p.paused) return p.pauseMessage ?? 'Not taking orders right now';
  if (p.delivery?.outOfZone && !p.fulfilment.pickup) return 'Doesn’t deliver to your address';
  return null;
};

const FoodVendorContent: React.FC<Props> = ({ route, navigation }) => {
  const { slug, dish, via } = route.params;
  const { back } = useBack({ name: 'FoodTabs' });
  const dispatch = useAppDispatch();
  // Opened from the kitchen's own link or QR: the order that follows counts as one it brought.
  useEffect(() => {
    if (via) dispatch(setStoreSource({ kind: via, slug, at: Date.now(), opened: true }));
  }, [dispatch, via, slug]);
  const styles = useStyles(makeStyles);
  const { colors, size, space, gutter, service, motion } = useTheme();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const point = useAppSelector(selectFoodPoint);
  const { page, status, error } = useAppSelector(st => selectVendorPage(st, slug));
  const bag = useAppSelector(selectFoodBag);
  const favourites = useAppSelector(selectFoodFavourites);
  const [info, setInfo] = useState(false);
  const [active, setActive] = useState(0);
  const [tabsY, setTabsY] = useState(0);
  const [stuck, setStuck] = useState(false);
  // The cover has scrolled away: the white bar takes over from the circles.
  const [pastCover, setPastCover] = useState(false);
  const list = useRef<SectionList<DishCard, MenuSection>>(null);
  const tabBar = useRef<ScrollView>(null);

  const at = point ? { lat: point.lat, lng: point.lng } : null;
  const atKey = at ? `${at.lat},${at.lng}` : '';
  useEffect(() => {
    void dispatch(loadVendorPageAsync({ slug, at: atKey ? { lat: Number(atKey.split(',')[0]), lng: Number(atKey.split(',')[1]) } : null }));
  }, [dispatch, slug, atKey]);

  // The bag may have changed elsewhere (checkout, another device).
  useFocusEffect(
    useCallback(() => {
      void dispatch(loadFoodBagAsync());
    }, [dispatch]),
  );
  const favouritesLoaded = favourites.status !== 'idle';
  useEffect(() => {
    if (!favouritesLoaded) void dispatch(loadFavouritesAsync());
  }, [dispatch, favouritesLoaded]);

  // From search: open the dish's sheet once the page is in.
  const openedDish = useRef<string | null>(null);
  useEffect(() => {
    if (page && dish && openedDish.current !== dish) {
      openedDish.current = dish;
      void dispatch(openItemSheetAsync(dish));
    }
  }, [dispatch, page, dish]);

  const sections = useMemo(() => (page?.menu ?? []).map(c => ({ ...c, key: c.id, data: c.items })), [page]);

  // The tab follows the first category in view. React Native wants this
  // callback to keep one identity, so it reads the ids from a ref.
  const sectionIds = useRef<string[]>([]);
  useEffect(() => {
    sectionIds.current = sections.map(x => x.key);
  }, [sections]);
  const [onViewable] = useState(() => ({ viewableItems }: { viewableItems: ViewToken[] }) => {
    const first = viewableItems.find(v => v.section);
    const key = (first?.section as { key?: string } | undefined)?.key;
    const i = key ? sectionIds.current.indexOf(key) : -1;
    if (i >= 0) setActive(i);
  });

  const jump = useCallback(
    (index: number) => {
      setActive(index);
      list.current?.scrollToLocation({ sectionIndex: index, itemIndex: 0, viewOffset: size.control.md + gutter, animated: true });
    },
    [gutter, size.control.md],
  );

  useEffect(() => {
    // Roughly a chip's width per tab: keeps the active one in view.
    tabBar.current?.scrollTo({ x: Math.max(0, active * size.railCard * 0.6 - gutter), animated: true });
  }, [active, gutter, size.railCard]);

  const handOver = width / size.vendorCoverAspect - size.headerBar - insets.top;
  const onScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const y = e.nativeEvent.contentOffset.y;
    const past = y > handOver;
    if (past !== pastCover) setPastCover(past);
    // The tabs stay once the menu reaches the white bar.
    const next = tabsY > 0 && y >= tabsY - size.headerBar - insets.top;
    if (next !== stuck) setStuck(next);
  };

  if (!page) {
    return (
      <View style={styles.root}>
        {status === 'failed' ? (
          <View style={[styles.failed, { paddingTop: insets.top + size.touch + space.s16 }]}>
            <InlineNotice message={error.message} action={error.code === 'NOT_FOUND' ? undefined : { label: 'Try again', onPress: () => void dispatch(loadVendorPageAsync({ slug, at })) }} />
          </View>
        ) : (
          <VendorPageSkeleton />
        )}
        <PhotoTopBar onBack={back} showBag={false} />
      </View>
    );
  }

  const blocked = blockedReasonOf(page);
  const saved = favourites.savedIds.includes(page.id);
  const bagHere = bag.cart.vendor?.id === page.id && bag.cart.itemCount > 0;

  const addToBag = async (input: Parameters<typeof lineInput>[1], sel: Parameters<typeof lineInput>[2], replace = false) => {
    dispatch(clearFoodBagErrors());
    const r = await dispatch(addToFoodBagAsync({ input: lineInput(page.id, input, sel), replace }));
    if (addToFoodBagAsync.fulfilled.match(r)) {
      Toast.show({ type: 'success', text1: `${sel.quantity} × ${input.name} in your bag` });
      return true;
    }
    // Another kitchen's dishes are in the bag: close the dish and ask.
    return (r.payload as { code?: string } | undefined)?.code === 'CART_OTHER_VENDOR';
  };
  const tabs = (
    <ScrollView ref={tabBar} horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tabs}>
      {page.menu.map((c, i) => (
        <ChoiceChip key={c.id} label={c.name} selected={active === i} onPress={() => jump(i)} />
      ))}
    </ScrollView>
  );

  const reviewCount = page.ratingSummary ? page.ratingSummary.recent.length : 0;
  const allDishes = page.menu.flatMap(m => m.items);
  const signature = page.signatureItemIds.length ? allDishes.filter((d, i, all) => page.signatureItemIds.includes(d.id) && all.findIndex(x => x.id === d.id) === i) : [];
  // One rail: the kitchen's own recipes first (tagged), then what people order most.
  const picks: DishTileData[] = [
    ...signature.map(d => ({ ...d, tag: 'Signature' })),
    ...page.popular.filter(d => !page.signatureItemIds.includes(d.id)).map(d => ({ ...d, tag: null })),
  ];
  const openReviews = () => navigation.navigate('FoodReviews', { id: page.id, name: page.name, slug: page.slug });
  const inBag = (id: string) => (bagHere ? bag.cart.lines.filter(l => l.itemId === id).reduce((n, l) => n + l.quantity, 0) : 0);
  // ONE notice: paused beats closed beats out of the area.
  const notice = page.paused ? (
    <InlineNotice tone="warning" title="Not taking orders right now" message={page.pauseMessage ?? 'Check back soon.'} />
  ) : !page.openState.open ? (
    <InlineNotice tone="info" title={page.openState.label} message="You can look through the menu now and order when it opens." />
  ) : page.delivery?.outOfZone ? (
    <InlineNotice
      tone="warning"
      title={point ? `Doesn’t deliver to ${point.label}` : 'Doesn’t deliver to your address'}
      message={page.pickup ? `You can collect from ${[page.location.area, page.location.city].filter(Boolean).join(', ')} instead.` : 'Try another address.'}
    />
  ) : null;
  const fromKitchen = page.tiffinPlans.length || page.catering?.open || page.ramadan;

  const header = (
    <View>
      <View style={styles.cover}>
        {page.coverUrl ? <Image source={{ uri: cdn(page.coverUrl, { w: width }) ?? undefined }} style={styles.fill} contentFit="cover" transition={motion.imageFade} /> : null}
      </View>
      <View style={styles.identity}>
        <View style={styles.logo}>
          {page.logoUrl ? (
            <Image source={{ uri: cdn(page.logoUrl, { w: size.avatar.lg * 2 }) ?? undefined }} style={styles.fill} contentFit="cover" />
          ) : (
            <AppText variant="title" tone="accentDeep">
              {storeInitials(page.name)}
            </AppText>
          )}
        </View>
      </View>
      <View style={styles.head}>
        <View style={styles.padded}>
          <AppText variant="heading" accessibilityRole="header">
            {page.name}
          </AppText>
          {page.tagline ? (
            <AppText variant="body" tone="muted" numberOfLines={2}>
              {page.tagline}
            </AppText>
          ) : null}
          <Pressable
            style={styles.rating}
            onPress={reviewCount ? openReviews : undefined}
            disabled={!reviewCount}
            hitSlop={space.s8}
            accessibilityRole={reviewCount ? 'link' : 'text'}
            accessibilityHint={reviewCount ? 'Opens the reviews' : undefined}>
            <IonIcon name="star" size="sm" color={colors.star} />
            <AppText variant="small" numberOfLines={2} style={styles.ratingText}>{`${ratingLabel(page)} · ${cuisineLine(page)}${page.isHomeKitchen ? ' · Home kitchen' : ''}`}</AppText>
            {reviewCount ? <IonIcon name="chevron-forward" size="sm" color={colors.inkMuted} /> : null}
          </Pressable>
          <BadgeRow badges={page.badges.filter(b => b !== 'home_kitchen')} />
        </View>
        <View style={styles.padded}>
          <PolicyStrip lines={vendorFacts(page)} />
          {page.freeDeliveryOver && page.delivery?.available && page.delivery.fee > 0 ? (
            <AppText variant="small" tone="accentDeep">{`Free delivery on orders over ${formatPKR(page.freeDeliveryOver)}`}</AppText>
          ) : null}
          <TextAction label="Address, hours and how to pay" icon="information-circle-outline" onPress={() => setInfo(true)} />
          {notice}
        </View>
        {page.deals.length ? <DealRail deals={page.deals} /> : null}
        {picks.length ? (
          <FoodSection title="Popular here" subtitle={signature.length ? 'The kitchen’s own recipes, and what people order most' : 'What people order most'}>
            <DishRail dishes={picks} onOpen={id => void dispatch(openItemSheetAsync(id))} />
          </FoodSection>
        ) : null}
        {/* Tiffin plans, dawat and Ramadan hours (Kitchen Intelligence), in one card. */}
        {fromKitchen ? (
          <View style={styles.padded}>
            <SectionCard title={`From ${page.name}`} icon="sparkles-outline">
              {page.tiffinPlans.length ? (
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.planRail}>
                  {page.tiffinPlans.map(t => (
                    <TiffinPlanCard key={t.id} plan={planCardData(t, page.name)} rail onPress={() => navigation.navigate('FoodTiffinPlan', { id: t.id })} />
                  ))}
                </ScrollView>
              ) : null}
              {page.catering?.open ? (
                <ListRow
                  title="Plan a dawat"
                  subtitle={`Catering from ${page.catering.minGuests} guests, ${page.catering.leadDays} days ahead. Ask for a quote.`}
                  leftIcon="people-outline"
                  tint="violet"
                  onPress={() => navigation.navigate('FoodCateringForm', { slug: page.slug, name: page.name })}
                />
              ) : null}
              {page.ramadan ? (
                <ListRow
                  title="Ramadan hours"
                  subtitle={[
                    page.ramadan.sehri ? `Sehri ${windowText(page.ramadan.sehri)}` : null,
                    page.ramadan.iftar ? `Iftar ${windowText(page.ramadan.iftar)}${page.ramadan.iftarPreorderOnly ? ' · order ahead' : ''}` : null,
                  ]
                    .filter(Boolean)
                    .join(' · ')}
                  leftIcon="moon-outline"
                  tint="blue"
                  chevron={false}
                />
              ) : null}
            </SectionCard>
          </View>
        ) : null}
      </View>
      <View onLayout={(e: LayoutChangeEvent) => setTabsY(e.nativeEvent.layout.y)}>{page.menu.length > 1 ? tabs : null}</View>
    </View>
  );

  // After the menu: what people say, and the kitchen's story and hygiene.
  const footer = (
    <View style={styles.after}>
      {page.ratingSummary && reviewCount ? (
        <View style={styles.padded}>
          <ShopSection title="Ratings and reviews" inset={false} onSeeAll={openReviews} seeAllLabel="See all" />
          <RatingSummary summary={page.ratingSummary} />
          {page.ratingSummary.recent[0] ? <FoodReviewItem review={page.ratingSummary.recent[0]} vendorName={page.name} /> : null}
        </View>
      ) : null}
      {page.story || page.hygiene.status !== 'none' ? (
        <View style={styles.padded}>
          <ShopSection title={page.story ? 'Our story' : 'Hygiene'} inset={false} />
          {page.story ? (
            <>
              {page.story.cookName ? <AppText variant="bodyStrong">{`Cooked by ${page.story.cookName}`}</AppText> : null}
              <AppText variant="body">{page.story.text}</AppText>
            </>
          ) : null}
        </View>
      ) : null}
      {page.story?.photoUrls.length ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.rail}>
          {page.story.photoUrls.map((u, n) => (
            <View key={u} style={styles.storyPhoto}>
              <Image source={{ uri: cdn(u, { w: size.railCard, h: size.railCard }) ?? undefined }} style={styles.fill} contentFit="cover" accessibilityLabel={`${page.name}: kitchen photo ${n + 1}`} />
            </View>
          ))}
        </ScrollView>
      ) : null}
      {page.story?.videoUrl || page.hygiene.status !== 'none' ? (
        <View style={styles.padded}>
          {page.story?.videoUrl ? <TextAction label="Watch the kitchen’s video" icon="play-circle-outline" onPress={() => void Linking.openURL(page.story!.videoUrl!)} /> : null}
          {page.hygiene.status !== 'none' ? (
            <View style={styles.fact}>
              <IonIcon name={page.hygiene.status === 'verified' ? 'shield-checkmark-outline' : 'shield-outline'} size="sm" color={colors.inkMuted} />
              <AppText variant="small" tone="muted" style={styles.ratingText}>
                {page.hygiene.status === 'verified'
                  ? `${HYGIENE_STATUS.verified.label} by MetroMatrix${page.hygiene.checkedAt ? ` · checked ${formatOn(page.hygiene.checkedAt)}` : ''}`
                  : `${HYGIENE_STATUS.self_declared.label} by the kitchen`}
              </AppText>
            </View>
          ) : null}
        </View>
      ) : null}
      <View style={styles.padded}>
        <TrustNote text={customerTrustLine(page.name, { riders: true })} />
      </View>
    </View>
  );

  const saveButton = (circle: boolean) => (
    <IconButton
      icon={saved ? 'heart' : 'heart-outline'}
      appearance={circle ? 'circle' : undefined}
      tone={saved ? 'danger' : undefined}
      onPress={() => void dispatch(toggleFavouriteAsync({ vendorId: page.id, save: !saved }))}
      accessibilityLabel={saved ? `Remove ${page.name} from saved` : `Save ${page.name}`}
    />
  );
  const bagCount = bag.cart.empty ? 0 : bag.cart.itemCount;

  return (
    <View style={styles.root}>
      <SectionList
        ref={list}
        sections={sections}
        keyExtractor={d => d.id}
        stickySectionHeadersEnabled={false}
        ListHeaderComponent={header}
        ListFooterComponent={footer}
        renderSectionHeader={({ section }) => (
          <View style={styles.sectionHead}>
            <AppText variant="sectionTitle" accessibilityRole="header">
              {section.name}
            </AppText>
            <AppText variant="small" tone={section.availableNow ? 'muted' : 'warning'}>
              {[`${section.items.length} ${section.items.length === 1 ? 'dish' : 'dishes'}`, section.availableNow ? null : `Served ${categoryWindowLabel(section.availableFrom, section.availableTo)}`]
                .filter(Boolean)
                .join(' · ')}
            </AppText>
          </View>
        )}
        renderItem={({ item, index, section }) => (
          <View style={styles.item}>
            {index > 0 ? <Divider /> : null}
            <MenuDishRow dish={item} windowFrom={section.availableFrom} inBag={inBag(item.id)} onPress={() => void dispatch(openItemSheetAsync(item.id))} />
          </View>
        )}
        ListEmptyComponent={
          <View style={styles.padded}>
            <EmptyState ion="restaurant-outline" title="Nothing on the menu right now" body="The kitchen hasn’t put its dishes up yet. Check back soon." />
          </View>
        }
        onViewableItemsChanged={onViewable}
        viewabilityConfig={VIEWABILITY}
        onScroll={onScroll}
        scrollEventThrottle={16}
        contentContainerStyle={bagHere ? styles.listWithBar : styles.list}
        onScrollToIndexFailed={() => undefined}
      />

      {/* Over the cover: a fade under the status bar and the floating circles. Past it: the white bar, then the tabs once the menu reaches the top. */}
      {pastCover ? (
        <View style={[styles.bar, { paddingTop: insets.top, borderBottomColor: stuck ? colors.line : service.accent }]}>
          <View style={styles.barRow}>
            <IconButton icon="chevron-back" onPress={back} accessibilityLabel="Back" />
            <AppText variant="barTitle" numberOfLines={1} style={styles.barTitle} accessibilityRole="header">
              {page.name}
            </AppText>
            {saveButton(false)}
            <CountIconButton icon="bag-handle-outline" count={bagCount} onPress={() => navigation.navigate('FoodBag')} label="Your bag" />
          </View>
          {stuck && page.menu.length > 1 ? tabs : null}
        </View>
      ) : (
        <>
          <View style={[styles.fade, { height: insets.top + size.headerWell + space.s24 }]} pointerEvents="none">
            <PhotoScrim edge="top" />
          </View>
          <PhotoTopBar onBack={back} right={saveButton(true)} bag={{ count: bagCount, onPress: () => navigation.navigate('FoodBag') }} />
        </>
      )}

      {bagHere ? <BagBar count={bag.cart.itemCount} subtotal={bag.cart.subtotal} busy={bag.adding} onPress={() => navigation.navigate('FoodBag')} /> : null}

      <ItemSheetView blockedReason={blocked} adding={bag.adding} addError={bag.addError.message || null} onAdd={(sheet, sel) => addToBag(sheet, sel)} />

      <Sheet
        visible={!!bag.otherVendor}
        onClose={() => dispatch(dismissOtherVendor())}
        title="Start a new bag?"
        subtitle={bag.otherVendor ? `Your bag has ${bag.otherVendor.itemCount} ${bag.otherVendor.itemCount === 1 ? 'dish' : 'dishes'} from ${bag.otherVendor.name}.` : undefined}
      >
        <AppText variant="body" tone="muted">
          {`Each order comes from one kitchen. Starting a new bag from ${page.name} removes what’s in your bag now.`}
        </AppText>
        <View style={styles.confirmButtons}>
          <View style={styles.half}>
            <Button label="Keep my bag" variant="secondary" onPress={() => dispatch(dismissOtherVendor())} fullWidth />
          </View>
          <View style={styles.half}>
            <Button
              label="Start a new bag"
              loading={bag.adding}
              onPress={() => {
                const pending = bag.otherVendor;
                if (!pending) return;
                void dispatch(addToFoodBagAsync({ input: pending.input, replace: true })).then(r => {
                  if (addToFoodBagAsync.fulfilled.match(r)) Toast.show({ type: 'success', text1: `New bag from ${page.name}` });
                });
              }}
              fullWidth
            />
          </View>
        </View>
      </Sheet>

      <Sheet visible={info} onClose={() => setInfo(false)} title={page.name} subtitle={page.isHomeKitchen ? 'Home kitchen' : undefined}>
        <Card padded="horizontal">
          {page.location.addressLine ? (
            <ListRow
              title={page.location.addressLine}
              subtitle={[page.location.area, page.location.city].filter(Boolean).join(', ')}
              leftIcon="location-outline"
              onPress={page.location.lat !== null && page.location.lng !== null ? () => navigateTo(page.location.lat!, page.location.lng!) : undefined}
              chevron={page.location.lat !== null}
            />
          ) : null}
          {page.location.phone ? (
            <>
              <Divider />
              <ListRow title={formatPkPhoneForDisplay(page.location.phone)} subtitle="Call the kitchen" leftIcon="call-outline" onPress={() => callNumber(page.location.phone!)} />
            </>
          ) : null}
          <Divider />
          <ListRow title={page.openState.label} subtitle="Hours" leftIcon="time-outline" chevron={false} />
        </Card>
        <Card padded="horizontal">
          {page.delivery ? (
            <ListRow
              title={page.delivery.available ? `${feeLabel({ deliveryFee: page.delivery.fee })} · ${page.delivery.eta.label}` : 'Doesn’t deliver to your address'}
              subtitle={page.delivery.available && page.delivery.minOrder ? `Minimum order ${formatPKR(page.delivery.minOrder)}` : 'Delivery'}
              leftIcon="bicycle-outline"
              chevron={false}
            />
          ) : null}
          {page.pickup ? (
            <>
              <Divider />
              <ListRow title={`Ready in ${page.pickup.readyIn.label}`} subtitle="Pick-up from the kitchen" leftIcon="bag-handle-outline" chevron={false} />
            </>
          ) : null}
          <Divider />
          <ListRow title={page.acceptsCod ? 'Cash, or a bank or wallet transfer' : 'Bank or wallet transfer'} subtitle="How to pay" leftIcon="wallet-outline" chevron={false} />
        </Card>
        <TrustNote text={customerTrustLine(page.name, { riders: true })} />
      </Sheet>
    </View>
  );
};

export default FoodVendor;
