// ═══════════════════════════════════════════════════════
// MetroMatrix — Food Court search
// ═══════════════════════════════════════════════════════
// Type a dish or a kitchen: kitchens that match, and dishes grouped by the
// kitchen that cooks them, near where you are. Recent searches first; the
// bag follows along.

import React, { useEffect } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useAppDispatch, useAppSelector } from '../../hooks/useReduxHooks';
import { useBack } from '../../hooks/useBack';
import { useDebouncedValue } from '../../hooks/usePagedList';
import { cardLine } from '../../models/food/discoveryModel';
import { dishFactsLine } from '../../models/myKitchen/nutritionModel';
import { ServiceScope, useStyles, useTheme, type Theme } from '../../theme/index';
import { Card, ChoiceChip, Divider, EmptyState, InlineNotice, LineItemRow, ListRow, PageHeader, RowCardsSkeleton, SegmentTabs, StoreHeadRow, TextAction } from '../../Custom-Components/index';
import { VendorCard } from '../../Custom-Components/food/VendorCard';
import { SearchField, ShopSection } from '../../Components/shopping/ShopParts';
import { FoodBagDock, useBagDockInset } from '../../Components/food/FoodParts';
import type { FoodAppParamList } from '../../models';
import { formatPKR } from '../../utils/money/money';
import { clearRecentFoodSearches, selectFoodPoint, selectRecentFoodSearches } from '../../store/preferencesSlice';
import { selectShowCalories } from '../nutrition-settings-screen/nutritionSettingsSlice';
import { MIN_QUERY, searchFoodAsync, selectFoodSearch, setSearchNutrition, setSearchTab, setSearchText, type FoodSearchTab } from './foodSearchSlice';

type Props = NativeStackScreenProps<FoodAppParamList, 'FoodSearch'>;

const TABS: { key: FoodSearchTab; label: string }[] = [
  { key: 'restaurants', label: 'Kitchens' },
  { key: 'dishes', label: 'Dishes' },
];

const makeStyles = ({ colors, space, gutter }: Theme) =>
  StyleSheet.create({
    filters: { flexDirection: 'row', flexWrap: 'wrap', gap: space.s8 },
    root: { flex: 1, backgroundColor: colors.canvas },
    body: { gap: space.s16, paddingTop: space.s20, paddingBottom: space.s40 },
    padded: { paddingHorizontal: gutter, gap: space.s12 },
    group: { marginHorizontal: gutter },
    dish: { paddingVertical: space.s12 },
    head: { paddingVertical: space.s12 },
  });

const FoodSearch: React.FC<Props> = props => (
  <ServiceScope service="food">
    <FoodSearchContent {...props} />
  </ServiceScope>
);

