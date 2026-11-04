// ═══════════════════════════════════════════════════════
// MetroMatrix — Food Court: order placed
// ═══════════════════════════════════════════════════════
// The order's code, that the kitchen is about to answer, when to expect it,
// and how it's paid — for a transfer, the kitchen's own account and the
// minutes left to send the money. Stateless: checkout left the order in its
// slice; on a reload it still leads to the order's live page. Shopping's
// confirmation look: a ring round a solid disc, the code to copy, ONE card.

import React from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Toast from 'react-native-toast-message';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useAppSelector } from '../../hooks/useReduxHooks';
import { PAYMENT_METHOD } from '../../models/food/foodStatusModel';
import { ServiceScope, useStyles, useTheme, type Theme } from '../../theme/index';
import { AppText, Button, Card, IonIcon, StickyCTA, StoreHeadRow } from '../../Custom-Components/index';
import { TransferCard } from '../../Custom-Components/food/TransferCard';
import type { FoodAppParamList } from '../../models';
import { formatSlot } from '../../utils/health-time/healthTime';
import { formatPKR } from '../../utils/money/money';
import { selectFoodCheckout } from '../food-checkout-screen/foodCheckoutSlice';

type Props = NativeStackScreenProps<FoodAppParamList, 'FoodOrderPlaced'>;

const makeStyles = ({ colors, space, size, radius, gutter }: Theme) =>
  StyleSheet.create({
    root: { flex: 1, backgroundColor: colors.canvas },
    content: { paddingHorizontal: gutter, paddingBottom: space.s40, gap: space.s20 },
    hero: { alignItems: 'center', gap: space.s12, paddingVertical: space.s32 },
    ring: {
      width: size.successRing,
      height: size.successRing,
      borderRadius: radius.pill,
      backgroundColor: colors.successSoft,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: space.s8,
    },
    disc: {
      width: size.successDisc,
      height: size.successDisc,
      borderRadius: radius.pill,
      backgroundColor: colors.success,
      alignItems: 'center',
      justifyContent: 'center',
    },
    code: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: space.s8,
      paddingHorizontal: space.s16,
      paddingVertical: space.s8,
      minHeight: size.touch,
      borderRadius: radius.pill,
      borderWidth: size.hairline,
      borderColor: colors.line,
      backgroundColor: colors.surface,
    },
    facts: { gap: space.s4 },
  });

const FoodOrderPlaced: React.FC<Props> = props => (
  <ServiceScope service="food">
    <FoodOrderPlacedContent {...props} />
  </ServiceScope>
);

const FoodOrderPlacedContent: React.FC<Props> = ({ navigation, route }) => {
  const styles = useStyles(makeStyles);
  const { colors, service } = useTheme();
  const insets = useSafeAreaInsets();
  const { code } = route.params;
  const copy = async () => {
    await Clipboard.setStringAsync(code);
    Toast.show({ type: 'success', text1: 'Order code copied' });
  };
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
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.hero}>
          <View style={styles.ring} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
            <View style={styles.disc}>
              <IonIcon name="checkmark" size="xl" color={colors.onScrim} />
            </View>
          </View>
          <AppText variant="h1" align="center" accessibilityRole="header">
            Order placed
          </AppText>
          <AppText variant="body" tone="muted" align="center">
            {o ? `${o.vendor.name} will accept it in the next few minutes, and we’ll tell you when they do.` : 'You can follow it from Orders.'}
          </AppText>
          <Pressable onPress={() => void copy()} style={styles.code} accessibilityRole="button" accessibilityLabel={`Order ${code}. Copy`}>
            <AppText variant="tag" tone="muted">
              ORDER
            </AppText>
            <AppText variant="bodyStrong">{code}</AppText>
            <IonIcon name="copy-outline" size="sm" color={service.accentDeep} />
          </Pressable>
        </View>

        {o ? (
          <Card>
            <StoreHeadRow
              store={{ name: o.vendor.name, logoUrl: o.vendor.logoUrl ?? null, brandColor: service.accent }}
              meta={`${items} ${items === 1 ? 'item' : 'items'} · ${o.fulfilment === 'pickup' ? 'Pick-up' : 'Delivery'}`}
              trailing={formatPKR(o.totals.total)}
              chevron={false}
            />
            <View style={styles.facts}>
              <AppText variant="small" tone="muted">
                {PAYMENT_METHOD[o.payment.method].label}
              </AppText>
              {when ? <AppText variant="small">{when}</AppText> : null}
              {o.payment.method !== 'transfer' && o.payment.instructions ? (
                <AppText variant="small" tone="muted">
                  {o.payment.instructions}
                </AppText>
              ) : null}
            </View>
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
        <Button label="Track your order" onPress={follow} fullWidth />
        <Button label="Back to the Food Court" variant="secondary" onPress={home} fullWidth />
      </StickyCTA>
    </View>
  );
};

export default FoodOrderPlaced;
