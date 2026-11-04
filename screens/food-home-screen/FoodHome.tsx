// ═══════════════════════════════════════════════════════
// MetroMatrix — Food Court (the Food app's Home tab)
// ═══════════════════════════════════════════════════════
// Ordering first: the customer's live order, the staff's banners, cuisines,
// then the rails — order again, deals, top rated, fastest, home kitchens,
// free delivery, new — then "More from Food Court" (Bachat Box, tiffins,
// dawat, My Kitchen) and its rails, and every kitchen that delivers to you,
// a page at a time, open ones first. The bag follows the customer (the
// header's bag and the dock). Vendors deliver with their own riders;
// MetroMatrix takes no commission, so the fee shown is the vendor's own.

import React, { useCallback, useEffect, useMemo } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import { FlatList, Pressable, RefreshControl, StyleSheet, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useAppDispatch, useAppSelector } from '../../hooks/useReduxHooks';
import { useServiceNav } from '../../hooks/useServiceNav';
import { usePagedList } from '../../hooks/usePagedList';
import { fetchVendors } from '../../networks/food/discovery';
import { RAILS, pointOfAddress } from '../../models/food/discoveryModel';
import { ServiceScope, useStyles, useTheme, type Theme } from '../../theme/index';
import { AppText, Button, Card, CountIconButton, Divider, EmptyState, IconButton, IonIcon, InlineNotice, ListRow, MciIcon, PageHeader, PhotoBannerCarousel, Sheet } from '../../Custom-Components/index';
import { loadNutritionSettingsAsync, selectNutritionSettings } from '../nutrition-settings-screen/nutritionSettingsSlice';
import { VendorCard } from '../../Custom-Components/food/VendorCard';
import { ActiveOrderCard, CuisineRail, FoodBagDock, FoodHomeSkeleton, FoodSection, SurplusRail, VendorRail, useBagDockInset } from '../../Components/food/FoodParts';
import { VendorCardSkeleton } from '../../Custom-Components/food/FoodSkeletons';
import { QuickActionGrid } from '../../Components/admin/AdminParts';
import { useFoodBag } from '../../hooks/useFoodBag';
import { SearchPill } from '../../Components/shopping/ShopParts';
import type { FoodHomeBanner, VendorCard as VendorCardData } from '../../models';
import { selectFoodPoint, setFoodPoint } from '../../store/preferencesSlice';
import { loadAddressesAsync, selectAddressBook } from '../address-book-screen/addressBookSlice';
import { closePointSheet, loadActiveFoodOrdersAsync, loadFoodHomeAsync, locateMeAsync, openPointSheet, pointKey, selectFoodHome } from './foodHomeSlice';
import { vendorCardsPageSerializer } from '../../serializers/food/discoverySerializer';

type Nav = { navigate: (name: string, params?: object) => void };

const makeStyles = ({ colors, space, gutter, size }: Theme) =>
  StyleSheet.create({
    root: { flex: 1, backgroundColor: colors.canvas },
    whereRow: { flexDirection: 'row', alignItems: 'center', gap: space.s8, minHeight: size.touch },
    whereText: { flexShrink: 1 },
    list: { paddingBottom: space.s40 },
    header: { gap: space.s24, paddingTop: space.s20, paddingBottom: space.s16 },
    padded: { paddingHorizontal: gutter, gap: space.s12 },
    row: { paddingBottom: space.s24 },
    headerActions: { flexDirection: 'row', alignItems: 'center' },
    allHead: { paddingHorizontal: gutter, gap: space.s4 },
    footer: { paddingHorizontal: gutter, paddingBottom: space.s24 },
  });

const FoodHome: React.FC = () => (
  <ServiceScope service="food">
    <FoodHomeContent />
  </ServiceScope>
);