const FoodSearchContent: React.FC<Props> = ({ route, navigation }) => {
  const { back } = useBack({ name: 'FoodTabs' });
  const dispatch = useAppDispatch();
  const styles = useStyles(makeStyles);
  const { service, space } = useTheme();
  const dockInset = useBagDockInset();
  const point = useAppSelector(selectFoodPoint);
  const recent = useAppSelector(selectRecentFoodSearches);
  const s = useAppSelector(selectFoodSearch);
  const typed = useDebouncedValue(s.text.trim());

  useEffect(() => {
    if (route.params?.q) dispatch(setSearchText(route.params.q));
  }, [dispatch, route.params?.q]);

  // Healthy filters only for people who turned calories on.
  const showCalories = useAppSelector(selectShowCalories);
  const nutrition = showCalories ? s.nutrition : null;
  useEffect(() => {
    if (point && typed.length >= MIN_QUERY) void dispatch(searchFoodAsync({ q: typed, lat: point.lat, lng: point.lng, nutrition }));
  }, [dispatch, typed, point, nutrition]);

  const submit = (q = s.text.trim()) => {
    if (!point || q.length < MIN_QUERY) return;
    dispatch(setSearchText(q));
    void dispatch(searchFoodAsync({ q, lat: point.lat, lng: point.lng, remember: true, nutrition }));
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
        <SearchField value={s.text} onChange={v => dispatch(setSearchText(v))} onSubmit={() => submit()} placeholder="Biryani, burgers, a kitchen…" autoFocus />
        {showCalories ? (
          <View style={styles.filters}>
            <ChoiceChip label="Under 600 kcal" selected={s.nutrition === 'under_600'} onPress={() => dispatch(setSearchNutrition(s.nutrition === 'under_600' ? null : 'under_600'))} />
            <ChoiceChip label="High protein" selected={s.nutrition === 'high_protein'} onPress={() => dispatch(setSearchNutrition(s.nutrition === 'high_protein' ? null : 'high_protein'))} />
          </View>
        ) : null}
      </PageHeader>
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={[styles.body, { paddingBottom: space.s40 + dockInset }]}>
        {!point ? (
          <EmptyState ion="location-outline" title="Choose your address first" body="Search shows the kitchens that deliver to you." />
        ) : !showing ? (
          recent.length ? (
            <View style={styles.padded}>
              <ShopSection title="Recent searches" inset={false} trailing={<TextAction label="Clear" tone="muted" onPress={() => dispatch(clearRecentFoodSearches())} />} />
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
            <EmptyState ion="search-outline" title="What are you craving?" body="Search a dish like biryani or karahi, or a kitchen by name." />
          )
        ) : s.status === 'failed' ? (
          <View style={styles.padded}>
            <InlineNotice message={s.error.message} action={{ label: 'Try again', onPress: () => submit() }} />
          </View>
        ) : !r ? (
          <View style={styles.padded}>
            <RowCardsSkeleton count={5} />
          </View>
        ) : !r.vendors.length && !r.dishes.length ? (
          <EmptyState ion="search-outline" title={`Nothing for “${s.query}”`} body="Try another dish or a shorter word." />
        ) : (
          <>
            <View style={styles.padded}>
              <SegmentTabs
                options={TABS.map(t => ({ ...t, label: `${t.label} (${t.key === 'restaurants' ? r.vendors.length : r.dishes.reduce((n, g) => n + g.items.length, 0)})` }))}
                value={s.tab}
                onChange={t => dispatch(setSearchTab(t))}
                accessibilityLabel="Show kitchens or dishes"
              />
            </View>
            {s.tab === 'restaurants' ? (
              r.vendors.length ? (
                r.vendors.map(v => <VendorCard key={v.id} vendor={v} onPress={() => open(v.slug)} />)
              ) : (
                <EmptyState ion="storefront-outline" title="No kitchen by that name" body="The dishes tab has kitchens that cook it." />
              )
            ) : r.dishes.length ? (
              r.dishes.map(g => (
                <View key={g.vendor.id} style={styles.group}>
                  <Card padded="horizontal">
                    <View style={styles.head}>
                      <StoreHeadRow
                        store={{ name: g.vendor.name, logoUrl: g.vendor.logoUrl, brandColor: service.accent }}
                        meta={cardLine(g.vendor)}
                        onPress={() => open(g.vendor.slug)}
                        chevron
                      />
                    </View>
                    {g.items.map(d => (
                      <View key={d.id}>
                        <Divider />
                        <Pressable onPress={() => open(g.vendor.slug, d.id)} style={styles.dish} accessibilityRole="button" accessibilityLabel={`${d.name}, ${formatPKR(d.fromPrice)}, at ${g.vendor.name}`}>
                          <LineItemRow shape="square" imageUrl={d.photoUrl} name={d.name} meta={showCalories && d.nutrition ? dishFactsLine(d.nutrition) : null} price={formatPKR(d.fromPrice)} />
                        </Pressable>
                      </View>
                    ))}
                  </Card>
                </View>
              ))
            ) : (
              <EmptyState ion="search-outline" title="No dish by that name" body="The kitchens tab has places that match." />
            )}
          </>
        )}
      </ScrollView>
      <FoodBagDock />
    </View>
  );
};

export default FoodSearch;
