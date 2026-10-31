// ═══════════════════════════════════════════════════════
// MetroMatrix — Food Court: my tiffins
// ═══════════════════════════════════════════════════════
// Each subscription with its kitchen, where it stands and what comes next;
// the current ones first.

import React, { useCallback } from 'react';
import { StyleSheet, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useAppDispatch, useAppSelector } from '../../hooks/useReduxHooks';
import { useBack } from '../../hooks/useBack';
import { TIFFIN_STATUS } from '../../models/kitchen/kitchenStatusModel';
import { priceLabel, scheduleLabel } from '../../models/kitchen/tiffinModel';
import { ServiceScope, useStyles, type Theme } from '../../theme/index';
import { EmptyState, InlineNotice, ScreenShell, SkeletonLines } from '../../Custom-Components/index';
import { RowCard, SectionHead } from '../../Components/admin/AdminParts';
import type { FoodAppParamList, TiffinSubscription } from '../../models';
import { formatDayShort } from '../../utils/health-time/healthTime';
import { loadMyTiffinsAsync, selectFoodTiffins } from './foodTiffinsSlice';

type Props = NativeStackScreenProps<FoodAppParamList, 'FoodTiffins'>;

const CURRENT = ['pending', 'active', 'paused'];

const makeStyles = ({ space }: Theme) =>
  StyleSheet.create({
    list: { gap: space.s12 },
  });

const FoodTiffins: React.FC<Props> = props => (
  <ServiceScope service="food">
    <FoodTiffinsContent {...props} />
  </ServiceScope>
);

const FoodTiffinsContent: React.FC<Props> = ({ navigation }) => {
  const { back } = useBack({ name: 'FoodTabs' });
  const dispatch = useAppDispatch();
  const styles = useStyles(makeStyles);
  const s = useAppSelector(selectFoodTiffins);
  const load = useCallback(() => void dispatch(loadMyTiffinsAsync()), [dispatch]);
  useFocusEffect(load);

  const row = (x: TiffinSubscription) => (
    <RowCard
      key={x.code}
      title={x.plan.name}
      mark={{ icon: 'calendar-outline', tint: 'amber' }}
      lines={[
        `${x.vendor.name} · ${scheduleLabel(x.plan)}`,
        x.nextDelivery ? `Next: ${formatDayShort(x.nextDelivery.date)} · ${x.nextDelivery.dishes.join(', ')}` : priceLabel(x.plan),
      ]}
      pill={{ label: TIFFIN_STATUS[x.status].label, tone: TIFFIN_STATUS[x.status].tone }}
      onPress={() => navigation.navigate('FoodTiffin', { code: x.code })}
    />
  );
  const current = s.items.filter(x => CURRENT.includes(x.status));
  const past = s.items.filter(x => !CURRENT.includes(x.status));

  return (
    <ScreenShell title="Your tiffins" subtitle="Meals on set days, paid to the kitchen" onBack={back} refreshing={s.status === 'loading' && !!s.items.length} onRefresh={load}>
      {s.status === 'failed' ? <InlineNotice message={s.error.message} action={{ label: 'Try again', onPress: load }} /> : null}
      {s.status === 'loading' && !s.items.length ? (
        <SkeletonLines lines={6} />
      ) : !s.items.length && s.status === 'succeeded' ? (
        <EmptyState icon="calendar" title="No tiffins yet" body="Home kitchens offer weekday lunches and monthly dinners. Find one on a kitchen’s page." action={{ label: 'Browse home kitchens', onPress: () => navigation.navigate('FoodVendors', { rail: 'homeKitchens', title: 'Home kitchens' }) }} />
      ) : (
        <View style={styles.list}>
          {current.length ? <SectionHead title="Current" /> : null}
          {current.map(row)}
          {past.length ? <SectionHead title="Earlier" /> : null}
          {past.map(row)}
        </View>
      )}
    </ScreenShell>
  );
};

export default FoodTiffins;
