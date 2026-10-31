// ═══════════════════════════════════════════════════════
// MetroMatrix — Food Court: order placed
// ═══════════════════════════════════════════════════════
// The order's code, that the kitchen is about to answer, when to expect it,
// and how it's paid — for a transfer, the kitchen's own account and the
// minutes left to send the money. Stateless: checkout left the order in its
// slice; on a reload it still leads to the order's live page.

import React from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useAppSelector } from '../../hooks/useReduxHooks';
import { PAYMENT_METHOD } from '../../models/food/foodStatusModel';
import { ServiceScope, useStyles, useTheme, type Theme } from '../../theme/index';
import { AppText, Button, Card, IonIcon, StickyCTA } from '../../Custom-Components/index';
import { TransferCard } from '../../Custom-Components/food/TransferCard';
import type { FoodAppParamList } from '../../models';
import { formatSlot } from '../../utils/health-time/healthTime';
import { formatPKR } from '../../utils/money/money';
import { selectFoodCheckout } from '../food-checkout-screen/foodCheckoutSlice';

type Props = NativeStackScreenProps<FoodAppParamList, 'FoodOrderPlaced'>;

const makeStyles = ({ colors, space, size, radius, gutter }: Theme) =>
  StyleSheet.create({
    root: { flex: 1, backgroundColor: colors.canvas },
    content: { paddingHorizontal: gutter, paddingBottom: space.s40, gap: space.s16 },
    hero: { alignItems: 'center', gap: space.s8, paddingVertical: space.s32 },
    badge: {
      width: size.avatar.xl,
      height: size.avatar.xl,
      borderRadius: radius.pill,
      backgroundColor: colors.successSoft,
      alignItems: 'center',
      justifyContent: 'center',
    },
    row: { flexDirection: 'row', justifyContent: 'space-between', gap: space.s12 },
  });

const FoodOrderPlaced: React.FC<Props> = props => (
  <ServiceScope service="food">
    <FoodOrderPlacedContent {...props} />
  </ServiceScope>
);

const FoodOrderPlacedContent: React.FC<Props> = ({ navigation, route }) => {
  const styles = useStyles(makeStyles);
  const { colors } = useTheme();
  const { code } = route.params;
  const placed = useAppSelector(selectFoodCheckout).placed;
  const o = placed?.code === code ? placed : null;
  const items = o ? o.items.reduce((n, i) => n + i.quantity, 0) : 0;

  // This page leaves the history: back from the order goes to the menus.
  const follow = () => navigation.replace('FoodOrder', { code });
  const home = () => {
    navigation.popToTop();
    navigation.navigate('FoodTabs', { screen: 'FoodHomeTab' });
  };

  const when = o
    ? o.scheduledFor
      ? `${o.fulfilment === 'pickup' ? 'Ready to collect' : 'Arrives'} at ${formatSlot(o.scheduledFor, 'Asia/Karachi')}`
      : o.eta.promisedAt
        ? `${o.fulfilment === 'pickup' ? 'Ready by' : 'Arrives by'} about ${formatSlot(o.eta.promisedAt, 'Asia/Karachi')}`
        : null
    : null;

  return (
    <View style={styles.root}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.hero} accessible accessibilityRole="header" accessibilityLabel={`Order placed. Your order code is ${code}`}>
          <View style={styles.badge}>
            <IonIcon name="checkmark" size="hero" color={colors.success} />
          </View>
          <AppText variant="h1" align="center">
            Order placed
          </AppText>
          <AppText variant="body" tone="muted" align="center">
            {o ? `Order ${code}. ${o.vendor.name} will accept it in the next few minutes, and we’ll tell you when they do.` : `Order ${code}. You can follow it from Orders.`}
          </AppText>
        </View>

        {o ? (
          <Card>
            <View style={styles.row}>
              <AppText variant="title">{o.vendor.name}</AppText>
              <AppText variant="title">{formatPKR(o.totals.total)}</AppText>
            </View>
            <AppText variant="small" tone="muted">
              {`${items} ${items === 1 ? 'item' : 'items'} · ${o.fulfilment === 'pickup' ? 'Pick-up' : 'Delivery'} · ${PAYMENT_METHOD[o.payment.method].label}`}
            </AppText>
            {when ? <AppText variant="small">{when}</AppText> : null}
            {o.payment.method !== 'transfer' && o.payment.instructions ? (
              <AppText variant="small" tone="muted">
                {o.payment.instructions}
              </AppText>
            ) : null}
          </Card>
        ) : null}

        {o && o.payment.method === 'transfer' && o.payment.accounts ? (
          <TransferCard
            vendorName={o.vendor.name}
            amount={o.totals.total}
            accounts={o.payment.accounts}
            status={o.payment.status}
            payBy={o.payment.payBy}
            onSendReceipt={() => navigation.navigate('PaymentProof', { foodOrderCode: code })}
          />
        ) : null}
      </ScrollView>
      <StickyCTA>
        <Button label="Follow your order" onPress={follow} fullWidth />
        <Button label="Back to the Food Court" variant="ghost" onPress={home} fullWidth />
      </StickyCTA>
    </View>
  );
};

export default FoodOrderPlaced;
