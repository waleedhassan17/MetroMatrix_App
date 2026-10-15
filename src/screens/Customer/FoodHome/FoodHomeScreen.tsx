// ═══════════════════════════════════════════════════════
// MetroMatrix — Food Court (opened from the home's Food Court card)
// ═══════════════════════════════════════════════════════
// The Food Court gathers a city's food vendors — fast-food brands first,
// then restaurants and home kitchens — under one roof. Unlike Foodpanda,
// MetroMatrix takes no commission and runs no riders of its own: vendors
// deliver with their own riders through MetroMatrix's delivery app. Foodpanda's familiar layout (sticky search,
// promotions, cuisines, vendor cards) in Food's pink, with more air and
// calmer type. Live against GET /food/home (the dummy API until the backend
// serves it).

import React, { useCallback, useEffect, useMemo } from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Toast from 'react-native-toast-message';
import { useAppDispatch, useAppSelector } from '@hooks/useReduxHooks';
import { filterKitchens } from '@models/foodModel';
import { ServiceScope, useStyles, useTheme, type Theme } from '@theme/index';
import { AppText, EmptyState, InlineNotice, IonIcon, MciIcon } from '@custom/index';
import {
  CuisineRail,
  FoodHomeSkeleton,
  FoodSearchBar,
  FoodSection,
  KitchenCard,
  KitchenTile,
  PromoCarousel,
} from '@components/food/FoodParts';
import type { HomeStackParamList, Kitchen } from '@/types';
import { selectUser } from '../../Auth/authSlice';
import { clearFilters, loadFoodHomeAsync, selectFoodHome, setQuery, toggleCuisine } from './foodHomeSlice';

type Props = NativeStackScreenProps<HomeStackParamList, 'FoodHome'>;

const makeStyles = ({ colors, space, gutter, size, radius }: Theme) =>
  StyleSheet.create({
    root: { flex: 1, backgroundColor: colors.canvas },
    content: { paddingBottom: space.s40, gap: space.s12 },
    bar: { flexDirection: 'row', alignItems: 'center', gap: space.s12, paddingHorizontal: gutter, paddingTop: space.s8 },
    back: { width: size.touch, height: size.touch, marginLeft: -space.s8, alignItems: 'center', justifyContent: 'center' },
    pin: {
      width: size.control.sm,
      height: size.control.sm,
      borderRadius: radius.pill,
      alignItems: 'center',
      justifyContent: 'center',
    },
    barText: { flex: 1 },
    list: { gap: space.s24 },
    cards: { gap: space.s16 },
    padded: { paddingHorizontal: gutter },
    rail: { paddingHorizontal: gutter, gap: space.s12 },
  });

const FoodHomeScreen: React.FC<Props> = props => (
  <ServiceScope service="food">
    <FoodHomeContent {...props} />
  </ServiceScope>
);

const FoodHomeContent: React.FC<Props> = ({ navigation }) => {
  const dispatch = useAppDispatch();
  const styles = useStyles(makeStyles);
  const { service, colors } = useTheme();
  const insets = useSafeAreaInsets();
  const user = useAppSelector(selectUser);
  const s = useAppSelector(selectFoodHome);
  const city = user?.city ?? null;

  const load = useCallback((refresh: boolean) => dispatch(loadFoodHomeAsync({ city, refresh })), [dispatch, city]);

  useEffect(() => {
    if (s.status === 'idle') void load(false);
  }, [s.status, load]);

  const kitchens = useMemo(
    () => filterKitchens(s.food?.kitchens ?? [], { query: s.query, cuisine: s.cuisine }),
    [s.food, s.query, s.cuisine],
  );
  const filtering = !!s.query.trim() || !!s.cuisine;
  const homeKitchens = (s.food?.kitchens ?? []).filter(k => k.kind === 'home_kitchen');
  const area = s.food?.area || [user?.streetAddress, user?.city].filter(Boolean).join(', ') || 'Set your location';

  const openKitchen = (k: Kitchen) =>
    Toast.show({ type: 'info', text1: k.name, text2: 'Menus and ordering open in the next update.' });

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <ScrollView
        stickyHeaderIndices={[1]}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={s.refreshing}
            onRefresh={() => void load(true)}
            tintColor={service.accent}
            colors={[service.accent]}
            progressBackgroundColor={colors.surface}
          />
        }>
        {/* 0 — back and where it delivers */}
        <View style={styles.bar}>
          <Pressable onPress={() => navigation.goBack()} style={styles.back} accessibilityRole="button" accessibilityLabel="Back" hitSlop={8}>
            <IonIcon name="arrow-back" size="lg" color={colors.ink} />
          </Pressable>
          <View style={[styles.pin, { backgroundColor: service.accentSoft }]}>
            <MciIcon name="map-marker" size="md" color={service.accent} />
          </View>
          <View style={styles.barText}>
            <AppText variant="title" accessibilityRole="header">
              Food Court
            </AppText>
            <AppText variant="caption" tone="muted" numberOfLines={1}>
              Delivering to {area}
            </AppText>
          </View>
        </View>

        {/* 1 — sticky search */}
        <FoodSearchBar value={s.query} onChange={v => dispatch(setQuery(v))} />

        {/* 2 — promotions, cuisines, kitchens */}
        <View style={styles.list}>
          {s.error.message && !s.food ? (
            <View style={styles.padded}>
              <InlineNotice message={s.error.message} action={{ label: 'Try again', onPress: () => void load(false) }} />
            </View>
          ) : null}
          {!s.food && s.status !== 'failed' ? <FoodHomeSkeleton /> : null}
          {s.food ? (
            <>
              {!filtering && s.food.promos.length ? <PromoCarousel promos={s.food.promos} /> : null}
              {s.food.cuisines.length ? (
                <FoodSection title="Cuisines">
                  <CuisineRail cuisines={s.food.cuisines} selected={s.cuisine} onToggle={c => dispatch(toggleCuisine(c))} />
                </FoodSection>
              ) : null}
              {!filtering && homeKitchens.length ? (
                <FoodSection title="Home kitchens near you" subtitle="Cooked fresh by your neighbours">
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.rail}>
                    {homeKitchens.map(k => (
                      <KitchenTile key={k.id} kitchen={k} onPress={() => openKitchen(k)} />
                    ))}
                  </ScrollView>
                </FoodSection>
              ) : null}
              <FoodSection
                title={filtering ? `${kitchens.length} ${kitchens.length === 1 ? 'result' : 'results'}` : 'All vendors'}
                subtitle={filtering ? undefined : `${kitchens.length} vendors near you`}>
                {kitchens.length ? (
                  <View style={styles.cards}>
                    {kitchens.map(k => (
                      <KitchenCard key={k.id} kitchen={k} onPress={() => openKitchen(k)} />
                    ))}
                  </View>
                ) : (
                  <EmptyState
                    icon="search"
                    title="No kitchens match"
                    body="Try another dish or cuisine."
                    action={{ label: 'Clear search', onPress: () => dispatch(clearFilters()) }}
                  />
                )}
              </FoodSection>
            </>
          ) : null}
        </View>
      </ScrollView>
    </View>
  );
};

export default FoodHomeScreen;
