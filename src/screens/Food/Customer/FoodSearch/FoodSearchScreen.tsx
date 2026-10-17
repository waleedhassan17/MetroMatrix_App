// ═══════════════════════════════════════════════════════
// MetroMatrix — Food Court search
// ═══════════════════════════════════════════════════════
// Type a dish or a restaurant: restaurants that match, and dishes grouped by
// the kitchen that cooks them, near where you are. Recent searches first.

import React, { useEffect } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { Image } from 'expo-image';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useAppDispatch, useAppSelector } from '@hooks/useReduxHooks';
import { useBack } from '@hooks/useBack';
import { useDebouncedValue } from '@hooks/usePagedList';
import { cardLine } from '@models/food/discoveryModel';
import { ServiceScope, useStyles, useTheme, type Theme } from '@theme/index';
import { AppText, Card, Divider, EmptyState, InlineNotice, IonIcon, ListRow, PageHeader, SegmentTabs, SkeletonLines, TextAction } from '@custom/index';
import { VendorCard } from '@custom/food/VendorCard';
import { FoodSearchField } from '@components/food/FoodParts';
import type { FoodAppParamList } from '@/types';
import { cdn } from '@utils/cdn';
import { formatPKR } from '@utils/money';
import { clearRecentFoodSearches, selectFoodPoint, selectRecentFoodSearches } from '@store/preferencesSlice';
import { MIN_QUERY, searchFoodAsync, selectFoodSearch, setSearchTab, setSearchText, type FoodSearchTab } from './foodSearchSlice';

type Props = NativeStackScreenProps<FoodAppParamList, 'FoodSearch'>;

const TABS: { key: FoodSearchTab; label: string }[] = [
  { key: 'restaurants', label: 'Restaurants' },
  { key: 'dishes', label: 'Dishes' },
];

const makeStyles = ({ colors, space, gutter, size, radius }: Theme) =>
  StyleSheet.create({
    root: { flex: 1, backgroundColor: colors.canvas },
    body: { gap: space.s16, paddingTop: space.s20, paddingBottom: space.s40 },
    padded: { paddingHorizontal: gutter, gap: space.s12 },
    recentHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    group: { marginHorizontal: gutter, gap: space.s8 },
    dish: { flexDirection: 'row', alignItems: 'center', gap: space.s12, paddingVertical: space.s12 },
    thumb: { width: size.thumb, height: size.thumb, borderRadius: radius.md, overflow: 'hidden', backgroundColor: colors.surfaceSunk, alignItems: 'center', justifyContent: 'center' },
    fill: { ...StyleSheet.absoluteFillObject },
    dishText: { flex: 1, gap: space.s4 },
  });

const FoodSearchScreen: React.FC<Props> = props => (
  <ServiceScope service="food">
    <FoodSearchContent {...props} />
  </ServiceScope>
);

