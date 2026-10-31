// ═══════════════════════════════════════════════════════
// MetroMatrix — Food Court: my Bachat Box reservations
// ═══════════════════════════════════════════════════════
// Each with its pickup code, the kitchen, the window and where it stands;
// the ones still to collect first.

import React, { useCallback } from 'react';
import { StyleSheet, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useAppDispatch, useAppSelector } from '../../../../hooks/useReduxHooks';
import { useBack } from '../../../../hooks/useBack';
import { RESERVATION_STATUS, boxPaymentStatus } from '../../../../models/kitchen/kitchenStatusModel';
import { BACHAT_BOX } from '../../../../models/kitchen/surplusModel';
import { ServiceScope, useStyles, type Theme } from '../../../../theme/index';
import { EmptyState, InlineNotice, ScreenShell, SkeletonLines } from '../../../../Custom-Components/index';
import { RowCard, SectionHead } from '../../../../Components/admin/AdminParts';
import type { FoodAppParamList, SurplusReservation } from '../../../../types';
import { formatPKR } from '../../../../utils/money';
import { loadMyReservationsAsync, selectMyReservations } from './surplusReservationsSlice';

type Props = NativeStackScreenProps<FoodAppParamList, 'FoodSurplusReservations'>;

const makeStyles = ({ space }: Theme) =>
  StyleSheet.create({
    list: { gap: space.s12 },
  });

const FoodSurplusReservationsScreen: React.FC<Props> = props => (
  <ServiceScope service="food">
    <FoodSurplusReservationsContent {...props} />
  </ServiceScope>
);

const FoodSurplusReservationsContent: React.FC<Props> = ({ navigation }) => {
  const { back } = useBack({ name: 'FoodTabs' });
  const dispatch = useAppDispatch();
  const styles = useStyles(makeStyles);
  const s = useAppSelector(selectMyReservations);
  const load = useCallback(() => void dispatch(loadMyReservationsAsync()), [dispatch]);
  useFocusEffect(load);

  const row = (r: SurplusReservation) => (
    <RowCard
      key={r.code}
      title={r.vendor.name}
      mark={{ icon: 'gift-outline', tint: 'rose' }}
      lines={[`${r.code} · ${r.box.title}`, `Pick up ${r.pickupLabel}`, r.status === 'reserved' ? boxPaymentStatus(r.payment.status).label : null]}
      pill={{ label: RESERVATION_STATUS[r.status].label, tone: RESERVATION_STATUS[r.status].tone }}
      amount={formatPKR(r.total)}
      onPress={() => navigation.navigate('FoodSurplusReserved', { code: r.code })}
    />
  );
  const toCollect = s.items.filter(r => r.status === 'reserved');
  const past = s.items.filter(r => r.status !== 'reserved');

  return (
    <ScreenShell title={`${BACHAT_BOX} reservations`} subtitle="Your pickup codes" onBack={back} refreshing={s.status === 'loading' && !!s.items.length} onRefresh={load}>
      {s.status === 'failed' ? <InlineNotice message={s.error.message} action={{ label: 'Try again', onPress: load }} /> : null}
      {s.status === 'loading' && !s.items.length ? (
        <SkeletonLines lines={6} />
      ) : !s.items.length && s.status === 'succeeded' ? (
        <EmptyState icon="gift" title="No reservations yet" body="Kitchens nearby put tonight’s food up as Bachat Boxes at a lower price. Reserve one from Food Court’s home." action={{ label: 'See Bachat Boxes', onPress: () => navigation.navigate('FoodSurplusList') }} />
      ) : (
        <View style={styles.list}>
          {toCollect.length ? <SectionHead title="To collect" /> : null}
          {toCollect.map(row)}
          {past.length ? <SectionHead title="Earlier" /> : null}
          {past.map(row)}
        </View>
      )}
    </ScreenShell>
  );
};

export default FoodSurplusReservationsScreen;
