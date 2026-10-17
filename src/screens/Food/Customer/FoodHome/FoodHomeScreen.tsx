// ═══════════════════════════════════════════════════════
// MetroMatrix — Food Court (the Food app's Home tab)
// ═══════════════════════════════════════════════════════
// Where it delivers (a saved address or where you are), search, cuisines,
// then rails — deals, top rated, fastest, home kitchens, free delivery, new —
// and every restaurant that delivers to you, a page at a time, open ones
// first. Vendors deliver with their own riders; MetroMatrix takes no
// commission, so the fee shown is the vendor's own.

import React, { useCallback, useEffect, useMemo } from 'react';
import { FlatList, Pressable, RefreshControl, StyleSheet, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAppDispatch, useAppSelector } from '@hooks/useReduxHooks';
import { useServiceNav } from '@hooks/useServiceNav';
import { usePagedList } from '@hooks/usePagedList';
import { listVendors } from '@networks/food/discoveryNetwork';
import { RAILS, pointOfAddress } from '@models/food/discoveryModel';
import { ServiceScope, useStyles, useTheme, type Theme } from '@theme/index';
import { AppText, Button, Card, Divider, EmptyState, IonIcon, InlineNotice, ListRow, MciIcon, Sheet, Skeleton } from '@custom/index';
import { VendorCard } from '@custom/food/VendorCard';
import { CuisineRail, FoodHomeSkeleton, FoodSearchButton, FoodSection, VendorRail } from '@components/food/FoodParts';
import type { VendorCard as VendorCardData } from '@/types';
import { selectFoodPoint, setFoodPoint } from '@store/preferencesSlice';
import { loadAddressesAsync, selectAddressBook } from '../../../Account/AddressBook/addressBookSlice';
import { closePointSheet, loadFoodHomeAsync, locateMeAsync, openPointSheet, pointKey, selectFoodHome } from './foodHomeSlice';

type Nav = { navigate: (name: string, params?: object) => void };

const makeStyles = ({ colors, space, gutter, size, radius }: Theme) =>
  StyleSheet.create({
    root: { flex: 1, backgroundColor: colors.canvas },
    bar: { flexDirection: 'row', alignItems: 'center', gap: space.s12, paddingHorizontal: gutter, paddingTop: space.s8 },
    back: { width: size.touch, height: size.touch, marginLeft: -space.s8, alignItems: 'center', justifyContent: 'center' },
    where: { flex: 1, gap: space.s0 },
    whereRow: { flexDirection: 'row', alignItems: 'center', gap: space.s4 },
    pin: { width: size.control.sm, height: size.control.sm, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center' },
    list: { paddingBottom: space.s40 },
    header: { gap: space.s24, paddingTop: space.s8, paddingBottom: space.s16 },
    padded: { paddingHorizontal: gutter, gap: space.s12 },
    row: { paddingBottom: space.s24 },
    footer: { paddingVertical: space.s16, alignItems: 'center' },
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
  const insets = useSafeAreaInsets();
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

  const key = point ? pointKey(point) : '';
  useEffect(() => {
    if (point && s.builtFor !== key) void dispatch(loadFoodHomeAsync({ lat: point.lat, lng: point.lng }));
  }, [dispatch, key, point, s.builtFor]);

  const delivering = !!home?.coverage.delivering && s.builtFor === key;
  const fetchPage = useCallback(
    (page: number, pageSize: number) => listVendors({ lat: point?.lat ?? 0, lng: point?.lng ?? 0, sort: 'recommended' }, page, pageSize),
    [point?.lat, point?.lng],
  );
  const all = usePagedList(fetchPage, `food-home:${key}`, { enabled: delivering, keyOf: v => v.id });

  const open = (v: VendorCardData) => navigation.navigate('FoodVendor', { slug: v.slug });
  const refresh = () => {
    if (!point) return;
    void dispatch(loadFoodHomeAsync({ lat: point.lat, lng: point.lng, refresh: true }));
    all.refresh();
  };

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
      ) : (
        <>
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
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <View style={styles.bar}>
        <Pressable onPress={back} style={styles.back} accessibilityRole="button" accessibilityLabel="Back" hitSlop={8}>
          <IonIcon name="arrow-back" size="lg" color={colors.ink} />
        </Pressable>
        <View style={[styles.pin, { backgroundColor: service.accentSoft }]}>
          <MciIcon name="map-marker" size="md" color={service.accent} />
        </View>
        <Pressable
          style={styles.where}
          onPress={() => dispatch(openPointSheet())}
          accessibilityRole="button"
          accessibilityLabel={point ? `Delivering to ${point.label}. Change` : 'Choose where to deliver'}
        >
          <AppText variant="title" accessibilityRole="header">
            Food Court
          </AppText>
          <View style={styles.whereRow}>
            <AppText variant="caption" tone="muted" numberOfLines={1}>
              {point ? `Delivering to ${point.label}` : 'Choose where to deliver'}
            </AppText>
            <IonIcon name="chevron-down" size="sm" color={colors.inkMuted} />
          </View>
        </Pressable>
      </View>
      <FoodSearchButton onPress={() => navigation.navigate('FoodSearch')} />

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
