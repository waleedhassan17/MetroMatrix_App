// ═══════════════════════════════════════════════════════
// MetroMatrix — Coupons (the store's own codes)
// ═══════════════════════════════════════════════════════
// Each code with what it gives, its window, how often it's been used and
// whether it works right now. Customers see active ones at checkout.

import React, { useCallback } from 'react';
import { FlatList, StyleSheet } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useAppDispatch, useAppSelector } from '../../hooks/useReduxHooks';
import { useBack } from '../../hooks/useBack';
import { COUPON_STATUS_LABEL, couponValueLabel } from '../../models/shopping/couponFormModel';
import { ServiceScope, useStyles, type Theme } from '../../theme/index';
import { Button, EmptyState, InlineNotice, RowCardsSkeleton, ScreenShell } from '../../Custom-Components/index';
import { RowCard } from '../../Components/admin/AdminParts';
import type { Coupon, StorePartnerStackParamList } from '../../models';
import { formatDate } from '../../utils/dates/dates';
import { formatPKR } from '../../utils/money/money';
import { loadCouponsListAsync, selectCoupons } from './couponsSlice';

type Props = NativeStackScreenProps<StorePartnerStackParamList, 'Coupons'>;

const makeStyles = ({ space }: Theme) =>
  StyleSheet.create({
    list: { gap: space.s12, paddingBottom: space.s40 },
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
      subtitle="Codes customers use at checkout"
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
            <RowCard
              mark={{ icon: 'pricetag-outline', tint: 'rose' }}
              title={c.code}
              lines={[`${couponValueLabel(c)}${c.minOrder ? ` on ${formatPKR(c.minOrder)} or more` : ''}`, `${couponWindow(c)} · ${usage(c)}`]}
              pill={{ label: st.label, tone: st.tone }}
              onPress={() => navigation.navigate('CouponForm', { id: c.id })}
            />
          );
        }}
        ListEmptyComponent={
          s.status === 'loading' ? (
            <RowCardsSkeleton count={3} />
          ) : s.status === 'failed' ? (
            <InlineNotice message={s.error.message} action={{ label: 'Try again', onPress: () => void dispatch(loadCouponsListAsync()) }} />
          ) : (
            <EmptyState ion="pricetag-outline" title="No coupons yet" body="A code like EID15 brings customers back. You choose the discount, the minimum and the dates." />
          )
        }
      />
    </ScreenShell>
  );
};

export default Coupons;
