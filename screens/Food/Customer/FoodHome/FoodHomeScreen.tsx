// ═══════════════════════════════════════════════════════
// MetroMatrix — Food Court (the Food app's Home tab)
// ═══════════════════════════════════════════════════════
// Where it delivers (a saved address or where you are), search, cuisines,
// then rails — deals, top rated, fastest, home kitchens, free delivery, new —
// and every restaurant that delivers to you, a page at a time, open ones
// first. Vendors deliver with their own riders; MetroMatrix takes no
// commission, so the fee shown is the vendor's own.

import React, { useCallback, useEffect, useMemo } from 'react';
import { FlatList, Pressable, RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useAppDispatch, useAppSelector } from '../../../../hooks/useReduxHooks';
import { useServiceNav } from '../../../../hooks/useServiceNav';
import { usePagedList } from '../../../../hooks/usePagedList';
import { getVendorsAPI } from '../../../../networks/food/discoveryNetwork';
import { RAILS, pointOfAddress } from '../../../../models/food/discoveryModel';
import { ServiceScope, useStyles, useTheme, type Theme } from '../../../../theme/index';
import { AppText, Button, Card, Divider, EmptyState, IconButton, IonIcon, InlineNotice, ListRow, MciIcon, PageHeader, Sheet, Skeleton, TiffinPlanCard } from '../../../../Custom-Components/index';
import { planCardData } from '../../../../models/kitchen/tiffinModel';
import { formatPKR } from '../../../../utils/money';
import { loadNutritionSettingsAsync, selectNutritionSettings } from '../../../MyKitchen/NutritionSettings/nutritionSettingsSlice';
import { VendorCard } from '../../../../Custom-Components/food/VendorCard';
import { CuisineRail, FoodHomeSkeleton, FoodSearchButton, FoodSection, SurplusRail, VendorRail } from '../../../../Components/food/FoodParts';
import type { VendorCard as VendorCardData } from '../../../../types';
import { selectFoodPoint, setFoodPoint } from '../../../../store/preferencesSlice';
import { loadAddressesAsync, selectAddressBook } from '../../../Account/AddressBook/addressBookSlice';
import { closePointSheet, loadFoodHomeAsync, locateMeAsync, openPointSheet, pointKey, selectFoodHome } from './foodHomeSlice';
import { vendorCardsPageSerializer } from '../../../../serializers/food/discoverySerializer';

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
    footer: { paddingVertical: space.s16, alignItems: 'center' },
    rail: { paddingHorizontal: gutter, gap: space.s16 },
    tile: { flexDirection: 'row', alignItems: 'center', gap: space.s12 },
    tileText: { flex: 1, minWidth: 0, gap: space.s4 },
    pick: { width: size.railCard, gap: space.s4 },
  });

