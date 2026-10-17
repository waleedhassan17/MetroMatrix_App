// ═══════════════════════════════════════════════════════
// MetroMatrix — Food Court: a vendor's page
// ═══════════════════════════════════════════════════════
// The kitchen's food photo and mark in its own colour (StoreBrandScope), how
// long it takes to you and what delivery costs, whether it is open (or
// paused, or out of your area), deals, its popular dishes, then the menu by
// category with tabs that follow the scroll and stay at the top. A dish
// opens its sheet. The fee is the vendor's own: MetroMatrix takes nothing.

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, ScrollView, SectionList, StyleSheet, View, type LayoutChangeEvent, type NativeScrollEvent, type NativeSyntheticEvent, type ViewToken } from 'react-native';
import { Image } from 'expo-image';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Toast from 'react-native-toast-message';
import { useAppDispatch, useAppSelector } from '@hooks/useReduxHooks';
import { useBack } from '@hooks/useBack';
import { categoryWindowLabel } from '@models/food/menuModel';
import { cuisineLine, distanceLabel, feeLabel, ratingLabel } from '@models/food/discoveryModel';
import { ServiceScope, StoreBrandScope, useStyles, useTheme, type Theme } from '@theme/index';
import { AppText, Card, ChoiceChip, Divider, IconButton, IonIcon, InlineNotice, ListRow, Sheet, Skeleton, SkeletonLines, TextAction } from '@custom/index';
import { MenuDishRow } from '@custom/food/MenuDishRow';
import type { DishCard, FoodAppParamList, MenuSection, VendorPage } from '@/types';
import { callNumber, navigateTo } from '@utils/maps';
import { cdn } from '@utils/cdn';
import { formatPKR } from '@utils/money';
import { formatPkPhoneForDisplay } from '@utils/phone';
import { selectFoodPoint } from '@store/preferencesSlice';
import { loadVendorPageAsync, selectVendorPage } from './foodVendorSlice';
import { openItemSheetAsync } from './itemSheetSlice';
import { ItemSheetView } from './ItemSheetView';

type Props = NativeStackScreenProps<FoodAppParamList, 'FoodVendor'>;

const makeStyles = ({ colors, space, size, radius, gutter, elevation }: Theme) =>
  StyleSheet.create({
    root: { flex: 1, backgroundColor: colors.canvas },
    cover: { width: '100%', aspectRatio: size.vendorCoverAspect, backgroundColor: colors.surfaceSunk },
    fill: { ...StyleSheet.absoluteFillObject },
    topButtons: { position: 'absolute', left: gutter - space.s8, right: gutter - space.s8, flexDirection: 'row', justifyContent: 'space-between' },
    round: { width: size.touch, height: size.touch, borderRadius: radius.pill, backgroundColor: colors.glass, alignItems: 'center', justifyContent: 'center', ...elevation.input },
    identity: { flexDirection: 'row', alignItems: 'flex-end', gap: space.s12, paddingHorizontal: gutter, marginTop: -size.avatar.lg / 2 },
    logo: {
      width: size.avatar.lg,
      height: size.avatar.lg,
      borderRadius: radius.lg,
      overflow: 'hidden',
      borderWidth: size.focusBorder,
      borderColor: colors.surface,
      backgroundColor: colors.surface,
      ...elevation.raised,
    },
    head: { gap: space.s16, paddingTop: space.s12, paddingBottom: space.s8 },
    padded: { paddingHorizontal: gutter, gap: space.s8 },
    facts: { flexDirection: 'row', flexWrap: 'wrap', gap: space.s8, paddingHorizontal: gutter },
    fact: { flexDirection: 'row', alignItems: 'center', gap: space.s4, paddingHorizontal: space.s12, paddingVertical: space.s8, borderRadius: radius.pill, backgroundColor: colors.surfaceSunk },
    rating: { flexDirection: 'row', alignItems: 'center', gap: space.s4 },
    rail: { paddingHorizontal: gutter, gap: space.s12 },
    popular: { width: size.railCard, gap: space.s4 },
    popularPhoto: {
      width: size.railCard,
      height: size.railCard,
      borderRadius: radius.md,
      overflow: 'hidden',
      backgroundColor: colors.surfaceSunk,
      alignItems: 'center',
      justifyContent: 'center',
    },
    tabs: { paddingHorizontal: gutter, gap: space.s8, paddingVertical: space.s8 },
    stickyTabs: { position: 'absolute', left: space.s0, right: space.s0, backgroundColor: colors.canvas, borderBottomWidth: size.hairline, borderBottomColor: colors.line },
    sectionHead: { paddingHorizontal: gutter, paddingTop: space.s24, gap: space.s4 },
    item: { paddingHorizontal: gutter },
    list: { paddingBottom: space.s56 },
    skeleton: { gap: space.s16 },
  });