const FoodSearchContent: React.FC<Props> = ({ route, navigation }) => {
  const { back } = useBack({ name: 'FoodTabs' });
  const dispatch = useAppDispatch();
  const styles = useStyles(makeStyles);
  const { size, colors } = useTheme();
  const point = useAppSelector(selectFoodPoint);
  const recent = useAppSelector(selectRecentFoodSearches);
  const s = useAppSelector(selectFoodSearch);
  const typed = useDebouncedValue(s.text.trim());

  useEffect(() => {
    if (route.params?.q) dispatch(setSearchText(route.params.q));
  }, [dispatch, route.params?.q]);

  useEffect(() => {
    if (point && typed.length >= MIN_QUERY) void dispatch(searchFoodAsync({ q: typed, lat: point.lat, lng: point.lng }));
  }, [dispatch, typed, point]);

  const submit = (q = s.text.trim()) => {
    if (!point || q.length < MIN_QUERY) return;
    dispatch(setSearchText(q));
    void dispatch(searchFoodAsync({ q, lat: point.lat, lng: point.lng, remember: true }));
  };

  const open = (slug: string, dish?: string) => {
    if (s.query) submit(s.query);
    navigation.navigate('FoodVendor', { slug, ...(dish ? { dish } : null) });
  };

  const r = s.result;
  const showing = s.text.trim().length >= MIN_QUERY;
  return (
    <View style={styles.root}>
      {/* The FYP's gradient page header, as on Shopping and Health. */}
      <PageHeader title="Search" subtitle={point ? `Delivering to ${point.label}` : undefined} onBack={back}>
        <FoodSearchField value={s.text} onChange={v => dispatch(setSearchText(v))} onSubmit={() => submit()} autoFocus />
      </PageHeader>
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.body}>
        {!point ? (
          <EmptyState icon="map-pin" title="Choose where to deliver first" body="Search shows the kitchens that deliver to you." />
        ) : !showing ? (
          recent.length ? (
            <View style={styles.padded}>
              <View style={styles.recentHead}>
                <AppText variant="sectionTitle">Recent searches</AppText>
                <TextAction label="Clear" tone="muted" onPress={() => dispatch(clearRecentFoodSearches())} />
              </View>
              <Card padded="horizontal">
                {recent.map((q, i) => (
                  <View key={q}>
                    {i > 0 ? <Divider /> : null}
                    <ListRow title={q} leftIcon="time-outline" onPress={() => submit(q)} chevron={false} />
                  </View>
                ))}
              </Card>
            </View>
          ) : (
            <EmptyState icon="search" title="What are you craving?" body="Search a dish like biryani or karahi, or a restaurant by name." />
          )
        ) : s.status === 'failed' ? (
          <View style={styles.padded}>
            <InlineNotice message={s.error.message} action={{ label: 'Try again', onPress: () => submit() }} />
          </View>
        ) : !r ? (
          <View style={styles.padded}>
            <SkeletonLines lines={6} />
          </View>
        ) : !r.vendors.length && !r.dishes.length ? (
          <EmptyState icon="search" title={`Nothing for “${s.query}”`} body="Try another dish or a shorter word." />
        ) : (
          <>
            <View style={styles.padded}>
              <SegmentTabs
                options={TABS.map(t => ({ ...t, label: `${t.label} (${t.key === 'restaurants' ? r.vendors.length : r.dishes.reduce((n, g) => n + g.items.length, 0)})` }))}
                value={s.tab}
                onChange={t => dispatch(setSearchTab(t))}
                accessibilityLabel="Show restaurants or dishes"
              />
            </View>
            {s.tab === 'restaurants' ? (
              r.vendors.length ? (
                r.vendors.map(v => <VendorCard key={v.id} vendor={v} onPress={() => open(v.slug)} />)
              ) : (
                <EmptyState icon="coffee" title="No restaurant by that name" body="The dishes tab has kitchens that cook it." />
              )
            ) : r.dishes.length ? (
              r.dishes.map(g => (
                <View key={g.vendor.id} style={styles.group}>
                  <AppText variant="title">{g.vendor.name}</AppText>
                  <AppText variant="small" tone="muted">
                    {cardLine(g.vendor)}
                  </AppText>
                  <Card padded="horizontal">
                    {g.items.map((d, i) => (
                      <View key={d.id}>
                        {i > 0 ? <Divider /> : null}
                        <Pressable onPress={() => open(g.vendor.slug, d.id)} style={styles.dish} accessibilityRole="button" accessibilityLabel={`${d.name}, ${formatPKR(d.fromPrice)}, at ${g.vendor.name}`}>
                          <View style={styles.thumb}>
                            {d.photoUrl ? (
                              <Image source={{ uri: cdn(d.photoUrl, { w: size.thumb, h: size.thumb }) ?? undefined }} style={styles.fill} contentFit="cover" />
                            ) : (
                              <IonIcon name="restaurant-outline" size="md" color={colors.inkFaint} />
                            )}
                          </View>
                          <View style={styles.dishText}>
                            <AppText variant="bodyStrong" numberOfLines={2}>
                              {d.name}
                            </AppText>
                            <AppText variant="small" tone="accentDeep">
                              {formatPKR(d.fromPrice)}
                            </AppText>
                          </View>
                        </Pressable>
                      </View>
                    ))}
                  </Card>
                </View>
              ))
            ) : (
              <EmptyState icon="search" title="No dish by that name" body="The restaurants tab has places that match." />
            )}
          </>
        )}
      </ScrollView>
    </View>
  );
};

export default FoodSearchScreen;