const FoodHomeScreen: React.FC = () => (
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
  const { service, colors, size } = useTheme();
  const s = useAppSelector(selectFoodHome);
  const point = useAppSelector(selectFoodPoint);
  const book = useAppSelector(selectAddressBook);
  const home = s.home;

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
    (page: number, pageSize: number) => getVendorsAPI({ lat: point?.lat ?? 0, lng: point?.lng ?? 0, sort: 'recommended' }, page, pageSize),
    [point?.lat, point?.lng],
  );
  const all = usePagedList(fetchPage, vendorCardsPageSerializer, `food-home:${key}`, { enabled: delivering, keyOf: v => v.id });

  const open = (v: VendorCardData) => navigation.navigate('FoodVendor', { slug: v.slug });
  const refresh = () => {
    if (!point) return;
    void dispatch(loadFoodHomeAsync({ lat: point.lat, lng: point.lng, refresh: true }));
    all.refresh();
  };

  // Bachat Boxes are for pickup: they show even where nobody delivers.
  const surplusRail = s.surplus.length ? (
    <FoodSection title="Bachat Box near you" subtitle="Tonight’s food at a lower price, for pickup" onSeeAll={() => navigation.navigate('FoodSurplusList')}>
      <SurplusRail boxes={s.surplus} onOpen={x => navigation.navigate('FoodSurplus', { id: x.id })} />
    </FoodSection>
  ) : null;

  const tiffinRail = s.tiffins.length ? (
    <FoodSection title="Home-cooked tiffins" subtitle="The same meal on set days, paid to the kitchen by the week or month">
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.rail}>
        {s.tiffins.slice(0, 8).map(t => (
          <TiffinPlanCard key={t.id} plan={planCardData(t)} rail onPress={() => navigation.navigate('FoodTiffinPlan', { id: t.id })} />
        ))}
      </ScrollView>
    </FoodSection>
  ) : null;

  const myKitchen = (
    <View style={styles.padded}>
      <Card onPress={() => navigation.navigate('MyKitchen')} accessibilityLabel="My Kitchen: cook what you have, get what's missing">
        <View style={styles.tile}>
          <IonIcon name="basket-outline" size="lg" color={service.accentDeep} />
          <View style={styles.tileText}>
            <AppText variant="title">My Kitchen</AppText>
            <AppText variant="small" tone="muted">
              Cook what you have, and get what’s missing
            </AppText>
          </View>
          <IonIcon name="chevron-forward" size="md" color={colors.inkMuted} />
        </View>
      </Card>
    </View>
  );

  const healthyRail =
    showCalories && s.healthy.length ? (
      <FoodSection title="Healthy picks" subtitle="Under 600 kcal, or high in protein (estimated, per person)">
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.rail}>
          {s.healthy.map(h => (
            <Card key={h.itemId} onPress={() => navigation.navigate('FoodVendor', { slug: h.vendor.slug, dish: h.itemId })} accessibilityLabel={`${h.name} from ${h.vendor.name}, ${h.kcal} kcal, ${h.protein} grams protein`}>
              <View style={styles.pick}>
                <AppText variant="bodyStrong" numberOfLines={2}>
                  {h.name}
                </AppText>
                <AppText variant="small" tone="muted" numberOfLines={1}>
                  {h.vendor.name}
                </AppText>
                <AppText variant="small">{`${h.kcal.toLocaleString('en-US')} kcal · ${h.protein} g protein`}</AppText>
                <AppText variant="small" tone="accentDeep">
                  {formatPKR(h.price)}
                </AppText>
              </View>
            </Card>
          ))}
        </ScrollView>
      </FoodSection>
    ) : null;

  const iftarRail = s.iftar.length ? (
    <FoodSection title="Iftar near you" subtitle="Kitchens keeping Ramadan hours">
      <View style={styles.padded}>
        <Card padded="horizontal">
          {s.iftar.slice(0, 6).map((k, n) => (
            <View key={k.vendorId}>
              {n ? <Divider /> : null}
              <ListRow
                title={k.name}
                subtitle={`Iftar ${k.iftar.label}${k.preorderOnly ? ' · order ahead' : ''}${k.distanceKm !== null ? ` · ${k.distanceKm} km` : ''}`}
                leftIcon="moon-outline"
                onPress={() => navigation.navigate('FoodVendor', { slug: k.slug })}
              />
            </View>
          ))}
        </Card>
      </View>
    </FoodSection>
  ) : null;

  const rails = useMemo(() => (home ? RAILS.map(r => ({ ...r, vendors: home[r.key] })).filter(r => r.vendors.length) : []), [home]);

  const header = (
    <View style={styles.header}>
      {!point ? (
        <View style={styles.padded}>
          <EmptyState icon="map-pin" title="Where should we deliver?" body="Pick a saved address or use where you are, and we’ll show the kitchens that deliver to you." />
          <Button label="Choose where" onPress={() => dispatch(openPointSheet())} fullWidth />
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
              icon="map"
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
          {home.cuisines.length ? (
            <FoodSection title="Cuisines">
              <CuisineRail cuisines={home.cuisines} onPress={c => navigation.navigate('FoodVendors', { cuisine: c.slug, title: c.name })} />
            </FoodSection>
          ) : null}
          {myKitchen}
          {healthyRail}
          {iftarRail}
          {surplusRail}
          {tiffinRail}
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
          <View style={styles.padded}>
            <AppText variant="sectionTitle" accessibilityRole="header">
              All restaurants
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
        right={<IconButton icon="heart-outline" tone="onScrim" accessibilityLabel="Saved kitchens" onPress={() => navigation.navigate('FoodFavourites')} />}
      >
        <Pressable
          style={styles.whereRow}
          onPress={() => dispatch(openPointSheet())}
          accessibilityRole="button"
          accessibilityLabel={point ? `Delivering to ${point.label}. Change` : 'Choose where to deliver'}
        >
          <MciIcon name="map-marker" size="sm" color={colors.onScrim} />
          <AppText variant="bodyStrong" tone="onScrim" numberOfLines={1} style={styles.whereText}>
            {point ? `Delivering to ${point.label}` : 'Choose where to deliver'}
          </AppText>
          <IonIcon name="chevron-down" size="sm" color={colors.onScrim} />
        </Pressable>
        <FoodSearchButton onPress={() => navigation.navigate('FoodSearch')} />
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
            <View style={styles.padded}>
              <Skeleton height={size.storeCard / size.vendorPhotoAspect} shape="lg" />
            </View>
          ) : delivering && all.error ? (
            <View style={styles.padded}>
              <InlineNotice message={all.error} action={{ label: 'Try again', onPress: all.reload }} />
            </View>
          ) : null
        }
        onEndReached={all.loadMore}
        onEndReachedThreshold={0.5}
        contentContainerStyle={styles.list}
        refreshControl={
          <RefreshControl refreshing={s.refreshing || all.isRefreshing} onRefresh={refresh} tintColor={service.accent} colors={[service.accent]} progressBackgroundColor={colors.surface} />
        }
        showsVerticalScrollIndicator={false}
      />

      <Sheet visible={s.pointSheet} onClose={() => dispatch(closePointSheet())} title="Where should we deliver?">
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

export default FoodHomeScreen;