const FoodVendorScreen: React.FC<Props> = props => {
  const entry = useAppSelector(st => selectVendorPage(st, props.route.params.slug));
  return (
    <ServiceScope service="food">
      <StoreBrandScope brand={entry.page?.brandColor} onBrand={entry.page?.onBrandColor}>
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

const FoodVendorContent: React.FC<Props> = ({ route }) => {
  const { slug, dish } = route.params;
  const { back } = useBack({ name: 'FoodTabs' });
  const dispatch = useAppDispatch();
  const styles = useStyles(makeStyles);
  const { colors, size, space, gutter } = useTheme();
  const insets = useSafeAreaInsets();
  const point = useAppSelector(selectFoodPoint);
  const { page, status, error } = useAppSelector(st => selectVendorPage(st, slug));
  const [info, setInfo] = useState(false);
  const [active, setActive] = useState(0);
  const [tabsY, setTabsY] = useState(0);
  const [stuck, setStuck] = useState(false);
  const list = useRef<SectionList<DishCard, MenuSection>>(null);
  const tabBar = useRef<ScrollView>(null);

  const at = point ? { lat: point.lat, lng: point.lng } : null;
  const atKey = at ? `${at.lat},${at.lng}` : '';
  useEffect(() => {
    void dispatch(loadVendorPageAsync({ slug, at: atKey ? { lat: Number(atKey.split(',')[0]), lng: Number(atKey.split(',')[1]) } : null }));
  }, [dispatch, slug, atKey]);

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

  const onScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const y = e.nativeEvent.contentOffset.y;
    const next = tabsY > 0 && y >= tabsY;
    if (next !== stuck) setStuck(next);
  };

  if (!page) {
    return (
      <View style={[styles.root, { paddingTop: insets.top }]}>
        <View style={[styles.topButtons, { top: insets.top + space.s8 }]}>
          <IconButton icon="arrow-back" accessibilityLabel="Back" onPress={back} />
        </View>
        <View style={[styles.skeleton, { paddingTop: size.touch + space.s16 }]}>
          {status === 'failed' ? (
            <View style={styles.padded}>
              <InlineNotice message={error.message} action={error.code === 'NOT_FOUND' ? undefined : { label: 'Try again', onPress: () => void dispatch(loadVendorPageAsync({ slug, at })) }} />
            </View>
          ) : (
            <>
              <Skeleton height={size.storeCard / size.vendorCoverAspect} />
              <View style={styles.padded}>
                <SkeletonLines lines={8} />
              </View>
            </>
          )}
        </View>
      </View>
    );
  }

  const blocked = blockedReasonOf(page);
  const tabs = (
    <ScrollView ref={tabBar} horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tabs}>
      {page.menu.map((c, i) => (
        <ChoiceChip key={c.id} label={c.name} selected={active === i} onPress={() => jump(i)} />
      ))}
    </ScrollView>
  );

  const header = (
    <View>
      <View style={styles.cover}>
        {page.coverUrl ? <Image source={{ uri: cdn(page.coverUrl, { w: size.storeCard * 1.6 }) ?? undefined }} style={styles.fill} contentFit="cover" transition={150} /> : null}
      </View>
      <View style={styles.identity}>
        <View style={styles.logo}>{page.logoUrl ? <Image source={{ uri: cdn(page.logoUrl, { w: size.avatar.lg }) ?? undefined }} style={styles.fill} contentFit="cover" /> : null}</View>
      </View>
      <View style={styles.head}>
        <View style={styles.padded}>
          <AppText variant="screenTitle" accessibilityRole="header">
            {page.name}
          </AppText>
          {page.tagline ? (
            <AppText variant="body" tone="muted">
              {page.tagline}
            </AppText>
          ) : null}
          <View style={styles.rating}>
            <IonIcon name="star" size="sm" color={colors.star} />
            <AppText variant="small">{`${ratingLabel(page)} · ${cuisineLine(page)}${page.isHomeKitchen ? ' · Home kitchen' : ''}`}</AppText>
          </View>
        </View>
        <View style={styles.facts}>
          <View style={styles.fact}>
            <IonIcon name="time-outline" size="sm" color={colors.inkMuted} />
            <AppText variant="small">{page.delivery?.available ? page.delivery.eta.label : page.pickup ? `Pick-up ${page.pickup.readyIn.label}` : page.eta.label}</AppText>
          </View>
          {page.delivery?.available ? (
            <View style={styles.fact}>
              <IonIcon name="bicycle-outline" size="sm" color={colors.inkMuted} />
              <AppText variant="small">{feeLabel({ deliveryFee: page.delivery.fee })}</AppText>
            </View>
          ) : null}
          {page.delivery?.available && page.delivery.minOrder ? (
            <View style={styles.fact}>
              <AppText variant="small">{`Min ${formatPKR(page.delivery.minOrder)}`}</AppText>
            </View>
          ) : null}
          {distanceLabel(page.distanceKm) ? (
            <View style={styles.fact}>
              <IonIcon name="navigate-outline" size="sm" color={colors.inkMuted} />
              <AppText variant="small">{distanceLabel(page.distanceKm)!}</AppText>
            </View>
          ) : null}
        </View>
        <View style={styles.padded}>
          <TextAction label="Address, hours and how to pay" icon="information-circle-outline" onPress={() => setInfo(true)} />
          {page.paused ? (
            <InlineNotice tone="warning" title="Not taking orders right now" message={page.pauseMessage ?? 'Check back soon.'} />
          ) : !page.openState.open ? (
            <InlineNotice tone="info" title={page.openState.label} message="You can look through the menu now and order when it opens." />
          ) : null}
          {page.delivery?.outOfZone ? (
            <InlineNotice
              tone="warning"
              title={point ? `Doesn’t deliver to ${point.label}` : 'Doesn’t deliver to your address'}
              message={page.pickup ? `You can collect from ${[page.location.area, page.location.city].filter(Boolean).join(', ')} instead.` : 'Try another address.'}
            />
          ) : null}
          {page.freeDeliveryOver && page.delivery?.available && page.delivery.fee > 0 ? (
            <AppText variant="small" tone="accentDeep">{`Free delivery on orders over ${formatPKR(page.freeDeliveryOver)}`}</AppText>
          ) : null}
        </View>
        {page.deals.length ? (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.rail}>
            {page.deals.map(d => (
              <ChoiceChip key={d.id} label={d.label} selected onPress={() => undefined} />
            ))}
          </ScrollView>
        ) : null}
        {page.popular.length ? (
          <View style={styles.padded}>
            <AppText variant="sectionTitle">Popular</AppText>
          </View>
        ) : null}
        {page.popular.length ? (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.rail}>
            {page.popular.map(d => (
              <Pressable key={d.id} style={styles.popular} onPress={() => void dispatch(openItemSheetAsync(d.id))} accessibilityRole="button" accessibilityLabel={`${d.name}, ${formatPKR(d.fromPrice)}`}>
                <View style={styles.popularPhoto}>
                  {d.photoUrl ? (
                    <Image source={{ uri: cdn(d.photoUrl, { w: size.railCard, h: size.railCard }) ?? undefined }} style={styles.fill} contentFit="cover" />
                  ) : (
                    <IonIcon name="restaurant-outline" size="lg" color={colors.inkFaint} />
                  )}
                </View>
                <AppText variant="small" numberOfLines={2}>
                  {d.name}
                </AppText>
                <AppText variant="small" tone="accentDeep">
                  {d.hasVariants ? `from ${formatPKR(d.fromPrice)}` : formatPKR(d.fromPrice)}
                </AppText>
              </Pressable>
            ))}
          </ScrollView>
        ) : null}
      </View>
      <View onLayout={(e: LayoutChangeEvent) => setTabsY(e.nativeEvent.layout.y)}>{page.menu.length > 1 ? tabs : null}</View>
    </View>
  );

  return (
    <View style={styles.root}>
      <SectionList
        ref={list}
        sections={sections}
        keyExtractor={d => d.id}
        stickySectionHeadersEnabled={false}
        ListHeaderComponent={header}
        renderSectionHeader={({ section }) => (
          <View style={styles.sectionHead}>
            <AppText variant="sectionTitle" accessibilityRole="header">
              {section.name}
            </AppText>
            {!section.availableNow ? (
              <AppText variant="small" tone="warning">{`Served ${categoryWindowLabel(section.availableFrom, section.availableTo)}`}</AppText>
            ) : null}
          </View>
        )}
        renderItem={({ item, index, section }) => (
          <View style={styles.item}>
            {index > 0 ? <Divider /> : null}
            <MenuDishRow dish={item} windowFrom={section.availableFrom} onPress={() => void dispatch(openItemSheetAsync(item.id))} />
          </View>
        )}
        ListEmptyComponent={
          <View style={styles.padded}>
            <AppText variant="body" tone="muted">
              Nothing on the menu right now.
            </AppText>
          </View>
        }
        onViewableItemsChanged={onViewable}
        viewabilityConfig={{ itemVisiblePercentThreshold: 40 }}
        onScroll={onScroll}
        scrollEventThrottle={32}
        contentContainerStyle={styles.list}
        onScrollToIndexFailed={() => undefined}
      />

      {/* The back button over the photo; the tabs stay at the top once the menu reaches them. */}
      {stuck && page.menu.length > 1 ? <View style={[styles.stickyTabs, { top: 0, paddingTop: insets.top }]}>{tabs}</View> : null}
      <View style={[styles.topButtons, { top: insets.top + space.s8 }]} pointerEvents="box-none">
        {stuck ? null : (
          <Pressable onPress={back} style={styles.round} accessibilityRole="button" accessibilityLabel="Back">
            <IonIcon name="arrow-back" size="md" color={colors.ink} />
          </Pressable>
        )}
      </View>

      <ItemSheetView
        blockedReason={blocked}
        onAdd={() => {
          Toast.show({ type: 'info', text1: 'Your bag is coming next', text2: 'Ordering opens in the next update.' });
          return false;
        }}
      />

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
        <AppText variant="small" tone="muted">
          {`You pay ${page.name} directly, and its own riders bring your food. MetroMatrix takes no commission.`}
        </AppText>
      </Sheet>
    </View>
  );
};

export default FoodVendorScreen;
