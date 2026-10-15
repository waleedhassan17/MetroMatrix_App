// ═══════════════════════════════════════════════════════
// MetroMatrix — Admin: find an order
// ═══════════════════════════════════════════════════════
// Type the MM- code a customer or store quotes; see each store's part, its
// status and payment, and who placed it. Read-only: the stores own orders.

import React, { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useAppDispatch, useAppSelector } from '@hooks/useReduxHooks';
import { useBack } from '@hooks/useBack';
import { formatAddress } from '@models/addressModel';
import { ORDER_STATUS, PAYMENT_METHOD_LABEL, PAYMENT_STATUS } from '@models/shopping/orderStatusModel';
import { useStyles, type Theme } from '@theme/index';
import { AppText, Button, Card, InlineNotice, OrderTimeline, ScreenShell, SkeletonLines, StatusPill, StoreMark, TextField } from '@custom/index';
import type { AdminShopStackParamList } from '@/types';
import { formatDateTime } from '@utils/dates';
import { formatPKR } from '@utils/money';
import { lookupOrderAsync, selectOrderLookup, setLookupCode } from './orderLookupSlice';

type Props = NativeStackScreenProps<AdminShopStackParamList, 'OrderLookup'>;

const makeStyles = ({ space }: Theme) =>
  StyleSheet.create({
    head: { flexDirection: 'row', alignItems: 'center', gap: space.s12 },
    grow: { flex: 1, gap: space.s4 },
    pills: { flexDirection: 'row', gap: space.s8, flexWrap: 'wrap' },
  });

const OrderLookupScreen: React.FC<Props> = ({ route }) => {
  const { back } = useBack({ name: 'ShopOverview' });
  const dispatch = useAppDispatch();
  const styles = useStyles(makeStyles);
  const s = useAppSelector(selectOrderLookup);
  const g = s.result?.group;

  useEffect(() => {
    const code = route.params?.groupCode;
    if (code) {
      dispatch(setLookupCode(code));
      void dispatch(lookupOrderAsync(code));
    }
  }, [route.params?.groupCode, dispatch]);

  const find = () => s.code.length >= 4 && void dispatch(lookupOrderAsync(s.code));

  return (
    <ScreenShell title="Find an order" onBack={back}>
      <TextField label="Order code" value={s.code} onChangeText={t => dispatch(setLookupCode(t))} onSubmitEditing={find} autoCapitalize="characters" autoCorrect={false} placeholder="MM-24A7Q2" returnKeyType="search" />
      <Button label="Find" onPress={find} disabled={s.code.length < 4} loading={s.status === 'loading'} fullWidth />
      {s.status === 'failed' ? <InlineNotice message={s.error.message} /> : null}
      {s.status === 'loading' ? <SkeletonLines lines={6} /> : null}
      {g && s.result ? (
        <>
          <Card>
            <AppText variant="title">{g.code}</AppText>
            <AppText variant="small" tone="muted">
              {s.result.customer.name} · {s.result.customer.email}
            </AppText>
            <AppText variant="small" tone="muted">
              Placed {formatDateTime(g.createdAt)} · {formatPKR(g.total)} · to {formatAddress(g.address)}
            </AppText>
          </Card>
          {g.orders.map(o => {
            const st = ORDER_STATUS[o.status];
            const pay = PAYMENT_STATUS[o.paymentStatus];
            return (
              <Card key={o.id}>
                <View style={styles.head}>
                  <StoreMark store={o.store} small />
                  <View style={styles.grow}>
                    <AppText variant="title">{o.store.name}</AppText>
                    <AppText variant="caption" tone="muted">
                      {o.code} · {formatPKR(o.total)} · {PAYMENT_METHOD_LABEL[o.paymentMethod]}
                    </AppText>
                  </View>
                </View>
                <View style={styles.pills}>
                  <StatusPill label={st.label} tone={st.tone} />
                  <StatusPill label={pay.label} tone={pay.tone} />
                </View>
                <OrderTimeline order={o} />
              </Card>
            );
          })}
        </>
      ) : null}
    </ScreenShell>
  );
};

export default OrderLookupScreen;
