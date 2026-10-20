// ═══════════════════════════════════════════════════════
// MetroMatrix — Kitchen growth: demand nearby
// ═══════════════════════════════════════════════════════
// Where people around the kitchen searched for food in the last 30 days,
// by area: shaded by how many searched, outlined where most found nothing
// open. Filter by cuisine and time of day. Below: what people searched for
// and didn't find, and the area's day against the kitchen's own orders.
// Anonymous and grouped: an area with too few searches is never shown.

import React, { useCallback } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useAppDispatch, useAppSelector } from '@hooks/useReduxHooks';
import { useBack } from '@hooks/useBack';
import { HOUR_CHOICES, busiestGap, hourLabel, unmetLine } from '@models/kitchen/reachModel';
import { ServiceScope, useStyles, type Theme } from '@theme/index';
import { AppText, Card, ChoiceChip, DemandHeatmap, Divider, HourCurve, InlineNotice, ScreenShell, SkeletonLines } from '@custom/index';
import type { FoodVendorStackParamList } from '@/types';
import { loadDemandAsync, selectDemandMap, setDemandFilter } from './demandMapSlice';

type Props = NativeStackScreenProps<FoodVendorStackParamList, 'GrowthDemand'>;

const LAHORE = { lat: 31.5204, lng: 74.3587 };
const fmt = (n: number) => n.toLocaleString('en-US');

const makeStyles = ({ space, gutter }: Theme) =>
  StyleSheet.create({
    gap: { gap: space.s12 },
    chipBar: { flexGrow: 0, flexShrink: 0 },
    chips: { flexDirection: 'row', gap: space.s8, paddingRight: gutter },
    filters: { gap: space.s8 },
    row: { gap: space.s4, paddingVertical: space.s4 },
  });

const DemandMapScreen: React.FC<Props> = props => (
  <ServiceScope service="food">
    <DemandMapContent {...props} />
  </ServiceScope>
);

const DemandMapContent: React.FC<Props> = () => {
  const { back } = useBack({ name: 'VendorTabs', params: { screen: 'KitchenTab' } });
  const dispatch = useAppDispatch();
  const styles = useStyles(makeStyles);
  const s = useAppSelector(selectDemandMap);
  const d = s.data;

  const load = useCallback(
    (f: { cuisine: string | null; hour: number | null } = { cuisine: s.cuisine, hour: s.hour }) => void dispatch(loadDemandAsync({ ...f, withCuisines: !s.cuisines.length })),
    [dispatch, s.cuisine, s.hour, s.cuisines.length],
  );
  useFocusEffect(useCallback(() => load(), [load]));

  const pick = (f: { cuisine?: string | null; hour?: number | null }) => {
    dispatch(setDemandFilter(f));
    load({ cuisine: f.cuisine !== undefined ? f.cuisine : s.cuisine, hour: f.hour !== undefined ? f.hour : s.hour });
  };

  const filters = (
    <View style={styles.filters}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipBar} contentContainerStyle={styles.chips}>
        <ChoiceChip label="All food" selected={!s.cuisine} onPress={() => pick({ cuisine: null })} />
        {s.cuisines.map(c => (
          <ChoiceChip key={c.slug} label={c.name} selected={s.cuisine === c.slug} onPress={() => pick({ cuisine: c.slug })} />
        ))}
      </ScrollView>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipBar} contentContainerStyle={styles.chips}>
        {HOUR_CHOICES.map(h => (
          <ChoiceChip key={h.label} label={h.hour === null ? h.label : `${h.label} · ${hourLabel(h.hour)}`} selected={s.hour === h.hour} onPress={() => pick({ hour: h.hour })} />
        ))}
      </ScrollView>
    </View>
  );

  const gap = d ? busiestGap(d.hourCurve) : null;
  return (
    <ScreenShell title="Demand nearby" subtitle={d ? `Searches within ${d.radiusKm} km, the last 30 days` : 'What people near you search for'} onBack={back} refreshing={s.status === 'loading' && !!d} onRefresh={() => load()}>
      {s.status === 'failed' ? <InlineNotice message={s.error.message} action={{ label: 'Try again', onPress: () => load() }} /> : null}
      {!d && s.status !== 'failed' ? <SkeletonLines lines={10} /> : null}
      {d ? (
        <>
          <DemandHeatmap cells={d.cells.map(c => ({ id: c.geohash, sw: c.sw, ne: c.ne, searches: c.searches, unmetShare: c.unmetShare }))} center={d.center ?? LAHORE} minCount={d.minCount} filters={filters} />
          <AppText variant="small" tone="muted">
            {d.cells.length
              ? `${fmt(d.total)} searches${d.hidden ? ` · ${fmt(d.hidden)} in areas too small to show` : ''}`
              : 'Not enough searches for these filters to show any area yet.'}
          </AppText>

          {d.topUnmet.length ? (
            <Card>
              <View style={styles.gap}>
                <AppText variant="title">Searched for, not found</AppText>
                <AppText variant="small" tone="muted">
                  What people nearby looked for when nothing open had it.
                </AppText>
                {d.topUnmet.map((x, n) => (
                  <View key={x.query}>
                    {n ? <Divider /> : null}
                    <View style={styles.row}>
                      <AppText variant="bodyStrong">{`“${x.query}”`}</AppText>
                      <AppText variant="small" tone="muted">
                        {unmetLine(x)}
                      </AppText>
                    </View>
                  </View>
                ))}
              </View>
            </Card>
          ) : null}

          <Card>
            <View style={styles.gap}>
              <AppText variant="title">Your day against the area’s</AppText>
              <HourCurve area={d.hourCurve.area} own={d.hourCurve.own} />
              {gap !== null ? (
                <AppText variant="small" tone="muted">
                  {`People nearby search a lot around ${hourLabel(gap)}, when you get few orders.`}
                </AppText>
              ) : null}
            </View>
          </Card>
        </>
      ) : null}
    </ScreenShell>
  );
};

export default DemandMapScreen;
