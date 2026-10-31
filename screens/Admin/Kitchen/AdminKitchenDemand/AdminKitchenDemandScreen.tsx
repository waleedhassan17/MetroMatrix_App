// ═══════════════════════════════════════════════════════
// MetroMatrix — Admin Kitchen: demand across a city
// ═══════════════════════════════════════════════════════
// Where people searched Food Court in the last 30 days, by area, shaded by
// how many searched and outlined where most found nothing open; what they
// looked for and didn't find; and the city's day by hour. Anonymous and
// grouped under the same rule as a kitchen's map: a small area never shows.

import React, { useCallback } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useAppDispatch, useAppSelector } from '../../../../hooks/useReduxHooks';
import { useBack } from '../../../../hooks/useBack';
import { HOUR_CHOICES, hourLabel, unmetLine } from '../../../../models/kitchen/reachModel';
import { useStyles, type Theme } from '../../../../theme/index';
import { AppText, Card, ChoiceChip, DemandHeatmap, Divider, HourCurve, InlineNotice, ScreenShell, SkeletonLines } from '../../../../Custom-Components/index';
import type { AdminFoodStackParamList } from '../../../../types';
import { loadAdminDemandAsync, selectAdminKitchenDemand, setAdminDemandFilter, type DemandFilter } from './adminKitchenDemandSlice';

type Props = NativeStackScreenProps<AdminFoodStackParamList, 'AdminKitchenDemand'>;

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

const AdminKitchenDemandScreen: React.FC<Props> = () => {
  const { back } = useBack({ name: 'FoodOverview' });
  const dispatch = useAppDispatch();
  const styles = useStyles(makeStyles);
  const s = useAppSelector(selectAdminKitchenDemand);
  const d = s.data;

  const load = useCallback(
    (f: DemandFilter = { city: s.city, cuisine: s.cuisine, hour: s.hour }) => void dispatch(loadAdminDemandAsync({ ...f, withCuisines: !s.cuisines.length })),
    [dispatch, s.city, s.cuisine, s.hour, s.cuisines.length],
  );
  useFocusEffect(useCallback(() => load(), [load]));

  const pick = (f: Partial<DemandFilter>) => {
    dispatch(setAdminDemandFilter(f));
    load({ city: f.city ?? s.city, cuisine: f.cuisine !== undefined ? f.cuisine : s.cuisine, hour: f.hour !== undefined ? f.hour : s.hour });
  };

  const filters = (
    <View style={styles.filters}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipBar} contentContainerStyle={styles.chips}>
        {(d?.cities.length ? d.cities : [s.city]).map(c => (
          <ChoiceChip key={c} label={c} selected={s.city === c} onPress={() => pick({ city: c })} />
        ))}
      </ScrollView>
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

  return (
    <ScreenShell
      title="Demand across the city"
      subtitle={d ? `${d.city} · searches within ${d.radiusKm} km, the last 30 days` : 'Anonymous Food Court searches'}
      onBack={back}
      refreshing={s.status === 'loading' && !!d}
      onRefresh={() => load()}>
      {s.status === 'failed' ? <InlineNotice message={s.error.message} action={{ label: 'Try again', onPress: () => load() }} /> : null}
      {!d && s.status !== 'failed' ? <SkeletonLines lines={10} /> : null}
      {d ? (
        <>
          <DemandHeatmap
            cells={d.cells.map(c => ({ id: c.geohash, sw: c.sw, ne: c.ne, searches: c.searches, unmetShare: c.unmetShare }))}
            center={d.center ?? LAHORE}
            zoom={11}
            minCount={d.minCount}
            filters={filters}
          />
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
                  What people looked for when nothing open had it: where a new kitchen, or a new dish, would be welcome.
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
              <AppText variant="title">The city’s day</AppText>
              <HourCurve area={d.hourCurve.area} areaLabel={`People searching in ${d.city}`} />
            </View>
          </Card>
          <AppText variant="caption" tone="muted">
            {`Searches are grouped by area; an area with fewer than ${d.minCount} is never shown, and no search is tied to a person.`}
          </AppText>
        </>
      ) : null}
    </ScreenShell>
  );
};

export default AdminKitchenDemandScreen;
