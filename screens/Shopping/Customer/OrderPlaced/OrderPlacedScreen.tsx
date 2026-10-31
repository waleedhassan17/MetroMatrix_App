// ═══════════════════════════════════════════════════════
// MetroMatrix — Order placed
// ═══════════════════════════════════════════════════════
// The order's code, what happens next per store, and — for a transfer —
// that the store is waiting for the payment. Stateless: the group is in the
// order-detail slice already (checkout put it there).

import React, { useEffect } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useAppDispatch, useAppSelector } from '../../../../hooks/useReduxHooks';
import { needsPayment, PAYMENT_METHOD_LABEL } from '../../../../models/shopping/orderStatusModel';
import { ServiceScope, useStyles, useTheme, type Theme } from '../../../../theme/index';
import { AppText, Button, Card, IonIcon, SkeletonLines, StickyCTA, StoreMark } from '../../../../Custom-Components/index';
import type { ShopBrowseParamList } from '../../../../types';
import { timeLeft } from '../../../../utils/dates';
import { formatPKR } from '../../../../utils/money';
import { loadOrderGroupAsync, selectOrderGroup } from '../OrderDetail/orderDetailSlice';

type Props = NativeStackScreenProps<ShopBrowseParamList, 'OrderPlaced'>;

const itemCount = (o: { items: { quantity: number }[] }) => o.items.reduce((n, i) => n + i.quantity, 0);

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
    head: { flexDirection: 'row', alignItems: 'center', gap: space.s12 },
    grow: { flex: 1 },
  });

const OrderPlacedScreen: React.FC<Props> = props => (
  <ServiceScope service="shopping">
    <OrderPlacedContent {...props} />
  </ServiceScope>
);

const OrderPlacedContent: React.FC<Props> = ({ navigation, route }) => {
  const dispatch = useAppDispatch();
  const styles = useStyles(makeStyles);
  const { colors } = useTheme();
  const root = useNavigation<{ navigate: (name: string, params?: object) => void }>();
  const { groupCode } = route.params;
  const e = useAppSelector(s => selectOrderGroup(s, groupCode));
  const g = e.group;

  useEffect(() => {
    if (e.status === 'idle') void dispatch(loadOrderGroupAsync(groupCode));
  }, [e.status, groupCode, dispatch]);

  // Back to the Shopping tabs, then the order over them (or the shop's Home tab).
  const leave = (to: 'order' | 'shop') => {
    navigation.popToTop();
    if (to === 'order') root.navigate('OrderDetail', { groupCode });
    else root.navigate('ShopTabs', { screen: 'ShopHomeTab' });
  };

  return (
    <View style={styles.root}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.hero} accessible accessibilityRole="header" accessibilityLabel={`Order placed. Your order number is ${groupCode}`}>
          <View style={styles.badge}>
            <IonIcon name="checkmark" size="hero" color={colors.success} />
          </View>
          <AppText variant="h1" align="center">
            Order placed
          </AppText>
          <AppText variant="body" tone="muted" align="center">
            Order {groupCode}. We’ll tell you as each store updates it.
          </AppText>
        </View>

        {!g ? (
          <SkeletonLines lines={5} />
        ) : (
          g.orders.map(o => {
            const owed = needsPayment(o);
            const left = o.paymentInstructions ? timeLeft(o.paymentInstructions.payBy) : null;
            return (
              <Card key={o.id} selected={owed}>
                <View style={styles.head}>
                  <StoreMark store={o.store} small />
                  <AppText variant="title" style={styles.grow} numberOfLines={1}>
                    {o.store.name}
                  </AppText>
                  <AppText variant="title">{formatPKR(o.total)}</AppText>
                </View>
                <AppText variant="small" tone="muted">
                  {itemCount(o)} {itemCount(o) === 1 ? 'item' : 'items'} · {PAYMENT_METHOD_LABEL[o.paymentMethod]}
                </AppText>
                {owed ? (
                  <>
                    <AppText variant="bodyStrong" tone="warning">
                      {o.store.name} is waiting for {formatPKR(o.total)}{left ? ` (${left})` : ''}.
                    </AppText>
                    <Button label="See how to pay" size="sm" variant="secondary" onPress={() => leave('order')} />
                  </>
                ) : (
                  <AppText variant="small">The store will confirm your order soon. Pay the rider in cash on delivery.</AppText>
                )}
              </Card>
            );
          })
        )}
      </ScrollView>
      <StickyCTA>
        <Button label="View order" onPress={() => leave('order')} fullWidth />
        <Button label="Continue shopping" variant="ghost" onPress={() => leave('shop')} fullWidth />
      </StickyCTA>
    </View>
  );
};

export default OrderPlacedScreen;