const FoodHomeContent: React.FC = () => {
  // The service's Home tab: back leaves the service for the three cards.
  const { leaveService: back } = useServiceNav();
  const navigation = useNavigation<Nav>();
  const dispatch = useAppDispatch();
  const styles = useStyles(makeStyles);
  const { service, colors } = useTheme();
  const s = useAppSelector(selectFoodHome);
  const point = useAppSelector(selectFoodPoint);
  const book = useAppSelector(selectAddressBook);
  const bag = useFoodBag();
  const dockInset = useBagDockInset();
  const home = s.home;

  // The live-order card reads again each time the tab comes back.
  useFocusEffect(
    useCallback(() => {
      void dispatch(loadActiveFoodOrdersAsync());
    }, [dispatch]),
  );

  useEffect(() => {
    if (book.status === 'idle') void dispatch(loadAddressesAsync());
  }, [book.status, dispatch]);

  // No point yet: the default address, if it has a map pin.
  useEffect(() => {
    if (point || book.status !== 'succeeded') return;
    const pinned = book.addresses.filter(a => a.lat !== null && a.lng !== null);
    const pick = pinned.find(a => a.isDefault) ?? pinned[0];
    if (pick) dispatch(setFoodPoint(pointOfAddress(pick)));
  }, [point, book.status, book.addresses, dispatch]);

  // Calories (and healthy picks) only for people who turned them on.
  const nutrition = useAppSelector(selectNutritionSettings);
  const showCalories = !!nutrition.settings?.showCalories;
  useEffect(() => {
    if (nutrition.status === 'idle') void dispatch(loadNutritionSettingsAsync());
  }, [dispatch, nutrition.status]);

  const key = point ? pointKey(point) : '';
  useEffect(() => {
    if (point && s.builtFor !== key) void dispatch(loadFoodHomeAsync({ lat: point.lat, lng: point.lng }));
  }, [dispatch, key, point, s.builtFor]);

  const delivering = !!home?.coverage.delivering && s.builtFor === key;
  const fetchPage = useCallback(
    (page: number, pageSize: number) => fetchVendors({ lat: point?.lat ?? 0, lng: point?.lng ?? 0, sort: 'recommended' }, page, pageSize),
    [point?.lat, point?.lng],
  );
  const all = usePagedList(fetchPage, vendorCardsPageSerializer, `food-home:${key}`, { enabled: delivering, keyOf: v => v.id });

  const open = (v: VendorCardData) => navigation.navigate('FoodVendor', { slug: v.slug });
  const refresh = () => {
    void dispatch(loadActiveFoodOrdersAsync());
    if (!point) return;
    void dispatch(loadFoodHomeAsync({ lat: point.lat, lng: point.lng, refresh: true }));
    all.refresh();
  };

  const openBanner = (b: FoodHomeBanner) => {
    if (b.target.type === 'vendor') navigation.navigate('FoodVendor', { slug: b.target.slug });
    else if (b.target.type === 'cuisine') navigation.navigate('FoodVendors', { cuisine: b.target.slug, title: b.target.name });
    else navigation.navigate('FoodSearch', { q: b.target.query });
  };
  const bannerCta = (b: FoodHomeBanner) => (b.target.type === 'vendor' ? 'Order now' : b.target.type === 'cuisine' ? 'See kitchens' : 'Search');

  // The customer's own orders on their way: one opens it, more open the Orders tab.
  const liveOrder = s.activeOrders.length ? (
    <View style={styles.padded}>
      <ActiveOrderCard
        orders={s.activeOrders}
        total={s.activeTotal}
        onOpen={code => navigation.navigate('FoodOrder', { code })}
        onAll={() => navigation.navigate('FoodOrdersTab')}
      />
    </View>
  ) : null;

  // Bachat Boxes are for pickup: they show even where nobody delivers.
  const surplusRail = s.surplus.length ? (
    <FoodSection title="Bachat Box near you" subtitle="Tonight’s food at a lower price, for pickup" onSeeAll={() => navigation.navigate('FoodSurplusList')}>
      <SurplusRail boxes={s.surplus} onOpen={x => navigation.navigate('FoodSurplus', { id: x.id })} />
    </FoodSection>
  ) : null;

  // Kitchen Intelligence's rails: a tiffin with a free place, iftar hours today (the vendor page shows the plans and hours).
  const tiffinRail = home?.tiffinNearYou.length ? (
    <FoodSection title="Home-cooked tiffins" subtitle="The same meal on set days, paid to the kitchen by the week or month">
      <VendorRail vendors={home.tiffinNearYou} onOpen={open} />
    </FoodSection>
  ) : null;

  // Food Court's other ways to eat, in one row (each opens its own list).
  const more = (
    <FoodSection title="More from Food Court">
      <View style={styles.padded}>
        <QuickActionGrid
          columns={4}
          actions={[
            { key: 'bachat', icon: 'gift-outline', tint: 'green', label: 'Bachat Box', onPress: () => navigation.navigate('FoodSurplusList') },
            { key: 'tiffins', icon: 'calendar-outline', tint: 'amber', label: 'My tiffins', onPress: () => navigation.navigate('FoodTiffins') },
            { key: 'dawat', icon: 'people-outline', tint: 'violet', label: 'Dawat requests', onPress: () => navigation.navigate('FoodCateringRequests') },
            { key: 'kitchen', icon: 'basket-outline', tint: 'teal', label: 'My Kitchen', onPress: () => navigation.navigate('MyKitchen') },
          ]}
        />
      </View>
    </FoodSection>
  );

  const healthyRail =
    showCalories && s.healthy.length ? (
      <FoodSection title="Lighter choices" subtitle="Kitchens with dishes under 600 kcal (estimated, per person)">
        <VendorRail vendors={s.healthy} onOpen={open} />
      </FoodSection>
    ) : null;

  const iftarRail = home?.iftarNearYou.length ? (
    <FoodSection title="Iftar near you" subtitle="Kitchens keeping Ramadan hours today">
      <VendorRail vendors={home.iftarNearYou} onOpen={open} />
    </FoodSection>
  ) : null;

  const rails = useMemo(() => (home ? RAILS.map(r => ({ ...r, vendors: home[r.key] })).filter(r => r.vendors.length) : []), [home]);

  const header = (
    <View style={styles.header}>
      {liveOrder}
      {!point ? (
        <View style={styles.padded}>
          <EmptyState ion="location-outline" title="Choose your address" body="Pick a saved address or use where you are, and we’ll show the kitchens that deliver there." />
          <Button label="Choose an address" onPress={() => dispatch(openPointSheet())} fullWidth />
        </View>
      ) : s.error.message && !home ? (
        <View style={styles.padded}>
          <InlineNotice message={s.error.message} action={{ label: 'Try again', onPress: () => void dispatch(loadFoodHomeAsync({ lat: point.lat, lng: point.lng })) }} />
        </View>
      ) : !home || s.builtFor !== key ? (
        <FoodHomeSkeleton />
      ) : !home.coverage.delivering ? (
        <>
          <View style={styles.padded}>
            <EmptyState
              ion="map-outline"
              title="Not delivering here yet"
              body={
                home.coverage.pickupNearby
                  ? `No kitchen delivers to ${point.label} yet. ${home.coverage.pickupNearby} nearby ${home.coverage.pickupNearby === 1 ? 'is' : 'are'} open for pick-up.`
                  : `No kitchen delivers to ${point.label} yet. Try another address.`
              }
              action={
                home.coverage.pickupNearby
                  ? { label: 'See pick-up places', onPress: () => navigation.navigate('FoodVendors', { pickup: true, title: 'Pick-up near you' }) }
                  : { label: 'Change address', onPress: () => dispatch(openPointSheet()) }
              }
            />
          </View>
          {surplusRail}
        </>
      ) : (
        <>
          {home.banners.length ? <PhotoBannerCarousel banners={home.banners} onOpen={openBanner} cta={bannerCta} /> : null}
          {home.cuisines.length ? (
            <FoodSection title="Cuisines">
              <CuisineRail cuisines={home.cuisines} onPress={c => navigation.navigate('FoodVendors', { cuisine: c.slug, title: c.name })} />
            </FoodSection>
          ) : null}
          {rails.map(r => (
            <FoodSection
              key={r.key}
              title={r.title}
              subtitle={r.subtitle}
              onSeeAll={r.list && r.vendors.length > 2 ? () => navigation.navigate('FoodVendors', { rail: r.key, title: r.title }) : undefined}
            >
              <VendorRail vendors={r.vendors} onOpen={open} />
            </FoodSection>
          ))}
          {more}
          {iftarRail}
          {healthyRail}
          {surplusRail}
          {tiffinRail}
          <View style={styles.allHead}>
            <AppText variant="sectionTitle" accessibilityRole="header">
              All kitchens
            </AppText>
            <AppText variant="small" tone="muted">
              {all.total ? `${all.total} deliver to ${point.label}` : 'Open ones first'}
            </AppText>
          </View>
        </>
      )}
    </View>
  );

  return (
    <View style={styles.root}>
      {/* The FYP's gradient page header, as on Shopping and Health. */}
      <PageHeader
        title="Food Court"
        onBack={back}
        backLabel="Back to services"
        right={
          <View style={styles.headerActions}>
            <IconButton icon="heart-outline" tone="onScrim" accessibilityLabel="Saved kitchens" onPress={() => navigation.navigate('FoodFavourites')} />
            <CountIconButton icon="bag-handle-outline" count={bag.count} onPress={bag.openBag} label="Your bag" />
          </View>
        }
      >
        <Pressable
          style={styles.whereRow}
          onPress={() => dispatch(openPointSheet())}
          accessibilityRole="button"
          accessibilityLabel={point ? `Deliver to ${point.label}. Change the address` : 'Choose your address'}
        >
          <MciIcon name="map-marker" size="sm" color={colors.onScrim} />
          <AppText variant="bodyStrong" tone="onScrim" numberOfLines={1} style={styles.whereText}>
            {point ? `Deliver to ${point.label}` : 'Choose your address'}
          </AppText>
          <IonIcon name="chevron-down" size="sm" color={colors.onScrim} />
        </Pressable>
        <SearchPill label="Search dishes and kitchens" hints={['Search biryani, karahi, burgers', 'Search a kitchen by name', 'Search dishes and kitchens']} onPress={() => navigation.navigate('FoodSearch')} />
      </PageHeader>

      <FlatList
        data={delivering ? all.rows : []}
        keyExtractor={v => v.id}
        renderItem={({ item }) => (
          <View style={styles.row}>
            <VendorCard vendor={item} onPress={() => open(item)} />
          </View>
        )}
        ListHeaderComponent={header}
        ListFooterComponent={
          delivering && all.isLoading ? (
            <VendorCardSkeleton count={1} />
          ) : delivering && all.error ? (
            <View style={styles.footer}>
              <InlineNotice message={all.error} action={{ label: 'Try again', onPress: all.reload }} />
            </View>
          ) : null
        }
        onEndReached={all.loadMore}
        onEndReachedThreshold={0.5}
        contentContainerStyle={[styles.list, { paddingBottom: styles.list.paddingBottom + dockInset }]}
        refreshControl={
          <RefreshControl refreshing={s.refreshing || all.isRefreshing} onRefresh={refresh} tintColor={service.accent} colors={[service.accent]} progressBackgroundColor={colors.surface} />
        }
        showsVerticalScrollIndicator={false}
      />

      <FoodBagDock inTab />

      <Sheet visible={s.pointSheet} onClose={() => dispatch(closePointSheet())} title="Your address">
        {s.locateError ? <InlineNotice message={s.locateError} /> : null}
        <Card padded="horizontal">
          <ListRow
            title={s.locating ? 'Finding you…' : 'Use my current location'}
            leftIcon="navigate-outline"
            onPress={() => void dispatch(locateMeAsync())}
            chevron={false}
          />
          {book.addresses.map(a => {
            const p = pointOfAddress(a);
            const chosen = !!p && point?.addressId === a.id;
            return (
              <View key={a.id}>
                <Divider />
                <ListRow
                  title={p ? p.label : `${a.label === 'home' ? 'Home' : a.label === 'work' ? 'Work' : 'Other'} · ${a.area}`}
                  subtitle={p ? [a.line1, a.city].join(', ') : 'Add a map pin to deliver here'}
                  leftIcon={chosen ? 'checkmark-circle' : 'location-outline'}
                  onPress={() => {
                    if (p) {
                      dispatch(setFoodPoint(p));
                      dispatch(closePointSheet());
                    } else {
                      dispatch(closePointSheet());
                      navigation.navigate('AddressForm', { id: a.id });
                    }
                  }}
                  chevron={!p}
                />
              </View>
            );
          })}
          <Divider />
          <ListRow
            title="Add an address"
            leftIcon="add-circle-outline"
            onPress={() => {
              dispatch(closePointSheet());
              navigation.navigate('AddressForm');
            }}
          />
        </Card>
      </Sheet>
    </View>
  );
};

export default FoodHome;
