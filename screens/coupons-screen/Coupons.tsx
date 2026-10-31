// ═══════════════════════════════════════════════════════
// MetroMatrix — Coupons (the store's own codes)
// ═══════════════════════════════════════════════════════
// Each code with what it gives, its window, how often it's been used and
// whether it works right now. Customers see active ones at checkout.

import React, { useCallback } from 'react';
import { FlatList, StyleSheet, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useAppDispatch, useAppSelector } from '../../hooks/useReduxHooks';
import { useBack } from '../../hooks/useBack';
import { COUPON_STATUS_LABEL, couponValueLabel } from '../../models/shopping/couponFormModel';
import { ServiceScope, useStyles, type Theme } from '../../theme/index';
import { AppText, Button, Card, EmptyState, InlineNotice, ScreenShell, SkeletonLines, StatusPill } from '../../Custom-Components/index';
import type { Coupon, StorePartnerStackParamList } from '../../models';
import { formatDate } from '../../utils/dates/dates';
import { formatPKR } from '../../utils/money/money';
import { loadCouponsListAsync, selectCoupons } from './couponsSlice';

type Props = NativeStackScreenProps<StorePartnerStackParamList, 'Coupons'>;

const makeStyles = ({ space }: Theme) =>
  StyleSheet.create({
    list: { gap: space.s12, paddingBottom: space.s40 },
    head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  });

const usage = (c: Coupon) => `${c.usedCount}${c.usageLimit ? ` of ${c.usageLimit}` : ''} used`;
const couponWindow = (c: Coupon) => `${formatDate(c.startsAt)}${c.endsAt ? ` – ${formatDate(c.endsAt)}` : ', no end date'}`;

const Coupons: React.FC<Props> = props => (
  <ServiceScope service="shopping">
    <CouponsContent {...props} />
  </ServiceScope>
);

const CouponsContent: React.FC<Props> = ({ navigation }) => {
  const { back } = useBack({ name: 'StoreTabs', params: { screen: 'MoreTab' } });
  const dispatch = useAppDispatch();
  const styles = useStyles(makeStyles);
  const s = useAppSelector(selectCoupons);

  useFocusEffect(
    useCallback(() => {
      void dispatch(loadCouponsListAsync());
    }, [dispatch]),
  );

  return (
    <ScreenShell
      title="Coupons"
      onBack={back}
      scroll={false}
      footer={<Button label="New coupon" leftIcon="add" onPress={() => navigation.navigate('CouponForm')} fullWidth />}>
      <FlatList
        data={s.coupons}
        keyExtractor={c => c.id}
        contentContainerStyle={styles.list}
        renderItem={({ item: c }) => {
          const st = COUPON_STATUS_LABEL[c.status];
          return (
            <Card onPress={() => navigation.navigate('CouponForm', { id: c.id })} accessibilityLabel={`${c.code}, ${couponValueLabel(c)}, ${st.label}`}>
              <View style={styles.head}>
                <AppText variant="title">{c.code}</AppText>
                <StatusPill label={st.label} tone={st.tone} />
              </View>
              <AppText variant="body">
                {couponValueLabel(c)}
                {c.minOrder ? ` on ${formatPKR(c.minOrder)} or more` : ''}
              </AppText>
              <AppText variant="small" tone="muted">
                {couponWindow(c)} · {usage(c)}
              </AppText>
            </Card>
          );
        }}
        ListEmptyComponent={
          s.status === 'loading' ? (
            <SkeletonLines lines={5} />
          ) : s.status === 'failed' ? (
            <InlineNotice message={s.error.message} action={{ label: 'Try again', onPress: () => void dispatch(loadCouponsListAsync()) }} />
          ) : (
            <EmptyState icon="tag" title="No coupons yet" body="A code like EID15 brings customers back. You choose the discount, the minimum and the dates." />
          )
        }
      />
    </ScreenShell>
  );
};

export default Coupons;
